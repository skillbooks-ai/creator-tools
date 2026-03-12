#!/usr/bin/env bash
# test-companion.sh — Generate and validate a companion SKILL.md for a skillbook
# Usage: ./test-companion.sh /path/to/book
#        ./test-companion.sh --all /path/to/books-dir
#
# What it does:
#   1. Generates a companion SKILL.md using scaffold/generate-companion.sh
#   2. Validates it as a standalone Agent Skills file
#   3. Checks required fields for Agent Skills compatibility
#
# Exit codes:
#   0 = all checks pass
#   1 = errors found

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOLS_DIR="$(dirname "$SCRIPT_DIR")"
GENERATOR="$TOOLS_DIR/scaffold/generate-companion.sh"

ERRORS=0
WARNINGS=0
BOOKS_TESTED=0
BOOKS_PASSED=0

error() { echo "  ❌ ERROR: $1"; ((ERRORS++)); }
warn()  { echo "  ⚠️  WARN:  $1"; ((WARNINGS++)); }
ok()    { echo "  ✅ $1"; }
info()  { echo "  ℹ️  $1"; }

validate_companion() {
  local BOOK_PATH="$1"
  local BOOK_NAME
  BOOK_NAME=$(basename "$BOOK_PATH")
  local TMPDIR
  TMPDIR=$(mktemp -d)
  local COMPANION="$TMPDIR/SKILL.md"
  local BOOK_ERRORS=0

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Testing companion for: $BOOK_NAME"
  echo "  Source: $BOOK_PATH"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  ((BOOKS_TESTED++))

  # ─── Step 1: Generate companion ──────────────────────
  echo "📦 Generating companion..."
  if ! bash "$GENERATOR" "$BOOK_PATH" "$TMPDIR" 2>&1 | sed 's/^/   /'; then
    error "Generator failed for $BOOK_NAME"
    rm -rf "$TMPDIR"
    return 1
  fi
  echo ""

  if [[ ! -f "$COMPANION" ]]; then
    error "No SKILL.md generated"
    rm -rf "$TMPDIR"
    return 1
  fi

  # ─── Step 2: Check it's a valid file ──────────────────────
  echo "📋 Agent Skills validation"

  # Check frontmatter delimiters
  local FM_COUNT
  FM_COUNT=$(grep -c '^---$' "$COMPANION" || true)
  if (( FM_COUNT >= 2 )); then
    ok "Has YAML frontmatter delimiters"
  else
    error "Missing YAML frontmatter delimiters (---)"
    ((BOOK_ERRORS++))
  fi

  # Extract frontmatter
  local FRONTMATTER
  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$COMPANION")

  # Check required Agent Skills fields
  # name: required by Agent Skills spec
  if echo "$FRONTMATTER" | grep -q "^name:"; then
    local SKILL_NAME
    SKILL_NAME=$(echo "$FRONTMATTER" | grep "^name:" | head -1 | sed 's/^name:[[:space:]]*//')
    ok "name: $SKILL_NAME"
  else
    error "Missing required field: name"
    ((BOOK_ERRORS++))
  fi

  # description: required by Agent Skills spec
  if echo "$FRONTMATTER" | grep -q "^description:"; then
    ok "description: present"
  else
    error "Missing required field: description"
    ((BOOK_ERRORS++))
  fi

  echo ""

  # ─── Step 3: Companion-specific checks ──────────────────────
  echo "🔗 Companion content checks"

  # Must mention the API / how to access
  if grep -qi "api\|skillbooks.ai\|X-Skillbook-Key\|api\.skillbooks" "$COMPANION"; then
    ok "Contains API access instructions"
  else
    error "No API access instructions found"
    ((BOOK_ERRORS++))
  fi

  # Must mention the book slug
  local SLUG
  SLUG=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$BOOK_PATH/SKILL.md" | grep "^name:" | head -1 | sed 's/^name:[[:space:]]*//')
  if grep -q "$SLUG" "$COMPANION"; then
    ok "References book slug: $SLUG"
  else
    warn "Doesn't reference the book slug ($SLUG)"
  fi

  # Must have a heading (valid markdown)
  if grep -q '^# ' "$COMPANION"; then
    ok "Has markdown heading"
  else
    warn "No top-level heading found"
  fi

  # Should mention it's a companion / free
  if grep -qi "companion\|free\|preview\|sample" "$COMPANION"; then
    ok "Identifies itself as a companion/free skill"
  else
    warn "Doesn't clearly identify as a companion"
  fi

  # Should have navigation instructions (GET, fetch, etc.)
  if grep -qi "GET\|fetch\|endpoint\|request" "$COMPANION"; then
    ok "Has navigation/fetch instructions"
  else
    warn "Missing navigation instructions for the agent"
  fi

  # Check file size — should be reasonable for a single-file skill
  local SIZE
  SIZE=$(wc -c < "$COMPANION" | tr -d ' ')
  local LINES
  LINES=$(wc -l < "$COMPANION" | tr -d ' ')
  if (( SIZE > 20000 )); then
    warn "Companion is ${SIZE} bytes — may be too large for a lightweight companion"
  elif (( SIZE < 200 )); then
    error "Companion is only ${SIZE} bytes — too small to be useful"
    ((BOOK_ERRORS++))
  else
    ok "File size: ${SIZE} bytes, ${LINES} lines"
  fi

  echo ""

  # ─── Step 4: Standalone Agent Skills compatibility ──────────────────────
  echo "🤖 Agent Skills tool compatibility"

  # Claude Code: needs name + description in frontmatter, body with instructions
  local HAS_NAME HAS_DESC HAS_BODY
  HAS_NAME=$(echo "$FRONTMATTER" | grep -c "^name:" || true)
  HAS_DESC=$(echo "$FRONTMATTER" | grep -c "^description:" || true)
  HAS_BODY=$(awk '/^---$/{n++} n>=2{found=1; exit} END{print found+0}' "$COMPANION")

  if (( HAS_NAME > 0 && HAS_DESC > 0 && HAS_BODY > 0 )); then
    ok "Claude Code compatible (name + description + body)"
  else
    error "Not compatible with Claude Code — missing name, description, or body"
    ((BOOK_ERRORS++))
  fi

  # Gemini CLI: same Agent Skills spec — name + description + instructions
  if (( HAS_NAME > 0 && HAS_DESC > 0 && HAS_BODY > 0 )); then
    ok "Gemini CLI compatible (name + description + body)"
  else
    error "Not compatible with Gemini CLI"
    ((BOOK_ERRORS++))
  fi

  # OpenClaw: needs name + description in frontmatter
  if (( HAS_NAME > 0 && HAS_DESC > 0 )); then
    ok "OpenClaw compatible (name + description)"
  else
    error "Not compatible with OpenClaw"
    ((BOOK_ERRORS++))
  fi

  echo ""

  # ─── Summary for this book ──────────────────────
  if (( BOOK_ERRORS == 0 )); then
    echo "  ✅ $BOOK_NAME companion: ALL CHECKS PASSED"
    ((BOOKS_PASSED++))
  else
    echo "  ❌ $BOOK_NAME companion: $BOOK_ERRORS error(s)"
  fi

  # Show the generated companion for reference
  echo ""
  echo "  📄 Generated companion preview (first 10 lines):"
  head -10 "$COMPANION" | sed 's/^/     /'

  rm -rf "$TMPDIR"
}

# ─── Main ──────────────────────
echo "═══════════════════════════════════════════"
echo "  Companion Skill Tester v1.0"
echo "═══════════════════════════════════════════"

if [[ "${1:-}" == "--all" ]]; then
  BOOKS_DIR="${2:?Usage: test-companion.sh --all /path/to/books-dir}"
  for book in "$BOOKS_DIR"/*/; do
    [[ -f "$book/SKILL.md" ]] || continue
    validate_companion "${book%/}"
  done
else
  BOOK_PATH="${1:?Usage: test-companion.sh /path/to/book}"
  validate_companion "${BOOK_PATH%/}"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $BOOKS_PASSED/$BOOKS_TESTED books passed"
echo "  Total: $ERRORS error(s), $WARNINGS warning(s)"
echo "═══════════════════════════════════════════"

if (( ERRORS > 0 )); then
  exit 1
else
  exit 0
fi
