/**
 * Per-country grammatical forms needed to embed a localized country name into
 * a sentence, for the locales whose grammar needs more than the bare name: an
 * article (en/pt/es), a preposition+article (it/fr), or gender + case (de),
 * plus the verb number English and German need when the name is the subject
 * ("Are the Cayman Islands…", "Sind die Salomonen…"). zh needs none of this:
 * the bare name from getLocalizedCountryName is always correct there. Spanish
 * needs an article only for the names that always carry one ("al Reino
 * Unido", "a las Islas Caimán"); every other name stays bare ("a Japón").
 *
 * WHY this module exists (2026-09-25 audit, verified live): country sentences
 * were inserting the bare country name where the language needs an article,
 * preposition or gender agreement — e.g. it "Stati Uniti è Sicura?" (wrong:
 * plural masculine needs "sono Sicuri", and "in Stati Uniti" needs "negli"),
 * pt "para Estados Unidos" (missing "os"), de "nach Türkei" (missing "die"),
 * fr "France Est-il Sûr?" (France is feminine, "Est-il" is masculine). The
 * fix used here is NOT to bolt an inflecting adjective onto {name} (that
 * requires gender+number agreement everywhere the sentence touches it, which
 * is exactly what kept breaking) — it's to route the sentence through a
 * preposition/object position instead ("è sicuro viaggiare IN {name}", "é
 * seguro viajar PARA {name}", "Ist {name} sicher" nominative), which only
 * ever needs ONE grammatical decision (the article/preposition), not three
 * (article + adjective gender + verb number).
 *
 * Design: each language exposes small wrapper functions that take the ALREADY
 * resolved bare name (from getLocalizedCountryName / Intl.DisplayNames — this
 * module never duplicates those strings) and return the phrase to embed. Each
 * function consults a per-iso3 override table for irregular countries, then
 * falls back to a documented default that is correct for the majority of
 * "regular" country names. Per the implementation brief: where a territory's
 * exact form is genuinely uncertain, the default is chosen to be the
 * construction least likely to be wrong (e.g. bare "in {name}" in Italian,
 * which is correct for most singular country names) rather than a guessed
 * article/gender — so an unlisted micro-territory degrades gracefully
 * instead of reading as a clear grammar error.
 *
 * Sources consulted (2026-09-26): German articles —
 * https://deutschtraining.org/deutsche-grammatik/artikel/laender-mit-artikel/ ;
 * French au/en/aux — https://www.lawlessfrench.com/grammar/geographical-prepositions-continents-countries/
 * and https://progress.lawlessfrench.com/revision/grammar/use-en-with-feminine-countries-and-aux-with-masculine-countries-to-say-in-or-to-prepositions ;
 * Italian in/a/alle for archipelagos — Accademia della Crusca,
 * https://accademiadellacrusca.it/it/consulenza/articoli-e-preposizioni-davanti-ai-nomi-delle-isole/1300 ;
 * Portuguese country articles — https://rioandlearn.com/countries-with-articles-in-portuguese/
 * and https://ciberduvidas.iscte-iul.pt/consultorio/perguntas/o-artigo-definido-e-o-nome-dos-paises/11369 .
 * Bare names for every iso3 come from src/pipeline/config/countries.ts
 * (en/it/es/fr/pt) or Intl.DisplayNames (de/zh, which countries.ts has no
 * column for) via getLocalizedCountryName — verified against real
 * Intl.DisplayNames('de-DE') output for the whole override table below.
 */

import type { Lang } from './ui';

// ---------------------------------------------------------------------------
// Shared override table
// ---------------------------------------------------------------------------

/** Italian article to use, and which locative preposition the country pairs
 *  with. '' = no article (either a regular singular name, which drops the
 *  article after "in" — "in Giappone" — or a small single-place state/island
 *  that never takes one at all — "a Malta"). */
type ItArticle = '' | 'il' | 'lo' | 'la' | 'i' | 'gli' | 'le' | "l'";

/** Italian locative preposition: "in" for countries and large islands, "a"
 *  for small islands and city-like places ("a Malta", "alle Maldive"), "su"
 *  for places whose name is "Isola X" ("sull'Isola di Natale", as Italian
 *  says "sull'isola", never "in isola"). */
type ItPrep = 'in' | 'a' | 'su';

/** Spanish definite article, for the names that always carry one. */
type EsArticle = '' | 'el' | 'la' | 'los' | 'las';

/** Portuguese definite article. '' = the documented no-article group
 *  (Portugal, Cuba, Moçambique, Madagáscar, Israel, Cingapura, and similar). */
type PtArticle = '' | 'o' | 'a' | 'os' | 'as';

/** German grammatical gender, present only for countries that take an
 *  article at all (the majority take none — "generally, country names do
 *  not take an article in German", deutschtraining.org). 'p' = plural. */
type DeGender = 'm' | 'f' | 'n' | 'p';

/** German nominal-phrase override: `gender` decides the article, `weakForm`
 *  (rare) replaces the bare name whenever an article precedes it. Needed
 *  only for the handful of names that are themselves an inflected adjective
 *  + noun (Intl.DisplayNames returns the STRONG/no-article ending — "ein
 *  Vereinigtes Königreich" style, "-es"/"-e"/"-e" — but once an article is
 *  prepended the adjective must switch to the WEAK ending, "-e"/"-en"/"-en":
 *  "Vereinigtes Königreich" -> "das Vereinigte Königreich"; "Vereinigte
 *  Staaten" -> "die Vereinigten Staaten"; "Vereinigte Arabische Emirate" ->
 *  "die Vereinigten Arabischen Emirate". Every other override name is a
 *  plain noun (Iran, Schweiz, Zentralafrikanische Republik — feminine "-e"
 *  is identical in both declensions, so it never needs this), so this stays
 *  a short explicit list (USA, GBR, ARE, and the adjective-led territory
 *  names: die Nördlichen Marianen, die Amerikanischen Jungferninseln, das
 *  Britische Territorium im Indischen Ozean…) rather than a general
 *  adjective-declension engine. The bare names these strings rely on are
 *  pinned in countries.ts (name.de), so an ICU update cannot desync them.
 *
 *  `gender` absent = no article (the default for most German country names).
 *  `island` = an island or island group: German travels "auf die Malediven",
 *  "auf die Bouvetinsel", not "in die". `dir` = a full directional phrase for
 *  the one name no rule covers (a coordinated name whose second half needs
 *  its own preposition: "nach Südgeorgien und auf die Südlichen
 *  Sandwichinseln"). */
interface DeForm {
  gender?: DeGender;
  weakForm?: string;
  island?: boolean;
  dir?: string;
  /** with `dir`: the matching "where" and "von" phrases */
  loc?: string;
  von?: string;
}

/** French preposition family. 'a-bare' = places used exactly like a city
 *  name ("à Cuba", "à Singapour", "à Curaçao", "à Saint-Martin"), which take
 *  no au/en/aux gender decision at all. 'a-la' = the few places whose name
 *  keeps its article ("à la Barbade", "à la Grenade", "à la Cité du
 *  Vatican"). 'sur-l' = single islands named "Île X" ("sur l'île Bouvet"). */
type FrForm = 'au' | 'en' | 'aux' | 'a-bare' | 'a-la' | 'sur-l';

interface CountryGrammar {
  /** true = English conventionally prefixes "the" ("the United States"). */
  enArticle?: boolean;
  /** true = the English name takes a plural verb ("the Cayman Islands are"). */
  enPlural?: boolean;
  it?: { article: ItArticle; prep: ItPrep };
  es?: { article: EsArticle };
  pt?: { article: PtArticle };
  de?: DeForm;
  /** `phrase` replaces the whole "à/au/en … {name}" phrase for the one name
   *  no form fits ("au Svalbard et à Jan Mayen"). */
  fr?: { form: FrForm; phrase?: string };
}

/**
 * Explicit per-country overrides. Only countries whose grammar deviates from
 * the language's default rule (see each wrapper function below) need an
 * entry here — most of the 248 countries need none at all. Grouped by what
 * makes them irregular, not alphabetically, so the reasoning stays visible.
 */
const OVERRIDES: Record<string, CountryGrammar> = {
  // ---- the "state-like" plurals + generic/descriptive compound names that
  // keep their article even after Italian "in" (negli/nel/nei/nelle), take
  // "the" in English, "os/as" in Portuguese, "die" (plural) in German, and
  // "aux" in French ----
  // USA/GBR/ARE de.weakForm: Intl.DisplayNames('de-DE') returns the
  // strong/no-article adjective ending ("Vereinigte Staaten", "Vereinigtes
  // Königreich"); once "die"/"das" precedes it the adjective takes the weak
  // ending instead — see the DeForm docstring above.
  USA: { enArticle: true, it: { article: 'gli', prep: 'in' }, pt: { article: 'os' }, de: { gender: 'p', weakForm: 'Vereinigten Staaten' }, fr: { form: 'aux' } },
  GBR: { enArticle: true, it: { article: 'il', prep: 'in' }, es: { article: 'el' }, pt: { article: 'o' }, de: { gender: 'n', weakForm: 'Vereinigte Königreich' }, fr: { form: 'au' } },
  NLD: { enArticle: true, it: { article: 'i', prep: 'in' }, es: { article: 'los' }, pt: { article: 'os' }, de: { gender: 'p' }, fr: { form: 'aux' } },
  ARE: { enArticle: true, it: { article: 'gli', prep: 'in' }, es: { article: 'los' }, pt: { article: 'os' }, de: { gender: 'p', weakForm: 'Vereinigten Arabischen Emirate' }, fr: { form: 'aux' } },
  // "Republic of X" / "Democratic Republic of X" compound names: the head
  // noun ("Repubblica"/"República"/"Republik") governs gender, so these read
  // feminine in it/es/pt/de regardless of X — same pattern throughout this group.
  COD: { enArticle: true, it: { article: 'la', prep: 'in' }, es: { article: 'la' }, pt: { article: 'a' }, fr: { form: 'en' } }, // de: "Kongo-Kinshasa" officially drops the article (verified) — default applies
  // Republic of the Congo: named in full since the 2026-10-15 audit (a bare "Congo" title sat next
  // to the DR Congo page, 2 points apart); de keeps the unambiguous "Kongo-Brazzaville", no article.
  COG: { enArticle: true, it: { article: 'la', prep: 'in' }, es: { article: 'la' }, pt: { article: 'a' }, fr: { form: 'en' } },
  CAF: { it: { article: 'la', prep: 'in' }, es: { article: 'la' }, pt: { article: 'a' }, de: { gender: 'f' }, fr: { form: 'en' } }, // Zentralafrikanische Republik / a Republica Centro-Africana
  DOM: { enArticle: true, it: { article: 'la', prep: 'in' }, es: { article: 'la' }, pt: { article: 'a' }, de: { gender: 'f' }, fr: { form: 'en' } },
  CZE: { enArticle: true, it: { article: 'la', prep: 'in' }, es: { article: 'la' }, pt: { article: 'a' } }, // "Czech Republic" (site's en name) keeps "the"; de bare "Tschechien" (no article)

  // ---- small island archipelagos treated like vacation destinations in
  // Italian ("alle" rather than "nelle") ----
  // de "island": German travels "auf die Malediven", not "in die".
  MDV: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p', island: true }, fr: { form: 'aux' } },
  SYC: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p', island: true }, fr: { form: 'aux' } },
  // pt "as Bahamas": the form Brazilian Portuguese uses ("viajar para as Bahamas").
  BHS: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p', island: true }, fr: { form: 'aux' } },
  COM: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p', island: true }, fr: { form: 'aux' } },

  // ---- larger archipelago NATIONS: kept "in"/article in Italian (unlike the
  // small-vacation-island group above) per Accademia della Crusca ----
  PHL: { enArticle: true, it: { article: 'le', prep: 'in' }, pt: { article: 'as' }, de: { gender: 'p', island: true }, fr: { form: 'aux' } },

  // ---- small single-place states/islands used like a city name: no article
  // at all in it ("a"), pt (none), fr ("à" bare) ----
  MLT: { it: { article: '', prep: 'a' }, fr: { form: 'a-bare' } },
  CUB: { it: { article: '', prep: 'a' }, pt: { article: '' }, fr: { form: 'a-bare' } },
  SGP: { it: { article: '', prep: 'a' }, pt: { article: '' }, fr: { form: 'a-bare' } },
  CYP: { it: { article: '', prep: 'a' }, fr: { form: 'a-bare' } },
  MCO: { it: { article: '', prep: 'a' }, pt: { article: '' }, fr: { form: 'a-bare' } },
  BHR: { fr: { form: 'a-bare' } },
  MDG: { pt: { article: '' }, fr: { form: 'a-bare' } },
  DJI: { it: { article: '', prep: 'a' }, fr: { form: 'a-bare' } },
  HTI: { it: { article: '', prep: 'a' }, fr: { form: 'a-bare' } },
  PAN: { it: { article: '', prep: 'a' } },
  // "Città del Vaticano" / "Ciudad del Vaticano" / "Cité du Vatican" / "Vatikanstadt": the head
  // noun (city) is feminine everywhere ("nella Città", "a la Ciudad", "à la Cité", "die
  // Vatikanstadt"); pt is set in PT_ARTICLES below ("a Cidade do Vaticano").
  VAT: { it: { article: 'la', prep: 'in' }, es: { article: 'la' }, de: { gender: 'f' }, fr: { form: 'a-la' } },

  // ---- pt-only documented no-article exceptions beyond the above (source:
  // rioandlearn.com / Ciberdúvidas) ----
  PRT: { pt: { article: '' } },
  MAR: { pt: { article: '' } },
  TLS: { pt: { article: '' } },
  MOZ: { pt: { article: '' }, fr: { form: 'au' } }, // "Mozambique" ends in -e but is masculine in fr (textbook exception)
  AGO: { pt: { article: '' } },
  ISR: { pt: { article: '' } },
  HND: { pt: { article: '' } },

  // ---- pt masculine "-ã" loanwords (Middle Eastern country names borrowed
  // with a nasal ending don't follow the native "-ã = feminine" pattern —
  // e.g. "a irmã" but "o Irã" — rioandlearn.com confirms "o Irã"/"o Japão";
  // Omã grouped here by the same borrowed-nasal-ending pattern) ----
  IRN: { pt: { article: 'o' }, de: { gender: 'm' }, fr: { form: 'en' } }, // "Iran" (de) is masculine but vowel-initial in fr -> "en Iran"
  VNM: { pt: { article: 'o' } },

  // ---- German masculine (der/den) — lexicalized, no productive suffix rule ----
  IRQ: { de: { gender: 'm' }, fr: { form: 'en' } }, // "Irak" masc; fr vowel-initial -> "en Irak"
  YEM: { de: { gender: 'm' } },
  LBN: { de: { gender: 'm' } },
  OMN: { pt: { article: 'o' }, de: { gender: 'm' } },
  SEN: { de: { gender: 'm' } },
  SDN: { de: { gender: 'm' } },
  SSD: { de: { gender: 'm' } }, // "Suedsudan" — compound keeps "Sudan"'s gender
  TCD: { de: { gender: 'm' } },
  NER: { de: { gender: 'm' } }, // "Niger" (de) — same word as the river, masculine

  // ---- German feminine (die) beyond the productive "-ei" suffix rule
  // (handled generically below: Tuerkei/Mongolei/Slowakei need no entry) ----
  CHE: { de: { gender: 'f' }, fr: { form: 'en' } },
  UKR: { de: { gender: 'f' }, fr: { form: 'en' } }, // "Ukraine" vowel-initial in fr
  CIV: { de: { gender: 'f' } }, // de bare name is the loaned "Cote d'Ivoire" — "Cote" (coast) is feminine

  // ---- French exceptions to "-e/-es ending = feminine" (masculine anyway;
  // MOZ is grouped with the pt no-article exceptions above instead, to avoid
  // a duplicate MOZ key) ----
  MEX: { fr: { form: 'au' } },
  KHM: { fr: { form: 'au' } },
  ZWE: { fr: { form: 'au' } },
  BLZ: { fr: { form: 'au' } },
  SUR: { fr: { form: 'au' } },

  // ---- French masculine vowel-initial exceptions (fr "en" even though
  // masculine, per liaison) not already covered above ----
  AFG: { fr: { form: 'en' } },
  UZB: { fr: { form: 'en' } }, // "Ouzbekistan"
  ECU: { fr: { form: 'en' } }, // "Equateur"
  URY: { fr: { form: 'en' } }, // "Uruguay" — textbook example (lawlessfrench.com)
};

// AGO/OMN already have a pt/de entry above — add their fr form onto the same
// row (object spread keeps the earlier en/it/pt/de fields intact) instead of
// a second literal entry, which `Record` would just silently overwrite.
OVERRIDES.AGO = { ...OVERRIDES.AGO, fr: { form: 'en' } }; // "Angola" vowel-initial
OVERRIDES.OMN = { ...OVERRIDES.OMN, fr: { form: 'en' } }; // "Oman" vowel-initial

// French: plural countries not already listed above (USA/NLD/ARE/MDV/SYC/
// BHS/COM/PHL all set fr.form via the table already).
for (const iso3 of ['MHL', 'SLB', 'CYM', 'FLK', 'FRO', 'VGB', 'VIR', 'TCA', 'CCK', 'COK']) {
  OVERRIDES[iso3] = { ...OVERRIDES[iso3], fr: { form: 'aux' } };
}

// Portuguese articles the productive rules in getPtArticle cannot infer.
// The site's Portuguese is Brazilian ("Irã", "Quênia", "Polônia"), so these
// follow pt-BR usage. Audit 2026-10-14 (an external reader called the copy
// machine-made): the no-article default left the most-visited masculine
// countries reading "para Brasil" / "para Equador" / "para México", and the
// "-a ⇒ feminine" rule produced "a Quênia", "a Sri Lanka", "a Malta". Only
// forms used consistently in Brazilian Portuguese are listed; names whose
// usage genuinely varies (Djibuti, Mianmar, Burquina Faso, Camarões,
// Eswatini…) keep the no-article default, per the module's "least likely to
// be wrong" principle. Applied with a spread, like the French loop above, so
// rows that already carry it/de/fr data keep it.
const PT_ARTICLES: Partial<Record<PtArticle, string[]>> = {
  // masculine, always with "o": "no Brasil", "no Quênia", "no Sri Lanka"
  o: [
    'BRA', 'ECU', 'PER', 'CHL', 'CAN', 'MEX', 'URY', 'PRY', 'PAN', 'SUR', 'HTI',
    'EGY', 'IRQ', 'LBN', 'QAT', 'KWT', 'BHR', 'YEM', 'NPL', 'LAO', 'BGD', 'BRN',
    'KHM', 'LKA', 'KEN', 'SEN', 'TCD', 'NER', 'MLI', 'TGO', 'BEN', 'BDI', 'LSO',
    'MWI', 'ZWE', 'SSD', 'LUX', 'MNE', 'XKX', 'LIE', 'IOT', 'ESH',
  ],
  // feminine compounds whose last word does not end in "-a": "a Coreia do Sul",
  // "a África do Sul", "a Costa do Marfim", "a Guiné", "a Reunião" (the "-ão"
  // rule would say "o"), "a Cidade do Vaticano" (head noun "Cidade")
  a: ['KOR', 'PRK', 'ZAF', 'MKD', 'CIV', 'GIN', 'GNB', 'GNQ', 'PNG', 'SGS', 'REU', 'VAT'],
  as: ['ATF'], // "as Terras Austrais Francesas"
  // names ending in "-a" used without an article: island states and
  // territories named like places ("em Malta", "em Aruba", "em Antígua e
  // Barbuda"), and African countries Brazilian Portuguese uses bare
  // ("em Gana", "em Ruanda", "em Uganda", "em Botsuana")
  '': ['MLT', 'AND', 'WSM', 'TON', 'GRD', 'DMA', 'ABW', 'AIA', 'ATG', 'BES', 'WLF', 'ASM', 'GHA', 'RWA', 'UGA', 'BWA'],
};
for (const [article, isos] of Object.entries(PT_ARTICLES) as [PtArticle, string[]][]) {
  for (const iso3 of isos) OVERRIDES[iso3] = { ...OVERRIDES[iso3], pt: { article } };
}

// English names that read wrong without "the" (audit 2026-10-14: the live
// comparison heading said "How does Aland Islands compare…"): plural island
// groups and descriptive names. "South Georgia" and "Saint Helena"-style
// names correctly stay bare, so this is a list, not an "…Islands" rule.
for (const iso3 of [
  'ALA', 'CYM', 'CCK', 'COK', 'FLK', 'FRO', 'MHL', 'MNP', 'SLB', 'TCA', 'UMI', 'VIR', 'VGB',
  'CAF', 'IMN', 'IOT', 'ATF', 'GMB',
]) {
  OVERRIDES[iso3] = { ...OVERRIDES[iso3], enArticle: true };
}

// ---------------------------------------------------------------------------
// 2026-10-15 consistency audit. Title and H1 rendered for all 248 places x 7
// languages (scripts/audit/render-country-names.ts) and read one by one; the
// tables below fix every place a rule above got wrong. A German travel blogger
// had quoted exactly this kind of error ("Ist Salomonen sicher?", "Voyager au
// Guinée-Bissau") as proof the site was machine-written.
// ---------------------------------------------------------------------------

// English names that take a plural verb ("Are the Cayman Islands safe?"):
// island groups and "Territories". Names that are plural in form but name one
// state (the United States, the Netherlands, the Philippines, the Maldives,
// the Bahamas) keep the singular verb, as English treats them as one country.
for (const iso3 of [
  'ALA', 'CYM', 'CCK', 'COK', 'FLK', 'FRO', 'MHL', 'MNP', 'SLB', 'TCA', 'UMI', 'VIR', 'VGB', 'ATF',
]) {
  OVERRIDES[iso3] = { ...OVERRIDES[iso3], enPlural: true };
}

// Italian: small islands, island states and city-like territories take "a",
// like Malta and Cuba above ("a Capo Verde", "a Mauritius", "a Hong Kong",
// "ad Aruba"); without this list they read "in Capo Verde", "in Hong Kong".
// Larger islands keep "in" (in Giamaica, in Madagascar, in Islanda), as do the
// archipelago states whose usage varies (in Vanuatu, in Micronesia).
for (const iso3 of [
  'ATG', 'BRB', 'CPV', 'DMA', 'GRD', 'KIR', 'KNA', 'LCA', 'MUS', 'NRU', 'PLW', 'SMR', 'STP', 'TON',
  'TTO', 'TUV', 'TWN', 'VCT', 'WSM',
  'ABW', 'AIA', 'BES', 'BLM', 'CUW', 'GGY', 'GIB', 'GUM', 'HKG', 'JEY', 'MAC', 'MAF', 'MSR', 'MYT',
  'NIU', 'PCN', 'PRI', 'SHN', 'SPM', 'SXM', 'TKL', 'WLF',
]) {
  OVERRIDES[iso3] = { ...OVERRIDES[iso3], it: { article: '', prep: 'a' } };
}
// Names that keep their article in Italian and that no "Isole"/"Isola"/
// "Repubblica" rule in getItForm reaches.
const IT_FORMS: Record<string, { article: ItArticle; prep: ItPrep }> = {
  FJI: { article: 'le', prep: 'a' }, // "alle Figi" (le isole Figi)
  SJM: { article: 'le', prep: 'a' }, // "alle Svalbard e Jan Mayen"
  REU: { article: 'la', prep: 'a' }, // "alla Riunione"
  ASM: { article: 'le', prep: 'in' }, // "nelle Samoa Americane"
  ATF: { article: 'le', prep: 'in' }, // "nelle Terre australi e antartiche francesi"
  IOT: { article: 'il', prep: 'in' }, // "nel Territorio britannico dell'Oceano Indiano"
  ESH: { article: 'il', prep: 'in' }, // "nel Sahara Occidentale" (il Sahara)
};
for (const [iso3, it] of Object.entries(IT_FORMS)) OVERRIDES[iso3] = { ...OVERRIDES[iso3], it };

// French: inferFrForm's gender rule reads only the last letter, so compound
// names with a feminine head noun got "au" (au Guinée-Bissau, au Corée du
// Nord), plural island states got "au" (au Fidji), and islands used like a
// city name got au/en (au Curaçao, en Aruba). Forms as the French foreign
// ministry writes them (diplomatie.gouv.fr, "Conseils aux voyageurs").
const FR_FORMS: Partial<Record<FrForm, string[]>> = {
  en: ['GNB', 'PRK', 'KOR', 'MKD', 'SGS'], // head noun Guinée, Corée, Macédoine, Géorgie
  aux: ['FJI', 'KIR', 'PLW', 'WSM', 'TON', 'TUV', 'TKL', 'ASM', 'ATF'], // les Fidji, les Samoa…, les Terres australes…
  'a-bare': [
    'ATG', 'MUS', 'NRU', 'TTO', 'TWN', 'ABW', 'AIA', 'BES', 'CUW', 'GIB', 'GUM', 'HKG', 'JEY', 'GGY',
    'MAC', 'MYT', 'MSR', 'NIU', 'PCN', 'PRI', 'WLF',
  ],
  'a-la': ['BRB', 'GRD', 'DMA'], // la Barbade, la Grenade, la Dominique
};
for (const [form, isos] of Object.entries(FR_FORMS) as [FrForm, string[]][]) {
  for (const iso3 of isos) OVERRIDES[iso3] = { ...OVERRIDES[iso3], fr: { form } };
}
OVERRIDES.SJM = { ...OVERRIDES.SJM, fr: { form: 'au', phrase: 'au Svalbard et à Jan Mayen' } };

// German names the suffix rules in getDeForm cannot classify ("Ist Antarktis
// sicher?", "Ist Salomonen sicher?", "die Amerikanische Überseeinseln").
// Adjective-led plural names carry their weak form for use after "die".
const DE_FORMS: Record<string, DeForm> = {
  ATA: { gender: 'f' }, // die Antarktis
  ESH: { gender: 'f' }, // die Westsahara
  IMN: { gender: 'f', island: true }, // die Isle of Man
  SLB: { gender: 'p', island: true }, // die Salomonen
  FRO: { gender: 'p', island: true }, // die Färöer
  MNP: { gender: 'p', island: true, weakForm: 'Nördlichen Marianen' },
  VIR: { gender: 'p', island: true, weakForm: 'Amerikanischen Jungferninseln' },
  VGB: { gender: 'p', island: true, weakForm: 'Britischen Jungferninseln' },
  UMI: { gender: 'p', island: true, weakForm: 'Amerikanischen Überseeinseln' },
  ATF: { gender: 'p', weakForm: 'Französischen Süd- und Antarktisgebiete' },
  BES: { gender: 'p', weakForm: 'Karibischen Niederlande' },
  PSE: { gender: 'p', weakForm: 'Palästinensischen Autonomiegebiete' },
  IOT: { gender: 'n', weakForm: 'Britische Territorium im Indischen Ozean' },
  // "Brunei" ends in "-ei" but is not one of the feminine "-ei" names (die
  // Türkei, die Mongolei): no article, like most country names.
  BRN: {},
  // One territory with a coordinated name: singular, no article (as German
  // writes it), and the second half needs its own preposition.
  SGS: {
    dir: 'nach Südgeorgien und auf die Südlichen Sandwichinseln',
    loc: 'in Südgeorgien und auf den Südlichen Sandwichinseln',
    von: 'von Südgeorgien und den Südlichen Sandwichinseln',
  },
};
for (const [iso3, de] of Object.entries(DE_FORMS)) OVERRIDES[iso3] = { ...OVERRIDES[iso3], de };

// Spanish names that always carry their article (RAE, Diccionario
// panhispánico de dudas: "el Reino Unido", "la Antártida"); the "Islas"/
// "Isla"/"República" rules in getEsArticle cover the rest. Optional-article
// names (Estados Unidos, India, Perú) stay bare, which is never wrong.
for (const [iso3, article] of [['ATA', 'la'], ['ESH', 'el'], ['IOT', 'el'], ['ATF', 'las']] as [string, EsArticle][]) {
  OVERRIDES[iso3] = { ...OVERRIDES[iso3], es: { article } };
}

// ---------------------------------------------------------------------------
// English — "the {name}"
// ---------------------------------------------------------------------------

function hasEnglishArticle(iso3: string): boolean {
  return OVERRIDES[iso3]?.enArticle === true;
}

/** "Japan" | "the United States". Default: no article (correct for the
 *  large majority of English country names). */
export function getEnglishCountryPhrase(iso3: string, bareName: string): string {
  return hasEnglishArticle(iso3) ? `the ${bareName}` : bareName;
}

/** True for the island groups and territories English treats as plural
 *  ("the Cayman Islands are", "the Solomon Islands have"). `bareName` is
 *  unused today and kept for symmetry with the other helpers. */
export function isEnglishPlural(iso3: string, _bareName?: string): boolean {
  return OVERRIDES[iso3]?.enPlural === true;
}

/** "Is" | "Are" — the verb a title needs with the name as subject ("Is Japan
 *  safe?", "Are the Cayman Islands safe?"). */
export function getEnglishCopula(iso3: string, bareName?: string): 'Is' | 'Are' {
  return isEnglishPlural(iso3, bareName) ? 'Are' : 'Is';
}

/** "Japan's" | "the Philippines'" | "the Cayman Islands'" — names ending in
 *  "s" take the bare apostrophe, as English does for plural-form names. */
export function getEnglishPossessive(iso3: string, bareName: string): string {
  const phrase = getEnglishCountryPhrase(iso3, bareName);
  return /s$/.test(phrase) ? `${phrase}'` : `${phrase}'s`;
}

// ---------------------------------------------------------------------------
// Spanish — "a {name}" / "al Reino Unido" / "a las Islas Caimán"
// ---------------------------------------------------------------------------

function getEsArticle(iso3: string, bareName: string): EsArticle {
  const override = OVERRIDES[iso3]?.es?.article;
  if (override !== undefined) return override;
  // Generic head nouns keep their article: "las Islas Marshall", "la Isla de
  // Man", "la República Checa".
  if (/^Islas\s/.test(bareName)) return 'las';
  if (/^Isla\s/.test(bareName)) return 'la';
  if (/^República\s/.test(bareName)) return 'la';
  return '';
}

/** "Japón" | "el Reino Unido" | "las Islas Caimán" — the name as Spanish
 *  writes it in running text. */
export function getSpanishWithArticle(iso3: string, bareName: string): string {
  const article = getEsArticle(iso3, bareName);
  return article ? `${article} ${bareName}` : bareName;
}

/** The name as the subject of a singular verb: "el Reino Unido es", "la República Checa tiene",
 *  but "Países Bajos es", "Islas Caimán tiene" — with its plural article the name would need a
 *  plural verb ("los Países Bajos son"), and the copy's templates conjugate in the singular, as
 *  Spanish press does for a country named without its article. */
export function getSpanishSubject(iso3: string, bareName: string): string {
  const article = getEsArticle(iso3, bareName);
  return article === 'el' || article === 'la' ? `${article} ${bareName}` : bareName;
}

/** "de Japón" | "del Reino Unido" | "de los Países Bajos" | "de las Islas
 *  Caimán" — "de" contracted with "el" ("el gobierno del Reino Unido"). */
export function getSpanishDe(iso3: string, bareName: string): string {
  const article = getEsArticle(iso3, bareName);
  if (article === 'el') return `del ${bareName}`;
  return article ? `de ${article} ${bareName}` : `de ${bareName}`;
}

/** "a Japón" | "al Reino Unido" | "a la República Dominicana" | "a las Islas
 *  Caimán" — "a" contracted with "el". Used after "viajar" in the title/H1. */
export function getSpanishA(iso3: string, bareName: string): string {
  const article = getEsArticle(iso3, bareName);
  if (article === 'el') return `al ${bareName}`;
  return article ? `a ${article} ${bareName}` : `a ${bareName}`;
}

// ---------------------------------------------------------------------------
// Italian — locative ("viaggiare in/a {name}") and generic (article-bearing,
// e.g. "per {name}") forms
// ---------------------------------------------------------------------------

const IT_CONTRACT: Record<ItPrep, Record<ItArticle, string>> = {
  in: { '': 'in', il: 'nel', lo: 'nello', la: 'nella', i: 'nei', gli: 'negli', le: 'nelle', "l'": "nell'" },
  a: { '': 'a', il: 'al', lo: 'allo', la: 'alla', i: 'ai', gli: 'agli', le: 'alle', "l'": "all'" },
  su: { '': 'su', il: 'sul', lo: 'sullo', la: 'sulla', i: 'sui', gli: 'sugli', le: 'sulle', "l'": "sull'" },
};

function getItForm(iso3: string, bareName: string): { article: ItArticle; prep: ItPrep } {
  const override = OVERRIDES[iso3]?.it;
  if (override) return override;
  // Pattern rule: "Isole X" (Islands X) is always plural feminine in
  // Italian and keeps its article after "in" (nelle), e.g. Isole Cayman,
  // Isole Cook, Isole Falkland — same category as Filippine, just not
  // individually enumerated above.
  if (bareName.startsWith('Isole ')) return { article: 'le', prep: 'in' };
  // A single "Isola X" is somewhere one is ON, with the article: "sull'Isola
  // di Natale", "sull'Isola di Man" (audit 2026-10-15: the default below
  // produced "in Isola Bouvet").
  if (bareName.startsWith('Isola ')) return { article: "l'", prep: 'su' };
  // "Repubblica X" keeps its feminine article: "nella Repubblica del Congo".
  if (bareName.startsWith('Repubblica ')) return { article: 'la', prep: 'in' };
  // Default: regular singular country name, no article, preposition "in" —
  // correct for the large majority ("in Giappone", "in Francia", "in Iran").
  return { article: '', prep: 'in' };
}

/** "in Giappone" | "negli Stati Uniti" | "alle Maldive" | "a Malta" | "ad
 *  Aruba" | "sull'Isola di Natale". Used after "viaggiare" in the H1, title
 *  and FAQ q1/q2. */
export function getItalianLocative(iso3: string, bareName: string): string {
  const { article, prep } = getItForm(iso3, bareName);
  let contracted = IT_CONTRACT[prep][article];
  // Euphonic "ad" before a name starting with "a" ("ad Aruba", "ad Antigua").
  if (contracted === 'a' && /^[Aa]/.test(bareName)) contracted = 'ad';
  return contracted.endsWith("'") ? `${contracted}${bareName}` : `${contracted} ${bareName}`;
}

/** "gli Stati Uniti" | "Giappone" (bare) — the article-bearing form used
 *  generically (e.g. after "per", which does not drop the article the way
 *  "in"/"a" do). Default is bare: safe for the small set of low-traffic
 *  sentences that use this (never the H1/title), matching the site's
 *  existing style of using country names as bare labels elsewhere. */
export function getItalianGeneric(iso3: string, bareName: string): string {
  const { article } = getItForm(iso3, bareName);
  if (!article) return bareName;
  return article.endsWith("'") ? `${article}${bareName}` : `${article} ${bareName}`;
}

// Italian names ending in "-a" that are masculine (il Canada, il Kenya, lo
// Sri Lanka, lo Zambia, il Sudafrica) and names not ending in "-a" that are
// feminine (l'Antartide, la Costa d'Avorio is caught by its head noun below).
const IT_MASC_A = new Set(['CAN', 'KEN', 'GHA', 'BWA', 'GTM', 'NIC', 'VEN', 'RWA', 'UGA', 'LKA', 'ZMB', 'ZAF', 'BFA', 'GMB', 'PAN']);
const IT_FEM_NOT_A = new Set(['ATA', 'SLE']);
// Places Italian names without any article even as a subject ("Israele è…").
const IT_NO_ARTICLE = new Set(['ISR', 'SLV', 'AND']);
// Silent "h": the article elides as before a vowel (l'Honduras).
const IT_ELIDE_H = new Set(['HND']);

/** Italian gender and number of the name as a noun phrase. Plural = the
 *  article table says i/gli/le (gli Stati Uniti, le Maldive, le Isole Cook);
 *  otherwise the gender of the head (first) word: "-a" feminine (la Francia,
 *  la Costa d'Avorio, la Corea del Sud) except a short masculine list (il
 *  Canada, lo Sri Lanka); anything else masculine (il Giappone, l'Iran). */
export function getItalianAgreement(iso3: string, bareName: string): { gender: 'm' | 'f'; plural: boolean } {
  const { article } = getItForm(iso3, bareName);
  if (article === 'i' || article === 'gli') return { gender: 'm', plural: true };
  if (article === 'le') return { gender: 'f', plural: true };
  if (article === 'la') return { gender: 'f', plural: false };
  if (article === 'il' || article === 'lo') return { gender: 'm', plural: false };
  if (IT_FEM_NOT_A.has(iso3) || /^Isola\s/.test(bareName)) return { gender: 'f', plural: false };
  const head = bareName.split(/[\s-]/)[0];
  const feminine = /a$/.test(head) && !IT_MASC_A.has(iso3);
  return { gender: feminine ? 'f' : 'm', plural: false };
}

/** The definite article Italian puts before the name in subject or object
 *  position ("il Giappone è…", "l'Iran", "lo Yemen", "gli Stati Uniti"), or ''
 *  for places used without one (Malta, Cuba, Hong Kong, Capo Verde, Israele). */
function getItalianDefiniteArticle(iso3: string, bareName: string): ItArticle {
  const { article, prep } = getItForm(iso3, bareName);
  if (article) return article;
  if (prep === 'a' || IT_NO_ARTICLE.has(iso3)) return '';
  const { gender } = getItalianAgreement(iso3, bareName);
  if (/^[AEIOUÀÈÉÌÒÙaeiou]/.test(bareName) || IT_ELIDE_H.has(iso3)) return "l'";
  if (gender === 'f') return 'la';
  // "lo" before s+consonant, z, gn, ps, x, y (lo Yemen, lo Zimbabwe, lo Sri Lanka).
  return /^(s[^aeiou]|z|gn|ps|x|y)/i.test(bareName) ? 'lo' : 'il';
}

/** "il Giappone" | "l'Iran" | "lo Yemen" | "gli Stati Uniti" | "le Maldive" |
 *  "Malta". The name as an Italian subject or direct object; capitalise the
 *  first letter at the start of a sentence ("Il Giappone è…"). */
export function getItalianWithArticle(iso3: string, bareName: string): string {
  const article = getItalianDefiniteArticle(iso3, bareName);
  if (!article) return bareName;
  return article.endsWith("'") ? `${article}${bareName}` : `${article} ${bareName}`;
}

const IT_ARTICULATED: Record<'di' | 'a' | 'da' | 'su', Record<ItArticle, string>> = {
  di: { '': 'di', il: 'del', lo: 'dello', la: 'della', i: 'dei', gli: 'degli', le: 'delle', "l'": "dell'" },
  a: { '': 'a', il: 'al', lo: 'allo', la: 'alla', i: 'ai', gli: 'agli', le: 'alle', "l'": "all'" },
  da: { '': 'da', il: 'dal', lo: 'dallo', la: 'dalla', i: 'dai', gli: 'dagli', le: 'dalle', "l'": "dall'" },
  su: { '': 'su', il: 'sul', lo: 'sullo', la: 'sulla', i: 'sui', gli: 'sugli', le: 'sulle', "l'": "sull'" },
};

/** The name after a preposition, with the article and the contraction Italian
 *  requires: "del Giappone", "dell'Afghanistan", "sugli Emirati Arabi Uniti",
 *  "per il Giappone", "di Malta". `di`/`a`/`da`/`su` contract with the
 *  article; any other preposition ("per", "con", "tra") is followed by it.
 *  For "in" use getItalianLocative, which follows the locative rules ("in
 *  Giappone", "negli Stati Uniti"). */
export function getItalianArticulated(iso3: string, bareName: string, prep: 'di' | 'a' | 'da' | 'su' | 'per' | 'con' | 'tra'): string {
  const article = getItalianDefiniteArticle(iso3, bareName);
  if (prep === 'per' || prep === 'con' || prep === 'tra') return `${prep} ${getItalianWithArticle(iso3, bareName)}`;
  const contracted = IT_ARTICULATED[prep][article];
  return contracted.endsWith("'") ? `${contracted}${bareName}` : `${contracted} ${bareName}`;
}

// ---------------------------------------------------------------------------
// Portuguese — "para {article} {name}" / "a{article contracted} {name}"
// ---------------------------------------------------------------------------

const PT_A_CONTRACT: Record<PtArticle, string> = { '': 'a', o: 'ao', a: 'à', os: 'aos', as: 'às' };

function getPtArticle(iso3: string, bareName: string): PtArticle {
  const override = OVERRIDES[iso3]?.pt?.article;
  if (override !== undefined) return override;
  // Compound place names take the article of their HEAD noun, not of their
  // last word (audit 2026-10-14): "as Ilhas Salomão" — before this rule the
  // "-ão" rule below fired on "Salomão" and produced "o Ilhas Salomão" —
  // and "a Ilha de Man". Saint-named islands are used bare, like city names
  // ("em Santa Lúcia", "em São Tomé"), so the "-a ⇒ feminine" rule below
  // must not reach them.
  if (/^Ilhas\s/.test(bareName)) return 'as';
  if (/^Ilha\s/.test(bareName)) return 'a';
  if (/^(Santa|Santo|São)\s/.test(bareName)) return '';
  // Productive rule: nouns ending in "-ão" are reliably masculine in
  // Portuguese ("o Japão", confirmed rioandlearn.com; same pattern extends
  // to Azerbaijão, Butão — not individually confirmed but the same
  // productive suffix rule as native words like "o pão"/"o irmão").
  if (/ão$/.test(bareName)) return 'o';
  // Productive default: country names ending in an UNACCENTED "a" are
  // reliably feminine in Portuguese ("a França", "a Itália", "a Turquia",
  // "a Alemanha", "a Suíça" — confirmed feminine-country list,
  // rioandlearn.com). Restricted to the unaccented vowel specifically so it
  // does NOT fire on "Panamá"/"Canadá"/"México" (stressed "á", masculine
  // WITH article — a different, less certain case left to the safe "no
  // article" default below instead of guessing "o"). Explicit overrides
  // above (e.g. Cuba, Angola — also ends in "a" but documented no-article)
  // still take precedence over this rule.
  if (/a$/.test(bareName)) return 'a';
  return ''; // safe default: no article (see module docstring)
}

/**
 * Full prepositional phrase for pt, e.g. `getPortuguesePhrase('USA', 'Estados Unidos', 'para')`
 * -> "para os Estados Unidos"; `getPortuguesePhrase('TUR', 'Turquia', 'a')` -> "à Turquia".
 * `prep`:
 *  - 'para' does not contract with the article, just precedes it: "para o Japão".
 *  - 'a' contracts with the article (a+o=ao, a+a=à, a+os=aos, a+as=às), for
 *    templates that already say "a viagem a {name}" / "viajar a {name}".
 * Default (no override): "-a" ending infers feminine (see getPtArticle);
 * otherwise no article — matches the documented no-article group (Portugal,
 * Cuba, Moçambique...) and is a safe fallback otherwise.
 */
export function getPortuguesePhrase(iso3: string, bareName: string, prep: 'para' | 'a'): string {
  const article = getPtArticle(iso3, bareName);
  if (prep === 'a') return `${PT_A_CONTRACT[article]} ${bareName}`;
  return article ? `para ${article} ${bareName}` : `para ${bareName}`;
}

/** "o Japão" | "Turquia" (bare, no preposition) — for contexts where the
 *  country name is a direct object, not the object of a preposition (e.g.
 *  "visitar {article} {name}"); pt keeps the article there too. */
export function getPortugueseWithArticle(iso3: string, bareName: string): string {
  const article = getPtArticle(iso3, bareName);
  return article ? `${article} ${bareName}` : bareName;
}

const PT_DE_CONTRACT: Record<PtArticle, string> = { '': 'de', o: 'do', a: 'da', os: 'dos', as: 'das' };

/** "do Japão" | "da Alemanha" | "dos Estados Unidos" — "de" contracted with the
 *  article, for "a segurança {de X} com a dos países vizinhos". Inherits
 *  getPtArticle's default, so a name with no override and no -a/-ão ending gets
 *  no article ("de Brasil" rather than "do Brasil"): a known gap in the article
 *  table, not something this helper can infer. */
export function getPortugueseDe(iso3: string, bareName: string): string {
  return `${PT_DE_CONTRACT[getPtArticle(iso3, bareName)]} ${bareName}`;
}

const PT_EM_CONTRACT: Record<PtArticle, string> = { '': 'em', o: 'no', a: 'na', os: 'nos', as: 'nas' };

/** "no Japão" | "na França" | "nos Estados Unidos" | "em Portugal" — "em"
 *  contracted with the article, for location ("a situação no Brasil"). */
export function getPortugueseEm(iso3: string, bareName: string): string {
  return `${PT_EM_CONTRACT[getPtArticle(iso3, bareName)]} ${bareName}`;
}

/** Gender and number from the article (o/a/os/as). Names used without an
 *  article (Portugal, Cuba, Israel) report the gender of a final "-a" and are
 *  singular; templates should avoid agreeing an adjective with those. */
export function getPortugueseAgreement(iso3: string, bareName: string): { gender: 'm' | 'f'; plural: boolean } {
  const article = getPtArticle(iso3, bareName);
  if (article === 'os') return { gender: 'm', plural: true };
  if (article === 'as') return { gender: 'f', plural: true };
  if (article === 'a') return { gender: 'f', plural: false };
  if (article === 'o') return { gender: 'm', plural: false };
  return { gender: /a$/.test(bareName) ? 'f' : 'm', plural: false };
}

// ---------------------------------------------------------------------------
// German — nominative ("Ist {nominative} sicher?"), directional ("nach
// {name}" / "in die {name}"), and "für" (always accusative)
// ---------------------------------------------------------------------------

const DE_NOM: Record<DeGender, string> = { m: 'der', f: 'die', n: 'das', p: 'die' };
const DE_ACC: Record<DeGender, string> = { m: 'den', f: 'die', n: 'das', p: 'die' }; // only 'der' changes in the accusative

function getDeForm(iso3: string, bareName: string): DeForm | undefined {
  const override = OVERRIDES[iso3]?.de;
  if (override) return override;
  // Productive suffix rule: German nouns ending in "-ei" are feminine
  // (die Tuerkei, die Mongolei, die Slowakei) — deutschtraining.org.
  if (bareName.endsWith('ei')) return { gender: 'f' };
  // "Republik X" / "X Republik" compounds take the gender of the feminine
  // head noun "Republik" (die Dominikanische Republik, die Republik Moldau).
  if (/\bRepublik\b/.test(bareName)) return { gender: 'f' };
  // "X Koenigreich" compounds take the gender of the neuter head noun
  // "Koenigreich" (das Vereinigte Koenigreich).
  if (/Königreich$/.test(bareName)) return { gender: 'n' };
  // Plural "X-inseln" (islands) compounds stay plural (die Marshallinseln,
  // die Kaimaninseln) — same category as USA/Niederlande, just not
  // individually enumerated in the override table — and singular "X-insel"
  // takes the feminine "Insel" (die Weihnachtsinsel, die Norfolkinsel).
  // Islands are travelled "auf", not "in": "auf die Kaimaninseln".
  if (bareName.endsWith('inseln')) return { gender: 'p', island: true };
  if (bareName.endsWith('insel')) return { gender: 'f', island: true };
  return undefined; // no article — the default for most German country names
}

/** "Japan" | "die Türkei" | "das Vereinigte Königreich". Used in the title. */
export function getGermanNominative(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form?.gender) return bareName;
  return `${DE_NOM[form.gender]} ${form.weakForm ?? bareName}`;
}

/**
 * True for the ~30 plural German country names (die Vereinigten Staaten, die
 * Niederlande, die Philippinen, die Malediven, die Salomonen...). Any sentence that puts
 * {name} in subject position needs this to pick the right verb form — German
 * predicate adjectives don't inflect for number, but the FINITE VERB always
 * must agree with its subject's number, plural country names included
 * ("Sind die Vereinigten Staaten sicher?", "{name} zählen zu..." not "zählt
 * zu..."). Reused by getGermanCopula below and by the a1Verdict/a1Drivers
 * verb-pair slots in getCountryFaqData (src/lib/seo.ts).
 */
export function isGermanPlural(iso3: string, bareName: string): boolean {
  return getDeForm(iso3, bareName)?.gender === 'p';
}

/**
 * "Ist" | "Sind" — the copula the title needs ("Ist {nominative} sicher?").
 * German predicate adjectives don't inflect for number ("sicher" stays
 * "sicher" either way), but the VERB still must agree with a plural subject
 * ("Sind die Vereinigten Staaten sicher?", not "Ist die Vereinigten Staaten
 * sicher?" — this was a real bug caught by testing the built title output,
 * not by the unit tests, which never rendered the copula). Every other
 * German template in this codebase asks "Ist es sicher, ... zu reisen?"
 * instead (the impersonal "es", always singular) specifically to sidestep
 * this — the title is the one place that puts the country name itself in
 * subject position, per the implementation brief.
 */
export function getGermanCopula(iso3: string, bareName: string): 'Ist' | 'Sind' {
  return isGermanPlural(iso3, bareName) ? 'Sind' : 'Ist';
}

/** "nach Japan" | "in die Türkei" | "in den Iran" | "ins Vereinigte Königreich"
 *  | "auf die Malediven". Used for "reisen nach/in ... zu reisen" (H1, FAQ
 *  q1/q2/a3). */
export function getGermanDirectional(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (form?.dir) return form.dir;
  if (!form?.gender) return `nach ${bareName}`;
  const acc = DE_ACC[form.gender];
  const prep = form.island ? `auf ${acc}` : acc === 'das' ? 'ins' : `in ${acc}`;
  return `${prep} ${form.weakForm ?? bareName}`;
}

/** "für Japan" | "für den Iran" | "für die Niederlande" — "für" always
 *  governs the accusative regardless of motion/location. */
export function getGermanFuerPhrase(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form?.gender) return `für ${bareName}`;
  return `für ${DE_ACC[form.gender]} ${form.weakForm ?? bareName}`;
}

const DE_DAT: Record<DeGender, string> = { m: 'dem', f: 'der', n: 'dem', p: 'den' };

/** The name in the dative after its article: weak adjectives take "-en" in the
 *  dative singular too ("der Dominikanischen Republik", "dem Vereinigten
 *  Königreich"), and plural nouns add "-n" unless they already end in -n/-s
 *  ("den Niederlanden", "den Färöern", "den Vereinigten Arabischen Emiraten"). */
function germanDativeName(form: DeForm, bareName: string): string {
  const base = form.weakForm ?? bareName;
  if (form.gender === 'p') return /[ns]$/.test(base) ? base : `${base}n`;
  // Singular: a leading strong/weak adjective ("Dominikanische",
  // "Vereinigtes", "Britisches") becomes the weak dative "-en".
  return bareName.replace(/^([A-ZÄÖÜ][a-zäöüß]*(?:isch|ig|lich|t))(?:e|es)(?=\s)/, '$1en');
}

/** "Japan" | "dem Iran" | "der Türkei" | "dem Vereinigten Königreich" | "den
 *  Vereinigten Staaten" — the dative noun phrase, for prepositions that
 *  govern the dative ("mit", "aus", "bei", "nach" + article…). */
export function getGermanDative(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form?.gender) return bareName;
  return `${DE_DAT[form.gender]} ${germanDativeName(form, bareName)}`;
}

/** "von Japan" | "vom Iran" | "von der Türkei" | "vom Vereinigten Königreich"
 *  | "von den Vereinigten Staaten" ("von dem" contracts to "vom"). For
 *  "Die Warnung stammt von …", "die Einschätzung von …". */
export function getGermanVon(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (form?.von) return form.von;
  if (!form?.gender) return `von ${bareName}`;
  const name = germanDativeName(form, bareName);
  return DE_DAT[form.gender] === 'dem' ? `vom ${name}` : `von ${DE_DAT[form.gender]} ${name}`;
}

/** "in Japan" | "im Iran" | "in der Türkei" | "in den Niederlanden" | "auf
 *  den Malediven" — where something is (dative), the counterpart of
 *  getGermanDirectional's "where to". */
export function getGermanLocative(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (form?.loc) return form.loc;
  if (!form?.gender) return `in ${bareName}`;
  const name = germanDativeName(form, bareName);
  const article = DE_DAT[form.gender];
  if (form.island) return `auf ${article} ${name}`;
  return article === 'dem' ? `im ${name}` : `in ${article} ${name}`;
}

// ---------------------------------------------------------------------------
// French — "au/en/aux/à {name}"
// ---------------------------------------------------------------------------

// Textbook exceptions to "ends in -e/-es => feminine" (lawlessfrench.com /
// frenchlearner.com): masculine despite the -e ending.
const FR_MASC_DESPITE_E = new Set(['MEX', 'KHM', 'ZWE', 'MOZ', 'BLZ', 'SUR']);
const FR_VOWEL_START = /^[AEIOUÀÂÉÈÊËÎÏÔÙÛaeiouàâéèêëîïôùû]/;

function inferFrForm(iso3: string, bareName: string): { form: FrForm; phrase?: string } {
  const override = OVERRIDES[iso3]?.fr;
  if (override) return override;
  // "Îles X" (Islands X) is always plural in French (aux Îles Cook, aux
  // Îles Marshall) — same category as États-Unis, just pattern-matched.
  if (bareName.startsWith('Îles ')) return { form: 'aux' };
  // A single "Île X" is somewhere one is ON: "sur l'île Bouvet" (the -e rule
  // below read "Île Bouvet" as a country and wrote "en Île Bouvet").
  if (bareName.startsWith('Île ')) return { form: 'sur-l' };
  // Saint-named islands and "La Réunion" are used like a city name, without
  // au/en: "à Saint-Martin", "à Sainte-Lucie", "à Sao Tomé-et-Principe", "à
  // La Réunion" (the rules below gave "au Saint-Martin", "en Sainte-Lucie").
  if (/^(Saint|Sainte|Sao|São|Sint)[\s-]/.test(bareName) || bareName.startsWith('La ')) return { form: 'a-bare' };
  // "Countries ending in -e or -es are feminine, while the rest are
  // masculine, with just [a handful of] exceptions" (frenchlearner.com).
  const feminine = /e$|es$/i.test(bareName) && !FR_MASC_DESPITE_E.has(iso3);
  if (feminine) return { form: 'en' };
  return { form: FR_VOWEL_START.test(bareName) ? 'en' : 'au' };
}

/** "au Japon" | "en France" | "aux États-Unis" | "à Cuba" | "à la Barbade" |
 *  "sur l'île Bouvet". Full phrase, preposition included. */
export function getFrenchPreposition(iso3: string, bareName: string): string {
  const { form, phrase } = inferFrForm(iso3, bareName);
  if (phrase) return phrase;
  if (form === 'a-bare') return `à ${bareName}`;
  if (form === 'a-la') return `à la ${bareName}`;
  // "île" is a common noun after the article: "l'île de Man" (French
  // typography capitalises it only at the start of the bare name).
  if (form === 'sur-l') return `sur l'${bareName.replace(/^Île /, 'île ')}`;
  return `${form} ${bareName}`;
}

// Vowel-initial names French uses without an article (Israël, Oman), unlike
// l'Iran, l'Italie. a-bare names (Cuba, Malte, Taïwan) never take one either.
const FR_NO_ARTICLE = new Set(['ISR', 'OMN']);
// Plural names that are feminine (les Fidji: the islands) beyond the "-es" rule.
const FR_FEM_PLURAL = new Set(['FJI', 'KIR', 'TON', 'TUV', 'WSM', 'TKL', 'BHS', 'ASM']);
// Mute "h": "de" elides (d'Haïti), unlike the aspirated h of le Honduras, la Hongrie.
const FR_ELIDE_H = new Set(['HTI']);

/** French gender and number of the name as a noun phrase: "aux" names are
 *  plural, "en" + consonant and "à la" feminine, "au" masculine; vowel-initial
 *  "en" names take the -e rule (l'Italie f, l'Iran m). Places used like a city
 *  name (à Cuba, à Taïwan) report masculine singular, the city convention;
 *  templates should avoid agreeing an adjective with them. */
export function getFrenchAgreement(iso3: string, bareName: string): { gender: 'm' | 'f'; plural: boolean } {
  const { form } = inferFrForm(iso3, bareName);
  if (form === 'aux') {
    const feminine = /^Îles\s/.test(bareName) || /es$/.test(bareName.split(' ')[0]) || FR_FEM_PLURAL.has(iso3);
    return { gender: feminine && !/^(États|Pays|Émirats)/.test(bareName) ? 'f' : 'm', plural: true };
  }
  if (form === 'a-la' || form === 'sur-l') return { gender: 'f', plural: false };
  if (form === 'a-bare' && /^(Sainte-|La )/.test(bareName)) return { gender: 'f', plural: false };
  if (form === 'au' || form === 'a-bare') return { gender: 'm', plural: false };
  // 'en': consonant-initial names are feminine (en France); vowel-initial ones
  // follow the -e rule (en Italie f, en Iran m).
  if (!FR_VOWEL_START.test(bareName)) return { gender: 'f', plural: false };
  return { gender: /e$/.test(bareName.split(/[\s-]/)[0]) && !FR_MASC_DESPITE_E.has(iso3) ? 'f' : 'm', plural: false };
}

/** "le Japon" | "la France" | "l'Iran" | "les Maldives" | "la Barbade" |
 *  "l'île de Man" | "Cuba" | "Israël" — the name with the article French puts
 *  before it as a subject or object ("Le Japon est…" at a sentence start). */
export function getFrenchWithArticle(iso3: string, bareName: string): string {
  if (iso3 === 'SJM') return 'le Svalbard et Jan Mayen';
  const { form } = inferFrForm(iso3, bareName);
  if (form === 'a-bare' || FR_NO_ARTICLE.has(iso3)) return bareName;
  if (form === 'aux') return `les ${bareName}`;
  if (form === 'a-la') return `la ${bareName}`;
  if (form === 'sur-l') return `l'${bareName.replace(/^Île /, 'île ')}`;
  if (FR_VOWEL_START.test(bareName)) return `l'${bareName}`;
  return form === 'au' ? `le ${bareName}` : `la ${bareName}`;
}

/** "du Japon" | "de la France" | "de l'Iran" | "des Maldives" | "de Cuba" |
 *  "d'Israël" — "de" contracted with the article ("la sécurité du Japon",
 *  "l'avis des États-Unis"). */
export function getFrenchDe(iso3: string, bareName: string): string {
  const phrase = getFrenchWithArticle(iso3, bareName);
  if (phrase.startsWith('le ')) return `du ${phrase.slice(3)}`;
  if (phrase.startsWith('les ')) return `des ${phrase.slice(4)}`;
  if (phrase.startsWith('la ') || phrase.startsWith("l'")) return `de ${phrase}`;
  return FR_VOWEL_START.test(phrase) || FR_ELIDE_H.has(iso3) ? `d'${phrase}` : `de ${phrase}`;
}

// ---------------------------------------------------------------------------
// Shared dispatcher for the H1 ("Is it safe to travel to {name}?", ui.ts
// country.h1_question). For en/it/es/pt/de the template leaves the whole
// country phrase to this function ("the Bahamas", "negli Stati Uniti", "al
// Reino Unido", "para o Japão", "auf die Malediven"). fr/zh keep the bare
// name: fr's H1 "{name} : est-ce sûr..." sits {name} in subject position (no
// preposition/agreement), and zh needs none. The page titles are built in
// country-title.ts from the same helpers.
// ---------------------------------------------------------------------------

export function getH1CountryPhrase(lang: Lang, iso3: string, bareName: string): string {
  switch (lang) {
    case 'en':
      return getEnglishCountryPhrase(iso3, bareName);
    case 'it':
      return getItalianLocative(iso3, bareName);
    case 'es':
      return getSpanishA(iso3, bareName);
    case 'pt':
      return getPortuguesePhrase(iso3, bareName, 'para');
    case 'de':
      return getGermanDirectional(iso3, bareName);
    default:
      return bareName; // fr, zh — bare name is already grammatically correct
  }
}

// ---------------------------------------------------------------------------
// Country comparison heading (ui.ts country.compare_title / compare_title_nearby)
// ---------------------------------------------------------------------------

/**
 * Grammar-correct country phrase for the comparison heading, in the form each
 * locale's sentence needs. `phrase` fills {name}. `copula` fills {copula}: the
 * verb that agrees with the name in the locales whose heading makes the name
 * the subject — en "does"/"do" ("How do the Åland Islands compare…"), es
 * "compara"/"comparan" ("¿Cómo se comparan las Islas Caimán…"), de
 * "ist"/"sind" ("Wie sicher sind die Niederlande…").
 *
 * The other headings avoid a bare subject wherever the language would need a
 * gender- or number-dependent verb or adjective: Italian and French put the
 * country in a locative ("la sicurezza in Germania", "la sécurité en France"),
 * Portuguese uses "de" plus article ("a segurança do Japão"), Chinese needs
 * nothing.
 */
export function getComparisonSubject(
  lang: Lang,
  iso3: string,
  bareName: string,
): { phrase: string; copula: string } {
  switch (lang) {
    case 'en':
      return { phrase: getEnglishCountryPhrase(iso3, bareName), copula: isEnglishPlural(iso3, bareName) ? 'do' : 'does' };
    case 'es': {
      // Plural exactly when Spanish writes a plural article (los Países Bajos, las Islas Caimán).
      const article = getEsArticle(iso3, bareName);
      return { phrase: getSpanishWithArticle(iso3, bareName), copula: article === 'los' || article === 'las' ? 'comparan' : 'compara' };
    }
    case 'it':
      return { phrase: getItalianLocative(iso3, bareName), copula: '' };
    case 'fr':
      return { phrase: getFrenchPreposition(iso3, bareName), copula: '' };
    case 'pt':
      return { phrase: getPortugueseDe(iso3, bareName), copula: '' };
    case 'de':
      return { phrase: getGermanNominative(iso3, bareName), copula: getGermanCopula(iso3, bareName).toLowerCase() };
    default:
      return { phrase: bareName, copula: '' }; // zh
  }
}
