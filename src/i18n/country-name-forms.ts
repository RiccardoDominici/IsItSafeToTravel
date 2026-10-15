/**
 * Extra grammatical forms of a country name, derived ONLY from the exports of country-grammar.ts
 * (2026-10-15 consistency audit, issues I19 I39 I48).
 *
 * WHY a separate file: country-grammar.ts holds the per-country article/gender data and is being
 * corrected in parallel; the FAQ needs two forms it does not export yet. Deriving them from its
 * public helpers means every fix to its per-country data reaches these forms automatically:
 *  - French definite article ("les États-Unis", "l'Australie", "le Canada"), read off the
 *    preposition family getFrenchPreposition already decides (aux -> les, au -> le, en -> la/l',
 *    à -> no article);
 *  - German "über" + accusative ("über die Schweiz", "über den Iran"), which takes exactly the
 *    article of the "für" phrase (both prepositions govern the accusative).
 */
import { getFrenchPreposition, getGermanFuerPhrase } from './country-grammar';

const FR_VOWEL_START = /^[AEIOUYÀÂÉÈÊËÎÏÔÙÛaeiouyàâéèêëîïôùû]/;

/** Places French names without any article, like a city ("Taïwan a publié", "Hong Kong déconseille"). */
const FR_NO_ARTICLE = new Set(['TWN', 'HKG']);

/** "les États-Unis" | "l'Australie" | "le Canada" | "la Pologne" | "Singapour". */
export function getFrenchDefinite(iso3: string, bareName: string): string {
  if (FR_NO_ARTICLE.has(iso3)) return bareName;
  const phrase = getFrenchPreposition(iso3, bareName);
  if (phrase.startsWith('aux ')) return `les ${bareName}`;
  if (phrase.startsWith('au ')) return `le ${bareName}`;
  if (phrase.startsWith('en ')) return FR_VOWEL_START.test(bareName) ? `l’${bareName}` : `la ${bareName}`;
  return bareName; // "à Cuba": no article
}

/** "über Japan" | "über die Schweiz" | "über den Iran" | "über das Vereinigte Königreich". */
export function getGermanUeberPhrase(iso3: string, bareName: string): string {
  return getGermanFuerPhrase(iso3, bareName).replace(/^für /, 'über ');
}
