# SKILL: Manifest Builder (Pass 1)

**Purpose:** Read every content page in a Spellbook and extract all verifiable claims, classified by tier. Write the results to `.verify/AUDIT-MANIFEST.md`.

**Variable to substitute:** `BOOK_PATH` — the absolute path to the book directory (e.g., `/path/to/spellbook/books/my-book`).

---

## Task

You are running Pass 1 of the Spellbook Verification Pipeline for the book at `{BOOK_PATH}`.

### Step 1: Read the source inventory

Read `{BOOK_PATH}/sources/SOURCES.md`. This file lists all source documents available for verification. Note the file paths — you will use them when assigning `Source File` values to claims.

If `{BOOK_PATH}/sources/SOURCES.md` does not exist, stop and report: "Cannot run manifest builder: sources/SOURCES.md not found at {BOOK_PATH}/sources/SOURCES.md. Create this file before running verification."

### Step 2: List content files

List all `.md` files in `{BOOK_PATH}` recursively. **Exclude** the following:
- `SKILL.md`
- `README.md`
- `SUMMARY.md`
- Any file inside `sources/`
- Any file inside `.verify/`
- Any file inside `.git/`

This gives you the full set of content files to process.

### Step 3: Extract claims from each file

For each content file, read its content and extract all verifiable claims. Classify each claim by tier using the definitions below.

#### Tier Definitions

**T1 — Verbatim Quotes**
A blockquote that reproduces text from a source document, accompanied by a citation. The citation may be inline (e.g., `§ 82.152`) or in a footnote/reference block. The text inside the blockquote is what gets verified.

- Extract: the quoted text, the cited source file
- Flag if: no citation is present (UNCITED)

**T2 — Factual Assertions**
Any of the following:
- A number, threshold, percentage, temperature, pressure, timeframe, or quantity stated as a regulatory or scientific fact (e.g., "the leak rate threshold is 20%", "systems over 50 lbs require documentation")
- A rule or requirement paraphrased as a definitive statement of fact
- An uncited assertion that presents something as objectively true (flag: UNCITED)
- An interpretive gloss on a rule that adds meaning not explicit in the source (flag: INTERPRETS)

T2 claims are the highest-risk category for accuracy errors. Be thorough — include table rows, bullet points, and inline prose claims.

**T3 — Pedagogical Claims**
Exam tips, mnemonics, study notes, "commonly tested" callouts, "remember this" boxes, interpretive commentary that helps a student understand or memorize something.

T3 items require pedagogical verification — **extract the implicit factual claim each tip or mnemonic makes, not just the tip text itself**.

- Example: The tip "Remember: recovery cylinders must be filled to no more than 80% by weight" has an implicit claim that **the 80% fill limit is a real regulatory requirement**.
- Example: A mnemonic "Low pressure = evacuate UP to 25 mmHg" implicitly claims **the correct evacuation level for low-pressure appliances is 25 mmHg**.
- If the implicit claim is wrong, the tip teaches the wrong thing regardless of how memorable it is.

Record both the tip text AND the implicit factual claim in separate columns.

**T4 — External Knowledge**
Facts that require sources not present in `{BOOK_PATH}/sources/`. Examples: ASHRAE standards, IPCC data, historical refrigerant production statistics, DOT cylinder marking requirements, OSHA regulations, industry averages, manufacturer specifications.

For T4 claims, note what external source would be needed to verify the claim (the `Needs` column).

### Step 4: Assign source files

For each T1 and T2 claim, assign a `Source File` value — the path (relative to `{BOOK_PATH}/sources/`) of the source file that should contain evidence for this claim. Use the SOURCES.md index to make this assignment.

- If a claim cites a specific section (e.g., `§ 82.156`), map it to the corresponding source file.
- If a claim is uncited but you can infer the likely source from context, assign it and add an UNCITED flag.
- If you cannot determine the source, leave `Source File` blank and add an UNCITED flag.

### Step 5: Write the manifest

Create `{BOOK_PATH}/.verify/` if it does not exist.

Write the manifest to `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` using the format below.

---

## Output Format

### Header

```markdown
# [Book Title] — Audit Manifest
Generated: [ISO date]
Total content files processed: [N]
Source files available: [N]

**T3 Format Note:** T3 entries include an `Implicit Claim` column. This column contains the underlying factual assertion the tip or mnemonic makes — not the tip text itself. Verification agents should verify the implicit claim, not the surface text.

---

## Summary

- Total T1 entries: **[N]** (verbatim quotes with citations)
- Total T2 entries: **[N]** (factual assertions — numbers, thresholds, paraphrased rules)
- Total T3 entries: **[N]** (pedagogical — exam tips, mnemonics, study notes)
- Total T4 entries: **[N]** (external knowledge — requires sources outside local files)
- **Grand total: [N]**
- UNCITED flags in T2: **[N]**
- INTERPRETS flags: **[N]**

---
```

### Per-File Sections

For each content file, write a section:

```markdown
## [relative/path/to/file.md]

### T1 Entries

| # | Location | Claim (verbatim) | Source File | Flags | Status | Notes |
|---|----------|-----------------|-------------|-------|--------|-------|
| 1 | [section heading or line ref] | [exact quote text] | [sources/cfr/82-152.txt] | | | |

### T2 Entries

| # | Location | Claim | Source File | Flags | Status | Notes |
|---|----------|-------|-------------|-------|--------|-------|
| 1 | [section heading] | [claim text] | [sources/cfr/82-156.txt] | UNCITED | | |

### T3 Entries

| # | Location | Tip / Mnemonic Text | Implicit Claim | Source File | Flags | Status | Notes |
|---|----------|---------------------|----------------|-------------|-------|--------|-------|
| 1 | [section heading] | [tip text as written] | [the factual assertion this tip depends on] | [sources/cfr/82-156.txt] | | | |

### T4 Entries

| # | Location | Claim | Needs | Status | Notes |
|---|----------|-------|-------|--------|-------|
| 1 | [section heading] | [claim text] | [e.g., ASHRAE Standard 34] | | |
```

Omit any tier table for a file if that file has no claims of that tier.

If a file has no verifiable claims at all, include the section header and write: `No verifiable claims found in this file.`

---

## Quality Notes

- **Be thorough on T2.** Errors in numbers and thresholds are the most likely to cause real harm (someone failing an exam or misapplying a regulation). When in doubt, include it.
- **Be precise on T3 implicit claims.** The point of T3 verification is to catch tips and mnemonics that are catchy but factually wrong. The implicit claim must be specific enough that a verifier can check it against a source.
- **Do not verify — only extract.** This pass does not determine whether claims are correct. It only identifies and classifies them. Leave `Status` and `Notes` columns blank.
- **Preserve the exact text** of T1 quotes. Do not paraphrase. The verifier will do a string search.

---

## When Done

Report:
- Total files processed
- T1/T2/T3/T4 counts
- Number of UNCITED flags
- Path to the manifest file written
- Any files that could not be read or had errors
