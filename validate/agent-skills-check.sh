#!/usr/bin/env bash
# agent-skills-check.sh — Validate a skillbook's SKILL.md against the Agent Skills spec
# https://agentskills.io/specification.md
#
# Usage: ./validate/agent-skills-check.sh /path/to/my-book
#
# Exit codes:
#   0 = all checks pass
#   1 = errors found
#   2 = warnings only

set -uo pipefail

BOOK_PATH="${1:?Usage: agent-skills-check.sh /path/to/my-book}"
BOOK_PATH="${BOOK_PATH%/}"  # strip trailing slash

ERRORS=0
WARNINGS=0

error() { echo "  ❌ ERROR: $1"; ((ERRORS++)); }
warn()  { echo "  ⚠️  WARN:  $1"; ((WARNINGS++)); }
ok()    { echo "  ✅ $1"; }
info()  { echo "  ℹ️  $1"; }

SKILL_MD="$BOOK_PATH/SKILL.md"
DIR_NAME=$(basename "$BOOK_PATH")

echo ""
echo "═══════════════════════════════════════════"
echo "  Agent Skills Spec Check"
echo "  Book: $BOOK_PATH"
echo "═══════════════════════════════════════════"
echo ""

# ─── SKILL.md Exists ──────────────────────────
echo "📄 SKILL.md"

if [[ ! -f "$SKILL_MD" ]]; then
  error "SKILL.md not found — required by Agent Skills spec"
  # Can't continue without SKILL.md
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ❌ $ERRORS error(s) — cannot continue without SKILL.md"
  echo "═══════════════════════════════════════════"
  exit 1
fi

ok "SKILL.md exists"
echo ""

# ─── Extract Frontmatter ─────────────────────
# Frontmatter is between the first two --- lines
FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_MD")

if [[ -z "$FRONTMATTER" ]]; then
  error "No YAML frontmatter found (expected --- delimited block)"
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ❌ $ERRORS error(s) — cannot continue without frontmatter"
  echo "═══════════════════════════════════════════"
  exit 1
fi

# ─── Required: name ──────────────────────────
echo "📋 Required frontmatter"

NAME=$(echo "$FRONTMATTER" | grep -E "^name:" | head -1 | sed 's/^name:[[:space:]]*//' | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')

if [[ -z "$NAME" ]]; then
  error "frontmatter missing required field: name"
else
  ok "name: $NAME"

  # Length check: 1-64 chars
  NAME_LEN=${#NAME}
  if (( NAME_LEN < 1 || NAME_LEN > 64 )); then
    error "name length is $NAME_LEN — must be 1-64 characters"
  else
    ok "name length ($NAME_LEN) within 1-64"
  fi

  # Character check: lowercase alphanumeric + hyphens only
  if [[ ! "$NAME" =~ ^[a-z0-9-]+$ ]]; then
    error "name contains invalid characters — must be lowercase alphanumeric + hyphens only"
  else
    ok "name characters valid (lowercase alphanumeric + hyphens)"
  fi

  # No leading hyphen
  if [[ "$NAME" == -* ]]; then
    error "name must not start with a hyphen"
  fi

  # No trailing hyphen
  if [[ "$NAME" == *- ]]; then
    error "name must not end with a hyphen"
  fi

  # No consecutive hyphens
  if [[ "$NAME" == *--* ]]; then
    error "name must not contain consecutive hyphens"
  fi

  # Must match parent directory name
  if [[ "$NAME" != "$DIR_NAME" ]]; then
    warn "name '$NAME' does not match parent directory '$DIR_NAME' — spec requires match"
  else
    ok "name matches parent directory"
  fi
fi

# ─── Required: description ───────────────────
DESCRIPTION=$(echo "$FRONTMATTER" | grep -E "^description:" | head -1 | sed 's/^description:[[:space:]]*//' | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')

if [[ -z "$DESCRIPTION" ]]; then
  error "frontmatter missing required field: description"
else
  ok "description present"

  DESC_LEN=${#DESCRIPTION}
  if (( DESC_LEN < 1 )); then
    error "description must be non-empty"
  elif (( DESC_LEN > 1024 )); then
    error "description length is $DESC_LEN — max 1024 characters"
  else
    ok "description length ($DESC_LEN) within 1-1024"
  fi
fi

echo ""

# ─── Optional Fields ─────────────────────────
echo "📋 Optional frontmatter"

# compatibility
COMPAT=$(echo "$FRONTMATTER" | grep -E "^compatibility:" | head -1 | sed 's/^compatibility:[[:space:]]*//' | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')
if [[ -n "$COMPAT" ]]; then
  COMPAT_LEN=${#COMPAT}
  if (( COMPAT_LEN > 500 )); then
    error "compatibility length is $COMPAT_LEN — max 500 characters"
  else
    ok "compatibility ($COMPAT_LEN chars) within limit"
  fi
else
  info "compatibility: not set (optional)"
fi

# license
LICENSE=$(echo "$FRONTMATTER" | grep -E "^license:" | head -1 | sed 's/^license:[[:space:]]*//')
if [[ -n "$LICENSE" ]]; then
  ok "license: $LICENSE"
else
  info "license: not set (optional)"
fi

# metadata — basic check that lines following metadata: are key: value pairs
META_START=$(echo "$FRONTMATTER" | grep -n "^metadata:" | head -1 | cut -d: -f1)
if [[ -n "$META_START" ]]; then
  # Extract indented lines after metadata:
  META_LINES=$(echo "$FRONTMATTER" | awk -v start="$META_START" 'NR>start && /^[[:space:]]+[^[:space:]]/ {print} NR>start && /^[^[:space:]]/ {exit}')
  if [[ -n "$META_LINES" ]]; then
    META_VALID=true
    while IFS= read -r line; do
      # Each line should be like "  key: value"
      if [[ ! "$line" =~ ^[[:space:]]+[a-zA-Z0-9_-]+:[[:space:]]*.+$ ]]; then
        error "metadata entry invalid: '$line' — expected 'key: value' format"
        META_VALID=false
      fi
    done <<< "$META_LINES"
    if $META_VALID; then
      META_COUNT=$(echo "$META_LINES" | wc -l | tr -d ' ')
      ok "metadata: $META_COUNT key-value pair(s)"
    fi
  else
    # metadata: might be on same line or empty
    META_VALUE=$(echo "$FRONTMATTER" | grep -E "^metadata:" | head -1 | sed 's/^metadata:[[:space:]]*//')
    if [[ -n "$META_VALUE" && "$META_VALUE" != "{}" ]]; then
      info "metadata present (inline format)"
    else
      info "metadata: empty"
    fi
  fi
else
  info "metadata: not set (optional)"
fi

# allowed-tools
TOOLS=$(echo "$FRONTMATTER" | grep -E "^allowed-tools:" | head -1 | sed 's/^allowed-tools:[[:space:]]*//')
if [[ -n "$TOOLS" ]]; then
  ok "allowed-tools: $TOOLS (experimental)"
else
  info "allowed-tools: not set (optional/experimental)"
fi

echo ""

# ─── Body Length ─────────────────────────────
echo "📏 Content checks"

# Count body lines (everything after the second ---)
BODY_LINES=$(awk '/^---$/{n++; next} n>=2{print}' "$SKILL_MD" | wc -l | tr -d ' ')

if (( BODY_LINES > 500 )); then
  warn "SKILL.md body is $BODY_LINES lines — spec recommends under 500"
else
  ok "SKILL.md body ($BODY_LINES lines) under 500-line recommendation"
fi

# ─── Directory Structure ─────────────────────
echo ""
echo "📂 Directory structure"

# Check for recognized optional directories
for dir_name in scripts references assets; do
  if [[ -d "$BOOK_PATH/$dir_name" ]]; then
    ok "$dir_name/ directory present"
  fi
done

# Warn about unusual top-level files (not SKILL.md, README.md, etc.)
UNUSUAL_FILES=0
for f in "$BOOK_PATH"/*; do
  [[ -e "$f" ]] || continue
  fname=$(basename "$f")
  case "$fname" in
    SKILL.md|README.md|LICENSE*|book.json|TAG-INDEX.json|.git|.gitignore|scripts|references|assets|sources|.verify)
      ;;  # Known files/dirs
    [0-9][0-9]-*)
      ;;  # Section directories (skillbook format)
    *)
      if [[ -f "$f" ]]; then
        ((UNUSUAL_FILES++))
      fi
      ;;
  esac
done

if (( UNUSUAL_FILES > 0 )); then
  info "$UNUSUAL_FILES top-level file(s) outside standard Agent Skills directories"
fi

echo ""

# ─── Optional: skills-ref CLI ────────────────
if command -v skills-ref &>/dev/null; then
  echo "🔧 skills-ref CLI (second opinion)"
  echo ""
  skills-ref validate "$BOOK_PATH" 2>&1 | sed 's/^/  /'
  echo ""
else
  info "skills-ref CLI not installed — skipping external validation"
  info "Install from: https://github.com/agentskills/agentskills/tree/main/skills-ref"
fi

echo ""

# ─── Summary ─────────────────────────────────
echo "═══════════════════════════════════════════"
if (( ERRORS > 0 )); then
  echo "  ❌ Agent Skills Check: $ERRORS error(s), $WARNINGS warning(s)"
  echo "═══════════════════════════════════════════"
  exit 1
elif (( WARNINGS > 0 )); then
  echo "  ⚠️  Agent Skills Check: $WARNINGS warning(s), 0 errors"
  echo "═══════════════════════════════════════════"
  exit 2
else
  echo "  ✅ Agent Skills Check: All checks passed!"
  echo "═══════════════════════════════════════════"
  exit 0
fi
