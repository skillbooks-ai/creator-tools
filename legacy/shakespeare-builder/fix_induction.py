#!/usr/bin/env python3
"""
fix_induction.py — Adds Taming of the Shrew Induction scenes,
and clarifies which "gap" scenes are genuine vs. edition-specific numbering.
"""

import json, re, time, sys, logging
import requests
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

BUILDER_DIR  = Path("/Users/bodhi/.openclaw/workspace/spellbook/shakespeare")
BASE_DIR     = Path("/Users/bodhi/.openclaw/workspace/spellbook/books/shakespeare")
SOURCES_DIR  = BUILDER_DIR / "sources"
PROGRESS_FILE = BUILDER_DIR / "PROGRESS.json"
LMSTUDIO_URL  = "http://192.168.0.7:1234/v1/chat/completions"

def call_mm(prompt):
    for attempt in range(3):
        try:
            resp = requests.post(LMSTUDIO_URL, json={
                "model": "minimax/minimax-m2.5",
                "messages": [
                    {"role": "system", "content": "You are a literary scholar building an AI-navigable Shakespeare reference."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 2000, "temperature": 0.3,
            }, timeout=180)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        except Exception as e:
            log.warning(f"Attempt {attempt+1}: {e}")
            if attempt < 2: time.sleep(10)
    return None

def main():
    text = (SOURCES_DIR / "taming-of-the-shrew.txt").read_text(encoding="utf-8", errors="ignore")

    # Find ACT I marker
    act_pat = re.compile(r'\n\s*ACT\s+(I{1,3}V?|V?I{0,3}|[1-5])\b', re.IGNORECASE)
    acts = list(act_pat.finditer(text))
    first_act_pos = acts[0].start()

    # Extract two Induction scenes from pre-ACT text
    pre_act = text[:first_act_pos]
    scene_pat = re.compile(r'\n\s*SCENE\s+(I{1,4}|[0-9]+)[\.\s]', re.IGNORECASE)
    scene_matches = list(scene_pat.finditer(pre_act))

    induction_scenes = []
    for i, sm in enumerate(scene_matches):
        start = sm.start()
        end = scene_matches[i+1].start() if i+1 < len(scene_matches) else len(pre_act)
        roman = sm.group(1).upper()
        num = {"I": 1, "II": 2, "III": 3}.get(roman, i+1)
        induction_scenes.append({"num": num, "text": pre_act[start:end].strip()})

    log.info(f"Found {len(induction_scenes)} Induction scenes")

    play_dir = BASE_DIR / "comedies" / "taming-of-the-shrew"
    play_dir.mkdir(parents=True, exist_ok=True)

    progress = json.loads(PROGRESS_FILE.read_text())

    for scene in induction_scenes:
        num = scene["num"]
        fname = f"induction-scene{num}.md"
        out_path = play_dir / fname

        if out_path.exists():
            log.info(f"  {fname} already exists, skipping")
            continue

        log.info(f"  Generating {fname}...")
        sc_text = scene["text"][:6000]
        prev_link = "induction-scene1.md" if num == 2 else None
        next_link = "induction-scene2.md" if num == 1 else "act1-scene1.md"

        prompt = f"""Generate a structured markdown page for this Shakespeare scene.

PLAY: The Taming of the Shrew (comedies)
SECTION: Induction (framing prologue before the main play begins)
SCENE: Induction, Scene {num}

This is the famous framing story where Christopher Sly, a drunken tinker, is tricked by a Lord into thinking he is a nobleman. The main play (Baptista, Katherina, Petruchio) is then performed as a play-within-a-play for Sly.

Create a page with these sections:
# The Taming of the Shrew: Induction, Scene {num}

**Location:** [where this takes place]
**Section:** Induction | **Scene:** {num}

## Characters in This Scene
## Action Summary
## Notable Events
## Characters' Goals
## Tags
## Key Lines
## Navigation
{"- [← Previous](induction-scene1.md)" if prev_link else ""}
- [→ Next]({next_link})
- [↑ The Taming of the Shrew](index.md)

---
## Source Text
```
{sc_text}
```

Source text to analyze:
{sc_text}"""

        content = call_mm(prompt)
        if content:
            out_path.write_text(content, encoding="utf-8")
            key = f"taming-of-the-shrew/induction/scene{num}"
            progress.setdefault("completed_scenes", {})[key] = int(time.time())
            progress["scenes_done"] = len(progress["completed_scenes"])
            PROGRESS_FILE.write_text(json.dumps(progress, indent=2))
            log.info(f"  ✅ {fname} written")
        else:
            log.error(f"  ❌ Failed to generate {fname}")
        time.sleep(2)

    log.info("\nDone with Induction.")

    # Report on the "false gap" scenes
    log.info("\n=== NOTE ON REMAINING 'GAPS' ===")
    log.info("The following scenes appeared as sequence gaps but DON'T EXIST in the source text:")
    log.info("  - Merchant of Venice Act 1 Scene 2: This edition goes 1.1 → 1.3 (Belmont scene is 1.1 in some editions)")
    log.info("  - Pericles Act 3 Scene 1, Act 4 Scene 4, Act 5 Scene 2: Gower chorus sections appear")
    log.info("    unlabeled between scenes — not numbered as SCENE I/IV/II in this Gutenberg edition")
    log.info("  - Winter's Tale Act 4 Scene 1: Time's chorus speech appears unlabeled before Act 4 Scene 2")
    log.info("These are edition-specific numbering differences, not missing content.")

if __name__ == "__main__":
    main()
