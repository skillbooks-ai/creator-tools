---
name: skillbook-creator
title: "Skillbook Creator"
description: Step-by-step protocol for creating FORMAT v1.0 skillbooks from source material. Covers analysis, outlining, decomposition, scaffolding, and validation.
version: 1.0.0
author: Skillbooks AI
license: MIT
tags: [skillbook, creator, publishing, format]
---

# Skillbook Creator

You are creating a **skillbook** — a structured knowledge base designed for AI agents to navigate efficiently. This skill walks you through every step, from raw source material to a validated, publishable book.

**What is a skillbook?** Content (books, manuals, guides, regulations) broken into atomic markdown pages organized as a navigable graph. Agents fetch only the pages they need. Think "ebook for AI agents."

---

## Before You Start

You need:
1. **Source material** — text files, PDFs, markdown, or URLs containing the content to convert
2. **A working directory** — where you'll build the book
3. **The FORMAT v1.0 spec** — embedded in this skill below

Create your working directory:
```
mkdir my-book && cd my-book
mkdir source
```

Place all source material in `source/`. Supported formats: `.txt`, `.md`, `.pdf`, `.html`

---

## Step 1: Analyze Sources

Read everything in `source/`. Build a mental model of:

- **Scope:** What topics does this material cover?
- **Structure:** How is the original organized? (chapters, sections, articles, letters, acts/scenes)
- **Size:** How much content is there? (rough word count, number of logical units)
- **Audience:** Who is this for? (students, professionals, enthusiasts, certification seekers)
- **Authority:** What makes this source authoritative? (official government doc, classic text, peer-reviewed)

Write your analysis to `_build/analysis.md`:

```markdown
# Source Analysis

## Material
- [list each source file, what it contains, approximate size]

## Scope
[what the book will cover]

## Natural Structure
[how the source material is already organized]

## Proposed Book Size
- Estimated sections: N
- Estimated pages: N
- Target audience: [who]

## Authority
[why this source is trustworthy]

## Notes
[anything unusual — gaps, multiple editions, mixed quality]
```

---

## Step 2: Design the Outline

Based on your analysis, design the section/page structure following FORMAT v1.0 rules:

### Naming Rules (MUST follow exactly)
- **Section folders:** `NN-topic-name/` — 2-digit prefix, kebab-case, lowercase
- **Section overview:** `00-overview.md` — ALWAYS the first file in every section folder
- **Content pages:** `01-page-name.md` through `NN-page-name.md` — 2-digit prefix, kebab-case
- **No spaces anywhere.** All names lowercase, hyphen-separated

### Structure Rules
- **One concept per page** — if a page covers two distinct ideas, split it
- **40-100 lines per page** — long enough to be useful, short enough to be token-efficient
- **Self-contained pages** — each page should make sense without requiring other pages first
- **Every section gets a `00-overview.md`** — no exceptions

### Choosing Sections
- Group related content into 3-10 top-level sections
- If a section would have >15 pages, consider subsections
- Number sections in logical reading order
- Section names should be meaningful and descriptive

Write your outline to `_build/outline.md`:

```markdown
# Book Outline

## 01-section-name
Section description.
- 00-overview.md — Section overview
- 01-page-name.md — [what this page covers]
- 02-page-name.md — [what this page covers]

## 02-section-name
...
```

**Review the outline before proceeding.** This is the hardest decision — restructuring after decomposition is expensive.

---

## Step 3: Decompose Content

This is the core transformation. You're converting raw source material into atomic, self-contained pages.

### For Each Page in Your Outline:

1. **Extract** the relevant content from source material
2. **Transform** it into clean markdown:
   - Start with what this page is about (one sentence)
   - Deliver the core content using structure: headers, lists, examples
   - No filler ("In this section we will explore...") — just deliver the content
   - End with cross-references to related pages using relative paths
3. **Write** the file to the correct path

### Page Content Rules

```markdown
# Page Title

[One sentence: what this page covers and why it matters.]

## Main Content

[The actual content. Use headers, lists, tables, examples as appropriate.]

- Use **bold** for key terms on first use
- Use code blocks for technical content
- Use blockquotes for direct quotes from sources

## Cross-References

- See also: [Related Topic](../02-section/03-page.md)
- Related: [Another Page](01-other-page.md)
```

### Tags (Optional but Recommended)

Add tags as YAML frontmatter at the top of each content page:

```yaml
---
tags: [topic-tag, another-tag]
---

# Page Title
...
```

- Lowercase, hyphen-separated
- Meaningful to the book's domain
- Consistent spelling across the book

### Writing `00-overview.md` Files

Every section's `00-overview.md` must contain:

1. **What this section covers** — 1-2 sentences
2. **When to read this section** — what questions or tasks bring you here
3. **Pages in This Section** — every file with a one-line description
4. **Reading order guidance** — sequential or independent?

Target length: 20-40 lines. Example:

```markdown
# Section Title

[What this section covers — 1-2 sentences explaining the scope.]

## When to Read This Section

- [Question or task that brings a reader here]
- [Another question or task]

## Pages in This Section

- `00-overview.md` — This overview
- `01-first-topic.md` — [description]
- `02-second-topic.md` — [description]

Pages can be read independently. Start with `01-first-topic.md` for the foundations.
```

### Quality Checks During Decomposition

- [ ] Every page is 40-100 lines
- [ ] Every page covers ONE concept
- [ ] Every page starts with a clear statement of what it covers
- [ ] Cross-references use correct relative paths
- [ ] No content from source material is lost (complete coverage)
- [ ] Tags are consistent across pages

---

## Step 4: Generate Scaffold Files

After all content pages are written, generate the required root files.

### 4a. SKILL.md

The agent entry point. Must contain:

**Frontmatter:**
```yaml
---
name: book-slug            # URL-safe, lowercase, hyphen-separated
title: "Display Title"     # Human-readable title
description: One-line description of what this book covers.
server: https://skillbooks.ai
version: 1.0.0
pages: [COUNT]             # Total pages including 00-overview.md files
price: "$X.00"             # Full book price
license: "public-domain"   # or "all-rights-reserved", "CC BY-NC 4.0", etc.
---
```

**Navigation Instructions:**
```markdown
## How to Use This Skillbook

1. Browse the Table of Contents below to find relevant sections
2. Fetch pages by constructing URLs: `{server}/{name}/{path}`
3. Include your API key in the `X-Skillbook-Key` header
4. Without a key, you'll receive a 402 response with signup info

SKILL.md and TAG-INDEX.json are always free. Content pages cost credits.
```

**Table of Contents:**
- List EVERY page with its relative path and a one-line description
- Group under section headers matching the folder structure
- Include `00-overview.md` entries
- Section headers can include brief italic descriptions

```markdown
## Table of Contents

### 01 — Section Name
*Brief description of this section's scope.*

- `01-section/00-overview.md` — Section overview and reading guide
- `01-section/01-page.md` — [descriptive one-liner]
- `01-section/02-page.md` — [descriptive one-liner]
```

**License Section:**
```markdown
## License

[License statement appropriate to the content]
```

**Quick Start Paths (recommended):**
```markdown
## Quick Start

**"What is this about?"** → `01-intro/00-overview.md`
**"I need [specific thing]"** → `03-section/05-specific-page.md`
```

### 4b. README.md

Human-facing catalog content. Write for human operators who decide whether to add this skillbook to their agents:

```markdown
# Book Title

[2-3 sentences: what this is, who it's for, why it exists]

## What's Inside

[Bullet list of key topics/sections]

## Why This Skillbook?

[What makes it authoritative, what problem it solves]

## At a Glance

- **Pages:** [N]
- **Sections:** [N]
- **License:** [license]
- **Sources:** [what the content is based on]
- **Last Updated:** [date]
```

### 4c. book.json

```json
{
  "id": "book-slug",
  "title": "Display Title",
  "description": "One-line description.",
  "version": "1.0.0",
  "author": "Author or source attribution",
  "language": "en",
  "verified": false,
  "sources": {
    "enabled": true,
    "path": "sources/",
    "index": "sources/SOURCES.md"
  },
  "structure": {
    "readme": "README.md",
    "tagIndex": "TAG-INDEX.json"
  }
}
```

If the book has no `sources/` directory, omit the `sources` block.
If no pages have tags, omit `structure.tagIndex`.

### 4d. TAG-INDEX.json (if pages have tags)

Build a flat JSON map of tag → page paths:

```json
{
  "tag-name": [
    "01-section/01-page.md",
    "03-section/02-page.md"
  ]
}
```

### 4e. sources/SOURCES.md (if source material is included)

```markdown
# Sources

| File | Source | Date Accessed | License |
|------|--------|---------------|---------|
| art-of-war.txt | Project Gutenberg #132 | 2026-03-10 | Public Domain |
```

---

## Step 5: Validate

Run the validation checklist:

### Structure Checks
- [ ] `SKILL.md` exists at root with valid frontmatter (all required fields)
- [ ] `README.md` exists at root
- [ ] `book.json` exists at root with required fields
- [ ] `## License` section exists in SKILL.md
- [ ] Every section folder has a `00-overview.md`

### Content Checks
- [ ] Every content page is listed in the SKILL.md TOC
- [ ] Every TOC path resolves to an actual file
- [ ] Pages are 40-100 lines each (warnings for minor deviations)
- [ ] One concept per page
- [ ] No orphan pages (files exist that aren't in the TOC)

### Consistency Checks
- [ ] `00-overview.md` "Pages in This Section" lists match actual folder contents
- [ ] Cross-references point to files that exist
- [ ] If tags exist, TAG-INDEX.json matches page frontmatter
- [ ] Page count in SKILL.md frontmatter matches actual page count
- [ ] book.json `id` matches SKILL.md `name`

### Fix any errors before publishing.

If a validation tool is available, run:
```bash
bash validate.sh /path/to/book
```

---

## Step 6: Publish

### Option A: Git Repository
```bash
cd my-book
git init
git add -A
git commit -m "Initial publish: [Book Title] v1.0.0"
git remote add origin https://github.com/skillbooks-ai/skillbook-[name].git
git push -u origin main
```

### Option B: Output Directory
If you don't have git access, ensure all files are in the output directory and report completion.

---

## Pricing Guide

| Content Type | Suggested Price | Rationale |
|---|---|---|
| Public domain classics | $2-5 | Free source material, value is in the structure |
| Government publications | $5-10 | Free source, high value in organization + verification |
| Exam prep | $15-30 | Position against $85+ retake costs |
| Professional reference | $10-25 | Compete with $100+ textbooks |
| Enterprise/specialized | $30+ | High-value, frequently updated content |

Revenue split: **80% author, 20% platform.** Platform absorbs payment processing fees.

---

## Common Patterns

### Classic Literature (plays, novels, philosophy)
- Genre/category folders → Play/work folders → Chapter/scene pages
- Example: `01-tragedies/04-hamlet/08-act3-scene1.md`

### Government Regulations
- Topic area folders → Specific regulation pages
- Preserve official numbering in page names
- Example: `03-high-risk/02-article-6.md`

### Exam Prep
- Topic domain folders → Concept pages + practice question pages
- Example: `02-refrigerants/01-types-and-properties.md`

### Business/Methodology Books
- Framework phase folders → Concept + application pages
- Example: `02-core-framework/03-outcome-based-segments.md`

---

## Reference Implementations

These published skillbooks demonstrate FORMAT v1.0 in different domains:

- **EPA 608** — exam prep (government regulation source)
- **EU AI Act** — legal compliance (regulatory text)
- **thrv JTBD** — business methodology (proprietary framework)
- **Shakespeare Complete** — literary reference (774 pages, 37 plays)

---

## Reminders

- **Quality > Speed.** A well-structured 40-page book beats a sloppy 200-page one.
- **Write for agents.** Clear, structured, scannable. Agents read 3-6 pages per question.
- **Describe, don't narrate.** "This page covers X" beats "In this page we will explore X."
- **Every page earns its place.** If a page doesn't deliver standalone value, merge it or cut it.
- **Cross-reference generously.** The graph structure is the product — make it navigable.
- **Tags enable discovery.** Even 3-5 tags per page dramatically improve agent navigation.
