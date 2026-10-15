#!/usr/bin/env node
/**
 * scripts/calibration/compare-formulas.ts
 *
 * The formula gate table: scores one raw date offline with several formula variants and prints,
 * per variant, the four checks a formula change must pass before it ships (formula v10.1 owner
 * decision, 2026-10-15: "fix all five, with a gate"):
 *
 *  (a) constraints  scripts/calibration/consistency/constraints.json: pass count and total shortfall,
 *                   split into the 7 structural and the 7 situational constraints (README caveats:
 *                   they were found on v10's own errors, and the situational ones depend on the
 *                   advisories of 2026-10-15). "margin" also charges an ordering that holds by less
 *                   than 0.1 point (several verifiers asked for a margin, e.g. C012 Sudan/South Sudan).
 *  (b) votes        data/sentiment/<date>.json (else latest.json): every country with at least one
 *                   vote and a data score in both the variant and v10. MAE = weighted mean absolute
 *                   gap between the variant's DATA score (before the community adjustment, which is
 *                   itself derived from the votes) and the community's perceived score `perceived`,
 *                   weight min(votes, 10) (the 2026-10-14 v10 evaluation's definition); "MAE>=5" the
 *                   plain mean over countries with 5+ votes; "toward" the vote-weighted share of
 *                   countries the variant moves by >= 0.05 that move toward `perceived`.
 *  (c) extremes     the danger list must score < 5 and the safest list >= 8 (one-decimal display
 *                   value, src/lib/bands.ts), no score outside [1, 10].
 *  (d) bands        band changes against v10 (each must be explainable) and an independent check on
 *                   scripts/calibration/reference-scores.json (2026-03 expert set): MAE, MAE after
 *                   removing the mean offset (the set sits about 1 point below our scale, so a
 *                   variant that lifts scores looks worse on plain MAE), and Spearman rho.
 *
 * Variants: "v10" (the v10 configuration of the committed weights, scripts/lib/v10-fixture.ts
 * v10Configuration; scored by the current engine, so it already follows the coverage rule of
 * coverage.ts, which is not a formula option and greys the same places in every variant),
 * "v10.1" (the committed weights), each v10.1 change alone on v10 ("v10+name")
 * and removed from v10.1 ("v10.1-name"), and the candidates the 2026-10-15 evaluation rejected
 * ("v10+name"), so the decision can be re-run. Name variants on the command line to run a subset.
 *
 * Inputs it scores exactly like the pipeline: data/raw/<date> loaded as run.ts does. If that day's
 * INFORM rows predate the v10.1 parser (no inform_coping column), the column is read from the
 * stored INFORM edition (data/raw/inform), which is what the next pipeline run will parse.
 *
 * Usage (repo root):
 *   npx tsx scripts/calibration/compare-formulas.ts [--date YYYY-MM-DD] [--detail] [--out DIR] [variant ...]
 * Writes nothing unless --out is given (one <variant>.json per variant there, readable by
 * evaluate-consistency.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeAllScores } from '../../src/pipeline/scoring/engine.js';
import { parseCommunitySnapshot } from '../../src/pipeline/scoring/community.js';
import { parseInformWorkbook } from '../../src/pipeline/fetchers/inform-parse.js';
import { readStoredInformEdition } from '../../src/pipeline/fetchers/inform-edition.js';
import { getBand } from '../../src/lib/bands.js';
import type { RawSourceData, ScoredCountry, WeightsConfig } from '../../src/pipeline/types.js';
import { loadRawFolder, readWeights, v10Configuration } from '../lib/v10-fixture.js';
import { evaluateConstraints, type Constraint } from './evaluate-consistency.js';

const ROOT = process.cwd();
const CONSISTENCY_DIR = join(ROOT, 'scripts', 'calibration', 'consistency');
/** README "Situational constraints": they depend on the advisory picture of 2026-10-15. */
const SITUATIONAL = new Set(['C001', 'C002', 'C003', 'C004', 'C009', 'C012', 'C013']);
/** Margin an ordering must hold by in the "margin" shortfall. */
const ORDER_MARGIN = 0.1;
/** Gate (c): places that must stay in the danger band, and the safest places that must stay >= 8. */
const DANGER_LIST = ['PRK', 'AFG', 'SYR', 'YEM', 'SOM', 'SSD', 'SDN', 'MLI', 'LBY', 'PAK'];
const SAFE_LIST = ['ISL', 'CHE', 'SGP', 'NOR', 'DNK', 'FIN', 'NZL', 'JPN'];
/** A country counts as moved (vote direction check) when its data score changes by at least this. */
const MOVE_THRESHOLD = 0.05;

type Patch = (w: WeightsConfig) => void;

interface Variant {
  name: string;
  description: string;
  build: (committed: WeightsConfig) => WeightsConfig;
}

const clone = (w: WeightsConfig): WeightsConfig => JSON.parse(JSON.stringify(w)) as WeightsConfig;
const f9 = (w: WeightsConfig) => w.formulaV9 as unknown as Record<string, unknown>;

/** The v10.1 changes, each read from the committed weights (so this follows weights.json). */
const V101_CHANGES: Array<{ name: string; issue: string; description: string; keys: string[] }> = [
  { name: 'severity', issue: 'I10', description: 'level 3 counts in the severe modifier', keys: ['severeLevel3Weight'] },
  { name: 'prior', issue: 'I42', description: 'prior ceiling 0.60 removed', keys: ['muClampMax'] },
  { name: 'coping', issue: 'I49', description: 'natural hazards weighed by coping capacity', keys: ['naturalHazardCoping'] },
  { name: 'war', issue: 'I66', description: 'conflict-death curve continues past D_MAX', keys: ['ucdpTailFloor'] },
];

/** Candidates tested and rejected on 2026-10-15 (patches on v10), kept so the decision can be re-run. */
const REJECTED: Array<{ name: string; issue: string; description: string; patch: Patch }> = [
  {
    name: 'homicide50', issue: 'I44', description: 'homicide 50% of the crime pillar (was 33%)',
    patch: (w) => { w.pillars.find((p) => p.name === 'crime')!.indicatorWeights = { gpi_safety_security: 0.5, wb_homicide: 0.5 }; },
  },
  {
    name: 'crime30', issue: 'I44', description: 'pillar weights crime 30% / governance 10%',
    patch: (w) => { w.pillars.find((p) => p.name === 'crime')!.weight = 0.3; w.pillars.find((p) => p.name === 'governance')!.weight = 0.1; },
  },
  { name: 'lambda035', issue: 'I44/I66', description: 'acute soft-min weight 0.35 (was 0.25)', patch: (w) => { f9(w).lambda = 0.35; } },
  { name: 'nudge050', issue: 'I42', description: 'prior ceiling removed and advisory nudge 0.50 (was 0.35)', patch: (w) => { f9(w).muClampMax = 1; f9(w).nudgeScale = 0.5; } },
  { name: 'nsev3', issue: 'I10', description: 'severe count damping N_SEV 3 (was 6)', patch: (w) => { f9(w).N_SEV = 3; } },
  { name: 'level3third', issue: 'I10', description: 'level 3 counts 1/3 in the severe modifier', patch: (w) => { f9(w).severeLevel3Weight = 1 / 3; } },
  {
    name: 'health-identity', issue: 'I36', description: 'health pillar map dropped',
    patch: (w) => { delete (w.formulaV9!.pillarCalibration ?? {}).health; },
  },
];

function buildVariants(committed: WeightsConfig): Variant[] {
  const v10 = v10Configuration(committed);
  const withKeys = (base: WeightsConfig, keys: string[], from: WeightsConfig) => {
    const w = clone(base);
    for (const k of keys) f9(w)[k] = f9(from)[k];
    return w;
  };
  const withoutKeys = (keys: string[]) => {
    const w = clone(committed);
    for (const k of keys) {
      if (k in f9(v10)) f9(w)[k] = f9(v10)[k];
      else delete f9(w)[k];
    }
    return w;
  };
  return [
    { name: 'v10', description: 'formula v10 (published 2026-10-15)', build: () => clone(v10) },
    { name: 'v10.1', description: 'committed weights', build: () => clone(committed) },
    ...V101_CHANGES.map((c) => ({ name: `v10+${c.name}`, description: `${c.issue}: ${c.description}, alone`, build: () => withKeys(v10, c.keys, committed) })),
    ...V101_CHANGES.map((c) => ({ name: `v10.1-${c.name}`, description: `v10.1 without ${c.issue}`, build: () => withoutKeys(c.keys) })),
    ...REJECTED.map((r) => ({ name: `v10+${r.name}`, description: `rejected ${r.issue}: ${r.description}`, build: () => { const w = clone(v10); r.patch(w); return w; } })),
  ];
}

/** data/raw/<date> as run.ts loads it, plus INFORM's coping column from the stored edition when that day lacks it. */
function loadInputs(date: string): { raw: Map<string, RawSourceData>; notes: string[] } {
  const rawDir = join(ROOT, 'data', 'raw', date);
  const raw = loadRawFolder(rawDir, date);
  const notes: string[] = [];
  const inform = raw.get('inform');
  if (inform && !inform.indicators.some((i) => i.indicatorName === 'inform_coping')) {
    const storeDir = join(ROOT, 'data', 'raw', 'inform');
    const edition = readStoredInformEdition(storeDir);
    if (edition) {
      const parsed = parseInformWorkbook(readFileSync(join(storeDir, edition.file)));
      const coping = parsed.indicators.filter((i) => i.indicatorName === 'inform_coping');
      raw.set('inform', { ...inform, indicators: [...inform.indicators, ...coping] });
      notes.push(`INFORM coping capacity: ${coping.length} rows read from the stored edition ${edition.file} (not in ${date}'s inform-parsed.json)`);
    } else {
      notes.push('INFORM coping capacity: no stored edition, variants that use it score exposure only');
    }
  }
  return { raw, notes };
}

function score(raw: Map<string, RawSourceData>, weights: WeightsConfig, date: string, community: ReturnType<typeof parseCommunitySnapshot>): ScoredCountry[] {
  const log = console.log;
  console.log = () => {};
  try {
    // computeAllScores never mutates its input map, so one load serves every variant.
    return computeAllScores(raw, weights, date, { rawDir: join(ROOT, 'data', 'raw', date), community });
  } finally {
    console.log = log;
  }
}

interface SentimentEntry { votes: number; perceived: number }
interface ReferenceEntry { iso3: string; referenceScore: number }

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(xs.length);
    order.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const m = (a.length - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (ra[i] - m) * (rb[i] - m); da += (ra[i] - m) ** 2; db += (rb[i] - m) ** 2; }
  return num / Math.sqrt(da * db);
}

interface GateRow {
  name: string;
  structural: { pass: number; n: number; shortfall: number };
  situational: { pass: number; n: number; shortfall: number };
  marginShortfall: number;
  failing: string[];
  votes: { mae: number; n: number; mae5: number; n5: number; toward: number; moved: number };
  reference: { mae: number; centred: number; rho: number; n: number };
  dangerMissing: string[];
  safeMissing: string[];
  outOfRange: number;
  dangerCount: number;
  bandChanges: string[];
  statusChanges: string[];
  moves: Array<[string, number]>;
}

function gate(
  name: string,
  res: ScoredCountry[],
  base: ScoredCountry[],
  constraints: Constraint[],
  sentiment: Record<string, SentimentEntry>,
  reference: ReferenceEntry[],
): GateRow {
  const by = new Map(res.map((c) => [c.iso3, c]));
  const baseBy = new Map(base.map((c) => [c.iso3, c]));
  const scores = new Map(res.map((c) => [c.iso3, typeof c.score === 'number' ? c.score : null]));
  const results = evaluateConstraints(constraints, scores);
  const part = (situational: boolean) => {
    const rows = results.filter((r) => SITUATIONAL.has(r.id) === situational && r.status !== 'n/a');
    return { pass: rows.filter((r) => r.status === 'pass').length, n: rows.length, shortfall: rows.reduce((s, r) => s + (r.shortfall ?? 0), 0) };
  };
  let marginShortfall = 0;
  for (const c of constraints) {
    const s = scores.get(c.iso3);
    if (s === undefined || s === null) continue;
    if (c.kind === 'safer_than') {
      const o = scores.get(String(c.value));
      if (o !== undefined && o !== null) marginShortfall += Math.max(0, o - s + ORDER_MARGIN);
    } else {
      marginShortfall += results.find((r) => r.id === c.id)?.shortfall ?? 0;
    }
  }

  let wSum = 0, eSum = 0, n = 0, e5 = 0, n5 = 0, movedW = 0, towardW = 0, moved = 0;
  for (const [iso3, s] of Object.entries(sentiment)) {
    const c = by.get(iso3);
    const b = baseBy.get(iso3);
    if (!c || !b || c.dataScore === null || b.dataScore === null) continue;
    const w = Math.min(s.votes, 10);
    const err = Math.abs(c.dataScore - s.perceived);
    wSum += w; eSum += w * err; n++;
    if (s.votes >= 5) { e5 += err; n5++; }
    const d = c.dataScore - b.dataScore;
    if (Math.abs(d) >= MOVE_THRESHOLD) {
      moved++; movedW += w;
      if (Math.sign(d) === Math.sign(s.perceived - b.dataScore)) towardW += w;
    }
  }

  const pairs = reference
    .map((r) => [r.referenceScore, by.get(r.iso3)?.score] as const)
    .filter((p): p is readonly [number, number] => typeof p[1] === 'number');
  const offset = pairs.reduce((s, [a, b]) => s + (b - a), 0) / pairs.length;

  const displayed = (iso3: string) => { const s = by.get(iso3)?.score; return typeof s === 'number' ? Number(s.toFixed(1)) : null; };
  const bandChanges: string[] = [];
  const statusChanges: string[] = [];
  const moves: Array<[string, number]> = [];
  for (const c of res) {
    const b = baseBy.get(c.iso3);
    if (!b) continue;
    if (b.scoreStatus !== c.scoreStatus) statusChanges.push(`${c.iso3} ${b.scoreStatus} -> ${c.scoreStatus}`);
    if (typeof c.score === 'number' && typeof b.score === 'number') {
      moves.push([c.iso3, c.score - b.score]);
      if (getBand(c.score) !== getBand(b.score)) bandChanges.push(`${c.iso3} ${b.score.toFixed(2)} -> ${c.score.toFixed(2)} (${getBand(b.score)} -> ${getBand(c.score)})`);
    }
  }
  moves.sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]));
  const scored = res.filter((c) => typeof c.score === 'number');

  return {
    name,
    structural: part(false),
    situational: part(true),
    marginShortfall,
    failing: results.filter((r) => r.status === 'fail').map((r) => `${r.id} ${r.detail} (short ${(r.shortfall ?? 0).toFixed(2)})`),
    votes: { mae: eSum / wSum, n, mae5: n5 ? e5 / n5 : NaN, n5, toward: movedW ? (100 * towardW) / movedW : NaN, moved },
    reference: {
      mae: pairs.reduce((s, [a, b]) => s + Math.abs(b - a), 0) / pairs.length,
      centred: pairs.reduce((s, [a, b]) => s + Math.abs(b - a - offset), 0) / pairs.length,
      rho: spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])),
      n: pairs.length,
    },
    dangerMissing: DANGER_LIST.filter((i) => { const s = displayed(i); return s === null || s >= 5; }),
    safeMissing: SAFE_LIST.filter((i) => { const s = displayed(i); return s === null || s < 8; }),
    outOfRange: scored.filter((c) => (c.score as number) < 1 || (c.score as number) > 10).length,
    dangerCount: scored.filter((c) => getBand(c.score as number) === 'danger').length,
    bandChanges,
    statusChanges,
    moves: moves.slice(0, 15),
  };
}

function formatRow(r: GateRow): string {
  const ex = [
    r.dangerMissing.length ? `not<5: ${r.dangerMissing.join('/')}` : 'danger ok',
    r.safeMissing.length ? `not>=8: ${r.safeMissing.join('/')}` : 'safe ok',
    ...(r.outOfRange ? [`${r.outOfRange} out of [1,10]`] : []),
  ].join(', ');
  return [
    r.name.padEnd(22),
    `${r.structural.pass}/${r.structural.n} ${r.structural.shortfall.toFixed(2)}`,
    `${r.situational.pass}/${r.situational.n} ${r.situational.shortfall.toFixed(2)}`,
    (r.structural.shortfall + r.situational.shortfall).toFixed(2),
    r.marginShortfall.toFixed(2),
    `${r.votes.mae.toFixed(3)} (${r.votes.n})`,
    `${r.votes.mae5.toFixed(3)} (${r.votes.n5})`,
    r.votes.moved ? `${r.votes.toward.toFixed(0)}% of ${r.votes.moved}` : '-',
    `${r.reference.mae.toFixed(3)} / ${r.reference.centred.toFixed(3)} / ${r.reference.rho.toFixed(3)}`,
    ex,
    String(r.dangerCount),
    String(r.bandChanges.length),
    String(r.statusChanges.length),
  ].join(' | ');
}

function main(): void {
  const args = process.argv.slice(2);
  const valueOf = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const date = valueOf('--date') ?? '2026-10-15';
  const outDir = valueOf('--out');
  const detail = args.includes('--detail');
  const flagValues = new Set([valueOf('--date'), valueOf('--out')]);
  const wanted = args.filter((a) => !a.startsWith('--') && !flagValues.has(a));

  const committed = readWeights();
  const variants = buildVariants(committed).filter((v) => wanted.length === 0 || v.name === 'v10' || wanted.includes(v.name));
  const sentimentPath = [join(ROOT, 'data', 'sentiment', `${date}.json`), join(ROOT, 'data', 'sentiment', 'latest.json')].find(existsSync)!;
  const sentimentJson = JSON.parse(readFileSync(sentimentPath, 'utf-8')) as { countries: Record<string, SentimentEntry> };
  const community = parseCommunitySnapshot(sentimentJson);
  const constraints = (JSON.parse(readFileSync(join(CONSISTENCY_DIR, 'constraints.json'), 'utf-8')) as { constraints: Constraint[] }).constraints;
  const reference = (JSON.parse(readFileSync(join(ROOT, 'scripts', 'calibration', 'reference-scores.json'), 'utf-8')) as { countries: ReferenceEntry[] }).countries;
  const { raw, notes } = loadInputs(date);

  console.log(`=== Formula gate on data/raw/${date} (weights ${committed.version}; votes ${sentimentPath.replace(`${ROOT}/`, '')}) ===`);
  for (const note of notes) console.log(`  note: ${note}`);
  const results = variants.map((v) => ({ v, res: score(raw, v.build(committed), date, community) }));
  const base = results.find((r) => r.v.name === 'v10')!.res;
  if (outDir) mkdirSync(outDir, { recursive: true });

  const rows = results.map(({ v, res }) => {
    if (outDir) writeFileSync(join(outDir, `${v.name}.json`), JSON.stringify({ date, variant: v.name, description: v.description, countries: res }));
    return { v, row: gate(v.name, res, base, constraints, sentimentJson.countries, reference) };
  });

  console.log([
    'variant'.padEnd(22), 'structural pass short', 'situational pass short', 'total short', 'margin short',
    'vote MAE (n)', 'MAE 5+ votes (n)', 'toward votes', 'ref MAE / centred / rho', 'extremes', 'danger', 'bands', 'status',
  ].join(' | '));
  for (const { row } of rows) console.log(formatRow(row));
  console.log('\nVariants:');
  for (const { v } of rows) console.log(`  ${v.name.padEnd(22)} ${v.description}`);

  if (detail) {
    for (const { v, row } of rows) {
      console.log(`\n== ${v.name}: ${v.description}`);
      console.log(`  failing: ${row.failing.join('; ') || 'none'}`);
      console.log(`  band changes vs v10 (${row.bandChanges.length}): ${row.bandChanges.join('; ') || 'none'}`);
      if (row.statusChanges.length) console.log(`  status changes: ${row.statusChanges.join('; ')}`);
      console.log(`  top moves vs v10: ${row.moves.map(([iso3, d]) => `${iso3} ${d >= 0 ? '+' : ''}${d.toFixed(2)}`).join(', ')}`);
    }
  }
}

main();
