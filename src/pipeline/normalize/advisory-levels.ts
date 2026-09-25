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

/**
 * Normalize Slovakia (MZV) text-based "stupen" advisory to unified 1-4 scale.
 * Parses patterns like "2. stupen" from Slovak advisory text.
 */
export function normalizeSkLevel(text: string): UnifiedLevel {
  if (!text || !text.trim()) return 1;
  const match = text.match(/(\d)\.\s*stupen/i);
  if (match) {
    const digit = parseInt(match[1], 10);
    return Math.min(4, Math.max(1, digit)) as UnifiedLevel;
  }
  return 1;
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
 *      territoire/pays", "le reste du territoire", "le territoire <adjectif> est ...")
 *      within ~120 chars of a level keyword -> that exact level.
 *   2. No whole-country phrase, but the page names at least one elevated zone (red/orange)
 *      -> level 2 (increased caution only, never higher -- the province/border-strip cap).
 *   3. Section present, no elevated keyword anywhere -> level 1. France's own published
 *      colour legend (see diplomatie.gouv.fr "Que signifient les couleurs des cartes...")
 *      treats unflagged territory as green/"vigilance normale" by default, so this is
 *      reading the source's own stated default, not guessing on a parse failure.
 *   4. The "Zones de vigilance" marker is missing entirely (different template, fetch
 *      problem, or a fiche this source doesn't publish) -> null, emit nothing for it.
 */
export function extractFrTerritoryLevel(rawText: string): UnifiedLevel | null {
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

  const LEVEL_KEYWORDS: [RegExp, UnifiedLevel][] = [
    [/formellement deconseill|classe[e]? en zone rouge/, 4],
    [/deconseille[a-z]{0,2} sauf raison imperative/, 3],
    [/vigilance renforcee/, 2],
    [/vigilance normale/, 1],
  ];

  // Deliberately specific so a named province/city can never satisfy this on its own.
  const wholeCountryRe = /(la totalite|lintegralite|lensemble) du (territoire|pays)|reste du (territoire|pays)|le territoire [a-z-]+ est/g;

  let subjectMatch: RegExpExecArray | null;
  while ((subjectMatch = wholeCountryRe.exec(section)) !== null) {
    const windowStart = Math.max(0, subjectMatch.index - 120);
    const windowEnd = Math.min(section.length, subjectMatch.index + subjectMatch[0].length + 120);
    const window = section.slice(windowStart, windowEnd);
    for (const [re, level] of LEVEL_KEYWORDS) {
      if (re.test(window)) return level;
    }
  }

  // No whole-country statement: a named zone is still flagged somewhere in the section,
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
 * classes — the OTA listing page includes generic "info-" pages for
 * countries HK hasn't assessed at all, so "not in the red/amber set" is NOT
 * evidence of "normal precautions" and must not be mapped here (audit
 * 2026-09-25: the fetcher used to default unclassified countries to 1,
 * asserting "no alert" for Afghanistan, Iraq, Sudan, Ukraine...).
 */
export function normalizeHkAlert(alert: string): UnifiedLevel {
  const lower = alert.toLowerCase();
  if (lower.includes('black')) return 4;
  if (lower.includes('red')) return 3;
  if (lower.includes('amber') || lower.includes('yellow')) return 2;
  return 1;
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
 * Levels (unchanged from pass 1, re-verified against Afghanistan/Mali/Syria -> 4;
 * Ukraine/Niger/North Korea/Haiti -> 3-4; Egypt/Turkey/Thailand/Pakistan/Kenya/Mexico
 * regional-only mentions -> capped at 2; Portugal/Italy/Japan -> 1):
 *  - "formellement/fortement/strictement/fermement déconseillé", "ne pas se rendre", "quitter
 *    le pays" -> 4 (whole-country-confirmed) or 2 (not confirmed / regional).
 *  - any other "déconseillé" root, or "reporter tous les voyages" -> 3 or 2, same rule.
 *  - vigilance/prudence/attention qualified by "accrue"/"renforcée"/"particulière"/
 *    "soutenue"/"extrême", or an explicitly elevated crime rate ("criminalité" + "élevé") -> 2
 *    (these never need the whole-country check — 2 is already the cap either way).
 *  - none of the above, but the article has real content -> 1 (this page genuinely is a
 *    comprehensive one-page-per-country baseline, so silence here is itself "normal
 *    precautions" — unlike the old shell-page bug this replaces).
 *
 * Returns null only when there's no real content to classify (empty input, or fewer than 3
 * blocks — a redesigned/broken page) so a fetch failure can never be silently published as
 * "no restrictions".
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
  const TRAVEL_WORDS = ['voyage', 'voyager', 'se rendre', 'deplacement', 'deplacer', 'sejour'];
  const LEVEL4_STRONG = [
    'formellement deconseill', 'fortement deconseill', 'strictement deconseill',
    'fermement deconseill', 'ne pas se rendre', 'quitter le pays',
  ];
  const LEVEL3_WORDS = ['deconseill', 'reporter tous les voyages', 'reporter le voyage'];
  const LEVEL2_BASE = ['vigilance', 'prudence', 'attention'];
  const LEVEL2_INTENSIFIERS = ['accrue', 'accru', 'renforcee', 'particuliere', 'soutenue', 'extreme'];

  let level: UnifiedLevel = 1;

  for (const rawBlock of blocks) {
    // Sentence-level, not block-level: a paragraph mixing a travel verdict with an unrelated
    // safety tip (or a cross-reference to another country) must not let the two cues mix.
    const sentences = rawBlock.split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);

    for (let i = 0; i < sentences.length; i++) {
      const cur = foldFr(sentences[i]);
      const hasTravelWord = TRAVEL_WORDS.some((w) => cur.includes(w));

      let sentenceLevel = 0;
      if (hasTravelWord && LEVEL4_STRONG.some((w) => cur.includes(w))) sentenceLevel = 4;
      else if (hasTravelWord && LEVEL3_WORDS.some((w) => cur.includes(w))) sentenceLevel = 3;
      else if (LEVEL2_BASE.some((base) => cur.includes(base)) && LEVEL2_INTENSIFIERS.some((mod) => cur.includes(mod))) sentenceLevel = 2;
      else if (cur.includes('criminalit') && /elev/.test(cur)) sentenceLevel = 2; // "taux [de criminalité] élevé" in either word order

      if (sentenceLevel === 0) continue;

      if (sentenceLevel > 2) {
        // Whole-country confirmation looks one sentence back too (within the same paragraph):
        // "en Corée du Nord... Tous les voyages sont déconseillés" names the country once and
        // refers back to it implicitly, which is normal French, not a scope expansion.
        const window = foldFr((i > 0 ? sentences[i - 1] + ' ' : '') + sentences[i]);
        const mentionsOtherCountry = BE_OTHER_COUNTRY_NAMES.some((n) => n !== countryFold && window.includes(n));
        const wholeCountryConfirmed = window.includes(countryFold)
          || (!mentionsOtherCountry && WHOLE_COUNTRY_PHRASES.some((p) => window.includes(p)));
        const regionalHit = REGIONAL_WORDS.some((w) => window.includes(w));

        if (!wholeCountryConfirmed || regionalHit) sentenceLevel = 2;
      }

      if (sentenceLevel > level) level = sentenceLevel as UnifiedLevel;
    }
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
 */
export function normalizeRsLevel(sectionText: string): UnifiedLevel | null {
  const lower = sectionText.toLowerCase();
  if (
    lower.includes('do not travel') ||
    lower.includes('extremely high') ||
    lower.includes('leave immediately') ||
    /refrain from (all |any(?: type of)? )?travel/.test(lower)
  ) return 4;
  if (
    lower.includes('not recommended') ||
    lower.includes('not advise') ||
    lower.includes('advised against') ||
    lower.includes('reconsider') ||
    lower.includes('high level')
  ) return 3;
  if (lower.includes('increased') || lower.includes('caution') || lower.includes('elevated')) return 2;
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
 */
export function normalizeItLevel(generalTextRaw: string, areaTextRaw: string): UnifiedLevel | null {
  const general = normalizeAdvisoryText(generalTextRaw);
  const area = normalizeAdvisoryText(areaTextRaw);
  if (general.length + area.length < 40) return null;

  const LEVEL4_PATTERNS = [
    /a qualsiasi titolo/,
    /\bnon recarsi\b/,
    /qualunque zona del paese/,
    /viagg\w*\s+(a\s+|in\s+)+tutto\s+il\s+(paese|territorio)/,
    /preclusa la possibilit[aà] di recarsi/,
  ];
  const LEVEL3_PATTERNS =
    /non essenzial|non indispensabil|quelli indispensabili|evitare\s+(i\s+)?viaggi|posticipare.*viagg|rinviare.*viagg|rimandare.*viagg|limitare i viaggi|sconsigli/;
  const LEVEL2_PATTERNS = /sconsigli|evitare\s+(i\s+)?viaggi|evitare di recarsi|non recarsi|interdett/;

  const isSubNational = (sentence: string) => IT_SUBNATIONAL_MARKERS.some((m) => sentence.includes(m));

  const tagged = [
    ...splitIntoSentences(general).map((s) => ({ s, section: 'general' as const })),
    ...splitIntoSentences(area).map((s) => ({ s, section: 'area' as const })),
  ];

  let sawLevel4 = false;
  let sawLevel3 = false;
  let sawLevel2 = false;

  for (const { s, section } of tagged) {
    const subNational = isSubNational(s);

    if (!subNational && LEVEL4_PATTERNS.some((re) => re.test(s))) {
      sawLevel4 = true;
      continue;
    }
    if (section === 'general' && !subNational && LEVEL3_PATTERNS.test(s)) {
      sawLevel3 = true;
      continue;
    }
    if (LEVEL2_PATTERNS.test(s)) sawLevel2 = true;
  }

  if (sawLevel4) return 4;
  if (sawLevel3) return 3;
  if (sawLevel2) return 2;
  return 1;
}

/** Named-subdivision and time-of-day qualifiers that cap a sentence at level 2 (mirrors IT_SUBNATIONAL_MARKERS;
 *  "de noche"/"nocturno" excludes activity-scoped tips like "avoid inter-city road travel at night", which is
 *  not a "leave the country" signal even when it uses the same "se desaconseja" verb). */
const ES_ZONE_MARKERS =
  /determinadas? zonas?|ciertas zonas|algunas zonas|algunas regiones|zonas? fronteriza(s)?|frontera con|franja fronteriza|dicho territorio|dicha zona|dicha isla|lugares remotos|viajes? de aventura|provincia de|región de|condado de|estado de|departamento de|distrito de|de noche|por la noche|nocturno/;
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
 * Líbano, Mali, Palestina, Somalia, Sudán, Ucrania, Yemen -> 4; Etiopía, Libia, México, Myanmar, Nigeria,
 * Pakistán, RD Congo, Ruanda, Rusia, Siria, Sudáfrica, Venezuela -> 3; Bielorrusia, Brasil, China, Colombia,
 * Egipto, Filipinas, India, Indonesia, Kenia, Marruecos, Perú, Sri Lanka, Tailandia, Turquía, Vietnam -> 2;
 * Alemania, Argentina, Chile, Corea, Estados Unidos, Italia, Japón -> 1):
 *  - "NO HAY RESTRICCIONES ESPECÍFICAS" is Spain's own explicit all-clear and wins outright, even when a narrow
 *    logistical aside follows it in the same notice (Corea still flags its DMZ as off-limits).
 *  - Level 4 ("bajo cualquier/ninguna circunstancia", "desaconseja ... completamente/totalmente/encarecidamente",
 *    plain "se desaconseja el viaje/viajar" or "recomienda no viajar") requires the trigger sentence to be
 *    neither zone-scoped (ES_ZONE_MARKERS) nor carry a same-sentence "salvo/excepto" exception -- both
 *    false-positived in calibration: Kenya's Lamu-county and Egypt's "viajes de aventura a lugares remotos" are
 *    scoped, not whole-country; Libya's and Nigeria's "salvo caso de necesidad" is conditional, i.e. level 3.
 *  - Level 3: "extremar/extrema/mucha precaución" (Spain's own intensified-caution wording, distinct from the
 *    bare "precaución" used for level 2), "no esencial", "valorar no viajar", or exactly the level-4 verbs
 *    ("desaconseja"/"recomienda no viajar") downgraded by their own "salvo/excepto" clause.
 *  - Level 2: the bare "viajar con precaución" banner (no intensifier), or an explicit zone/border warning.
 *
 * Returns null when no "Notas importantes" section was found at all (fetch failure / page shape changed) --
 * never default a missing notice to level 1.
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
  // A sentence using either level-4 verb, downgraded by its own "salvo/excepto" clause, is level 3.
  const LEVEL3_EXCEPTION_VERB = /desaconseja|recomienda\s+no\s+viajar/;
  const LEVEL3_PATTERNS = [
    /extremar\w*.{0,15}precauci[oó]n/, /precauci[oó]n\w*.{0,15}extrem/,
    /\bextrema\s+precauci[oó]n/, /\bmucha\s+precauci[oó]n/,
    /no esencial/,
    /valorar no viajar/, /valor[eo]n?\s+.{0,25}no viajar/,
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

    if (!zoneScoped && !hasException && LEVEL4_PATTERNS.some((re) => re.test(s))) {
      sawLevel4 = true;
      continue;
    }
    if (hasException && LEVEL3_EXCEPTION_VERB.test(s)) sawLevel3 = true;
  }

  if (sawLevel4) return 4;
  if (sawLevel3) return 3;
  if (LEVEL3_PATTERNS.some((re) => re.test(notas))) return 3;
  if (LEVEL2_PATTERNS.some((re) => re.test(notas))) return 2;
  return 1;
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
 */
export function normalizeInLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('leave immediately')) return 4;
  if (lower.includes('avoid') || lower.includes('defer') || lower.includes('reconsider')) return 3;
  if (lower.includes('caution') || lower.includes('exercise')) return 2;
  return 1;
}

// --- Tier 3b normalization functions ---

/**
 * Normalize Switzerland (EDA) German/English advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 *
 * Audit 2026-09-25: eda.admin.ch was rebuilt as a Nuxt/card-grid site (image
 * cards linking to `/en/country-<name>`, no `travel-advice`/`reisehinweise`
 * hrefs anymore) and the real advisory level is loaded client-side, absent
 * from the server-rendered HTML entirely — confirmed live for Afghanistan:
 * neither the country page nor its linked "Travel advice for Afghanistan"
 * page contains any of this function's keywords, or any recognizable level
 * signal at all. The fetcher's old CSS selectors matched nothing, fell back
 * to a generic link scan, and this function's unconditional `return 1`
 * default turned that into a confident (and often wrong — e.g. Afghanistan,
 * Bahrain) "Grundsaetzliche Vorsicht" for every country it happened to find
 * a link for. Returns null instead when no keyword matches; a full fix needs
 * a rewritten fetcher able to read whatever now serves the real content.
 */
export function normalizeChLevel(text: string): UnifiedLevel | null {
  const lower = text.toLowerCase();
  if (lower.includes('von reisen wird abgeraten') || lower.includes('grundsätzlich abgeraten') || lower.includes('grundsaetzlich abgeraten') || lower.includes('do not travel')) return 4;
  if (lower.includes('von nicht dringenden reisen') || lower.includes('nicht dringenden reisen wird abgeraten') || lower.includes('avoid non-essential')) return 3;
  if (lower.includes('erhöhte vorsicht') || lower.includes('erhoehte vorsicht') || lower.includes('increased caution')) return 2;
  return null;
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

/**
 * Normalize Czech Republic (MZV) Czech advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 */
export function normalizeCzLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('nedoporučujeme cestovat') || lower.includes('nedoporucujeme cestovat') || lower.includes('necestujte')) return 4;
  if (lower.includes('zvažit nezbytnost cesty') || lower.includes('zvazit nezbytnost cesty') || lower.includes('doporučujeme se vyhnout') || lower.includes('doporucujeme se vyhnout')) return 3;
  if (lower.includes('zvýšená opatrnost') || lower.includes('zvysena opatrnost') || lower.includes('dbejte zvýšené opatrnosti') || lower.includes('dbejte zvysene opatrnosti')) return 2;
  return 1;
}

/**
 * Normalize Hungary (KKM) Hungarian advisory text to unified 1-4 scale.
 * Includes both diacritical and ASCII-folded variants for resilience.
 */
export function normalizeHuLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('ne utazzon') || lower.includes('utazás nem javasolt') || lower.includes('utazas nem javasolt')) return 4;
  if (lower.includes('fokozott előrelátás') || lower.includes('fokozott elore-latas') || lower.includes('kiemelt figyelemmel')) return 3;
  if (lower.includes('fokozott óvatosság') || lower.includes('fokozott ovatossag') || lower.includes('utazás előtt tájékozódjon') || lower.includes('utazas elott tajekodjon')) return 2;
  return 1;
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
