/**
 * Shared normalization module for mapping diverse advisory level systems
 * to the unified 1-4 scale used by the scoring engine.
 *
 * Supports: Germany (boolean flags), Netherlands (color codes),
 * Japan (1-4 numeric), Slovakia (text-based stupen), and a generic
 * N-level mapper for future sources.
 */

import { COUNTRIES } from '../config/countries.js';

/** Unified advisory level: 1 = normal, 2 = increased caution, 3 = avoid travel, 4 = do not travel */
export type UnifiedLevel = 1 | 2 | 3 | 4;

/**
 * Normalize Germany (Auswaertiges Amt) boolean warning flags to unified 1-4 scale.
 * When multiple flags are true, the highest severity wins.
 */
export function normalizeDeLevel(flags: {
  warning: boolean;
  partialWarning: boolean;
  situationWarning: boolean;
  situationPartWarning: boolean;
}): UnifiedLevel {
  if (flags.warning) return 4;
  // Teilreisewarnung (partialWarning) flags a sub-region only (e.g. Fukushima
  // exclusion zone for Japan). At country level this is closer to "increased
  // caution" than "avoid travel", and mapping it to 3 misleadingly tags
  // otherwise-safe countries as orange.
  if (flags.partialWarning || flags.situationWarning || flags.situationPartWarning) return 2;
  return 1;
}

/**
 * Words that mark an "abgeraten"/"gewarnt" object clause as scoped to a named
 * SUB-region of a country, not the country itself (Priority 2 below relies on
 * their ABSENCE to call a clause "whole-country" — see the doc comment there).
 * Stems (not exact words): German declines these (Region -> Regionen,
 * Provinz -> Provinzen), so each is followed by \w* rather than a fixed word
 * boundary — an EXACT-word list missed Saudi Arabia's "alle weiteren
 * REGIONEN Saudi-Arabiens" (plural) during validation.
 */
const DE_REGIONAL_WORDS =
  /\b(Norden|Süden|Osten|Westen|Nordosten|Nordwesten|Südosten|Südwesten|Teil\w*|Region\w*|Gebiet\w*|Grenz\w*|Provinz\w*|Distrikt\w*|Bezirk\w*|Insel\w*|Küste\w*|Exklave\w*|Zone\w*|Departement\w*|Gouvernorat\w*|Bundesstaat\w*|Bundesland\w*|Stadt\w*|Vorort\w*|Lager\w*|streifen)\b/i;

/**
 * "andere(n)/weitere(n)/übrige(n) Landesteile/Regionen/Teile des Landes" — a
 * German idiom for "the REST of the country" — BUT ONLY when what follows it
 * is the country itself, not a re-scope to a named SUB-region: the
 * Philippines' real page reads "von nicht erforderlichen Reisen in ANDERE
 * REGIONEN VON MINDANAO ... wird abgeraten" (other regions OF MINDANAO, one
 * island group, not "of the Philippines") — the bare regex below matches
 * that identically to Israel's genuine "andere Landesteile ISRAELS", so
 * matchesRestOfCountry() must additionally verify what follows.
 */
const DE_REST_OF_COUNTRY =
  /(?:anderen?|weiteren?|übrigen?|restlichen?)\s+(?:landesteil\w*|regionen?|teile?\s+des\s+landes)/i;

/**
 * Word-boundary "Reise"/"Reisen" — NOT a bare substring match. German
 * compounds "Einreise" (entry), "Ausreise" (exit), "Weiterreise" (onward
 * travel), "Durchreise" (transit) and "Rückreise" (return trip) all CONTAIN
 * "reise" as a substring but are bureaucratic/consular terms (document and
 * vehicle rules), not safety statements — a bare /reise/i match produced
 * false Level-3 hits during validation (Serbia's "Von einer Einreise nach
 * Serbien mit einem Fahrzeug ohne gültige Hauptuntersuchung... wird
 * abgeraten" is about missing roadworthiness certificates, not danger).
 * \b correctly rejects these: there is no word boundary between "Ein" and
 * "reise" inside one compound word.
 */
const DE_TRAVEL_WORD = /\b(?:reise|reisen)\b/i;

/**
 * Normalize Germany (Auswaertiges Amt) per-country advisory TEXT (the
 * "content" field from the structured `/opendata/travelwarning/{contentId}`
 * endpoint — NOT the public HTML site, still part of AA's own opendata API)
 * to unified 1-4 scale. Repair 2026-09-25: the warning/partialWarning/
 * situationWarning/situationPartWarning booleans normalizeDeLevel reads are
 * NOT a complete signal. Audit of the live 2026-09-25 feed found
 * situationWarning/situationPartWarning true for 0/200 countries (dead
 * fields in the current feed) — AA's real 3rd tier, "Von Reisen ... wird
 * (dringend) abgeraten" (advised against, short of a formal Reisewarnung),
 * is not exposed as a boolean AT ALL, only as prose. Even `warning` can
 * under-report: Israel's page reads "wird gewarnt" for Gaza/West Bank but
 * `warning=false` at the API level, because the formal flag apparently only
 * fires for a Reisewarnung covering the ENTIRE country, while Israel's is
 * partial (see the whole-country "wird abgeraten" catch-all elsewhere on the
 * same page, which this function DOES catch — verified below).
 *
 * Call this ALONGSIDE normalizeDeLevel and take the MAX of both results: text
 * detection only ever ESCALATES what the booleans already established, never
 * downgrades it (a Pattern-2 miss on an already `warning=true` country is
 * harmless — the boolean alone still yields 4).
 *
 * Classification (checked per "<object> wird [derzeit/dringend] (abgeraten|
 * gewarnt)" sentence that mentions "Reise" — sentences that don't are
 * unrelated advice like drone rules, e.g. Congo-Brazzaville's page, and are
 * skipped):
 *  1. "andere(n) Landesteile(n)"/"andere(n) Teile(n) des Landes" — a FIXED
 *     idiom meaning "the rest of the country" regardless of what regions were
 *     already named earlier on the page — the clause is whole-country by
 *     definition. Verified: Israel ("andere Landesteile Israels... wird
 *     abgeraten"), Jordan ("andere Landesteile Jordaniens... wird
 *     abgeraten"), Lebanon ("andere Landesteile Libanons... wird DRINGEND
 *     abgeraten"), Saudi Arabia ("alle weiteren Regionen Saudi-Arabiens...
 *     wird abgeraten" — same idiom, "Regionen" instead of "Landesteile").
 *  2. The object clause names the country ITSELF (namesCountry() below —
 *     stem-matched, so it survives German adjective declension inside
 *     multi-word names) with NOTHING else: no DE_REGIONAL_WORDS, no "und"/
 *     "sowie"/comma (which would mean multiple named things, e.g. Georgia's
 *     "Abchasien, Südossetien und ... Konfliktregionen" — regional, doesn't
 *     even name Georgia). Verified whole-country hits: Bahrain, Kuwait,
 *     Cuba, Qatar, North Korea, Afghanistan (cross-checks warning=true), the
 *     UAE ("in die Vereinigten Arabischen Emirate" — the declined adjective
 *     forms are why an exact-string match on countryName is not enough).
 *     Verified CORRECT rejections (stay regional): Moldova's "Von Reisen
 *     nach TRANSNISTRIEN" (a short bare object too, but doesn't name
 *     Moldova at all — this is why country-name matching is required and a
 *     short/no-conjunction check alone is NOT enough); Lebanon's "den Süden
 *     LIBANONS" (contains "Libanon" as a possessive of "Süden", but
 *     DE_REGIONAL_WORDS catches "Süden" and rejects it).
 *  3. Neither 1 nor 2, but a travel-related "wird abgeraten"/"wird gewarnt"
 *     clause exists somewhere -> 2 (a real regional signal exists; matches
 *     "partial/sub-national warnings must stay <= 2"). Verified: Oman
 *     (Musandam exclave + Yemen border only), Georgia (Abkhazia/South
 *     Ossetia only), Burundi (named provinces/park only), Mozambique/Côte
 *     d'Ivoire (existing partialWarning=true cases — confirms this doesn't
 *     regress them).
 *  4. Nothing found -> 1. Verified: Congo-Brazzaville (its only "wird
 *     abgeraten" sentences are about drone equipment).
 *  Verb picked per matching clause: "gewarnt" (Reisewarnung wording) -> 4,
 *  "abgeraten" (incl. "dringend abgeraten") -> 3 — SOURCE-REPAIR-BRIEF's
 *  explicit rule (it does not create a separate tier for "dringend").
 *
 * A first version of this function filtered clauses with a bare /reise/i
 * substring check instead of DE_TRAVEL_WORD's word boundary, and matched
 * countryName as one exact (undeclined) string instead of namesCountry()'s
 * per-word stemming. Both produced wrong results on the FULL 200-country
 * feed (caught by re-running against all of it, not just the originally
 * flagged countries): Serbia/Hungary/Bulgaria were false-escalated to
 * Level 3 by "Einreise"/"Ausreise" (entry/exit document and vehicle rules,
 * not safety text) matching /reise/i; the UAE was under-classified to Level
 * 2 because its declined multi-word name didn't match the exact-string
 * countryName check.
 */
/**
 * Does `objectClause` name `countryName` itself? German adjectives inside a
 * multi-word official name decline with the surrounding sentence's case
 * ("Vereinigte Arabische Emirate" nominative -> "die Vereinigten Arabischen
 * Emirate" accusative after "in die..."), so an exact-string match on the
 * API's own (nominative) countryName misses these — validation found this
 * under-classified the UAE. Instead: split the name into significant words
 * (>=4 letters), strip each word's likely inflection suffix (en/er/es/e) to
 * get a rough stem, and require EVERY stem to prefix-match some word in the
 * object clause. "Vereinigte Arabische Emirate" -> stems ["Vereinigt",
 * "Arabisch", "Emirat"], all three prefix-match "Vereinigten Arabischen
 * Emirate".
 */
function namesCountry(objectClause: string, countryName: string): boolean {
  const bare = countryName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const stems = bare
    .split(/[\s-]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.replace(/(en|er|es|e)$/i, ''));
  if (stems.length === 0) return false;
  return stems.every((stem) => {
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}`, 'i').test(objectClause);
  });
}

/**
 * Does `objectClause` contain the DE_REST_OF_COUNTRY idiom AND does it
 * genuinely mean the rest of the whole COUNTRY (not the rest of some named
 * sub-region, e.g. the Philippines' "andere Regionen VON MINDANAO")? Looks
 * at what immediately follows the matched idiom for a "von <ProperNoun>"
 * re-scope (a preposition + capitalized name is how AA names a SPECIFIC
 * other place — "von Mindanao", not a generic category). Deliberately
 * narrow: an EARLIER version of this check also rejected whenever
 * DE_REGIONAL_WORDS appeared anywhere in the following ~60 characters, but
 * that broke the equally-plausible "alle weiteren Regionen UND PROVINZEN
 * <Country>" (regions AND provinces, both used as generic categories
 * enumerating the SAME whole-country catch-all, not naming one specific
 * other province) — a real construction pattern given Chad's confirmed
 * "regions and provinces" wording. Accepts: a bare "des Landes"
 * (country-agnostic placeholder for "of this country"), the country's own
 * (genitive) name, or nothing else recognizable at all.
 */
function matchesRestOfCountry(objectClause: string, countryName: string): boolean {
  const m = DE_REST_OF_COUNTRY.exec(objectClause);
  if (!m) return false;
  if (/\bdes\s+landes\b/i.test(m[0])) return true; // "...Teile DES LANDES" already names the whole country generically

  const tail = objectClause.slice(m.index + m[0].length, m.index + m[0].length + 60);
  const vonMatch = tail.match(/^\s*von\s+([A-ZÄÖÜ][\wÀ-ÿ-]*)/);
  if (vonMatch && !namesCountry(vonMatch[0], countryName)) return false;

  return true;
}

export function normalizeDeContentText(contentHtml: string, countryName: string): UnifiedLevel {
  if (!contentHtml) return 1;
  // Headings never end in a period, so a bare tag strip merges them into the
  // FOLLOWING paragraph with nothing to stop the "sentence" regex below at
  // the true sentence boundary — found on Japan's real page: "<h2>Sicherheit
  // - Teilreisewarnung</h2><p>Vor Aufenthalten... wird gewarnt.</p>"
  // collapsed into one run-on "sentence" that included the heading text (and
  // "Teilreisewarnung" contains "reise" as a substring, which the OLD,
  // non-word-boundary travel filter matched). Insert a period at each
  // heading close to make it its own (harmless, non-matching) segment.
  // Deliberately NOT done for <p>/<li>/<br> etc: AA's own paragraphs already
  // end in a period before their closing tag (confirmed across every
  // sample), and Mozambique's real page proves a single sentence CAN span
  // <p>/<li> when a province list is bulleted mid-sentence ("<p>Vor Reisen
  // in die</p><ul><li>Provinz Cabo Delgado...</li>...</ul><p>wird
  // gewarnt.</p>") — inserting periods there would wrongly sever "Reisen"
  // from "wird gewarnt" and lose the match entirely.
  const text = contentHtml
    .replace(/<\/h[1-6]>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  let best: UnifiedLevel = 1;
  const sentenceRe = /([^.]*?\bwird\b[^.]*?\b(abgeraten|gewarnt)\b[^.]*)\./g;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(text)) !== null) {
    const sentence = m[1];
    const verb = m[2].toLowerCase();
    if (!DE_TRAVEL_WORD.test(sentence)) continue; // not a travel statement (e.g. drone rules, document/vehicle entry rules)

    const wordIdx = sentence.toLowerCase().indexOf('wird');
    const objectClause = wordIdx >= 0 ? sentence.slice(0, wordIdx) : sentence;

    const isRestOfCountry = matchesRestOfCountry(objectClause, countryName);
    const isBareCountry =
      !isRestOfCountry &&
      namesCountry(objectClause, countryName) &&
      !DE_REGIONAL_WORDS.test(objectClause) &&
      !/\bund\b|\bsowie\b|,/i.test(objectClause);

    const level: UnifiedLevel =
      isRestOfCountry || isBareCountry ? (verb === 'gewarnt' ? 4 : 3) : 2;
    if (level > best) best = level;
  }

  return best;
}

/**
 * Normalize Netherlands (BZ) color codes to unified 1-4 scale.
 * Accepts both Dutch and English color names, case-insensitive.
 */
export function normalizeNlColor(color: string): UnifiedLevel {
  const lower = color.toLowerCase().trim();
  if (lower === 'rood' || lower === 'red') return 4;
  if (lower === 'oranje' || lower === 'orange') return 3;
  if (lower === 'geel' || lower === 'yellow') return 2;
  // groen / green / unknown -> normal precautions
  return 1;
}

/**
 * Normalize Japan (MOFA) numeric level to unified 1-4 scale.
 * Clamps to valid range.
 */
export function normalizeJpLevel(level: number): UnifiedLevel {
  return Math.min(4, Math.max(1, Math.round(level))) as UnifiedLevel;
}

// =============================================================================
// Japan (MOFA anzen.mofa.go.jp) whole-country vs. regional repair (2026-09-26,
// PARSER-REGIONAL-BRIEF)
// =============================================================================
//
// Source semantics: MOFA publishes danger levels PER REGION ONLY -- there is no separate
// "country-wide" field anywhere in the page or its structured `.kiken_levels` CSS-class
// legend (which just lists which of the 4 levels are used SOMEWHERE on the page, e.g. all
// 4 for India). parseJpKikenLevel (advisories-tier1.ts) reads that legend and takes the MAX
// across whatever levels are present -- correct for the legend's OWN purpose (a discovery-
// anchor sanity check that the scrape hit the right page), but wrong as the country's
// advisory level: it turns ANY single named border strip or separatist enclave into a
// whole-country "do not travel" (verified live 2026-09-26 on Armenia: a real Level-4 border
// strip with Azerbaijan promoted the WHOLE COUNTRY to 4, even though MOFA's own text
// separately states "上記以外の地域（首都エレバンを含む。）レベル1" -- "the area other than
// the above [INCLUDING THE CAPITAL YEREVAN]: Level 1"; same root cause independently
// reproduced Georgia's and Moldova's known IT/Farnesina-style bugs -- see
// PARSER-REGIONAL-BRIEF's evidence table).
//
// The fix parses the free-text region breakdown (the `<a class="underline">` link inside
// `#kikendetail` -- the ONLY place that pairs a region NAME with its level; the CSS legend
// has no names at all) into (region descriptor, level) entries, classifies each descriptor
// as either the WHOLE-COUNTRY catch-all or a named SUB-region, and applies the project's
// standing doctrine: a sub-national entry never promotes the country above Level 2, unless
// the country's OWN catch-all/main-area statement is already higher. Validated 2026-09-26
// against a full sweep of all 205 ISO3-mapped MOFA country pages (throwaway harness, not
// committed) -- 154 unchanged, 49 corrected (19 of them former Level 4s), only 2 countries
// (Croatia, North Macedonia) still return null, both because their pages have JUST had
// their advisory formally LIFTED ("危険レベル解除") with no numeric level stated anywhere,
// which parseJpKikenLevel's legend ALSO can't resolve -- not a regression.

/** One (region descriptor, level, enclosing-group-context) entry parsed out of MOFA's
 * free-text region breakdown. `outerContext` is documented on classifyJpDescriptor. */
interface JpLevelEntry {
  descriptor: string;
  level: UnifiedLevel;
  outerContext: string;
}

/** Minimal HTML-entity decode for MOFA's free text. Only the handful of entities its pages
 * actually use (verified 2026-09-26 across the full country sweep: just "&copy;" in an
 * unrelated footer) plus the standard universally-reserved five, so a stray "&amp;" inside
 * an organization name never survives into the parsed descriptor text. */
function decodeJpEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => String.fromCharCode(parseInt(code, 16)));
}

/** Scope the search window to the `#kikendetail` div's contents -- same fixed-window +
 * triple-`</div>` heuristic as parseJpKikenLevel (advisories-tier1.ts); duplicated rather
 * than shared because that function's own contract (and its regression tests) is the
 * legend-class MAX, a deliberately different, still-needed concept from this one (see the
 * section doc comment above) -- keep both in sync if MOFA ever changes this markup. */
function extractJpKikendetailWindow(html: string): string | null {
  const detailIdx = html.indexOf('<div id="kikendetail">');
  if (detailIdx === -1) return null;
  const window = html.slice(detailIdx, detailIdx + 8000);
  const closeMatch = window.match(/<\/div>\s*<\/div>\s*<\/div>/);
  return closeMatch && closeMatch.index !== undefined ? window.slice(0, closeMatch.index) : window;
}

/** Extract the free-text region breakdown: the ONE `<a class="underline">` link inside the
 * kikendetail window, `<br>`-to-newline, tags stripped, entities decoded. Returns null when
 * absent (a page whose #kikendetail div carries no such link at all -- callers must treat
 * this the same as "unparseable", never guess). */
function extractJpDetailText(window: string): string | null {
  const m = window.match(/<a class="underline"[^>]*>([\s\S]*?)<\/a>/);
  if (!m) return null;
  return decodeJpEntities(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

const JP_WHOLE_HEAD_NOUN = '(?:地域|全域|全土|全国|国内)';
/** "The capital, X, is INCLUDED" -- unambiguous at country scope; "首都" (national capital)
 * is never used for a mere provincial capital (that word is "県都"/"州都", different). */
const JP_CAPITAL_RE = /首都[^\n]{0,30}を含む/;
/** All of "the above, excluded" / "that, excluded" / "other than that" / a NAMED zone,
 * excluded -- REQUIRING the generic head noun (area / whole-territory / the nation) to
 * follow immediately (an optional possessive "の"/country name may sit in between). This is
 * deliberate, not merely "上記以外"/"それ以外" alone: Mauritania's real page has "上記を除く
 * ティリス・ゼムール州（...）、アドラール州東部（...）、タガント州..." ("EXCLUDING what was
 * named above, [here is another list of 6 SPECIFIC provinces]") -- "上記を除く" there
 * modifies a PROPER-NOUN enumeration, not a generic "the rest of the territory" noun, so it
 * must NOT count as a whole-country marker just because the "excluding the above" words are
 * present; requiring the generic head noun right after correctly excludes it. */
function jpWholeMarkerRe(countryInfix: string): RegExp {
  return new RegExp(
    `(?:上記(?:以外|を除く)|それ以外|を除く|以外の|その他)(?:の)?(?:${countryInfix})?${JP_WHOLE_HEAD_NOUN}`,
  );
}
/** Parenthetical asides -- a NAMED sub-region's own internal carve-out (CMR's real page:
 * "北部州（ナイジェリア国境地帯及びチャド国境地帯を除く）" = "Northern Province (EXCLUDING
 * the Nigeria/Chad border strip)") lives entirely inside one of these and must be stripped
 * away before hunting for a whole-country marker, or its "を除く" wrongly reads as top-level. */
const JP_PAREN_RE = /[(（][^()（）]*[)）]/g;

function stripJpParens(s: string): string {
  let prev: string | null = null;
  let cur = s;
  while (prev !== cur) {
    prev = cur;
    cur = cur.replace(JP_PAREN_RE, '');
  }
  return cur;
}

/**
 * Does `before` contain an admin-suffixed name possessively ("...の") governing a clause
 * that runs, UNPUNCTUATED (no "、"/"。" list-break), all the way to the end of `before` --
 * i.e. right up to the candidate marker? Deliberately unbounded in LENGTH: Ethiopia's real
 * page has the possessive "の" immediately before the marker ("アファール州の上記以外の
 * 地域"), but Pakistan's real page inserts a much longer relative clause in between
 * ("ハイバル・パフトゥンハー州の以下レベル３及びレベル２で指定した以外の地域" = "KP
 * province's [the area OTHER THAN what is designated Level 3 and Level 2 BELOW]") -- both
 * are structurally the SAME "province's [...] excluded area" construction, still scoped to
 * that ONE province either way; a fixed character cutoff between them missed the second
 * during the full-country-sweep harness (Pakistan wrongly gained a second, spurious
 * "whole" candidate). A genuine "の" earlier in `before` that is followed by a comma/period
 * before reaching the end (i.e. that clause already CLOSED) does not count.
 */
function jpHasUnpunctuatedPossessivePrefix(before: string): boolean {
  const possessiveRe = /(?:州|県|省|道|準州|郡)の/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = possessiveRe.exec(before)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd === -1) return false;
  return !/[、。]/.test(before.slice(lastEnd));
}

/**
 * True unless `before` (the text preceding a candidate whole-country marker) itself
 * possessively names/groups a SPECIFIC sub-region ("Ararat/Gegharkunik/Vayots Dzor/Tavush
 * provinceS's [level-4-and-level-2-excluded] area" -- Armenia's real page: still just those
 * 4 named provinces minus their own internal hotspots, not the whole country; or "the
 * NORTHEASTERN STATES's [other-than-the-above] area" -- India's real page: still just that
 * one regional group; or Ethiopia's/Pakistan's real pages, "<ONE province>'s above-excluded
 * area" -- ONE province is already enough there, since "の" directly possessively binds the
 * marker to that ONE name). Rejects when EITHER >=2 admin-suffix words (or a "諸-"
 * (various/multiple) collective prefix) appear anywhere before the marker, OR a single
 * admin-suffixed name possessively ("...の") governs an unpunctuated clause running up to
 * the marker. Genuine whole-country markers (Russia's "the area OTHER THAN the
 * Ukraine-border-strip", Belarus's "ALL OF BELARUS other than...", India's top-level "the
 * above-EXCLUDED area OF INDIA") never have either in front of them.
 */
function jpNotPossessivelyScoped(before: string): boolean {
  const adminCount = (before.match(/州|県|省|道|準州|郡/g) ?? []).length;
  const isGroupRef = /諸(?:州|県|島|地域)/.test(before);
  return adminCount < 2 && !isGroupRef && !jpHasUnpunctuatedPossessivePrefix(before);
}

/**
 * Return true if `descriptor` denotes the WHOLE-COUNTRY catch-all scope. `outerContext` is
 * everything back to the nearest ENCLOSING "●" group bullet that ISN'T part of this
 * descriptor itself (empty when the descriptor already starts at its own "●") -- needed
 * because a nested sub-clause with no bullet of its own inherits its outer group's
 * possessive scope (Egypt's real page: "...oasis list.../Level 1/上記以外の地域/Level 2"
 * sits, unbulleted, right under "●西部及び南部の砂漠地帯" (Western/Southern desert areas),
 * so its "above-excluded area" still means "the rest of THAT DESERT ZONE", not of Egypt --
 * the admin-list guard must see the desert group's own region enumeration even though it
 * lives outside this narrow descriptor's own bullet-anchored text).
 */
function classifyJpDescriptor(descriptor: string, countryNameJa: string, outerContext: string): boolean {
  const stripped = stripJpParens(descriptor);
  const guardPrefix = stripJpParens(outerContext);

  if (JP_CAPITAL_RE.test(stripped)) return true;

  const countryInfix = countryNameJa ? escapeRegexLiteral(countryNameJa) : '';
  const wholeMatch = jpWholeMarkerRe(countryInfix).exec(stripped);
  if (wholeMatch && jpNotPossessivelyScoped(guardPrefix + stripped.slice(0, wholeMatch.index))) {
    return true;
  }

  // Bare "<CountryName>全土" / bare "全土" (nothing else) = the country's OWN whole
  // territory. Deliberately NEVER bare "全域" here -- empirically that instead means "the
  // ENTIRETY of a named SUB-region" (Armenia's real page: "シュニク州全域" = "the entirety
  // of Syunik Province", not of Armenia); 全域's genuine whole-country uses are already
  // covered by the exclusion-clause check above (e.g. India's "上記以外のインド全域").
  //
  // No trailing `\b` here (unlike this file's Latin-script word-boundary checks elsewhere):
  // JavaScript's `\b` is ASCII-word-only and never matches around Japanese characters, so
  // `/全土\b/` silently fails to match "全土（ミスラタ県ミスラタ市を除く）" (Libya's real
  // page — found by the full-country-sweep harness comparing this port against the
  // validated Python prototype, where Python's Unicode-aware `\b` had masked the same bug).
  // The leading `^` anchor already does the job `\b` was meant for here.
  const head = stripped.replace(/^[●・\s]+/, '');
  return new RegExp(`^(?:${countryInfix})?全土`).test(head);
}

/** LINE-INITIAL "●" or "・" bullet markers only: "・" (U+30FB nakaguro) is also used INSIDE
 * foreign proper nouns as a word-part separator (India's real page has "東カシ・ヒルズ県" =
 * "East Khasi Hills district", "ジャインティア・ヒルズ県") -- treating every "・" as a bullet
 * mis-anchored a descriptor onto "・ヒルズ県を除く地域）" (a mid-name fragment) during
 * validation. Requiring line-start excludes those inline occurrences while still matching
 * every genuine "・sub-item" list bullet observed (each starts its own line after a `<br>`). */
const JP_BULLET_RE = /^[●・]/gm;
const JP_OUTER_BULLET_RE = /^●/gm;
const JP_LEVEL_NUM_RE = /レベル\s*([1-4１-４])/g;
const JP_FULLWIDTH_DIGIT: Record<string, string> = { '１': '1', '２': '2', '３': '3', '４': '4' };
const JP_ACTION_PREFIXES = ['退避', '渡航', '不要不急', '十分注意'];

/**
 * Is the "レベルN" match ending at `posAfterDigit` (within `body`) a REAL declaration (this
 * region/the country IS level N), not a back-reference to a PAST level ("...これまでレベル3
 * であった地域" = "the area that USED TO BE level 3", found on Iran's real page) or a
 * noun-modifier aside ("レベル３地域へ渡航...することは妨げません" = "traveling to Level-3
 * AREAS is not prohibited", found on Iraq's real page -- both mention a level number
 * without declaring a NEW one for a NEW region)? Genuine declarations are always
 * immediately followed (modulo whitespace/punctuation) by either a colon, a Japanese
 * open-quote, a change-tag bracket ("《継続》"/"（引き上げ）"/...), or start directly with
 * one of the four canonical action phrases (JP_LEVEL_TEXT's own wording, advisories-
 * tier1.ts) -- back-references/asides never have any of these right after the number, they
 * continue directly into ordinary prose.
 */
function isGenuineJpDeclaration(body: string, posAfterDigit: number): boolean {
  const after = body.slice(posAfterDigit, posAfterDigit + 20).trimStart();
  if ([':', '：', '「', '《', '(', '（'].includes(after[0])) return true;
  return JP_ACTION_PREFIXES.some((p) => after.startsWith(p));
}

/**
 * Parse (descriptor, level, outerContext) entries out of MOFA's free-text region
 * breakdown. Each descriptor starts at the NEAREST PRECEDING bullet marker, never at
 * wherever the previous entry's trailing action-phrase happened to end -- otherwise
 * leftover prose ("...(continued) <NEXT-BULLET>region name") gets glued onto the FRONT of
 * the next descriptor and can hide a leading whole-country marker from the classifier
 * (found on Belarus/Russia during validation: the catch-all bullet's own text was pushed
 * past the "must be the first token" check by the previous entry's dangling continuation
 * text).
 *
 * The region-breakdown section is whatever comes right after a "【危険レベル】"/"【危険度】"
 * header, up to the NEXT 【...】 header (usually "【ポイント】", but NOT always first --
 * Egypt's real page puts 【ポイント】 BEFORE 【危険レベル】, so this anchors on the LEVEL
 * header itself rather than assuming a fixed section order). Some pages (Belarus) have NO
 * leading header at all -- the region list is the very first thing in the block -- so the
 * header is OPTIONAL; only the "stop at the next 【...】" end boundary is not.
 */
function parseJpLevelEntries(text: string): JpLevelEntry[] {
  const headerMatch = /【(?:危険レベル|危険度)】/.exec(text);
  const rest = headerMatch ? text.slice(headerMatch.index + headerMatch[0].length) : text;
  const nextHeaderMatch = /【[^】]*】/.exec(rest);
  const body = (nextHeaderMatch ? rest.slice(0, nextHeaderMatch.index) : rest).trim();

  const bullets = [...body.matchAll(JP_BULLET_RE)].map((m) => m.index as number);
  const outerBullets = [...body.matchAll(JP_OUTER_BULLET_RE)].map((m) => m.index as number);
  const levelMatches = [...body.matchAll(JP_LEVEL_NUM_RE)].filter((m) =>
    isGenuineJpDeclaration(body, (m.index as number) + m[0].length),
  );

  const entries: JpLevelEntry[] = [];
  let prevEnd = 0;
  for (const m of levelMatches) {
    const matchStart = m.index as number;
    const candidates = bullets.filter((b) => b >= prevEnd && b < matchStart);
    const start = candidates.length ? candidates[candidates.length - 1] : prevEnd;
    const descriptor = body.slice(start, matchStart).trim();
    // Text from the nearest ENCLOSING "●" group bullet (which may be BEFORE `start`, when
    // this entry is an unbulleted sub-clause riding on a previous entry's group -- see
    // classifyJpDescriptor's outerContext doc) up to `start` itself.
    const enclosingCandidates = outerBullets.filter((b) => b <= start);
    const enclosing = enclosingCandidates.length ? Math.max(...enclosingCandidates) : start;
    const outerContext = body.slice(enclosing, start);
    const digit = m[1];
    const level = Number(JP_FULLWIDTH_DIGIT[digit] ?? digit) as UnifiedLevel;
    entries.push({ descriptor, level, outerContext });
    prevEnd = matchStart + m[0].length;
  }
  return entries;
}

/**
 * Normalize Japan (MOFA anzen.mofa.go.jp) per-country hazard page to unified 1-4 scale,
 * applying the whole-country / regional-cap doctrine (see the section doc comment above).
 * `html` is the full per-country detail page (same input as parseJpKikenLevel); `countryNameJa`
 * is that country's JP_NAME_TO_ISO3 key (advisories-tier1.ts), used to recognize
 * "<CountryName>全土" and let the country's own name sit between an exclusion clause and its
 * head noun (Belarus: "the area other than the Ukraine border strip, ALL OF BELARUS").
 *
 * Returns null (never guess) when there is no `#kikendetail` div at all is handled by the
 * CALLER exactly like parseJpKikenLevel's own "no div -> Level 1" case (this function only
 * runs once a div is already known to exist); returns null when a div exists but no region
 * text can be parsed from it AND the legend has no classes either (`legendMaxLevel` is
 * null) -- otherwise (no structured breakdown, e.g. Madagascar's real page: pure prose
 * about a political crisis, no "level N" statement anywhere) there is no regional-vs-whole
 * ambiguity to resolve in the first place, so it falls back to the legend's own MAX, exactly
 * like the pre-fix behaviour.
 */
export function normalizeJpRegionalLevel(
  html: string,
  countryNameJa: string,
  legendMaxLevel: UnifiedLevel | null,
): UnifiedLevel | null {
  const window = extractJpKikendetailWindow(html);
  if (window === null) return legendMaxLevel;

  const text = extractJpDetailText(window);
  if (text === null) return legendMaxLevel;

  const entries = parseJpLevelEntries(text);
  if (entries.length === 0) return legendMaxLevel;

  const wholeCandidates = entries.filter((e) => classifyJpDescriptor(e.descriptor, countryNameJa, e.outerContext));
  const regional = entries.filter((e) => !classifyJpDescriptor(e.descriptor, countryNameJa, e.outerContext));

  let wholeLevel: UnifiedLevel;
  let regionalMax: number;
  if (wholeCandidates.length > 0) {
    // Conservative: if more than one candidate somehow matches, take the highest.
    wholeLevel = Math.max(...wholeCandidates.map((e) => e.level)) as UnifiedLevel;
    regionalMax = regional.length ? Math.max(...regional.map((e) => e.level)) : 0;
  } else {
    // No explicit whole-country marker anywhere (Turkey/Mexico/Ecuador style: a list of
    // notable named provinces per level, with everywhere else -- including the capital,
    // never explicitly named -- implicitly at the LOWEST level actually published).
    // Deliberately the MIN across ALL entries, not a hardcoded 1: Lebanon's real page has
    // exactly two entries (Beirut-area named list = 3, everywhere-else named list = 4) that
    // jointly exhaust the entire country with NO level-1 area published anywhere --
    // assuming an unstated "level 1" there would invent a safety claim MOFA never made.
    // When some entry genuinely IS level 1 (Turkey, Mexico), the min already equals 1, so
    // this never regresses those cases; it only matters when the source never published a
    // level-1 entry for the country AT ALL.
    wholeLevel = Math.min(...entries.map((e) => e.level)) as UnifiedLevel;
    regionalMax = Math.max(...entries.map((e) => e.level));
  }

  return Math.max(wholeLevel, Math.min(2, regionalMax)) as UnifiedLevel;
}

/**
 * Named-region / border-zone / city markers that cap an MZV "neodporúča"
 * (does not recommend) clause at a SUB-national scope rather than the whole
 * country, mirroring ES_ZONE_MARKERS / IT_SUBNATIONAL_MARKERS above and the
 * DE/NL partial-warning-caps-at-2 doctrine (SOURCE-REPAIR-BRIEF rule 2).
 * Verified 2026-09-25 against the live MZV corpus: Niger's "severných
 * oblastí", Chad's "okrajových oblastí", Mauritania's "oblastí na východe",
 * Burundi's "provinciách Bubanza a Cibitoke", DR Congo's "mestách Goma a
 * Bukavu" and Eritrea's "25 km od hraníc..." are all real "neodporúča
 * cestovať" clauses scoped to a named area, never the whole country.
 */
const SK_REGIONAL_MARKERS =
  /\boblast\w*|\bprovinci\w*|\bregión\w*|\bmest\w*|\bhranic\w*|\bsever\w*|\bjuh\w*|\bvýchod\w*|\bzápad\w*|\bkm\s+od\b/i;
/** "žiadn[e/y/a]"/"aké(ho)koľvek" (no/any [travel] whatsoever) turns a whole-country "neodporúča"
 *  clause from Level 3 into Level 4 -- verified on Haiti ("absolútne neodporúča ... AKÉHOKOĽVEK
 *  dôvodu", genitive case) and South Sudan ("dôrazne sa neodporúča ŽIADNE cestovanie"), both
 *  country-wide, both using this "no exceptions" qualifier the merely-cautionary Myanmar/Cuba(ES)
 *  cases below never do. "\w*koľvek\b" (not a literal "akékoľvek") is deliberate: Haiti's page
 *  declines it to "akéhokoľvek", a different ending an exact-string match would have missed --
 *  same diacritic-declension trap as the \S{0,4} stems elsewhere in this file, generalized here to
 *  the whole "aký/aká/aké + koľvek" ("what-/who-/whichever") family via its invariant suffix.
 *  No leading \b on "žiadn" either: JS's ASCII-only \w treats the leading "ž" itself as a
 *  NON-word character, so \b (a word/non-word transition) never fires between a preceding space
 *  and "ž" -- found by a failing test against the real South Sudan excerpt, not by inspection. */
const SK_WHOLE_COUNTRY_ALL_TRAVEL = /žiadn\w*|\w*koľvek\b/i;
/** Thailand's "neodporúča cestovať do Thajska BEZ CESTOVNÉHO POISTENIA" is an insurance reminder,
 *  not a security warning -- ported forward from the old Priority-4 doc comment's reasoning (see
 *  git history) into this repair's new whole-country "neodporúča" scan, which would otherwise
 *  wrongly treat it as a real avoid-travel clause. */
const SK_INSURANCE_GUARD = /poisten\w*/i;

/** Affirmative "this is calm" statements MZV actually uses (2026-09-25 repair -- see the doc
 *  comment on normalizeSkSecurityText for why Priority 5 now REQUIRES one of these instead of
 *  defaulting to 1 on anything unmatched). Each is tied to a real live-page excerpt:
 *   - Japan: "veľmi bezpečnú krajinu" (a very safe country). \S{0,3}, not \w{0,3}: the case ending
 *     on "bezpečnú" is the diacritic "ú" alone, which ASCII-only \w does not cross (same trap the
 *     Priority 2/4 comment above already documents for "zvýšenú"/"opustiť" -- caught here by a
 *     failing test against the real Japan excerpt, not just reasoning by analogy).
 *   - Kuwait/Qatar: "vysokou/najvyššou úrovňou bezpečnosti" (high / the world's highest security).
 *   - Belarus: "je vo všeobecnosti stabilná" -- \b before "stabiln" is load-bearing: Slovak writes
 *     "not stable" as ONE word, "nestabilná", with no internal word boundary for \b to stop at, so
 *     unlike a bare substring test this correctly still REJECTS Burkina Faso/South Sudan/Haiti/DR
 *     Congo's "(zostáva/je) nestabilná" (verified: all four test `false` against this pattern).
 *   - Belarus (2nd clause): "nepredstavuje výrazné bezpečnostné riziko" (does not represent a
 *     significant security risk).
 *   - Cuba: "nie sú známe žiadne závažnejšie bezpečnostné riziká" (no known more-serious risks).
 *   - Italy: "najčastejšie vyskytuje drobná kriminalita" -- requires the abstract noun
 *     "kriminalita" (crime AS A CATEGORY), not the concrete "krádeže" (thefts): Ethiopia's "Drobné
 *     krádeže ... SÚ NA VZOSTUPE" (petty thefts ... ARE ON THE RISE) uses the same adjective for a
 *     WORSENING trend, and must NOT be read as the same all-clear signal.
 */
const SK_CALM_PATTERNS = [
  /veľmi bezpečn\S{0,3}\s+krajin/i,
  /(vysok|najvyšš)\w{0,4}\s+úrovň\w{0,3}\s+bezpečnosti/i,
  /\bstabiln\S{0,3}\b/i,
  /nepredstavuje\s+(\S+\s+){0,4}bezpečnostné riziko/i,
  /nie sú\s+(\S+\s+){0,4}bezpečnostné riziká/i,
  /\bdrobná?\s+kriminalita\b/i,
];

/**
 * Scan for a whole-country MZV "neodporúča ... cestov(ať/anie) do/na <destination>" (does not
 * recommend travel(ling) TO) clause -- added 2026-09-25 (SOURCE-REPAIR-BRIEF), see the
 * classification-priority list on normalizeSkSecurityText below. Sentence-scoped (not a single
 * whole-text regex) because word order varies with the construction MZV uses for a given country
 * -- verb-first ("neodporúča cestovať do Mjanmarska"), topicalized ("Cestovanie na Haiti sa
 * absolútne neodporúča") -- and the co-occurrence of "neodporúča" and a "cestov ... do/na" clause
 * ANYWHERE in the same sentence catches both without needing to enumerate every word order.
 * Requiring the "do"/"na" destination preposition (not bare "cestov") is load-bearing: Nigeria's
 * page reads "Kvôli možnosti ozbrojených prepadov ... NEODPORÚČAME CESTOVAŤ miestnou verejnou
 * DOPRAVOU" (we do not recommend travelling BY local public transport) -- a transport-MODE
 * caveat, not a "don't go to this destination" clause, and a bare "cestov\w*" presence check
 * would have wrongly promoted it. "cestov\S*", not "cestov\w*", for the same reason as the
 * calm-pattern comment above: ASCII-only \w cannot cross "cestovAŤ"'s own accented ending, so
 * \w* alone stops at "cestova" and the required "\s+" never finds it (Myanmar's exact sentence,
 * "neodporúča cestovať do Mjanmarska", silently failed to match until this was \S). A sentence
 * naming a region/border/city (SK_REGIONAL_MARKERS) or the insurance clause (SK_INSURANCE_GUARD)
 * is skipped, never promoted.
 */
function scanSkWholeCountryAvoidTravel(text: string): UnifiedLevel | null {
  let sawLevel3 = false;
  let sawLevel4 = false;
  for (const sentence of splitIntoSentences(text)) {
    if (!/neodporúča/i.test(sentence) || !/cestov\S*\s+(do|na)\b/i.test(sentence)) continue;
    if (SK_REGIONAL_MARKERS.test(sentence) || SK_INSURANCE_GUARD.test(sentence)) continue;
    if (SK_WHOLE_COUNTRY_ALL_TRAVEL.test(sentence)) sawLevel4 = true;
    else sawLevel3 = true;
  }
  if (sawLevel4) return 4;
  if (sawLevel3) return 3;
  return null;
}

/**
 * Normalize Slovakia (MZV) "Bezpecnostna situacia" per-country free text to
 * unified 1-4 scale. Repair 2026-09-25 (SOURCE-REPAIR-BRIEF): replaces the
 * old normalizeSkLevel, which matched literal ASCII "stupen" and so never
 * actually matched the real field value — MZV always spells the word with
 * the palatalized "stupeň" (U+0148 ň), a different code point that JS's
 * case-insensitive regex does not fold onto plain "n". It also always
 * defaulted unmatched/empty text to Level 1, which is exactly the silent
 * "no contraindications" failure mode this repair exists to remove.
 *
 * Returns null (never guess) when the field is empty: MZV's per-country
 * dataset (CKAN package staty-sveta-podmienky-cestovania-a-pobytu) leaves it
 * blank for some countries it hasn't written a security assessment for yet
 * (observed for North Korea, Mali, Somalia on 2026-09-25) rather than ever
 * publishing "no risk" — collapsing that gap to Level 1 would fabricate a
 * safety statement the source never made.
 *
 * Classification priority (highest first), calibrated 2026-09-25 against the
 * live MZV corpus, both the original 18-country sample (AFG/SYR/UKR/EGY/
 * LBN/ISR elevated, MEX/TUR/KEN/FRA caution, ITA/USA/JPN/THA/NIC baseline)
 * AND a second-pass repair sample flagged because Level 1 was the ONLY
 * outcome this function ever produced for them despite other governments'
 * median rating them 3+ (BFA, NER, SSD, HTI, MMR, PSE, COD, TCD, NGA, ETH,
 * ERI, BDI, BLR, CUB, JOR, KWT, MRT, QAT, SAU):
 *  1. An explicit "<digit>. stupeň" — MZV's own official degree label,
 *     always present when a formal advisory is active (verified: AFG="4.
 *     stupeň" -> opustiť krajinu; EGY="3. stupeň" -> necestovať do určitých
 *     oblastí). When the text narrates a CHANGE ("Zmena odporúčania 4.
 *     stupeň ... sa mení na 3. stupeň", Lebanon, dated 2026-02-26) both the
 *     old and new digit appear; Slovak always narrates old-then-new, so the
 *     LAST digit in the text is the currently-applicable one.
 *  2. A country-wide "leave the country/territory" instruction with no
 *     digit stated ("krajinu opustiť"/"opustiť krajinu", "územie
 *     opustiť"/"opustiť územie") -> Level 4 (verified: Ukraine, Israel).
 *     Deliberately narrow to the "krajin(u)"/"územ(ie)" object: it must NOT
 *     fire on incident-response advice aimed at a different noun (France:
 *     "opustite miesto ohrozenia" = leave the scene of danger; Israel's own
 *     rocket-alert instructions later in the SAME page: "opustite vozidlo"
 *     = leave the vehicle).
 *  3. A whole-country "neodporúča ... cestov(ať/anie)" (does not recommend
 *     travel(ling)) clause, scanned sentence-by-sentence and never counted
 *     when the same sentence names a region/border/city or is the insurance
 *     clause (scanSkWholeCountryAvoidTravel) -> Level 4 when it also says
 *     "žiadne"/"akékoľvek" (no/any travel whatsoever -- Haiti, South Sudan),
 *     else Level 3 (Myanmar's plain "neodporúča cestovať do Mjanmarska").
 *     This is the fix for the second-pass sample above: MMR, HTI, SSD were
 *     landing on Level 1 purely because this clause used to be deliberately
 *     ignored (see git history) to dodge the Thailand insurance false
 *     positive -- SK_INSURANCE_GUARD now dodges that same false positive
 *     without ignoring the whole clause family.
 *  4. A direct "increased caution" recommendation, no digit stated:
 *     "zvýšenú/zvýšená opatrnosť" (Mexico, Turkey, Kenya) or MZV's other
 *     fixed "Level 2" phrase, "zvážiť nevyhnutnosť cestovania" (consider the
 *     necessity of travel -- Niger, Chad, Ethiopia, Jordan all use it,
 *     verbatim, as the residual/whole-country clause below their own
 *     region-scoped Level-3-shaped warnings) -> Level 2.
 *  5. Level 1 ONLY when the text affirmatively describes a calm situation
 *     (SK_CALM_PATTERNS -- Japan, Kuwait, Qatar, Belarus, Cuba, Italy all
 *     verified live 2026-09-25). Otherwise return null: the second-pass
 *     sample proved "nothing matched" does NOT mean "nothing to report" for
 *     this source (Burkina Faso's own page opens "situácia ... je dlhodobo
 *     vážna a nestabilná" -- long-term serious and unstable -- and used to
 *     land on Level 1 for want of a matching pattern). Per project rule, an
 *     unrecognized notice must emit nothing, never guess 1.
 */
export function normalizeSkSecurityText(rawHtml: string | null | undefined): UnifiedLevel | null {
  if (!rawHtml || !rawHtml.trim()) return null;

  // Strip tags before matching: MZV wraps individual words in <a>/<strong>
  // spans often enough (e.g. the degree link itself, emphasis) that a
  // token-adjacency regex run against raw HTML can miss a real match.
  const text = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Priority 1: explicit official degree. \w is ASCII-only in JS regex, so
  // it can't span the "ň" diacritic itself — matching the "stupe" prefix
  // plus an explicit [nň] identifies the word without relying on \w to
  // cross it (and without the old literal-"stupen" bug above).
  const stupenMatches = [...text.matchAll(/(\d)\.\s*stupe[nň]/gi)];
  if (stupenMatches.length > 0) {
    const last = stupenMatches[stupenMatches.length - 1];
    const digit = parseInt(last[1], 10);
    return Math.min(4, Math.max(1, digit)) as UnifiedLevel;
  }

  // Priority 2/4 below use \S{0,4} (up to 4 trailing NON-space characters),
  // not \w*: Slovak case endings on these stems are themselves diacritics
  // ("zvýšenú", "opustiť", "územie"/"územia") sitting directly before the
  // required \s+ word boundary, and ASCII-only \w matches zero of them —
  // \w* would stop one character short of the boundary and the whole
  // alternative would silently never match (caught by the France/Mexico/
  // Kenya/Ukraine cases in advisory-levels-sk.test.ts). \S is whitespace-
  // agnostic, not ASCII-restricted, so it crosses diacritics fine; capping
  // it at 4 keeps the match bounded to one inflected word, not a run-on.

  // Priority 2: whole-country evacuation language, no digit stated.
  if (
    /(krajin\S{0,4}\s+opusti\S{0,4}|opusti\S{0,4}\s+krajin\S{0,4}|územ\S{0,4}\s+opusti\S{0,4}|opusti\S{0,4}\s+územ\S{0,4})/i.test(
      text,
    )
  ) {
    return 4;
  }

  // Priority 3: whole-country "neodporúča ... cestov(ať/anie)", region/border/city-scoped and
  // insurance-clause sentences excluded (see scanSkWholeCountryAvoidTravel doc comment).
  const wholeCountryAvoid = scanSkWholeCountryAvoidTravel(text);
  if (wholeCountryAvoid !== null) return wholeCountryAvoid;

  // Priority 4: "increased caution" / "consider necessity of travel" recommendation, no digit
  // stated -- MZV's own two ways of phrasing its Level-2 tier.
  if (
    /zvýšen\S{0,4}\s+opatrnos\S{0,4}/i.test(text) ||
    /zvá[žz]i\S{0,4}\s+nevyhnutnos\S{0,4}\s+cestovani\S{0,4}/i.test(text)
  ) {
    return 2;
  }

  // Priority 5: Level 1 only on an affirmative calm statement -- never a bare fallback (repair
  // 2026-09-25, see the doc comment above for why "nothing matched" used to silently become 1).
  if (SK_CALM_PATTERNS.some((re) => re.test(text))) return 1;
  return null;
}

/**
 * Generic mapper: normalize any N-level system to unified 1-4 scale.
 * Maps a value from [sourceMin, sourceMax] to [1, 4].
 * Supports future 3-level, 5-level, 6-level systems.
 */
export function normalizeToUnified(
  value: number,
  sourceMin: number,
  sourceMax: number,
): UnifiedLevel {
  if (sourceMax === sourceMin) return 1;
  const normalized = (value - sourceMin) / (sourceMax - sourceMin);
  const level = Math.round(normalized * 3) + 1;
  return Math.min(4, Math.max(1, level)) as UnifiedLevel;
}

/**
 * Extract France's (diplomatie.gouv.fr) whole-country advisory level from the free-text
 * "Zones de vigilance" section of a per-country "Conseils aux voyageurs - Securite" page.
 *
 * Unlike the other normalize* functions in this file, France's page is not a single
 * classified field (colour/level/flags) that a caller has already isolated -- it is prose
 * that names one or more "zones", which may be the whole country ("l'ensemble du
 * territoire...") or a specific province / border strip ("la province du Baloutchistan...",
 * "les zones frontalieres avec la Colombie..."). Matching a level keyword anywhere on the
 * page would wrongly promote countries with a small red border zone (verified on Turkey,
 * Pakistan, Venezuela, Lebanon fiches, 2026-09-25) to "do not travel" for the entire
 * country. This mirrors why normalizeDeLevel() below caps Germany's Teilreisewarnung
 * (partial/regional warning) at 2 instead of promoting it to the full warning level.
 *
 * Cascade, most confident first (verified against AFG, DEU, GBR, CHE, UKR, HTI, MLI, RUS,
 * BLR, TUR, PAK, VEN, LBN, USA, JPN fiches, 2026-09-25):
 *   1. A whole-country subject phrase ("l'ensemble/la totalite/l'integralite du
 *      territoire/pays", "le reste du territoire", "le territoire <adjectif> est ...") -> the
 *      level of the section it falls in (see levelNearWholeCountryMatch below).
 *   2. No whole-country phrase, but the page names at least one elevated zone (red/orange)
 *      -> level 2 (increased caution only, never higher -- the province/border-strip cap).
 *   3. Section present, no elevated keyword anywhere -> level 1. France's own published
 *      colour legend (see diplomatie.gouv.fr "Que signifient les couleurs des cartes...")
 *      treats unflagged territory as green/"vigilance normale" by default, so this is
 *      reading the source's own stated default, not guessing on a parse failure.
 *   4. The "Zones de vigilance" marker is missing entirely (different template, fetch
 *      problem, or a fiche this source doesn't publish) -> null, emit nothing for it.
 *
 * Repaired 2026-09-26 (regional-promotion audit): step 1 used to search a fixed +-120
 * CHARACTER window around the whole-country phrase for a level keyword, which bled across
 * sentence AND section boundaries -- two confirmed bugs on the live 2026-09-26 site:
 *  - Kazakhstan: "...un taux de radioactivite particulierement eleve. Il est FORMELLEMENT
 *    DECONSEILLE de s'y rendre. Zones de vigilance renforcee LE RESTE DU PAYS est place en
 *    zone de vigilance renforcee." -- the window around "le reste du pays" reached BACKWARD
 *    across the sentence period into the PRECEDING, unrelated zone's "formellement
 *    deconseille", read as if it qualified the whole country. Fixed by levelNearWholeCountryMatch
 *    tracking which named SECTION (red/orange/yellow -- see sectionKeywordBoundaries) a match
 *    falls in, rather than a raw character radius: a keyword belonging to an already-closed
 *    section can no longer leak in.
 *  - Kenya: "...Zones en vigilance renforcee (jaune) A L'EXCEPTION DES ZONES FORMELLEMENT
 *    DECONSEILLEES ET DECONSEILLEES SAUF RAISON IMPERATIVE, LE RESTE DU TERRITOIRE KENYAN est
 *    place en vigilance renforcee." -- section-tracking alone is not enough here: the
 *    exception clause's OWN "formellement deconseillees" sits, textually, inside the SAME
 *    "vigilance renforcee" section as "le reste du territoire", so it would still register as
 *    the closest boundary. Fixed by excludeExceptionClauses, which drops any keyword
 *    occurrence inside an "a l'exception de(s) ...," clause before boundaries are built --
 *    that clause describes what's EXCLUDED from "le reste", not what "le reste" itself is.
 *  - Georgia: "Les deplacements sont formellement deconseilles en Abkhazie... il est
 *    toutefois formellement deconseille de se rendre dans L'ENSEMBLE DU TERRITOIRE DE LA
 *    RUSSIE." -- a real whole-country phrase, correctly inside the red section, but naming
 *    RUSSIA (mentioned only for shared-border context), not Georgia. Section-tracking alone
 *    reads this as Georgia's own level 4. Fixed by namesAnotherCountry, which rejects a
 *    whole-country match immediately followed by "de la/du/des <name>" identifying a
 *    DIFFERENT country in our own config -- the scan then continues to Georgia's OWN, later
 *    "l'ensemble du pays, dont la capitale Tbilissi..." match, correctly level 2 (inside the
 *    yellow section).
 */
function foldFrName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019'`]/g, '');
}

/**
 * Does the text immediately following a whole-country match ("...du territoire/pays<tail>")
 * explicitly name a DIFFERENT country than `ownNameFolded` (the Georgia/Russia case above)?
 * Only rejects on a POSITIVE match against another country's own French name in our config --
 * an unnamed or generic continuation (", dont la capitale Tbilissi", " est calme") is accepted,
 * the same fail-open posture as every other guard in this file.
 */
function namesAnotherCountry(tail: string, ownNameFolded: string): boolean {
  const m = /^[,\s]*(?:de la |du |des |de l[\s]?)\s*([a-z][a-z-]{3,})/.exec(tail);
  if (!m) return false;
  const named = m[1];
  if (ownNameFolded.startsWith(named) || named.startsWith(ownNameFolded)) return false; // names itself
  return COUNTRIES.some((c) => {
    const folded = foldFrName(c.name.fr);
    return folded !== ownNameFolded && folded.length > 3 && (folded.startsWith(named) || named.startsWith(folded));
  });
}

/**
 * Every occurrence of a level keyword in `section`, EXCLUDING ones that fall inside an "a
 * l'exception de(s) ...," clause (the Kenya bug -- that clause names what's carved OUT of the
 * "reste"/"ensemble" statement it precedes, not a level for that statement itself). Sorted by
 * position: this is the ordered set levelNearWholeCountryMatch scans to find the level
 * "active" at a given position (the LAST heading/keyword before it), exactly like a
 * table-of-contents built from a document's own section headings.
 */
function sectionKeywordBoundaries(section: string): { index: number; level: UnifiedLevel }[] {
  const exceptionSpans: [number, number][] = [];
  // "a lexception d" + up to 3 more lowercase letters covers "de"/"des"/"du"; a following
  // "la"/"l" (as in "de la Colombie") just becomes part of the [^,]{0,200} sweep up to the
  // clause's own closing comma, so it does not need its own branch.
  for (const m of section.matchAll(/a lexception d[a-z]{0,3}\s+[^,]{0,200},/g)) {
    exceptionSpans.push([m.index, m.index + m[0].length]);
  }
  const insideException = (pos: number) => exceptionSpans.some(([start, end]) => pos >= start && pos < end);

  const KEYWORD_RES: [RegExp, UnifiedLevel][] = [
    [/formellement deconseill|classe[e]? en zone rouge/g, 4],
    [/deconseille[a-z]{0,2} sauf raison imperative/g, 3],
    [/vigilance renforcee/g, 2],
    [/vigilance normale/g, 1],
  ];
  const boundaries: { index: number; level: UnifiedLevel }[] = [];
  for (const [re, level] of KEYWORD_RES) {
    for (const m of section.matchAll(re)) {
      if (!insideException(m.index)) boundaries.push({ index: m.index, level });
    }
  }
  boundaries.sort((a, b) => a.index - b.index);
  return boundaries;
}

/** Colour/classification vocabulary France's own template uses when a whole-country sentence's
 *  OWN level trails in a LATER sentence rather than its own (see tier 3 below) -- gates that
 *  tier so it only ever completes a genuine, already-in-progress classification statement,
 *  never "borrows" an unrelated later paragraph's level for an unrelated remark. */
const FR_CLASSIFICATION_WORDS = /\b(rouge|orange|jaune|vert[e]?|classe[e]?|place[e]?)\b/;

function levelNearWholeCountryMatch(
  boundaries: { index: number; level: UnifiedLevel }[],
  matchEnd: number,
  sentenceEnd: number,
  ownSentence: string,
): UnifiedLevel | null {
  // Tier 1: the match's OWN sentence, searched forward from the match itself -- the most
  // direct evidence available ("... est en vigilance renforcee", trailing right after the
  // whole-country phrase in the very same clause). Deliberately forward-only, never backward
  // within the sentence: an "a l'exception de(s) <zones>, le reste du territoire est ..."
  // sentence (Kenya) has ITS OWN excepted zones' keywords sitting BEFORE the match, and those
  // must never be read as this clause's level (sectionKeywordBoundaries already drops them for
  // tier 2 too, but tier 1 avoids them structurally, just by only looking ahead).
  const sameSentence = boundaries.find((b) => b.index >= matchEnd && b.index <= sentenceEnd);
  if (sameSentence) return sameSentence.level;

  // Tier 2: backward, UNBOUNDED -- the last section heading (or earlier inline use of the same
  // wording) at or before this match, however far back (Georgia's case: the match's own
  // sentence has no keyword at all -- "ne posent pas de problemes" -- so its level comes from
  // the "Zone en vigilance renforcee" heading several sentences earlier).
  let backward: UnifiedLevel | null = null;
  for (const b of boundaries) {
    if (b.index < matchEnd) backward = b.level;
    else break;
  }
  if (backward !== null) return backward;

  // Tier 3: forward, UNBOUNDED, and ONLY when this match's own sentence already uses
  // colour/classification vocabulary (FR_CLASSIFICATION_WORDS) -- reached when NEITHER of the
  // above found anything, i.e. this match is before any section heading has appeared at all.
  // Iran: "L'ENSEMBLE DU TERRITOIRE IRANIEN est PLACE EN ROUGE sur la carte..." is the very
  // first sentence of the page (contains "place"/"rouge", passing the gate) and the
  // recognizable "formellement deconseille" keyword only appears in the NEXT sentence.
  // Without the gate, this tier wrongly resolved DR Congo's "les voyages touristiques sont
  // deconseilles sur l'ensemble du territoire" (a general tourism caution using none of
  // France's four colour keywords, also the page's first sentence) to a much-later, unrelated
  // paragraph's "formellement deconseille" (about specific eastern provinces) -- that sentence
  // has no colour word, so the gate now leaves it unresolved instead, and the scan correctly
  // continues to DR Congo's OWN explicit, later "le reste du pays est place en zone
  // deconseillee sauf raison imperative" statement (level 3).
  if (!FR_CLASSIFICATION_WORDS.test(ownSentence)) return null;
  const forward = boundaries.find((b) => b.index > sentenceEnd);
  return forward ? forward.level : null;
}

/**
 * Does `sentence` (the WHOLE sentence enclosing a whole-country phrase match, not just the
 * text after it) contain a copula (est/sont/pose/posent)? Distinguishes a genuine
 * level-assertion from the SAME "l'ensemble/le reste du territoire" wording used as a location
 * modifier for something else entirely -- all confirmed live 2026-09-26. Two different
 * genuine-assertion shapes both need the WHOLE sentence, not just the tail after the match,
 * because the copula sits on different sides of the phrase in each:
 *  - Subject-first ("le reste du territoire EST en vigilance renforcee" -- Kazakhstan, Kenya):
 *    copula trails the phrase.
 *  - Object-embedded ("il EST formellement deconseille de se rendre dans l'ensemble du
 *    territoire de la Russie" -- Russia, Sudan): the whole-country phrase is the OBJECT of "se
 *    rendre dans", and the copula belongs to the clause's own main verb, BEFORE the phrase.
 * Both false-positive cases have no copula anywhere in their sentence, before or after:
 *  - Lebanon: "les camps palestiniens et leurs abords, sur l'ensemble du territoire." -- these
 *    are Palestinian refugee camps, red-listed wherever in the country they sit, not a "whole
 *    country is red" claim. Without this guard, the RED section heading many sentences earlier
 *    (the nearest backward boundary) wrongly attaches to it.
 *  - Venezuela: "reste du territoire venezuelien DES RECOMMANDATIONS SIMILAIRES ...
 *    S'APPLIQUENT dans toutes les grandes villes venezueliennes." -- reads like a heading label
 *    ("Rest of Venezuelan territory:") followed by unrelated advice; "s'appliquent" is not
 *    est/sont/pose/posent.
 */
function hasLevelAssertionVerb(sentence: string): boolean {
  return /\b(est|sont|pose|posent)\b/.test(sentence);
}

/** Start/end offsets (within `text`) of the "sentence" containing `pos`, where a "sentence"
 *  ends at [.!?] followed by whitespace/end-of-string -- same boundary rule as splitIntoSentences,
 *  computed with offsets here because a heading with no trailing period (France's own template)
 *  merges with the paragraph that follows it, which is exactly the span levelNearWholeCountryMatch's
 *  forward fallback needs (Germany/Switzerland/UK's one-line pages have no heading at all, just
 *  one sentence combining the country-phrase and the keyword). */
function sentenceBoundsAt(text: string, pos: number): [number, number] {
  const enders = [...text.matchAll(/[.!?](?=\s|$)/g)].map((m) => m.index + 1);
  let start = 0;
  for (const idx of enders) {
    if (idx <= pos) start = idx;
    else return [start, idx];
  }
  return [start, text.length];
}

export function extractFrTerritoryLevel(rawText: string, countryNameFr: string): UnifiedLevel | null {
  const text = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: deconseille, imperative, renforcee...
    .replace(/[\u2018\u2019'`]/g, '') // strip apostrophes (curly + straight): l'ensemble -> lensemble
    .replace(/\s+/g, ' ');

  const sectionStart = text.indexOf('zones de vigilance derniere actualisation le');
  if (sectionStart === -1) return null;

  const riskHeadingIdx = text.indexOf('risques encourus', sectionStart);
  const sectionEnd = riskHeadingIdx > sectionStart ? riskHeadingIdx : Math.min(text.length, sectionStart + 6000);
  const section = text.slice(sectionStart, sectionEnd);
  const ownNameFolded = foldFrName(countryNameFr);
  const boundaries = sectionKeywordBoundaries(section);

  // Deliberately specific so a named province/city can never satisfy this on its own. The
  // adjective-qualified alternative ("le territoire ADJ est") structurally already names a
  // territory via its own demonym adjective, so -- unlike the other two -- it is not run
  // through namesAnotherCountry below (that guard's "de la/du <name>" shape does not apply to
  // it, and no live bug has ever been found through this alternative).
  const wholeCountryRe = /(?<ensemble>(?:la totalite|lintegralite|lensemble) du (?:territoire|pays))|(?<reste>reste du (?:territoire|pays))|(?<adj>le territoire [a-z-]+ est)/g;

  let subjectMatch: RegExpExecArray | null;
  while ((subjectMatch = wholeCountryRe.exec(section)) !== null) {
    const matchEnd = subjectMatch.index + subjectMatch[0].length;
    const [sentenceStart, sentenceEnd] = sentenceBoundsAt(section, subjectMatch.index);

    if (!subjectMatch.groups?.adj) {
      // The adjective-qualified alternative ("le territoire ADJ est") already bakes its own
      // demonym adjective and copula into the match itself, so neither guard below applies to
      // it -- both are specific to the bare "l'ensemble/le reste du territoire/pays" wording.
      const tail = section.slice(matchEnd, matchEnd + 50);
      if (namesAnotherCountry(tail, ownNameFolded)) continue; // e.g. Georgia's Russia aside
      // Whole sentence, not just after the match: "Il EST formellement deconseille de se
      // rendre dans l'ensemble du territoire..." (Russia, Sudan) puts the copula BEFORE the
      // whole-country phrase (it's the OBJECT of "se rendre dans"), while "le reste du
      // territoire EST en vigilance renforcee" (Kazakhstan, Kenya...) puts it after (the
      // phrase IS the subject) -- hasLevelAssertionVerb must catch both constructions.
      if (!hasLevelAssertionVerb(section.slice(sentenceStart, sentenceEnd))) continue; // e.g. Lebanon's camps, Venezuela's heading-label
    }

    const level = levelNearWholeCountryMatch(boundaries, matchEnd, sentenceEnd, section.slice(sentenceStart, sentenceEnd));
    if (level !== null) return level;
    // No keyword resolvable for THIS match at all (same-sentence, backward AND forward) --
    // keep scanning for another whole-country match rather than giving up immediately.
  }

  // No usable whole-country statement: a named zone is still flagged somewhere in the section,
  // so this is a real (sub-national) warning -- cap it at "increased caution".
  if (/formellement deconseill|deconseille[a-z]{0,2} sauf raison imperative|vigilance renforcee/.test(section)) {
    return 2;
  }

  // Section is present and genuinely silent on any elevated risk -> normal precautions.
  return 1;
}

/**
 * Normalize Hong Kong OTA alert levels to unified 1-4 scale.
 * HK uses 3 levels: Amber (signs of threat), Red (significant), Black (severe).
 * Callers must only invoke this for a country actually carrying one of those
 * classes — the OTA's own JSON lists plenty of countries with no alert at
 * all, so "not in the red/amber/black buckets" is NOT evidence of "normal
 * precautions" and must not be mapped here (audit 2026-09-25: the fetcher
 * used to default unclassified countries to 1, asserting "no alert" for
 * Afghanistan, Iraq, Sudan, Ukraine...).
 *
 * Repaired 2026-09-26: returns null instead of falling back to 1 for an
 * unrecognised level string too (repair brief rule 1 — never guess level 1).
 * HK has only ever used these three; a fourth would mean the source changed
 * shape and the fetcher should skip it and log, not silently invent a level.
 */
export function normalizeHkAlert(alert: string): UnifiedLevel | null {
  const lower = alert.toLowerCase();
  if (lower.includes('black')) return 4;
  if (lower.includes('red')) return 3;
  if (lower.includes('amber') || lower.includes('yellow')) return 2;
  return null;
}

/**
 * Normalize Ireland DFA security ratings to unified 1-4 scale.
 * Ireland uses 4 levels matching the standard advisory pattern.
 */
export function normalizeIeRating(rating: string): UnifiedLevel {
  const lower = rating.toLowerCase();
  if (lower.includes('do not travel')) return 4;
  if (lower.includes('avoid') && (lower.includes('non-essential') || lower.includes('unnecessary'))) return 3;
  // Word-boundary match: a plain .includes('caution') also fires on "normal preCAUTIONs",
  // silently promoting every level-1 country to level 2 (found 2026-09-25 wiring this
  // function up to real Ireland DFA fiche text for the first time -- it was unreachable
  // dead code before since the fetcher never successfully extracted per-country text).
  if (/\bcaution\b/.test(lower) || lower.includes('high degree')) return 2;
  return 1; // normal precautions
}

/**
 * Normalize Finland (um.fi) advisory text to unified 1-4 scale.
 * Finnish text-based levels. Also matches English equivalents.
 */
export function normalizeFiLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  // Finnish: Valta kaikkea matkustamista = Avoid all travel
  if (lower.includes('kaikkea matkustamista') || lower.includes('avoid all travel') || lower.includes('do not travel')) return 4;
  // Finnish: Valta tarpeetonta matkustamista = Avoid unnecessary travel
  if (lower.includes('tarpeetonta matkustamista') || lower.includes('avoid') || lower.includes('non-essential')) return 3;
  // Finnish: Noudata erityista varovaisuutta = Exercise special caution
  if (lower.includes('erityist') || lower.includes('special caution') || lower.includes('increased caution')) return 2;
  // Finnish: Noudata tavanomaista varovaisuutta = Exercise normal caution
  return 1;
}

/**
 * Extract BMEIA's own explicit "rest of the country" level from a country's
 * detail page HTML (only meaningful when `securityPartial=1`, see
 * normalizeAtLevel). BMEIA always states this as "Sicherheitsstufe N ..."
 * FOLLOWED, within the same clause, by one of three fixed idioms for "what's
 * left over" -- verified live 2026-09-26 across 17 countries:
 *   - "(im/für den) Rest des Landes" (Turkey, Thailand, Egypt, India,
 *     Cambodia, Mexico, Brazil, Georgia, Armenia, Kosovo, Pakistan, Burkina
 *     Faso, Nigeria)
 *   - "restlichen Landesteile(n)" / "restlichen Regionen" (Israel: "Hohes
 *     Sicherheitsrisiko (Sicherheitsstufe 3) für die restlichen Landesteile
 *     Israels"; Russia: "...(Sicherheitsstufe 3) gilt in den restlichen
 *     Regionen"; Venezuela: "...(Sicherheitsstufe 3) in den restlichen
 *     Landesteilen")
 *   - "übrigen Landesteile(n)" (Ethiopia: "Sicherheitsrisiko (Sicherheitsstufe
 *     2) in Addis Abeba und in den übrigen Landesteilen")
 * Returns null when none of these appear -- e.g. Chad and Palestine, whose
 * pages name a capital/border-region split (or, for Palestine, a Gaza/West-
 * Bank split covering the whole area BMEIA tracks) with no separate residual
 * statement at all: normalizeAtLevel's cap-at-2 fallback applies there, never
 * a guessed number.
 */
export function extractAtRestOfCountryLevel(html: string): UnifiedLevel | null {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
  const m = /Sicherheitsstufe\s*(\d)[^.!]{0,60}?(?:Rest des Landes|restlichen?\s+(?:Landesteil\w*|Regionen?)|übrigen?\s+Landesteil\w*)/i.exec(
    text,
  );
  if (!m) return null;
  return Math.min(4, Math.max(1, parseInt(m[1], 10))) as UnifiedLevel;
}

/**
 * Normalize Austria (BMEIA) advisory data to unified 1-4 scale.
 *
 * BMEIA's own per-country JSON object (`bmeiaCountrySecurityInfos`, see
 * fetchAtAdvisories in advisories-tier2a.ts) carries two fields: `security`
 * (1-4, the WORST level found anywhere on that country's page) and
 * `securityPartial` (0/1). Repair 2026-09-26 (PARSER-REGIONAL-BRIEF): the OLD
 * code took `Math.max(security, securityPartial)` -- but `securityPartial`
 * is not a competing level at all, it is a BOOLEAN flag meaning "the
 * `security` value above is a REGIONAL peak, not the whole-country level".
 * BMEIA's own sidebar badge literally reads "Sicherheitsstufe N (regional)"
 * whenever it is set.
 *
 * A first version of this fix capped every `securityPartial=1` country at 2
 * outright. Verified live 2026-09-26 against the FULL set of 48
 * `securityPartial=1` countries (not just the 10 originally flagged in
 * PARSER-REGIONAL-BRIEF) that this UNDER-reports several real conflict
 * countries whose own page states a "rest of the country" baseline of 3, not
 * 2: Pakistan ("Hohes Sicherheitsrisiko Sicherheitsstufe 3 (von 4) gilt im
 * Rest des Landes" -- the regional level 4 is only "entlang der ...Line of
 * Control"), Burkina Faso, Israel, Russia, Nigeria and Venezuela all read the
 * same way. A blanket cap would have silently turned these into "increased
 * caution" countries, exactly the "war zone shown as safe" failure mode
 * SOURCE-REPAIR-BRIEF warns against. Fix: read BMEIA's own explicit
 * statement via extractAtRestOfCountryLevel (the detail page fetch the AT
 * sub-fetcher does for every `securityPartial=1` country) and use it
 * directly; only fall back to the cap when no such statement is found
 * (Chad, Palestine -- never guessed higher than 2 without one).
 */
export function normalizeAtLevel(
  entry: { security: number; securityPartial: number },
  restOfCountryLevel?: UnifiedLevel | null,
): UnifiedLevel {
  const rawLevel = Math.min(4, Math.max(1, entry.security)) as UnifiedLevel;
  if (!entry.securityPartial) return rawLevel;
  if (restOfCountryLevel != null) return restOfCountryLevel;
  return Math.min(2, rawLevel) as UnifiedLevel;
}

// --- Tier 2b normalization functions ---

// Countries whose own French (or English) name is a strong signal that a sentence is
// actually a cross-reference to a *different* country's advisory (e.g. a Belgian Thailand
// page warning that "Tout voyage au Myanmar est fortement déconseillé" as border context) —
// used only as a veto against normalizeBeLevel's generic "le pays" fallback, see below.
// Folded (accent-stripped, lowercased) once at module load; >=5 chars to dodge short-name
// substring collisions (e.g. "Inde" inside "indépendant").
const BE_OTHER_COUNTRY_NAMES = Array.from(
  new Set(
    COUNTRIES.flatMap((c) => [foldFr(c.name.fr), foldFr(c.name.en)]).filter((n) => n.length >= 5),
  ),
);

/** Lowercase + strip diacritics, for accent-insensitive French text matching. */
function foldFr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Escape a plain string for safe interpolation into a `new RegExp(...)` source. */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Affirmative "this is calm" statements Belgium actually uses (repair 2026-09-26 -- see the doc
 * comment on normalizeBeLevel for why Level 1 now REQUIRES one of these instead of defaulting to
 * it). Belgium has no single fixed template -- these were found by running the FIRST version of
 * this list (patterns 2/4/5/6 below only) against all 177 live BE country pages: it correctly
 * caught Portugal/Bahrain/Japan/UAE but dropped 52 obviously-calm countries (France, Netherlands,
 * Sweden, Canada, Czechia, Greece, Iceland, Luxembourg, Malta, Romania, Singapore, Taiwan...) to
 * null because their pages use a handful of OTHER templates entirely. Patterns 1/3/7/8/9 below
 * were added from that same full-corpus run, not guessed:
 *  1. "il n'y a pas de risque(s)/problème(s) particulier(s)/spécifique(s)" or "ne présente pas de
 *     risque(s)/difficulté(s) particulier(s)/spécifique(s)/majeur(s)" -- by far the most common
 *     template (Netherlands, Canada, Croatia, Mauritius, Latvia, Brunei, Bhutan, Czechia,
 *     Liechtenstein, Malta, Singapore all use one or the other almost verbatim).
 *  2. "il est (généralement/en général) possible de voyager/se rendre/vivre ... en (toute)
 *     sécurité" -- Portugal, Bahrain, Luxembourg, Iceland, Turkmenistan, Mongolia.
 *  3. "les voyages ... se déroulent en toute sécurité" / "se font sans problème" -- Greece, Malta.
 *  4. "un des pays les plus sûrs (du monde)" -- Japan.
 *  5. "vigilance normale" -- Belgium's OWN explicit "normal" (as opposed to elevated) vigilance
 *     phrase, verified on Taiwan ("une vigilance normale reste néanmoins de mise").
 *  6. "sans rencontrer/connaître de problème(s)/risque(s) particulier(s)" -- Hungary.
 *  7. "situation générale/sécuritaire ... (est/demeure/reste) (relativement) stable" -- Bosnia,
 *     Romania. "stable" specifically, not "sûr" -- see the Cuba note below for why.
 *  8. "les précautions d'usage sont d'application" (Bahrain) -- Belgium's own "normal vigilance"
 *     phrase for crime specifically (low crime rate, standard precautions, nothing more).
 *  9. "la vie quotidienne et l'espace public sont sûrs" (UAE).
 * Deliberately NOT a pattern: a bare "relativement sûr/faible" -- Cuba's own page uses almost
 * that exact wording ("Cuba EST un pays RELATIVEMENT sûr") immediately hedged by "la vigilance
 * reste TOUTEFOIS de mise" (nonetheless remains advisable) in the SAME sentence; a loose
 * "relativement (sûr|faible)" match would have wrongly classified Cuba's hedged, qualified claim
 * as calm -- confirmed by re-running the full 177-country comparison after adding pattern 7
 * (which uses "stable", a different adjective, specifically to avoid this collision) and checking
 * Cuba still resolves to null.
 */
const BE_CALM_PATTERNS = [
  // .{0,20} between the noun and its qualifier, not a direct adjacency requirement: Latvia's real
  // page inserts "de sécurité" in between -- "il n'y a pas de risques DE SÉCURITÉ particuliers".
  /(il n.?y a pas|ne presente pas) de (risques?|difficultes?|problemes?).{0,20}(particuliers?|specifiques?|majeurs?)/s,
  // .{0,60}, not .{0,30}: Luxembourg's real page reads "voyager OU DE VIVRE au Grand-Duché de
  // Luxembourg en toute sécurité" -- a compound "travel or live" clause plus the country's own
  // (sometimes multi-word) name pushes the gap to "voyager" past a narrower cap, which is what
  // caused Luxembourg to wrongly land on null in the same full-corpus run that added this list.
  // "tout a fait" (completely) added alongside "generalement"/"en general"/"habituellement":
  // Lesotho's real page reads "il est TOUT A FAIT possible de voyager au Lesotho, a condition de
  // respecter les precautions d'usage..." -- no "en securite" suffix at all, so that suffix is
  // now optional too (still a strong, specific enough claim on its own not to need it).
  /il est (generalement |en general |habituellement |tout a fait )?possible de (voyager|se rendre|vivre|se deplacer)\b(.{0,60}(en toute )?securite)?/s,
  /voyages?.{0,40}(se deroulent.{0,20}(en toute )?securite|se font.{0,20}sans probleme)/s,
  /un des pays les plus surs/,
  // Namibia "un pays stable", Finland "un pays tres sur" -- a plainer version of "un des pays les
  // plus surs" above (no superlative), still a genuine calm claim about the country as a whole.
  /un pays (tres )?(stable|surs?)\b/,
  /vigilance normale/,
  /sans (rencontrer|connaitre) de (problemes?|risques?) particuliers?/,
  // "bonne", not just "stable": Seychelles reads "la situation securitaire ... est, dans son
  // ensemble, bonne". .{0,60}, not .{0,30}: Bosnia's own multi-word name ("... en Bosnie et
  // Herzegovine est relativement stable") pushes the gap past a narrower cap, same reason as the
  // Luxembourg fix above.
  /situation (generale|securitaire).{0,60}(est |demeure |reste )?(dans son ensemble )?(relativement )?(stable|bonnes?)/s,
  // Sweden's own "prendre les precautions habituelles" -- a plainer synonym of "precautions
  // d'usage" below, same "nothing beyond standard vigilance" meaning.
  /precautions habituelles/,
  /precautions d.?usage sont d.?application/,
  /vie quotidienne et l.?espace public sont surs?/,
];

/**
 * Normalize Belgium (diplomatie.belgium.be) French advisory text to unified 1-4 scale.
 *
 * Belgium publishes no numeric/color level: the actual verdict lives in free-text prose on
 * each country's dedicated "Sécurité générale" article (fetchBeAdvisories follows the link to
 * it — the country-index page itself, which the old parser read, is a near-empty shell with
 * no advisory text at all, which is *why* it always saw nothing and collapsed to 0 countries).
 *
 * `text` must be that article's block elements (<p>/<li>/<h2-4>), one per line ("\n"-joined),
 * NOT the whole page flattened to one string — Drupal concatenates heading text directly
 * against the next paragraph with no punctuation between them, so flattening would let an
 * unrelated "Criminalité" section bleed into an adjacent security verdict. `countryNameFr`
 * is the current country's own French name (e.g. "Thaïlande"), used for the whole-country-vs-
 * regional scope check below.
 *
 * This is the second design pass (see git history for the first): the first pass classified
 * per-block, escalating on any "déconseillé" unless a region/border word was also present in
 * that block. Verifying it against ~20 live pages on 2026-09-25 (SOURCE-REPAIR-BRIEF rule 8a)
 * surfaced two real failure modes that block-level, escalate-by-default scoring can't avoid:
 *  1. "déconseillé" is also French for "inadvisable" in a purely behavioral sense ("il est
 *     fortement déconseillé de laisser des effets personnels sans surveillance" — a pickpocket
 *     tip, not a travel verdict). Fix: a "déconseillé" only counts if its OWN sentence also
 *     names a travel act (voyage/se rendre/déplacement/séjour) — the Pakistan page separately
 *     confirmed this alone isn't enough ("Lors de la planification d'un voyage au Pakistan...
 *     Y assister [a religious gathering], même comme spectateur, est fortement déconseillé" —
 *     "voyage" and "déconseillé" share a paragraph but not a sentence).
 *  2. Named sub-regions are usually proper nouns (Nord Sinaï, Port Elizabeth's townships, a
 *     Mexican "certains États" list, Kenya's Kibera/Mathare) that no finite word list can
 *     enumerate — so a "does this mention a region word" check under-catches them and wrongly
 *     promotes a partial warning to whole-country severity (violates the "partial warnings
 *     must not promote past 2" rule). Fix: invert the default — a "déconseillé" only reaches
 *     3/4 if its paragraph *positively* names the country itself (or a generic "tout le
 *     pays"/"l'ensemble du territoire" phrase); absent that confirmation it's capped at 2
 *     rather than escalated on the absence of a recognized region word. The generic-phrase
 *     fallback is itself vetoed if a *different* country is named nearby (BE_OTHER_COUNTRY_
 *     NAMES) — otherwise "il ne faut pas...en raison de l'insécurité qui règne dans le pays"
 *     about Myanmar, quoted on Thailand's own page, would wrongly confirm Thailand.
 *
 * Levels (re-verified 2026-09-26 against a FULL run over all 177 live BE country pages, not just
 * a sample -- see the repair note below for why that mattered; Afghanistan/Mali/Syria/North
 * Korea/Sudan/Lebanon/Ukraine -> 4; Egypt/Turkey/Thailand/Pakistan/Kenya/Mexico/Philippines/
 * Somalia regional-only mentions -> capped at 2; Portugal/Bahrain/Japan/Netherlands/Canada/
 * Czechia/Greece/Finland/Sweden -> 1; Cuba/Italy/France -> null):
 *  - "formellement/fortement/strictement/fermement déconseillé", "ne pas se rendre", or "quitter"
 *    GOVERNED by an advisory verb (déconseille/conseillons/recommandé -- see hasQuitter below,
 *    NOT bare "quitter") -> 4 (whole-country-confirmed) or 2 (not confirmed / regional).
 *  - any other "déconseillé" root, or "reporter tous les voyages" -> 3 or 2, same rule.
 *  - vigilance/prudence/attention qualified by "accrue"/"renforcée"/"particulière"/
 *    "soutenue"/"extrême", or an explicitly elevated crime rate ("criminalité" + "élevé") -> 2
 *    (these never need the whole-country check — 2 is already the cap either way).
 *  - Level 1 ONLY on an affirmative calm statement (BE_CALM_PATTERNS, see its own doc comment for
 *    the full list and why it ended up this large) -- otherwise null, never a guess.
 *
 * Repair 2026-09-26 (SOURCE-REPAIR-BRIEF, second pass): production found South Sudan reporting
 * level 1 despite its page opening "Il est conseillé aux compatriotes de quitter le Soudan du
 * Sud" and closing "nous vous déconseillons d'y retourner" -- an active "leave the country"
 * order. Two real wording gaps, not one: (a) "quitter" NEVER co-occurs with a TRAVEL_WORDS verb
 * in the same sentence ("quitter le Soudan du Sud" / "quitter le pays le plus tôt possible tant
 * qu'il y a encore des vols commerciaux" -- no "voyage"/"se rendre" anywhere), so the existing
 * `hasTravelWord && LEVEL4_STRONG` gate always skipped it even though the OLD code already had a
 * ('quitter le pays') entry; (b) "déconseillons d'y RETOURNER" (we advise against RETURNING) --
 * "retourner" was simply missing from TRAVEL_WORDS, so "déconseillons" (the 1st-person-plural
 * conjugation, which the "deconseill" stem itself already matched fine) never got to fire either.
 *
 * Fixed by adding "retourner"/"naviguer" to TRAVEL_WORDS (retourner is an unconditional travel act
 * in its own right; naviguer -- "il est déconseillé de naviguer vers ces îles", UAE's disputed
 * Abu Musa/Tunb islands -- lets a real, region-scoped warning register at its correct capped
 * level 2 instead of silently registering nothing) and handling "quitter" as its OWN dedicated
 * check (hasQuitter), NOT folded into TRAVEL_WORDS/LEVEL4_STRONG like the original 'quitter le
 * pays' entry was. Verifying the first version of this fix (bare 'quitter' added straight to
 * LEVEL4_STRONG, exactly like retourner/naviguer) against a FULL run over all 177 live BE pages --
 * not just the handful sampled for the initial fix -- surfaced two real false positives that a
 * small sample missed entirely: China's page reads "l'obligation de QUITTER LE PAYS dans un délai
 * très court" as a drug-law VISA consequence, nothing to do with travel safety, and the generic
 * "le pays" confirmation phrase (designed for "déconseillé", which realistically never appears in
 * an official advisory except as a travel verdict) is far too weak a signal for "quitter" specif-
 * ically, which has this and other common non-safety senses ("quitter le groupe" during a guided
 * DMZ tour, South Korea's page). hasQuitter now requires (a) the SAME sentence to also contain an
 * advisory verb (déconseill.../conseill.../recommand...) -- exactly the construction both real
 * South Sudan sentences use, never a bare consequence-of-something-else clause -- and (b)
 * confirmation via the country's OWN name specifically (requireCountryNameOnly), never the
 * generic "le pays" fallback other triggers use.
 *
 * That same full-corpus run also caught a confirmation bug pre-dating this repair entirely:
 * `window.includes(countryFold)` is a bare substring test, and Somalia's own adjective
 * "somaliennes" ("côtes somaliennes" -- a COASTAL/maritime reference) contains "somalie" as a
 * literal prefix, wrongly confirming a maritime piracy warning as whole-country. Fixed with a
 * word-boundary-aware regex instead (countryFold is already accent-folded to plain ASCII by
 * foldFr, so JS's ASCII-only \b is safe here -- unlike the SK repair's diacritic-\b trap). A
 * separate, SPECULATIVE addition from the same round -- escalating "tous/tout les voyages ...
 * déconseillés" (blanket, "not even humanitarian" wording) straight to LEVEL4_STRONG on the
 * reasoning that it reads stronger than a plain "déconseillé" -- was reverted after the full run
 * showed it firing on Somalia's and the Philippines' own region-scoped instances (Puntland,
 * western Mindanao: proper nouns REGIONAL_WORDS can't enumerate, a known limitation of the
 * confirmation check below) and pushing them to a firmer, wrongly-confident 4. The plain
 * 'deconseill' stem (pre-existing, unchanged) already reaches every country that genuinely needs
 * this phrase without that added risk -- North Korea's "Tous les voyages sont déconseillés" was
 * never missed by it.
 *
 * Also, per the SK repair (2026-09-25) precedent: the "none of the above -> 1" default used to be
 * unconditional -- comprehensive-source reasoning that Cuba's page disproved. Its 2026-09-26 live
 * text is ~1900 characters describing a genuine energy/fuel crisis, hedged as "Cuba EST un pays
 * RELATIVEMENT sûr, la vigilance reste TOUTEFOIS de mise" (Cuba IS a relatively safe country,
 * vigilance nonetheless remains advisable) -- a hedged, qualified safety claim, not an unqualified
 * one, and never any of Belgium's own "déconseillé"/"quitter"/"retourner" verdict verbs applied to
 * Cuba as a destination. Monaco's page uses the SAME hedge shape ("le taux de criminalité est
 * faible ... la vigilance est TOUTEFOIS de mise") and is null for the same reason. Contrast
 * Bahrain's UNQUALIFIED "il est possible de s'y rendre en sécurité" (it is possible to go there
 * safely) -- Portugal's near-identical "il est généralement possible de voyager ... en toute
 * sécurité" confirms this is Belgium's own reusable calm template, not a one-off, and it is
 * genuinely absent from Cuba's and Monaco's hedged versions. Level 1 now requires a
 * BE_CALM_PATTERNS match; otherwise the function returns null, never guessing 1 on an unrecognized
 * notice -- this also correctly leaves Denmark null despite its low crime rate, because Belgium's
 * OWN page separately puts its national terror-threat level at "4 sur une échelle de 5" (serious),
 * a real elevated signal this parser has no dedicated pattern for yet, better left unclassified
 * than reported as "normal precautions".
 *
 * Returns null when there's no real content to classify (empty input, or fewer than 3 blocks — a
 * redesigned/broken page), AND when a substantive article matched neither an escalation pattern
 * nor a calm one (Cuba, Italy -- Italy's page is pure pickpocket/consular-admin boilerplate with
 * no "déconseillé" and no calm phrase either) — never guess 1 on an unrecognized notice.
 */
export function normalizeBeLevel(text: string, countryNameFr: string): UnifiedLevel | null {
  if (!text || !text.trim()) return null;
  const blocks = text.split('\n').map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 3) return null; // not a real article — avoid fabricating "level 1"

  const countryFold = foldFr(countryNameFr);

  const REGIONAL_WORDS = [
    'region', 'zone', 'province', 'district', 'frontalie', 'frontier',
    'nord du', 'nord de', 'sud du', 'sud de', 'est du', 'ouest du',
    'certaines parties', 'certains endroits', 'ces zones', 'ces regions', 'cette region',
    'localite', 'quartier', 'comte', 'bidonville', 'canton', 'township',
    'certains etats', 'certain etat', // e.g. Mexico's "voyages... vers certains États"
  ];
  const WHOLE_COUNTRY_PHRASES = [
    'le pays', 'tout le pays', 'ensemble du pays', 'ensemble du territoire',
    'tout le territoire', 'interieur du pays',
  ];
  // Repair 2026-09-26: "interieur du pays" (unlike "tout le pays"/"ensemble du
  // territoire", which are unambiguous) can be a LOCATION adverbial for a
  // manner- or activity-qualified safety tip ("don't do X when moving around
  // domestically") rather than confirmation that the country ITSELF is the
  // travel verdict's object ("don't come here at all"). Verified live on
  // Liberia's real page: "Il est très fortement déconseillé de déplacer ou
  // voyager SEUL à l'intérieur du pays, et ce quel que soit le moment de la
  // journée" -- a solo-travel tip (Liberia's own name is never even mentioned
  // in this sentence) that was wrongly confirming the whole country at
  // level 4 via the generic "interieur du pays" fallback. Any of these
  // qualifiers on the travel verb turns the sentence into advice about HOW/
  // WHEN to move around, not WHETHER to go: "seul(e)" (alone -- Liberia's
  // own case), "de nuit"/"la nuit"/"tombee de la nuit" (after dark), "par la
  // route" (by road, as opposed to organised transport), "en dehors des"
  // (outside of -- typically "outside of organised tours/main roads").
  const BE_MANNER_QUALIFIER =
    /\bseul(?:e|es|s)?\b|\bde nuit\b|\bla nuit\b|tombee de la nuit|\bpar la route\b|\ben dehors des?\b/;
  // "quitter"/"retourner" are unconditional travel acts (leaving/returning to a place IS the
  // travel act, not a separate one that needs a co-occurring "voyage"/"se rendre" to confirm --
  // see the South Sudan repair note above). "naviguer" (sail to/toward) is the same idea applied
  // to a specific mode, evidenced on the UAE's disputed-islands warning.
  // "retourner" is an unconditional travel act (returning to a place IS the travel act, not a
  // separate one that needs a co-occurring "voyage"/"se rendre" to confirm -- see the South Sudan
  // repair note above). "naviguer" (sail to/toward) is the same idea applied to a specific mode,
  // evidenced on the UAE's disputed-islands warning. "quitter" is deliberately NOT here: it is
  // handled as its own branch below with a stricter confirmation rule (see hasQuitter).
  const TRAVEL_WORDS = ['voyage', 'voyager', 'se rendre', 'deplacement', 'deplacer', 'sejour', 'retourner', 'naviguer'];
  const LEVEL4_STRONG = [
    'formellement deconseill', 'fortement deconseill', 'strictement deconseill',
    'fermement deconseill', 'ne pas se rendre',
  ];
  // "reporter tous les voyages" (postpone) and a bare "deconseill" stem both already cover "tous
  // les voyages ... sont déconseillés" (North Korea's real page: "Tous les voyages sont
  // déconseillés", satisfied by 'deconseill' + hasTravelWord via "voyages" itself, both PRE-
  // EXISTING) -- checked, and deliberately NOT special-cased any further here. An earlier version
  // of this repair added a dedicated "blanket, no exceptions" -> LEVEL4_STRONG escalation for
  // exactly that phrase, on the reasoning that "no exceptions, not even humanitarian" (Somalia's
  // real wording) is stronger than a plain "déconseillé". Reverted: verified live on the SAME
  // 177-country run that this phrase almost always names a SUB-region right in the same clause --
  // Somalia's own instance is "Tous les voyages ... sont strictement déconseillés" about PUNTLAND,
  // Philippines' is "tout voyage est déconseillé dans la partie occidentale de MINDANAO" -- and
  // both are proper nouns REGIONAL_WORDS can't enumerate (a known, documented limitation of the
  // whole-country check below), so the extra escalation pushed two REGIONAL warnings to a firmer,
  // wrongly-confident level 4 instead of leaving them at whatever the confirmation logic already
  // (imperfectly) resolved them to. The plain 'deconseill' stem already reaches every country that
  // genuinely needs it without adding this extra risk.
  const LEVEL3_WORDS = ['deconseill', 'reporter tous les voyages', 'reporter le voyage'];
  const LEVEL2_BASE = ['vigilance', 'prudence', 'attention'];
  const LEVEL2_INTENSIFIERS = ['accrue', 'accru', 'renforcee', 'particuliere', 'soutenue', 'extreme'];

  let level: UnifiedLevel | 0 = 0;

  for (const rawBlock of blocks) {
    // Sentence-level, not block-level: a paragraph mixing a travel verdict with an unrelated
    // safety tip (or a cross-reference to another country) must not let the two cues mix.
    const sentences = rawBlock.split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);

    for (let i = 0; i < sentences.length; i++) {
      const cur = foldFr(sentences[i]);
      const hasTravelWord = TRAVEL_WORDS.some((w) => cur.includes(w));
      // "quitter" alone, without requiring a co-occurring TRAVEL_WORDS verb (leaving IS the travel
      // act) -- evidenced on South Sudan's "conseillé ... de quitter le Soudan du Sud" / "quitter
      // le pays le plus tôt possible", neither of which names a separate travel verb. Two extra
      // guards found necessary against real false positives in the same 177-country corpus run
      // that added this: (1) "quitter" is common enough in OTHER senses -- a visa/legal
      // "obligation de quitter le pays" (China's OWN page, in a paragraph about drug-law
      // consequences that also happens to say "en Chine" moments earlier, so the country's-own-
      // name confirmation below is trivially satisfied on every single-country page and can't
      // filter it out) or "quitter le groupe" during a guided DMZ tour (South Korea) -- so this
      // only counts when GOVERNED by an advisory verb in the same sentence (conseillé/conseillons/
      // recommandé), exactly the construction both real South Sudan sentences use, never a bare
      // consequence-of-something-else clause; (2) it still requires its OWN stricter whole-country
      // check below (requireCountryNameOnly) -- the generic "le pays" fallback other triggers use
      // is too weak a signal on its own for this specific verb.
      const hasQuitter = /\bquitter\b/.test(cur) && /conseil|recommand/.test(cur);

      let sentenceLevel = 0;
      let requireCountryNameOnly = false;
      if (hasTravelWord && LEVEL4_STRONG.some((w) => cur.includes(w))) {
        sentenceLevel = 4;
      } else if (hasQuitter) {
        sentenceLevel = 4;
        requireCountryNameOnly = true;
      } else if (hasTravelWord && LEVEL3_WORDS.some((w) => cur.includes(w))) sentenceLevel = 3;
      else if (LEVEL2_BASE.some((base) => cur.includes(base)) && LEVEL2_INTENSIFIERS.some((mod) => cur.includes(mod))) sentenceLevel = 2;
      else if (cur.includes('criminalit') && /elev/.test(cur)) sentenceLevel = 2; // "taux [de criminalité] élevé" in either word order

      if (sentenceLevel === 0) continue;

      if (sentenceLevel > 2) {
        // Whole-country confirmation looks one sentence back too (within the same paragraph):
        // "en Corée du Nord... Tous les voyages sont déconseillés" names the country once and
        // refers back to it implicitly, which is normal French, not a scope expansion.
        const window = foldFr((i > 0 ? sentences[i - 1] + ' ' : '') + sentences[i]);
        // Word-boundary, not a bare substring test: Somalia's own adjective "somaliennes" (as in
        // "côtes somaliennes", a COASTAL/maritime reference, not a whole-country one) contains
        // "somalie" as a literal PREFIX -- a bare .includes(countryFold) wrongly confirmed it as
        // whole-country. countryFold is already accent-folded to plain ASCII (foldFr), so JS's
        // ASCII-only \b is safe here (unlike the SK repair's diacritic-\b trap).
        const countryNameConfirmed = new RegExp(`\\b${escapeRegexLiteral(countryFold)}\\b`).test(window);
        const mentionsOtherCountry = BE_OTHER_COUNTRY_NAMES.some((n) => n !== countryFold && window.includes(n));
        // "interieur du pays" only counts as whole-country confirmation when the travel verb it
        // qualifies has no manner/activity modifier of its own (see BE_MANNER_QUALIFIER) -- the
        // other WHOLE_COUNTRY_PHRASES entries ("tout le pays", "ensemble du territoire", ...) are
        // unambiguous regardless, so this check is scoped to that one phrase specifically. Tested
        // against `cur` (the CURRENT sentence only), not the full look-back `window`: the qualifier
        // has to be part of the SAME clause as "interieur du pays" for the "manner, not destination"
        // reading to hold -- an unrelated manner word in the PRIOR sentence (a separate safety tip)
        // must not veto a genuine whole-country confirmation in the current one.
        const hasGenericWholeCountryPhrase = WHOLE_COUNTRY_PHRASES.some((p) => {
          if (!window.includes(p)) return false;
          if (p === 'interieur du pays' && cur.includes(p) && BE_MANNER_QUALIFIER.test(cur)) return false;
          return true;
        });
        const wholeCountryConfirmed = requireCountryNameOnly
          ? countryNameConfirmed
          : countryNameConfirmed || (!mentionsOtherCountry && hasGenericWholeCountryPhrase);
        const regionalHit = REGIONAL_WORDS.some((w) => window.includes(w));

        if (!wholeCountryConfirmed || regionalHit) sentenceLevel = 2;
      }

      if (sentenceLevel > level) level = sentenceLevel as UnifiedLevel;
    }
  }

  if (level === 0) {
    const flat = foldFr(text).replace(/\n/g, ' ');
    return BE_CALM_PATTERNS.some((re) => re.test(flat)) ? 1 : null;
  }
  return level;
}

/**
 * Normalize a Denmark (um.dk) travel-guide accordion tier to unified 1-4
 * scale. um.dk structures each country page as a stack of accordion `<li>`
 * items whose CSS modifier class names the severity directly — minimal <
 * low < medium < high (see the fetcher for the DOM walk that produces this
 * modifier). "minimal" and "low" both fold into 2: the unified scale has no
 * room for a 5th tier, and collapsing DK's two mildest tiers together
 * matches how this file already collapses multi-tier caution language for
 * other issuers (normalizeNoLevel, normalizePtLevel).
 *
 * Audit 2026-09-25: the previous implementation (`normalizeDkLevel`) matched
 * keywords against the RAW page HTML, which encodes å/æ/ø as numeric HTML
 * entities (`&#xE5;`) rather than literal UTF-8 — so "frarådes"/"undgå"
 * never matched anything, and the parser defaulted to 1 for nearly every
 * country, including active war zones. The fetcher now decodes text via
 * cheerio and reads the structural tier instead of guessing from prose.
 */
export function normalizeDkTier(modifier: 'minimal' | 'low' | 'medium' | 'high'): UnifiedLevel {
  if (modifier === 'high') return 4;
  if (modifier === 'medium') return 3;
  return 2; // minimal | low
}

/**
 * Normalize Singapore (mfa.gov.sg) English advisory text to unified 1-4 scale.
 *
 * The old implementation scraped a listing page that no longer exists at its old URL (see
 * fetchSgAdvisories) and, even where it matched, used single-word cues ("avoid", "caution")
 * broad enough to fire on unrelated boilerplate. mfa.gov.sg is NOT a comprehensive one-page-
 * per-country directory the way Belgium's is: most country pages (Japan, France...) carry only
 * visa/entry-requirement text with no safety verdict at all — this is an event-based notice
 * system (earthquakes, floods, protests, conflict), not a standing per-country baseline. So
 * unlike normalizeBeLevel, this NEVER defaults to 1: silence here means "no notice currently
 * published", not "normal precautions confirmed", and the two must not be conflated (rule 1).
 *
 * `text` must be the page's advisory paragraphs, one per line ("\n"-joined, matching
 * fetchSgAdvisories) — classified per paragraph, not over the whole page flattened, because
 * MFA reuses one shared regional-conflict paragraph verbatim across every affected country's
 * page (e.g. "Singaporeans are advised to defer all travel **to the region**" appears
 * unchanged on Bahrain/Kuwait/Qatar/UAE's pages during a Middle-East-wide notice; "defer all
 * travel to the conflict areas in the Thai-Cambodian **border regions**" appears on both
 * Thailand's and Cambodia's pages). Read at the whole-page level this reads as "level 4 for
 * every one of those countries"; per Rule 2 (partial/regional warnings must not promote a
 * country past 2) a paragraph naming "the region"/"border regions"/"conflict area(s)" rather
 * than the country itself is capped at 2, mirroring normalizeBeLevel's regional-scope guard.
 *
 * Phrase tiers below were read directly off ~15 live pages on 2026-09-25: Syria and North
 * Korea use "defer/avoid ALL travel" (no "non-essential" qualifier) naming the country itself
 * -> 4; Libya/Ukraine use "defer all non-essential travel" -> 3; Nepal/Madagascar/France
 * (flash floods, post-unrest monitoring, elevated terror threat) use "exercise a high degree
 * of caution" -> 2. Calm/visa-only pages (Japan, Italy, most of the 189-country sitemap) match
 * nothing -> null, correctly emitting no indicator for them.
 */
export function normalizeSgLevel(text: string): UnifiedLevel | null {
  if (!text || !text.trim()) return null;

  const REGIONAL_WORDS = ['the region', 'border region', 'conflict area', 'the following area', 'certain area'];

  let level: UnifiedLevel | null = null;

  for (const paragraph of text.split('\n')) {
    const lower = paragraph.toLowerCase();
    let paragraphLevel: UnifiedLevel | 0 = 0;

    // "do not travel" alone is also generic crime-safety phrasing ("do not travel alone at
    // night") on plenty of otherwise-calm pages (e.g. Ethiopia) -- exclude that manner-qualified
    // form specifically rather than dropping the cue outright, since a bare "Do not travel to
    // X" verdict is a real, distinct level-4 pattern worth keeping.
    if (lower.includes('defer all travel') || lower.includes('avoid all travel')
      || (lower.includes('do not travel') && !lower.includes('do not travel alone'))
      || lower.includes('leave immediately') || lower.includes('evacuate immediately')) paragraphLevel = 4;
    else if (lower.includes('defer all non-essential travel') || lower.includes('avoid all non-essential travel')
      || lower.includes('avoid non-essential travel')) paragraphLevel = 3;
    else if (lower.includes('exercise a high degree of caution') || lower.includes('exercise increased caution')
      || lower.includes('exercise extra caution') || lower.includes('high degree of vigilance')) paragraphLevel = 2;

    if (paragraphLevel === 0) continue;

    if (paragraphLevel > 2 && REGIONAL_WORDS.some((w) => lower.includes(w))) paragraphLevel = 2;

    if (level === null || paragraphLevel > level) level = paragraphLevel;
  }

  return level; // null when no paragraph matched — not the same as "confirmed normal"
}

/**
 * Normalize Romania (mae.ro) 9-level numeric scale to unified 1-4 scale.
 */
export function normalizeRoLevel(level: number): UnifiedLevel {
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

/**
 * Extracts the "SECURITY SITUATION —" paragraph from a Serbian MFA
 * (mfa.gov.rs) country page's visible text, bounded by the next ALL-CAPS
 * section heading (TRANSPORT, VISA REGIME, CONTACT INFORMATION, ...). RS
 * writes free-form prose per country rather than a structured level field,
 * and generic tips reused across every country page ("avoid carrying large
 * amounts of cash", "avoid street demonstrations") live in the SAME
 * body text — scoping to just this section keeps a safe country's boilerplate
 * from being read as a country-specific warning. Returns null when the page
 * doesn't have this heading at all (different template, or genuinely no
 * content), so the caller can skip the country rather than guess.
 */
export function extractRsSecuritySection(bodyText: string): string | null {
  const startIdx = bodyText.search(/SECURITY SITUATION/i);
  if (startIdx === -1) return null;
  const rest = bodyText.slice(startIdx + 'SECURITY SITUATION'.length);
  // Next heading: a run of 2-4 ALL-CAPS words followed by a dash, e.g. "TRANSPORT —".
  const nextHeadingIdx = rest.search(/[A-Z]{2,}(?:\s+[A-Z]{2,}){1,3}\s*[—-]/);
  return nextHeadingIdx === -1 ? rest.slice(0, 600) : rest.slice(0, nextHeadingIdx);
}

/**
 * Normalize Serbia (mfa.gov.rs) English advisory text (the SECURITY
 * SITUATION section only — see extractRsSecuritySection) to unified 1-4
 * scale.
 *
 * Audit 2026-09-25: the previous keyword list missed RS's actual phrasing
 * for its most severe cases — "citizens ... are advised to refrain from all
 * travel to Israel" and "... refrain from any type of travel to Jordan"
 * contain neither "do not travel" nor any other matched keyword, so active
 * war-zone pages fell through to a hardcoded level-1 default. This version
 * matches RS's real vocabulary (confirmed against live pages for Afghanistan,
 * Israel, Jordan, Palestine, Oman, Iraq, Somalia, CAR, Haiti, Nigeria, Sudan)
 * and returns null instead of defaulting when nothing matches.
 *
 * Repair 2026-09-25 (SOURCE-REPAIR-BRIEF, second pass): the audit above fixed
 * the ESCALATED end but left this function with NO path to Level 1 at all —
 * every calm country (nothing in the 4/3/2 keyword lists) fell through to
 * the closing `return null`, silently dropping most of the source's normal-
 * risk countries (verified: Switzerland "the security situation ... is good
 * ... relatively little crime", Canada "high security level in the whole
 * territory", China "High-level security." — a real production run measured
 * this at 97/183 countries, roughly half the source, before this fix).
 * Level 1 patterns below are checked LAST (only once 4/3/2 have already
 * failed to match), so a country using both a calm phrase AND a real caution
 * one (Greece: "overall security situation ... is good" but ALSO "advised to
 * exercise caution due to potential risk of theft") still correctly resolves
 * to the higher level — verified live, not just reasoned about.
 *
 * Also added to Level 4: "advised not to travel" (Ukraine: "citizens ... are
 * advised not to travel to Ukraine due to the war situation" — a wording
 * variant of the already-handled "refrain from (all/any) travel" that the
 * 2026-09-25 audit above did not yet cover).
 *
 * Repair 2026-09-26 (PARSER-REGIONAL-BRIEF spot check): the "refrain from
 * .../advised not to travel" checks above ran on the WHOLE section with a
 * bare substring/regex test, so a REGIONAL "refrain from travel" sentence
 * wrongly promoted the whole country to 4 — found on Panama, whose real page
 * reads "citizens ... are advised to refrain from traveling to the Caribbean
 * PROVINCE OF BOCAS DEL TORO in the Republic of Panama until further
 * notice", a single province, while the rest of the section is ordinary
 * level-2 crime-caution prose ("the crime rate ... is high, and travellers
 * are advised to exercise a high degree of caution"). Fixed by scoping these
 * two checks to individual sentences and skipping (not un-escalating to
 * null — see sawScoped4 below) any hit whose OWN "travel(l)?ing? to (the)?"
 * object names a sub-national unit (RS_REGIONAL_TRAVEL_TARGET) rather than a
 * country. Anchored to right after "to", not a sentence-wide scan, so it
 * does not misfire on a country whose own official name contains one of
 * these words well before the "travel to" clause — verified against
 * Palestine's real page, "in the STATE of Palestine, caused by the ongoing
 * war, citizens ... are advised to refrain from traveling TO THIS COUNTRY"
 * (the object right after "to" is the generic "this country", not "State"),
 * which still correctly resolves to 4. Also re-verified live against every
 * other country this doc comment's own history calls out as genuine
 * (Afghanistan, Israel, Jordan, Oman, Ukraine): all name the country itself
 * (or a generic "this country") immediately after "to", none regress.
 */
const RS_REGIONAL_TRAVEL_TARGET =
  /travel(?:l?ing)?\s+to\s+(?:the\s+)?(?:[a-z'-]+\s+){0,2}(?:province|region|state|prefecture|governorate|district|county|zone|island|peninsula|coast\w*)\b/i;

export function normalizeRsLevel(sectionText: string): UnifiedLevel | null {
  const lower = sectionText.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('extremely high') || lower.includes('leave immediately')) {
    return 4;
  }

  // Sentence-scoped: either construction can name a sub-national destination
  // instead of the country (see the repair note above).
  let sawScoped4 = false;
  for (const sentence of lower.split(/(?<=[.!?])\s+/)) {
    const hit =
      /refrain from (all |any(?: type of)? )?travel/.test(sentence) || /advis\w*\s+not\s+to\s+travel/.test(sentence);
    if (!hit) continue;
    if (RS_REGIONAL_TRAVEL_TARGET.test(sentence)) sawScoped4 = true;
    else return 4; // genuine, unscoped -- no need to keep scanning
  }

  if (
    lower.includes('not recommended') ||
    lower.includes('not advise') ||
    lower.includes('advised against') ||
    lower.includes('reconsider') ||
    lower.includes('high level')
  ) return 3;
  if (lower.includes('increased') || lower.includes('caution') || lower.includes('elevated')) return 2;
  if (
    /security situation.{0,30}is good/.test(lower) ||
    /high[\s-]level(?:\s+of)?\s+security|high security level/.test(lower) ||
    lower.includes('public peace and order') ||
    lower.includes('safest countries')
  ) return 1;
  // A regionally-scoped "refrain from travel" was found but nothing else in
  // the section matched a lower tier either -- a real regional warning
  // exists (Panama), so per this project's "partial warning never promotes
  // past increased caution" rule (mirrors DE/NL/BE/FR/CH/AT elsewhere in
  // this file) this is 2, never the unscoped 4 and never a guessed null.
  if (sawScoped4) return 2;
  return null;
}

/**
 * Normalize Estonia (kriis.ee) Estonian advisory text to unified 1-4 scale.
 */
export function normalizeEeLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('mitte reisida') || lower.includes('lahkuda') || lower.includes('vältida igasugust')) return 4;
  if (lower.includes('vältida') || lower.includes('vaeltida') || lower.includes('hoiduda')) return 3;
  if (lower.includes('ettevaatlik') || lower.includes('tähelepanelik') || lower.includes('tahelepanelik')) return 2;
  return 1;
}

/**
 * Normalize Croatia (mvep.gov.hr) advisory text to unified 1-4 scale.
 * Supports both English and Croatian text patterns.
 */
export function normalizeHrLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('leave') || lower.includes('ne putujte')) return 4;
  if (lower.includes('avoid') || lower.includes('reconsider') || lower.includes('izbjegavajte')) return 3;
  if (lower.includes('caution') || lower.includes('oprez') || lower.includes('increased')) return 2;
  return 1;
}

/**
 * Normalize Argentina (cancilleria.gob.ar) Spanish advisory text to unified 1-4 scale.
 */
export function normalizeArAlert(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('no viaje') || lower.includes('abandone') || lower.includes('evacuación') || lower.includes('evacuacion')) return 4;
  if (lower.includes('evite') || lower.includes('absténgase') || lower.includes('abstengase') || lower.includes('reconsidere')) return 3;
  if (lower.includes('precaución') || lower.includes('precaucion') || lower.includes('alerta')) return 2;
  return 1;
}

// --- Tier 3a normalization functions ---

/** Lowercase, strip zero-width/non-breaking-space junk (common in government CMS copy-paste), collapse whitespace.
 *  Shared by every Tier 3a free-text normalizer (IT today, ES below). */
function normalizeAdvisoryText(text: string): string {
  return text
    // DOM-to-text extraction (see fetchEsAdvisories / fetchItAdvisories) concatenates sibling block
    // elements -- headings, paragraphs -- with no separator, so "...aviso.Se ruega..." is really TWO
    // sentences glued into one string with no space at the join. Left alone, splitIntoSentences()
    // below reads the glued pair as a SINGLE sentence, and an unrelated qualifier later in that merged
    // blob can veto a real match earlier in it. Repair 2026-09-25: Spain's Central African Republic
    // page glues its whole-country evacuation banner ("...LO ANTES POSIBLE.") straight onto the next
    // paragraph; a nighttime-curfew "de noche" aside three sentences later in the same merged blob then
    // tripped ES_ZONE_MARKERS and suppressed the banner, producing level 1 for a country under a
    // do-not-travel order. Must run BEFORE toLowerCase() -- it keys off the capital letter that starts
    // the next real sentence. Gated on >=4 letters before the punctuation so short abbreviations
    // ("EE.UU.", "Sr.", "D.F.") are left alone -- real sentence-final words are practically never that
    // short, ALL-CAPS banners (as in the CAF case, "...POSIBLE.Se...") included.
    .replace(/(\p{L}{4,})([.!?])(?=\p{Lu})/gu, '$1$2 ')
    .toLowerCase()
    .replace(/[​﻿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split cleaned prose into sentences -- advisory text mixes whole-country and named-zone claims in the same
 *  paragraph, so severity must be read sentence-by-sentence rather than on the whole blob (see normalizeItLevel). */
function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
}

/** Sub-national qualifiers that must never let a sentence promote a country above level 2, mirroring the
 *  DE/NL partial-warning guard used elsewhere in the pipeline (data-pipeline.yml). "Gaza"/"Cisgiordania"/"Sinai"
 *  are hardcoded because they recur across many countries' dossiers as a spillover risk, not the country itself
 *  (e.g. Iran's page discusses a Gaza travel ban while assessing Iran, not Gaza). */
const IT_SUBNATIONAL_MARKERS = [
  'alcuni stati', 'alcune regioni', 'alcune zone', 'alcune aree', 'alcune città', 'alcune province',
  'nello stato di', 'nella provincia di', 'nella contea di', 'nella regione di', 'nel distretto di',
  'zona di confine', 'zone di confine', 'area di confine', 'aree di confine', 'lungo il confine',
  'striscia di gaza', 'cisgiordania', 'sinai',
];

/**
 * Word-stem regional markers, added in the 2026-09-26 regional-promotion repair (mirrors
 * DE_REGIONAL_WORDS' stem approach, needed because Italian declines these nouns by number:
 * regione -> regioni, confine -> confini). A fixed-phrase list (IT_SUBNATIONAL_MARKERS above)
 * missed real border/exclave/separatist-region wording that DOES precede a level-4 trigger
 * phrase on the live 2026-09-26 dossiers:
 *  - Armenia: "si continuano a sconsigliare i viaggi a qualsiasi titolo nei pressi dell'EXCLAVE
 *    azera di Nakhchivan e ... lungo le FRONTIERE con l'Azerbaigian" -- border/exclave wording
 *    the old list didn't have (it only had "lungo il confine", not "frontiere").
 *  - Georgia/Moldova: "le REGIONI separatiste dell'Ossezia del Sud e dell'Abkhazia" / "la
 *    REGIONE separatista della Transnistria" -- both already contain "regione/i" as a NOUN
 *    naming a specific place, caught by `\bregion[ei]\b`; "separatist\w*" is kept anyway as a
 *    second, independent signal for a future case that names a breakaway region without the
 *    word "regione" at all.
 *  - Cameroon: "nella parte orientale del Camerun (REGIONI Adamaoua e Est)" -- plural noun,
 *    caught by the same `\bregion[ei]\b`.
 *  - Oman: "non recarsi nella zona a ridosso del CONFINE con lo Yemen" -- generalizing the old
 *    fixed "zona/area di confine" phrases to a bare `confin\w*` stem catches this different
 *    word order too.
 * `\bregion[ei]\b` is deliberately narrower than a bare `region\w*` stem, and drops the
 * `ragione`-typo tolerance an earlier version of this pattern had (Cameroon's OWN page also
 * misspells "regione" as "ragione" once, in "nell'intera ragione dell'Estremo Nord" -- but that
 * sentence is independently caught via "provincia"/"confine" a few words later, so tolerating
 * the typo isn't load-bearing). Both restrictions were forced by the full 223-country
 * before/after run, not by inspection: a bare `r[ae]gion\w*` stem also matches "ragione" as in
 * "IN RAGIONE della situazione di sicurezza..." (DR Congo -- "by reason of", not a place) and
 * "regionale/i" as in "instabilità REGIONALE"/"tensioni REGIONALI" (Iran, Lebanon -- describing
 * the wider Middle East's geopolitical climate, not a sub-region of the country itself); all
 * three real sentences use "regione"/"ragione" as ordinary Italian words unrelated to a named
 * sub-national place, and all three sit right next to an otherwise-correct whole-country
 * LEVEL3 trigger ("rimandare qualsiasi viaggio verso la Repubblica Democratica del Congo",
 * "sconsigliare qualsiasi viaggio in Iran", "rinviare i viaggi nel Paese") that a
 * `r[ae]gion\w*` stem would have wrongly suppressed. `\bregion[ei]\b` (exact noun forms only,
 * no adjective suffix, no "ragione") matches none of the three.
 * Deliberately NOT genericized: "zona"/"area" (bare stems would swallow LEVEL4_PATTERNS' own
 * "qualunque ZONA del paese" whole-country idiom -- Haiti's real page uses that exact phrase for
 * a GENUINE country-wide ban, verified 2026-09-26) and "stato" (the past participle of "essere"
 * makes a bare stem match almost every sentence in the corpus; the existing "nello stato di"
 * phrase already covers the federated-country case, e.g. Nigeria/Mexico/India/USA states).
 */
const IT_REGIONAL_STEM_MARKERS = /\bregion[ei]\b|\bprovinc\w*|\bdistrett\w*|\bconfin\w*|\bfrontier\w*|\bexclav\w*|\benclav\w*|\bseparatist\w*/i;

/**
 * Does `sentence` contain "a qualsiasi titolo" ("for whatever reason") used as Farnesina's
 * travel-ban intensifier ("viaggi/recarsi/... a qualsiasi titolo" = "travel/go for ANY reason
 * whatsoever, no exceptions") rather than its OTHER, unrelated use scoping WHO an unrelated
 * piece of advice is for ("connazionali/cittadini presenti a qualsiasi titolo" = "nationals
 * present for whatever reason [they're there]")? The bare substring match this replaces treated
 * both identically -- verified wrong on two independent live 2026-09-26 dossiers, neither of
 * which contains ANY avoidance verb (sconsigliare/evitare/non recarsi) anywhere in the flagged
 * sentence:
 *  - Mozambique: "si suggerisce ai connazionali ivi PRESENTI A QUALSIASI TITOLO di adottare
 *    particolari cautele evitando assembramenti, manifestazioni e viaggi non essenziali..." --
 *    "presenti a qualsiasi titolo" scopes the advice to whoever is already in Pemba (named two
 *    sentences earlier); the sentence's own verb is "suggerisce... di adottare cautele" (weak
 *    advice), not a ban. The later, unrelated "viaggi non essenziali" a few clauses on is NOT
 *    what "a qualsiasi titolo" modifies -- proximity alone (matching anywhere in the sentence)
 *    would still false-positive here, which is why this checks immediate LEFT adjacency only.
 *  - Guinea: "Ai connazionali PRESENTI A QUALSIASI TITOLO nel Paese consigliamo la massima
 *    prudenza negli spostamenti" -- again "presenti", again the verb is "consigliamo" (we
 *    advise), the opposite of "sconsigliamo" (we advise against).
 * Genuine whole-country bans never put "presente/i" immediately to the left: Afghanistan
 * ("viaggi a qualsiasi titolo"), Syria ("sconsigliati... a qualsiasi titolo"), Somalia ("sia i
 * viaggi, sia la permanenza nel Paese, a qualsiasi titolo"), Mali ("viaggi, a qualsiasi titolo,
 * verso il Mali") all qualify a travel/stay NOUN directly, never "presente/i" -- verified on all
 * four live dossiers 2026-09-26.
 */
function hasBanningQualsiasiTitolo(sentence: string): boolean {
  if (!/a qualsiasi titolo/.test(sentence)) return false;
  if (/present\w*\s+a qualsiasi titolo/.test(sentence)) return false;
  return true;
}

/**
 * Strip parenthetical asides before pattern matching. Farnesina's prose sometimes tucks a
 * remark about a DIFFERENT country into a parenthetical inside the current country's own
 * dossier (mentioned only for cross-border context) -- that remark must never be read as
 * describing the page's own country. Verified 2026-09-26: Mauritania's dossier reads
 * "Eventuali trasferimenti via terra con il Mali (che resta, comunque, una destinazione
 * SCONSIGLIATA A QUALSIASI TITOLO) potrebbero avvenire solo attraverso il territorio
 * senegalese" -- the level-4 ban in that parenthetical is MALI's, not Mauritania's own. None of
 * the verified genuine whole-country trigger phrases (Afghanistan, Syria, Ukraine, Somalia,
 * Mali, Burkina Faso, CAR, Niger, Haiti, North Korea -- all checked live 2026-09-26) sit inside
 * a parenthetical, so this has no effect on them.
 */
function stripParentheticals(sentence: string): string {
  return sentence.replace(/\([^)]*\)/g, ' ');
}

/**
 * Farnesina's "increased caution" idiom family ("massima prudenza/cautela/attenzione/vigilanza",
 * "particolare/elevata/alta attenzione|prudenza|cautela", "alto livello di attenzione") -- ONLY
 * counts as a Level 2 signal when the SAME sentence also says it is about MOVEMENT
 * ("spostamenti"), never bare. Added 2026-09-26 after Guinea's own dossier was found resolving
 * to Level 1 with no Level 2 signal at all: "Ai connazionali presenti a qualsiasi titolo nel
 * Paese consigliamo la MASSIMA PRUDENZA NEGLI SPOSTAMENTI, e costante monitoraggio... per
 * allerte su eventuali blocchi della circolazione o manifestazioni in corso" -- following a
 * paragraph about protests degenerating into stray-bullet/stone-throwing violence in the
 * capital. That is a genuine, elevated-caution statement Level 2 should catch.
 *
 * Requiring "spostamenti" in the same sentence is load-bearing, not optional: measured against
 * all 223 published dossiers, this exact vocabulary used BARE (with no movement qualifier) is
 * Farnesina's default big-city PETTY-CRIME boilerplate ("prestare la massima prudenza" against
 * pickpockets in Copenhagen, "particolare attenzione" against bag-snatchers in Vienna/Lisbon/
 * Amsterdam) and appears in 66/223 dossiers, including 9 of the 13 countries this file's own
 * calibration explicitly requires to stay Level 1 (France, Germany, the UK, Greece, the
 * Netherlands, Portugal, Spain, the USA, Belgium) -- an ungated match on the bare phrase family
 * would have wrongly promoted all of them to Level 2. Gating on "spostamenti" (movement/travel,
 * as opposed to "keep an eye on your belongings") narrows this to Farnesina's OTHER, distinct
 * use of the same words for a movement-specific caution tied to unrest or a security incident --
 * verified zero false positives against the 13-country calibration set, and only 2 unrelated
 * Level 1 flips across all 223 dossiers (Dominican Republic: kidnapping-for-ransom and two
 * Italian nationals murdered, cited in the same dossier; Uganda: rebel-group incursions across
 * the DR Congo border), both independently defensible as real Level 2 concerns on their own
 * text, not by-products of an over-broad pattern.
 */
const IT_MOVEMENT_CAUTION_WORDS =
  /massima (prudenza|cautela|attenzione|vigilanza)|particolare (attenzione|prudenza|cautela)|(elevata|alta) (attenzione|prudenza|cautela)|alto livello di attenzione/;

function hasMovementCaution(sentence: string): boolean {
  return IT_MOVEMENT_CAUTION_WORDS.test(sentence) && /\bspostament\w*/.test(sentence);
}

/**
 * Normalize Italy (Viaggiare Sicuri) advisory text to unified 1-4 scale.
 *
 * Farnesina has no single "level" field in its per-country dossier (confirmed against the SPA's own JSON API,
 * `/schede_paese/{ISO3}.json` -- see fetchItAdvisories). The assessment is prose split across two sections:
 * `Indicazioni-generali` (the whole-country assessment) and `Aree-di-particolare-cautela` (named sub-national or
 * cross-border danger zones -- occasionally including a *whole-country* statement too, e.g. Yemen's "in tutto il
 * Paese" sits inside this section). Both are required and scanned sentence-by-sentence so a zone-scoped warning
 * (e.g. "sconsigliati i viaggi in Sinaloa") can never out-rank a whole-country one.
 *
 * Calibrated 2026-09-25 against ~45 countries' live dossiers (AFG, SYR, UKR, MLI, NER, SOM, HTI, YEM -> 4;
 * LBN, PAK, VEN, LBY, PRK, RUS, NGA, IRN, COD, ETH -> 3; EGY, THA, MEX, KEN, TUR, COL, IND, PHL, IDN, CHN, BRA,
 * ISR, PSE -> 2; FRA, JPN, USA, DEU, GBR, CHE, AUT, PRT, NLD, BEL, GRC, ESP, LKA -> 1):
 *  - Level 4 ("a qualsiasi titolo" / "non recarsi" / "in qualunque zona del Paese" / "viaggi ... in tutto il
 *    Paese"): tight, self-contained patterns -- deliberately NOT "assolutamente sconsigliato" alone or generic
 *    "tutto il Paese" co-occurrence, both of which false-positived in calibration (Nigeria's "condizioni di
 *    sicurezza in tutto il Paese" describes the SITUATION, not the ban's scope; Israel's "a qualsiasi titolo"
 *    ban is Gaza-only, folded into Israel's own page).
 *  - Level 3 (whole-country "non essenziali/non indispensabili", or "sconsigliati, se non per ragioni di
 *    necessità/lavoro"): read only from `Indicazioni-generali`, and only from sentences that don't name a
 *    sub-national qualifier -- Nigeria's *general* sentence says "non indispensabile" even though a later,
 *    separately-scoped sentence escalates to "assolutamente" for "alcuni stati"; that escalation must NOT
 *    promote Nigeria to 4.
 *  - Level 2 (named danger zone with an avoid-verb, general text otherwise clean): read from
 *    `Aree-di-particolare-cautela`, or from an `Indicazioni-generali` sentence that itself named a sub-national
 *    qualifier. Plain vigilance tips ("prestare attenzione ai borseggi", ESP's Madrid pickpocket note) do NOT
 *    count -- only sentences with an explicit avoidance verb (sconsiglia/evitare/non recarsi/interdetto) do.
 *  - Level 1: no avoidance verb anywhere, but only when the dossier is substantive (not a stub/empty fetch).
 *
 * Returns null when both sections are empty/too short to be a real dossier (fetch got a stub, or Farnesina
 * doesn't publish one for this ISO3) -- per project rule, "no data" must never be reported as "level 1".
 *
 * Repaired 2026-09-26 (regional-promotion audit): three more false-4s survived the 2026-09-25 calibration
 * above, each needing its own guard (see the doc comments on IT_REGIONAL_STEM_MARKERS,
 * hasBanningQualsiasiTitolo and stripParentheticals for the live evidence): Armenia/Georgia/Moldova/Oman/
 * Cameroon's border-and-separatist-region wording (IT_REGIONAL_STEM_MARKERS, added to isSubNational),
 * Mozambique/Guinea's "connazionali presenti a qualsiasi titolo" idiom (hasBanningQualsiasiTitolo, replaces
 * the old bare `/a qualsiasi titolo/` pattern), and Mauritania's parenthetical aside about Mali
 * (stripParentheticals, applied to every sentence before any pattern check below).
 *
 * Repaired again 2026-09-26 (same day, follow-up review): fixing the qualsiasi-titolo idiom above
 * revealed Guinea had NO remaining Level 2/3/4 signal at all, landing on the Level 1 fallback despite a
 * real "massima prudenza negli spostamenti" caution following a stray-bullet protest-violence paragraph
 * -- see hasMovementCaution's doc comment for that fix and why it is gated on "spostamenti" co-occurrence.
 *
 * Also considered, per review, REPLACING the Level 1 fallback below with an "affirmed calm only" rule
 * (mirroring SK_CALM_PATTERNS/normalizeBeLevel/normalizeChAssessment) that would return null instead of 1
 * for a dossier with no negative signal AND no explicit calm phrase. Measured against all 223 dossiers,
 * even a generous calm-phrase set (non si segnala/registra/presenta particolari criticità and its
 * subjunctive/inserted-clause variants, "Paese sicuro", "situazione stabile/buona", "criminalità bassa",
 * "normali precauzioni", "nessuna controindicazione") is present in only 44/128 (34%) of today's Level 1
 * dossiers -- and MISSES 9 of this file's own 13-country calibration set (France, Germany, the UK, Greece,
 * the Netherlands, Portugal, Spain, the USA, Belgium), each of which simply describes routine petty crime
 * with no summary catchphrase at all (Germany's whole dossier: "Il livello di sicurezza nel Paese permane
 * elevato, sebbene... si assista ad un sensibile aumento di borseggi e di furti" -- no fixed idiom this
 * source repeats reliably). Unlike SK (whose Level 1 default asserted "no contraindications" for
 * countries the source had simply not written an assessment for yet) or BE/CH (similarly gapped feeds),
 * Farnesina's dossier is comprehensive and descriptive by default: the absence of an avoidance verb in a
 * substantive, feed-per-country dossier IS the source's own "nothing to report" signal, not a parsing
 * gap. Adopting an affirmed-only rule would have dropped roughly two-thirds of today's genuinely-calm
 * countries to no-data -- far above what a >=10% loss threshold would tolerate -- so the fallback stays.
 */
export function normalizeItLevel(generalTextRaw: string, areaTextRaw: string): UnifiedLevel | null {
  const general = normalizeAdvisoryText(generalTextRaw);
  const area = normalizeAdvisoryText(areaTextRaw);
  if (general.length + area.length < 40) return null;

  // "a qualsiasi titolo" is handled separately (hasBanningQualsiasiTitolo) since it needs more than a bare
  // substring test -- see that function's doc comment.
  const LEVEL4_PATTERNS = [
    /\bnon recarsi\b/,
    /qualunque zona del paese/,
    /viagg\w*\s+(a\s+|in\s+)+tutto\s+il\s+(paese|territorio)/,
    /preclusa la possibilit[aà] di recarsi/,
  ];
  const LEVEL3_PATTERNS =
    /non essenzial|non indispensabil|quelli indispensabili|evitare\s+(i\s+)?viaggi|posticipare.*viagg|rinviare.*viagg|rimandare.*viagg|limitare i viaggi|sconsigli/;
  const LEVEL2_PATTERNS = /sconsigli|evitare\s+(i\s+)?viaggi|evitare di recarsi|non recarsi|interdett/;

  const isSubNational = (sentence: string) =>
    IT_SUBNATIONAL_MARKERS.some((m) => sentence.includes(m)) || IT_REGIONAL_STEM_MARKERS.test(sentence);

  const tagged = [
    ...splitIntoSentences(general).map((s) => ({ s, section: 'general' as const })),
    ...splitIntoSentences(area).map((s) => ({ s, section: 'area' as const })),
  ];

  let sawLevel4 = false;
  let sawLevel3 = false;
  let sawLevel2 = false;

  for (const { s: rawSentence, section } of tagged) {
    // Strip parenthetical asides first (Mauritania/Mali case) -- everything below reads the
    // cleaned sentence, so a foreign country's ban tucked into a "(...)" aside can never be
    // misread as this country's own.
    const s = stripParentheticals(rawSentence);
    const subNational = isSubNational(s);

    if (!subNational && (hasBanningQualsiasiTitolo(s) || LEVEL4_PATTERNS.some((re) => re.test(s)))) {
      sawLevel4 = true;
      continue;
    }
    if (section === 'general' && !subNational && LEVEL3_PATTERNS.test(s)) {
      sawLevel3 = true;
      continue;
    }
    if (LEVEL2_PATTERNS.test(s) || hasMovementCaution(s)) sawLevel2 = true;
  }

  if (sawLevel4) return 4;
  if (sawLevel3) return 3;
  if (sawLevel2) return 2;
  return 1;
}

/** Named-subdivision and time-of-day qualifiers that cap a sentence at level 2 (mirrors IT_SUBNATIONAL_MARKERS;
 *  "de noche"/"nocturno" excludes activity-scoped tips like "avoid inter-city road travel at night", which is
 *  not a "leave the country" signal even when it uses the same "se desaconseja" verb).
 *
 * Broadened 2026-09-26 (regional-promotion audit) with `\bzonas?\b` and `\bregi[oó]n(es)?\b` -- generic NOUN
 * stems, mirroring IT_REGIONAL_STEM_MARKERS's `\bregion[ei]\b` fix and the SAME false-friend it had to dodge:
 * "región de"/"zona(s) fronteriza(s)" etc. already in this list only matched FIXED multi-word phrases and missed
 * real sub-national wording on the live 2026-09-26 corpus --
 *  - Azerbaijan: the heading "ZONAS A LAS QUE SE RECOMIENDA NO VIAJAR" (introducing a list of named districts)
 *    has no period before the paragraph that follows it (a DOM-concatenation glue exactly like the CAF case
 *    normalizeAdvisoryText already patches, just with no punctuation at all to hook a fix onto this time) -- the
 *    bare NOUN "zonas" in the heading itself is what a generic stem needs to catch, since the specific wording of
 *    whichever paragraph it glues to varies.
 *  - Nepal: "se desaconseja viajar a LA ZONA del siniestro (Rasuwa, Gorkha...)" -- anaphoric "la zona" (not
 *    "dicha/alguna/determinada zona", the only determiners the old list recognized).
 *  - Algeria: "se recomienda NO viajar A LA ZONA" (the Tindouf Sahrawi refugee camps, named earlier in the same
 *    sentence) -- same anaphoric "la zona" gap.
 *  - Togo: "son zonas de riesgo muy alto (se recomienda no viajar) las zonas de las Triples Fronteras..." --
 *    neither "zonas de riesgo" nor "Triples Fronteras" is "zona(s) fronteriza(s)" or "frontera con".
 *  `\bregi[oó]n(es)?\b` is the noun form ONLY (no adjective suffix) for the exact reason IT_REGIONAL_STEM_MARKERS
 *  dropped "regionale": Iran's own genuine whole-country trigger ("ante el CONTEXTO DE CONFLICTO REGIONAL, se
 *  desaconseja completamente viajar a Irán") uses "regional" as an adjective for the wider Middle East's
 *  geopolitical climate, not a sub-region of Iran itself -- a bare `region\w*` stem would wrongly block it
 *  (verified against the existing Iran fixture below, which must stay Level 4).
 * Cameroon needed one more, non-generic addition: "se desaconseja viajar a la PENÍNSULA de Bakassi" names a
 * specific peninsula, a word neither stem covers. */
const ES_ZONE_MARKERS =
  /determinadas? zonas?|ciertas zonas|algunas zonas|algunas regiones|zonas? fronteriza(s)?|fronter\w* con|franja fronteriza|dicho territorio|dicha zona|dicha isla|lugares remotos|viajes? de aventura|provincia de|región de|condado de|estado de|departamento de|distrito de|de noche|por la noche|nocturno|\bzonas?\b|\bregi[oó]n(es)?\b|pen[ií]nsula/;
const ES_EXCEPTION_MARKER = /\b(salvo|excepto)\b/;

/**
 * Normalize Spain (Exteriores) advisory text to unified 1-4 scale.
 *
 * Spain has no numeric level either, but -- unlike Italy -- publishes a consistent per-country "Notas
 * importantes" banner sentence on each country's detail page (`Detalle-recomendaciones-de-viaje.aspx?trc=<pais>`,
 * found by inspecting the page: the homepage's country-index modals only carry this banner for the single most
 * severe case at a time, e.g. Ucrania; every other country's real assessment lives on its own detail page --
 * see fetchEsAdvisories). That banner is graduated prose, not a fixed enum, so it needs the same sentence-level
 * reading as Italy's.
 *
 * Calibrated 2026-09-25 against ~45 countries' live "Notas importantes" (Corea del Norte, Haití, Irán, Israel,
 * Líbano, Mali, Palestina, Somalia, Sudán, Ucrania, Yemen, República Centroafricana -> 4; Etiopía, Libia, México,
 * Myanmar, Nigeria, Pakistán, RD Congo, Ruanda, Rusia, Siria, Sudáfrica, Venezuela, Arabia Saudí, Bahréin, Catar,
 * Emiratos Árabes Unidos, Jordania, Kuwait, Omán -> 3; Bielorrusia, Brasil, China, Colombia, Egipto, Filipinas,
 * India, Indonesia, Kenia, Marruecos, Perú, Sri Lanka, Tailandia, Turquía, Vietnam -> 2; Alemania, Argentina,
 * Chile, Corea, Estados Unidos, Italia, Japón -> 1):
 *  - "NO HAY RESTRICCIONES ESPECÍFICAS" is Spain's own explicit all-clear and wins outright, even when a narrow
 *    logistical aside follows it in the same notice (Corea still flags its DMZ as off-limits).
 *  - Level 4 ("bajo cualquier/ninguna circunstancia", "desaconseja ... completamente/totalmente/encarecidamente",
 *    plain "se desaconseja el viaje/viajar" or "recomienda no viajar") requires the trigger sentence to be
 *    neither zone-scoped (ES_ZONE_MARKERS) nor carry a same-sentence "salvo/excepto" exception -- both
 *    false-positived in calibration: Kenya's Lamu-county and Egypt's "viajes de aventura a lugares remotos" are
 *    scoped, not whole-country; Libya's and Nigeria's "salvo caso de necesidad" is conditional, i.e. level 3.
 *    Repair 2026-09-25: the Central African Republic's banner ("SE DESACONSEJA EL VIAJE BAJO CUALQUIER
 *    CIRCUNSTANCIA...") was silently landing on level 1 in production -- not a wording gap but a text-extraction
 *    one, fixed in normalizeAdvisoryText() above (see its own comment): the banner sentence was glued, with no
 *    separator, to the next paragraph, and an unrelated "de noche" curfew aside three sentences further into that
 *    merged blob was zone-scoping the WHOLE thing via ES_ZONE_MARKERS.
 *  - Level 3: "extremar/extrema/mucha precaución" (Spain's own intensified-caution wording, distinct from the
 *    bare "precaución" used for level 2), "no esencial", "valorar no viajar", the level-4 verbs
 *    ("desaconseja"/"recomienda no viajar") downgraded by their own "salvo/excepto" clause, or "aconseja aplazar
 *    (su) viaje" (Spain's "postpone your trip" banner, verified 2026-09-25 on all 7 Gulf/Middle-East states in
 *    the current "conflicto de alcance regional" cluster -- Arabia Saudí, Bahréin, Catar, EAU, Jordania, Kuwait,
 *    Omán -- as a distinct, weaker tier below "se desaconseja": it recommends citizens already there leave only
 *    "si lo desean" (conditionally), never orders it, and confirmed absent from calibrated level-1/2 neighbours
 *    Marruecos, Rusia, Turquía).
 *  - Level 2: the bare "viajar con precaución" banner (no intensifier), or an explicit zone/border warning.
 *
 * Returns null when no "Notas importantes" section was found at all (fetch failure / page shape changed), AND
 * when a substantive notice was found but none of the above patterns fired. The latter used to fall back to
 * level 1 (a comprehensive-source assumption -- Spain publishes one page per country, so "nothing matched" read
 * as "nothing to report"), but Cuba's page disproved that: 2026-09-25's live notice is ~1700 characters
 * describing a genuine hardship (island-wide blackouts, fuel shortage, shuttered hotels, daily protests) using
 * none of Spain's fixed severity verbs (no "aconseja"/"desaconseja" anywhere) -- proof that an unmatched notice
 * can be a real, substantive advisory Spain simply didn't phrase in the vocabulary this parser looks for, not an
 * all-clear. Per project rule (SOURCE-REPAIR-BRIEF), an unrecognized banner must emit nothing, never guess 1.
 */
export function normalizeEsLevel(notasTextRaw: string): UnifiedLevel | null {
  const notas = normalizeAdvisoryText(notasTextRaw);
  if (notas.length < 20) return null;

  if (/no hay restricciones espec[ií]ficas/.test(notas)) return 1;

  const LEVEL4_PATTERNS = [
    /bajo (cualquier|ninguna) circunstancia/,
    /desaconseja\w*.{0,25}completamente/, /completamente.{0,25}desaconseja/,
    /desaconseja\w*.{0,25}totalmente/, /totalmente.{0,25}desaconseja/,
    /desaconseja\w*.{0,25}encarecidamente/, /encarecidamente.{0,25}desaconseja/,
    /\bse desaconseja (el viaje|viajar)\b/,
    /\brecomienda\s+no\s+viajar\b/,
  ];
  // "NO se desaconseja ..." (it is NOT discouraged) is the literal negation of the LEVEL4_PATTERNS
  // "desaconseja" family above -- without this guard, Azerbaijan's own hedge about Caspian Sea
  // ferries ("los barcos... por lo que, SI BIEN NO SE DESACONSEJA TOTALMENTE su uso por
  // pasajeros, hay que tener presente que los viajes no son predecibles...") -- reassurance that
  // FERRIES aren't discouraged, not a country-wide ban -- matched `desaconseja\w*.{0,25}totalmente`
  // by ignoring its own "no se" prefix and produced a false Level 4. Verified 2026-09-26 this is
  // the only "no se desaconseja" occurrence anywhere in the calibration corpus.
  const NEGATED_DESACONSEJA = /\bno\s+se\s+desaconseja\b/;
  // A sentence using either level-4 verb, downgraded by its own "salvo/excepto" clause, is level 3.
  const LEVEL3_EXCEPTION_VERB = /desaconseja|recomienda\s+no\s+viajar/;
  // "Extremar/mucha precaución" is Spain's own whole-country Level 3 intensifier (Ethiopia:
  // "SE RECOMIENDA VIAJAR CON MUCHA PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS" --
  // deliberately NOT gated on ES_ZONE_MARKERS like the Level 4 checks above: that "zonas" clause
  // is a SEPARATE, additional caveat, not what "mucha precaución" itself is scoped to; the banner
  // as a whole is Spain's overall country assessment). Checked per SENTENCE (not the whole
  // notice) only to exclude a health/hygiene use of the same words -- Togo's page reads "se
  // recomienda EXTREMAR LA PRECAUCIÓN y adoptar medidas de HIGIENE, lavarse frecuentemente las
  // manos..." in its own Sanidad section, about disease prevention, not a security assessment;
  // ES_HEALTH_CONTEXT excludes just that sentence.
  const PRECAUCION_INTENSITY_PATTERNS = [
    /extremar\w*.{0,15}precauci[oó]n/, /precauci[oó]n\w*.{0,15}extrem/,
    /\bextrema\s+precauci[oó]n/, /\bmucha\s+precauci[oó]n/,
  ];
  const ES_HEALTH_CONTEXT = /higiene|lavarse|vacun\w*|enfermedad|malaria|c[oó]lera|dengue|fiebre amarilla/;
  const LEVEL3_PATTERNS = [
    /no esencial/,
    /valorar no viajar/, /valor[eo]n?\s+.{0,25}no viajar/,
    // Spain's "postpone your trip" banner -- see calibration note above. "su" is optional: Bahréin and
    // Kuwait's pages omit it ("SE ACONSEJA APLAZAR SU VIAJE A BAHRÉIN" still has it; kept here anyway
    // for the rare page that might not). Checked against the whole notice, not per-sentence, since the
    // banner always names the country directly (never a "zona") -- no ES_ZONE_MARKERS guard needed.
    /aconseja\w*\s+aplazar\w*\s+(su\s+)?viaje/,
  ];
  const LEVEL2_PATTERNS = [
    /viajar\s+con\s+(\w+\s+)?precauci[oó]n/,
    /abstenerse.{0,20}zona/,
    /evitar.{0,20}zona/,
    /\bzona(s)? fronteriza(s)?\b/,
  ];

  let sawLevel4 = false;
  let sawLevel3 = false;

  for (const s of splitIntoSentences(notas)) {
    const zoneScoped = ES_ZONE_MARKERS.test(s);
    const hasException = ES_EXCEPTION_MARKER.test(s);
    const negated = NEGATED_DESACONSEJA.test(s);

    if (!zoneScoped && !hasException && !negated && LEVEL4_PATTERNS.some((re) => re.test(s))) {
      sawLevel4 = true;
      continue;
    }
    // Same zone guard as the Level 4 branch above: a "desaconseja/recomienda no viajar ...
    // salvo/excepto ..." sentence that ALSO names a zone/region (Togo's Savanes region, "es
    // zona de riesgo alto (se recomienda no viajar salvo razon imperiosa) la region de
    // Savanes...") is a conditional REGIONAL warning, not a whole-country one downgraded by its
    // own exception clause -- must stay capped at whatever LEVEL2_PATTERNS finds, not jump to 3.
    if (!zoneScoped && hasException && LEVEL3_EXCEPTION_VERB.test(s)) sawLevel3 = true;
  }

  const hasSecurityPrecautionIntensity = splitIntoSentences(notas).some(
    (s) => !ES_HEALTH_CONTEXT.test(s) && PRECAUCION_INTENSITY_PATTERNS.some((re) => re.test(s)),
  );

  if (sawLevel4) return 4;
  if (sawLevel3) return 3;
  if (hasSecurityPrecautionIntensity || LEVEL3_PATTERNS.some((re) => re.test(notas))) return 3;
  if (LEVEL2_PATTERNS.some((re) => re.test(notas))) return 2;
  // A substantive notice that matched none of the above is Cuba's case (see calibration note): a real
  // advisory Spain didn't phrase with any of its fixed severity verbs, not an all-clear. Emit nothing
  // rather than guess -- the caller (fetchEsAdvisories) already skips a null and reports no ES level.
  return null;
}

/**
 * Normalize South Korea (MOFA) numeric level to unified 1-4 scale.
 * Korea uses a 4-level system (1-4) that maps directly.
 */
export function normalizeKrLevel(level: number): UnifiedLevel {
  return Math.min(4, Math.max(1, Math.round(level))) as UnifiedLevel;
}

/**
 * Normalize Taiwan (BOCA) color/text advisory to unified 1-4 scale.
 * Taiwan uses color codes: red (紅色), orange (橙色), yellow (黃色), gray (灰色).
 */
export function normalizeTwLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('紅色') || lower.includes('red')) return 4;
  if (lower.includes('橙色') || lower.includes('orange')) return 3;
  if (lower.includes('黃色') || lower.includes('yellow')) return 2;
  // 灰色 / gray / default -> normal precautions
  return 1;
}

/**
 * Normalize China (MFA) advisory text to unified 1-4 scale.
 * Chinese text patterns: "暂勿前往" (do not travel), "谨慎前往" (proceed with caution), etc.
 */
export function normalizeCnLevel(text: string): UnifiedLevel {
  if (text.includes('暂勿前往')) return 4;
  if (text.includes('谨慎前往')) return 3;
  if (text.includes('注意安全')) return 2;
  return 1;
}

/**
 * Normalize India (MEA) English advisory text to unified 1-4 scale.
 * English text patterns: "do not travel", "avoid", "caution", etc.
 *
 * Returns null (no fallback to 1) when none of those phrases matched. mea.gov.in's page is a news-style
 * bulletin, not a comprehensive one-row-per-country dossier (see project rule: a "no advisory" reading
 * is only valid from a source that positively asserts a baseline for every country, e.g. ES's "no hay
 * restricciones especificas"). Found 2026-09-25: the fetcher's broad `a, h2, h3, h4, .list-title, td, li`
 * selector also grabs the page's own nav-menu text blocks, which coincidentally contain "travel" and a
 * country's name (India's own site mentions "India" constantly) but none of these level keywords --
 * the old `return 1` fallback was quietly turning that menu noise into fabricated "no advisory" entries
 * for India and Malaysia.
 */
export function normalizeInLevel(text: string): UnifiedLevel | null {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('leave immediately')) return 4;
  if (lower.includes('avoid') || lower.includes('defer') || lower.includes('reconsider')) return 3;
  if (lower.includes('caution') || lower.includes('exercise')) return 2;
  return null;
}

// --- Tier 3b normalization functions ---

/**
 * Normalize Switzerland (EDA) advisory data from the site's own "reisehinweise"
 * JSON API (see fetchChAdvisories in advisories-tier3b.ts) to unified 1-4 scale.
 *
 * Audit 2026-09-25 found eda.admin.ch rebuilt as a Nuxt SSR site with no
 * server-rendered advisory text at all on the listing page it used to scrape.
 * Repaired 2026-09-26 (SOURCE-REPAIR-BRIEF.md): a Playwright network capture
 * of a country's real "Reisehinweise für X" page found the app calls a JSON
 * API (`cb-api-gateway.scs.scs-sdweb.ch/eda-prod/reisehinweise`) that also
 * has a bulk, cursor-paginated collection endpoint — no per-country requests,
 * no browser needed in production. That API exposes a structured
 * `advice_against` enum, far more reliable than matching free German prose:
 *
 *   - 'general'  -> 4. Whole-country "Von Reisen ... wird abgeraten".
 *   - 'tourists' -> 3. Literally "Von touristischen und ... nicht dringenden
 *      Reisen ... wird abgeraten" — our own level-3 definition verbatim.
 *   - 'regional' -> 2, unconditionally. A sub-national warning; per this
 *      project's rule that partial/regional warnings must never promote a
 *      whole country above 2 (mirrors the DE/NL guards elsewhere), it is
 *      capped regardless of how the regional text itself reads.
 *   - 'none' is NOT reliably "safe" on its own. Checked live 2026-09-26: North
 *     Korea, South Africa, Zimbabwe, Algeria and 26 others also get 'none',
 *     but their "Grundsätzliche Einschätzung" (basic assessment) text
 *     describes real elevated-caution conditions (crime spikes, states of
 *     emergency, armed unrest — "[grosse/erhöhte/höchste] Aufmerksamkeit ist
 *     der persönlichen Sicherheit zu schenken") with no safety claim at all.
 *     The FDFA's own fixed phrase for a genuinely calm country — "Reisen
 *     nach/in X gelten/gilt grundsätzlich als sicher" — is present in 74 of
 *     104 'none' countries checked and absent from all 30 elevated-caution
 *     ones, with no false positive either way. Only that exact phrase earns
 *     level 1; everything else gets 2 — never a guessed 1 (repair brief
 *     rule 1: "a parser NEVER falls back to level 1").
 *
 * `hasTravelAdvice=false` ("Für diese Destination veröffentlicht das EDA
 * keine spezifischen Reisehinweise" — 20 micro-states: Andorra, San Marino,
 * Vatican, Nauru...) is the source's own "no specific advisory published"
 * case: rule 1 again, not a safety statement, so this returns null regardless
 * of `adviceAgainst`.
 */
export function normalizeChAssessment(params: {
  adviceAgainst: string;
  hasTravelAdvice: boolean;
  assessmentText: string;
}): UnifiedLevel | null {
  if (!params.hasTravelAdvice) return null;

  switch (params.adviceAgainst) {
    case 'general':
      return 4;
    case 'tourists':
      return 3;
    case 'regional':
      return 2;
    case 'none': {
      const lower = params.assessmentText
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue');
      const affirmedSafe =
        lower.includes('gelten grundsaetzlich als sicher') || lower.includes('gilt grundsaetzlich als sicher');
      return affirmedSafe ? 1 : 2;
    }
    default:
      // Unrecognised enum value (API change) -- don't guess.
      return null;
  }
}

/**
 * Normalize Sweden (UD) Swedish advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 */
export function normalizeSeLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('avråder alla resor') || lower.includes('avraader alla resor') || lower.includes('alla resor avrads')) return 4;
  if (lower.includes('avråder resor') || lower.includes('avraader resor') || lower.includes('ud avråder') || lower.includes('ud avraader')) return 3;
  if (lower.includes('iaktta stor försiktighet') || lower.includes('iaktta stor forsiktighet') || lower.includes('skärpt uppmaning') || lower.includes('skaerpt uppmaning')) return 2;
  return 1;
}

/**
 * Normalize Norway (UD) Norwegian advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 */
export function normalizeNoLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('fraråder alle reiser') || lower.includes('fraraader alle reiser') || lower.includes('ikke reis')) return 4;
  if (lower.includes('fraråder reiser') || lower.includes('fraraader reiser') || lower.includes('ikke-nødvendige reiser') || lower.includes('ikke-noedvendige reiser')) return 3;
  if (lower.includes('utvise forsiktighet') || lower.includes('økt aktsomhet') || lower.includes('oekt aktsomhet')) return 2;
  return 1;
}

/**
 * Normalize Poland (MSZ) Polish advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 */
export function normalizePlLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('nie planuj podróży') || lower.includes('nie planuj podrozy') || lower.includes('zakaz wjazdu')) return 4;
  if (lower.includes('odradza się podróżowanie') || lower.includes('odradza sie podrozowanie') || lower.includes('odradza podróże') || lower.includes('odradza podroze')) return 3;
  if (lower.includes('zachowaj szczególną ostrożność') || lower.includes('zachowaj szczegolna ostroznosc') || lower.includes('zachowaj ostrożność') || lower.includes('zachowaj ostroznosc')) return 2;
  return 1;
}

// MZV (Czech MFA) has no explicit level badge on its per-country "cestovani"
// pages -- a country either has an "Aktuální doporučení a varování" section
// (linking to a free-form warning article) or it doesn't, and the article
// itself is narrative prose. Same approach as normalizePtLevel: classify
// clause-by-clause, and only let a clause drive the COUNTRY-WIDE level when
// it carries no regional qualifier (oblast, hranice/příhraniční, pásmo,
// provincie, okres, "některých států" ...) -- MZV routinely names the worst
// sub-regions explicitly (e.g. Pákistán's Afghan/Indian border areas and
// Balúčistán) while giving the rest of the country a lower, separate rating,
// and a border-zone warning must not promote the whole country past level 2.
const CZ_REGIONAL_SCOPE =
  /oblast|hranic|pásm|provinci|okres|někter[éý]ch stát|měst|část/;

const CZ_STRONG_UNSCOPED =
  /nedoporučujeme cestovat|necestujte|varování před cestami do země|varování před cestami na celé území|opusťte zemi|opustit zemi/;

const CZ_AVOID_NON_ESSENTIAL =
  /zvažit nezbytnost cesty|doporučujeme se vyhnout|(jen|pouze) ve? (zcela )?nezbytn/;

const CZ_CAUTION =
  /zvýšen[áé] opatrnost|zvýšené riziko|bezpečnostní riziko|zesílená ostražitost/;

/**
 * Normalize Czech Republic (MZV) advisory narrative text to unified 1-4
 * scale. Returns null only when there is no real text to classify (empty
 * fetch) -- a country whose "cestovani" page loaded fine but has no
 * "Aktuální doporučení a varování" section is a valid level-1 baseline (MZV
 * publishes one comprehensive page per country, so the section's absence
 * IS the "nothing to flag" statement), and free-form warning prose that
 * matches none of the keywords below (e.g. a hurricane-season notice with
 * no explicit caution language) also resolves to level 1 rather than being
 * dropped, consistent with the other MZV-style sources in this file.
 */
export function normalizeCzLevel(text: string): UnifiedLevel | null {
  if (!text || text.trim().length < 10) return null;
  const lower = text.toLowerCase();
  const clauses = lower.split(/(?<=[.;!?])\s+|\n+/);

  let saw4 = false;
  let saw3 = false;
  let sawScoped = false;
  let sawCaution = false;

  for (const clause of clauses) {
    if (!clause.trim()) continue;
    const regional = CZ_REGIONAL_SCOPE.test(clause);
    const strong = CZ_STRONG_UNSCOPED.test(clause);
    const nonEssential = CZ_AVOID_NON_ESSENTIAL.test(clause);

    if (strong && !regional) {
      saw4 = true;
    } else if (nonEssential && !regional) {
      saw3 = true;
    } else if (strong || nonEssential || regional) {
      sawScoped = true; // regional-only warning -- never promotes past level 2
    }

    if (CZ_CAUTION.test(clause)) sawCaution = true;
  }

  if (saw4) return 4;
  if (saw3) return 3;
  if (sawScoped || sawCaution) return 2;
  return 1;
}

/**
 * Normalize Hungary (KKM, "Konzinfo" portal) security-classification BADGE
 * text (the "field--name-field-security-classification" taxonomy field) to
 * unified 1-4 scale, for the case where that badge names exactly ONE of
 * KKM's four fixed terms:
 *   "Biztonságos ország / térség"                                  -> 1
 *   "Fokozott óvatossággal látogatható ország"                     -> 2
 *   "Kiemelt biztonsági kockázatot rejtő ország/térségekkel"        -> 3
 *   "Nem javasolt úti cél"                                          -> 4
 * Callers should go through resolveHuAdvisoryLevel below, not call this
 * directly: it is only safe when the badge tags a SINGLE tier (see that
 * function's doc comment for why a badge combining two or more of these
 * terms cannot be read with a simple priority match).
 */
export function normalizeHuLevel(text: string): UnifiedLevel | null {
  if (!text || !text.trim()) return null;
  const lower = text.toLowerCase();
  if (lower.startsWith('nem javasolt')) return 4;
  if (lower.includes('kiemelt biztonsági kockázat')) return 3;
  if (lower.includes('fokozott óvatossággal')) return 2;
  if (lower.includes('biztonságos')) return 1;
  return null;
}

/**
 * KKM's fixed vocabulary for each of its 4 numbered ("I"-"IV") security
 * tiers, used by huBadgeTierCount and normalizeHuSecurityBlocks below to
 * detect which tier(s) a piece of text refers to. LEVEL4's pattern requires
 * "nem javasolt" (not recommended) to co-occur, within the same clause, with
 * a travel/destination word -- a bare "nem javasolt" is ALSO KKM's stock
 * phrase for unrelated behavioural tips ("...mozgás...egyáltalán nem
 * javasolt" [Benin], "...felszállás nem javasolt" [Italy], "...felkeresése
 * nem javasolt" [Egypt] -- all verified live 2026-09-26) that must never be
 * read as a security-tier verdict.
 */
const HU_LEVEL4_PHRASE =
  /(?:utaz\w*|úti\s*cél\w*|célország\w*)[^.!?]{0,30}nem javasolt|nem javasolt[^.!?]{0,30}(?:utaz\w*|úti\s*cél\w*|célország\w*)/i;
const HU_LEVEL3_PHRASE = /kiemelt biztonsági kockázat/i;
const HU_LEVEL2_PHRASE = /fokozott óvatossággal látogatható/i;
const HU_LEVEL1_PHRASE = /\bbiztonságos\b/i;

/** First (highest-severity) of the 4 HU_LEVELn_PHRASE patterns matching `text`, or null. */
function huPhraseLevel(text: string): UnifiedLevel | null {
  if (HU_LEVEL4_PHRASE.test(text)) return 4;
  if (HU_LEVEL3_PHRASE.test(text)) return 3;
  if (HU_LEVEL2_PHRASE.test(text)) return 2;
  if (HU_LEVEL1_PHRASE.test(text)) return 1;
  return null;
}

/**
 * Phrases KKM uses to mark a security tier as the COUNTRY-WIDE baseline --
 * "whatever hasn't been named above / isn't one of the listed areas" -- as
 * opposed to a named sub-region. Verified live 2026-09-26 across Benin and
 * Cameroon ("<Country> további részei"), Kenya ("az ország egyéb részei"),
 * Tajikistan ("a fent nem említett országrészek"), Colombia ("a felsorolt
 * területeken kívül <Country>"), Egypt ("az alább fel nem sorolt
 * területek") and Thailand ("az ország további részei").
 */
const HU_RESIDUAL_MARKER =
  /további rész\w*|egyéb rész\w*|nem említett országrész\w*|felsorolt terület\w*\s+kívül|fel nem sorolt terület\w*|nem sorolt terület\w*/i;

/**
 * Does `block` OPEN a "<N>. biztonsági kategória" section heading (Benin/
 * Cameroon's template)? Checked separately from huPhraseLevel so that a
 * roman numeral appearing mid-sentence elsewhere (Kenya/Tajikistan/Colombia
 * all cite "I."/"II." well into a descriptive sentence, not as a heading)
 * never overwrites the tracked heading level.
 */
function huHeadingLevel(block: string): UnifiedLevel | null {
  if (/^I\.\s/.test(block)) return 4;
  if (/^II\.[\s-]/.test(block)) return 3;
  if (/^III\.\s/.test(block)) return 2;
  if (/^IV[.\-]/.test(block)) return 1;
  return null;
}

/**
 * Split one DOM block into sentences, so that a single `<p>` combining TWO
 * clauses -- one naming a region's own tier, the other the residual "rest of
 * the country" tier -- doesn't let huPhraseLevel's priority scan see both
 * phrases at once and pick the wrong (higher-severity) one. Real example
 * (Kenya, verified live 2026-09-26, one `<p>`): "...Laikipia régióit a II.
 * kiemelt biztonsági kockázatot rejtő... térségek kategóriába helyezte...
 * miatt. Az ország egyéb részei a III-as, fokozott óvatossággal látogatható
 * térségek közé tartozik." -- without splitting, the residual sentence's own
 * "fokozott óvatossággal" would be masked by the EARLIER clause's "kiemelt
 * biztonsági kockázat" and wrongly resolve to 3 instead of 2.
 *
 * A bare period-then-space split would itself mis-fire on KKM's constant
 * mid-sentence citations of "I."/"II."/"III."/"IV." (Kenya's own "a II.
 * kiemelt..." above; Tajikistan's "a II. (narancssárga)..."; Colombia's "a
 * III. fokozott..."), severing the numeral from the very phrase that names
 * its tier. Fixed by re-merging any split that left a fragment ending in a
 * BARE roman numeral + period back onto the next fragment -- verified this
 * correctly restores Kenya/Tajikistan/Colombia/Benin/Cameroon's real
 * sentences whole while still separating Kenya's two genuine clauses apart.
 */
function huSplitSentences(block: string): string[] {
  const naive = block.split(/(?<=[.!?])\s+/);
  const merged: string[] = [];
  for (const piece of naive) {
    const last = merged.length - 1;
    if (last >= 0 && /\b(?:I|II|III|IV)\.$/.test(merged[last])) {
      merged[last] = `${merged[last]} ${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged.map((s) => s.trim()).filter(Boolean);
}

/**
 * Count how many of KKM's 4 fixed tiers the (short) classification badge
 * text tags. Exactly one -- the common case -- means the country has no
 * other tier anywhere on its own page (verified 2026-09-26: Guinea-Bissau,
 * Djibouti, Malawi, USA, Australia, France, Italy, Mexico, Afghanistan,
 * Syria, Ukraine all tag a single term): normalizeHuLevel can be trusted
 * directly, no need to open the body text. Two or more means the badge is a
 * Drupal multi-value tag -- KKM tags a country with EVERY tier that applies
 * ANYWHERE in it, worst first -- and the true country-wide baseline needs
 * normalizeHuSecurityBlocks to find which tagged tier is the "rest of the
 * country" one.
 */
function huBadgeTierCount(badge: string): number {
  return [HU_LEVEL4_PHRASE, HU_LEVEL3_PHRASE, HU_LEVEL2_PHRASE, HU_LEVEL1_PHRASE].filter((re) => re.test(badge))
    .length;
}

/**
 * Resolve KKM's country-wide baseline level from the FULL "Biztonság"
 * section body (paragraphs + list items, in DOM order) when the
 * classification badge alone is ambiguous (2+ tagged tiers, see
 * huBadgeTierCount) -- repair 2026-09-26 (PARSER-REGIONAL-BRIEF). Audit
 * finding: the OLD normalizeHuLevel, applied to the badge alone with a
 * strongest-match-first priority, read a country's WORST regional tier as
 * if it were the whole country's -- e.g. Cameroon's badge, "Nem javasolt úti
 * cél, kiemelt biztonsági kockázatot rejtő és fokozott óvatossággal
 * látogatható térséggel", combines all THREE tiers that appear somewhere on
 * its page (a level-4 strip on the Nigeria/Chad/CAR border and the
 * Anglophone regions, a level-3 approach strip, and level 2 "Kamerun
 * további részei" -- Cameroon's OWN words for "the rest of Cameroon") into
 * one badge with no way to tell which is the baseline -- but the page's own
 * prose always names exactly one.
 *
 * Walks blocks in order, tracking the most recently opened "<N>. biztonsági
 * kategória" heading, and returns as soon as it finds KKM's own "rest of the
 * country" marker (HU_RESIDUAL_MARKER). That marker's OWN sentence states
 * the level directly in most templates -- Kenya: "Az ország egyéb részei a
 * III-as, fokozott óvatossággal látogatható térségek közé tartozik.";
 * Tajikistan: "...a fent nem említett országrészek a II. ... kiemelt
 * biztonsági kockázatot rejtő... térségek"; Colombia: "A felsorolt
 * területeken kívül Kolumbia a III. fokozott óvatossággal látogatható
 * országok közé tartozik."; Egypt: "az alább fel nem sorolt területek
 * biztonsági besorolása a III. kategória: 'fokozott óvatossággal látogatható
 * területek'." -- while Benin and Cameroon instead put the marker in its own
 * bullet with no level phrase of its own ("Benin/Kamerun további részei -
 * minden olyan rész, amely nem került felsorolásra a[z] ... kategóriában."),
 * right under the heading it belongs to, so the tracked heading level is the
 * fallback there.
 *
 * Never returns null: this is only called once the badge has already proven
 * the country has real regional variation, so "no explicit marker found"
 * (not observed in the live 2026-09-26 corpus, but kept as a safety net)
 * still means real, un-pinpointed regional risk exists -- capped at 2,
 * mirroring the DE/NL/BE/FR/CH/AT "partial warning never promotes past
 * increased caution" rule elsewhere in this file, never guessed up to the
 * worst tagged tier.
 */
export function normalizeHuSecurityBlocks(blocks: string[]): UnifiedLevel {
  let headingLevel: UnifiedLevel | null = null;
  for (const raw of blocks) {
    for (const sentence of huSplitSentences(raw)) {
      const heading = huHeadingLevel(sentence);
      if (heading !== null) headingLevel = heading;

      if (HU_RESIDUAL_MARKER.test(sentence)) {
        return huPhraseLevel(sentence) ?? headingLevel ?? 2;
      }
    }
  }
  return 2;
}

/**
 * Top-level entry point for KKM (Hungary): resolve a country's whole-country
 * advisory level from its classification badge and, when needed, its full
 * "Biztonság" section body. See huBadgeTierCount and normalizeHuSecurityBlocks
 * for why a 2+-tier badge cannot be read with normalizeHuLevel alone.
 */
export function resolveHuAdvisoryLevel(classification: string, bodyBlocks: string[]): UnifiedLevel | null {
  if (!classification || !classification.trim()) return null;
  if (huBadgeTierCount(classification) <= 1) return normalizeHuLevel(classification);
  return normalizeHuSecurityBlocks(bodyBlocks);
}

// Portugal (MNE) has no explicit level badge on its per-country advisory
// pages (portaldascomunidades.mne.gov.pt, redesigned since the previous
// audit) -- each page is free-form prose, so the unified level has to be
// inferred sentence-by-sentence. A statement only counts as a COUNTRY-WIDE
// signal when its own clause carries no regional qualifier (zona, região,
// fronteira, "estado do/da <place>", bairro, ...): this is the same
// "a partial/regional warning must not promote the whole country" guard used
// for DE/NL elsewhere in this codebase, just applied at clause granularity
// because MNE mixes country-wide and region-only warnings in the same
// paragraph (e.g. Egypt: baseline "no advisory against travel" + a Sinai/
// Gaza-border-only "totally advised against"). Verified against 17 real
// pages (AFG/SYR/UKR/MEX/JPN/FRA/ITA/USA/EGY/THA + DEU/RUS/BRA/HTI/VEN/YEM/
// somalia) during the 2026-09-25 source repair.
const PT_REGIONAL_SCOPE =
  /zona|regi[aã]o|regi[oõ]es|fronteir|prov[íi]ncia|distrito|estado d[oa]\b|norte d|sul d|leste d|oeste d|[aá]rea|cidade d|ilha d|litoral|interior d|faixa d|bairro/;

// "não existe um desaconselhamento..." explicitly says NO advisory applies --
// must not be read as one just because the word "desaconselh" appears.
const PT_NEGATED = /não existe|não h[aá] |sem desaconselhamento|não se desaconselha|não [eé] desaconselh/;

// Personal-safety-tip boilerplate ("don't flash valuables", "avoid certain
// neighbourhoods at night", "hire a car with driver rather than self-drive")
// appears on almost every country's page, including very safe ones -- it's
// about individual behaviour, not a country-level travel recommendation.
const PT_PERSONAL_SAFETY_TIP =
  /deslocações? noturnas|durante a noite|à noite|de noite|estar na rua|andar (a pé|sozinho)|sair (sozinho|à noite)|objetos de valor|transportes? públicos?|carteiristas|a partir de que horas|bairros que suscitam|condução (própria|de veículo)|conduzir|aluguer de viatura|condutor/;

const PT_STRONG_UNSCOPED =
  /não viaje em nenhuma circunstância|evite viajar para|saia (do país|imediatamente)|abandone o país imediatamente/;

const PT_AVOID_NON_ESSENTIAL =
  /viagens? não essenciais|deslocações? não essenciais|(viagem|deslocação|entrada no país) (está|fica|encontra-se)?\s*condicionada/;

// MNE alternates between "desaconselhar" and "evitar" for the same kind of
// advisory ("evitadas deslocações à Rússia" == "desaconselhadas..."). Only
// count "evitar" when its object is travel itself -- bare "evitar" is also
// used for generic tips ("evite andar sozinho"), which must not drive the
// level.
const PT_ADVISE_AGAINST =
  /desaconselh|evit(ar|e|ada|adas|ado|ados)\s+(quaisquer\s+|todas as\s+)?(deslocações|viagens)/;

const PT_CAUTION =
  /precaução|vigilância acrescida|cautela redobrada|risco elevado de|risco acrescido de|elevada (incidência|taxa) de criminalidade|situação de (instabilidade|insegurança)|forte presença (militar|policial)/;

/**
 * Normalize Portugal (MNE) advisory narrative text to unified 1-4 scale.
 * Returns null when the page carries no advisory content at all (unreachable/
 * empty fetch) -- per the "never fall back to level 1" rule, that must drop
 * the country rather than publish a fabricated "normal precautions". A page
 * that loaded fine but genuinely has no warning language IS a valid level-1
 * baseline: MNE publishes one comprehensive page per country, so silence is
 * itself the "no specific advisory" statement.
 */
export function normalizePtLevel(text: string): UnifiedLevel | null {
  if (!text || text.trim().length < 20) return null;
  const lower = text.toLowerCase();
  const clauses = lower.split(/(?<=[.;!?])\s+|\n+/);

  let saw4 = false;
  let saw3 = false;
  let sawScoped = false;
  let sawCaution = false;

  for (const clause of clauses) {
    if (!clause.trim() || PT_NEGATED.test(clause) || PT_PERSONAL_SAFETY_TIP.test(clause)) continue;

    const regional = PT_REGIONAL_SCOPE.test(clause);
    const adviseAgainst = PT_ADVISE_AGAINST.test(clause);
    const nonEssential = PT_AVOID_NON_ESSENTIAL.test(clause);
    const strong = PT_STRONG_UNSCOPED.test(clause);

    if (strong && !regional) {
      saw4 = true;
    } else if (adviseAgainst && !regional) {
      if (nonEssential) saw3 = true;
      else saw4 = true;
    } else if (adviseAgainst || (nonEssential && regional)) {
      sawScoped = true; // regional-only warning -- never promotes past level 2
    }

    if (PT_CAUTION.test(clause)) sawCaution = true;
  }

  if (saw4) return 4;
  if (saw3) return 3;
  if (sawScoped || sawCaution) return 2;
  return 1;
}
