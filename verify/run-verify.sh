#!/usr/bin/env bash
# run-verify.sh — Spellbook Verification Pipeline Setup Script
#
# This script validates that your book is ready for the verification pipeline,
# prints a summary of what it found, and gives you the exact instructions for
# spawning each verification pass as an agent.
#
# Usage:
#   export BOOK_PATH=/path/to/your/book
#   bash creator-tools/verify/run-verify.sh
#
# Or inline:
#   BOOK_PATH=/path/to/your/book bash creator-tools/verify/run-verify.sh

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

print_header() { echo -e "\n${BOLD}${BLUE}$1${RESET}"; }
print_ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
print_warn()   { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
print_err()    { echo -e "  ${RED}✗${RESET} $1"; }

# ── Check BOOK_PATH ──────────────────────────────────────────────────────────
if [ -z "${BOOK_PATH:-}" ]; then
  print_err "BOOK_PATH is not set."
  echo ""
  echo "Set it before running:"
  echo "  export BOOK_PATH=/absolute/path/to/your/book"
  echo "  bash creator-tools/verify/run-verify.sh"
  exit 1
fi

if [ ! -d "$BOOK_PATH" ]; then
  print_err "BOOK_PATH does not exist: $BOOK_PATH"
  exit 1
fi

print_header "Spellbook Verification Pipeline"
echo "  Book path: $BOOK_PATH"

# ── Check sources/SOURCES.md ─────────────────────────────────────────────────
SOURCES_INDEX="$BOOK_PATH/sources/SOURCES.md"

if [ ! -f "$SOURCES_INDEX" ]; then
  print_err "sources/SOURCES.md not found at: $SOURCES_INDEX"
  echo ""
  echo "The verification pipeline requires a sources/ directory with a SOURCES.md index."
  echo ""
  echo "To set this up:"
  echo "  1. Create $BOOK_PATH/sources/"
  echo "  2. Add your source documents (regulations, papers, standards, etc.)"
  echo "  3. Create $BOOK_PATH/sources/SOURCES.md with a table of all source files"
  echo ""
  echo "See BOOK-STRUCTURE.md for the required format."
  exit 1
fi

print_ok "sources/SOURCES.md found"

# ── Create .verify/ if needed ────────────────────────────────────────────────
VERIFY_DIR="$BOOK_PATH/.verify"
if [ ! -d "$VERIFY_DIR" ]; then
  mkdir -p "$VERIFY_DIR"
  print_ok "Created .verify/ directory"
else
  print_ok ".verify/ directory exists"
fi

# ── Read book metadata ───────────────────────────────────────────────────────
BOOK_JSON="$BOOK_PATH/book.json"
BOOK_TITLE="(unknown)"

if [ -f "$BOOK_JSON" ]; then
  # Try to extract title (works if python3 is available, falls back to grep)
  if command -v python3 &>/dev/null; then
    BOOK_TITLE=$(python3 -c "import json,sys; d=json.load(open('$BOOK_JSON')); print(d.get('title','(no title)'))" 2>/dev/null || echo "(unknown)")
  else
    BOOK_TITLE=$(grep -o '"title": *"[^"]*"' "$BOOK_JSON" | head -1 | sed 's/"title": *"//;s/"$//' 2>/dev/null || echo "(unknown)")
  fi
fi

echo ""
echo -e "  ${BOLD}Book:${RESET} $BOOK_TITLE"

# ── Count source files ────────────────────────────────────────────────────────
SOURCE_COUNT=$(find "$BOOK_PATH/sources" -type f ! -name "SOURCES.md" | wc -l | tr -d ' ')
print_ok "Source files: $SOURCE_COUNT"

# ── Count content files ───────────────────────────────────────────────────────
CONTENT_COUNT=$(find "$BOOK_PATH" -name "*.md" \
  ! -path "*/sources/*" \
  ! -path "*/.verify/*" \
  ! -path "*/.git/*" \
  ! -name "SKILL.md" \
  ! -name "README.md" \
  ! -name "SUMMARY.md" \
  | wc -l | tr -d ' ')
print_ok "Content files to process: $CONTENT_COUNT"

# ── Check existing manifest ───────────────────────────────────────────────────
MANIFEST="$VERIFY_DIR/AUDIT-MANIFEST.md"

echo ""
if [ -f "$MANIFEST" ]; then
  print_header "Existing Manifest Found"
  echo "  Path: $MANIFEST"
  echo ""
  # Extract summary stats from the manifest header
  T1=$(grep -E "^- Total T1 entries:" "$MANIFEST" | grep -oE "\*\*[0-9]+\*\*" | tr -d '*' | head -1 || echo "?")
  T2=$(grep -E "^- Total T2 entries:" "$MANIFEST" | grep -oE "\*\*[0-9]+\*\*" | tr -d '*' | head -1 || echo "?")
  T3=$(grep -E "^- Total T3 entries:" "$MANIFEST" | grep -oE "\*\*[0-9]+\*\*" | tr -d '*' | head -1 || echo "?")
  T4=$(grep -E "^- Total T4 entries:" "$MANIFEST" | grep -oE "\*\*[0-9]+\*\*" | tr -d '*' | head -1 || echo "?")
  TOTAL=$(grep -E "^\*\*Grand total" "$MANIFEST" | grep -oE "\*\*[0-9]+" | tr -d '*' | head -1 || echo "?")
  UNCITED=$(grep -E "^- UNCITED flags" "$MANIFEST" | grep -oE "\*\*~?[0-9]+" | tr -d '*~' | head -1 || echo "?")

  echo "  Manifest stats:"
  echo "    T1 (verbatim quotes):     $T1"
  echo "    T2 (factual assertions):  $T2"
  echo "    T3 (pedagogical claims):  $T3"
  echo "    T4 (external knowledge):  $T4"
  echo "    Grand total:              $TOTAL"
  echo "    UNCITED flags:            $UNCITED"
  echo ""
  print_warn "Pass 1 already complete. If you re-run it, the existing manifest will be overwritten."
else
  print_warn "No manifest found. You need to run Pass 1 first."
fi

# ── Print instructions ────────────────────────────────────────────────────────
# Resolve the location of the SKILL files relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header "How to Run the Verification Pipeline"
echo ""
echo "The pipeline runs through the OpenClaw agent system."
echo "Spawn each pass as a sub-agent by copying the task from the corresponding SKILL file."
echo ""
echo -e "${BOLD}Pass 1 — Manifest Builder (run this first)${RESET}"
echo "  SKILL file: $SCRIPT_DIR/SKILL-manifest-builder.md"
echo "  Output:     $VERIFY_DIR/AUDIT-MANIFEST.md"
echo ""
echo "  To run Pass 1, copy the task from SKILL-manifest-builder.md and spawn it as a sub-agent"
echo "  with BOOK_PATH substituted:"
echo ""
echo "    BOOK_PATH = $BOOK_PATH"
echo ""
echo -e "${BOLD}Pass 2 — T1 Verification (verbatim quotes)${RESET}"
echo "  SKILL file: $SCRIPT_DIR/SKILL-verify-t1.md"
echo "  Requires:   Pass 1 complete"
echo ""
echo -e "${BOLD}Pass 3 — T2 Verification (factual assertions)${RESET}"
echo "  SKILL file: $SCRIPT_DIR/SKILL-verify-t2.md"
echo "  Requires:   Pass 1 complete"
echo ""
echo -e "${BOLD}Pass 4 — T3 Verification (pedagogical claims)${RESET}"
echo "  SKILL file: $SCRIPT_DIR/SKILL-verify-t3.md"
echo "  Requires:   Pass 1 complete (Pass 2 and 3 recommended first)"
echo ""
echo -e "${BOLD}Pass 5 — T4 Inventory (external knowledge)${RESET}"
echo "  SKILL file: $SCRIPT_DIR/SKILL-report-t4.md"
echo "  Requires:   Pass 1 complete"
echo ""
echo "Passes 2–5 can run in parallel after Pass 1 completes."
echo ""
echo "Verification report will be written to:"
echo "  $VERIFY_DIR/VERIFY-REPORT.md"
echo ""
echo -e "${BOLD}Tip:${RESET} After all passes complete, review the report and fix any MISMATCH or"
echo "INCORRECT entries. Then re-run the relevant passes to confirm fixes."
echo ""
