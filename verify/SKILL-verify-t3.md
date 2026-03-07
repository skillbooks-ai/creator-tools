# SKILL: T3 Verification (Pass 4)

**Purpose:** Verify the implicit factual claims embedded in exam tips, mnemonics, study notes, and pedagogical commentary (T3 entries). This pass checks whether the facts that make a tip or mnemonic work are actually correct. Update the manifest and append a T3 summary to the verification report.

**Variable to substitute:** `BOOK_PATH` — the absolute path to the book directory (e.g., `/path/to/spellbook/books/my-book`).

**Prerequisite:** Pass 1 (manifest builder) must have been run. `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` must exist. Ideally Pass 2 (T1) and Pass 3 (T2) have also been run, since T3 verification can reference their verified results.

---

## Task

You are running Pass 4 (T3 Verification) of the Spellbook Verification Pipeline for the book at `{BOOK_PATH}`.

### Why T3 Is Different

T3 items are not direct factual claims — they are pedagogical devices: tips, tricks, mnemonics, study notes. But every tip makes an **implicit factual claim**: the fact that the tip is trying to help a student remember.

If the tip is correct, it helps the student. If the tip is wrong, it teaches the student an incorrect fact — and the student may never realize it because the mnemonic was memorable.

**Your job is to verify the implicit claim, not evaluate the pedagogy.** You are not judging whether the tip is a good teaching method. You are checking whether the fact it depends on is true.

### Step 1: Read the manifest

Read `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md`. Extract all T3 rows from all file sections.

Each T3 row has:
- `Tip / Mnemonic Text` — the pedagogical content as written in the book
- `Implicit Claim` — the underlying factual assertion the tip depends on (filled in during Pass 1)
- `Source File` — the source file to check the implicit claim against

If `Implicit Claim` is blank for any T3 row, you must infer it before proceeding. Read the tip text and ask: "What specific fact must be true for this tip to be correct?"

### Step 2: Verify each implicit claim

For each T3 entry:

1. Identify the implicit claim (from the manifest or inferred by you)
2. Check the implicit claim against:
   - First: the cited `Source File` (read the relevant section)
   - If not found: search all source files in `{BOOK_PATH}/sources/`
   - If not found in any source: check against T1/T2 `VERIFIED` entries in the manifest (the claim may be a restatement of something already verified)
3. Assign a status (see table below)

#### T3 Status Codes

| Status | Meaning |
|--------|---------|
| `VERIFIED` | The implicit claim is correct — supported by source files or by a T1/T2 VERIFIED entry |
| `MISLEADING` | The implicit claim is technically true, but the way it is framed could lead a student to an incorrect conclusion |
| `INCORRECT` | The implicit claim is factually wrong — the source says something different |
| `UNVERIFIABLE` | The implicit claim cannot be checked against any available source files |

**For INCORRECT entries:**
- Note the correct value or rule in `Notes`
- Suggest a corrected version of the tip in `Notes` — something that teaches the right fact while still being memorable

**For MISLEADING entries:**
- Explain why the framing is misleading in `Notes`
- Suggest a revision that preserves the pedagogical intent while being accurate

**For UNVERIFIABLE entries:**
- Note what external source would be needed to verify the claim
- Do not assign INCORRECT just because you cannot verify it — only flag INCORRECT when you have positive evidence the claim is wrong

### Examples of Implicit Claim Verification

**Tip text:** "Think of Type I as 'Individual' — small appliances only, one system at a time."
**Implicit claim:** Type I certification covers small appliances only.
**Verification:** Check § 82.161 — if the source says Type I covers small appliances only, status = VERIFIED.

**Tip text:** "Low pressure means low evacuation number — evacuate to 25 mmHg."
**Implicit claim:** The correct evacuation level for low-pressure appliances is 25 mmHg absolute.
**Verification:** Check § 82.156 Table 1 — if the actual required level is different, status = INCORRECT. Note the correct value and suggest a corrected tip.

**Tip text:** "Any leak rate over 35% triggers immediate repair requirements."
**Implicit claim:** The leak rate threshold that triggers repair requirements is 35%.
**Verification:** Check § 82.157 — if the thresholds are 10%, 20%, and 30% depending on appliance type, this tip is INCORRECT (or MISLEADING if the 35% is a context-specific interpretation). Note the correct thresholds.

### Step 3: Update the manifest

Update `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` in place. For each T3 row processed, fill in the `Status` and `Notes` columns.

Do not change T1, T2, or T4 rows.

### Step 4: Write the T3 summary to the verification report

Append to `{BOOK_PATH}/.verify/VERIFY-REPORT.md`.

```markdown
---

## Pass 4: T3 Verification (Pedagogical Claims)
Run: [ISO datetime]
Book: {BOOK_PATH}

### Summary

| Status | Count |
|--------|-------|
| VERIFIED | [N] |
| MISLEADING | [N] |
| INCORRECT | [N] |
| UNVERIFIABLE | [N] |
| **Total T3 entries** | **[N]** |

### INCORRECT Entries — Tips Teaching Wrong Facts

These tips or mnemonics are based on incorrect facts. They must be corrected before publication.

[For each INCORRECT entry:]
- **File:** [content file path]
- **Row:** [#]
- **Tip text:** "[tip as written]"
- **Implicit claim:** "[what fact the tip depends on]"
- **What's wrong:** "[what the source actually says]"
- **Suggested fix:** "[revised tip that teaches the correct fact]"

### MISLEADING Entries — Tips That Could Cause Confusion

These tips are technically true but could lead students to incorrect conclusions. Consider revising.

[For each MISLEADING entry:]
- **File:** [content file path]
- **Row:** [#]
- **Tip text:** "[tip as written]"
- **Why misleading:** "[explanation]"
- **Suggested revision:** "[clearer version]"

### UNVERIFIABLE Entries

These tips' implicit claims could not be checked against local source files. They may be correct but should be reviewed by a domain expert.

[For each UNVERIFIABLE entry:]
- **File:** [content file path]
- **Row:** [#]
- **Tip text:** "[tip as written]"
- **Implicit claim:** "[what would need to be verified]"
- **Needs:** "[what source would be required]"

### Result

[One of:]
- ✅ All T3 implicit claims verified. No issues found.
- ⚠️ T3 verification complete. [N] INCORRECT, [N] MISLEADING, [N] UNVERIFIABLE. See above.
```

---

## Quality Notes

- **Incorrect tips are more dangerous than incorrect prose.** Students memorize tips. A wrong mnemonic will be recalled under exam pressure, leading to a wrong answer. Treat INCORRECT findings with the same urgency as T2 MISMATCH.
- **The implicit claim must be specific.** "This tip is about refrigerants" is not an implicit claim. "The correct evacuation level for high-pressure appliances manufactured after 1993 with ≥200 lbs charge is -15 psig" is an implicit claim. Be precise.
- **Verify the claim, not the pedagogy.** A mnemonic can be corny, confusing, or badly written and still be VERIFIED if the underlying fact is correct. Only flag INCORRECT or MISLEADING when there is a factual problem.
- **Infer missing implicit claims.** If the manifest has a T3 row with a blank `Implicit Claim`, do not skip it. Derive the implicit claim from the tip text before verifying.

---

## When Done

Report:
- Total T3 entries processed
- Counts by status (VERIFIED / MISLEADING / INCORRECT / UNVERIFIABLE)
- Number of entries requiring author action (INCORRECT + MISLEADING)
- Path to the updated manifest and report
