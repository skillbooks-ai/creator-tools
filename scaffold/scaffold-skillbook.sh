#!/usr/bin/env bash
# scaffold-skillbook.sh — Generate a new skillbook directory with Agent Skills-compatible files
# Usage: ./scaffold-skillbook.sh <book-slug> [--dir /path/to/parent]
#
# Creates:
#   <book-slug>/
#     SKILL.md      — Agent Skills-compatible frontmatter + TOC skeleton
#     README.md     — Human-facing catalog page
#     book.json     — Machine-readable metadata
#     source/       — Place raw source material here
#     _build/       — Working files (analysis, outline)

set -euo pipefail

SLUG="${1:?Usage: scaffold-skillbook.sh <book-slug> [--dir /path/to/parent]}"
PARENT_DIR="."

# Parse optional --dir flag
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) PARENT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate slug: lowercase, hyphens, 1-64 chars
if ! echo "$SLUG" | grep -qE '^[a-z][a-z0-9-]{0,63}$'; then
  echo "Error: book slug must be lowercase, start with a letter, use only [a-z0-9-], max 64 chars"
  exit 1
fi

BOOK_DIR="$PARENT_DIR/$SLUG"

if [[ -d "$BOOK_DIR" ]]; then
  echo "Error: directory already exists: $BOOK_DIR"
  exit 1
fi

# Convert slug to display title: "my-cool-book" → "My Cool Book"
DISPLAY_TITLE=$(echo "$SLUG" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

echo "═══════════════════════════════════════════"
echo "  Scaffold new skillbook: $SLUG"
echo "  Directory: $BOOK_DIR"
echo "═══════════════════════════════════════════"
echo ""

mkdir -p "$BOOK_DIR/source" "$BOOK_DIR/_build"

# ─── SKILL.md ───
cat > "$BOOK_DIR/SKILL.md" << SKILLEOF
---
# Agent Skills (base spec)
name: $SLUG
description: What this book covers and when to use it.

# Skillbook Extensions
title: "$DISPLAY_TITLE"
server: https://skillbooks.ai
version: 1.0.0
pages: 0
price: "\$0.00"
license: "all-rights-reserved"
tags: false

# Agent Skills Optional
compatibility: ""
metadata:
  author: ""
---

# $DISPLAY_TITLE

<!-- TODO: One-paragraph description of what this skillbook covers -->

## How to Use This Skillbook

1. Browse the Table of Contents below to find relevant sections
2. Fetch pages by constructing URLs: \`{server}/{name}/{path}\`
3. Include your API key in the \`X-Skillbook-Key\` header
4. Without a key, you'll receive a 402 response with signup info

SKILL.md and TAG-INDEX.json are always free. Content pages cost credits.

## Quick Start

<!-- TODO: Add 2-3 common entry points -->
**"What is this about?"** → \`01-intro/00-overview.md\`

## Table of Contents

<!-- TODO: Add sections and pages as you build them -->
### 01 — Introduction
*Overview of the book's scope and audience.*

- \`01-intro/00-overview.md\` — Section overview and reading guide

## License

<!-- TODO: Specify the license for this content -->
All rights reserved.
SKILLEOF

# ─── README.md ───
cat > "$BOOK_DIR/README.md" << READMEEOF
# $DISPLAY_TITLE

<!-- TODO: 2-3 sentences: what this is, who it's for, why it exists -->

## What's Inside

<!-- TODO: Bullet list of key topics/sections -->
- ...

## Why This Skillbook?

<!-- TODO: What makes it authoritative, what problem it solves -->

## At a Glance

- **Pages:** 0
- **Sections:** 0
- **License:** All rights reserved
- **Sources:** <!-- TODO -->
- **Last Updated:** $(date +%Y-%m-%d)
READMEEOF

# ─── book.json ───
cat > "$BOOK_DIR/book.json" << JSONEOF
{
  "id": "$SLUG",
  "title": "$DISPLAY_TITLE",
  "description": "",
  "version": "1.0.0",
  "author": "",
  "language": "en",
  "verified": false,
  "structure": {
    "readme": "README.md"
  }
}
JSONEOF

# ─── _build stubs ───
cat > "$BOOK_DIR/_build/analysis.md" << ANALYSISEOF
# Source Analysis

## Material
<!-- List each source file, what it contains, approximate size -->

## Scope
<!-- What the book will cover -->

## Natural Structure
<!-- How the source material is already organized -->

## Proposed Book Size
- Estimated sections:
- Estimated pages:
- Target audience:

## Authority
<!-- Why this source is trustworthy -->

## Notes
<!-- Anything unusual — gaps, multiple editions, mixed quality -->
ANALYSISEOF

cat > "$BOOK_DIR/_build/outline.md" << OUTLINEEOF
# Book Outline

<!-- Design your section/page structure here before decomposing content -->

## 01-intro
Introduction and context.
- 00-overview.md — Section overview
- 01-what-is-this.md — Overview of the subject

<!-- Add more sections as needed -->
OUTLINEEOF

echo "  ✅ Created SKILL.md (Agent Skills-compatible frontmatter)"
echo "  ✅ Created README.md"
echo "  ✅ Created book.json"
echo "  ✅ Created source/ directory"
echo "  ✅ Created _build/ with analysis.md and outline.md stubs"
echo ""
echo "═══════════════════════════════════════════"
echo "  Next steps:"
echo "  1. Place source material in $BOOK_DIR/source/"
echo "  2. Fill in _build/analysis.md"
echo "  3. Design your outline in _build/outline.md"
echo "  4. Follow the skillbook-creator SKILL.md protocol"
echo "═══════════════════════════════════════════"
