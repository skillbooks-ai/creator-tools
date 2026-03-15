#!/usr/bin/env bash
# index.sh — Build TAG-INDEX.json and regenerate SKILL.md Table of Contents
# Usage: skillbook index /path/to/my-book [--tags-only] [--toc-only] [--dry-run]

set -euo pipefail

BOOK_PATH="${1:?Usage: skillbook index /path/to/my-book [--tags-only] [--toc-only] [--dry-run]}"
BOOK_PATH="${BOOK_PATH%/}"
shift || true

TAGS_ONLY=false
TOC_ONLY=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --tags-only) TAGS_ONLY=true ;;
    --toc-only)  TOC_ONLY=true ;;
    --dry-run)   DRY_RUN=true ;;
    --help|-h)
      echo "Usage: skillbook index /path/to/my-book [--tags-only] [--toc-only] [--dry-run]"
      exit 0
      ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Resolve to absolute path for Python
BOOK_PATH_ABS="$(cd "$BOOK_PATH" && pwd)"

echo "═══════════════════════════════════════════"
echo "  Skillbook Indexer v1.1"
echo "  Book: $BOOK_PATH"
echo "═══════════════════════════════════════════"
echo ""

# ─── Build TAG-INDEX.json ──────────────────────
if [[ "$TOC_ONLY" != "true" ]]; then
  echo "🏷️  Building TAG-INDEX.json..."
  echo ""

  export _IDX_BOOK="$BOOK_PATH_ABS"
  export _IDX_DRY="$DRY_RUN"
  python3 << 'PYTAGS'
import os, re, json
from pathlib import Path

book_path = Path(os.environ['_IDX_BOOK'])
dry_run = os.environ['_IDX_DRY'] == "true"
output_path = book_path / "TAG-INDEX.json"
SKIP_DIRS = {'sources', '.verify', '.git', 'node_modules', '_build'}

tag_index = {}
tagged_files = 0
total_tags = 0

def extract_tags(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return []
    if not content.startswith('---'):
        return []
    end = content.find('---', 3)
    if end == -1:
        return []
    frontmatter = content[3:end]
    for line in frontmatter.split('\n'):
        line = line.strip()
        if line.startswith('tags:'):
            tag_str = line[5:].strip()
            if tag_str.startswith('['):
                tag_str = tag_str.strip('[]')
                return [t.strip().strip('"').strip("'") for t in tag_str.split(',') if t.strip()]
            elif tag_str:
                return [tag_str.strip('"').strip("'")]
    return []

for root, dirs, files in os.walk(book_path):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    rel_root = os.path.relpath(root, book_path)
    if rel_root != '.' and not re.match(r'^\d{2}-', rel_root.split(os.sep)[0]):
        continue
    for fname in sorted(files):
        if not fname.endswith('.md'):
            continue
        filepath = os.path.join(root, fname)
        tags = extract_tags(filepath)
        if tags:
            tagged_files += 1
            rel_path = os.path.relpath(filepath, book_path)
            for tag in tags:
                tag = tag.lower().strip()
                if not tag:
                    continue
                total_tags += 1
                tag_index.setdefault(tag, []).append(rel_path)

sorted_index = {tag: sorted(tag_index[tag]) for tag in sorted(tag_index)}

print(f"  📊 {tagged_files} files with tags")
print(f"  🏷️  {len(sorted_index)} unique tags, {total_tags} total entries")

if not sorted_index:
    print(f"\n  ℹ️  No tags found in page frontmatter.")
    if os.path.exists(output_path):
        if not dry_run:
            os.remove(output_path)
            print(f"  🗑️  Removed empty TAG-INDEX.json")
        else:
            print(f"  [dry-run] Would remove empty TAG-INDEX.json")
else:
    if dry_run:
        print(f"\n  [dry-run] Would write TAG-INDEX.json ({len(sorted_index)} tags)")
    else:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_index, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f"\n  ✅ Written TAG-INDEX.json")
PYTAGS

  echo ""
fi

# ─── Rebuild TOC in SKILL.md ──────────────────────
if [[ "$TAGS_ONLY" != "true" ]]; then
  echo "📑 Rebuilding SKILL.md Table of Contents..."
  echo ""

  if [[ ! -f "$BOOK_PATH/SKILL.md" ]]; then
    echo "  ❌ SKILL.md not found — cannot rebuild TOC"
    exit 1
  fi

  export _IDX_BOOK="$BOOK_PATH_ABS"
  export _IDX_DRY="$DRY_RUN"
  python3 << 'PYTOC'
import os, re
from pathlib import Path

book_path = Path(os.environ['_IDX_BOOK'])
dry_run = os.environ['_IDX_DRY'] == "true"
skill_path = book_path / "SKILL.md"

sections = []
for entry in sorted(book_path.iterdir()):
    if not entry.is_dir() or not re.match(r'^\d{2}-', entry.name):
        continue

    section = {
        'name': entry.name,
        'display': entry.name.split('-', 1)[1].replace('-', ' ').title() if '-' in entry.name else entry.name,
        'num': entry.name[:2],
        'pages': [],
        'subsections': [],
    }

    for page in sorted(entry.iterdir()):
        if page.is_file() and page.suffix == '.md':
            title = None
            try:
                with open(page, 'r', encoding='utf-8') as f:
                    in_fm = False
                    for line in f:
                        ls = line.strip()
                        if ls == '---':
                            in_fm = not in_fm
                            continue
                        if in_fm:
                            continue
                        if ls.startswith('# '):
                            title = ls[2:].strip()
                            break
            except Exception:
                pass
            if not title:
                title = page.stem.split('-', 1)[1].replace('-', ' ').title() if '-' in page.stem else page.stem
            section['pages'].append({
                'file': page.name,
                'path': f"{entry.name}/{page.name}",
                'title': title,
                'is_overview': page.name == '00-overview.md',
            })

    for sub in sorted(entry.iterdir()):
        if not sub.is_dir() or not re.match(r'^\d{2}-', sub.name):
            continue
        subsection = {'name': sub.name, 'display': sub.name.split('-', 1)[1].replace('-', ' ').title() if '-' in sub.name else sub.name, 'pages': []}
        for page in sorted(sub.iterdir()):
            if page.is_file() and page.suffix == '.md':
                title = None
                try:
                    with open(page, 'r', encoding='utf-8') as f:
                        in_fm = False
                        for line in f:
                            ls = line.strip()
                            if ls == '---':
                                in_fm = not in_fm
                                continue
                            if in_fm:
                                continue
                            if ls.startswith('# '):
                                title = ls[2:].strip()
                                break
                except Exception:
                    pass
                if not title:
                    title = page.stem.split('-', 1)[1].replace('-', ' ').title() if '-' in page.stem else page.stem
                subsection['pages'].append({
                    'file': page.name,
                    'path': f"{entry.name}/{sub.name}/{page.name}",
                    'title': title,
                    'is_overview': page.name == '00-overview.md',
                })
        section['subsections'].append(subsection)
    sections.append(section)

toc_lines = ["## Table of Contents", ""]
total_pages = 0

for section in sections:
    toc_lines.append(f"### {section['num']} — {section['display']}")
    overview = next((p for p in section['pages'] if p['is_overview']), None)
    if overview:
        toc_lines.append("")
    for page in section['pages']:
        total_pages += 1
        desc = "Section overview and reading guide" if page['is_overview'] else page['title']
        toc_lines.append(f"- `{page['path']}` — {desc}")
    for sub in section['subsections']:
        toc_lines.append("")
        toc_lines.append(f"#### {sub['display']}")
        for page in sub['pages']:
            total_pages += 1
            desc = "Overview" if page['is_overview'] else page['title']
            toc_lines.append(f"- `{page['path']}` — {desc}")
    toc_lines.append("")

toc_block = "\n".join(toc_lines)

with open(skill_path, 'r', encoding='utf-8') as f:
    content = f.read()

toc_pattern = r'## Table of Contents\n.*?(?=\n## (?!Table of Contents)|\Z)'
match = re.search(toc_pattern, content, re.DOTALL)

if match:
    new_content = content[:match.start()] + toc_block + content[match.end():]
    new_content = re.sub(r'^(pages:\s*)\d+', f'\\g<1>{total_pages}', new_content, flags=re.MULTILINE)
    if dry_run:
        print(f"  [dry-run] Would update TOC ({total_pages} pages across {len(sections)} sections)")
        old_lines = match.group(0).count('\n')
        new_lines = toc_block.count('\n')
        print(f"  [dry-run] TOC: {old_lines} lines → {new_lines} lines")
    else:
        with open(skill_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✅ Updated SKILL.md TOC ({total_pages} pages, {len(sections)} sections)")
        print(f"  ✅ Updated frontmatter page count → {total_pages}")
else:
    print(f"  ⚠️  No '## Table of Contents' found in SKILL.md")
    print(f"  ℹ️  Add a '## Table of Contents' section and re-run")
    print(f"  Generated TOC ({total_pages} pages):")
    print()
    print(toc_block)
PYTOC

  echo ""
fi

echo "═══════════════════════════════════════════"
echo "  Done."
echo "═══════════════════════════════════════════"
