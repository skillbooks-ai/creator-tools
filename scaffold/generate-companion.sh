#!/usr/bin/env bash
# generate-companion.sh — Generate a single-file companion SKILL.md from a full skillbook
# Usage: ./generate-companion.sh /path/to/book [output-dir]
#
# The companion is a free, standalone Agent Skills file that:
#   - Describes what the full skillbook covers
#   - Tells agents how to access the full content via the Skillbooks API
#   - Works in any Agent Skills-compatible tool (Claude Code, Gemini CLI, etc.)
#
# If output-dir is omitted, writes to <book>/companion/SKILL.md

set -euo pipefail

BOOK_PATH="${1:?Usage: generate-companion.sh /path/to/book [output-dir]}"
BOOK_PATH="${BOOK_PATH%/}"
OUTPUT_DIR="${2:-$BOOK_PATH/companion}"

if [[ ! -f "$BOOK_PATH/SKILL.md" ]]; then
  echo "❌ No SKILL.md found at $BOOK_PATH" >&2
  exit 1
fi

# ─── Extract metadata from SKILL.md frontmatter ───────────────────
FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md")

get_field() {
  local field="$1"
  local val
  # Try top-level field first
  val=$(echo "$FRONTMATTER" | grep "^${field}:" | head -1 | sed "s/^${field}:[[:space:]]*//" | sed 's/^["\x27]//' | sed 's/["\x27]$//')
  if [[ -z "$val" ]]; then
    # Try metadata sub-field (skillbooks-* format)
    val=$(echo "$FRONTMATTER" | grep "skillbooks-${field}:" | head -1 | sed "s/.*skillbooks-${field}:[[:space:]]*//" | sed 's/^["\x27]//' | sed 's/["\x27]$//')
  fi
  echo "$val"
}

# Extract description (handles multi-line YAML descriptions with >)
extract_description() {
  local in_desc=0
  local desc=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^description: ]]; then
      in_desc=1
      local rest="${line#description:}"
      rest="${rest#"${rest%%[![:space:]]*}"}"  # trim leading whitespace
      rest="${rest#>}"  # remove > for folded scalar
      rest="${rest#"${rest%%[![:space:]]*}"}"
      [[ -n "$rest" ]] && desc="$rest"
      continue
    fi
    if (( in_desc )); then
      # Stop at next top-level key
      if [[ "$line" =~ ^[a-zA-Z] ]]; then
        break
      fi
      local trimmed="${line#"${line%%[![:space:]]*}"}"
      desc="$desc $trimmed"
    fi
  done <<< "$FRONTMATTER"
  echo "$desc" | sed 's/^ //' | sed 's/  */ /g'
}

NAME=$(get_field "name")
DESCRIPTION=$(extract_description)
[[ -z "$DESCRIPTION" ]] && DESCRIPTION=$(get_field "description")

TITLE=$(get_field "title")
[[ -z "$TITLE" ]] && TITLE=$(get_field "skillbooks-title")

SERVER=$(get_field "server")
[[ -z "$SERVER" ]] && SERVER=$(get_field "skillbooks-server")
[[ -z "$SERVER" ]] && SERVER="https://api.skillbooks.ai"

VERSION=$(get_field "version")
[[ -z "$VERSION" ]] && VERSION=$(get_field "skillbooks-version")

PAGES=$(get_field "pages")
[[ -z "$PAGES" ]] && PAGES=$(get_field "skillbooks-pages")

PRICE=$(get_field "price")
[[ -z "$PRICE" ]] && PRICE=$(get_field "skillbooks-price")

SLUG="$NAME"

# ─── Extract section names from TOC ──────────────────────
SECTIONS=""
while IFS= read -r line; do
  # Match markdown headings like ### 1. Overview or ### Tragedies
  if [[ "$line" =~ ^###[[:space:]]+(.*) ]]; then
    section="${BASH_REMATCH[1]}"
    # Skip sub-headings (####)
    [[ "$line" =~ ^####  ]] && continue
    SECTIONS="${SECTIONS}\n- ${section}"
  fi
done < "$BOOK_PATH/SKILL.md"

# Fallback: scan directories
if [[ -z "$SECTIONS" ]]; then
  for d in "$BOOK_PATH"/[0-9][0-9]-*/; do
    [[ -d "$d" ]] || continue
    dir_name=$(basename "$d" | sed 's/^[0-9]*-//' | tr '-' ' ')
    # Capitalize first letter of each word
    dir_name=$(echo "$dir_name" | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
    SECTIONS="${SECTIONS}\n- ${dir_name}"
  done
fi

# ─── Generate companion ──────────────────────
mkdir -p "$OUTPUT_DIR"
COMPANION="$OUTPUT_DIR/SKILL.md"

cat > "$COMPANION" << SKILLEOF
---
name: ${NAME}-companion
description: "Free companion for the ${TITLE:-$NAME} skillbook. Describes what the full book covers and how to access it via the Skillbooks API."
version: ${VERSION:-1.0.0}
author: Skillbooks AI
license: MIT
tags: [skillbook, companion, ${NAME}]
---

# ${TITLE:-$NAME} — Companion Skill

> This is a **free companion** for the *${TITLE:-$NAME}* skillbook.
> It tells you what the full book covers and how to access it.

## About the Full Skillbook

**${TITLE:-$NAME}** is a ${PAGES:-multi}-page AI-navigable knowledge base.

${DESCRIPTION}

### What's Inside
$(echo -e "$SECTIONS")

## How to Access the Full Content

The full skillbook is served via the **Skillbooks API**.

| Field | Value |
|-------|-------|
| **Base URL** | \`${SERVER}\` |
| **Book slug** | \`${SLUG}\` |
| **Auth header** | \`X-Skillbook-Key\` |
| **Price** | ${PRICE:-See skillbooks.ai} |

### Quick Start

1. **Get an API key** at [skillbooks.ai](https://skillbooks.ai)
2. **Fetch the Table of Contents:**
   \`\`\`
   GET ${SERVER}/${SLUG}/SUMMARY.md
   Headers: X-Skillbook-Key: <your-key>
   \`\`\`
3. **Fetch any page:**
   \`\`\`
   GET ${SERVER}/${SLUG}/{section}/{page}.md
   Headers: X-Skillbook-Key: <your-key>
   \`\`\`
4. **Search across the book:**
   \`\`\`
   GET ${SERVER}/${SLUG}/search?q={query}
   Headers: X-Skillbook-Key: <your-key>
   \`\`\`

### Navigation Tips

- Start with the Table of Contents to orient yourself
- Fetch section overviews (\`00-overview.md\`) before diving into specific pages
- Each page is self-contained (40–100 lines) with cross-references
- Most questions need 3–6 pages, not the full book — fetch what you need

## What This Companion Does NOT Include

This companion does **not** contain the actual book content. It's a guide that helps you (the agent) understand what's available and how to retrieve it.

To get the full content, you need an API key from [skillbooks.ai](https://skillbooks.ai).

---

*Generated by [Skillbooks Creator Tools](https://github.com/skillbooks-ai/creator-tools)*
SKILLEOF

echo "✅ Companion generated: $COMPANION"
echo "   Name: ${NAME}-companion"
echo "   Source book: ${TITLE:-$NAME} (${PAGES:-?} pages, ${PRICE:-?})"
