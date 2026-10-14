/**
 * Shared data for the 7 localized country page routes (src/pages/{lang}/{country-slug}/[slug].astro).
 *
 * WHY: the 7 route files each carried an identical getStaticPaths (and an identical page body),
 * so a rule like "grey places have no rank" (formula v10, SPEC §4) had to be repeated 7 times and
 * could drift. The routes now call buildCountryPagePaths() and render CountryPageBody.astro; each
 * route keeps only what is genuinely per-locale (its title).
 */
import type { ScoredCountry, SentimentEntry } from '../pipeline/types';
import type { HistoryPoint, PillarHistoryData } from './scores';
import { loadLatestScores, loadHistoricalScores, loadPillarHistory, getScoreDelta } from './scores';
import { loadSentimentForCountry } from './sentiment';
import { buildRankMap, isScored } from './score-status';

// A type alias, not an interface: getStaticPaths props must be assignable to Record<string, unknown>.
export type CountryPageProps = {
  country: ScoredCountry;
  allCountries: ScoredCountry[];
  /** Official-score history (grey days left out); not rendered for a grey place. */
  trend: HistoryPoint[];
  pillarTrend: PillarHistoryData | null;
  /** 7-day change of the official score; null for a grey place or without comparable history. */
  scoreDelta: { delta: number; period: string } | null;
  /** Rank among the countries with an official score (1 = safest); 0 for a grey place. */
  rank: number;
  /** Number of countries with an official score. */
  totalCountries: number;
  sentiment: SentimentEntry | null;
};

/** getStaticPaths entries for one localized country route: one page per country in the snapshot. */
export function buildCountryPagePaths(): Array<{ params: { slug: string }; props: CountryPageProps }> {
  const countries = loadLatestScores();
  const history = loadHistoricalScores();
  const { ranks, total } = buildRankMap(countries);

  return countries.map((country) => {
    const scored = isScored(country);
    return {
      params: { slug: country.iso3.toLowerCase() },
      props: {
        country,
        allCountries: countries,
        trend: scored ? history.get(country.iso3) ?? [] : [],
        pillarTrend: scored ? loadPillarHistory(country.iso3) : null,
        scoreDelta: scored ? getScoreDelta(country.iso3, history) : null,
        rank: ranks.get(country.iso3) ?? 0,
        totalCountries: total,
        sentiment: loadSentimentForCountry(country.iso3),
      },
    };
  });
}
