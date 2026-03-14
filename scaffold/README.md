# Scaffold

Generate the skeleton directory structure for a new skillbook.

## Usage

```bash
skillbook scaffold /path/to/my-book
```

Creates the initial folder structure based on an outline. Overview files (`00-overview.md`) are the author's responsibility — the validator checks they exist, but `scaffold` only creates the directory structure and placeholder content pages.

## What It Creates

- Section directories (`NN-topic-name/`)
- Placeholder content pages
- Root files: `SKILL.md`, `README.md`, `book.json`

## What It Does NOT Create

- `00-overview.md` files — write these yourself (they need real descriptions)
- `TAG-INDEX.json` — run `skillbook index` after adding tags
- Content — that's your job
