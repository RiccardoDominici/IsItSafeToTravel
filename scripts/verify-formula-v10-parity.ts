/**
 * Formula v10 parity gate (SPEC §6), a regression lock on the v10 engine.
 *
 * Scores the frozen fixture (scripts/fixtures/v10/raw-2026-10-14, see build-v10-fixture.ts)
 * with the committed weights.json and compares every country with the frozen CSV
 * scripts/fixtures/formula-v10-parity.csv, which this same script wrote from the v10
 * engine when the formula was frozen. Two scenarios per country:
 *   1. no community input: scoreStatus, source count, dataScore, score, scoreDisplay,
 *      confidence and the five shrunk pillar values (pillars are compared for grey places
 *      too, so the internal math stays locked even where nothing is published);
 *   2. the synthetic v10-shape sentiment snapshot of the fixture: community status,
 *      adjustment and final score.
 *
 * GATE: identical statuses and source counts, every number within 1e-9. Any difference is
 * an engine change: if it is intended, re-freeze the fixture CSV with --write in the same
 * commit and explain why; never edit the CSV by hand.
 *
 * Unlike the v9.1 gate, nothing here fetches data or rewrites repo data: it reads only the
 * fixture folder and weights.json, and --write writes only the CSV.
 *
 * Usage: npx tsx scripts/verify-formula-v10-parity.ts [--write]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import { parseCommunitySnapshot } from '../src/pipeline/scoring/community.js';
import type { PillarName, ScoredCountry } from '../src/pipeline/types.js';
import { FIXTURE_DATE, FIXTURE_RAW_DIR, FIXTURE_ROOT, PARITY_CSV_PATH, loadRawFolder, readWeights } from './lib/v10-fixture.js';

const TOLERANCE = 1e-9;
const SENTIMENT_PATH = join(FIXTURE_ROOT, `sentiment-synthetic-${FIXTURE_DATE}.json`);
const PILLARS: PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];

const COLUMNS = [
  'iso3', 'score_status', 'sources', 'data_score', 'score', 'score_display', 'confidence',
  ...PILLARS.map((p) => `pillar_${p}`),
  'community_status', 'community_adjustment', 'score_with_community',
] as const;
type Column = (typeof COLUMNS)[number];
type Row = Record<Column, string>;

const STRING_COLUMNS = new Set<Column>(['iso3', 'score_status', 'community_status']);
const EXACT_COLUMNS = new Set<Column>(['sources', 'score_display']);

/** Numbers are written with full precision (shortest round-trip form); null as an empty cell. */
function cell(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' ? String(value) : value;
}

function buildRows(base: ScoredCountry[], withCommunity: ScoredCountry[]): Row[] {
  const communityByIso = new Map(withCommunity.map((c) => [c.iso3, c]));
  return base.map((c) => {
    const pillarByName = new Map(c.pillars.map((p) => [p.name, p.score]));
    const wc = communityByIso.get(c.iso3)!;
    return {
      iso3: c.iso3,
      score_status: cell(c.scoreStatus),
      sources: cell(c.sources.length),
      data_score: cell(c.dataScore),
      score: cell(c.score),
      score_display: cell(c.scoreDisplay),
      confidence: cell(c.confidence),
      ...(Object.fromEntries(PILLARS.map((p) => [`pillar_${p}`, cell(pillarByName.get(p))])) as Record<`pillar_${PillarName}`, string>),
      community_status: cell(wc.community?.status),
      community_adjustment: cell(wc.community?.adjustment),
      score_with_community: cell(wc.score),
    };
  });
}

function toCsv(rows: Row[]): string {
  return [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((col) => r[col]).join(','))].join('\n') + '\n';
}

function parseCsv(text: string): Row[] {
  const [header, ...lines] = text.trim().split('\n');
  const cols = header.split(',') as Column[];
  if (cols.join(',') !== COLUMNS.join(',')) throw new Error(`unexpected CSV header: ${header}`);
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [cols[i], v])) as Row);
}

function compare(expected: Row, actual: Row): string[] {
  const problems: string[] = [];
  for (const col of COLUMNS) {
    const e = expected[col];
    const a = actual[col];
    if (STRING_COLUMNS.has(col) || EXACT_COLUMNS.has(col) || e === '' || a === '') {
      if (e !== a) problems.push(`${col}: expected "${e}", got "${a}"`);
      continue;
    }
    const delta = Math.abs(Number(e) - Number(a));
    if (!(delta <= TOLERANCE)) problems.push(`${col}: expected ${e}, got ${a} (|delta| ${delta.toExponential(2)})`);
  }
  return problems;
}

function main(): void {
  const write = process.argv.includes('--write');
  const weights = readWeights();
  if (!weights.version.startsWith('10.')) {
    console.error(`FATAL: expected a 10.x weights.json, got ${weights.version}`);
    process.exit(1);
  }
  const community = parseCommunitySnapshot(JSON.parse(readFileSync(SENTIMENT_PATH, 'utf-8')));
  if (!community) {
    console.error(`FATAL: ${SENTIMENT_PATH} is not a valid v10 sentiment snapshot`);
    process.exit(1);
  }

  const options = { rawDir: FIXTURE_RAW_DIR };
  const base = computeAllScores(loadRawFolder(FIXTURE_RAW_DIR, FIXTURE_DATE), weights, FIXTURE_DATE, { ...options, community: null });
  const withCommunity = computeAllScores(loadRawFolder(FIXTURE_RAW_DIR, FIXTURE_DATE), weights, FIXTURE_DATE, { ...options, community });
  const rows = buildRows(base, withCommunity);

  if (write) {
    writeFileSync(PARITY_CSV_PATH, toCsv(rows), 'utf-8');
    console.log(`Wrote ${rows.length} rows to ${PARITY_CSV_PATH} (weights ${weights.version})`);
    return;
  }

  if (!existsSync(PARITY_CSV_PATH)) {
    console.error(`FATAL: ${PARITY_CSV_PATH} missing; freeze it with --write`);
    process.exit(1);
  }
  const expected = new Map(parseCsv(readFileSync(PARITY_CSV_PATH, 'utf-8')).map((r) => [r.iso3, r]));
  const failures: string[] = [];
  for (const row of rows) {
    const exp = expected.get(row.iso3);
    if (!exp) {
      failures.push(`${row.iso3}: not in the frozen CSV`);
      continue;
    }
    for (const problem of compare(exp, row)) failures.push(`${row.iso3}: ${problem}`);
    expected.delete(row.iso3);
  }
  for (const iso3 of expected.keys()) failures.push(`${iso3}: in the frozen CSV but not scored`);

  const scored = rows.filter((r) => r.score_status === 'scored').length;
  console.log(`=== Formula v10 parity gate on ${FIXTURE_DATE} (weights ${weights.version}) ===`);
  console.log(`Countries: ${rows.length} (${scored} scored, ${rows.length - scored} insufficient_data); tolerance ${TOLERANCE}`);
  if (failures.length > 0) {
    console.log(`\nPARITY FAILURES (${failures.length}):`);
    for (const line of failures.slice(0, 50)) console.log(`  ${line}`);
    if (failures.length > 50) console.log(`  ... and ${failures.length - 50} more`);
    console.log('\nPARITY GATE: FAILED');
    process.exit(1);
  }
  console.log('PARITY GATE: PASSED');
}

main();
