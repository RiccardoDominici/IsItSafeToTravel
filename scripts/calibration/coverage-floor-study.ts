#!/usr/bin/env node
/**
 * scripts/calibration/coverage-floor-study.ts
 *
 * Should the coverage floor (weights.json formulaV9.minSources, today 4 of the 6 coverage sources:
 * advisories, GPI, INFORM, UCDP, V-Dem, World Bank) move up or down? Owner question 2026-10-19:
 * "places with some data but not enough have an unreliable score; if we grey them, do the
 * verified metrics improve?" Two independent answers:
 *
 *  A. Threshold sweep. The raw date is scored with minSources = 1..6 (the danger guard of
 *     status.ts stays, so a dangerous place is always scored) and every threshold is read on the
 *     verified checks the formula gate uses (compare-formulas.ts): the 14 consistency constraints,
 *     the community votes and the 2026-03 expert reference set. A constraint on a grey place is
 *     "n/a", so a higher floor can only "pass" a constraint by hiding its place: the table prints
 *     the n/a count next to the passes, and the metrics on the places scored at EVERY threshold,
 *     which no floor can game.
 *
 *  B. Source-removal test. The verified checks above barely cover data-poor places (they have
 *     almost no votes and none is in the reference set), so part A cannot say how wrong a
 *     4-source score is. Part B measures it directly: take every place with all 6 sources, delete
 *     the sources that the real data-poor places lack (one real pattern at a time, e.g. "no GPI,
 *     no V-Dem" like the Caribbean islands), score again, and compare with the full-data score.
 *     The gap is the error a place with that pattern carries: the score it shows against the score
 *     it would show with complete data.
 *
 * Usage (repo root): npx tsx scripts/calibration/coverage-floor-study.ts [--date YYYY-MM-DD] [--json out.json]
 * Reads data/raw/<date>, data/sentiment, scripts/calibration/{consistency/constraints.json,
 * reference-scores.json}. Writes nothing unless --json is given.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeAllScores } from '../../src/pipeline/scoring/engine.js';
import { parseCommunitySnapshot } from '../../src/pipeline/scoring/community.js';
import { isEventFeedSource } from '../../src/pipeline/scoring/coverage.js';
import { getBand } from '../../src/lib/bands.js';
import { getRegion } from '../../src/lib/regions.js';
import type { RawSourceData, ScoredCountry, WeightsConfig } from '../../src/pipeline/types.js';
import { loadRawFolder, readWeights } from '../lib/v10-fixture.js';
import { evaluateConstraints, type Constraint } from './evaluate-consistency.js';

const ROOT = process.cwd();
/** The coverage sources (coverage.ts counts every source key except the disaster-alert feeds). */
const COVERAGE_SOURCES = ['advisories', 'gpi', 'inform', 'ucdp', 'vdem', 'worldbank'] as const;
const THRESHOLDS = [1, 2, 3, 4, 5, 6];
/** A score gap that a reader would notice: half a point, i.e. five steps of the one-decimal display. */
const NOTICEABLE = 0.5;

interface SentimentEntry { votes: number; perceived: number }
interface ReferenceEntry { iso3: string; referenceScore: number }

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const numericScore = (c: ScoredCountry | undefined): number | null => (c && typeof c.score === 'number' ? c.score : null);
const coverageSet = (c: ScoredCountry): Set<string> => new Set((c.sources ?? []).map((s) => s.name).filter((n) => !isEventFeedSource(n)));
const quantile = (xs: number[], q: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
};

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

/** Score quietly (the engine logs a run summary per call). */
function score(raw: Map<string, RawSourceData>, weights: WeightsConfig, date: string, community: ReturnType<typeof parseCommunitySnapshot>): ScoredCountry[] {
  const log = console.log;
  console.log = () => {};
  try {
    return computeAllScores(raw, weights, date, { rawDir: join(ROOT, 'data', 'raw', date), community });
  } finally {
    console.log = log;
  }
}

function withMinSources(weights: WeightsConfig, minSources: number): WeightsConfig {
  const w = clone(weights);
  (w.formulaV9 as unknown as Record<string, unknown>).minSources = minSources;
  return w;
}

/** The raw map without the given sources' rows for the given places (every other row untouched). */
function withoutSources(raw: Map<string, RawSourceData>, sources: readonly string[], places: ReadonlySet<string>): Map<string, RawSourceData> {
  const out = new Map(raw);
  for (const name of sources) {
    const data = raw.get(name);
    if (!data) continue;
    out.set(name, { ...data, indicators: data.indicators.filter((i) => !places.has(i.countryIso3)) });
  }
  return out;
}

// ---------------------------------------------------------------- A. threshold sweep

interface Metrics {
  constraints: { pass: number; fail: number; na: number; shortfall: number; failing: string[] };
  votes: { mae: number; n: number };
  reference: { mae: number; centred: number; rho: number; n: number };
}

function metrics(
  scores: Map<string, number | null>,
  dataScores: Map<string, number | null>,
  constraints: Constraint[],
  sentiment: Record<string, SentimentEntry>,
  reference: ReferenceEntry[],
  only?: ReadonlySet<string>,
): Metrics {
  const results = evaluateConstraints(constraints, scores);
  let wSum = 0, eSum = 0, n = 0;
  for (const [iso3, s] of Object.entries(sentiment)) {
    if (only && !only.has(iso3)) continue;
    const d = dataScores.get(iso3);
    if (typeof d !== 'number' || scores.get(iso3) === null) continue;
    const w = Math.min(s.votes, 10);
    wSum += w; eSum += w * Math.abs(d - s.perceived); n++;
  }
  const pairs = reference
    .filter((r) => !only || only.has(r.iso3))
    .map((r) => [r.referenceScore, scores.get(r.iso3)] as const)
    .filter((p): p is readonly [number, number] => typeof p[1] === 'number');
  const offset = pairs.reduce((s, [a, b]) => s + (b - a), 0) / pairs.length;
  return {
    constraints: {
      pass: results.filter((r) => r.status === 'pass').length,
      fail: results.filter((r) => r.status === 'fail').length,
      na: results.filter((r) => r.status === 'n/a').length,
      shortfall: results.reduce((s, r) => s + (r.shortfall ?? 0), 0),
      failing: results.filter((r) => r.status === 'fail').map((r) => r.detail),
    },
    votes: { mae: wSum ? eSum / wSum : NaN, n },
    reference: {
      mae: pairs.reduce((s, [a, b]) => s + Math.abs(b - a), 0) / pairs.length,
      centred: pairs.reduce((s, [a, b]) => s + Math.abs(b - a - offset), 0) / pairs.length,
      rho: spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])),
      n: pairs.length,
    },
  };
}

// ---------------------------------------------------------------- B. source-removal test

interface RemovalRow {
  pattern: string;
  missing: string[];
  realPlaces: string[];
  n: number;
  meanAbs: number;
  median: number;
  p90: number;
  max: number;
  maxPlace: string;
  noticeableShare: number;
  bandChangeShare: number;
  rho: number;
  bias: number;
  untouchedMaxDrift: number;
  /**
   * Mean signed gap of the rich places in the regions of the real places with this pattern (the
   * prior is region-anchored, so this is the closer estimate of the error those places carry),
   * and each real place's score with the estimated full-data score next to it.
   */
  sameRegion: { n: number; bias: number; meanAbs: number };
  realPlaceEstimates: Array<{ iso3: string; region: string; score: number | null; estimatedFullData: number | null }>;
  gaps: Record<string, number>;
}

function main(): void {
  const args = process.argv.slice(2);
  const valueOf = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const date = valueOf('--date') ?? '2026-10-18';
  const jsonOut = valueOf('--json');

  const weights = readWeights();
  const raw = loadRawFolder(join(ROOT, 'data', 'raw', date), date);
  const sentimentPath = [join(ROOT, 'data', 'sentiment', `${date}.json`), join(ROOT, 'data', 'sentiment', 'latest.json')].find(existsSync)!;
  const sentimentJson = JSON.parse(readFileSync(sentimentPath, 'utf-8')) as { countries: Record<string, SentimentEntry> };
  const community = parseCommunitySnapshot(sentimentJson);
  const constraints = (JSON.parse(readFileSync(join(ROOT, 'scripts', 'calibration', 'consistency', 'constraints.json'), 'utf-8')) as { constraints: Constraint[] }).constraints;
  const reference = (JSON.parse(readFileSync(join(ROOT, 'scripts', 'calibration', 'reference-scores.json'), 'utf-8')) as { countries: ReferenceEntry[] }).countries;
  const committedFloor = (weights.formulaV9 as unknown as { minSources?: number }).minSources;

  console.log(`=== Coverage-floor study on data/raw/${date} (weights ${weights.version}, committed floor ${committedFloor}; votes ${sentimentPath.replace(`${ROOT}/`, '')}) ===`);

  // Everything scored (floor 0): the full-data score of every place, the base of part B, and the
  // check that the floor changes nothing but the status (a place's score never depends on which
  // other places are grey).
  const all = score(raw, withMinSources(weights, 0), date, community);
  const allBy = new Map(all.map((c) => [c.iso3, c]));
  const nSources = new Map(all.map((c) => [c.iso3, coverageSet(c).size]));

  // ---- A
  const sweep = THRESHOLDS.map((k) => {
    const res = score(raw, withMinSources(weights, k), date, community);
    const scores = new Map(res.map((c) => [c.iso3, numericScore(c)]));
    const dataScores = new Map(res.map((c) => [c.iso3, typeof c.dataScore === 'number' ? c.dataScore : null]));
    let drift = 0;
    for (const c of res) {
      const s = numericScore(c);
      const a = numericScore(allBy.get(c.iso3));
      if (s !== null && a !== null) drift = Math.max(drift, Math.abs(s - a));
    }
    const guarded = res.filter((c) => numericScore(c) !== null && (nSources.get(c.iso3) ?? 0) < k).map((c) => c.iso3);
    return { k, res, scores, dataScores, scored: res.filter((c) => numericScore(c) !== null).length, guarded, drift };
  });
  const alwaysScored = new Set(all.map((c) => c.iso3).filter((iso3) => sweep.every((s) => s.scores.get(iso3) !== null)));

  console.log('\nA. Threshold sweep. "all" = every place scored at that threshold; "common" = only the');
  console.log(`   ${alwaysScored.size} places scored at every threshold (no floor can game these).`);
  console.log(['floor', 'scored', 'guard', 'constraints pass/fail/n.a. short', 'votes MAE (n) all | common', 'reference MAE/centred/rho (n) all | common'].join(' | '));
  const sweepRows = sweep.map((s) => {
    const mAll = metrics(s.scores, s.dataScores, constraints, sentimentJson.countries, reference);
    const mCommon = metrics(s.scores, s.dataScores, constraints, sentimentJson.countries, reference, alwaysScored);
    const mark = s.k === committedFloor ? '*' : ' ';
    console.log([
      `${s.k}${mark}`.padEnd(5),
      String(s.scored).padStart(6),
      String(s.guarded.length).padStart(5),
      `${mAll.constraints.pass}/${mAll.constraints.fail}/${mAll.constraints.na} ${mAll.constraints.shortfall.toFixed(2)}`.padEnd(33),
      `${mAll.votes.mae.toFixed(3)} (${mAll.votes.n}) | ${mCommon.votes.mae.toFixed(3)} (${mCommon.votes.n})`.padEnd(26),
      `${mAll.reference.mae.toFixed(3)}/${mAll.reference.centred.toFixed(3)}/${mAll.reference.rho.toFixed(3)} (${mAll.reference.n}) | ${mCommon.reference.mae.toFixed(3)}/${mCommon.reference.centred.toFixed(3)}/${mCommon.reference.rho.toFixed(3)} (${mCommon.reference.n})`,
    ].join(' | '));
    return { floor: s.k, scored: s.scored, guarded: s.guarded, maxScoreDriftVsAllScored: s.drift, all: mAll, common: mCommon };
  });
  console.log(`   (* committed floor; "guard" = scored below the floor only because of the danger guard; max score drift between thresholds: ${Math.max(...sweep.map((s) => s.drift)).toFixed(4)})`);

  console.log('\n   Places whose status changes, threshold by threshold (sources they lack; votes; in the reference set):');
  for (let i = 1; i < sweep.length; i++) {
    const prev = sweep[i - 1];
    const cur = sweep[i];
    const greyed = all.filter((c) => prev.scores.get(c.iso3) !== null && cur.scores.get(c.iso3) === null);
    const constraintHits = new Set(constraints.flatMap((c) => [c.iso3, String(c.value)]));
    const describe = (c: ScoredCountry) => {
      const lacks = COVERAGE_SOURCES.filter((s) => !coverageSet(c).has(s));
      const v = sentimentJson.countries[c.iso3]?.votes ?? 0;
      const ref = reference.some((r) => r.iso3 === c.iso3);
      return `${c.iso3}${constraintHits.has(c.iso3) ? '!' : ''} (no ${lacks.join('+') || '-'}; ${v}v${ref ? '; ref' : ''})`;
    };
    console.log(`   ${prev.k} -> ${cur.k}: ${greyed.length} more grey${greyed.length ? `: ${greyed.map(describe).join(', ')}` : ''}`);
  }
  console.log('   (! = the place is in a consistency constraint)');

  // ---- B
  const rich = all.filter((c) => nSources.get(c.iso3) === COVERAGE_SOURCES.length && numericScore(c) !== null);
  const richSet = new Set(rich.map((c) => c.iso3));
  const patterns = new Map<string, { missing: string[]; places: string[] }>();
  for (const c of all) {
    const missing = COVERAGE_SOURCES.filter((s) => !coverageSet(c).has(s));
    // Patterns that keep at least one source (a place with none has nothing to score from) and
    // keep the advisories (without them there is no place left to compare: every rich place has them).
    if (missing.length === 0 || missing.length === COVERAGE_SOURCES.length) continue;
    const key = missing.join('+');
    const entry = patterns.get(key) ?? { missing, places: [] };
    entry.places.push(c.iso3);
    patterns.set(key, entry);
  }
  const ordered = [...patterns.entries()].sort((a, b) => a[1].missing.length - b[1].missing.length || b[1].places.length - a[1].places.length);

  console.log(`\nB. Source-removal test on the ${rich.length} places with all 6 sources: delete the sources a real`);
  console.log('   data-poor pattern lacks, score again, compare with the full-data score.');
  console.log(['sources left', 'removed', 'real places', 'mean |gap|', 'median', 'p90', 'max', `>=${NOTICEABLE}`, 'band', 'rank rho', 'bias', 'drift'].join(' | '));
  const removalRows: RemovalRow[] = [];
  for (const [key, p] of ordered) {
    const res = score(withoutSources(raw, p.missing, richSet), withMinSources(weights, 0), date, community);
    const by = new Map(res.map((c) => [c.iso3, c]));
    const gaps: number[] = [];
    const full: number[] = [];
    const reduced: number[] = [];
    let bandChanges = 0, maxGap = 0, maxPlace = '', untouchedMaxDrift = 0;
    for (const c of all) {
      const a = numericScore(c);
      const b = numericScore(by.get(c.iso3));
      if (a === null || b === null) continue;
      if (!richSet.has(c.iso3)) { untouchedMaxDrift = Math.max(untouchedMaxDrift, Math.abs(a - b)); continue; }
      const g = b - a;
      gaps.push(g); full.push(a); reduced.push(b);
      if (getBand(Number(a.toFixed(1))) !== getBand(Number(b.toFixed(1)))) bandChanges++;
      if (Math.abs(g) > Math.abs(maxGap)) { maxGap = g; maxPlace = c.iso3; }
    }
    const abs = gaps.map(Math.abs);
    const gapBy: Record<string, number> = {};
    for (const c of rich) {
      const a = numericScore(c);
      const b = numericScore(by.get(c.iso3));
      if (a !== null && b !== null) gapBy[c.iso3] = b - a;
    }
    const regions = new Set(p.places.map((iso3) => getRegion(iso3)));
    const regional = Object.entries(gapBy).filter(([iso3]) => regions.has(getRegion(iso3))).map(([, g]) => g);
    const sameRegion = {
      n: regional.length,
      bias: regional.reduce((s, x) => s + x, 0) / (regional.length || NaN),
      meanAbs: regional.reduce((s, x) => s + Math.abs(x), 0) / (regional.length || NaN),
    };
    const realPlaceEstimates = p.places.map((iso3) => {
      const own = Object.entries(gapBy).filter(([r]) => getRegion(r) === getRegion(iso3)).map(([, g]) => g);
      const bias = own.length >= 3 ? own.reduce((s, x) => s + x, 0) / own.length : sameRegion.bias;
      // Published score: the place's score at the committed floor (null when grey there).
      const published = sweep.find((x) => x.k === committedFloor)?.scores.get(iso3) ?? null;
      return { iso3, region: getRegion(iso3), score: published, estimatedFullData: published === null ? null : published - bias };
    });
    const row: RemovalRow = {
      pattern: key,
      missing: p.missing,
      realPlaces: p.places,
      n: gaps.length,
      meanAbs: abs.reduce((s, x) => s + x, 0) / abs.length,
      median: quantile(abs, 0.5),
      p90: quantile(abs, 0.9),
      max: maxGap,
      maxPlace,
      noticeableShare: abs.filter((x) => x >= NOTICEABLE).length / abs.length,
      bandChangeShare: bandChanges / gaps.length,
      rho: spearman(full, reduced),
      bias: gaps.reduce((s, x) => s + x, 0) / gaps.length,
      untouchedMaxDrift,
      sameRegion,
      realPlaceEstimates,
      gaps: gapBy,
    };
    removalRows.push(row);
    console.log([
      String(COVERAGE_SOURCES.length - p.missing.length).padEnd(12),
      key.padEnd(30),
      `${p.places.length} ${p.places.length <= 4 ? `(${p.places.join(' ')})` : ''}`.padEnd(22),
      row.meanAbs.toFixed(2).padStart(10),
      row.median.toFixed(2).padStart(6),
      row.p90.toFixed(2).padStart(4),
      `${row.max >= 0 ? '+' : ''}${row.max.toFixed(2)} ${row.maxPlace}`.padEnd(10),
      `${(100 * row.noticeableShare).toFixed(0)}%`.padStart(4),
      `${(100 * row.bandChangeShare).toFixed(0)}%`.padStart(4),
      row.rho.toFixed(3),
      `${row.bias >= 0 ? '+' : ''}${row.bias.toFixed(2)}`,
      row.untouchedMaxDrift.toFixed(4),
    ].join(' | '));
  }
  console.log('   gap = score without those sources minus the full-data score, on the same place; "band" = share whose');
  console.log('   one-decimal band changes; "bias" = mean signed gap; "drift" = max change on the places NOT edited');
  console.log('   (0 = the removal touches only the edited places, so the test is clean).');

  console.log('\n   The same gap on the rich places of the real places\' regions (the prior is region-anchored),');
  console.log('   and for each place scored today: its score and the estimated score with complete data');
  console.log('   (score minus the mean gap of the rich places of its own region, or of the pattern\'s regions');
  console.log('   when its region has fewer than 3):');
  for (const r of removalRows) {
    const scoredToday = r.realPlaceEstimates.filter((e) => e.score !== null);
    console.log(`   ${r.pattern.padEnd(30)} same-region bias ${r.sameRegion.bias >= 0 ? '+' : ''}${r.sameRegion.bias.toFixed(2)}, mean |gap| ${r.sameRegion.meanAbs.toFixed(2)} (n=${r.sameRegion.n})`
      + (scoredToday.length ? `; scored today: ${scoredToday.map((e) => `${e.iso3} ${(e.score as number).toFixed(2)}->${(e.estimatedFullData as number).toFixed(2)}`).join(', ')}` : ''));
  }

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ date, weightsVersion: weights.version, committedFloor, sweep: sweepRows, removal: removalRows }, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
}

main();
