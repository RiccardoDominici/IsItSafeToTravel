/**
 * Extra grammatical forms of a country name, derived ONLY from the exports of country-grammar.ts
 * (2026-10-15 consistency audit, issues I19 I39 I48).
 *
 * WHY a separate file: the FAQ needed two forms country-grammar.ts did not export when it was
 * written. Deriving them from its public helpers means every fix to its per-country data reaches
 * these forms automatically:
 *  - French definite article ("les États-Unis", "l’Australie", "le Canada"): now simply
 *    getFrenchWithArticle, which knows the exceptions the old local rule got wrong ("l’Israël",
 *    "l’Oman", "Barbade" without its article), with the typographic apostrophe the FAQ uses;
 *  - German "über" + accusative ("über die Schweiz", "über den Iran"), which takes exactly the
 *    article of the "für" phrase (both prepositions govern the accusative).
 */
import { getFrenchWithArticle, getGermanFuerPhrase } from './country-grammar';

/** "les États-Unis" | "l’Australie" | "le Canada" | "la Pologne" | "Singapour" | "Israël". */
export function getFrenchDefinite(iso3: string, bareName: string): string {
  return getFrenchWithArticle(iso3, bareName).replace(/^l'/, 'l’');
}

/** "über Japan" | "über die Schweiz" | "über den Iran" | "über das Vereinigte Königreich". */
export function getGermanUeberPhrase(iso3: string, bareName: string): string {
  return getGermanFuerPhrase(iso3, bareName).replace(/^für /, 'über ');
}
