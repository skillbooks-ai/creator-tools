#!/usr/bin/env python3
"""
Shakespeare Skillbook Builder
==============================
Builds a complete AI-navigable skillbook for the Complete Works of Shakespeare.
Every play, act, and scene gets a structured markdown page with:
  - Location, characters present
  - Detailed action summary (searchable, narrative)
  - Notable events, objects, memorable moments
  - Semantic tags

Idempotent: tracks progress in PROGRESS.json. Safe to kill and restart at any time.
Heartbeat: writes last_seen timestamp every 30s so the watchdog can detect stalls.

Usage:
  python3 builder.py           # Run builder (exits if already running)
  python3 builder.py --force   # Kill existing lock and restart
  python3 builder.py --status  # Print current status and exit
"""

import json
import os
import sys
import re
import time
import fcntl
import signal
import logging
import requests
import threading
from pathlib import Path
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

BASE_DIR = Path("/Users/bodhi/.openclaw/workspace/spellbook/books/shakespeare")
BUILDER_DIR = Path("/Users/bodhi/.openclaw/workspace/spellbook/shakespeare")
PROGRESS_FILE = BUILDER_DIR / "PROGRESS.json"
CACHE_DIR = BUILDER_DIR / "sources"
LOCK_FILE = Path("/tmp/shakespeare-builder.lock")
LOG_FILE = Path("/tmp/shakespeare-builder.log")

LMSTUDIO_URL = "http://192.168.0.7:1234/v1/chat/completions"
MODEL = "minimax/minimax-m2.5"

HEARTBEAT_SECS = 30     # Write last_seen to progress every N seconds
API_TIMEOUT = 180       # Max seconds to wait for LMStudio response
MAX_RETRIES = 3         # Retry failed API calls this many times
RETRY_DELAY = 10        # Seconds between retries

# ═══════════════════════════════════════════════════════════════
# Play Catalog (37 plays)
# ═══════════════════════════════════════════════════════════════

PLAYS = [
    # ── Tragedies ──
    {"title": "Romeo and Juliet",       "slug": "romeo-and-juliet",       "cat": "tragedies", "mit": "romeo_juliet",       "pg_id": 1513},
    {"title": "Hamlet",                 "slug": "hamlet",                  "cat": "tragedies", "mit": "hamlet",             "pg_id": 1524},
    {"title": "Macbeth",                "slug": "macbeth",                 "cat": "tragedies", "mit": "macbeth",            "pg_id": 1533},
    {"title": "Othello",                "slug": "othello",                 "cat": "tragedies", "mit": "othello",            "pg_id": 1531},
    {"title": "King Lear",              "slug": "king-lear",               "cat": "tragedies", "mit": "lear",               "pg_id": 1532},
    {"title": "Julius Caesar",          "slug": "julius-caesar",           "cat": "tragedies", "mit": "julius_caesar",      "pg_id": 1522},
    {"title": "Antony and Cleopatra",   "slug": "antony-and-cleopatra",    "cat": "tragedies", "mit": "antony",             "pg_id": 1534},
    {"title": "Coriolanus",             "slug": "coriolanus",              "cat": "tragedies", "mit": "coriolanus",         "pg_id": 1535},
    {"title": "Timon of Athens",        "slug": "timon-of-athens",         "cat": "tragedies", "mit": "timon",              "pg_id": 1536},
    {"title": "Titus Andronicus",       "slug": "titus-andronicus",        "cat": "tragedies", "mit": "titus_andronicus",   "pg_id": 1106},
    {"title": "Troilus and Cressida",   "slug": "troilus-and-cressida",    "cat": "tragedies", "mit": "troilus_cressida",   "pg_id": 1540},
    # ── Comedies ──
    {"title": "A Midsummer Night's Dream", "slug": "midsummer-nights-dream", "cat": "comedies", "mit": "midsummer",        "pg_id": 1514},
    {"title": "The Merchant of Venice", "slug": "merchant-of-venice",      "cat": "comedies", "mit": "merchant",           "pg_id": 1515},
    {"title": "Much Ado About Nothing", "slug": "much-ado-about-nothing",  "cat": "comedies", "mit": "much_ado",           "pg_id": 1519},
    {"title": "Twelfth Night",          "slug": "twelfth-night",           "cat": "comedies", "mit": "twelfth_night",      "pg_id": 1526},
    {"title": "As You Like It",         "slug": "as-you-like-it",          "cat": "comedies", "mit": "asyoulikeit",        "pg_id": 1523},
    {"title": "The Taming of the Shrew","slug": "taming-of-the-shrew",     "cat": "comedies", "mit": "taming_shrew",       "pg_id": 1508},
    {"title": "The Tempest",            "slug": "the-tempest",             "cat": "comedies", "mit": "tempest",            "pg_id": 23042},
    {"title": "The Comedy of Errors",   "slug": "comedy-of-errors",        "cat": "comedies", "mit": "comedy_errors",      "pg_id": 1504},
    {"title": "Love's Labour's Lost",   "slug": "loves-labours-lost",      "cat": "comedies", "mit": "loves_labours_lost", "pg_id": 1109},
    {"title": "Measure for Measure",    "slug": "measure-for-measure",     "cat": "comedies", "mit": "measure",            "pg_id": 1529},
    {"title": "The Merry Wives of Windsor", "slug": "merry-wives-of-windsor", "cat": "comedies", "mit": "merry_wives",    "pg_id": 1116},
    {"title": "Two Gentlemen of Verona","slug": "two-gentlemen-of-verona", "cat": "comedies", "mit": "two_gentlemen",      "pg_id": 1107},
    {"title": "All's Well That Ends Well", "slug": "alls-well-that-ends-well", "cat": "comedies", "mit": "alls_well",    "pg_id": 1528},
    # ── Romances ──
    {"title": "The Winter's Tale",      "slug": "winters-tale",            "cat": "romances", "mit": "winters_tale",       "pg_id": 1539},
    {"title": "Cymbeline",              "slug": "cymbeline",               "cat": "romances", "mit": "cymbeline",          "pg_id": 1537},
    {"title": "Pericles",               "slug": "pericles",                "cat": "romances", "mit": "pericles",           "pg_id": 1520},
    # ── Histories ──
    {"title": "Richard II",             "slug": "richard-ii",              "cat": "histories", "mit": "richardii",         "pg_id": 1503},
    {"title": "Henry IV, Part 1",       "slug": "henry-iv-part-1",         "cat": "histories", "mit": "1henryiv",          "pg_id": 1505},
    {"title": "Henry IV, Part 2",       "slug": "henry-iv-part-2",         "cat": "histories", "mit": "2henryiv",          "pg_id": 1112},
    {"title": "Henry V",                "slug": "henry-v",                 "cat": "histories", "mit": "henryv",            "pg_id": 1521},
    {"title": "Henry VI, Part 1",       "slug": "henry-vi-part-1",         "cat": "histories", "mit": "1henryvi",          "pg_id": 1110},
    {"title": "Henry VI, Part 2",       "slug": "henry-vi-part-2",         "cat": "histories", "mit": "2henryvi",          "pg_id": 1111},
    {"title": "Henry VI, Part 3",       "slug": "henry-vi-part-3",         "cat": "histories", "mit": "3henryvi",          "pg_id": 1113},
    {"title": "Richard III",            "slug": "richard-iii",             "cat": "histories", "mit": "richardiii",        "pg_id": 1503},
    {"title": "King John",              "slug": "king-john",               "cat": "histories", "mit": "john",              "pg_id": 1511},
    {"title": "Henry VIII",             "slug": "henry-viii",              "cat": "histories", "mit": "henryviii",         "pg_id": 1518},
]

# ═══════════════════════════════════════════════════════════════
# Logging
# ═══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
    ],
)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# Progress Management
# ═══════════════════════════════════════════════════════════════

_progress = {}
_progress_lock = threading.Lock()


def load_progress():
    global _progress
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            _progress = json.load(f)
    else:
        _progress = {
            "version": "1.0",
            "started": None,
            "last_seen": 0,
            "status": "pending",
            "completed_plays": [],
            "completed_scenes": {},
            "current_play": None,
            "current_act": None,
            "current_scene": None,
            "total_plays": len(PLAYS),
            "total_scenes_estimated": 740,
            "scenes_done": 0,
            "errors": [],
            "notes": "",
        }
    return _progress


def save_progress():
    with _progress_lock:
        with open(PROGRESS_FILE, "w") as f:
            json.dump(_progress, f, indent=2)


def heartbeat():
    """Update last_seen timestamp in progress file."""
    _progress["last_seen"] = time.time()
    save_progress()


def heartbeat_loop():
    """Background thread: write heartbeat every HEARTBEAT_SECS."""
    while True:
        time.sleep(HEARTBEAT_SECS)
        heartbeat()


def is_play_done(slug):
    return slug in _progress.get("completed_plays", [])


def is_scene_done(play_slug, act_num, scene_num):
    key = f"{play_slug}/act{act_num}/scene{scene_num}"
    return key in _progress.get("completed_scenes", {})


def mark_scene_done(play_slug, act_num, scene_num):
    key = f"{play_slug}/act{act_num}/scene{scene_num}"
    if "completed_scenes" not in _progress:
        _progress["completed_scenes"] = {}
    _progress["completed_scenes"][key] = int(time.time())
    _progress["scenes_done"] = len(_progress["completed_scenes"])
    heartbeat()


def mark_play_done(slug):
    if slug not in _progress["completed_plays"]:
        _progress["completed_plays"].append(slug)
    _progress["current_play"] = None
    _progress["current_act"] = None
    _progress["current_scene"] = None
    save_progress()


def log_error(msg):
    _progress["errors"].append({"time": int(time.time()), "msg": msg})
    if len(_progress["errors"]) > 100:
        _progress["errors"] = _progress["errors"][-100:]
    save_progress()
    log.error(msg)


# ═══════════════════════════════════════════════════════════════
# Lock File (prevent duplicate runs)
# ═══════════════════════════════════════════════════════════════

_lock_fh = None


def acquire_lock(force=False):
    global _lock_fh
    if LOCK_FILE.exists() and not force:
        try:
            pid = int(LOCK_FILE.read_text().strip())
            # Check if PID is alive
            os.kill(pid, 0)
            log.error(f"Builder already running with PID {pid}. Use --force to override.")
            return False
        except (ValueError, ProcessLookupError, PermissionError):
            pass  # PID is dead, take the lock
    LOCK_FILE.write_text(str(os.getpid()))
    return True


def release_lock():
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════
# Text Fetching
# ═══════════════════════════════════════════════════════════════

GUTENBERG_MIRRORS = [
    "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt",
    "https://gutenberg.pglaf.org/cache/epub/{id}/pg{id}.txt",
]

# MIT Shakespeare URL template
MIT_URL = "https://shakespeare.mit.edu/{mit}/full.html"

# Fallback: Folger Digital Texts raw text
FOLGER_URL = "https://shakespeare.folger.edu/downloads/txt/{slug}.txt"


def fetch_url(url, timeout=30):
    """Fetch URL with retry. Returns text or None."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SkillbookBuilder/1.0)"}
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp.text
            log.warning(f"HTTP {resp.status_code} for {url}")
        except Exception as e:
            log.warning(f"Fetch attempt {attempt+1} failed for {url}: {e}")
            time.sleep(5)
    return None


def strip_html(html_text):
    """Very basic HTML → plain text."""
    if not html_text:
        return ""
    # Remove script/style
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html_text, flags=re.DOTALL | re.IGNORECASE)
    # Stage directions in <blockquote> → preserve as [...]
    text = re.sub(r"<blockquote[^>]*>(.*?)</blockquote>", lambda m: "[" + m.group(1).strip() + "]", text, flags=re.DOTALL)
    # <br> → newline
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # <p>, <div>, <h*> → paragraph break
    text = re.sub(r"<(p|div|h[1-6])[^>]*>", "\n\n", text, flags=re.IGNORECASE)
    # Strip all remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode common HTML entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def get_play_text_from_cache(slug):
    cache_file = CACHE_DIR / f"{slug}.txt"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8")
    return None


def cache_play_text(slug, text):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{slug}.txt"
    cache_file.write_text(text, encoding="utf-8")


def fetch_play_text(play):
    """Fetch full play text. Tries MIT → Gutenberg → error."""
    slug = play["slug"]
    mit = play["mit"]
    pg_id = play["pg_id"]

    # Check cache first
    cached = get_play_text_from_cache(slug)
    if cached:
        log.info(f"[{play['title']}] Using cached text ({len(cached)} chars)")
        return cached

    # Try MIT Shakespeare
    url = MIT_URL.format(mit=mit)
    log.info(f"[{play['title']}] Fetching from MIT: {url}")
    html = fetch_url(url, timeout=30)
    if html and len(html) > 5000:
        text = strip_html(html)
        if len(text) > 3000:
            cache_play_text(slug, text)
            log.info(f"[{play['title']}] Got {len(text)} chars from MIT")
            return text

    # Try Project Gutenberg
    for mirror in GUTENBERG_MIRRORS:
        url = mirror.format(id=pg_id)
        log.info(f"[{play['title']}] Trying Gutenberg: {url}")
        text = fetch_url(url, timeout=60)
        if text and len(text) > 3000:
            # Strip Gutenberg header/footer
            text = strip_gutenberg(text)
            cache_play_text(slug, text)
            log.info(f"[{play['title']}] Got {len(text)} chars from Gutenberg")
            return text
        time.sleep(2)

    log.error(f"[{play['title']}] Failed to fetch play text from all sources")
    return None


def strip_gutenberg(text):
    """Remove Project Gutenberg header and footer."""
    # Find start of actual content
    start_markers = [
        "*** START OF THE PROJECT GUTENBERG",
        "***START OF THE PROJECT GUTENBERG",
        "THE PROJECT GUTENBERG EBOOK",
    ]
    end_markers = [
        "*** END OF THE PROJECT GUTENBERG",
        "***END OF THE PROJECT GUTENBERG",
        "End of Project Gutenberg",
    ]
    start_pos = 0
    for marker in start_markers:
        pos = text.find(marker)
        if pos != -1:
            # Find end of that line
            end_of_line = text.find("\n", pos)
            if end_of_line != -1:
                start_pos = end_of_line + 1
            break

    end_pos = len(text)
    for marker in end_markers:
        pos = text.find(marker)
        if pos != -1:
            end_pos = pos
            break

    return text[start_pos:end_pos].strip()


# ═══════════════════════════════════════════════════════════════
# Scene Parsing
# ═══════════════════════════════════════════════════════════════

def parse_scenes_from_text(play_text, play_title):
    """
    Parse a play text into scenes.
    Returns list of: {act_num, scene_num, scene_header, text}
    """
    scenes = []

    # Normalize line endings
    text = play_text.replace("\r\n", "\n").replace("\r", "\n")

    # Split on ACT boundaries
    # Patterns: "ACT I", "ACT 1", "ACT THE FIRST", etc.
    act_pattern = re.compile(
        r'\n\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5]|THE\s+\w+)\s*[\.\n]',
        re.IGNORECASE
    )
    scene_pattern = re.compile(
        r'\n\s*SCENE\s+(I{1,4}V?|V?I{0,4}|[0-9]+)\s*[\.\s]([^\n]*)',
        re.IGNORECASE
    )

    # Find all act positions
    act_matches = list(act_pattern.finditer(text))

    if not act_matches:
        # Try without newline prefix for some formats
        act_pattern2 = re.compile(r'^\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5])\b', re.IGNORECASE | re.MULTILINE)
        act_matches = list(act_pattern2.finditer(text))

    if not act_matches:
        log.warning(f"No ACT markers found in {play_title}, treating as single act")
        act_matches = []

    def roman_to_int(s):
        s = s.upper().strip()
        roman = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
        try:
            return int(s)
        except ValueError:
            pass
        result = 0
        prev = 0
        for ch in reversed(s):
            val = roman.get(ch, 0)
            if val < prev:
                result -= val
            else:
                result += val
            prev = val
        return result if result > 0 else 1

    def get_act_bounds():
        bounds = []
        for i, m in enumerate(act_matches):
            start = m.start()
            end = act_matches[i + 1].start() if i + 1 < len(act_matches) else len(text)
            act_num = roman_to_int(m.group(1))
            bounds.append((act_num, start, end, text[start:end]))
        if not bounds:
            bounds = [(1, 0, len(text), text)]
        return bounds

    for act_num, act_start, act_end, act_text in get_act_bounds():
        scene_matches = list(scene_pattern.finditer(act_text))
        if not scene_matches:
            # Single scene act
            scenes.append({
                "act_num": act_num,
                "scene_num": 1,
                "scene_header": f"Act {act_num}, Scene 1",
                "text": act_text.strip()
            })
            continue
        for j, sm in enumerate(scene_matches):
            scene_num = roman_to_int(sm.group(1))
            scene_loc = sm.group(2).strip() if sm.group(2) else ""
            sc_start = sm.start()
            sc_end = scene_matches[j + 1].start() if j + 1 < len(scene_matches) else len(act_text)
            scene_text = act_text[sc_start:sc_end].strip()
            scenes.append({
                "act_num": act_num,
                "scene_num": scene_num,
                "scene_header": f"Act {act_num}, Scene {scene_num}" + (f" — {scene_loc}" if scene_loc else ""),
                "scene_location_hint": scene_loc,
                "text": scene_text,
            })

    log.info(f"[{play_title}] Parsed {len(scenes)} scenes across {len(set(s['act_num'] for s in scenes))} acts")
    return scenes


# ═══════════════════════════════════════════════════════════════
# LMStudio / Minimax API
# ═══════════════════════════════════════════════════════════════

def call_minimax(prompt, system="You are a literary scholar building an AI-navigable Shakespeare reference."):
    """Call minimax via LMStudio. Returns response text or None."""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 2000,
        "temperature": 0.3,
    }
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(LMSTUDIO_URL, json=payload, timeout=API_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            if content:
                return content.strip()
        except requests.exceptions.Timeout:
            log.warning(f"LMStudio timeout (attempt {attempt+1}/{MAX_RETRIES})")
        except Exception as e:
            log.warning(f"LMStudio error (attempt {attempt+1}/{MAX_RETRIES}): {e}")
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY * (attempt + 1))
    return None


# ═══════════════════════════════════════════════════════════════
# Scene Page Generation
# ═══════════════════════════════════════════════════════════════

SCENE_PROMPT_TEMPLATE = """
You are building an AI-navigable skillbook for Shakespeare's Complete Works.
Your job: produce a richly searchable markdown page for ONE scene.

An AI agent should be able to ask:
  "What play has a guy who climbs out of a trunk next to a sleeping woman?"
  ...and find this page via keyword/semantic search.

Write the description with SPECIFIC physical actions, objects, plot beats,
and memorable moments. Include the kind of detail that makes scenes findable
even when someone describes them vaguely or in modern terms.

═══════════════════════════════
PLAY: {play_title} ({category})
{scene_header}
═══════════════════════════════

RAW SCENE TEXT:
{scene_text}

═══════════════════════════════

Generate this EXACT markdown structure (fill in all sections):

# {play_title}: {scene_header}

**Location:** [Specific place where scene occurs]
**Act:** {act_num} | **Scene:** {scene_num}

## Characters in This Scene
[Comma-separated list of characters who actually appear or speak]

## Action Summary
[Write 3-6 paragraphs of narrative description. Use plain modern language.
Include: what characters DO (physical actions), what they SAY (key exchanges),
what OBJECTS appear, what DECISIONS are made, what CONFLICTS occur.
This must be detailed enough that someone vaguely remembering the scene can find it.]

## Notable Events
[Bullet list of 5-10 specific memorable moments, actions, or revelations.
Be concrete: "Hamlet holds Yorick's skull", not "Hamlet reflects on death"]

## Characters' Goals
[Brief note on what each character wants in this scene]

## Tags
[Comma-separated semantic tags — include objects, actions, themes, emotions,
character types, settings. e.g.: trunk, hidden, sleeping woman, deception, night, bedroom]

## Key Lines
[2-4 most important or famous lines from this scene, with speaker]

## Navigation
- [← Previous](../act{act_num}-scene{prev_scene}.md)
- [→ Next](../act{act_num}-scene{next_scene}.md)
- [↑ {play_title}](../index.md)
- [↑ {category}](../../index.md)
- [↑ All Plays](../../../SKILL.md)
"""


def generate_scene_page(play, act_num, scene_num, scene_obj, all_scenes_in_act):
    """Generate a full markdown page for one scene using minimax."""
    title = play["title"]
    cat = play["cat"].title()

    # Truncate very long scenes to avoid context overflow (~4000 chars is usually enough)
    scene_text = scene_obj["text"]
    if len(scene_text) > 6000:
        scene_text = scene_text[:6000] + "\n\n[...scene continues...]"

    # Calculate prev/next scene numbers
    scenes_this_act = [s for s in all_scenes_in_act if s["act_num"] == act_num]
    idx = next((i for i, s in enumerate(scenes_this_act) if s["scene_num"] == scene_num), 0)
    prev_scene = scenes_this_act[idx - 1]["scene_num"] if idx > 0 else None
    next_scene = scenes_this_act[idx + 1]["scene_num"] if idx + 1 < len(scenes_this_act) else None

    prompt = SCENE_PROMPT_TEMPLATE.format(
        play_title=title,
        category=cat,
        scene_header=scene_obj["scene_header"],
        act_num=act_num,
        scene_num=scene_num,
        scene_text=scene_text,
        prev_scene=prev_scene if prev_scene else scene_num,
        next_scene=next_scene if next_scene else scene_num,
    )

    log.info(f"[{title}] Generating scene page: Act {act_num}, Scene {scene_num}...")
    result = call_minimax(prompt)
    if not result:
        log.error(f"[{title}] Failed to generate Act {act_num} Scene {scene_num}")
        return None

    # Strip any <think>...</think> chain-of-thought leakage from the model output
    result = re.sub(r"<think>.*?</think>", "", result, flags=re.DOTALL).strip()

    # Append the full original scene text as source material
    full_scene_text = scene_obj["text"]
    source_section = f"\n\n---\n\n## Source Text\n\n```\n{full_scene_text}\n```\n"
    return result + source_section


# ═══════════════════════════════════════════════════════════════
# Play Index Generation
# ═══════════════════════════════════════════════════════════════

PLAY_INDEX_PROMPT = """
You are building an AI-navigable Shakespeare reference skillbook.
Generate the index page for the play "{play_title}".

Information available:
- Category: {category}
- Number of acts: {num_acts}
- Scenes: {scene_list}

Write this EXACT markdown structure:

# {play_title}

**Category:** {category}
**Acts:** {num_acts} | **Total Scenes:** {num_scenes}

## One-Line Summary
[One sharp, specific sentence describing the play's core conflict]

## Synopsis
[3-5 paragraphs covering the full arc of the play. Include: setup, major turning points,
climax, resolution. Name specific characters and events. Be detailed enough that
an agent can understand the whole story from this summary.]

## Dramatis Personae
[For each significant character: Name — their role and brief description]

## Notable Scenes
[List 5-10 scenes worth highlighting with: Act/Scene number, brief description of what happens.
Include the most famous, dramatic, or unusual scenes.]

## Themes
[5-8 key themes as a bulleted list]

## Tags
[Comma-separated tags for the whole play]

## Acts and Scenes
{act_scene_links}

## Navigation
- [← Back to {category}](../index.md)
- [↑ All Plays](../../SKILL.md)
"""


def generate_play_index(play, all_scenes):
    """Generate the play's index.md."""
    title = play["title"]
    cat = play["cat"].title()
    acts = sorted(set(s["act_num"] for s in all_scenes))
    num_acts = len(acts)
    num_scenes = len(all_scenes)

    scene_list = ", ".join(f"Act {s['act_num']} Scene {s['scene_num']}" for s in all_scenes[:20])
    if len(all_scenes) > 20:
        scene_list += f"... ({num_scenes} total)"

    act_scene_links = []
    for act_num in acts:
        scenes_this_act = [s for s in all_scenes if s["act_num"] == act_num]
        act_scene_links.append(f"\n### Act {act_num}")
        for s in scenes_this_act:
            fn = f"act{act_num}-scene{s['scene_num']}.md"
            loc = s.get("scene_location_hint", "")
            act_scene_links.append(f"- [Scene {s['scene_num']}: {loc}]({fn})" if loc else f"- [Scene {s['scene_num']}]({fn})")

    prompt = PLAY_INDEX_PROMPT.format(
        play_title=title,
        category=cat,
        num_acts=num_acts,
        num_scenes=num_scenes,
        scene_list=scene_list,
        act_scene_links="\n".join(act_scene_links),
    )

    log.info(f"[{title}] Generating play index...")
    result = call_minimax(prompt)
    return result


# ═══════════════════════════════════════════════════════════════
# File Writing
# ═══════════════════════════════════════════════════════════════

def get_play_dir(play):
    return BASE_DIR / play["cat"] / play["slug"]


def write_scene_file(play, act_num, scene_num, content):
    play_dir = get_play_dir(play)
    play_dir.mkdir(parents=True, exist_ok=True)
    fname = play_dir / f"act{act_num}-scene{scene_num}.md"
    fname.write_text(content, encoding="utf-8")
    log.info(f"[{play['title']}] Wrote {fname.name}")


def write_play_index(play, content):
    play_dir = get_play_dir(play)
    play_dir.mkdir(parents=True, exist_ok=True)
    (play_dir / "index.md").write_text(content, encoding="utf-8")
    log.info(f"[{play['title']}] Wrote index.md")


# ═══════════════════════════════════════════════════════════════
# Category and Global Indexes
# ═══════════════════════════════════════════════════════════════

def build_category_index(category, plays_in_cat):
    """Write category index.md with links to all plays."""
    cat_dir = BASE_DIR / category
    cat_dir.mkdir(parents=True, exist_ok=True)
    lines = [f"# Shakespeare's {category.title()}\n"]
    lines.append(f"| Play | Summary |\n|------|---------|")
    for p in plays_in_cat:
        play_dir = f"{p['slug']}/index.md"
        lines.append(f"| [{p['title']}]({play_dir}) | |")
    lines.append(f"\n[↑ All Plays](../SKILL.md)")
    (cat_dir / "index.md").write_text("\n".join(lines), encoding="utf-8")


def build_scene_descriptions_index():
    """
    Aggregate a searchable list of scene descriptions across all plays.
    This is what makes "what play has a guy in a trunk?" work.
    """
    log.info("Building global scene-descriptions index...")

    # Collect all Notable Events sections from all scene files
    index_lines = [
        "# Scene Descriptions Index",
        "",
        "Searchable plain-English descriptions of every notable scene in Shakespeare.",
        "Use this page to find scenes by describing what happens.",
        "",
        "---",
        "",
    ]

    for play in PLAYS:
        play_dir = get_play_dir(play)
        if not play_dir.exists():
            continue
        for scene_file in sorted(play_dir.glob("act*-scene*.md")):
            content = scene_file.read_text(encoding="utf-8")
            # Extract Notable Events section
            match = re.search(r"## Notable Events\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
            if match:
                events_text = match.group(1).strip()
                # Also get the header
                header_match = re.search(r"^# (.+)$", content, re.MULTILINE)
                header = header_match.group(1) if header_match else scene_file.stem
                rel_path = f"../{play['cat']}/{play['slug']}/{scene_file.name}"
                index_lines.append(f"### [{header}]({rel_path})")
                index_lines.append(events_text)
                index_lines.append("")

    index_dir = BASE_DIR / "index"
    index_dir.mkdir(parents=True, exist_ok=True)
    (index_dir / "scene-descriptions.md").write_text(
        "\n".join(index_lines), encoding="utf-8"
    )
    log.info("Scene descriptions index written.")


def build_all_plays_index():
    """Write index/all-plays.md"""
    lines = ["# All Shakespeare Plays\n"]
    for cat in ["tragedies", "comedies", "romances", "histories"]:
        cat_plays = [p for p in PLAYS if p["cat"] == cat]
        lines.append(f"\n## {cat.title()}\n")
        for p in cat_plays:
            done = is_play_done(p["slug"])
            status = "✅" if done else "🔄"
            lines.append(f"- {status} [{p['title']}](../{cat}/{p['slug']}/index.md)")
    (BASE_DIR / "index" / "all-plays.md").write_text("\n".join(lines), encoding="utf-8")


# ═══════════════════════════════════════════════════════════════
# Main Build Loop
# ═══════════════════════════════════════════════════════════════

def process_play(play):
    """Process a single play: fetch, parse, generate all scene pages + index."""
    title = play["title"]
    slug = play["slug"]

    if is_play_done(slug):
        log.info(f"[{title}] Already complete. Skipping.")
        return True

    _progress["current_play"] = slug
    heartbeat()

    # Fetch play text
    play_text = fetch_play_text(play)
    if not play_text:
        log_error(f"[{title}] Could not fetch play text. Skipping for now.")
        return False

    # Parse scenes
    all_scenes = parse_scenes_from_text(play_text, title)
    if not all_scenes:
        log_error(f"[{title}] No scenes parsed. Skipping.")
        return False

    # Process each scene
    for scene in all_scenes:
        act_num = scene["act_num"]
        sc_num = scene["scene_num"]

        if is_scene_done(slug, act_num, sc_num):
            log.info(f"[{title}] Act {act_num} Scene {sc_num} already done. Skipping.")
            continue

        _progress["current_act"] = act_num
        _progress["current_scene"] = sc_num
        heartbeat()

        content = generate_scene_page(play, act_num, sc_num, scene, all_scenes)
        if content:
            write_scene_file(play, act_num, sc_num, content)
            mark_scene_done(slug, act_num, sc_num)
        else:
            log_error(f"[{title}] Act {act_num} Scene {sc_num}: generation failed, will retry next run")
            # Don't mark done, will retry

        # Brief pause to not overwhelm LMStudio
        time.sleep(2)

    # Generate play index
    play_index_path = get_play_dir(play) / "index.md"
    if not play_index_path.exists():
        index_content = generate_play_index(play, all_scenes)
        if index_content:
            write_play_index(play, index_content)

    mark_play_done(slug)
    log.info(f"[{title}] ✅ Complete! ({len(_progress['completed_plays'])}/{len(PLAYS)} plays done)")
    return True


def run_build():
    """Main build loop — processes all plays in order."""
    load_progress()

    if _progress.get("status") == "complete":
        log.info("Build already complete! Nothing to do.")
        return

    if not _progress.get("started"):
        _progress["started"] = datetime.now(timezone.utc).isoformat()
    _progress["status"] = "building"
    save_progress()

    # Ensure index directory exists
    (BASE_DIR / "index").mkdir(parents=True, exist_ok=True)

    # Build category indexes first (static)
    for cat in ["tragedies", "comedies", "romances", "histories"]:
        cat_plays = [p for p in PLAYS if p["cat"] == cat]
        build_category_index(cat, cat_plays)

    # Process all plays
    for play in PLAYS:
        if is_play_done(play["slug"]):
            continue

        success = process_play(play)
        if not success:
            log.warning(f"[{play['title']}] Skipped due to error. Continuing with next play.")

        # Update all-plays index periodically
        build_all_plays_index()

    # Final pass: check for any missed scenes
    missed = []
    for play in PLAYS:
        if not is_play_done(play["slug"]):
            missed.append(play["slug"])

    if missed:
        log.warning(f"Some plays incomplete: {missed}")
        _progress["status"] = "partial"
    else:
        log.info("🎉 ALL PLAYS COMPLETE! Building final indexes...")
        _progress["status"] = "complete"
        build_scene_descriptions_index()
        build_all_plays_index()

    save_progress()
    log.info(f"Build {'complete' if not missed else 'partial'}. Scenes done: {_progress['scenes_done']}")


# ═══════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════

def main():
    force = "--force" in sys.argv
    status_only = "--status" in sys.argv

    if status_only:
        load_progress()
        print(json.dumps(_progress, indent=2))
        return

    log.info("═" * 60)
    log.info("Shakespeare Skillbook Builder starting...")
    log.info(f"Base dir: {BASE_DIR}")
    log.info(f"LMStudio: {LMSTUDIO_URL}")
    log.info(f"Model: {MODEL}")
    log.info("═" * 60)

    if not acquire_lock(force=force):
        sys.exit(1)

    # Start heartbeat thread
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    # Handle clean shutdown
    def on_signal(sig, frame):
        log.info(f"Signal {sig} received. Saving progress and exiting...")
        save_progress()
        release_lock()
        sys.exit(0)

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    try:
        run_build()
    except Exception as e:
        log.exception(f"Fatal error in build: {e}")
        log_error(f"Fatal: {e}")
    finally:
        save_progress()
        release_lock()
        log.info("Builder exited.")


if __name__ == "__main__":
    main()
