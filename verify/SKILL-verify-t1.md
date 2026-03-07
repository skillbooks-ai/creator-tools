# SKILL: T1 Verification (Pass 2)

**Purpose:** Verify every verbatim quote (T1 entry) in the audit manifest against its cited source file. Update the manifest with verification statuses and write a T1 summary to the verification report.

**Variable to substitute:** `BOOK_PATH` — the absolute path to the book directory (e.g., `/path/to/spellbook/books/my-book`).

**Prerequisite:** Pass 1 (manifest builder) must have been run. `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` must exist.

---

## Task

You are running Pass 2 (T1 Verification) of the Spellbook Verification Pipeline for the book at `{BOOK_PATH}`.

### Step 1: Read the manifest

Read `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md`.

Extract all T1 rows from all file sections. Each T1 row has:
- A `Claim (verbatim)` — the exact quoted text to search for
- A `Source File` — the path (relative to `{BOOK_PATH}/`) of the source file to search in

If the manifest does not exist, stop and report: "Cannot run T1 verification: .verify/AUDIT-MANIFEST.md not found. Run Pass 1 (manifest builder) first."

### Step 2: Verify each T1 entry

For each T1 entry:

1. Check if the `Source File` exists at `{BOOK_PATH}/{Source File}`. If not, mark `STATUS = SOURCE_MISSING`.

2. If the source file exists, read it and search for the claim text. The search should be:
   - Case-sensitive
   - Normalize whitespace (multiple spaces, newlines should be treated as single spaces)
   - The quote must appear as a substring of the source file content

3. Assign a status:

| Status | Meaning |
|--------|---------|
| `VERIFIED` | The exact quote (or near-exact with only whitespace differences) was found in the cited source file |
| `MISMATCH` | The quote was NOT found in the cited source file |
| `WRONG_SOURCE` | The quote was NOT found in the cited source, but WAS found in a different source file when you searched all source files |
| `SOURCE_MISSING` | The cited source file does not exist in `{BOOK_PATH}/sources/` |

**For MISMATCH entries:** Before assigning MISMATCH, search all other source files in `{BOOK_PATH}/sources/` for the quote. If found elsewhere, use `WRONG_SOURCE` and note which file it was found in.

**For WRONG_SOURCE entries:** Note the correct source file path in the `Notes` column.

**For MISMATCH entries where the quote is simply not found anywhere:** Note in `Notes` what the most similar text in the cited source file is (e.g., "Source has: '...the applicable leak rate...' — book quote differs in wording"). This helps the author identify what changed.

### Step 3: Update the manifest

Update `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` in place. For each T1 row you processed, fill in the `Status` and `Notes` columns.

Do not change any other rows or columns. Preserve all T2, T3, T4 rows exactly as they were.

### Step 4: Write the T1 summary to the verification report

Create or append to `{BOOK_PATH}/.verify/VERIFY-REPORT.md`.

If the file already exists, append a new section. Do not overwrite existing content.

Write the following section:

```markdown
---

## Pass 2: T1 Verification (Verbatim Quotes)
Run: [ISO datetime]
Book: {BOOK_PATH}

### Summary

| Status | Count |
|--------|-------|
| VERIFIED | [N] |
| MISMATCH | [N] |
| WRONG_SOURCE | [N] |
| SOURCE_MISSING | [N] |
| **Total T1 entries** | **[N]** |

### Issues Requiring Action

#### MISMATCH entries
These quotes were not found in their cited source file. The book content must be corrected.

[For each MISMATCH entry:]
- **File:** [content file path]
- **Row:** [#]
- **Cited source:** [source file]
- **Quote:** "[claim text]"
- **Notes:** [what was found in the source instead]

#### WRONG_SOURCE entries
These quotes exist in the source files, but are cited to the wrong file. Update the citation.

[For each WRONG_SOURCE entry:]
- **File:** [content file path]
- **Row:** [#]
- **Cited source (wrong):** [original source file]
- **Correct source:** [source file where it was found]
- **Quote:** "[claim text]"

#### SOURCE_MISSING entries
These entries cite source files that do not exist in sources/.

[For each SOURCE_MISSING entry:]
- **File:** [content file path]
- **Row:** [#]
- **Missing source:** [source file path cited]
- **Quote:** "[claim text]"

### Result

[One of:]
- ✅ All T1 entries verified. No issues found.
- ⚠️ T1 verification complete with [N] issues. See above for required fixes.
```

---

## Quality Notes

- **Do not skip entries with a blank `Source File`.** If a T1 row has no source file assigned, treat it as `MISMATCH` and note "No source file assigned in manifest."
- **Whitespace normalization is important.** Regulatory text files sometimes have different line breaks or spacing than the blockquote in the book. A quote should be considered VERIFIED if the words match, even if whitespace differs.
- **Do not correct content yourself.** Your job is to verify and report. The author will make fixes based on your report.

---

## When Done

Report:
- Total T1 entries processed
- Counts by status (VERIFIED / MISMATCH / WRONG_SOURCE / SOURCE_MISSING)
- Whether any issues require author action
- Path to the updated manifest and report
