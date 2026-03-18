# @skillbooks/cli

The official CLI for [Skillbooks](https://skillbooks.ai) — create, validate, and publish AI-native skillbooks.

## Install

```bash
npm install -g @skillbooks/cli
```

## Commands

### `skillbook init [path]`

Interactively scaffold a new skillbook project.

```bash
skillbook init                  # scaffold in current directory
skillbook init ./my-skillbook   # scaffold in a new directory
```

Generates `SKILL.md`, `README.md`, `package.json`, and section directories with `00-overview.md` files. You'll be prompted for name, title, description, author, license, and initial sections.

### `skillbook validate [path]`

Validate a skillbook directory against the [Skillbook Format Spec](https://github.com/skillbooks-ai/skillbook).

```bash
skillbook validate              # validate current directory
skillbook validate ./my-skillbook
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

### `skillbook index [path]`

Build `TAG-INDEX.json` and regenerate the SKILL.md table of contents.

```bash
skillbook index                 # rebuild both in current directory
skillbook index --tags-only     # only TAG-INDEX.json
skillbook index --toc-only      # only SKILL.md TOC
skillbook index --dry-run       # preview without writing
```

Scans all content pages for `tags:` frontmatter and builds the tag→pages map. Reads the directory structure, extracts page titles, and regenerates the `## Table of Contents` section in SKILL.md.

### `skillbook publish [path]`

Validate and publish a skillbook to the Skillbooks platform.

```bash
skillbook publish               # publish current directory
skillbook publish ./my-skillbook
```

Runs full validation first — if errors are found, publishing is aborted. Requires an API key (see Authentication below).

### `skillbook search <query>`

Search the Skillbooks catalog.

```bash
skillbook search "machine learning"
skillbook search "exam prep" --format json
```

### `skillbook login`

Authenticate the CLI with your Skillbooks API key.

```bash
skillbook login
skillbook login --force          # overwrite existing key
skillbook login --format json
```

Sign up at [skillbooks.ai/signup](https://skillbooks.ai/signup) to get your API key, then run `skillbook login` to authenticate.

### `skillbook account`

Show your account balance, usage totals, publisher status, and published books.

```bash
skillbook account
skillbook account --format json
```

## Authentication

Commands that talk to the platform API (`publish`, `search`, `account`) need an API key.

The fastest way to get started:

1. Sign up at [skillbooks.ai/signup](https://skillbooks.ai/signup) to get your API key
2. Run `skillbook login` to authenticate

```bash
skillbook login
```

This validates your API key and saves it to `.env` in the current directory. All commands automatically load `.env`, so you're ready to go.

You can also set the key manually:

```bash
# .env file (recommended)
SKILLBOOKS_API_KEY=sk_your_key_here

# Environment variable
export SKILLBOOKS_API_KEY=sk_your_key_here

# Or pass it directly
skillbook account --key sk_your_key_here
```

## Custom API URL

For self-hosted instances or development:

```bash
export SKILLBOOKS_API=https://your-instance.example.com
# or
skillbook account --api-url https://your-instance.example.com
```

## Related

- **[Skillbook Format Spec](https://github.com/skillbooks-ai/skillbook)** — the standard that defines the skillbook format
- **[Skillbook Authoring Guide](https://github.com/skillbooks-ai/skillbook-authoring)** — a comprehensive guide for creating high-quality skillbooks

## License

MIT
