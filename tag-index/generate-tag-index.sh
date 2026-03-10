#!/usr/bin/env bash
# generate-tag-index.sh — Generate TAG-INDEX.json from page frontmatter tags
# Usage: ./generate-tag-index.sh /path/to/my-book
#
# Scans all .md files in content directories for YAML frontmatter `tags` fields
# and builds a TAG-INDEX.json mapping tag → [page paths].

set -euo pipefail

BOOK_PATH="${1:?Usage: generate-tag-index.sh /path/to/my-book}"
BOOK_PATH="${BOOK_PATH%/}"
OUTPUT="$BOOK_PATH/TAG-INDEX.json"

echo "═══════════════════════════════════════════"
echo "  Generate TAG-INDEX.json"
echo "  Book: $BOOK_PATH"
echo "═══════════════════════════════════════════"
echo ""

# Use Python for reliable YAML-ish parsing and JSON output
python3 << 'PYEOF' "$BOOK_PATH" "$OUTPUT"
import sys, os, re, json
from pathlib import Path

book_path = Path(sys.argv[1])
output_path = sys.argv[2]

# Directories to skip
SKIP_DIRS = {'sources', '.verify', '.git', 'node_modules'}

tag_index = {}  # tag -> [relative_paths]
tagged_files = 0
total_tags = 0

def extract_tags(filepath):
    """Extract tags from YAML frontmatter."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return []

    # Check for frontmatter
    if not content.startswith('---'):
        return []

    # Find closing ---
    end = content.find('---', 3)
    if end == -1:
        return []

    frontmatter = content[3:end]

    # Find tags line
    for line in frontmatter.split('\n'):
        line = line.strip()
        if line.startswith('tags:'):
            tag_str = line[5:].strip()
            # Handle [tag1, tag2, tag3] format
            if tag_str.startswith('['):
                tag_str = tag_str.strip('[]')
                return [t.strip().strip('"').strip("'") for t in tag_str.split(',') if t.strip()]
            # Handle single tag
            elif tag_str:
                return [tag_str.strip('"').strip("'")]
    return []

# Walk content directories
for root, dirs, files in os.walk(book_path):
    # Skip non-content dirs
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    rel_root = os.path.relpath(root, book_path)

    # Only process content directories (NN-name pattern)
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
                if tag not in tag_index:
                    tag_index[tag] = []
                tag_index[tag].append(rel_path)

# Sort tags and paths
sorted_index = {}
for tag in sorted(tag_index.keys()):
    sorted_index[tag] = sorted(tag_index[tag])

# Write output
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(sorted_index, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"  📊 {tagged_files} files with tags")
print(f"  🏷️  {len(sorted_index)} unique tags, {total_tags} total tag entries")

if not sorted_index:
    print(f"\n  ℹ️  No tags found. Add tags to page frontmatter:")
    print(f"     ---")
    print(f"     tags: [topic, subtopic]")
    print(f"     ---")
    # Remove empty file
    os.remove(output_path)
    print(f"\n  No TAG-INDEX.json generated (no tags found).")
else:
    print(f"\n  ✅ Written to {output_path}")
PYEOF

echo ""
echo "═══════════════════════════════════════════"
