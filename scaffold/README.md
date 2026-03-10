# Scaffold

Generate structural files required by FORMAT.md v1.0.

## scaffold-overviews.sh

Generates `00-overview.md` files for every section folder that doesn't have one.

```bash
./scaffold-overviews.sh /path/to/my-book           # skip existing
./scaffold-overviews.sh /path/to/my-book --force    # overwrite existing
```

Generated files include TODO comments — fill them in with actual descriptions before publishing.

## What It Generates

For each `NN-section/` folder:
- Creates `00-overview.md` with:
  - Section title (derived from folder name)
  - Placeholder "what this section covers" description
  - Placeholder "when to read this section" guidance
  - File index listing every `NN-*.md` page in the folder

## When to Use

- After creating a new book structure manually
- After running a Gutenberg pipeline (to fill in any missing overviews)
- When converting an existing book to FORMAT v1.0 (which requires `00-overview.md` in every section)
