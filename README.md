# @skillbooks/cli

The official CLI for [Skillbooks](https://skillbooks.ai) — create, validate, and publish AI-native skillbooks.

## Install

```bash
npm install -g @skillbooks/cli
```

## Commands

### `skillbooks init [path]`

Interactively scaffold a new skillbook project.

```bash
skillbooks init                  # scaffold in current directory
skillbooks init ./my-skillbook   # scaffold in a new directory
```

Generates `SKILL.md`, `README.md`, `package.json`, and section directories with `00-overview.md` files. You'll be prompted for name, title, description, author, license, and initial sections.

### `skillbooks validate [path]`

Validate a skillbook directory against the [Skillbook Format Spec](https://github.com/skillbooks-ai/skillbook).

```bash
skillbooks validate              # validate current directory
skillbooks validate ./my-skillbook
```

Checks:
- Required root files (`SKILL.md`, `README.md`, `package.json`)
- SKILL.md frontmatter (name, description, license, metadata block)
- `package.json` required fields and `skillbook` config block
- Sync between `package.json` and `SKILL.md` (name, version, license, etc.)
- Section structure (`00-overview.md` in every section)
- Page naming (`NN-name.md` pattern) and length guidelines (40–100 lines)
- TOC link resolution (all paths exist, orphan page detection)
- Tag consistency (TAG-INDEX.json matches page frontmatter)
- Legacy `book.json` detection

Exit codes: `0` = pass, `1` = errors, `2` = warnings only.

### `skillbooks index [path]`

Build `TAG-INDEX.json` and regenerate the SKILL.md table of contents.

```bash
skillbooks index                 # rebuild both in current directory
skillbooks index --tags-only     # only TAG-INDEX.json
skillbooks index --toc-only      # only SKILL.md TOC
skillbooks index --dry-run       # preview without writing
```

Scans all content pages for `tags:` frontmatter and builds the tag→pages map. Reads the directory structure, extracts page titles, and regenerates the `## Table of Contents` section in SKILL.md.

### `skillbooks publish [path]`

Validate and publish a skillbook to the Skillbooks platform.

```bash
skillbooks publish               # publish current directory
skillbooks publish ./my-skillbook
```

Runs full validation first — if errors are found, publishing is aborted. Requires an API key (see Authentication below).

### `skillbooks search <query>`

Search the Skillbooks catalog.

```bash
skillbooks search "machine learning"
skillbooks search "exam prep" --format json
```

### `skillbooks signup`

Create a Skillbooks account and receive an API key.

```bash
skillbooks signup
skillbooks signup --format json
```

### `skillbooks account`

Show your account balance, usage totals, publisher status, and published books.

```bash
skillbooks account
skillbooks account --format json
```

## Authentication

Commands that talk to the platform API (`publish`, `search`, `account`) need an API key.

The fastest way to get started:

```bash
skillbooks signup
```

This creates your account and saves the API key to `.env` in the current directory. All commands automatically load `.env`, so you're ready to go.

You can also set the key manually:

```bash
# .env file (recommended)
SKILLBOOKS_API_KEY=sk_your_key_here

# Environment variable
export SKILLBOOKS_API_KEY=sk_your_key_here

# Or pass it directly
skillbooks account --key sk_your_key_here
```

## Custom API URL

For self-hosted instances or development:

```bash
export SKILLBOOKS_API=https://your-instance.example.com
# or
skillbooks account --api-url https://your-instance.example.com
```

## Related

- **[Skillbook Format Spec](https://github.com/skillbooks-ai/skillbook)** — the standard that defines the skillbook format
- **[Skillbook Authoring Guide](https://github.com/skillbooks-ai/skillbook-authoring)** — a comprehensive guide for creating high-quality skillbooks

## License

MIT
