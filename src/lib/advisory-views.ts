/**
 * Pure data helpers for the "government travel advisories" feature: the
 * per-issuer advisory lists (hub + one page per government) and the
 * "where governments disagree" ranking. No i18n/copy here on purpose (see
 * src/i18n/government-advisories-copy.ts / governments-disagree-copy.ts for
 * that) and no Astro imports — every function takes plain data in, returns
 * plain data out, so it can be unit tested without a build.
 *
 * Honesty note (YMYL site, see CLAUDE.md / VISIBILITY-BRIEF-COMMON.md): several
 * governments (sg, nz, hk, dk, ar, br, cn, …) only ever publish an advisory for
 * countries they consider notable — most countries simply have NO entry from
 * them. Every function below treats "no entry" as exactly that (no published
 * opinion), never as an implicit "level 1 / safe". Callers must render the
 * absence honestly too (see the brief's wording) rather than defaulting a
 * missing level to anything.
 *
 * Restrictiveness bias warning: because of the above, a government that only
 * publishes escalated countries would look "most restrictive" if you naively
 * averaged its own published levels — that's a selection artifact, not a real
 * difference in how cautious it is. getIssuerComparisonStats corrects for this
 * by comparing each government's level against the SAME country's median level
 * from other governments, never against its own raw average.
 */
import type { ScoredCountry, AdvisoryInfo } from '../pipeline/types';
import { ADVISORY_CODES, type AdvisoryCode } from '../pipeline/scoring/engine';
import { COUNTRIES } from '../pipeline/config/countries';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** An issuer needs at least this many covered countries to get its own hub row + page (VISIBILITY-BRIEF Task A.1). */
export const MIN_ISSUER_COVERAGE = 20;

/** A country needs at least this many issuers reporting a level to enter the "where governments disagree" ranking (Task B). */
export const MIN_ISSUERS_FOR_DISAGREEMENT = 8;

/** Minimum number of OTHER issuers reporting on a country before "this issuer vs. the rest" is a meaningful comparison. */
const MIN_OTHER_ISSUERS_FOR_COMPARISON = 3;

/** Minimum sample size before an issuer's mean deviation is trusted enough to be named "most/least restrictive". */
const MIN_SAMPLES_FOR_RESTRICTIVENESS_CLAIM = 15;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type Level = 1 | 2 | 3 | 4;

function isValidLevel(x: number): x is Level {
  return Number.isInteger(x) && x >= 1 && x <= 4;
}

/** Read ScoredCountry.advisories as a plain, indexable map (it's declared as a fixed set of named optional fields, one per AdvisoryCode). */
function advisoriesOf(country: ScoredCountry): Partial<Record<AdvisoryCode, AdvisoryInfo>> {
  return (country.advisories ?? {}) as unknown as Partial<Record<AdvisoryCode, AdvisoryInfo>>;
}

export interface AdvisoryLevelEntry {
  code: AdvisoryCode;
  level: Level;
  info: AdvisoryInfo;
}

/**
 * This country's valid (1-4, integer) advisory levels, one entry per issuer
 * that has actually published one — in ADVISORY_CODES order (roughly
 * major-issuer-first; the same fixed order the rest of the codebase already
 * uses, e.g. seo.ts's ADVISORY_GOV_PRIORITY, so "first 2" picks below stay
 * consistent with how the site already names governments elsewhere).
 * Malformed entries (missing level, non-numeric, out of 1-4 range) are
 * dropped rather than coerced — never invent a level.
 */
export function getValidAdvisoryLevels(country: ScoredCountry): AdvisoryLevelEntry[] {
  const advisories = advisoriesOf(country);
  const out: AdvisoryLevelEntry[] = [];
  for (const code of ADVISORY_CODES) {
    const info = advisories[code];
    const level = Number(info?.level);
    if (info && isValidLevel(level)) out.push({ code, level, info });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Median / spread helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Population standard deviation (whole population of reporting issuers for this country, not a sample). */
function populationStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Round to nearest integer, ties (x.5) rounding UP — same "more cautious wins a tie" convention used for the modal level in src/lib/seo.ts getCountryFaqData. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

// ---------------------------------------------------------------------------
// Issuer <-> issuing-country mapping (for the /{issuerIso3}/ URL segment)
// ---------------------------------------------------------------------------

/** Issuer codes that are not themselves a valid ISO 3166-1 alpha-2 code. Only "uk" today (its real code is "gb"; every other issuer code IS its country's alpha-2). */
const ISSUER_ISO2_OVERRIDE: Partial<Record<string, string>> = { uk: 'gb' };

const ISO2_TO_ISO3: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso2.toUpperCase(), c.iso3]),
);

/** The issuing government's own country, as a lowercase ISO3 (us -> usa, uk -> gbr, hk -> hkg, tw -> twn, …) — the same convention /{lang}/{routes.country}/{iso3}/ already uses. Null if the code can't be resolved to a known country. */
export function getIssuerIso3(code: string): string | null {
  const iso2 = (ISSUER_ISO2_OVERRIDE[code] ?? code).toUpperCase();
  return ISO2_TO_ISO3[iso2] ?? null;
}

/** The ScoredCountry for the issuer's own country (e.g. so a page can link "more about {issuer's own country}"), or null if unresolvable or not in the current snapshot. */
export function getIssuerCountry(countries: ScoredCountry[], code: string): ScoredCountry | null {
  const iso3 = getIssuerIso3(code);
  if (!iso3) return null;
  return countries.find((c) => c.iso3 === iso3) ?? null;
}

// ---------------------------------------------------------------------------
// Coverage / eligibility (Task A.1)
// ---------------------------------------------------------------------------

export interface IssuerCoverage {
  code: AdvisoryCode;
  total: number;
  byLevel: Record<Level, number>;
}

/** How many countries this issuer covers today, broken down by unified level. */
export function getIssuerCoverage(countries: ScoredCountry[], code: AdvisoryCode): IssuerCoverage {
  const byLevel: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;
  for (const country of countries) {
    const info = advisoriesOf(country)[code];
    const level = Number(info?.level);
    if (info && isValidLevel(level)) {
      total++;
      byLevel[level]++;
    }
  }
  return { code, total, byLevel };
}

/** getIssuerCoverage for every known advisory code, in ADVISORY_CODES order. */
export function getAllIssuerCoverage(countries: ScoredCountry[]): IssuerCoverage[] {
  return ADVISORY_CODES.map((code) => getIssuerCoverage(countries, code));
}

/**
 * The most recent `updatedAt` among this issuer's valid advisories today, or
 * null if none of them carry a date (some sources never expose one — see
 * AdvisoryInfo.updatedAt's docstring in pipeline/types.ts). Plain string
 * comparison is safe even though sources mix "YYYY-MM-DD" and full ISO
 * timestamps: both always start with the same YYYY-MM-DD prefix, so
 * lexicographic order matches calendar-date order for the purpose of finding
 * the latest DAY (same-day tie-breaking between the two formats doesn't matter).
 */
export function getIssuerLatestUpdateDate(countries: ScoredCountry[], code: AdvisoryCode): string | null {
  let latest: string | null = null;
  for (const country of countries) {
    const info = advisoriesOf(country)[code];
    const level = Number(info?.level);
    if (!info || !isValidLevel(level) || !info.updatedAt) continue;
    if (!latest || info.updatedAt > latest) latest = info.updatedAt;
  }
  return latest;
}

/**
 * Issuers that clear MIN_ISSUER_COVERAGE today, sorted by coverage descending
 * (the most comprehensive lists first — a data-driven order, not an editorial
 * ranking of the governments themselves). Recomputed from the live snapshot on
 * every build, so a government that goes quiet (or a new one that ramps up)
 * moves in or out on its own — see CLAUDE.md's MIN_RANKING_SOURCES precedent.
 */
export function getEligibleIssuers(countries: ScoredCountry[]): IssuerCoverage[] {
  return getAllIssuerCoverage(countries)
    .filter((c) => c.total >= MIN_ISSUER_COVERAGE)
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Per-issuer country listing, grouped by level (Task A.2)
// ---------------------------------------------------------------------------

export interface IssuerCountryEntry {
  country: ScoredCountry;
  info: AdvisoryInfo;
  level: Level;
}

export interface IssuerLevelGroup {
  level: Level;
  entries: IssuerCountryEntry[];
}

/**
 * Every country this issuer has a valid level for, grouped level 4 -> 1 (each
 * group present even when empty, so a page can render "no level-4 countries"
 * instead of silently skipping the heading). Countries within a group are
 * sorted alphabetically by `getSortName` (pass the caller's own localized
 * name resolver) so a reader can scan for their destination.
 */
export function getCountriesForIssuer(
  countries: ScoredCountry[],
  code: AdvisoryCode,
  getSortName: (country: ScoredCountry) => string,
): IssuerLevelGroup[] {
  const byLevel: Record<Level, IssuerCountryEntry[]> = { 4: [], 3: [], 2: [], 1: [] };
  for (const country of countries) {
    const info = advisoriesOf(country)[code];
    const level = Number(info?.level);
    if (info && isValidLevel(level)) {
      byLevel[level].push({ country, info, level });
    }
  }
  const order: Level[] = [4, 3, 2, 1];
  for (const level of order) {
    byLevel[level].sort((a, b) => getSortName(a.country).localeCompare(getSortName(b.country)));
  }
  return order.map((level) => ({ level, entries: byLevel[level] }));
}

// ---------------------------------------------------------------------------
// Issuer vs. peers (Task A.2 "how this government compares" + A.1 "most/least
// restrictive" — the SAME bias-corrected computation feeds both)
// ---------------------------------------------------------------------------

export interface IssuerComparisonStat {
  code: AdvisoryCode;
  /** Number of countries this issuer rated where the comparison was possible. */
  n: number;
  /** Mean(this issuer's level − median of every OTHER issuer's level), over the same countries. Positive = rates more cautiously than peers on average; negative = more leniently. */
  meanDeviation: number;
  /** Share of those countries where this issuer's level equals the (round-half-up) median of the others. */
  agreementPct: number;
}

/**
 * For each issuer, compare its level against the median of every OTHER
 * issuer's level for the SAME country — never against its own raw average
 * across its own (possibly self-selected) coverage set. See the module
 * docstring: comparing raw averages would wrongly crown a selective publisher
 * (sg/nz/hk/…) "most restrictive" just because it only ever surfaces already-
 * risky countries.
 */
export function getIssuerComparisonStats(
  countries: ScoredCountry[],
  issuerCodes: readonly AdvisoryCode[] = ADVISORY_CODES,
  minOthers: number = MIN_OTHER_ISSUERS_FOR_COMPARISON,
): IssuerComparisonStat[] {
  const acc = new Map<AdvisoryCode, { n: number; sumDeviation: number; agree: number }>();
  for (const country of countries) {
    const levels = getValidAdvisoryLevels(country);
    if (levels.length < minOthers + 1) continue;
    for (const { code, level } of levels) {
      const others = levels.filter((l) => l.code !== code).map((l) => l.level);
      if (others.length < minOthers) continue;
      const med = median(others);
      const entry = acc.get(code) ?? { n: 0, sumDeviation: 0, agree: 0 };
      entry.n++;
      entry.sumDeviation += level - med;
      if (level === roundHalfUp(med)) entry.agree++;
      acc.set(code, entry);
    }
  }
  const out: IssuerComparisonStat[] = [];
  for (const code of issuerCodes) {
    const s = acc.get(code);
    if (!s || s.n === 0) continue;
    out.push({ code, n: s.n, meanDeviation: s.sumDeviation / s.n, agreementPct: (100 * s.agree) / s.n });
  }
  return out;
}

/** The single most and least cautious issuer relative to peers, among issuerCodes, once each clears MIN_SAMPLES_FOR_RESTRICTIVENESS_CLAIM — for the hub's "most restrictive / least restrictive government" line (Task A.1). */
export function getMostAndLeastRestrictiveIssuers(
  countries: ScoredCountry[],
  issuerCodes: readonly AdvisoryCode[],
  minSamples: number = MIN_SAMPLES_FOR_RESTRICTIVENESS_CLAIM,
): { mostRestrictive: IssuerComparisonStat | null; leastRestrictive: IssuerComparisonStat | null } {
  const stats = getIssuerComparisonStats(countries, issuerCodes).filter((s) => s.n >= minSamples);
  if (stats.length === 0) return { mostRestrictive: null, leastRestrictive: null };
  const mostRestrictive = stats.reduce((a, b) => (b.meanDeviation > a.meanDeviation ? b : a));
  const leastRestrictive = stats.reduce((a, b) => (b.meanDeviation < a.meanDeviation ? b : a));
  return { mostRestrictive, leastRestrictive };
}

// ---------------------------------------------------------------------------
// "Where governments disagree" ranking (Task B)
// ---------------------------------------------------------------------------

export interface DisagreementOutlier {
  code: AdvisoryCode;
  level: Level;
}

export interface DisagreementRow {
  country: ScoredCountry;
  /** Every issuer's level for this country (ADVISORY_CODES order) — enough to draw the 1-4 distribution bars. */
  levels: AdvisoryLevelEntry[];
  n: number;
  /** max level - min level. */
  spread: number;
  median: number;
  stdDev: number;
  /** Issuers at least 2 levels away from the median — the named "outliers". */
  outliers: DisagreementOutlier[];
}

/**
 * Countries ranked by how much governments disagree about them: spread (max -
 * min level) first, population standard deviation as the tie-break — the
 * "clear, explainable measure" the brief asks for (state it exactly like that
 * in the page copy). Only countries with >= minIssuers valid levels qualify;
 * ALL issuer codes count toward a country's own spread (not just the >= 20-
 * coverage "eligible" issuers from Task A) — a country's disagreement is about
 * every government that actually weighed in on IT, not about which governments
 * publish broadly enough to get their own page.
 */
export function getDisagreementRanking(
  countries: ScoredCountry[],
  minIssuers: number = MIN_ISSUERS_FOR_DISAGREEMENT,
): DisagreementRow[] {
  const rows: DisagreementRow[] = [];
  for (const country of countries) {
    const levels = getValidAdvisoryLevels(country);
    if (levels.length < minIssuers) continue;
    const values = levels.map((l) => l.level);
    const med = median(values);
    const spread = Math.max(...values) - Math.min(...values);
    const stdDev = populationStdDev(values);
    const outliers = levels
      .filter((l) => Math.abs(l.level - med) >= 2)
      .map((l) => ({ code: l.code, level: l.level }));
    rows.push({ country, levels, n: levels.length, spread, median: med, stdDev, outliers });
  }
  return rows.sort((a, b) => b.spread - a.spread || b.stdDev - a.stdDev);
}

/** The highest and lowest level present for a row, and up to `maxNames` issuer codes at each extreme (ADVISORY_CODES order) — for the one-line "X and Y advise against all travel; Z reports normal precautions" card sentence. */
export function getLevelExtremes(
  row: DisagreementRow,
  maxNames = 2,
): { maxLevel: Level; maxCodes: AdvisoryCode[]; minLevel: Level; minCodes: AdvisoryCode[] } {
  const values = row.levels.map((l) => l.level);
  const maxLevel = Math.max(...values) as Level;
  const minLevel = Math.min(...values) as Level;
  const maxCodes = row.levels.filter((l) => l.level === maxLevel).map((l) => l.code).slice(0, maxNames);
  const minCodes = row.levels.filter((l) => l.level === minLevel).map((l) => l.code).slice(0, maxNames);
  return { maxLevel, maxCodes, minLevel, minCodes };
}

// ---------------------------------------------------------------------------
// Headline facts (Task B "2-3 headline facts")
// ---------------------------------------------------------------------------

export interface MostDivergentIssuerStat {
  code: AdvisoryCode;
  n: number;
  outlierCount: number;
  rate: number;
}

/**
 * The issuer that is an "outlier" (see DisagreementRow.outliers) most often,
 * as a share of the qualifying countries it actually rated — NOT a raw count
 * (which would just reward high-coverage issuers). Pass the FULL, unsliced
 * getDisagreementRanking() result (not just the top-30 slice shown as cards)
 * so the stat reflects every qualifying country, and reuse the same
 * `rows` for countFullConsensus below instead of recomputing the ranking twice.
 */
export function getMostDivergentIssuer(
  rows: DisagreementRow[],
  minParticipation: number = MIN_ISSUERS_FOR_DISAGREEMENT,
): MostDivergentIssuerStat | null {
  const stats = new Map<AdvisoryCode, { n: number; outlier: number }>();
  for (const row of rows) {
    const outlierCodes = new Set(row.outliers.map((o) => o.code));
    for (const { code } of row.levels) {
      const s = stats.get(code) ?? { n: 0, outlier: 0 };
      s.n++;
      if (outlierCodes.has(code)) s.outlier++;
      stats.set(code, s);
    }
  }
  let best: MostDivergentIssuerStat | null = null;
  for (const [code, s] of stats) {
    if (s.n < minParticipation) continue;
    const rate = s.outlier / s.n;
    if (!best || rate > best.rate) best = { code, n: s.n, outlierCount: s.outlier, rate };
  }
  return best;
}

/** How many qualifying countries (spread === 0) every reporting government agrees on exactly. */
export function countFullConsensus(rows: DisagreementRow[]): number {
  return rows.filter((r) => r.spread === 0).length;
}
