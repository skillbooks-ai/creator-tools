# SKILL: T2 Verification (Pass 3)

**Purpose:** Verify all factual assertions (T2 entries) in the audit manifest against source files. This requires reading source material and reasoning about whether each claim is accurate. Update the manifest and append a T2 summary to the verification report.

**Variable to substitute:** `BOOK_PATH` — the absolute path to the book directory (e.g., `/path/to/spellbook/books/my-book`).

**Prerequisite:** Pass 1 (manifest builder) must have been run. `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` must exist.

---

## Task

You are running Pass 3 (T2 Verification) of the Spellbook Verification Pipeline for the book at `{BOOK_PATH}`.

### Step 1: Read the manifest

Read `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md`. Extract all T2 rows from all file sections.

Each T2 row has:
- A `Claim` — the factual assertion to verify
- A `Source File` — the source file that should support this claim
- `Flags` — may include `UNCITED` or `INTERPRETS`

### Step 2: Group by source file

Group all T2 rows by their `Source File` value. This allows you to read each source file once and verify all claims from it in a single pass.

Handle source file groups in this order: start with source files that have the most T2 claims assigned to them.

For rows with no `Source File` assigned (blank), group them into a special "Unassigned" group and process last.

### Step 3: Verify each group

For each source file group:

1. Read the source file at `{BOOK_PATH}/{Source File}`.
2. For each T2 claim assigned to this source:
   a. Find the relevant passage in the source file
   b. Determine whether the claim is supported by what the source says
   c. Assign a status (see table below)
   d. For MISMATCH: record the correct value from the source in `Notes` and add a `FIX` action

#### T2 Status Codes

| Status | Meaning |
|--------|---------|
| `VERIFIED` | The claim is accurate and supported by the source file |
| `MISMATCH` | The claim is inaccurate — the source says something different. Record the correct value. |
| `UNCITED-VERIFIED` | The claim had no citation (UNCITED flag), but searching the source files found supporting text |
| `UNCITED-UNVERIFIABLE` | The claim had no citation and could not be found in any local source file |
| `NEEDS-HUMAN` | The claim is ambiguous, the source is unclear, or the claim requires domain expertise to evaluate |

**For MISMATCH entries:**
- Record both the claimed value and the correct value in `Notes`
- Format: `MISMATCH: book says "[X]", source says "[Y]"` — then add `FIX: update to "[Y]"`
- These entries need to be fixed before the book can be marked verified

**For INTERPRETS-flagged entries:**
- These are interpretive glosses on a rule. They may be accurate in substance even if they add meaning.
- If the interpretation is well-supported by the source text: `VERIFIED`
- If the interpretation goes beyond what the source says or could mislead: `NEEDS-HUMAN` with a note explaining the concern
- If the interpretation is factually wrong: `MISMATCH`

**For UNCITED claims:**
- Search all source files in `{BOOK_PATH}/sources/` for supporting text
- If found: `UNCITED-VERIFIED`
- If not found in any source: `UNCITED-UNVERIFIABLE`

### Step 4: Update the manifest

Update `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` in place. For each T2 row processed, fill in the `Status` and `Notes` columns.

For MISMATCH entries, add `FIX: [corrected text]` to the Notes column so the author can do a targeted search-and-replace.

Do not change T1, T3, or T4 rows.

### Step 5: Write the T2 summary to the verification report

Append to `{BOOK_PATH}/.verify/VERIFY-REPORT.md`.

```markdown
---

## Pass 3: T2 Verification (Factual Assertions)
Run: [ISO datetime]
Book: {BOOK_PATH}

### Summary

| Status | Count |
|--------|-------|
| VERIFIED | [N] |
| MISMATCH | [N] |
| UNCITED-VERIFIED | [N] |
| UNCITED-UNVERIFIABLE | [N] |
| NEEDS-HUMAN | [N] |
| **Total T2 entries** | **[N]** |

MISMATCH entries (require fix): [N]
UNCITED-UNVERIFIABLE entries (consider adding sources or rewriting): [N]
NEEDS-HUMAN entries (require expert review): [N]

### MISMATCH Entries — Required Fixes

[For each MISMATCH entry:]
- **File:** [content file path]
- **Row:** [#]
- **Source:** [source file]
- **Book claims:** "[claimed value]"
- **Source says:** "[correct value]"
- **Fix:** [the corrected text to use]

### UNCITED-UNVERIFIABLE Entries

These claims are presented as facts but cannot be verified against local source files. The author should either add a source that supports them, rewrite them with appropriate hedging, or remove them.

[For each UNCITED-UNVERIFIABLE entry:]
- **File:** [content file path]
- **Row:** [#]
- **Claim:** "[claim text]"

### NEEDS-HUMAN Entries

These require domain expertise or editorial judgment to evaluate.

[For each NEEDS-HUMAN entry:]
- **File:** [content file path]
- **Row:** [#]
- **Claim:** "[claim text]"
- **Issue:** [why it needs human review]

### Result

[One of:]
- ✅ All T2 entries verified. No issues found.
- ⚠️ T2 verification complete. [N] MISMATCH, [N] UNCITED-UNVERIFIABLE, [N] NEEDS-HUMAN. See above.
```

---

## Quality Notes

- **Prioritize MISMATCH detection.** Incorrect numbers and thresholds are the most dangerous errors in an exam prep or compliance book. Be precise when comparing claimed values against source values.
- **Check table rows carefully.** Transposed values (e.g., two rows with their data swapped) are a common error. When verifying a table cell, look at the whole table row, not just the cell in isolation.
- **Record the correct value precisely.** When noting a MISMATCH, copy the exact text from the source document. The author needs to know the exact replacement value, not just that something is wrong.
- **Do not fix content yourself.** Flag it with FIX notation; the author makes the changes.
- **For INTERPRETS flags:** Use judgment. An accurate simplification is VERIFIED. An oversimplification that could mislead is NEEDS-HUMAN. A flat-out wrong interpretation is MISMATCH.

---

## When Done

Report:
- Total T2 entries processed
- Counts by status
- Number of entries requiring author action (MISMATCH + UNCITED-UNVERIFIABLE + NEEDS-HUMAN)
- Path to the updated manifest and report
