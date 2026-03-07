#!/usr/bin/env python3
"""
patch_add_source.py
====================
Retroactively adds "## Source Text" sections to already-generated scene files.
Also strips any <think>...</think> leakage from model output.

Reads from: books/shakespeare/{cat}/{slug}/act*-scene*.md
Cache at:   shakespeare/_cache/{slug}.txt (raw play text)

Safe to re-run — skips files that already have ## Source Text.
"""

import re
import sys
import time
from pathlib import Path

BOOKS_DIR = Path("/Users/bodhi/.openclaw/workspace/spellbook/books/shakespeare")
CACHE_DIR = Path("/Users/bodhi/.openclaw/workspace/spellbook/shakespeare/_cache")

# Same play catalog as builder
PLAYS = [
    {"title": "Romeo and Juliet",       "slug": "romeo-and-juliet",       "cat": "tragedies", "mit": "romeo_juliet"},
    {"title": "Hamlet",                 "slug": "hamlet",                  "cat": "tragedies", "mit": "hamlet"},
    {"title": "Macbeth",                "slug": "macbeth",                 "cat": "tragedies", "mit": "macbeth"},
    {"title": "Othello",                "slug": "othello",                 "cat": "tragedies", "mit": "othello"},
    {"title": "King Lear",              "slug": "king-lear",               "cat": "tragedies", "mit": "lear"},
    {"title": "Julius Caesar",          "slug": "julius-caesar",           "cat": "tragedies", "mit": "julius_caesar"},
    {"title": "Antony and Cleopatra",   "slug": "antony-and-cleopatra",    "cat": "tragedies", "mit": "antony"},
    {"title": "Coriolanus",             "slug": "coriolanus",              "cat": "tragedies", "mit": "coriolanus"},
    {"title": "Timon of Athens",        "slug": "timon-of-athens",         "cat": "tragedies", "mit": "timon"},
    {"title": "Titus Andronicus",       "slug": "titus-andronicus",        "cat": "tragedies", "mit": "titus_andronicus"},
    {"title": "Troilus and Cressida",   "slug": "troilus-and-cressida",    "cat": "tragedies", "mit": "troilus_cressida"},
    {"title": "A Midsummer Night's Dream", "slug": "midsummer-nights-dream", "cat": "comedies", "mit": "midsummer"},
    {"title": "The Merchant of Venice", "slug": "merchant-of-venice",      "cat": "comedies", "mit": "merchant"},
    {"title": "Much Ado About Nothing", "slug": "much-ado-about-nothing",  "cat": "comedies", "mit": "much_ado"},
    {"title": "Twelfth Night",          "slug": "twelfth-night",           "cat": "comedies", "mit": "twelfth_night"},
    {"title": "As You Like It",         "slug": "as-you-like-it",          "cat": "comedies", "mit": "asyoulikeit"},
    {"title": "The Taming of the Shrew","slug": "taming-of-the-shrew",     "cat": "comedies", "mit": "taming_shrew"},
    {"title": "The Tempest",            "slug": "the-tempest",             "cat": "comedies", "mit": "tempest"},
    {"title": "The Comedy of Errors",   "slug": "comedy-of-errors",        "cat": "comedies", "mit": "comedy_errors"},
    {"title": "Love's Labour's Lost",   "slug": "loves-labours-lost",      "cat": "comedies", "mit": "loves_labours_lost"},
    {"title": "Measure for Measure",    "slug": "measure-for-measure",     "cat": "comedies", "mit": "measure"},
    {"title": "The Merry Wives of Windsor", "slug": "merry-wives-of-windsor", "cat": "comedies", "mit": "merry_wives"},
    {"title": "Two Gentlemen of Verona","slug": "two-gentlemen-of-verona", "cat": "comedies", "mit": "two_gentlemen"},
    {"title": "All's Well That Ends Well", "slug": "alls-well-that-ends-well", "cat": "comedies", "mit": "alls_well"},
    {"title": "The Winter's Tale",      "slug": "winters-tale",            "cat": "romances", "mit": "winters_tale"},
    {"title": "Cymbeline",              "slug": "cymbeline",               "cat": "romances", "mit": "cymbeline"},
    {"title": "Pericles",               "slug": "pericles",                "cat": "romances", "mit": "pericles"},
    {"title": "Richard II",             "slug": "richard-ii",              "cat": "histories", "mit": "richardii"},
    {"title": "Henry IV, Part 1",       "slug": "henry-iv-part-1",         "cat": "histories", "mit": "1henryiv"},
    {"title": "Henry IV, Part 2",       "slug": "henry-iv-part-2",         "cat": "histories", "mit": "2henryiv"},
    {"title": "Henry V",                "slug": "henry-v",                 "cat": "histories", "mit": "henryv"},
    {"title": "Henry VI, Part 1",       "slug": "henry-vi-part-1",         "cat": "histories", "mit": "1henryvi"},
    {"title": "Henry VI, Part 2",       "slug": "henry-vi-part-2",         "cat": "histories", "mit": "2henryvi"},
    {"title": "Henry VI, Part 3",       "slug": "henry-vi-part-3",         "cat": "histories", "mit": "3henryvi"},
    {"title": "Richard III",            "slug": "richard-iii",             "cat": "histories", "mit": "richardiii"},
    {"title": "King John",              "slug": "king-john",               "cat": "histories", "mit": "john"},
    {"title": "Henry VIII",             "slug": "henry-viii",              "cat": "histories", "mit": "henryviii"},
]


def roman_to_int(s):
    s = s.upper().strip()
    roman = {"I": 1, "V": 5, "X": 10, "L": 50}
    try:
        return int(s)
    except ValueError:
        pass
    result, prev = 0, 0
    for ch in reversed(s):
        val = roman.get(ch, 0)
        result += val if val >= prev else -val
        prev = val
    return result if result > 0 else 1


def parse_scenes(play_text, play_title):
    """Mirror of builder.py parse_scenes_from_text — must stay in sync."""
    scenes = []
    # Require newline before ACT/SCENE to avoid matching mid-line dialogue
    act_pattern = re.compile(
        r'\n\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5]|THE\s+\w+)\s*[\.\n]',
        re.IGNORECASE
    )
    scene_pattern = re.compile(
        r'\n\s*SCENE\s+(I{1,4}V?|V?I{0,4}|[0-9]+)\s*[\.\s]([^\n]*)',
        re.IGNORECASE
    )
    act_matches = list(act_pattern.finditer(play_text))
    if not act_matches:
        act_pattern2 = re.compile(r'^\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5])\b', re.IGNORECASE | re.MULTILINE)
        act_matches = list(act_pattern2.finditer(play_text))

    def get_act_bounds():
        bounds = []
        for i, m in enumerate(act_matches):
            start = m.start()
            end = act_matches[i+1].start() if i+1 < len(act_matches) else len(play_text)
            act_num = roman_to_int(m.group(1).split()[0] if 'THE' in m.group(1).upper() else m.group(1))
            bounds.append((act_num, start, end, play_text[start:end]))
        if not bounds:
            bounds = [(1, 0, len(play_text), play_text)]
        return bounds

    for act_num, _, _, act_text in get_act_bounds():
        scene_matches = list(scene_pattern.finditer(act_text))
        if not scene_matches:
            scenes.append({"act_num": act_num, "scene_num": 1, "text": act_text.strip()})
            continue
        for j, sm in enumerate(scene_matches):
            scene_num = roman_to_int(sm.group(1))
            sc_start = sm.start()
            sc_end = scene_matches[j+1].start() if j+1 < len(scene_matches) else len(act_text)
            scenes.append({
                "act_num": act_num,
                "scene_num": scene_num,
                "text": act_text[sc_start:sc_end].strip(),
            })
    return scenes


def patch_play(play):
    slug = play["slug"]
    cat = play["cat"]
    title = play["title"]

    cache_file = CACHE_DIR / f"{slug}.txt"
    if not cache_file.exists():
        print(f"  [{title}] No cache — skipping (will be handled by builder on next run)")
        return 0, 0

    play_text = cache_file.read_text(encoding="utf-8", errors="replace")
    scenes = parse_scenes(play_text, title)
    scene_map = {(s["act_num"], s["scene_num"]): s["text"] for s in scenes}

    play_dir = BOOKS_DIR / cat / slug
    if not play_dir.exists():
        return 0, 0

    patched = 0
    skipped = 0
    for scene_file in sorted(play_dir.glob("act*-scene*.md")):
        content = scene_file.read_text(encoding="utf-8")

        # Already patched with real content? Skip. Placeholder = needs redo.
        if "## Source Text" in content and "(Source text not available" not in content:
            skipped += 1
            continue
        # Strip any existing placeholder source section so we can replace it
        content = re.sub(r'\n\n---\n\n## Source Text\n\n```\n.*?```\n?$', '', content, flags=re.DOTALL).strip()

        # Strip <think> leakage
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        # Parse act/scene from filename: act3-scene2.md
        m = re.match(r"act(\d+)-scene(\d+)\.md", scene_file.name)
        if not m:
            continue
        act_num, scene_num = int(m.group(1)), int(m.group(2))

        source_text = scene_map.get((act_num, scene_num), "")
        if not source_text:
            print(f"  [{title}] Act {act_num} Scene {scene_num}: no source text found in parsed scenes")
            source_text = "(Source text not available for this scene)"

        patched_content = content + f"\n\n---\n\n## Source Text\n\n```\n{source_text}\n```\n"
        scene_file.write_text(patched_content, encoding="utf-8")
        patched += 1

    return patched, skipped


def main():
    print("=== Retroactive Source Text Patcher ===\n")
    total_patched = 0
    total_skipped = 0

    for play in PLAYS:
        p, s = patch_play(play)
        if p or s:
            print(f"  [{play['title']}] patched={p}, already_done={s}")
        total_patched += p
        total_skipped += s

    print(f"\nDone. Patched: {total_patched}, Already had source text: {total_skipped}")


if __name__ == "__main__":
    main()
