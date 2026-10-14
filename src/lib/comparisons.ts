/**
 * Selection logic for the country page's comparison table and its
 * "related countries" block (components/country/ComparisonTable.astro and
 * RelatedCountries.astro).
 *
 * Pure: no I/O, no logging, no module state beyond the static neighbour and
 * region tables. Every ordering ends in an iso3 tie-break, so the same
 * countries always produce the same lists, whatever order the caller passes
 * them in.
 *
 * Rules:
 *  - Comparison: real neighbours (borderMap via getNeighbors) that pass
 *    hasSufficientData, by score, max 6. When fewer than
 *    MIN_NEIGHBOURS_BEFORE_FILL remain, top up to COMPARISON_SIZE with
 *    same-region countries closest in total score that also pass
 *    hasSufficientData. Fillers are "nearby", never presented as neighbours.
 *  - Related: same-region countries closest in total score, then countries
 *    with the most similar risk profile (smallest Euclidean distance over the
 *    five pillar scores). Both exclude self, data-poor countries, anything the
 *    comparison already shows, and each other.
 *  - Data coverage filters the CANDIDATES, never the page: a country with thin
 *    data still gets both sections.
 *
 * WHY: the comparison used to list the top-4 scores of the whole continental
 * bucket (Canada, Barbados, Uruguay and Chile for Ecuador), and the related
 * block listed the closest total scores worldwide, including 0-source
 * territories whose 5.9 is only the prior (Antarctica, Aland, Guernsey). A
 * reader called both meaningless.
 */
import type { ScoredCountry } from '../pipeline/types';
import { getNeighbors } from './neighbors';
import { getRegion } from './regions';
import { hasSufficientData } from './hub-data';

/** Fewer data-sufficient real neighbours than this, and nearby countries are added. */
export const MIN_NEIGHBOURS_BEFORE_FILL = 3;
/** Other-country rows in the comparison table once filled (neighbours + nearby). */
export const COMPARISON_SIZE = 4;
/** Entries per list in the related-countries block. */
export const RELATED_LIST_SIZE = 3;

/** What the comparison table shows for a country, besides the country itself. */
export interface ComparisonSelection {
  /** Real neighbours that pass hasSufficientData, score descending, max 6. */
  neighbours: ScoredCountry[];
  /** Same-region fillers. Empty unless neighbours.length < MIN_NEIGHBOURS_BEFORE_FILL. */
  nearby: ScoredCountry[];
}

/** What the related-countries block shows for a country. */
export interface RelatedSelection {
  /** Same region, closest total score first. */
  sameRegion: ScoredCountry[];
  /** Most similar risk profile first. Never repeats a sameRegion entry. */
  similarProfile: ScoredCountry[];
}

/** Plain code-unit ascending order on iso3 (locale-independent tie-break). */
function byIso3(a: ScoredCountry, b: ScoredCountry): number {
  return a.iso3 < b.iso3 ? -1 : a.iso3 > b.iso3 ? 1 : 0;
}

/** Absolute total-score gap: the closeness measure for same-region and nearby lists. */
function scoreGap(candidate: ScoredCountry, subject: ScoredCountry): number {
  return Math.abs(candidate.score - subject.score);
}

/**
 * Euclidean distance between two countries over their pillar scores (0-1 each).
 * Only pillars present on both sides count. Returns null when they share none,
 * so such a pair is never ranked. Every country in the dataset carries the full
 * five-pillar set today, so the shared-pillar rule is a guard, not a live path.
 */
export function profileDistance(a: ScoredCountry, b: ScoredCountry): number | null {
  const bScores = new Map(b.pillars.map((p) => [p.name, p.score]));
  let sumSquares = 0;
  let shared = 0;
  for (const p of a.pillars) {
    const other = bScores.get(p.name);
    if (other === undefined) continue;
    sumSquares += (p.score - other) ** 2;
    shared += 1;
  }
  return shared === 0 ? null : Math.sqrt(sumSquares);
}

/**
 * Comparison selection for one country: real neighbours first, then nearby
 * same-region fillers only when too few neighbours remain. Region "other"
 * (Antarctica and the uninhabited islets) has no regional peers, so it never
 * gets fillers: without this guard it would pull in every other "other" entry.
 */
export function selectComparison(country: ScoredCountry, allCountries: ScoredCountry[]): ComparisonSelection {
  const neighbours = getNeighbors(country.iso3, allCountries, hasSufficientData);
  const region = getRegion(country.iso3);
  if (neighbours.length >= MIN_NEIGHBOURS_BEFORE_FILL || region === 'other') {
    return { neighbours, nearby: [] };
  }

  const taken = new Set<string>([country.iso3, ...neighbours.map((c) => c.iso3)]);
  const nearby = allCountries
    .filter((c) => !taken.has(c.iso3) && hasSufficientData(c) && getRegion(c.iso3) === region)
    .sort((a, b) => scoreGap(a, country) - scoreGap(b, country) || byIso3(a, b))
    .slice(0, COMPARISON_SIZE - neighbours.length);

  return { neighbours, nearby };
}

/** Rows for the comparison table: the country itself plus its selected others, by score descending. */
export function comparisonRows(country: ScoredCountry, selection: ComparisonSelection): ScoredCountry[] {
  return [country, ...selection.neighbours, ...selection.nearby].sort(
    (a, b) => b.score - a.score || byIso3(a, b),
  );
}

/**
 * Related-countries block. `shown` is the comparison selection rendered on the
 * same page; those countries are excluded so no country appears twice.
 */
export function selectRelated(
  country: ScoredCountry,
  allCountries: ScoredCountry[],
  shown: ComparisonSelection,
): RelatedSelection {
  const excluded = new Set<string>([
    country.iso3,
    ...shown.neighbours.map((c) => c.iso3),
    ...shown.nearby.map((c) => c.iso3),
  ]);
  const candidates = allCountries.filter((c) => !excluded.has(c.iso3) && hasSufficientData(c));

  const region = getRegion(country.iso3);
  const sameRegion: ScoredCountry[] =
    region === 'other'
      ? []
      : candidates
          .filter((c) => getRegion(c.iso3) === region)
          .sort((a, b) => scoreGap(a, country) - scoreGap(b, country) || byIso3(a, b))
          .slice(0, RELATED_LIST_SIZE);

  const regionShown = new Set(sameRegion.map((c) => c.iso3));
  const similarProfile = candidates
    .filter((c) => !regionShown.has(c.iso3))
    .map((c) => ({ c, d: profileDistance(country, c) }))
    .filter((x): x is { c: ScoredCountry; d: number } => x.d !== null)
    .sort((x, y) => x.d - y.d || byIso3(x.c, y.c))
    .slice(0, RELATED_LIST_SIZE)
    .map((x) => x.c);

  return { sameRegion, similarProfile };
}
