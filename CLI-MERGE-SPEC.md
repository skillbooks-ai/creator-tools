# CLI Merge Spec — Unified `skillbooks` CLI

## Goal

Merge the bash creator-tools and the TS packages/cli into ONE public CLI: `@skillbooks/cli`, installed as `skillbooks`.

## Target Commands

| Command | Source | Description |
|---------|--------|-------------|
| `skillbooks init [path]` | bash creator-tools/init | Interactive scaffolding for new skillbook projects |
| `skillbooks validate <path>` | bash creator-tools/validate (logic) + TS validate lib | Full validation with rich output |
| `skillbooks index <path>` | bash creator-tools/index | Build TAG-INDEX.json + regenerate SKILL.md TOC |
| `skillbooks publish <path>` | TS packages/cli/publish | Validate + upload to platform API |
| `skillbooks search <query>` | TS packages/cli/search | Search the catalog |
| `skillbooks account` | bash creator-tools/account + TS credits | Balance, usage totals, publisher status |
| `skillbooks stats [book-id]` | TS packages/cli/stats | Usage/revenue stats for published books |
| `skillbooks signup` | TS packages/cli/signup | Create account, get API key |

## Architecture

- **Language:** TypeScript (the TS CLI has the right npm package shape)
- **Framework:** Commander (already in use)
- **Package:** `@skillbooks/cli` with `bin: { "skillbooks": "./dist/index.js" }`
- **Validation:** Use `@skillbooks/validate` lib for structural checks, but PORT the bash validate.sh's rich output formatting and additional checks (package.json sync, metadata block, section overviews, TOC link validation, orphan detection, page length warnings)
- **No bash dependency:** Everything in TypeScript. Users install with `npm install -g @skillbooks/cli`.
- **API calls:** Use the existing lib/api.ts for platform interactions

## What to Port from Bash

### validate.sh (425 lines) — the crown jewel
The bash validator has checks the TS lib doesn't:
- package.json parsing and sync checks (name, version, description, license match SKILL.md)
- `skillbook` config block in package.json (title, server, pages, price, language, verified)
- SKILL.md metadata block with `skillbook-*` prefixed keys
- Section 00-overview.md existence checks
- Page length warnings (target 40-100 lines)
- TOC link resolution (all paths exist, orphan page detection)
- Fenced code block / backtick awareness when scanning TOC links
- Rich formatted output with ✅ ❌ ⚠️ ℹ️ and section headers

### init.sh (282 lines)
- Interactive prompts: name, title, description, author, license, sections
- Generates: SKILL.md with frontmatter + TOC, README.md, package.json with skillbook config, section dirs with 00-overview.md
- Optionally generates TAG-INDEX.json

### index.sh (274 lines)  
- Scans all content pages for `tags:` frontmatter, builds TAG-INDEX.json
- Scans directory structure, reads page titles (first `# heading`), regenerates SKILL.md TOC section
- Options: --tags-only, --toc-only, --dry-run

### account.sh (96 lines)
- Calls API: GET /account with API key
- Shows: credit balance, account type, publisher status, connected Stripe account

## What to Keep from TS

- Commander setup and package structure
- lib/api.ts (API client with key handling)
- lib/cli.ts (error handling, option parsing)
- commands/publish.ts (validate + upload flow)
- commands/search.ts, commands/stats.ts, commands/signup.ts (thin API wrappers)
- The `@skillbooks/validate` dependency (don't duplicate the lib, extend it)

## Output Location

Build the merged CLI in `/Users/bodhi/.openclaw/workspace/skillbooks/creator-tools/` — this is the public repo that's already on GitHub. Replace the bash scripts with the TS implementation.

Preserve the bash scripts in a `legacy/` dir for reference during the port.

## Package.json

```json
{
  "name": "@skillbooks/cli",
  "version": "2.0.0",
  "description": "The Skillbooks CLI — create, validate, and publish skillbooks",
  "type": "module",
  "bin": {
    "skillbooks": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest"
  },
  "dependencies": {
    "commander": "^14.0.3",
    "js-yaml": "^4.1.1",
    "inquirer": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^25.3.5",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^3.0.0"
  }
}
```

Note: Do NOT depend on @skillbooks/validate (that's a monorepo internal package). Instead, inline/port the validation logic so the CLI is fully standalone and installable from npm.

## Testing

After build, verify these work:
1. `skillbooks --version` → prints version
2. `skillbooks --help` → shows all commands
3. `skillbooks validate /Users/bodhi/.openclaw/workspace/skillbooks/building-skillbooks` → should pass with 0 errors and ~42 warnings (matching the bash validator output)
4. `skillbooks init /tmp/test-skillbook` → interactive scaffolding creates valid structure
5. `skillbooks index /Users/bodhi/.openclaw/workspace/skillbooks/building-skillbooks` → builds/updates TAG-INDEX.json and TOC
