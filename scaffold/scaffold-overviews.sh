#!/usr/bin/env bash
# scaffold-overviews.sh — Generate 00-overview.md files for sections that don't have them
# Usage: ./scaffold-overviews.sh /path/to/my-book [--force]
#
# By default, skips folders that already have 00-overview.md.
# Use --force to overwrite existing ones.

set -uo pipefail

BOOK_PATH="${1:?Usage: scaffold-overviews.sh /path/to/my-book [--force]}"
BOOK_PATH="${BOOK_PATH%/}"
FORCE="${2:-}"

CREATED=0
SKIPPED=0

echo "═══════════════════════════════════════════"
echo "  Scaffold 00-overview.md files"
echo "  Book: $BOOK_PATH"
echo "═══════════════════════════════════════════"
echo ""

generate_overview() {
  local dir="$1"
  local section_name=$(basename "$dir")
  local overview_path="$dir/00-overview.md"

  # Parse section name: "03-high-risk-requirements" → "High Risk Requirements"
  local display_name=$(echo "$section_name" | sed 's/^[0-9]*-//' | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

  # Collect content pages (excluding 00-overview.md itself)
  local pages=()
  for page in "$dir"/[0-9][0-9]-*.md; do
    [[ -f "$page" ]] || continue
    local pname=$(basename "$page")
    [[ "$pname" == "00-overview.md" ]] && continue
    pages+=("$pname")
  done

  # Generate the overview
  {
    echo "# $display_name"
    echo ""
    echo "<!-- TODO: Write 1-2 sentences describing what this section covers -->"
    echo ""
    echo "## When to Read This Section"
    echo ""
    echo "<!-- TODO: List the questions or tasks that bring a reader here -->"
    echo ""
    echo "- ..."
    echo ""
    echo "## Pages in This Section"
    echo ""

    for pname in "${pages[@]}"; do
      # Parse page name: "01-risk-management.md" → "Risk Management"
      local pdisplay=$(echo "$pname" | sed 's/^[0-9]*-//' | sed 's/\.md$//' | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')
      echo "- \`$pname\` — $pdisplay <!-- TODO: add description -->"
    done

    if (( ${#pages[@]} > 1 )); then
      echo ""
      echo "<!-- TODO: Add reading order guidance -->"
    fi
  } > "$overview_path"

  echo "  ✅ Created $section_name/00-overview.md (${#pages[@]} pages indexed)"
  ((CREATED++))
}

# Process section directories
for section_dir in "$BOOK_PATH"/[0-9][0-9]-*/; do
  [[ -d "$section_dir" ]] || continue
  section_name=$(basename "$section_dir")

  if [[ -f "$section_dir/00-overview.md" && "$FORCE" != "--force" ]]; then
    echo "  ⏭️  $section_name/00-overview.md already exists (use --force to overwrite)"
    ((SKIPPED++))
    continue
  fi

  generate_overview "$section_dir"

  # Recurse into sub-section folders
  for sub_dir in "$section_dir"/[0-9][0-9]-*/; do
    [[ -d "$sub_dir" ]] || continue
    sub_name=$(basename "$sub_dir")

    if [[ -f "$sub_dir/00-overview.md" && "$FORCE" != "--force" ]]; then
      echo "  ⏭️  $section_name/$sub_name/00-overview.md already exists"
      ((SKIPPED++))
      continue
    fi

    generate_overview "$sub_dir"
  done
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Created: $CREATED | Skipped: $SKIPPED"
echo ""
echo "  Next steps:"
echo "  1. Fill in the TODO comments in each 00-overview.md"
echo "  2. Run validate.sh to check consistency"
echo "═══════════════════════════════════════════"
