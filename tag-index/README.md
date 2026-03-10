# Tag Index

Generate `TAG-INDEX.json` from page frontmatter tags.

## Usage

```bash
./generate-tag-index.sh /path/to/my-book
```

## How It Works

1. Walks all content directories (`NN-*/`)
2. Reads YAML frontmatter from every `.md` file
3. Extracts `tags: [tag1, tag2]` fields
4. Builds a flat map: `{ "tag": ["path/to/page.md", ...] }`
5. Writes `TAG-INDEX.json` to the book root

Skips `sources/`, `.verify/`, `.git/`, and `node_modules/`.

## Tag Format in Pages

```yaml
---
tags: [refrigerants, safety, high-pressure]
---
```

- Lowercase, hyphen-separated
- Consistent spelling across pages (`high-pressure` ≠ `high_pressure`)

## Output

If tags are found: writes `TAG-INDEX.json` and reports stats.
If no tags found: no file is generated.

## When to Use

- After adding or changing tags in page frontmatter
- Before publishing (ensures TAG-INDEX.json is up to date)
- As part of the Gutenberg pipeline (after content generation)
