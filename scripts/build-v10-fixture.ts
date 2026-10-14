/**
 * Build the formula v10 fixture folder (SPEC §3 calibration, §6 parity) OFFLINE.
 *
 *   scripts/fixtures/v10/raw-2026-10-14/   parsed inputs of raw date 2026-10-14, as run.ts loads them:
 *     - every *-parsed.json of data/raw/2026-10-14/ except INFORM and GPI, copied byte for byte;
 *     - the advisories-*-info.json side files the engine reads for advisory levels;
 *     - inform-parsed.json: re-parsed by the v10 INFORM parser (exact columns) from the stored
 *       2026 edition, data/raw/inform/<edition.json file>;
 *     - gpi-parsed.json: re-parsed by the v10 GPI parser (gpiEntriesToIndicators, now with
 *       gpi_conflict) from the GPI 2026 domain scores in scripts/fixtures/v10/inputs/.
 *   scripts/fixtures/v10/v91-scores-2026-10-14.json   the v9.1 scores published that day.
 *   scripts/fixtures/v10/raw-2026-10-14/MANIFEST.json provenance (inputs, checksums, counts).
 *
 * Re-running reproduces the same files. The script only READS data/raw and data/scores and
 * WRITES only under scripts/fixtures/v10/.
 *
 * Inputs it refuses to work without: the stored INFORM workbook and the GPI domain file.
 * The GPI file is a projection (iso3, name, overall, safety, militarisation, conflict) of the
 * IEP's https://gpi.economicsandpeace.org/data/gpi/2026.json; the `ind` sub-indicators are
 * not kept (SPEC §1.7). The build checks that the projection reproduces the committed
 * data/raw/2026-10-14/gpi-parsed.json exactly for the three v9.1 GPI fields, so it is the
 * same edition the pipeline fetched that day.
 *
 * Usage: npx tsx scripts/build-v10-fixture.ts
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseInformWorkbook } from '../src/pipeline/fetchers/inform-parse.js';
import { gpiEntriesToIndicators, type GpiJsonEntry } from '../src/pipeline/fetchers/gpi.js';
import { readStoredInformEdition } from '../src/pipeline/fetchers/inform-edition.js';
import type { DailySnapshot, RawSourceData } from '../src/pipeline/types.js';
import { FIXTURE_DATE, FIXTURE_INPUTS_DIR, FIXTURE_RAW_DIR, V91_REFERENCE_PATH, type V91Reference } from './lib/v10-fixture.js';

const SOURCE_RAW_DIR = join(process.cwd(), 'data', 'raw', FIXTURE_DATE);
const INFORM_STORE_DIR = join(process.cwd(), 'data', 'raw', 'inform');
const GPI_INPUT = join(FIXTURE_INPUTS_DIR, 'gpi-2026-domains.json');
const V91_SNAPSHOT = join(process.cwd(), 'data', 'scores', `${FIXTURE_DATE}.json`);

function md5(path: string): string {
  return createHash('md5').update(readFileSync(path)).digest('hex');
}

function fail(message: string): never {
  console.error(`FATAL: ${message}`);
  process.exit(1);
}

function writeJsonPretty(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function main(): void {
  if (!existsSync(SOURCE_RAW_DIR)) fail(`missing ${SOURCE_RAW_DIR}`);
  if (!existsSync(GPI_INPUT)) fail(`missing GPI input ${GPI_INPUT}`);
  const edition = readStoredInformEdition(INFORM_STORE_DIR);
  if (!edition) fail(`no stored INFORM edition in ${INFORM_STORE_DIR}`);

  rmSync(FIXTURE_RAW_DIR, { recursive: true, force: true });
  mkdirSync(FIXTURE_RAW_DIR, { recursive: true });

  // 1. Copy the parsed sources and the advisory side files, unchanged.
  const copied: Record<string, string> = {};
  for (const file of readdirSync(SOURCE_RAW_DIR).sort()) {
    const isParsed = file.endsWith('-parsed.json') && file !== 'inform-parsed.json' && file !== 'gpi-parsed.json';
    const isAdvisoryInfo = /^advisories(-tier[0-9a-z]+)?-info\.json$/.test(file);
    if (!isParsed && !isAdvisoryInfo) continue;
    copyFileSync(join(SOURCE_RAW_DIR, file), join(FIXTURE_RAW_DIR, file));
    copied[file] = md5(join(SOURCE_RAW_DIR, file));
  }

  // 2. INFORM: v10 parser on the stored edition. fetchedAt is kept from that day's file.
  const originalInform = JSON.parse(readFileSync(join(SOURCE_RAW_DIR, 'inform-parsed.json'), 'utf-8')) as RawSourceData;
  const workbookPath = join(INFORM_STORE_DIR, edition.file);
  const inform = parseInformWorkbook(readFileSync(workbookPath));
  writeJsonPretty(join(FIXTURE_RAW_DIR, 'inform-parsed.json'), {
    source: 'inform',
    fetchedAt: originalInform.fetchedAt,
    indicators: inform.indicators,
  } satisfies RawSourceData);

  // 3. GPI: v10 parser on the 2026 domain scores, checked against that day's committed parse.
  const originalGpi = JSON.parse(readFileSync(join(SOURCE_RAW_DIR, 'gpi-parsed.json'), 'utf-8')) as RawSourceData;
  const gpiYear = Math.max(...originalGpi.indicators.map((i) => i.year));
  const gpiEntries = JSON.parse(readFileSync(GPI_INPUT, 'utf-8')) as GpiJsonEntry[];
  const gpi = gpiEntriesToIndicators(gpiEntries, gpiYear);
  const reparsed = new Map(gpi.map((i) => [`${i.countryIso3}|${i.indicatorName}`, i.value]));
  const mismatches = originalGpi.indicators.filter((i) => reparsed.get(`${i.countryIso3}|${i.indicatorName}`) !== i.value);
  if (mismatches.length > 0) {
    fail(`GPI input does not reproduce ${FIXTURE_DATE}/gpi-parsed.json (${mismatches.length} mismatches, e.g. ${JSON.stringify(mismatches[0])})`);
  }
  writeJsonPretty(join(FIXTURE_RAW_DIR, 'gpi-parsed.json'), {
    source: 'gpi',
    fetchedAt: originalGpi.fetchedAt,
    indicators: gpi,
  } satisfies RawSourceData);

  // 4. The v9.1 reference scores of the same day (the calibration target, SPEC §3).
  const snapshot = JSON.parse(readFileSync(V91_SNAPSHOT, 'utf-8')) as DailySnapshot;
  if (!snapshot.weightsVersion.startsWith('9.1')) fail(`${V91_SNAPSHOT} is not a v9.1 snapshot (${snapshot.weightsVersion})`);
  const reference: V91Reference = {
    date: snapshot.date,
    weightsVersion: snapshot.weightsVersion,
    countries: Object.fromEntries(
      snapshot.countries.map((c) => [c.iso3, { score: c.score as number, scoreDisplay: c.scoreDisplay as number, sources: c.sources.length }]),
    ),
  };
  writeJsonPretty(V91_REFERENCE_PATH, reference);

  // 5. Provenance.
  const count = (indicators: RawSourceData['indicators'], name: string) => indicators.filter((i) => i.indicatorName === name).length;
  writeJsonPretty(join(FIXTURE_RAW_DIR, 'MANIFEST.json'), {
    date: FIXTURE_DATE,
    builtBy: 'scripts/build-v10-fixture.ts',
    copiedFromDataRaw: copied,
    inform: {
      parser: 'src/pipeline/fetchers/inform-parse.ts parseInformWorkbook',
      workbook: `data/raw/inform/${edition.file}`,
      workbookMd5: md5(workbookPath),
      sheet: inform.sheetName,
      editionYear: inform.editionYear,
      countries: inform.countries,
      mapping: inform.mapping,
    },
    gpi: {
      parser: 'src/pipeline/fetchers/gpi.ts gpiEntriesToIndicators',
      input: 'scripts/fixtures/v10/inputs/gpi-2026-domains.json',
      inputMd5: md5(GPI_INPUT),
      year: gpiYear,
      rows: gpi.length,
      gpiConflictRows: count(gpi, 'gpi_conflict'),
      reproducesCommittedFields: `${originalGpi.indicators.length} rows of data/raw/${FIXTURE_DATE}/gpi-parsed.json, 0 mismatches`,
    },
    v91Reference: { snapshot: `data/scores/${FIXTURE_DATE}.json`, snapshotMd5: md5(V91_SNAPSHOT), countries: snapshot.countries.length },
  });

  console.log(`Fixture written to ${FIXTURE_RAW_DIR}`);
  console.log(`  copied ${Object.keys(copied).length} file(s) from data/raw/${FIXTURE_DATE}`);
  console.log(`  INFORM ${edition.file}: sheet "${inform.sheetName}", edition ${inform.editionYear}, ${inform.countries} countries, ${inform.indicators.length} rows`);
  console.log(`  GPI ${gpiYear}: ${gpi.length} rows (${count(gpi, 'gpi_conflict')} gpi_conflict), reproduces ${originalGpi.indicators.length} committed rows exactly`);
  console.log(`  v9.1 reference: ${snapshot.countries.length} countries -> ${V91_REFERENCE_PATH}`);
}

main();
