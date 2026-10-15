/**
 * Renders every place name the way the country pages print it: bare name, <title> and H1, for all
 * 248 places x 7 languages, one tab-separated line each. Used to proofread the grammar of every
 * name at once (2026-10-15 consistency audit: "Ist Salomonen sicher?", "Voyager au Guinée-Bissau"
 * were found one page at a time) and to diff the output before and after a change to
 * src/i18n/country-grammar.ts or src/pipeline/config/countries.ts.
 *
 * Usage: npx tsx scripts/audit/render-country-names.ts [lang ...] > names.tsv
 *   Columns: iso3, lang, bare name, title (score shown as 6.0), H1, comparison heading.
 *   With no argument every language is printed.
 */
import { COUNTRIES } from '../../src/pipeline/config/countries';
import { getLocalizedCountryName } from '../../src/lib/scores';
import { getCountryPageTitle } from '../../src/i18n/country-title';
import { getComparisonSubject, getH1CountryPhrase } from '../../src/i18n/country-grammar';
import { languages, ui, type Lang } from '../../src/i18n/ui';

const ALL_LANGS = Object.keys(languages) as Lang[];
const requested = process.argv.slice(2) as Lang[];
const langs = requested.length > 0 ? requested : ALL_LANGS;
for (const lang of langs) {
  if (!ALL_LANGS.includes(lang)) throw new Error(`unknown language "${lang}" (known: ${ALL_LANGS.join(', ')})`);
}

for (const country of COUNTRIES) {
  for (const lang of langs) {
    const name = getLocalizedCountryName({ iso3: country.iso3, name: country.name as unknown as Record<string, string> }, lang);
    const title = getCountryPageTitle(lang, country.iso3, name, 6);
    const h1 = ui[lang]['country.h1_question'].replace('{name}', getH1CountryPhrase(lang, country.iso3, name));
    const subject = getComparisonSubject(lang, country.iso3, name);
    const heading = ui[lang]['country.compare_title'].replace('{name}', subject.phrase).replace('{copula}', subject.copula);
    console.log([country.iso3, lang, name, title, h1, heading].join('\t'));
  }
}
