import type { DailySnapshot, PillarName, ScoredCountry } from '../pipeline/types';
import { getLocalizedCountryName } from './scores';
import { getBand } from './bands';

/**
 * Shared CSV serializer for the public scores dataset — the tabular twin of
 * scores.json, for people who want a spreadsheet instead of JSON (journalists,
 * researchers, Excel/Sheets users). Used by BOTH the live build-time endpoint
 * (src/pages/scores.csv.ts) and the monthly GitHub Release script
 * (scripts/generate-data-release.ts) so the two artifacts can never drift into
 * two different column sets.
 *
 * One row per country in the snapshot — the FULL 248-country coverage of
 * scores.json, deliberately NOT filtered by hasSufficientData (src/lib/hub-data.ts).
 * That floor is a ranking-eligibility concept for the safest/most-dangerous hubs
 * and the Travel Safety Index table; this file is a straight tabular export of
 * the dataset itself, so it stays in lockstep with scores.json's own coverage.
 */

const PILLAR_ORDER: PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];

const CSV_HEADER = [
  'iso3',
  'name_en',
  'score',
  'band',
  'pillar_conflict',
  'pillar_crime',
  'pillar_health',
  'pillar_governance',
  'pillar_environment',
  'confidence',
  'advisory_sources',
  'data_date',
];

/**
 * RFC 4180 field quoting: wrap in double quotes (doubling any embedded quotes)
 * only when the value contains a comma, a quote, or a line break — the sole
 * cases the spec requires quoting for. Plain fields are left bare, matching how
 * real-world CSV producers (Excel, Google Sheets, Python's csv module) behave,
 * rather than defensively quoting every field.
 */
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Count of advisory entries carrying an actual level for ONE country. Mirrors
 * the validity predicate ADVISORY_STATUS uses in site-stats.ts (which counts
 * per-GOVERNMENT across the whole snapshot) — duplicated here rather than
 * imported because that module computes a site-wide aggregate keyed by
 * government code, not a per-country total; keep the condition identical if
 * either one changes.
 */
function countAdvisorySources(country: ScoredCountry): number {
  return Object.values(country.advisories ?? {}).filter(
    (info) => info != null && info.level !== undefined && info.level !== null && info.level !== '',
  ).length;
}

function countryRow(country: ScoredCountry, dataDate: string): string {
  const pillarValues = PILLAR_ORDER.map((name) => {
    const pillar = country.pillars.find((p) => p.name === name);
    if (!pillar) return '';
    // Same 0-1 -> 1-10 transform used for pillar display everywhere else on the
    // site (SafetyMap.astro's tooltip: pillarScore * 9 + 1) — keeps every
    // score-shaped column in this CSV on the same familiar 1-10 scale as the
    // composite `score` column, instead of mixing a 0-1 raw value into a sheet
    // whose header column is already 1-10.
    return (pillar.score * 9 + 1).toFixed(1);
  });

  const fields: (string | number)[] = [
    country.iso3,
    getLocalizedCountryName(country, 'en'),
    country.score.toFixed(1),
    getBand(country.score),
    ...pillarValues,
    country.confidence.toFixed(2),
    countAdvisorySources(country),
    dataDate,
  ];
  return fields.map(csvField).join(',');
}

/**
 * Build the full scores CSV for one snapshot.
 *
 * - RFC 4180: CRLF line endings; fields quoted only when they need to be.
 * - UTF-8 with a leading BOM: the BOM costs nothing for every modern tool that
 *   already handles UTF-8 correctly, but is the difference between "opens
 *   correctly" and "mojibake" when the file is double-clicked into Excel on
 *   Windows — historically the single largest audience for a public CSV
 *   download that isn't already a dedicated data-analysis tool.
 */
export function buildScoresCsv(snapshot: DailySnapshot): string {
  const lines = [
    CSV_HEADER.join(','),
    ...snapshot.countries.map((c) => countryRow(c, snapshot.date)),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
