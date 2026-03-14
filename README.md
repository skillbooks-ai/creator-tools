# Skillbook Creator Tools

CLI tools for creating, validating, and publishing skillbooks on the [Skillbooks](https://skillbooks.ai) platform.

## Related

- **[Skillbook Format Spec](https://github.com/skillbooks-ai/skillbook)** — the standard that defines the skillbook format
- **[Skillbook Authoring Guide](https://github.com/skillbooks-ai/skillbook-authoring)** — a complete guide for AI agents helping humans create skillbooks (itself a skillbook)

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

# Open activation flow
skillbook signup
```

## Commands

| Command | What it does |
|---------|-------------|
| `skillbook validate <path>` | Check structure against the skillbook format spec |
| `skillbook init [path]` | Initialize a new skillbook project (interactive) |
| `skillbook index <path>` | Build TAG-INDEX.json + regenerate SKILL.md TOC |
| `skillbook account` | Show credit balance, account type, publisher status |
| `skillbook signup` | Open the `/start` page |
| `skillbook publish <path>` | Push to the platform *(coming soon)* |

## Validation

The validator checks:
- Required root files (SKILL.md, README.md, package.json)
- SKILL.md frontmatter fields (name, description per AgentSkills spec)
- SKILL.md metadata block (skillbook-title, skillbook-server, etc.)
- package.json required fields and `skillbook` config block
- Sync between SKILL.md and package.json (name, version, description, license)
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

## Authoring Guide

For a comprehensive guide on creating high-quality skillbooks, see the **[Skillbook Authoring Guide](https://github.com/skillbooks-ai/skillbook-authoring)** — it walks through source analysis, content strategy, page writing, validation, and publishing.

## License

MIT
