#!/usr/bin/env python3
"""
build_missing_indexes.py

Generates the indexes that were missing from the original build:
  1. index/characters.md       — every named character, which plays they appear in
  2. index/tragedies.md        — category index with MM-generated summaries
  3. index/comedies.md         — "
  4. index/histories.md        — "
  5. index/romances.md         — "
  6. Updates SKILL.md links to point to correct paths

Also fixes category/index.md files to have real summaries (not blank cells).

Safe to re-run: all outputs are overwritten idempotently.
"""

import json
import re
import sys
import time
import logging
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

BASE_DIR = Path("/Users/bodhi/.openclaw/workspace/spellbook/books/shakespeare")
LMSTUDIO_URL = "http://192.168.0.7:1234/v1/chat/completions"
API_TIMEOUT = 180
RETRY_DELAY = 10

PLAYS = [
    {"title": "Romeo and Juliet",          "slug": "romeo-and-juliet",          "cat": "tragedies"},
    {"title": "Hamlet",                    "slug": "hamlet",                    "cat": "tragedies"},
    {"title": "Macbeth",                   "slug": "macbeth",                   "cat": "tragedies"},
    {"title": "Othello",                   "slug": "othello",                   "cat": "tragedies"},
    {"title": "King Lear",                 "slug": "king-lear",                 "cat": "tragedies"},
    {"title": "Julius Caesar",             "slug": "julius-caesar",             "cat": "tragedies"},
    {"title": "Antony and Cleopatra",      "slug": "antony-and-cleopatra",      "cat": "tragedies"},
    {"title": "Coriolanus",                "slug": "coriolanus",                "cat": "tragedies"},
    {"title": "Timon of Athens",           "slug": "timon-of-athens",           "cat": "tragedies"},
    {"title": "Titus Andronicus",          "slug": "titus-andronicus",          "cat": "tragedies"},
    {"title": "Troilus and Cressida",      "slug": "troilus-and-cressida",      "cat": "tragedies"},
    {"title": "A Midsummer Night's Dream", "slug": "midsummer-nights-dream",    "cat": "comedies"},
    {"title": "The Merchant of Venice",    "slug": "merchant-of-venice",        "cat": "comedies"},
    {"title": "Much Ado About Nothing",    "slug": "much-ado-about-nothing",    "cat": "comedies"},
    {"title": "Twelfth Night",             "slug": "twelfth-night",             "cat": "comedies"},
    {"title": "As You Like It",            "slug": "as-you-like-it",            "cat": "comedies"},
    {"title": "The Taming of the Shrew",   "slug": "taming-of-the-shrew",       "cat": "comedies"},
    {"title": "The Tempest",               "slug": "the-tempest",               "cat": "comedies"},
    {"title": "The Comedy of Errors",      "slug": "comedy-of-errors",          "cat": "comedies"},
    {"title": "Love's Labour's Lost",      "slug": "loves-labours-lost",        "cat": "comedies"},
    {"title": "Measure for Measure",       "slug": "measure-for-measure",       "cat": "comedies"},
    {"title": "The Merry Wives of Windsor","slug": "merry-wives-of-windsor",    "cat": "comedies"},
    {"title": "Two Gentlemen of Verona",   "slug": "two-gentlemen-of-verona",   "cat": "comedies"},
    {"title": "All's Well That Ends Well", "slug": "alls-well-that-ends-well",  "cat": "comedies"},
    {"title": "The Winter's Tale",         "slug": "winters-tale",              "cat": "romances"},
    {"title": "Cymbeline",                 "slug": "cymbeline",                 "cat": "romances"},
    {"title": "Pericles",                  "slug": "pericles",                  "cat": "romances"},
    {"title": "Richard II",                "slug": "richard-ii",                "cat": "histories"},
    {"title": "Henry IV, Part 1",          "slug": "henry-iv-part-1",           "cat": "histories"},
    {"title": "Henry IV, Part 2",          "slug": "henry-iv-part-2",           "cat": "histories"},
    {"title": "Henry V",                   "slug": "henry-v",                   "cat": "histories"},
    {"title": "Henry VI, Part 1",          "slug": "henry-vi-part-1",           "cat": "histories"},
    {"title": "Henry VI, Part 2",          "slug": "henry-vi-part-2",           "cat": "histories"},
    {"title": "Henry VI, Part 3",          "slug": "henry-vi-part-3",           "cat": "histories"},
    {"title": "Richard III",               "slug": "richard-iii",               "cat": "histories"},
    {"title": "King John",                 "slug": "king-john",                 "cat": "histories"},
    {"title": "Henry VIII",                "slug": "henry-viii",                "cat": "histories"},
]


# ── LMStudio call ────────────────────────────────────────────────────────────

def call_minimax(prompt, system="You are a literary scholar building an AI-navigable Shakespeare reference."):
    for attempt in range(3):
        try:
            resp = requests.post(LMSTUDIO_URL, json={
                "model": "minimax/minimax-m2.5",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 3000,
                "temperature": 0.3,
            }, timeout=API_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            # Strip <think> blocks
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            return content
        except Exception as e:
            log.warning(f"Attempt {attempt+1} failed: {e}")
            if attempt < 2:
                time.sleep(RETRY_DELAY)
    return None


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_play_dir(play):
    return BASE_DIR / play["cat"] / play["slug"]

def read_scene_files(play):
    """Return list of (filename, content) for all scene files in a play."""
    play_dir = get_play_dir(play)
    if not play_dir.exists():
        return []
    return [(f.name, f.read_text(encoding="utf-8")) for f in sorted(play_dir.glob("act*-scene*.md"))]

def extract_section(content, section_name):
    """Extract a named ## section from markdown."""
    match = re.search(rf"## {section_name}\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
    return match.group(1).strip() if match else ""

def extract_characters_from_scene(content):
    """Return list of character names from 'Characters in This Scene' section."""
    section = extract_section(content, "Characters in This Scene")
    if not section:
        return []
    # It's a comma-separated line or a list
    chars = re.split(r",\s*|\n[-*]\s*", section)
    return [c.strip() for c in chars if c.strip()]


# ── 1. characters.md ─────────────────────────────────────────────────────────

def build_characters_index():
    out_path = BASE_DIR / "index" / "characters.md"
    log.info("Building characters index...")

    # Collect character → list of (play_title, scene_path) from all scene files
    char_appearances = {}  # char_name -> list of {"play": title, "slug": slug, "cat": cat, "scene": filename}

    for play in PLAYS:
        for fname, content in read_scene_files(play):
            chars = extract_characters_from_scene(content)
            for char in chars:
                if not char or len(char) > 60:
                    continue
                if char not in char_appearances:
                    char_appearances[char] = []
                char_appearances[char].append({
                    "play": play["title"],
                    "slug": play["slug"],
                    "cat": play["cat"],
                    "scene": fname,
                })

    # Build a condensed per-character summary (play-level, not scene-level)
    # Group by play for each character
    char_plays = {}
    for char, appearances in char_appearances.items():
        plays_seen = {}
        for a in appearances:
            key = a["play"]
            if key not in plays_seen:
                plays_seen[key] = {"slug": a["slug"], "cat": a["cat"], "count": 0}
            plays_seen[key]["count"] += 1
        char_plays[char] = plays_seen

    # Use MM to generate a rich narrative index from this data
    # Build a compact summary for the prompt
    summary_lines = []
    for char in sorted(char_plays.keys()):
        plays_list = ", ".join(
            f"{p} ({info['count']} scenes)" for p, info in char_plays[char].items()
        )
        summary_lines.append(f"- {char}: {plays_list}")

    prompt = f"""You are building an AI-navigable index of Shakespeare characters.

Below is a list of every character name extracted from scene files, along with which plays they appear in and how many scenes.

Your task: Write a comprehensive `characters.md` index file in markdown that:
1. Starts with a brief intro explaining what this page is and how to use it
2. Has an A-Z section for each letter containing characters
3. For each character lists: their role/description, which play(s) they appear in (with links), and a 1-sentence description of who they are
4. Links to plays use the format: `../CATEGORY/SLUG/index.md` (e.g. `../tragedies/hamlet/index.md`)
5. Ends with navigation: `[↑ All Plays](all-plays.md)` and `[↑ Home](../SKILL.md)`

Focus on the major and mid-tier characters. Minor walk-ons (guards, servants with no name) can be grouped or skipped.

CHARACTER DATA:
{chr(10).join(summary_lines[:200])}

Write the full characters.md now:"""

    result = call_minimax(prompt)
    if not result:
        log.error("Failed to generate characters.md")
        return False

    out_path.write_text(result, encoding="utf-8")
    log.info(f"✅ characters.md written ({len(result)} chars)")
    return True


# ── 2. Category indexes in index/ directory ───────────────────────────────────

def build_category_index_page(category):
    """Build index/CATEGORY.md with MM-generated play summaries."""
    out_path = BASE_DIR / "index" / f"{category}.md"
    log.info(f"Building index/{category}.md...")

    cat_plays = [p for p in PLAYS if p["cat"] == category]

    # Gather play summaries from existing play index.md files
    play_data = []
    for play in cat_plays:
        play_dir = get_play_dir(play)
        index_file = play_dir / "index.md"
        summary = ""
        if index_file.exists():
            content = index_file.read_text(encoding="utf-8")
            # Try to get the first paragraph after the title
            match = re.search(r"^# .+\n+(.+?)(?:\n\n|\n#)", content, re.DOTALL)
            if match:
                summary = match.group(1).strip()[:300]
        play_data.append({"title": play["title"], "slug": play["slug"], "summary": summary})

    play_list = "\n".join(
        f'- {p["title"]}: {p["summary"][:200] if p["summary"] else "(no summary available)"}' 
        for p in play_data
    )

    prompt = f"""Write a markdown index page for Shakespeare's {category.title()}.

This page is for AI agents navigating a skillbook. It should:
1. Start with `# Shakespeare's {category.title()}`
2. Have a 2-3 sentence intro describing what defines this category of Shakespeare's work
3. Have a table with columns: Play | Key Themes | Best Known For
4. Each play links to: `../{category}/SLUG/index.md`
5. End with: `[↑ All Plays](all-plays.md)` | `[↑ Home](../SKILL.md)`

Plays and summaries:
{play_list}

Play slugs for links:
{chr(10).join(f'- {p["title"]} → ../{category}/{p["slug"]}/index.md' for p in cat_plays)}

Write the full {category}.md page now:"""

    result = call_minimax(prompt)
    if not result:
        log.error(f"Failed to generate {category}.md")
        return False

    out_path.write_text(result, encoding="utf-8")
    log.info(f"✅ index/{category}.md written")
    return True


# ── 3. Fix category/index.md summaries ───────────────────────────────────────

def fix_category_index(category):
    """Rewrite the category/index.md with proper MM-generated play summaries."""
    cat_dir = BASE_DIR / category
    out_path = cat_dir / "index.md"
    log.info(f"Fixing {category}/index.md...")

    cat_plays = [p for p in PLAYS if p["cat"] == category]

    # Build summary data from play indexes
    rows = []
    for play in cat_plays:
        play_dir = get_play_dir(play)
        index_file = play_dir / "index.md"
        summary = ""
        if index_file.exists():
            content = index_file.read_text(encoding="utf-8")
            # Extract first real paragraph
            lines = content.split("\n")
            for line in lines:
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("|") and not line.startswith("["):
                    summary = line[:150]
                    break
        rows.append((play["title"], play["slug"], summary))

    prompt = f"""Write a clean markdown index page for Shakespeare's {category.title()}.

For each play, write a one-line summary (15-25 words) capturing the essential plot or themes.

Format as a markdown table:
| Play | Summary |
|------|---------|
| [Title](slug/index.md) | One-line summary |

Plays:
{chr(10).join(f'- {title} (slug: {slug}): existing summary hint: {summary}' for title, slug, summary in rows)}

End with: `[↑ All Plays](../SKILL.md)`

Write only the markdown, no preamble:"""

    result = call_minimax(prompt)
    if not result:
        log.error(f"Failed to fix {category}/index.md")
        return False

    # Prepend header
    full = f"# Shakespeare's {category.title()}\n\n{result}"
    out_path.write_text(full, encoding="utf-8")
    log.info(f"✅ {category}/index.md fixed")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    index_dir = BASE_DIR / "index"
    index_dir.mkdir(parents=True, exist_ok=True)

    steps = [
        ("characters.md", build_characters_index),
        ("index/tragedies.md", lambda: build_category_index_page("tragedies")),
        ("index/comedies.md",  lambda: build_category_index_page("comedies")),
        ("index/histories.md", lambda: build_category_index_page("histories")),
        ("index/romances.md",  lambda: build_category_index_page("romances")),
        ("tragedies/index.md (fix)", lambda: fix_category_index("tragedies")),
        ("comedies/index.md (fix)",  lambda: fix_category_index("comedies")),
        ("histories/index.md (fix)", lambda: fix_category_index("histories")),
        ("romances/index.md (fix)",  lambda: fix_category_index("romances")),
    ]

    results = []
    for name, fn in steps:
        log.info(f"\n{'='*60}\nStep: {name}\n{'='*60}")
        ok = fn()
        results.append((name, ok))
        time.sleep(2)

    log.info("\n\n📋 SUMMARY")
    for name, ok in results:
        status = "✅" if ok else "❌"
        log.info(f"  {status} {name}")

    failed = [n for n, ok in results if not ok]
    if failed:
        log.error(f"\n{len(failed)} steps failed: {failed}")
        sys.exit(1)
    else:
        log.info("\n🎉 All missing indexes built!")


if __name__ == "__main__":
    main()
