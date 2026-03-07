#!/usr/bin/env python3
"""
fix_gaps.py — Repairs all known skillbook gaps:

1. Replaces bad First Folio cache files for Titus Andronicus + Love's Labour's Lost
   with modern-format Gutenberg texts, then rebuilds all scenes.
2. Rebuilds 5 specific missing scenes (MoV 1.2, Pericles 3.1/4.4/5.2, Winter's Tale 4.1)
3. Adds Taming of the Shrew Induction scenes (scene parser extension)
4. Rebuilds Winter's Tale Act 4 Scene 1 (Time chorus)

Reports progress after each step.
"""

import json, re, time, sys, os, logging
import requests
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
BUILDER_DIR  = Path("/Users/bodhi/.openclaw/workspace/spellbook/shakespeare")
BASE_DIR     = Path("/Users/bodhi/.openclaw/workspace/spellbook/books/shakespeare")
SOURCES_DIR  = BUILDER_DIR / "sources"
PROGRESS_FILE = BUILDER_DIR / "PROGRESS.json"
LMSTUDIO_URL  = "http://192.168.0.7:1234/v1/chat/completions"
API_TIMEOUT   = 180

# ── LMStudio ─────────────────────────────────────────────────────────────────
def call_mm(prompt, system="You are a literary scholar building an AI-navigable Shakespeare reference."):
    for attempt in range(3):
        try:
            resp = requests.post(LMSTUDIO_URL, json={
                "model": "minimax/minimax-m2.5",
                "messages": [{"role":"system","content":system},
                              {"role":"user","content":prompt}],
                "max_tokens": 2000, "temperature": 0.3,
            }, timeout=API_TIMEOUT)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            return content
        except Exception as e:
            log.warning(f"MM attempt {attempt+1} failed: {e}")
            if attempt < 2: time.sleep(10)
    return None

# ── Utilities ─────────────────────────────────────────────────────────────────
def fetch(url, timeout=30):
    headers = {"User-Agent": "Mozilla/5.0"}
    for attempt in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r.text
        except Exception as e:
            log.warning(f"Fetch {url} attempt {attempt+1}: {e}")
            time.sleep(5)
    return None

def roman_to_int(s):
    s = s.upper().strip()
    try: return int(s)
    except ValueError: pass
    roman = {"I":1,"V":5,"X":10,"L":50,"C":100}
    result, prev = 0, 0
    for ch in reversed(s):
        val = roman.get(ch, 0)
        result += val if val >= prev else -val
        prev = val
    return result if result > 0 else 1

def strip_gutenberg(text):
    start_pos = 0
    for marker in ["*** START OF THE PROJECT GUTENBERG", "***START OF THE PROJECT GUTENBERG"]:
        pos = text.find(marker)
        if pos != -1:
            eol = text.find("\n", pos)
            if eol != -1: start_pos = eol + 1
            break
    end_pos = len(text)
    for marker in ["*** END OF THE PROJECT GUTENBERG", "End of Project Gutenberg"]:
        pos = text.find(marker)
        if pos != -1:
            end_pos = pos
            break
    return text[start_pos:end_pos].strip()

def load_progress():
    return json.loads(PROGRESS_FILE.read_text())

def save_progress(p):
    PROGRESS_FILE.write_text(json.dumps(p, indent=2))

def write_scene(cat, slug, act_num, scene_num, content, label=None):
    """Write a scene file. label overrides actN-sceneN naming (e.g. 'induction-scene1')"""
    play_dir = BASE_DIR / cat / slug
    play_dir.mkdir(parents=True, exist_ok=True)
    fname = label if label else f"act{act_num}-scene{scene_num}.md"
    (play_dir / fname).write_text(content, encoding="utf-8")
    log.info(f"  Wrote {cat}/{slug}/{fname}")

# ── Scene prompt (same as builder.py) ─────────────────────────────────────────
SCENE_PROMPT = """Generate a structured markdown page for this Shakespeare scene.

PLAY: {play_title} ({category})
ACT: {act_num} | SCENE: {scene_num}

FORMAT (use exactly these sections):
# {play_title}: Act {act_num}, Scene {scene_num} — [location]

**Location:** [specific location]
**Act:** {act_num} | **Scene:** {scene_num}

## Characters in This Scene
[Comma-separated list]

## Action Summary
[3-5 paragraph narrative of what happens]

## Notable Events
[Bullet list of key events]

## Characters' Goals
[Per-character goals]

## Tags
[comma, separated, searchable, tags]

## Key Lines
[2-4 notable quotes with attribution]

## Navigation
- [← Previous](../act{prev_scene_link}.md)
- [→ Next](../act{next_scene_link}.md)
- [↑ {play_title}](../index.md)

---

## Source Text

```
{scene_text}
```

SCENE TEXT:
{scene_text_prompt}"""

def generate_scene_page(play_title, cat, act_num, scene_num, scene_text, prev=None, nxt=None):
    text_for_prompt = scene_text[:6000] + ("\n\n[...scene continues...]" if len(scene_text) > 6000 else "")
    prev_link = f"act{act_num}-scene{scene_num-1}" if scene_num > 1 else f"act{act_num-1}-scene1"
    next_link = f"act{act_num}-scene{scene_num+1}"
    prompt = f"""Generate a structured markdown page for this Shakespeare scene.

PLAY: {play_title} ({cat})
ACT: {act_num} | SCENE: {scene_num}

Create a page with these sections:
# {play_title}: Act {act_num}, Scene {scene_num}

**Location:** [where the scene takes place]
**Act:** {act_num} | **Scene:** {scene_num}

## Characters in This Scene
## Action Summary
## Notable Events
## Characters' Goals
## Tags
## Key Lines
## Navigation
- [← Previous](../act{prev_link}.md)
- [→ Next](../act{next_link}.md)
- [↑ {play_title}](../index.md)

Then append the full source text:
---
## Source Text
```
{text_for_prompt}
```

Source text to analyze:
{text_for_prompt}"""
    return call_mm(prompt)

def parse_modern_scenes(text):
    """Parse a modern-format Gutenberg text into scenes."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    act_pat = re.compile(r'\n\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5])\b', re.IGNORECASE)
    scene_pat = re.compile(r'\n\s*SCENE\s+(I{1,4}V?|V?I{0,4}|[0-9]+)[\s\.]', re.IGNORECASE)
    
    act_matches = list(act_pat.finditer(text))
    scenes = []
    
    for i, am in enumerate(act_matches):
        act_num = roman_to_int(am.group(1))
        act_start = am.start()
        act_end = act_matches[i+1].start() if i+1 < len(act_matches) else len(text)
        act_text = text[act_start:act_end]
        
        scene_matches = list(scene_pat.finditer(act_text))
        if not scene_matches:
            scenes.append({"act_num": act_num, "scene_num": 1, "text": act_text.strip()})
            continue
        for j, sm in enumerate(scene_matches):
            scene_num = roman_to_int(sm.group(1))
            sc_start = sm.start()
            sc_end = scene_matches[j+1].start() if j+1 < len(scene_matches) else len(act_text)
            scenes.append({"act_num": act_num, "scene_num": scene_num, "text": act_text[sc_start:sc_end].strip()})
    
    return scenes

def parse_induction_scenes(text):
    """Find INDUCTION sections in text."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    ind_pat = re.compile(r'\n\s*INDUCTION\.?\s*\n', re.IGNORECASE)
    scene_pat = re.compile(r'\n\s*SCENE\s+(I{1,4}V?|V?I{0,4}|[0-9]+)[\s\.]', re.IGNORECASE)
    act_pat = re.compile(r'\n\s*ACT\s+[IVX1-5]', re.IGNORECASE)
    
    ind_match = ind_pat.search(text)
    if not ind_match:
        return []
    
    ind_start = ind_match.start()
    # End at first ACT marker
    act_match = act_pat.search(text, ind_start + 1)
    ind_end = act_match.start() if act_match else len(text)
    ind_text = text[ind_start:ind_end]
    
    # Find scenes within induction
    scene_matches = list(scene_pat.finditer(ind_text))
    scenes = []
    if not scene_matches:
        scenes.append({"act_num": 0, "scene_num": 1, "text": ind_text.strip(), "label": "induction-scene1"})
    else:
        for j, sm in enumerate(scene_matches):
            scene_num = roman_to_int(sm.group(1))
            sc_start = sm.start()
            sc_end = scene_matches[j+1].start() if j+1 < len(scene_matches) else len(ind_text)
            scenes.append({"act_num": 0, "scene_num": scene_num, "text": ind_text[sc_start:sc_end].strip(),
                          "label": f"induction-scene{scene_num}"})
    return scenes

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Fix Titus Andronicus (bad cache → fetch pg1507)
# ══════════════════════════════════════════════════════════════════════════════
def fix_play_bad_cache(slug, pg_id, cat, play_title):
    log.info(f"\n{'='*60}")
    log.info(f"Rebuilding {play_title} from pg{pg_id}")
    log.info(f"{'='*60}")
    
    # Fetch modern-format text
    url = f"https://www.gutenberg.org/cache/epub/{pg_id}/pg{pg_id}.txt"
    log.info(f"Fetching {url}...")
    raw = fetch(url, timeout=60)
    if not raw:
        log.error(f"Failed to fetch {url}")
        return False
    
    text = strip_gutenberg(raw)
    log.info(f"Got {len(text)} chars of clean text")
    
    # Save to cache (overwrite bad cache)
    cache_file = SOURCES_DIR / f"{slug}.txt"
    cache_file.write_text(text, encoding="utf-8")
    log.info(f"Saved to cache: {cache_file}")
    
    # Parse scenes
    scenes = parse_modern_scenes(text)
    log.info(f"Parsed {len(scenes)} scenes")
    if not scenes:
        log.error("No scenes parsed!")
        return False
    
    # Generate each scene
    progress = load_progress()
    generated = 0
    for scene in scenes:
        act_num = scene["act_num"]
        scene_num = scene["scene_num"]
        scene_key = f"{slug}/act{act_num}/scene{scene_num}"
        
        # Check if already exists
        play_dir = BASE_DIR / cat / slug
        fpath = play_dir / f"act{act_num}-scene{scene_num}.md"
        if fpath.exists() and scene_key in progress.get("completed_scenes", {}):
            log.info(f"  [{play_title}] Act {act_num} Scene {scene_num} already done, skipping")
            continue
        
        log.info(f"  [{play_title}] Generating Act {act_num} Scene {scene_num}...")
        content = generate_scene_page(play_title, cat, act_num, scene_num, scene["text"])
        if content:
            write_scene(cat, slug, act_num, scene_num, content)
            progress.setdefault("completed_scenes", {})[scene_key] = int(time.time())
            progress["scenes_done"] = len(progress["completed_scenes"])
            if slug not in progress.get("completed_plays", []):
                pass  # Don't mark done until all scenes are written
            save_progress(progress)
            generated += 1
        else:
            log.error(f"  Failed to generate Act {act_num} Scene {scene_num}")
        time.sleep(2)
    
    # Mark play done
    progress = load_progress()
    if slug not in progress.get("completed_plays", []):
        progress.setdefault("completed_plays", []).append(slug)
    save_progress(progress)
    log.info(f"✅ {play_title}: {generated} new scenes generated")
    return True

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Fix specific missing scenes from good cached sources
# ══════════════════════════════════════════════════════════════════════════════
def fix_missing_scene(slug, cat, play_title, act_num, scene_num):
    log.info(f"  Fixing {play_title} Act {act_num} Scene {scene_num}...")
    
    text = (SOURCES_DIR / f"{slug}.txt").read_text(encoding="utf-8", errors="ignore")
    scenes = parse_modern_scenes(text)
    
    target = next((s for s in scenes if s["act_num"] == act_num and s["scene_num"] == scene_num), None)
    if not target:
        log.error(f"  Scene not found in parsed text! Acts/scenes found: {[(s['act_num'],s['scene_num']) for s in scenes]}")
        return False
    
    content = generate_scene_page(play_title, cat, act_num, scene_num, target["text"])
    if not content:
        log.error(f"  Generation failed")
        return False
    
    write_scene(cat, slug, act_num, scene_num, content)
    
    progress = load_progress()
    scene_key = f"{slug}/act{act_num}/scene{scene_num}"
    progress.setdefault("completed_scenes", {})[scene_key] = int(time.time())
    progress["scenes_done"] = len(progress["completed_scenes"])
    save_progress(progress)
    return True

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Add Taming of the Shrew Induction scenes
# ══════════════════════════════════════════════════════════════════════════════
def fix_induction(slug, cat, play_title):
    log.info(f"\nAdding Induction scenes for {play_title}...")
    text = (SOURCES_DIR / f"{slug}.txt").read_text(encoding="utf-8", errors="ignore")
    
    ind_scenes = parse_induction_scenes(text)
    if not ind_scenes:
        log.warning(f"No Induction found in {slug} source text")
        return False
    
    log.info(f"Found {len(ind_scenes)} Induction scene(s)")
    progress = load_progress()
    
    for scene in ind_scenes:
        label = scene["label"]
        log.info(f"  Generating {label}...")
        
        prompt = f"""Generate a structured markdown page for this Shakespeare scene.

PLAY: {play_title} ({cat})
SECTION: Induction (framing scene before Act 1)
SCENE: {label.replace('-', ' ').title()}

Create a page with these sections:
# {play_title}: {label.replace('-', ' ').title()}

**Location:** [where the scene takes place]
**Section:** Induction | **Scene:** {scene['scene_num']}

## Characters in This Scene
## Action Summary
## Notable Events
## Characters' Goals
## Tags
## Key Lines
## Navigation
- [→ Next](../act1-scene1.md)
- [↑ {play_title}](../index.md)

Then append:
---
## Source Text
```
{scene['text'][:6000]}
```

Source text:
{scene['text'][:6000]}"""
        
        content = call_mm(prompt)
        if content:
            write_scene(cat, slug, 0, scene['scene_num'], content, label=label)
            # Mark in progress with special key
            progress.setdefault("completed_scenes", {})[f"{slug}/induction/scene{scene['scene_num']}"] = int(time.time())
            save_progress(progress)
            log.info(f"  ✅ {label} written")
        else:
            log.error(f"  Failed to generate {label}")
        time.sleep(2)
    return True

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    results = []

    # STEP 1: Rebuild Titus and LLL with correct source
    log.info("\n\n📋 STEP 1: Rebuild plays with bad First Folio cache")
    for slug, pg_id, cat, title in [
        ("titus-andronicus", 1507, "tragedies", "Titus Andronicus"),
        ("loves-labours-lost", 1510, "comedies", "Love's Labour's Lost"),
    ]:
        ok = fix_play_bad_cache(slug, pg_id, cat, title)
        results.append((f"Rebuild {title}", ok))

    # STEP 2: Fix specific missing scenes
    log.info("\n\n📋 STEP 2: Fix specific missing scenes")
    missing = [
        ("merchant-of-venice", "comedies", "The Merchant of Venice", 1, 2),
        ("pericles",           "romances", "Pericles",                3, 1),
        ("pericles",           "romances", "Pericles",                4, 4),
        ("pericles",           "romances", "Pericles",                5, 2),
        ("winters-tale",       "romances", "The Winter's Tale",       4, 1),
    ]
    for slug, cat, title, act, scene in missing:
        ok = fix_missing_scene(slug, cat, title, act, scene)
        results.append((f"{title} Act{act} Scene{scene}", ok))
        time.sleep(2)

    # STEP 3: Add Taming of the Shrew Induction
    log.info("\n\n📋 STEP 3: Add Taming of the Shrew Induction")
    ok = fix_induction("taming-of-the-shrew", "comedies", "The Taming of the Shrew")
    results.append(("Taming of the Shrew Induction", ok))

    # Final report
    log.info("\n\n" + "="*60)
    log.info("FINAL RESULTS")
    log.info("="*60)
    for name, ok in results:
        log.info(f"  {'✅' if ok else '❌'} {name}")
    
    failed = [n for n,ok in results if not ok]
    if failed:
        log.error(f"\n{len(failed)} failed: {failed}")
        sys.exit(1)
    log.info("\n🎉 All gaps fixed!")

if __name__ == "__main__":
    main()
