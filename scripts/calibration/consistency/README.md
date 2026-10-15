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
| `issues.json` | The findings grouped by root cause (one fix in one place), most severe first: `title`, `severity`, `fixArea`, `languages`, `findings`, `uncertainFindings`, `pages` (rough count, see `pagesNote`), `examples`, `source` (path:line at `siteCommit`), `rootCause`, `proposedFix`, `formulaRelevant`. |
| `corrections.json` | Owner corrections the assembler applies after the verifier, for verdicts that were wrong for a reason the verifier could not see. Each must match a finding, or assembly fails. |

### Finding fields

`id`, `source` (`script` or `swarm`), `review` (`language`, `comparisons`, `plausibility`,
`ordering`), `check` (script check name) or `batch` (reviewer batch), `iso3` (or `ALL`), `lang`,
`url`, `category` (`stale-data`, `irrelevant-indicator`, `generic-text`, `broken-text`,
`contradiction`, `bad-comparison`, `implausible-value`, `implausible-score`, `other`), `severity`
(`high` = misleading for a safety decision or nonsense at the top of the page), `field` (where on the
page), `quote` (exact), `problem`, `expected`, `formulaRelevant`, `fixArea`, `verdict` (`confirmed` /
`uncertain`), `verification` (who checked and what they found), `instances` (for script template
problems), `status` (`open` / `fixed`), `foundOn`, `dataDate`, `siteCommit`. `problem` and
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
