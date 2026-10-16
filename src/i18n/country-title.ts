/**
 * The <title> of a country page, per locale. It used to be an inline template in each of the seven
 * src/pages/<lang>/<country route>/[slug].astro files, where no test could reach it; the 2026-10-15
 * consistency audit found grammar errors in it for whole groups of places (de "Ist Salomonen
 * sicher?", fr "Voyager au Guinée-Bissau", en "Is the Cayman Islands Safe?"). Building it here lets
 * the unit tests render all 248 places x 7 languages, and the pages stay one call each.
 *
 * Each title puts the country name in the one construction its language can inflect safely (see
 * the module docstring of country-grammar.ts): en/de make the name the subject and pick the verb
 * that agrees with it, it/pt/es/fr put it after a preposition, zh needs neither.
 */
import type { Lang } from './ui';
import { greyCopy } from './grey-copy';
import { formatTenths } from '../lib/display-number';
import {
  getEnglishCountryPhrase,
  getEnglishCopula,
  getFrenchPreposition,
  getGermanCopula,
  getGermanNominative,
  getItalianLocative,
  getPortuguesePhrase,
  getSpanishA,
} from './country-grammar';

/**
 * Title for a country page. `score` is the official score, or null for a grey place (formula v10
 * `insufficient_data`), which gets `greySuffix` (the locale's "partial data" wording, passed by the
 * page) instead of a number.
 */
export function getCountryPageTitle(
  lang: Lang,
  iso3: string,
  bareName: string,
  score: number | null,
  greySuffix: string = greyCopy[lang].titleSuffix,
): string {
  // The page language's decimal separator ("8,5/10" in it/es/fr/pt/de), as the hero and the summary.
  const tail = score === null ? null : formatTenths(score, lang);
  const grey = greySuffix;
  switch (lang) {
    case 'en': {
      // "Is Japan Safe?" | "Are the Cayman Islands Safe?" (plural island groups take "Are").
      const question = `${getEnglishCopula(iso3, bareName)} ${getEnglishCountryPhrase(iso3, bareName)} Safe?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} ${tail}/10 Safety Score (2026)`;
    }
    case 'it': {
      // "in Giappone" / "negli Stati Uniti" / "alle Maldive" / "sull'Isola di Natale".
      const question = `È sicuro viaggiare ${getItalianLocative(iso3, bareName)}?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} ${tail}/10 (2026)`;
    }
    case 'es': {
      // "a Japón" / "al Reino Unido" / "a las Islas Caimán".
      const question = `¿Es seguro viajar ${getSpanishA(iso3, bareName)}?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} ${tail}/10 (2026)`;
    }
    case 'fr': {
      // "au Japon" / "en France" / "aux Fidji" / "à Curaçao" — the preposition carries the gender,
      // so the sentence itself never has to agree with it.
      const question = `Voyager ${getFrenchPreposition(iso3, bareName)} : est-ce sûr ?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} ${tail}/10 (2026)`;
    }
    case 'pt': {
      // "para o Japão" / "para os Estados Unidos".
      const question = `É seguro viajar ${getPortuguesePhrase(iso3, bareName, 'para')}?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} ${tail}/10 (2026)`;
    }
    case 'de': {
      // "Ist die Türkei sicher?" | "Sind die Salomonen sicher?". "Sicherheitswert", not the English
      // "Score" the title used to carry (the rest of the page never says "Score").
      const question = `${getGermanCopula(iso3, bareName)} ${getGermanNominative(iso3, bareName)} sicher?`;
      return tail === null ? `${question} ${grey} (2026)` : `${question} Sicherheitswert ${tail}/10 (2026)`;
    }
    case 'zh': {
      // No space between the country name and the Chinese text around it.
      const question = `${bareName}安全吗？`;
      return tail === null ? `${question}${grey}（2026）` : `${question}安全评分${tail}/10（2026）`;
    }
  }
}
