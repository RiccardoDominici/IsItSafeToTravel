#!/usr/bin/env node
/**
 * scripts/calibration/evaluate-consistency.ts
 *
 * Scores a set of country scores against the verified formula constraints of the consistency
 * database (scripts/calibration/consistency/constraints.json): orderings and bounds that a sound
 * formula should satisfy, each traced to a verified finding (see the README next to it).
 *
 * Use it to compare formulas: run it on the published snapshot and on a candidate's output; fewer
 * violations (and a smaller total shortfall) is better, all else equal. It reports, it never fails
 * a build unless --strict is given.
 *
 * Usage:
 *   npx tsx scripts/calibration/evaluate-consistency.ts [scores.json] [--strict]
 *   (default scores: data/scores/latest.json; any file with { countries: [{ iso3, score }] })
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ConstraintKind = 'score_at_most' | 'score_at_least' | 'safer_than' | 'less_safe_than';

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  iso3: string;
  /** A score on the 1-10 scale for the bounds, another ISO3 for the orderings. */
  value: number | string;
  rationale: string;
  finding: string;
}

export interface ConstraintResult {
  id: string;
  status: 'pass' | 'fail' | 'n/a';
  /** How far the score is on the wrong side (0 when it passes; null when not applicable). */
  shortfall: number | null;
  detail: string;
}

type ScoreLookup = ReadonlyMap<string, number | null>;

/** Evaluate every constraint; a place without an official score (grey) makes it "n/a". */
export function evaluateConstraints(constraints: readonly Constraint[], scores: ScoreLookup): ConstraintResult[] {
  return constraints.map((c) => {
    const s = scores.get(c.iso3);
    if (s === undefined || s === null) return { id: c.id, status: 'n/a', shortfall: null, detail: `${c.iso3} has no official score` };
    if (c.kind === 'score_at_most' || c.kind === 'score_at_least') {
      const bound = Number(c.value);
      const gap = c.kind === 'score_at_most' ? s - bound : bound - s;
      const ok = gap <= 0;
      return { id: c.id, status: ok ? 'pass' : 'fail', shortfall: ok ? 0 : gap, detail: `${c.iso3} ${s.toFixed(2)} ${c.kind === 'score_at_most' ? '<=' : '>='} ${bound}` };
    }
    const other = String(c.value);
    const o = scores.get(other);
    if (o === undefined || o === null) return { id: c.id, status: 'n/a', shortfall: null, detail: `${other} has no official score` };
    const gap = c.kind === 'safer_than' ? o - s : s - o;
    const ok = gap < 0;
    return { id: c.id, status: ok ? 'pass' : 'fail', shortfall: ok ? 0 : gap, detail: `${c.iso3} ${s.toFixed(2)} ${c.kind === 'safer_than' ? '>' : '<'} ${other} ${o.toFixed(2)}` };
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const scoresPath = args.find((a) => !a.startsWith('--')) ?? path.join(process.cwd(), 'data', 'scores', 'latest.json');
  const dbPath = path.join(process.cwd(), 'scripts', 'calibration', 'consistency', 'constraints.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as { constraints: Constraint[] };
  const snapshot = JSON.parse(fs.readFileSync(scoresPath, 'utf-8')) as { date?: string; countries: Array<{ iso3: string; score: number | null }> };
  const scores = new Map(snapshot.countries.map((c) => [c.iso3, typeof c.score === 'number' ? c.score : null]));
  const results = evaluateConstraints(db.constraints, scores);
  const fails = results.filter((r) => r.status === 'fail');
  const na = results.filter((r) => r.status === 'n/a').length;
  const total = results.length - na;
  const shortfall = fails.reduce((sum, r) => sum + (r.shortfall ?? 0), 0);
  console.log(`[CONSISTENCY] ${path.relative(process.cwd(), scoresPath)}${snapshot.date ? ` (${snapshot.date})` : ''}: ${total - fails.length}/${total} constraints pass, ${fails.length} fail (total shortfall ${shortfall.toFixed(2)} points), ${na} not applicable`);
  for (const r of fails.sort((a, b) => (b.shortfall ?? 0) - (a.shortfall ?? 0))) {
    const c = db.constraints.find((x) => x.id === r.id)!;
    console.log(`  FAIL ${r.id} ${r.detail} (short by ${(r.shortfall ?? 0).toFixed(2)}): ${c.rationale}`);
  }
  if (strict && fails.length > 0) process.exitCode = 1;
}

// Run only as a script, so tests can import evaluateConstraints without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
