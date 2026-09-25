/**
 * Per-country grammatical forms needed to embed a localized country name into
 * a sentence, for the locales whose grammar needs more than the bare name: an
 * article (en/pt), a preposition+article (it/fr), or gender + case (de).
 * es and zh are NOT covered here — Spanish "a {name}" and Chinese need no
 * article/preposition agreement for a country name, so the bare name from
 * getLocalizedCountryName is always correct there.
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
 *  a 3-entry special case rather than a general adjective-declension engine. */
interface DeForm {
  gender: DeGender;
  weakForm?: string;
}

/** French preposition family. 'a-bare' = the small group of single-place
 *  states/islands used exactly like a city name ("à Cuba", "à Singapour"),
 *  which take no au/en/aux gender decision at all. */
type FrForm = 'au' | 'en' | 'aux' | 'a-bare';

interface CountryGrammar {
  /** true = English conventionally prefixes "the" ("the United States"). */
  enArticle?: boolean;
  it?: { article: ItArticle; prep: 'in' | 'a' };
  pt?: { article: PtArticle };
  de?: DeForm;
  fr?: { form: FrForm };
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
  GBR: { enArticle: true, it: { article: 'il', prep: 'in' }, pt: { article: 'o' }, de: { gender: 'n', weakForm: 'Vereinigte Königreich' }, fr: { form: 'au' } },
  NLD: { enArticle: true, it: { article: 'i', prep: 'in' }, pt: { article: 'os' }, de: { gender: 'p' }, fr: { form: 'aux' } },
  ARE: { enArticle: true, it: { article: 'gli', prep: 'in' }, pt: { article: 'os' }, de: { gender: 'p', weakForm: 'Vereinigten Arabischen Emirate' }, fr: { form: 'aux' } },
  // "Republic of X" / "Democratic Republic of X" compound names: the head
  // noun ("Repubblica"/"República"/"Republik") governs gender, so these read
  // feminine in it/pt/de regardless of X — same pattern throughout this group.
  COD: { enArticle: true, it: { article: 'la', prep: 'in' }, pt: { article: 'a' }, fr: { form: 'en' } }, // de: "Kongo-Kinshasa" officially drops the article (verified) — default applies
  COG: { pt: { article: 'o' }, fr: { form: 'au' } }, // "Kongo-Brazzaville" in de, same no-article convention as COD
  CAF: { it: { article: 'la', prep: 'in' }, pt: { article: 'a' }, de: { gender: 'f' }, fr: { form: 'en' } }, // Zentralafrikanische Republik / a Republica Centro-Africana
  DOM: { enArticle: true, it: { article: 'la', prep: 'in' }, pt: { article: 'a' }, de: { gender: 'f' }, fr: { form: 'en' } },
  CZE: { enArticle: true, it: { article: 'la', prep: 'in' }, pt: { article: 'a' } }, // "Czech Republic" (site's en name) keeps "the"; de bare "Tschechien" (no article)

  // ---- small island archipelagos treated like vacation destinations in
  // Italian ("alle" rather than "nelle") ----
  MDV: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p' }, fr: { form: 'aux' } },
  SYC: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p' }, fr: { form: 'aux' } },
  BHS: { enArticle: true, it: { article: 'le', prep: 'a' }, de: { gender: 'p' }, fr: { form: 'aux' } }, // pt: documented no-article exception (rioandlearn.com)
  COM: { enArticle: true, it: { article: 'le', prep: 'a' }, pt: { article: 'as' }, de: { gender: 'p' }, fr: { form: 'aux' } },

  // ---- larger archipelago NATIONS: kept "in"/article in Italian (unlike the
  // small-vacation-island group above) per Accademia della Crusca ----
  PHL: { enArticle: true, it: { article: 'le', prep: 'in' }, pt: { article: 'as' }, de: { gender: 'p' }, fr: { form: 'aux' } },

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
  VAT: { it: { article: 'la', prep: 'in' }, pt: { article: '' } }, // "Città del Vaticano" — Città (city) is feminine; pt "Vaticano" is a documented no-article exception

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

// ---------------------------------------------------------------------------
// Italian — locative ("viaggiare in/a {name}") and generic (article-bearing,
// e.g. "per {name}") forms
// ---------------------------------------------------------------------------

const IT_CONTRACT: Record<'in' | 'a', Record<ItArticle, string>> = {
  in: { '': 'in', il: 'nel', lo: 'nello', la: 'nella', i: 'nei', gli: 'negli', le: 'nelle', "l'": "nell'" },
  a: { '': 'a', il: 'al', lo: 'allo', la: 'alla', i: 'ai', gli: 'agli', le: 'alle', "l'": "all'" },
}

function getItForm(iso3: string, bareName: string): { article: ItArticle; prep: 'in' | 'a' } {
  const override = OVERRIDES[iso3]?.it;
  if (override) return override;
  // Pattern rule: "Isole X" (Islands X) is always plural feminine in
  // Italian and keeps its article after "in" (nelle), e.g. Isole Cayman,
  // Isole Cook, Isole Falkland — same category as Filippine, just not
  // individually enumerated above.
  if (bareName.startsWith('Isole ')) return { article: 'le', prep: 'in' };
  // Default: regular singular country name, no article, preposition "in" —
  // correct for the large majority ("in Giappone", "in Francia", "in Iran").
  return { article: '', prep: 'in' };
}

/** "in Giappone" | "negli Stati Uniti" | "alle Maldive" | "a Malta". Used
 *  after "viaggiare" in the H1, title and FAQ q1/q2. */
export function getItalianLocative(iso3: string, bareName: string): string {
  const { article, prep } = getItForm(iso3, bareName);
  const contracted = IT_CONTRACT[prep][article];
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

// ---------------------------------------------------------------------------
// Portuguese — "para {article} {name}" / "a{article contracted} {name}"
// ---------------------------------------------------------------------------

const PT_A_CONTRACT: Record<PtArticle, string> = { '': 'a', o: 'ao', a: 'à', os: 'aos', as: 'às' };

function getPtArticle(iso3: string, bareName: string): PtArticle {
  const override = OVERRIDES[iso3]?.pt?.article;
  if (override !== undefined) return override;
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
  // individually enumerated in the override table.
  if (bareName.endsWith('inseln')) return { gender: 'p' };
  return undefined; // no article — the default for most German country names
}

/** "Japan" | "die Türkei" | "das Vereinigte Königreich". Used in the title. */
export function getGermanNominative(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form) return bareName;
  return `${DE_NOM[form.gender]} ${form.weakForm ?? bareName}`;
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
  return getDeForm(iso3, bareName)?.gender === 'p' ? 'Sind' : 'Ist';
}

/** "nach Japan" | "in die Türkei" | "in den Iran" | "ins Vereinigte Königreich".
 *  Used for "reisen nach/in ... zu reisen" (H1, FAQ q1/q2/a3). */
export function getGermanDirectional(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form) return `nach ${bareName}`;
  const acc = DE_ACC[form.gender];
  const prep = acc === 'das' ? 'ins' : `in ${acc}`;
  return `${prep} ${form.weakForm ?? bareName}`;
}

/** "für Japan" | "für den Iran" | "für die Niederlande" — "für" always
 *  governs the accusative regardless of motion/location. */
export function getGermanFuerPhrase(iso3: string, bareName: string): string {
  const form = getDeForm(iso3, bareName);
  if (!form) return `für ${bareName}`;
  return `für ${DE_ACC[form.gender]} ${form.weakForm ?? bareName}`;
}

// ---------------------------------------------------------------------------
// French — "au/en/aux/à {name}"
// ---------------------------------------------------------------------------

// Textbook exceptions to "ends in -e/-es => feminine" (lawlessfrench.com /
// frenchlearner.com): masculine despite the -e ending.
const FR_MASC_DESPITE_E = new Set(['MEX', 'KHM', 'ZWE', 'MOZ', 'BLZ', 'SUR']);
const FR_VOWEL_START = /^[AEIOUÀÂÉÈÊËÎÏÔÙÛaeiouàâéèêëîïôùû]/;

function inferFrForm(iso3: string, bareName: string): FrForm {
  const override = OVERRIDES[iso3]?.fr;
  if (override) return override.form;
  // "Îles X" (Islands X) is always plural in French (aux Îles Cook, aux
  // Îles Marshall) — same category as États-Unis, just pattern-matched.
  if (bareName.startsWith('Îles ')) return 'aux';
  // "Countries ending in -e or -es are feminine, while the rest are
  // masculine, with just [a handful of] exceptions" (frenchlearner.com).
  const feminine = /e$|es$/i.test(bareName) && !FR_MASC_DESPITE_E.has(iso3);
  if (feminine) return 'en';
  return FR_VOWEL_START.test(bareName) ? 'en' : 'au';
}

/** "au Japon" | "en France" | "aux États-Unis" | "à Cuba". Full phrase,
 *  preposition included. */
export function getFrenchPreposition(iso3: string, bareName: string): string {
  const form = inferFrForm(iso3, bareName);
  if (form === 'a-bare') return `à ${bareName}`;
  return `${form} ${bareName}`;
}

// ---------------------------------------------------------------------------
// Shared dispatcher for the H1 ("Is it safe to travel to {name}?", ui.ts
// country.h1_question) and, for it/pt/de/en, the page title — those two
// surfaces use the identical construction in those 4 locales (see each
// country page .astro file). es/fr/zh keep the bare name in the H1: es's
// "a {name}" never needed a form, and fr's H1 "{name} : est-ce sûr..." sits
// {name} in subject position (no preposition/agreement either). fr's TITLE
// is a separate, deliberately ungendered construction — see the country
// page .astro files — so it does NOT go through this dispatcher.
// ---------------------------------------------------------------------------

export function getH1CountryPhrase(lang: Lang, iso3: string, bareName: string): string {
  switch (lang) {
    case 'en':
      return getEnglishCountryPhrase(iso3, bareName);
    case 'it':
      return getItalianLocative(iso3, bareName);
    case 'pt':
      return getPortuguesePhrase(iso3, bareName, 'para');
    case 'de':
      return getGermanDirectional(iso3, bareName);
    default:
      return bareName; // es, fr, zh — bare name is already grammatically correct
  }
}
