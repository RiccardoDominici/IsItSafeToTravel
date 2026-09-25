/**
 * Advisory-quality monitor (audit 2026-09-25, workstream B) — WARN-ONLY.
 *
 * A hard "is the count high enough" floor (source-floor.ts) cannot see a
 * failure mode where an issuer keeps producing a PLAUSIBLE COUNT full of
 * WRONG or STALE values. This script watches for the two signatures found
 * live on 2026-09-25:
 *
 *   (a) Level-<=1 contradictions — an issuer reports "normal precautions"
 *       for a country where >= MIN_OTHER_ISSUERS other issuers median
 *       >= CONTRADICTION_MEDIAN_MIN. This is the fingerprint of a parser
 *       defaulting to level 1 instead of skipping when it can't determine a
 *       real level (exactly the hk/dk/ch/rs bug fixed the same day this
 *       script was added — see src/pipeline/normalize/advisory-levels.ts).
 *   (b) Frozen issuers — every one of an issuer's dated entries shares the
 *       EXACT SAME updatedAt date, weeks or months old. This is the
 *       fingerprint of source-floor.ts endlessly re-restoring the same
 *       stale cache (the failure MAX_RESTORE_AGE_DAYS now bounds).
 *
 * Always exits 0 — this is a monitor, never a gate; the existing hard
 * pass/fail checks in .github/workflows/data-pipeline.yml's "Verify data
 * quality" step are untouched. Findings are printed as GitHub Actions
 * `::warning::` lines (the Actions UI turns any such line in a step's log
 * into an annotation, no special redirection needed) plus a Markdown table
 * appended to $GITHUB_STEP_SUMMARY when running in CI. Both also print to
 * stdout unconditionally, so a local/manual run (see Usage) shows the same
 * report without any GitHub-specific environment.
 *
 * Usage: npx tsx scripts/check-advisory-quality.ts [path/to/scores.json]
 *   (defaults to public/scores.json)
 */
import { appendFileSync } from 'node:fs';
import { readJson } from '../src/pipeline/utils/fs.js';
import type { DailySnapshot, AdvisoryInfo, ScoredCountry } from '../src/pipeline/types.js';

// --- (a) level-<=1 contradiction thresholds ---
/** A level-<=1 entry only counts as contradicted if this many OTHER issuers have data for the same country. */
const MIN_OTHER_ISSUERS = 4;
/** ...and their median level is at least this severe. */
const CONTRADICTION_MEDIAN_MIN = 3;
/** An issuer is only worth a warning once it has MORE than this many contradicting countries. */
const CONTRADICTION_WARN_THRESHOLD = 3;

// --- (b) frozen-issuer thresholds ---
/** Below this many dated entries, "they're all the same date" is too small a sample to mean anything. */
const MIN_DATED_ENTRIES_FOR_FROZEN = 5;
/** The shared date must be at least this many days old. */
const FROZEN_MIN_AGE_DAYS = 30;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Whole-day difference between two YYYY-MM-DD dates. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(Math.round(ms / 86_400_000));
}

/** ScoredCountry.advisories has a fixed-key type; issuer keys are iterated generically here. */
type LooseAdvisories = Record<string, AdvisoryInfo | undefined>;
const loose = (c: ScoredCountry): LooseAdvisories => c.advisories as unknown as LooseAdvisories;

interface ContradictionFinding {
  issuer: string;
  count: number;
  examples: string[]; // iso3, capped
}

interface FrozenFinding {
  issuer: string;
  date: string;
  ageDays: number;
  entryCount: number;
}

/** (a) Per-issuer countries where a level<=1 entry contradicts the other issuers' median. */
function findContradictions(countries: ScoredCountry[]): ContradictionFinding[] {
  const perIssuer = new Map<string, string[]>(); // issuer -> iso3[]

  for (const country of countries) {
    const advisories = loose(country);
    const issuerKeys = Object.keys(advisories);

    for (const issuer of issuerKeys) {
      const level = Number(advisories[issuer]?.level);
      if (!Number.isFinite(level) || level > 1) continue;

      const otherLevels = issuerKeys
        .filter((k) => k !== issuer)
        .map((k) => Number(advisories[k]?.level))
        .filter((n) => Number.isFinite(n));
      if (otherLevels.length < MIN_OTHER_ISSUERS) continue;

      if (median(otherLevels) >= CONTRADICTION_MEDIAN_MIN) {
        if (!perIssuer.has(issuer)) perIssuer.set(issuer, []);
        perIssuer.get(issuer)!.push(country.iso3);
      }
    }
  }

  const findings: ContradictionFinding[] = [];
  for (const [issuer, isoList] of perIssuer) {
    if (isoList.length > CONTRADICTION_WARN_THRESHOLD) {
      findings.push({ issuer, count: isoList.length, examples: isoList.slice(0, 8) });
    }
  }
  return findings.sort((a, b) => b.count - a.count);
}

/** (b) Issuers whose every dated entry shares one updatedAt date, itself older than FROZEN_MIN_AGE_DAYS. */
function findFrozenIssuers(countries: ScoredCountry[], referenceDate: string): FrozenFinding[] {
  const datesByIssuer = new Map<string, Set<string>>();
  const countByIssuer = new Map<string, number>();

  for (const country of countries) {
    for (const [issuer, entry] of Object.entries(loose(country))) {
      if (!entry?.updatedAt) continue;
      const date = entry.updatedAt.slice(0, 10); // YYYY-MM-DD — ignore time-of-day jitter
      if (!datesByIssuer.has(issuer)) datesByIssuer.set(issuer, new Set());
      datesByIssuer.get(issuer)!.add(date);
      countByIssuer.set(issuer, (countByIssuer.get(issuer) ?? 0) + 1);
    }
  }

  const findings: FrozenFinding[] = [];
  for (const [issuer, dates] of datesByIssuer) {
    const entryCount = countByIssuer.get(issuer) ?? 0;
    if (dates.size !== 1 || entryCount < MIN_DATED_ENTRIES_FOR_FROZEN) continue;
    const [date] = dates;
    const ageDays = daysBetween(referenceDate, date);
    if (ageDays > FROZEN_MIN_AGE_DAYS) findings.push({ issuer, date, ageDays, entryCount });
  }
  return findings.sort((a, b) => b.ageDays - a.ageDays);
}

function buildMarkdownSummary(
  snapPath: string,
  referenceDate: string,
  contradictions: ContradictionFinding[],
  frozen: FrozenFinding[],
): string {
  const lines: string[] = [];
  lines.push('## Advisory quality monitor (non-blocking)');
  lines.push('');
  lines.push(`Source: \`${snapPath}\` — reference date \`${referenceDate}\``);
  lines.push('');

  lines.push('### Level-≤1 contradictions');
  if (contradictions.length === 0) {
    lines.push(
      `No issuer has more than ${CONTRADICTION_WARN_THRESHOLD} countries where it reports <=1 while ` +
      `>=${MIN_OTHER_ISSUERS} other issuers median >=${CONTRADICTION_MEDIAN_MIN}.`,
    );
  } else {
    lines.push('| Issuer | Contradicting countries | Examples |');
    lines.push('|---|---|---|');
    for (const f of contradictions) {
      const more = f.count > f.examples.length ? ', ...' : '';
      lines.push(`| ${f.issuer.toUpperCase()} | ${f.count} | ${f.examples.join(', ')}${more} |`);
    }
  }
  lines.push('');

  lines.push('### Frozen issuers');
  if (frozen.length === 0) {
    lines.push(`No issuer has all its dated entries stuck on one date older than ${FROZEN_MIN_AGE_DAYS} days.`);
  } else {
    lines.push('| Issuer | Stuck date | Age (days) | Dated entries |');
    lines.push('|---|---|---|---|');
    for (const f of frozen) {
      lines.push(`| ${f.issuer.toUpperCase()} | ${f.date} | ${f.ageDays} | ${f.entryCount} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

function main(): void {
  const snapPath = process.argv[2] ?? 'public/scores.json';
  const data = readJson<DailySnapshot>(snapPath);

  if (!data || !Array.isArray(data.countries) || data.countries.length === 0) {
    console.log(
      `::warning::check-advisory-quality: could not read a valid snapshot from ${snapPath} — skipping (non-blocking)`,
    );
    process.exit(0);
  }

  const referenceDate = data.date || new Date().toISOString().slice(0, 10);
  const contradictions = findContradictions(data.countries);
  const frozen = findFrozenIssuers(data.countries, referenceDate);

  for (const f of contradictions) {
    console.log(
      `::warning::check-advisory-quality: ${f.issuer.toUpperCase()} reports level<=1 for ${f.count} countries ` +
      `where >=${MIN_OTHER_ISSUERS} other issuers median >=${CONTRADICTION_MEDIAN_MIN} ` +
      `(e.g. ${f.examples.slice(0, 5).join(', ')}) — parser may be defaulting instead of skipping`,
    );
  }
  for (const f of frozen) {
    console.log(
      `::warning::check-advisory-quality: ${f.issuer.toUpperCase()} has all ${f.entryCount} dated entries stuck ` +
      `on ${f.date} (${f.ageDays}d old) — likely a stale source-floor restore or a dead parser`,
    );
  }

  const summary = buildMarkdownSummary(snapPath, referenceDate, contradictions, frozen);
  console.log('');
  console.log(summary);

  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    try {
      appendFileSync(stepSummaryPath, `\n${summary}\n`, 'utf-8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`::warning::check-advisory-quality: could not append to GITHUB_STEP_SUMMARY: ${msg}`);
    }
  }

  // Monitor, not a gate — always succeed regardless of what was found above.
  process.exit(0);
}

main();
