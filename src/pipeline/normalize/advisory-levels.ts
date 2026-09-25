/**
 * Shared normalization module for mapping diverse advisory level systems
 * to the unified 1-4 scale used by the scoring engine.
 *
 * Supports: Germany (boolean flags), Netherlands (color codes),
 * Japan (1-4 numeric), Slovakia (text-based stupen), and a generic
 * N-level mapper for future sources.
 */

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
 * No alert = level 1.
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

/**
 * Normalize Belgium (diplomatie.belgium.be) French advisory text to unified 1-4 scale.
 * Returns null when no advisory keyword is present: the country pages are JS-rendered, so
 * fetched HTML often carries no advisory text at all — defaulting to 1 published a false
 * "Pas de restrictions" for every country (including level-4 ones like Syria or Yemen).
 */
export function normalizeBeLevel(text: string): UnifiedLevel | null {
  const lower = text.toLowerCase();
  if (lower.includes('ne pas voyager') || lower.includes('quitter le pays')) return 4;
  if (lower.includes('déconseillé') || lower.includes('deconseille') || lower.includes('éviter') || lower.includes('eviter')) return 3;
  if (lower.includes('prudence') || lower.includes('vigilance') || lower.includes('attention')) return 2;
  return null;
}

/**
 * Normalize Denmark (um.dk) Danish advisory text to unified 1-4 scale.
 */
export function normalizeDkLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('frarådes alle rejser') || lower.includes('fraraades alle') || lower.includes('forlad landet')) return 4;
  if (lower.includes('frarådes') || lower.includes('fraraades') || lower.includes('undgå') || lower.includes('undgaa')) return 3;
  if (lower.includes('skærpet') || lower.includes('skaerpet') || lower.includes('opmærksom') || lower.includes('opmaerksom') || lower.includes('vær forsigtig')) return 2;
  return 1;
}

/**
 * Normalize Singapore (mfa.gov.sg) English advisory text to unified 1-4 scale.
 */
export function normalizeSgLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('leave immediately') || lower.includes('defer all travel')) return 4;
  if (lower.includes('travel advisory') || lower.includes('avoid') || lower.includes('reconsider') || lower.includes('defer')) return 3;
  if (lower.includes('travel notice') || lower.includes('caution') || lower.includes('increased')) return 2;
  return 1;
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
 * Normalize Serbia (mfa.gov.rs) English advisory text to unified 1-4 scale.
 */
export function normalizeRsLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('extremely high') || lower.includes('leave immediately')) return 4;
  if (lower.includes('avoid') || lower.includes('high level') || lower.includes('reconsider')) return 3;
  if (lower.includes('increased') || lower.includes('caution') || lower.includes('elevated')) return 2;
  return 1;
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
 */
export function normalizeChLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('von reisen wird abgeraten') || lower.includes('grundsätzlich abgeraten') || lower.includes('grundsaetzlich abgeraten') || lower.includes('do not travel')) return 4;
  if (lower.includes('von nicht dringenden reisen') || lower.includes('nicht dringenden reisen wird abgeraten') || lower.includes('avoid non-essential')) return 3;
  if (lower.includes('erhöhte vorsicht') || lower.includes('erhoehte vorsicht') || lower.includes('increased caution')) return 2;
  return 1;
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
