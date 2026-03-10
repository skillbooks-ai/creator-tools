#!/usr/bin/env bash
# validate.sh — Validate a skillbook against FORMAT.md v1.0
# Usage: ./validate.sh /path/to/my-book
#
# Exit codes:
#   0 = all checks pass
#   1 = errors found (must fix before publishing)
#   2 = warnings only (can publish, but should fix)

set -uo pipefail

BOOK_PATH="${1:?Usage: validate.sh /path/to/my-book}"
BOOK_PATH="${BOOK_PATH%/}"  # strip trailing slash

ERRORS=0
WARNINGS=0

error() { echo "  ❌ ERROR: $1"; ((ERRORS++)); }
warn()  { echo "  ⚠️  WARN:  $1"; ((WARNINGS++)); }
ok()    { echo "  ✅ $1"; }
info()  { echo "  ℹ️  $1"; }

echo "═══════════════════════════════════════════"
echo "  Skillbook Validator v1.0"
echo "  Book: $BOOK_PATH"
echo "═══════════════════════════════════════════"
echo ""

# ─── Required Root Files ──────────────────────
echo "📁 Root files"

if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
  ok "SKILL.md exists"
else
  error "SKILL.md not found"
fi

if [[ -f "$BOOK_PATH/README.md" ]]; then
  ok "README.md exists"
else
  error "README.md not found (required for catalog listing)"
fi

if [[ -f "$BOOK_PATH/book.json" ]]; then
  ok "book.json exists"
else
  error "book.json not found"
fi

echo ""

# ─── SKILL.md Frontmatter ──────────────────────
echo "📋 SKILL.md frontmatter"

if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
  # Extract frontmatter (between first two --- lines)
  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")

  for field in name title description server version pages price license; do
    if echo "$FRONTMATTER" | grep -q "^${field}:"; then
      ok "frontmatter: $field"
    else
      error "frontmatter missing required field: $field"
    fi
  done

  # Check for License section in body
  if grep -q "^## License" "$BOOK_PATH/SKILL.md"; then
    ok "## License section present"
  else
    error "SKILL.md missing ## License section"
  fi
fi

echo ""

# ─── book.json Fields ──────────────────────
echo "📦 book.json"

if [[ -f "$BOOK_PATH/book.json" ]]; then
  for field in id title version language verified; do
    if python3 -c "import json; d=json.load(open('$BOOK_PATH/book.json')); assert '$field' in d" 2>/dev/null; then
      ok "book.json: $field"
    else
      error "book.json missing required field: $field"
    fi
  done

  # Check structure.readme
  if python3 -c "import json; d=json.load(open('$BOOK_PATH/book.json')); assert d.get('structure',{}).get('readme')" 2>/dev/null; then
    ok "book.json: structure.readme"
  else
    error "book.json missing structure.readme"
  fi

  # Warn if structure.summary still exists (removed in v1.0)
  if python3 -c "import json; d=json.load(open('$BOOK_PATH/book.json')); assert d.get('structure',{}).get('summary')" 2>/dev/null; then
    warn "book.json still has structure.summary — removed in FORMAT v1.0"
  fi
fi

echo ""

# ─── Section Structure ──────────────────────
echo "📂 Section structure"

SECTION_COUNT=0
CONTENT_PAGE_COUNT=0

for section_dir in "$BOOK_PATH"/[0-9][0-9]-*/; do
  [[ -d "$section_dir" ]] || continue
  section_name=$(basename "$section_dir")
  ((SECTION_COUNT++))

  # Check for 00-overview.md
  if [[ -f "$section_dir/00-overview.md" ]]; then
    ok "$section_name/00-overview.md exists"
  else
    error "$section_name/ missing 00-overview.md"
  fi

  # Check content pages
  for page in "$section_dir"/*.md; do
    [[ -f "$page" ]] || continue
    page_name=$(basename "$page")
    ((CONTENT_PAGE_COUNT++))

    # Check naming convention (NN-name.md)
    if [[ ! "$page_name" =~ ^[0-9][0-9]-.+\.md$ ]]; then
      error "$section_name/$page_name — doesn't match NN-name.md pattern"
    fi

    # Check line count
    lines=$(wc -l < "$page" | tr -d ' ')
    if (( lines < 20 )); then
      warn "$section_name/$page_name — only $lines lines (target: 40-100)"
    elif (( lines < 40 )); then
      warn "$section_name/$page_name — $lines lines (target: 40-100, slightly short)"
    elif (( lines > 150 )); then
      warn "$section_name/$page_name — $lines lines (target: 40-100, consider splitting)"
    elif (( lines > 100 )); then
      warn "$section_name/$page_name — $lines lines (target: 40-100, slightly long)"
    fi
  done

  # Check 00-overview.md indexes all files in the folder
  if [[ -f "$section_dir/00-overview.md" ]]; then
    for page in "$section_dir"/[0-9][0-9]-*.md; do
      [[ -f "$page" ]] || continue
      page_name=$(basename "$page")
      [[ "$page_name" == "00-overview.md" ]] && continue
      if ! grep -q "$page_name" "$section_dir/00-overview.md"; then
        warn "$section_name/00-overview.md doesn't reference $page_name"
      fi
    done
  fi

  # Recurse into sub-section folders
  for sub_dir in "$section_dir"/[0-9][0-9]-*/; do
    [[ -d "$sub_dir" ]] || continue
    sub_name=$(basename "$sub_dir")
    full_path="$section_name/$sub_name"

    if [[ -f "$sub_dir/00-overview.md" ]]; then
      ok "$full_path/00-overview.md exists"
    else
      error "$full_path/ missing 00-overview.md"
    fi

    for page in "$sub_dir"/*.md; do
      [[ -f "$page" ]] || continue
      ((CONTENT_PAGE_COUNT++))
    done
  done
done

info "Found $SECTION_COUNT sections, $CONTENT_PAGE_COUNT content pages"

echo ""

# ─── TOC Link Validation ──────────────────────
echo "🔗 TOC link validation"

if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
  # Extract backtick-quoted paths from TOC
  toc_paths=$(grep -oE '`[0-9][0-9]-[^`]+\.md`' "$BOOK_PATH/SKILL.md" | tr -d '`' || true)
  toc_count=0
  broken_count=0

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    ((toc_count++))
    if [[ ! -f "$BOOK_PATH/$path" ]]; then
      error "TOC references $path — file not found"
      ((broken_count++))
    fi
  done <<< "$toc_paths"

  if (( broken_count == 0 && toc_count > 0 )); then
    ok "All $toc_count TOC paths resolve"
  fi

  # Check for content files NOT in the TOC
  for section_dir in "$BOOK_PATH"/[0-9][0-9]-*/; do
    [[ -d "$section_dir" ]] || continue
    section_name=$(basename "$section_dir")
    for page in "$section_dir"/[0-9][0-9]-*.md; do
      [[ -f "$page" ]] || continue
      page_name=$(basename "$page")
      rel_path="$section_name/$page_name"
      if ! echo "$toc_paths" | grep -qF "$rel_path"; then
        warn "$rel_path exists but is not in the SKILL.md TOC (orphan page)"
      fi
    done
  done
fi

echo ""

# ─── Tag Consistency ──────────────────────
echo "🏷️  Tags"

# Collect all tags from page frontmatter
HAS_TAGS=false

for page in $(find "$BOOK_PATH" -path "$BOOK_PATH/sources" -prune -o -path "$BOOK_PATH/.verify" -prune -o -name "*.md" -print | sort); do
  [[ -f "$page" ]] || continue
  # Check if file has tags in frontmatter
  if head -20 "$page" | grep -q "^tags:"; then
    HAS_TAGS=true
  fi
done

if $HAS_TAGS; then
  if [[ -f "$BOOK_PATH/TAG-INDEX.json" ]]; then
    ok "TAG-INDEX.json exists (pages have tags)"
  else
    error "Pages have tags in frontmatter but TAG-INDEX.json is missing. Run: skillbook tag-index $BOOK_PATH"
  fi

  # Check SKILL.md frontmatter has tags: true
  if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
    FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")
    if echo "$FRONTMATTER" | grep -q "^tags:.*true"; then
      ok "SKILL.md frontmatter: tags: true"
    else
      warn "Pages have tags but SKILL.md frontmatter doesn't have tags: true"
    fi
  fi
else
  info "No tags found in page frontmatter"
  if [[ -f "$BOOK_PATH/TAG-INDEX.json" ]]; then
    warn "TAG-INDEX.json exists but no pages have tags"
  fi
fi

echo ""

# ─── Summary ──────────────────────
echo "═══════════════════════════════════════════"
if (( ERRORS > 0 )); then
  echo "  ❌ $ERRORS error(s), $WARNINGS warning(s)"
  echo "  Fix errors before publishing."
  echo "═══════════════════════════════════════════"
  exit 1
elif (( WARNINGS > 0 )); then
  echo "  ⚠️  $WARNINGS warning(s), 0 errors"
  echo "  Book is publishable, but consider fixing warnings."
  echo "═══════════════════════════════════════════"
  exit 2
else
  echo "  ✅ All checks passed!"
  echo "═══════════════════════════════════════════"
  exit 0
fi
