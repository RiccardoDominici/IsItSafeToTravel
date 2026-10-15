#!/usr/bin/env node
/**
 * scripts/audit/assemble-consistency-db.ts
 *
 * Last step of the consistency audit (scripts/calibration/consistency/README.md): merges the
 * deterministic findings (check-page-consistency.ts) and the verified reviewer findings (the swarm
 * workflows in scripts/audit/workflows/) into the database:
 *
 *   findings.json           confirmed and "uncertain" findings, most severe first
 *   findings-rejected.json  what the verifier rejected (or never verified), to measure reviewer precision
 *   constraints.json        machine-checkable formula constraints taken from confirmed findings
 *
 * corrections.json (in the output directory, optional) overrides verdicts the verifier got wrong
 * for a reason it could not see, e.g. a mistake in the audit brief; every correction must match a
 * finding, so a stale one fails loudly instead of silently doing nothing.
 *
 * Constraints are normalised before they are written: "B less_safe_than A" becomes "A safer_than B",
 * the same ordering proposed twice is kept once, two bounds of one kind on one place collapse to the
 * looser (more defensible) one, and contradictory pairs are dropped with a warning — a database that
 * contradicts itself cannot rank formulas.
 *
 * Usage:
 *   npx tsx scripts/audit/assemble-consistency-db.ts --auto <auto-findings.json> --swarm <result.json>
 *     [--swarm <result.json> ...] --commit <siteCommit> [--found-on YYYY-MM-DD] [--out <dir>] [--corrections <file>]
 * Each swarm file is a workflow result { batches, findings[] } whose findings carry `verification`.
 * Reads data/scores/latest.json for the data date.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLocalizedPath } from '../../src/i18n/utils.js';
import type { Lang } from '../../src/i18n/ui.js';
import type { AutoFinding } from './check-page-consistency.js';
import type { Constraint, ConstraintKind } from '../calibration/evaluate-consistency.js';

const LANGS = new Set(['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']);
const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface Verification {
  index?: number;
  verdict: 'confirmed' | 'rejected' | 'uncertain';
  reason: string;
  category: string;
  severity: string;
  fixArea: string;
  constraintKind: ConstraintKind | 'none';
  constraintValue: string;
}

export interface SwarmFinding {
  iso3: string;
  lang: string;
  category: string;
  severity: string;
  field: string;
  quote: string;
  problem: string;
  expected: string;
  formulaRelevant?: boolean;
  constraintKind?: string;
  constraintValue?: string;
  batch?: string;
  parent?: string;
  kind?: string;
  verification?: Verification | null;
}

export interface DbFinding {
  id: string;
  source: 'script' | 'swarm';
  review: string | null;
  check: string | null;
  batch: string | null;
  iso3: string;
  lang: string;
  url: string | null;
  category: string;
  severity: string;
  field: string;
  quote: string;
  problem: string;
  expected: string;
  formulaRelevant: boolean;
  fixArea: string;
  verdict: 'confirmed' | 'uncertain' | 'rejected' | 'unverified';
  verification: string;
  instances?: number;
  examples?: string[];
  reviewerCategory?: string;
  reviewerSeverity?: string;
  constraintKind?: string;
  constraintValue?: string;
  status?: 'open' | 'fixed';
  foundOn?: string;
  dataDate?: string;
  siteCommit?: string;
}

const pageUrl = (iso3: string, lang: string): string | null =>
  iso3 && iso3 !== 'ALL' && LANGS.has(lang) ? `https://isitsafetotravel.org${getLocalizedPath(`/en/country/${iso3.toLowerCase()}/`, lang as Lang)}` : null;

export interface Correction {
  match: { batch: string; iso3: string; lang: string; quote: string };
  verdict: 'confirmed' | 'rejected' | 'uncertain';
  reason: string;
  decidedOn?: string;
}

/**
 * Apply owner corrections to the reviewer findings (returns new objects, input untouched). The
 * verifier's note is kept after the owner's reason, so the record shows both judgements.
 * Throws when a correction matches no finding: it would be stale and hide a change in the data.
 */
export function applyCorrections(findings: SwarmFinding[], corrections: Correction[]): SwarmFinding[] {
  const used = new Set<number>();
  const out = findings.map((f) => {
    const k = corrections.findIndex((c) => c.match.batch === f.batch && c.match.iso3 === f.iso3 && c.match.lang === f.lang && c.match.quote === f.quote);
    if (k < 0 || !f.verification) return f;
    used.add(k);
    const c = corrections[k];
    return { ...f, verification: { ...f.verification, verdict: c.verdict, reason: `owner correction${c.decidedOn ? ` ${c.decidedOn}` : ''}: ${c.reason} Verifier had said: ${f.verification.reason}` } };
  });
  const stale = corrections.filter((_, k) => !used.has(k));
  if (stale.length) throw new Error(`${stale.length} correction(s) match no verified finding, e.g. ${JSON.stringify(stale[0].match)}`);
  return out;
}

/** One finding per deterministic template problem (same check, language and kind of field), with its page count. */
export function groupAutoFindings(auto: AutoFinding[]): Array<Omit<DbFinding, 'id'>> {
  const groups = new Map<string, AutoFinding[]>();
  for (const f of auto) {
    const [head, sub] = f.field.split(' ');
    const key = `${f.check}|${f.lang}|${head}${sub ? ` ${sub[0]}` : ''}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, items]) => {
    const ex = items[0];
    const multi = items.length > 1;
    return {
      source: 'script', review: null, check: ex.check, batch: null,
      iso3: multi ? 'ALL' : ex.iso3, lang: ex.lang, url: multi ? null : pageUrl(ex.iso3, ex.lang),
      category: ex.category, severity: ex.severity, field: multi ? key.split('|')[2] : ex.field,
      quote: ex.quote, problem: ex.problem + (multi ? ` Seen on ${items.length} pages, e.g. ${items.slice(0, 4).map((i) => i.iso3).join(', ')}.` : ''),
      expected: ex.expected, formulaRelevant: false, fixArea: 'copy-template', verdict: 'confirmed',
      verification: 'script: deterministic check', instances: items.length, examples: items.slice(0, 8).map((i) => i.iso3),
    };
  });
}

/** A reviewer finding with the verifier's verdict folded in (the verifier may re-categorise it). */
export function toDbFinding(f: SwarmFinding): Omit<DbFinding, 'id'> {
  const v = f.verification ?? null;
  return {
    source: 'swarm', review: f.kind ?? null, check: null, batch: f.batch ?? null,
    iso3: f.iso3, lang: f.lang, url: pageUrl(f.iso3, f.lang),
    category: v?.category || f.category, severity: v?.severity || f.severity,
    field: f.field, quote: f.quote, problem: f.problem, expected: f.expected,
    formulaRelevant: !!f.formulaRelevant, fixArea: v?.fixArea || 'other',
    verdict: v?.verdict ?? 'unverified', verification: v ? (v.reason.startsWith('owner correction') ? v.reason : `opus: ${v.reason}`) : 'none',
    reviewerCategory: f.category, reviewerSeverity: f.severity,
    constraintKind: v?.constraintKind ?? 'none', constraintValue: v?.constraintValue ?? '',
  };
}

export interface ConstraintBuild { constraints: Constraint[]; conflicts: string[]; merged: number }

/**
 * Formula constraints from confirmed findings, normalised (see the header): orderings as
 * safer_than, duplicates merged, the looser of two bounds kept, contradictions dropped.
 */
export function buildConstraints(findings: DbFinding[]): ConstraintBuild {
  type Draft = { kind: ConstraintKind; iso3: string; value: number | string; rationale: string; finding: string; also: string[] };
  const drafts = new Map<string, Draft>();
  let merged = 0;
  for (const r of findings) {
    if (r.verdict !== 'confirmed' || !r.constraintKind || r.constraintKind === 'none' || r.iso3 === 'ALL') continue;
    const raw = String(r.constraintValue ?? '').trim();
    let kind = r.constraintKind as ConstraintKind;
    let iso3 = r.iso3.toUpperCase();
    let value: number | string;
    if (kind === 'score_at_most' || kind === 'score_at_least') {
      value = Math.round(Number(raw) * 100) / 100;
      if (!Number.isFinite(value) || value < 1 || value > 10) continue;
    } else {
      value = raw.toUpperCase();
      if (!/^[A-Z]{3}$/.test(value) || value === iso3) continue;
      if (kind === 'less_safe_than') [kind, iso3, value] = ['safer_than', value, iso3];
    }
    // The verifier may have corrected the reviewer's constraint, so its note is the rationale that
    // matches the constraint actually kept; the reviewer's wording is the fallback.
    const rationale = r.verification.startsWith('opus: ') ? r.verification.slice(6) : r.problem;
    const key = kind === 'safer_than' ? `${kind}|${iso3}|${value}` : `${kind}|${iso3}`;
    const prev = drafts.get(key);
    if (!prev) {
      drafts.set(key, { kind, iso3, value, rationale, finding: r.id, also: [] });
      continue;
    }
    merged++;
    const looser = kind === 'score_at_most' ? (value as number) > (prev.value as number) : kind === 'score_at_least' ? (value as number) < (prev.value as number) : false;
    if (looser) drafts.set(key, { kind, iso3, value, rationale, finding: r.id, also: [prev.finding, ...prev.also] });
    else prev.also.push(r.id);
  }
  // Contradictions: A safer than B and B safer than A; or a lower bound above an upper bound.
  const conflicts: string[] = [];
  const drop = new Set<string>();
  for (const [key, d] of drafts) {
    const reverse = `safer_than|${d.value}|${d.iso3}`;
    if (d.kind === 'safer_than' && drafts.has(reverse) && !drop.has(key)) {
      drop.add(key).add(reverse);
      conflicts.push(`${d.iso3} safer_than ${d.value} (${d.finding}) vs the reverse (${drafts.get(reverse)!.finding})`);
    }
    if (d.kind === 'score_at_least') {
      const upper = drafts.get(`score_at_most|${d.iso3}`);
      if (upper && (upper.value as number) < (d.value as number)) {
        drop.add(key).add(`score_at_most|${d.iso3}`);
        conflicts.push(`${d.iso3} at least ${d.value} (${d.finding}) vs at most ${upper.value} (${upper.finding})`);
      }
    }
  }
  const constraints = [...drafts.entries()].filter(([k]) => !drop.has(k)).map(([, d], i) => ({
    id: `C${String(i + 1).padStart(3, '0')}`, kind: d.kind, iso3: d.iso3, value: d.value, rationale: d.rationale, finding: d.finding,
    ...(d.also.length ? { alsoFindings: d.also } : {}),
  }));
  return { constraints, conflicts, merged };
}

function main(): void {
  const args = process.argv.slice(2);
  const all = (flag: string): string[] => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
  const one = (flag: string): string | undefined => all(flag)[0];
  const autoPath = one('--auto');
  const swarmPaths = all('--swarm');
  const commit = one('--commit');
  if (!autoPath || !swarmPaths.length || !commit) throw new Error('usage: assemble-consistency-db.ts --auto <file> --swarm <file> [--swarm <file>...] --commit <sha> [--found-on YYYY-MM-DD] [--out <dir>] [--corrections <file>]');
  const outDir = one('--out') ?? path.join(process.cwd(), 'scripts', 'calibration', 'consistency');
  const latest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'scores', 'latest.json'), 'utf-8')) as { date: string };
  const foundOn = one('--found-on') ?? latest.date;

  const auto = JSON.parse(fs.readFileSync(autoPath, 'utf-8')) as { findings: AutoFinding[] };
  const correctionsPath = one('--corrections') ?? path.join(outDir, 'corrections.json');
  const corrections = fs.existsSync(correctionsPath) ? (JSON.parse(fs.readFileSync(correctionsPath, 'utf-8')) as { corrections: Correction[] }).corrections : [];
  const swarm = applyCorrections(swarmPaths.flatMap((p) => (JSON.parse(fs.readFileSync(p, 'utf-8')) as { findings: SwarmFinding[] }).findings), corrections);

  const kept: Array<Omit<DbFinding, 'id'>> = [...groupAutoFindings(auto.findings)];
  const rejected: Array<Omit<DbFinding, 'id'>> = [];
  for (const f of swarm) {
    const r = toDbFinding(f);
    (r.verdict === 'confirmed' || r.verdict === 'uncertain' ? kept : rejected).push(r);
  }
  kept.sort((a, b) =>
    Number(a.verdict !== 'confirmed') - Number(b.verdict !== 'confirmed')
    || (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    || a.category.localeCompare(b.category) || a.iso3.localeCompare(b.iso3) || a.lang.localeCompare(b.lang));
  const stamp = { status: 'open' as const, foundOn, dataDate: latest.date, siteCommit: commit };
  const findings: DbFinding[] = kept.map((r, i) => ({ id: `F${String(i + 1).padStart(4, '0')}`, ...r, ...stamp }));
  const rejectedDb: DbFinding[] = rejected.map((r, i) => ({ id: `R${String(i + 1).padStart(4, '0')}`, ...r }));
  const { constraints, conflicts, merged } = buildConstraints(findings);

  const meta = { version: 1, foundOn, dataDate: latest.date, siteCommit: commit, pages: 1736, method: 'scripts/calibration/consistency/README.md' };
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name: string, body: object) => fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(body, null, 1)}\n`);
  write('findings.json', { ...meta, count: findings.length, findings });
  write('findings-rejected.json', { ...meta, count: rejectedDb.length, findings: rejectedDb });
  write('constraints.json', { ...meta, count: constraints.length, conflictsDropped: conflicts, constraints });

  const tally = (rows: DbFinding[], key: keyof DbFinding) => Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [String(r[key])]: (m[String(r[key])] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  if (corrections.length) console.log(`[CONSISTENCY-DB] ${corrections.length} owner correction(s) applied from ${path.relative(process.cwd(), correctionsPath)}`);
  console.log(`[CONSISTENCY-DB] ${findings.length} finding(s) kept, ${rejectedDb.length} rejected/unverified, ${constraints.length} constraint(s) (${merged} duplicate(s) merged, ${conflicts.length} contradiction(s) dropped) -> ${path.relative(process.cwd(), outDir)}`);
  console.log(`[CONSISTENCY-DB] verdict: ${tally(findings, 'verdict')}`);
  console.log(`[CONSISTENCY-DB] category: ${tally(findings, 'category')}`);
  console.log(`[CONSISTENCY-DB] fixArea: ${tally(findings, 'fixArea')}`);
  for (const c of conflicts) console.warn(`[CONSISTENCY-DB] contradiction dropped: ${c}`);
}

// Run only as a script, so tests can import the helpers without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
