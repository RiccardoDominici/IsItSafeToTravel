# Consistency database

Verified problems found on the live country pages, of the kind an external reader criticised on
2026-10-14 (a German travel blogger: stale data shown as current, indicators irrelevant to
travellers, generic machine sentences, "neighbours" that are not neighbours, absurd "similar
countries"), plus score bounds and orderings that contradict well-known reality. Two uses:

1. **Fix list.** Every finding names the page, the exact quote, what is wrong, what would be right,
   and where the fix belongs (`fixArea`: formula, copy-template, country-grammar, comparisons,
   data-source, advisory-parser, ui, other). `issues.json` groups the findings by root cause.
2. **Formula evaluation.** Findings about scores become machine-checkable constraints
   (`constraints.json`): bounds ("Belarus scores at most 5.5") and orderings ("South Sudan is safer
   than Sudan") that a sound formula should satisfy. Run a candidate formula's output through
   `scripts/calibration/evaluate-consistency.ts` and compare violations and total shortfall with the
   published scores. This complements the community votes and `../reference-scores.json` (the
   2026-03 expert reference set): the constraints are few on purpose, each one checked by a second,
   stronger model and kept only if "almost any travel-safety expert would accept it".

## Files

| File | What |
|---|---|
| `findings.json` | Confirmed (and a few "uncertain") findings, most severe first; a template problem appears once per review batch with `iso3: "ALL"`. |
| `findings-rejected.json` | Reviewer findings the verifier rejected, kept to measure reviewer precision. |
| `constraints.json` | Formula constraints derived from confirmed findings, each pointing at its finding(s). |
| `issues.json` | The findings grouped by root cause (one fix in one place), most severe first: `title`, `severity`, `fixArea`, `languages`, `findings`, `uncertainFindings`, `pages` (rough count, see `pagesNote`), `examples`, `source` (path:line at `siteCommit`), `rootCause`, `proposedFix`, `formulaRelevant`; after a re-check also `status` and `recheck` (see "Re-check"). |
| `corrections.json` | Owner corrections the assembler applies after the verifier, for verdicts that were wrong for a reason the verifier could not see. Each must match a finding, or assembly fails. |

### Finding fields

`id`, `source` (`script` or `swarm`), `review` (`language`, `comparisons`, `plausibility`,
`ordering`), `check` (script check name) or `batch` (reviewer batch), `iso3` (or `ALL`), `lang`,
`url`, `category` (`stale-data`, `irrelevant-indicator`, `generic-text`, `broken-text`,
`contradiction`, `bad-comparison`, `implausible-value`, `implausible-score`, `other`), `severity`
(`high` = misleading for a safety decision or nonsense at the top of the page), `field` (where on the
page), `quote` (exact), `problem`, `expected`, `formulaRelevant`, `fixArea`, `verdict` (`confirmed` /
`uncertain`), `verification` (who checked and what they found), `instances` (for script template
problems), `status` (see "Re-check"), `recheck`, `foundOn`, `dataDate`, `siteCommit`. `problem` and
`expected` are the reviewer's words; where the verifier corrected them (it often narrows an
overstated claim), its note in `verification` is the authoritative reading.

### Constraint fields

`id`, `kind` (`score_at_most`, `score_at_least`, `safer_than`), `iso3`, `value` (a 1-10 bound, or
the other ISO3), `rationale` (the verifier's note, which matches the constraint as corrected),
`finding` (the finding id) and `alsoFindings` when several findings proposed it. A constraint involving a place without an official score (grey) is "not applicable".
The assembler normalises them: "B less_safe_than A" is written "A safer_than B", duplicates merge,
two bounds of one kind on one place keep the looser one, and contradictory pairs are dropped
(`conflictsDropped`), because a database that contradicts itself cannot rank formulas.

## Reading the constraint results

Baseline on 2026-10-15 (`npx tsx scripts/calibration/evaluate-consistency.ts <scores.json>`):

| Scores | Pass | Fail | Total shortfall |
|---|---|---|---|
| v10, published 2026-10-15 | 5 / 14 | 9 | 1.90 points |
| v9.1, last snapshot 2026-10-14 | 7 / 14 | 7 | 2.88 points |
| v10.1 (weights 10.1.0), offline on the 2026-10-15 data | 10 / 14 | 4 | 0.75 points |
| v10.1, published 2026-10-17 (first run of the release) | 10 / 14 | 4 | 0.84 points |

The v10.1 changes were chosen with `scripts/calibration/compare-formulas.ts`, which prints this
check for every formula variant next to the community-vote error, the extremes, the band changes
and the 2026-03 reference set, split into the structural and situational constraints below. Still
failing under v10.1: ARE (7.04, bound 6.9), BLR (5.40, bound 5.0), CPV (6.84, floor 7.0) and PNG
(6.04, bound 6.0).

Two caveats before using these numbers to pick a formula:

- **Selection bias.** The reviewers looked for errors in the v10 scores, so the constraints sit
  where v10 fails or nearly fails, and a pass count favours any other formula. Compare candidates
  on the total shortfall, and add constraints from each candidate's own errors before deciding.
- **Situational constraints.** Seven of the fourteen depend on the situation on 2026-10-15 and must
  be re-checked before judging a much later snapshot: the advisory consensus on the United Arab
  Emirates, Saudi Arabia, Belarus, Cuba and Papua New Guinea, and the wars behind Sudan vs South
  Sudan and Burkina Faso vs Chad. The other seven are structural (crime levels, data gaps, hazard
  weighting): Japan and Liechtenstein vs Italy, Indonesia vs South Africa, the Dominican Republic
  vs Jamaica, Vietnam vs Trinidad and Tobago, and the floors for Cabo Verde and Taiwan.

## How it was built (2026-10-15, formula v10, data 2026-10-15, site 7c79009c)

1. `npx astro build`, then `npx tsx scripts/audit/extract-page-facts.ts <dir>`: every built country
   page (248 places x 7 languages = 1,736) as structured facts plus a compact text rendering.
2. `npx tsx scripts/audit/check-page-consistency.ts <dir>`: deterministic checks (score, rank and
   government counts across title/hero/summary/FAQ and across languages, comparison-table scores
   and distances, over-age years, lowercase sentence starts, doubled words, placeholders).
3. `npx tsx scripts/audit/make-review-batches.ts <dir>`: the reviewer batch files (language,
   comparisons, plausibility, ordering) and their manifest.
4. The reviewer swarm (Haiku) with an Opus verifier for every finding; the verifier re-reads the page
   text and `data/scores/latest.json`, keeps a finding only if the quote is on the page and the
   problem is real ("uncertain" when it hinges on a real-world fact it cannot settle), and may
   correct the category, severity and constraint. On 2026-10-15 this took three runs: 32 page
   reviewers (21 language, 3 comparison, 8 plausibility batches; three of them ran out of output
   budget and seven verifier calls hit rate limits), a re-run of those with the three batches split
   in four, and 8 ordering reviewers (6 regions, 60 popular destinations, the 30 highest and 30
   lowest scores). `scripts/audit/workflows/consistency-audit.js` is the consolidated script for
   next time: smaller batches, reviewers at effort "high", every failed agent retried once.
5. `npx tsx scripts/audit/assemble-consistency-db.ts --auto <dir>/auto-findings.json --swarm
   <result.json> --commit <sha>` applies `corrections.json` and writes `findings.json`,
   `findings-rejected.json` and `constraints.json`; `issues.json` is then written by an Opus pass
   that groups the kept findings by root cause and locates each in the source.

On 2026-10-15 the 32+12+8 reviewers reported 687 findings: the verifiers confirmed 558, left 16
uncertain and rejected 113 (reviewer precision 84% for language, 78% comparisons, 87%
plausibility, 72% orderings). One owner correction then rejected 12 more: they said grey pages
should not show a neighbour table, which came from a mistake in the audit brief, not from the
site (grey pages keep the table on purpose; the workflow brief is fixed). Result: 563 findings
(548 confirmed, 15 uncertain) in 68 issues, and 14 constraints.

To repeat the audit after a release: run steps 1-5 on the new build into a scratch directory.
The assembler always builds a fresh database with fresh ids, so merge the new run into these files
rather than overwriting them: mark findings that no longer reproduce as `fixed` instead of deleting
them, and keep existing ids, so constraints and issues keep pointing at the right findings.

## Re-check (2026-10-17, formula v10.1, data 2026-10-17, site fb13ff40)

`npx tsx scripts/audit/recheck-findings.ts --old <2026-10-15 facts dir> --new <new facts dir>
--date <date> --commit <sha> [--verdicts a.json,b.json] [--scores <scores.json>]` merges a re-check
into `findings.json` and `issues.json` in place, keeping every id. Each finding gets a `status` and
a `recheck` object (`date`, `siteCommit`, `method`, `evidence`). The first input that applies sets
the status:

1. A **review verdict**, for what the checks below cannot settle. Run the reviewers with the old
   and new page texts side by side, judging the problem, not the literal quote.
2. The finding's **formula constraint** on the new scores (pass: fixed, fail: open). A score quote
   disappears as soon as the number moves, so the quote alone would call "UAE 7.3 is too high"
   fixed at 7.2.
3. A **mechanical quote search** on the new build. A quote gone even with numbers masked counts as
   fixed: an adversarial review of 40 such findings on 2026-10-17 confirmed all 40.

Statuses:

- Findings: `fixed`, `partial` (better, not done), `open`, `by-design` (matches an owner decision),
  `unverified` (nothing settled it).
- Issues: rolled up from their findings. Open if any finding is open or partial (partial when part
  of it is fixed). Fixed or by-design when nothing is left, whichever covers more findings.

Result on 2026-10-17:

- **Findings:** 542 fixed, 9 by design, 3 partial, 7 open, 2 unverified.
  - 436 settled by the quote search alone, 2 by their constraint.
  - 125 settled by review: the 85 the checks could not settle (four Opus reviewers) and the
    40-finding sample (one adversarial reviewer).
  - The review found one more defect, fixed the same day: the German meta description said
    "Schwächster Bereich" for a focus that excludes governance (I02).
  - The reviewers also reported defects outside the 563 findings, all fixed the same day:
    - "a majority of governments" where all of them advise against all travel (Afghanistan, Yemen);
    - a Portuguese agreement error ("O fator principal é os desastres");
    - V-Dem corruption quoted as a summary driver after it moved to "Country context" (Bulgaria, Serbia, North Macedonia);
    - Belarus' hero reading "Only for experienced travelers" above a FAQ "No";
    - mixed number formats in 21 Chinese descriptions;
    - the natural-hazard row not saying that coping capacity is part of the v10.1 score;
    - a bare "World Bank" on grey pages.
- **Issues:** 59 fixed, 2 by design (I36 health calibration, I43 faithful source values), 1 unverified (I50), 6 partial:
  - **I10:** BLR 5.39, PNG 6.06 and ARE 7.18 still above their bounds.
  - **I42:** Cabo Verde 6.89, below its 7.0 floor.
  - **I44:** Jamaica/Dominican Republic and South Africa/Indonesia are in the right order, but only 0.1 apart.
  - **I46:** France rates Iraq level 2. The French page has no whole-country sentence, and Baghdad is orange, so the parser falls to its named-zone cap.
  - **I61:** World Bank homicide figures from 2021-2022 still weigh like current ones.
  - **I66:** Chad/Burkina Faso in the right order, 0.12 apart.
- **I50**, UCDP deaths attributed to gangs or one-sided violence: cannot be settled from the page.

## Coverage floor study (2026-10-19, data 2026-10-18)

Owner question: would raising or lowering the coverage floor (`minSources`, 4 of the 6 coverage
sources) improve the verified checks, since places with some data but not much have less reliable
scores? `npx tsx scripts/calibration/coverage-floor-study.ts [--date D] [--json out.json]` answers
it in two parts. The same numbers came out on the 2026-10-17 data.

**A. The floor itself does not improve any verified check.** A place's score never depends on the
floor (zero drift across floors 1-6), so the floor only decides which places are shown.

| Floor | Scored | Constraints pass/fail/n.a., shortfall | Vote MAE (n) | Reference MAE / rho |
|---|---|---|---|---|
| 3 | 193 | 10/4/0, 0.81 | 0.423 (104) | 1.002 / 0.981 |
| **4** (now) | 183 | 10/4/0, 0.81 | 0.424 (103) | 1.002 / 0.981 |
| 5 | 167 | 8/3/3, 0.70 | 0.425 (99) | 1.002 / 0.981 |
| 6 | 129 | 6/2/6, 0.66 | 0.418 (86) | 1.010 / 0.980 |

- The lower shortfall at 5 and 6 comes only from hiding places: Cabo Verde (failing) goes grey
  at 5, together with Liechtenstein and Taiwan (passing). Papua New Guinea goes grey at 6.
- Belarus and the United Arab Emirates fail at every floor. They have 5 and 6 sources; Belarus
  also stays scored at 6 through the danger guard.
- The votes and the 2026-03 reference set cannot judge the data-poor places: the 26 places
  between floors 3 and 5 have 9 votes in all, and none is in the reference set.
- On the 129 places scored at every floor, all metrics are identical by construction.

**B. The error depends on which sources are missing, not on how many.** For each source
combination that a real data-poor place lacks, the test deletes those sources from the 98 places
that have all six, scores them again and compares with their full-data score. Untouched places
moved by 0.0000, so the test is clean.

| Sources left | Missing | Real places | Mean gap | Gap ≥ 0.5 | Bias |
|---|---|---|---|---|---|
| 5 | World Bank | 62 | 0.15 | 0% | −0.12 |
| 5 | GPI | 6 | 0.15 | 5% | +0.05 |
| 4 | GPI + V-Dem (Caribbean, Liechtenstein) | 9 | 0.22 | 7% | −0.01 |
| 4 | INFORM + World Bank (Taiwan) | 1 | 0.35 | 15% | −0.32 |
| 4 | **GPI + World Bank** (COM, CPV, MDV, SLB, STP, VUT) | 6 | **0.51** | **49%** | **−0.50** |
| 3 | GPI + V-Dem + World Bank (grey Pacific places) | 9 | 0.56 | 51% | −0.54 |
| 1 | everything but the advisories | 33 | 0.97 | 77% | −0.96 |

- Without GPI and World Bank a place has no crime data at all: its crime pillar is the
  conservative prior (Cabo Verde: no crime indicator, completeness 0). The test shows that this
  prior reads about half a point too low.
- Corrected with the same-region bias, the six would read:
  - Comoros 6.08 → 6.51
  - Cabo Verde 6.89 → 7.32 (above its 7.0 floor, so C005 would pass)
  - Maldives 7.06 → 7.66
  - Solomon Islands 6.71 → 7.25
  - São Tomé and Príncipe 6.76 → 7.18
  - Vanuatu 7.18 → 7.72
- These six are as unreliable as the 3-source places the floor already greys. The count rule
  cannot tell them apart from the Caribbean pattern (also 4 sources, error 0.22).
- Caveat: the test measures the error on data-rich places with sources removed. For small
  islands it is an estimate, not a measurement; their own votes (1 each for CPV and VUT) cannot
  confirm it.
