# Creator Tools

Tools for Skillbook authors — build, validate, index, and publish books on the Skillbooks platform.

## Quick Start

```bash
# Make the CLI available
export PATH="/path/to/creator-tools:$PATH"

# Start a new skillbook
skillbook init ./books

# Validate your book
skillbook validate ./my-book

# Build tag index + TOC
skillbook index ./my-book

# Check your account
skillbook account

# Sign up
skillbook signup
```

## Commands

| Command | What it does |
|---------|-------------|
| `skillbook validate <path>` | Check structure against FORMAT v1.0 |
| `skillbook init [path]` | Initialize a new skillbook project (interactive) |
| `skillbook index <path>` | Build TAG-INDEX.json + regenerate SKILL.md TOC |
| `skillbook account` | Show credit balance, account type, publisher status |
| `skillbook signup` | Open the get-started page |
| `skillbook publish <path>` | Push to the platform *(coming soon)* |

## Validation

The validator checks:
- Required root files (SKILL.md, README.md, book.json)
- SKILL.md frontmatter fields
- book.json required fields
- Section structure (every section has `00-overview.md`)
- TOC link integrity (all paths resolve, no orphan pages)
- Tag consistency (TAG-INDEX.json matches frontmatter)
- Page length guidelines (40-100 lines target)

Note: the validator correctly skips links inside fenced code blocks and inline backticks.

## Indexing

`skillbook index` does two things in one pass:

1. **TAG-INDEX.json** — scans all content page frontmatter for `tags:` fields and builds the tag→pages map
2. **SKILL.md TOC** — scans the directory structure, reads page titles, and regenerates the `## Table of Contents` section

Options:
- `--tags-only` — only rebuild TAG-INDEX.json
- `--toc-only` — only rebuild the TOC
- `--dry-run` — show what would change without writing

## Verification Pipeline

The `verify/` directory contains a multi-pass pipeline for checking factual claims against source documents. See [verify/README.md](verify/README.md).

## Authoring Skill

The `skills/skillbook-creator/SKILL.md` is an agent skill that walks through the full authoring process — from source analysis to published book.

## Platform Docs

- [FORMAT.md](../FORMAT.md) — canonical directory layout and book.json schema
- [Skillbooks README](../README.md) — platform overview
