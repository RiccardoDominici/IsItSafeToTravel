#!/usr/bin/env node
/**
 * scripts/audit/recheck-findings.ts
 *
 * Re-checks the consistency database (scripts/calibration/consistency/) after a release and
 * merges the result into it IN PLACE, keeping every id: findings get `status` + `recheck`, issues
 * get `status` + `recheck` (counts per finding status). First run 2026-10-17, after the release
 * that fixed the 2026-10-15 audit (see README "Re-check").
 *
 * Three inputs decide a finding's status, the first that applies wins:
 *  1. Review verdicts (`--verdicts`, JSON arrays of { id, status, evidence, note? }) for what the
 *     two checks below cannot settle: quotes still present (the defect may be fixed elsewhere on
 *     the page), quotes never found verbatim (reviewer paraphrase), and partial fixes. Verdict
 *     statuses: fixed, superseded (the element is gone with the score, e.g. a place turned grey;
 *     stored as fixed), partial, open, by-design, cannot-tell (stored as unverified).
 *  2. The formula constraint a finding produced (constraints.json `finding`/`alsoFindings`),
 *     evaluated on `--scores` (default data/scores/latest.json): pass -> fixed, fail -> open,
 *     place now grey -> fixed. A score finding's quote vanishes as soon as the number changes, so
 *     the quote alone would call "UAE 7.3 is too high" fixed at 7.2.
 *  3. A mechanical quote search: the finding's `quote` is looked up on the OLD pages (the audit's
 *     page texts) and on the NEW pages (extract-page-facts.ts on the new build), once verbatim and
 *     once with every number masked. Text is compared with decimal commas read as dots (it/es/fr/
 *     pt/de print 6,7 since 2026-10-16), typographic quotes and spaces folded. A quote that was on
 *     the old pages and is gone from the new ones, even with numbers masked, counts as fixed: on
 *     2026-10-17 an adversarial review of 40 such findings confirmed 40 of 40.
 * A finding none of the three settles stays `unverified`, never `fixed`.
 *
 * Usage:
 *   npx tsx scripts/audit/recheck-findings.ts --old <oldFactsDir> --new <newFactsDir>
 *     --date YYYY-MM-DD --commit <siteCommit> [--verdicts a.json,b.json] [--scores <scores.json>] [--dry-run]
 * <dir> is an extract-page-facts.ts output directory (it holds pages/<ISO3>.<lang>.txt).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateConstraints, type Constraint, type ConstraintResult } from '../calibration/evaluate-consistency.js';

const DB_DIR = path.join(process.cwd(), 'scripts', 'calibration', 'consistency');

export type FindingStatus = 'fixed' | 'partial' | 'open' | 'by-design' | 'unverified';
export type QuoteState = 'gone' | 'still-present' | 'unmatched';
type VerdictStatus = 'fixed' | 'superseded' | 'partial' | 'open' | 'by-design' | 'cannot-tell';

export interface Verdict {
  id: string;
  status: VerdictStatus;
  evidence: string;
  note?: string;
}

interface Finding {
  id: string;
  iso3: string;
  lang: string;
  quote: string;
  status?: string;
  recheck?: unknown;
  [key: string]: unknown;
}

interface Issue {
  id: string;
  findings: string[];
  uncertainFindings?: string[];
  status?: string;
  recheck?: unknown;
  [key: string]: unknown;
}

/** Fold what a re-render may change without changing the text: spaces, quote marks, decimal commas. */
export function normalizeText(s: string, maskNumbers = false): string {
  let t = s
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/(?<=\d),(?=\d)/g, '.')
    .replace(/\s+/g, ' ');
  if (maskNumbers) t = t.replace(/\d+(?:\.\d+)?/g, '#');
  return t.trim();
}

/** The searchable pieces of a quote: reviewers join excerpts with "...", "…", " / " or newlines. */
export function quoteSegments(quote: string, maskNumbers = false): string[] {
  const segs = quote
    .split(/\s*(?:\.\.\.|…|\n| \/ )\s*/)
    .map((p) => normalizeText(p, maskNumbers).replace(/^[\s\-|"']+|[\s\-|"']+$/g, ''))
    .filter((p) => p.length >= 8);
  return segs.length > 0 ? segs : [normalizeText(quote, maskNumbers)];
}

interface Corpus {
  byPage: Map<string, string>;
  byLang: Map<string, string>;
}

function loadCorpus(factsDir: string, maskNumbers: boolean): Corpus {
  const pagesDir = path.join(factsDir, 'pages');
  const byPage = new Map<string, string>();
  const parts = new Map<string, string[]>();
  for (const name of fs.readdirSync(pagesDir)) {
    const m = /^([A-Z]{3})\.([a-z]{2})\.txt$/.exec(name);
    if (!m) continue;
    const text = normalizeText(fs.readFileSync(path.join(pagesDir, name), 'utf-8'), maskNumbers);
    byPage.set(`${m[1]}.${m[2]}`, text);
    parts.set(m[2], [...(parts.get(m[2]) ?? []), text]);
  }
  return { byPage, byLang: new Map([...parts].map(([lang, texts]) => [lang, texts.join('\n')])) };
}

/**
 * Where a quote is, on the old and the new pages. A finding about one place is searched on that
 * page; a template finding (iso3 "ALL") or a quote the reviewer took from a neighbouring page of
 * its batch is searched across every page of the language.
 */
export function quoteState(f: Pick<Finding, 'iso3' | 'lang' | 'quote'>, oldC: Corpus, newC: Corpus, maskNumbers: boolean): QuoteState {
  const segs = quoteSegments(f.quote ?? '', maskNumbers);
  const has = (c: Corpus, pageWide: boolean) => {
    const hay = pageWide ? c.byPage.get(`${f.iso3}.${f.lang}`) : c.byLang.get(f.lang);
    return hay !== undefined && segs.every((s) => hay.includes(s));
  };
  let pageWide = f.iso3 !== 'ALL';
  let onOld = has(oldC, pageWide);
  if (!onOld && pageWide) {
    pageWide = false;
    onOld = has(oldC, false);
  }
  if (!onOld) return 'unmatched';
  return has(newC, pageWide) ? 'still-present' : 'gone';
}

const VERDICT_TO_STATUS: Record<VerdictStatus, FindingStatus> = {
  fixed: 'fixed',
  superseded: 'fixed',
  partial: 'partial',
  open: 'open',
  'by-design': 'by-design',
  'cannot-tell': 'unverified',
};

/**
 * An issue's status from its findings' statuses: anything open makes it open (partial when some of
 * it is fixed), anything unsettled keeps it unverified, and an issue with nothing left to do is
 * fixed or by-design, whichever covers more of its findings (I34: the indicators left the table,
 * fixed, but stay in the score, by design).
 */
export function rollUp(statuses: FindingStatus[]): FindingStatus {
  const n = (s: FindingStatus) => statuses.filter((x) => x === s).length;
  if (statuses.length === 0) return 'unverified';
  if (n('open') + n('partial') > 0) return n('fixed') + n('partial') > 0 ? 'partial' : 'open';
  if (n('unverified') > 0) return n('fixed') > 0 ? 'partial' : 'unverified';
  return n('by-design') > n('fixed') ? 'by-design' : 'fixed';
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const oldDir = arg('--old');
  const newDir = arg('--new');
  const date = arg('--date');
  const commit = arg('--commit');
  if (!oldDir || !newDir || !date || !commit) {
    console.error('Usage: recheck-findings.ts --old <dir> --new <dir> --date YYYY-MM-DD --commit <sha> [--verdicts a.json,b.json] [--dry-run]');
    process.exit(1);
  }
  const verdicts = new Map<string, Verdict>();
  for (const file of (arg('--verdicts') ?? '').split(',').filter(Boolean)) {
    for (const v of JSON.parse(fs.readFileSync(file, 'utf-8')) as Verdict[]) {
      if (!(v.status in VERDICT_TO_STATUS)) throw new Error(`${file}: ${v.id} has unknown status "${v.status}"`);
      verdicts.set(v.id, v); // later files win: pass manual overrides last
    }
  }

  const findingsPath = path.join(DB_DIR, 'findings.json');
  const issuesPath = path.join(DB_DIR, 'issues.json');
  const findingsDb = JSON.parse(fs.readFileSync(findingsPath, 'utf-8')) as { findings: Finding[]; [k: string]: unknown };
  const issuesDb = JSON.parse(fs.readFileSync(issuesPath, 'utf-8')) as { issues: Issue[]; [k: string]: unknown };
  const known = new Set(findingsDb.findings.map((f) => f.id));
  const stale = [...verdicts.keys()].filter((id) => !known.has(id));
  if (stale.length > 0) throw new Error(`verdicts for unknown findings: ${stale.join(', ')}`);

  // Formula constraints, evaluated on the new scores, keyed by every finding that proposed them.
  const scoresPath = arg('--scores') ?? path.join(process.cwd(), 'data', 'scores', 'latest.json');
  const snapshot = JSON.parse(fs.readFileSync(scoresPath, 'utf-8')) as { countries: Array<{ iso3: string; score: number | null }> };
  const scores = new Map(snapshot.countries.map((c) => [c.iso3, typeof c.score === 'number' ? c.score : null]));
  const constraints = (JSON.parse(fs.readFileSync(path.join(DB_DIR, 'constraints.json'), 'utf-8')) as {
    constraints: Array<Constraint & { alsoFindings?: string[] }>;
  }).constraints;
  const constraintOf = new Map<string, ConstraintResult>();
  evaluateConstraints(constraints, scores).forEach((r, i) => {
    for (const id of [constraints[i].finding, ...(constraints[i].alsoFindings ?? [])]) constraintOf.set(id, r);
  });

  const corpora = {
    plain: { old: loadCorpus(oldDir, false), new: loadCorpus(newDir, false) },
    masked: { old: loadCorpus(oldDir, true), new: loadCorpus(newDir, true) },
  };
  const statusOf = new Map<string, FindingStatus>();
  for (const f of findingsDb.findings) {
    const plain = quoteState(f, corpora.plain.old, corpora.plain.new, false);
    const masked = quoteState(f, corpora.masked.old, corpora.masked.new, true);
    const v = verdicts.get(f.id);
    let status: FindingStatus;
    let recheck: Record<string, unknown>;
    if (v) {
      status = VERDICT_TO_STATUS[v.status];
      recheck = { date, siteCommit: commit, method: 'review', verdict: v.status, quote: `${plain}/${masked}`, evidence: v.evidence, ...(v.note ? { note: v.note } : {}) };
    } else if (constraintOf.has(f.id)) {
      const r = constraintOf.get(f.id)!;
      status = r.status === 'fail' ? 'open' : 'fixed';
      recheck = { date, siteCommit: commit, method: 'constraint', constraint: r.id, result: r.status, evidence: r.detail };
    } else if (plain === 'gone' && masked === 'gone') {
      status = 'fixed';
      recheck = { date, siteCommit: commit, method: 'quote', quote: 'gone/gone', evidence: 'The quoted text is no longer on the new pages, even with numbers masked.' };
    } else {
      status = 'unverified';
      recheck = { date, siteCommit: commit, method: 'quote', quote: `${plain}/${masked}`, evidence: 'Needs a review verdict: the quote is still on the pages or was never found verbatim.' };
    }
    f.status = status;
    f.recheck = recheck;
    statusOf.set(f.id, status);
  }

  for (const issue of issuesDb.issues) {
    const ids = [...issue.findings, ...(issue.uncertainFindings ?? [])];
    const statuses = ids.map((id) => statusOf.get(id) ?? 'unverified');
    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1;
    issue.status = rollUp(statuses);
    issue.recheck = { date, siteCommit: commit, counts };
  }

  const tally = (xs: Array<{ status?: string }>) =>
    xs.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.status ?? '?']: (acc[x.status ?? '?'] ?? 0) + 1 }), {});
  console.log(`[RECHECK] findings: ${JSON.stringify(tally(findingsDb.findings))}`);
  console.log(`[RECHECK] issues: ${JSON.stringify(tally(issuesDb.issues))}`);
  for (const issue of issuesDb.issues.filter((i) => i.status !== 'fixed')) {
    console.log(`  ${issue.id} ${issue.status} ${JSON.stringify((issue.recheck as { counts: object }).counts)}`);
  }
  if (process.argv.includes('--dry-run')) return;
  findingsDb.recheckedOn = date;
  issuesDb.recheckedOn = date;
  fs.writeFileSync(findingsPath, `${JSON.stringify(findingsDb, null, 1)}\n`);
  fs.writeFileSync(issuesPath, `${JSON.stringify(issuesDb, null, 1)}\n`);
  console.log(`[RECHECK] wrote ${path.relative(process.cwd(), findingsPath)} and ${path.relative(process.cwd(), issuesPath)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
