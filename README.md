# Creator Tools

This directory contains tools and resources for Spellbook authors — the people building and maintaining books on the platform.

---

## What Are Creator Tools?

Creator tools are reusable scripts and agent task prompts that help you:

- **Verify your book** — confirm that every factual claim traces back to its source
- **Audit your content** — find uncited assertions, misquoted regulations, and misleading exam tips
- **Maintain quality** — keep your book accurate as source materials change

These tools are designed to work with any Spellbook, not just specific ones. They use a `BOOK_PATH` variable so you can point them at whatever book you're working on.

---

## Available Tools

### `verify/` — Verification Pipeline

A multi-pass pipeline that reads your book's source documents and checks every factual claim.

**When to use it:** Before publishing a new book, or after making significant content updates.

**Prerequisites:** Your book must have a `sources/` folder with a `SOURCES.md` index file. See [FORMAT.md](../FORMAT.md) for details.

→ [Read the verification docs](verify/README.md)

---

## Quick Start

1. Make sure your book has `sources/SOURCES.md`
2. Run `creator-tools/verify/run-verify.sh` with `BOOK_PATH` set to your book directory
3. Follow the instructions it prints to spawn each verification pass as an agent

```bash
export BOOK_PATH=/path/to/your/book
bash /path/to/spellbook/creator-tools/verify/run-verify.sh
```

---

## Adding New Tools

If you build a new creator tool, add it here as a subdirectory with its own `README.md`. Follow the same pattern:

- Parameterize with `BOOK_PATH` — don't hardcode book-specific paths
- Include a shell script entry point where possible
- Document prerequisites clearly

---

## Platform Docs

- [FORMAT.md](../FORMAT.md) — canonical directory layout, `book.json` schema, and author guide
- [Spellbook README](../README.md) — platform overview
