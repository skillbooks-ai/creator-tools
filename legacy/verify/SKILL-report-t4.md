# SKILL: T4 Inventory (Pass 5)

**Purpose:** Catalogue all T4 entries (claims requiring external sources) from the audit manifest. Group them by source type, triage them by verifiability, and produce a clean inventory in the verification report. Do NOT attempt to verify T4 claims — this is a triage and inventory task only.

**Variable to substitute:** `BOOK_PATH` — the absolute path to the book directory (e.g., `/path/to/spellbook/books/my-book`).

**Prerequisite:** Pass 1 (manifest builder) must have been run. `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md` must exist.

---

## Task

You are running Pass 5 (T4 Inventory) of the Spellbook Verification Pipeline for the book at `{BOOK_PATH}`.

### What T4 Means

T4 entries are facts in the book that require authoritative sources **not included in the book's `sources/` directory**. These are things like:

- Referenced industry standards (ASHRAE, AHRI, ASTM, SAE, etc.)
- Data from external agencies (IPCC, NIST, DOT, OSHA, CDC, etc.)
- Historical facts, market statistics, industry averages
- Manufacturer specifications
- Legal interpretations from external sources
- Widely-accepted engineering or scientific principles

T4 claims are not necessarily wrong — they may be correct industry knowledge. But they cannot be verified against local source files.

The purpose of this pass is to:
1. Know what T4 claims exist
2. Understand what external sources would be needed to verify them
3. Triage them by risk and verifiability
4. Give the author an actionable list

### Step 1: Read the manifest

Read `{BOOK_PATH}/.verify/AUDIT-MANIFEST.md`. Extract all T4 rows from all file sections.

Each T4 row has:
- `Claim` — the factual assertion
- `Needs` — the external source type required (filled in during Pass 1)

### Step 2: Group by external source type

Group all T4 entries by the `Needs` column. Common groupings:

- **ASHRAE** — American Society of Heating, Refrigerating and Air-Conditioning Engineers standards
- **AHRI** — Air-Conditioning, Heating, and Refrigeration Institute standards
- **DOT** — Department of Transportation regulations (cylinder markings, transport rules)
- **OSHA** — Occupational Safety and Health Administration regulations
- **IPCC** — Intergovernmental Panel on Climate Change data (GWP values, etc.)
- **NIST** — National Institute of Standards and Technology
- **Manufacturer** — Manufacturer specifications or product data
- **Industry-standard** — Widely accepted engineering principles not tied to a specific document
- **Historical** — Historical facts or statistics
- **Other** — Anything that doesn't fit the above

### Step 3: Triage by verifiability

For each T4 group, classify each claim into one of these triage categories:

| Triage Category | Description |
|-----------------|-------------|
| `WEB-VERIFIABLE` | Could be verified with a web search (e.g., GWP values for common refrigerants, known standard specifications) |
| `EXPERT-REVIEW` | Requires domain expert review — the claim involves technical judgment, proprietary data, or specialized knowledge |
| `INDUSTRY-STANDARD` | Widely accepted as correct within the industry — low risk, unlikely to be wrong, but not citable |

**How to decide:**
- If a claim is about a specific number from a named standard (e.g., "GWP of R-410A is 2088 per IPCC AR4"), it could be web-verified
- If a claim involves applying a standard in a specific context (e.g., "ASHRAE 34 classifies this refrigerant as A1"), it may need expert review
- If a claim is about a rule of thumb or engineering convention (e.g., "refrigerant cylinders should never be stored near heat sources above 125°F"), it may be industry-standard

### Step 4: Write the T4 inventory to the verification report

Append to `{BOOK_PATH}/.verify/VERIFY-REPORT.md`.

```markdown
---

## Pass 5: T4 Inventory (External Knowledge)
Run: [ISO datetime]
Book: {BOOK_PATH}

> **Note:** T4 entries are not verified by this pipeline. This is an inventory and triage report only. See the triage categories for recommended next steps.

### Summary

| External Source Type | Count |
|---------------------|-------|
| ASHRAE | [N] |
| AHRI | [N] |
| DOT | [N] |
| OSHA | [N] |
| IPCC | [N] |
| NIST | [N] |
| Manufacturer | [N] |
| Industry-standard | [N] |
| Historical | [N] |
| Other | [N] |
| **Total T4 entries** | **[N]** |

### By Triage Category

| Triage | Count |
|--------|-------|
| WEB-VERIFIABLE | [N] |
| EXPERT-REVIEW | [N] |
| INDUSTRY-STANDARD | [N] |
| **Total** | **[N]** |

---

### WEB-VERIFIABLE Claims

These T4 claims could be checked with a targeted web search. Recommended for spot-checking before publication.

[For each WEB-VERIFIABLE T4 entry:]
| File | Claim | Needs | Suggested search |
|------|-------|-------|-----------------|
| [file path] | [claim text] | [external source] | [what to search for] |

---

### EXPERT-REVIEW Claims

These T4 claims require domain expert evaluation. Flag for review before marking the book as fully verified.

[For each EXPERT-REVIEW T4 entry:]
| File | Claim | Needs | Why expert is needed |
|------|-------|-------|---------------------|
| [file path] | [claim text] | [external source] | [reason] |

---

### INDUSTRY-STANDARD Claims

These T4 claims are widely accepted industry knowledge. Low risk — include for completeness. Consider adding a note in the book's README or SOURCES.md acknowledging that some industry-standard claims are not citable to a specific document.

[For each INDUSTRY-STANDARD T4 entry:]
| File | Claim | Domain |
|------|-------|--------|
| [file path] | [claim text] | [e.g., refrigeration engineering] |

---

### Recommended Next Steps

1. **Web-verify** the WEB-VERIFIABLE claims. Add a note to SOURCES.md for any that you confirm.
2. **Schedule expert review** for EXPERT-REVIEW claims before marking the book as verified.
3. **Document INDUSTRY-STANDARD claims** in the book's SOURCES.md under a section like "Industry Standards and Engineering Conventions (not citable to a specific document)".
4. If you add source files to `sources/` to cover T4 claims, re-run the manifest builder (Pass 1) to reclassify them.
```

---

## Quality Notes

- **Do not attempt to verify T4 claims.** Do not search the web. Do not look up values. The purpose of this pass is inventory and triage, not verification. If you verify a claim, you are doing T4 author work, not T4 pass work.
- **The triage categories are risk assessments.** INDUSTRY-STANDARD doesn't mean "ignore this." It means the claim is likely correct and widely accepted, so the risk of it being wrong is low — not zero.
- **Be specific about what external source is needed.** "ASHRAE" is less useful than "ASHRAE Standard 34-2022, Refrigerant Safety Classification." The more specific, the more actionable for the author.
- **Do not modify T1, T2, or T3 rows** in the manifest. T4 rows can have their `Status` column set to `INVENTORIED` to indicate this pass has processed them.

---

## When Done

Report:
- Total T4 entries inventoried
- Breakdown by external source type
- Breakdown by triage category (WEB-VERIFIABLE / EXPERT-REVIEW / INDUSTRY-STANDARD)
- Path to the verification report
