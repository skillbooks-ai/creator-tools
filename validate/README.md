# Validate

Validate a skillbook against [FORMAT.md v1.0](../../FORMAT.md) before publishing.

## Usage

```bash
./validate.sh /path/to/my-book
```

## What It Checks

| Check | Level | Description |
|-------|-------|-------------|
| Root files | Error | SKILL.md, README.md, book.json exist |
| Frontmatter | Error | Required fields: name, title, description, server, version, pages, price, license |
| License section | Error | `## License` present in SKILL.md |
| book.json fields | Error | Required: id, title, version, language, verified, structure.readme |
| Section structure | Error | Every `NN-*/` folder has `00-overview.md` |
| File naming | Error | All pages match `NN-name.md` pattern |
| TOC links | Error | Every path in SKILL.md TOC resolves to an actual file |
| Tag consistency | Error | If pages have tags, TAG-INDEX.json must exist |
| Page length | Warning | Target 40-100 lines per page |
| Overview indexes | Warning | `00-overview.md` should reference all pages in its folder |
| Orphan pages | Warning | Pages not listed in SKILL.md TOC |
| Legacy fields | Warning | `structure.summary` in book.json (removed in v1.0) |

## Exit Codes

- `0` — All checks pass
- `1` — Errors found (must fix before publishing)
- `2` — Warnings only (publishable, but should fix)

## Prerequisites

- bash 4+
- python3 (for book.json parsing)
