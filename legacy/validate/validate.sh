#!/usr/bin/env bash
# validate.sh — Validate a skillbook against FORMAT v1.1
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
echo "  Skillbook Validator v1.1"
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

if [[ -f "$BOOK_PATH/package.json" ]]; then
  ok "package.json exists"
else
  error "package.json not found"
  # Check for legacy book.json
  if [[ -f "$BOOK_PATH/book.json" ]]; then
    warn "Found book.json — this was replaced by package.json in FORMAT v1.1"
  fi
fi

echo ""

# ─── SKILL.md Frontmatter ──────────────────────
echo "📋 SKILL.md frontmatter"

if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
  # Extract frontmatter (between first two --- lines)
  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")

  # Agent Skills standard fields
  for field in name description license; do
    if echo "$FRONTMATTER" | grep -q "^${field}:"; then
      ok "frontmatter: $field (Agent Skills)"
    else
      error "frontmatter missing required field: $field"
    fi
  done

  # Recommended Agent Skills fields
  for field in author compatibility; do
    if echo "$FRONTMATTER" | grep -q "^${field}:"; then
      ok "frontmatter: $field (Agent Skills)"
    else
      warn "frontmatter missing recommended field: $field"
    fi
  done

  # Skillbook extension fields under metadata
  if echo "$FRONTMATTER" | grep -q "^metadata:"; then
    ok "frontmatter: metadata block"

    for field in skillbook-title skillbook-server skillbook-version skillbook-pages skillbook-price; do
      if echo "$FRONTMATTER" | grep -q "skillbook-${field#skillbook-}:"; then
        ok "metadata: $field"
      else
        error "metadata missing required field: $field"
      fi
    done

    # Recommended metadata fields
    for field in skillbook-author; do
      if echo "$FRONTMATTER" | grep -q "$field:"; then
        ok "metadata: $field"
      else
        warn "metadata missing recommended field: $field"
      fi
    done
  else
    error "frontmatter missing metadata block (skillbook extension fields)"
  fi

  # Check for License section in body
  if grep -q "^## License" "$BOOK_PATH/SKILL.md"; then
    ok "## License section present"
  else
    error "SKILL.md missing ## License section"
  fi
fi

echo ""

# ─── package.json Fields ──────────────────────
echo "📦 package.json"

if [[ -f "$BOOK_PATH/package.json" ]]; then
  # Standard npm fields
  for field in name version license; do
    if python3 -c "import json; d=json.load(open('$BOOK_PATH/package.json')); assert '$field' in d and d['$field']" 2>/dev/null; then
      ok "package.json: $field"
    else
      error "package.json missing required field: $field"
    fi
  done

  # Recommended npm fields
  for field in description author; do
    if python3 -c "import json; d=json.load(open('$BOOK_PATH/package.json')); assert '$field' in d and d['$field']" 2>/dev/null; then
      ok "package.json: $field"
    else
      warn "package.json missing recommended field: $field"
    fi
  done

  # Check private: true
  if python3 -c "import json; d=json.load(open('$BOOK_PATH/package.json')); assert d.get('private') == True" 2>/dev/null; then
    ok "package.json: private: true"
  else
    warn "package.json should have private: true (prevents accidental npm publish)"
  fi

  # Skillbook config
  if python3 -c "import json; d=json.load(open('$BOOK_PATH/package.json')); assert 'skillbook' in d" 2>/dev/null; then
    ok "package.json: skillbook config"

    for field in title server pages price language verified; do
      if python3 -c "import json; d=json.load(open('$BOOK_PATH/package.json')); assert '$field' in d['skillbook']" 2>/dev/null; then
        ok "skillbook.$field"
      else
        error "package.json missing skillbook.$field"
      fi
    done
  else
    error "package.json missing skillbook config block"
  fi

  # Sync checks: package.json ↔ SKILL.md (FORMAT v1.1 sync rules)
  if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
    FRONTMATTER_RAW=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")

    # Use Python for reliable YAML-aware field extraction
    skill_field() {
      python3 -c "
import sys, re
fm = sys.argv[1]
field = sys.argv[2]
# Simple YAML parser: handles inline values and multi-line >- / |
lines = fm.split('\n')
found = False
value = ''
for i, line in enumerate(lines):
    if line.startswith(field + ':'):
        raw = line[len(field)+1:].strip()
        if raw in ('>-', '>', '|', '|-'):
            # Multi-line: collect indented continuation lines
            parts = []
            for j in range(i+1, len(lines)):
                if lines[j] and (lines[j][0] == ' ' or lines[j][0] == '\t'):
                    parts.append(lines[j].strip())
                else:
                    break
            value = ' '.join(parts)
        else:
            value = raw.strip('\"').strip(\"'\")
        found = True
        break
if found:
    print(value)
" "$FRONTMATTER_RAW" "$1" 2>/dev/null || echo ""
    }
    # Helper: extract metadata field (strips quotes)
    skill_meta() {
      echo "$FRONTMATTER_RAW" | grep "[[:space:]]${1}:" | head -1 | sed "s/.*${1}:[[:space:]]*//" | tr -d '"' | tr -d "'"
    }
    # Helper: extract package.json field
    pkg_field() {
      python3 -c "import json; v=json.load(open('$BOOK_PATH/package.json')).get('$1',''); print(str(v) if v is not None else '')" 2>/dev/null || echo ""
    }
    # Helper: extract package.json skillbook.* field
    pkg_sb() {
      python3 -c "import json; v=json.load(open('$BOOK_PATH/package.json')).get('skillbook',{}).get('$1',''); print(str(v) if v is not None else '')" 2>/dev/null || echo ""
    }

    # Sync check helper
    sync_check() {
      local label="$1" pkg_val="$2" skill_val="$3" level="${4:-error}"
      if [[ -z "$pkg_val" || -z "$skill_val" ]]; then
        return  # skip if either side is missing (caught by field checks above)
      fi
      if [[ "$pkg_val" == "$skill_val" ]]; then
        ok "sync: $label matches"
      else
        if [[ "$level" == "warn" ]]; then
          warn "sync: $label mismatch — package.json='$pkg_val' vs SKILL.md='$skill_val'"
        else
          error "sync: $label mismatch — package.json='$pkg_val' vs SKILL.md='$skill_val'"
        fi
      fi
    }

    # Standard fields: name, version, description, author, license
    sync_check "name" "$(pkg_field name)" "$(skill_field name)"
    sync_check "version" "$(pkg_field version)" "$(skill_meta skillbook-version)"
    sync_check "description" "$(pkg_field description)" "$(skill_field description)" "warn"
    sync_check "author" "$(pkg_field author)" "$(skill_field author)" "warn"
    sync_check "license" "$(pkg_field license)" "$(skill_field license)"

    # Skillbook fields: title, author, pages, price, server
    sync_check "skillbook.title" "$(pkg_sb title)" "$(skill_meta skillbook-title)"
    sync_check "skillbook.author" "$(pkg_sb author)" "$(skill_meta skillbook-author)" "warn"
    sync_check "skillbook.pages" "$(pkg_sb pages)" "$(skill_meta skillbook-pages)"
    sync_check "skillbook.price" "$(pkg_sb price)" "$(skill_meta skillbook-price)"
    sync_check "skillbook.server" "$(pkg_sb server)" "$(skill_meta skillbook-server)"
  fi

  # Warn on legacy book.json
  if [[ -f "$BOOK_PATH/book.json" ]]; then
    warn "book.json still present — replaced by package.json in FORMAT v1.1. Consider removing."
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
  # Strip fenced code blocks and inline backticks before extracting TOC paths
  # This prevents false matches on example paths in documentation
  toc_paths=$(python3 -c "
import re, sys
with open(sys.argv[1]) as f:
    content = f.read()
# Strip fenced code blocks
content = re.sub(r'\`\`\`[\s\S]*?\`\`\`', '', content)
# Now extract backtick-quoted paths from remaining content
for m in re.finditer(r'\x60([0-9]{2}-[^\x60]+\.md)\x60', content):
    print(m.group(1))
" "$BOOK_PATH/SKILL.md" 2>/dev/null || true)
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

HAS_TAGS=false

for page in $(find "$BOOK_PATH" -path "$BOOK_PATH/sources" -prune -o -path "$BOOK_PATH/.verify" -prune -o -path "$BOOK_PATH/node_modules" -prune -o -name "*.md" -print | sort); do
  [[ -f "$page" ]] || continue
  if head -20 "$page" | grep -q "^tags:"; then
    HAS_TAGS=true
  fi
done

if $HAS_TAGS; then
  if [[ -f "$BOOK_PATH/TAG-INDEX.json" ]]; then
    ok "TAG-INDEX.json exists (pages have tags)"
  else
    error "Pages have tags in frontmatter but TAG-INDEX.json is missing. Run: skillbook index $BOOK_PATH"
  fi

  # Check SKILL.md metadata has skillbook-tags: "true"
  if [[ -f "$BOOK_PATH/SKILL.md" ]]; then
    FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")
    if echo "$FRONTMATTER" | grep -q "skillbook-tags:.*true"; then
      ok "SKILL.md metadata: skillbook-tags: true"
    else
      warn "Pages have tags but SKILL.md metadata doesn't have skillbook-tags: \"true\""
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
