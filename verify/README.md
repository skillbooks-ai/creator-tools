# Verification Pipeline

The verification pipeline checks every factual claim in your Spellbook against its source documents. It is a multi-pass process, with each pass handled by a specialized AI agent.

---

## What It Does

The pipeline has five passes:

| Pass | Name | What it does |
|------|------|--------------|
| Pass 1 | Manifest Builder | Reads every content page in your book and extracts all verifiable claims, classified by tier (T1–T4). Writes `.verify/AUDIT-MANIFEST.md`. |
| Pass 2 | T1 Verification | Verifies verbatim quotes against source files (mechanical string match). |
| Pass 3 | T2 Verification | Verifies numbers, thresholds, and factual assertions against source files (requires reading and reasoning). |
| Pass 4 | T3 Verification | Verifies the implicit factual claims made by exam tips, mnemonics, and study notes (pedagogical verification). |
| Pass 5 | T4 Inventory | Catalogues claims that require external sources and triages them by verifiability. |

Each pass writes its results to `.verify/VERIFY-REPORT.md`.

---

## Prerequisites

Your book must have:

1. A `sources/` directory containing the source files your book is derived from
2. A `sources/SOURCES.md` file that indexes those source files

Without these, the pipeline cannot run. See [FORMAT.md](../../FORMAT.md) for the required format.

---

## How to Run

The pipeline is run through the OpenClaw agent system. The shell script `run-verify.sh` helps you set up and inspect the run, but the actual agent passes must be spawned manually (or via your agent orchestration workflow).

### Step 1: Run the setup script

```bash
export BOOK_PATH=/path/to/your/book
bash creator-tools/verify/run-verify.sh
```

This will:
- Validate that your book is ready (sources exist, structure is correct)
- Print a summary of what it found
- Print instructions for spawning each pass

### Step 2: Spawn Pass 1 (Manifest Builder)

Copy the task from `SKILL-manifest-builder.md` and spawn it as an agent with `BOOK_PATH` substituted. This produces `.verify/AUDIT-MANIFEST.md`.

### Step 3: Run Passes 2–5

After Pass 1 completes, spawn each verification pass agent in order:
- Pass 2: `SKILL-verify-t1.md`
- Pass 3: `SKILL-verify-t2.md`
- Pass 4: `SKILL-verify-t3.md`
- Pass 5: `SKILL-report-t4.md`

Passes 2–5 can be run in any order, but they all require Pass 1 to be complete first.

---

## Claim Tiers

### T1 — Verbatim Quotes
Direct quotes from source documents, in blockquotes, with a citation. These are the highest-confidence claims and the most straightforward to verify — either the quote is in the source or it isn't.

**How verified:** String match against the cited source file.

**Statuses:** `VERIFIED`, `MISMATCH`, `WRONG_SOURCE`, `SOURCE_MISSING`

### T2 — Factual Assertions
Numbers, thresholds, percentages, dates in tables or prose. Paraphrased rules stated as fact. Uncited assertions (flagged `UNCITED`). Interpretive claims that gloss a rule (flagged `INTERPRETS`).

These require reading the source and reasoning about whether the claim is accurate.

**How verified:** Agent reads the relevant source file section and checks the claim.

**Statuses:** `VERIFIED`, `MISMATCH` (with correct value noted), `UNCITED-VERIFIED`, `UNCITED-UNVERIFIABLE`, `NEEDS-HUMAN`

### T3 — Pedagogical Claims
Exam tips, mnemonics, study notes, "commonly tested" callouts, interpretive commentary. These don't make direct factual claims, but they carry **implicit factual claims** — the fact that makes the tip or mnemonic work.

**Example:** "Remember: if it's below 200 lbs, you can use push-pull recovery" implies that the 200 lb threshold is a real regulatory number. That implicit claim must be verified.

**How verified:** Agent extracts the implicit claim and checks it against source files or against T1/T2 verified claims.

**Statuses:** `VERIFIED`, `MISLEADING`, `INCORRECT`, `UNVERIFIABLE`

### T4 — External Knowledge
Facts that require sources not in the book's `sources/` folder (ASHRAE standards, IPCC data, historical records, industry statistics, etc.). These cannot be verified by the pipeline and are instead inventoried and triaged.

**How verified:** Not verified — inventoried only.

**Output:** A triage report grouping T4 claims by what external source they need and classifying them as web-searchable, expert-review-required, or widely-accepted industry standard.

---

## Reading the Output

### `.verify/AUDIT-MANIFEST.md`

The manifest has a header with summary stats (total T1/T2/T3/T4 counts, flags) followed by sections for each book file. Each section contains a table of claims.

Table columns:
| Column | Description |
|--------|-------------|
| `#` | Row number within the file |
| `Tier` | T1, T2, T3, or T4 |
| `Location` | Section/paragraph reference within the content file |
| `Claim` | The claim text (verbatim for T1, paraphrase for T2, tip text for T3) |
| `Implicit Claim` | (T3 only) The underlying factual assertion the tip or mnemonic makes |
| `Source File` | Which source file this claim should be verified against |
| `Flags` | UNCITED, INTERPRETS, etc. |
| `Status` | Populated by verification passes |
| `Notes` | Populated by verification passes — mismatched values, corrections, etc. |

### `.verify/VERIFY-REPORT.md`

The report has one section per verification pass, appended in order. Each section includes:
- Pass name and timestamp
- Summary counts (verified, failed, etc.)
- List of issues requiring action
- Recommended fixes for MISMATCH and INCORRECT entries

---

## Fixing Issues Found

### T1 MISMATCH
The verbatim quote in your book doesn't match the source. Fix options:
1. Correct the quote to match the source exactly
2. If you believe the source has changed since the book was written, update the source file and re-run

### T1 WRONG_SOURCE
The quote exists but in a different source file than you cited. Fix: update the citation.

### T2 MISMATCH
A factual claim (number, threshold, rule) is wrong. The VERIFY-REPORT will include the correct value from the source. Fix: update the content to use the correct value. The manifest will include a `FIX` action on these rows.

### T2 UNCITED-UNVERIFIABLE
An uncited assertion that isn't in any of your source files. Fix options:
1. Add a source file that supports it
2. Remove or rewrite the claim
3. Move it to a clearly-labeled "Note" that doesn't present it as a regulatory fact

### T3 INCORRECT
An exam tip or mnemonic is teaching the wrong fact. Fix: rewrite the tip to reflect the correct value or rule.

### T3 MISLEADING
The tip is technically true but could lead a student to the wrong conclusion. Fix: add a qualifier or clarifying note.

### T4 (web-searchable)
These can be spot-checked with a web search. Not critical for publication but useful for quality.

---

## SKILL Files

Each pass is defined as a standalone agent task prompt:

| File | Pass | Description |
|------|------|-------------|
| `SKILL-manifest-builder.md` | Pass 1 | Extract and classify all claims |
| `SKILL-verify-t1.md` | Pass 2 | Verify verbatim quotes |
| `SKILL-verify-t2.md` | Pass 3 | Verify factual assertions |
| `SKILL-verify-t3.md` | Pass 4 | Verify pedagogical claims |
| `SKILL-report-t4.md` | Pass 5 | Inventory external knowledge gaps |

These files are generic — substitute `BOOK_PATH` for any book on the platform.
