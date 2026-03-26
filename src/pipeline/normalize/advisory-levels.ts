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
  if (flags.partialWarning) return 3;
  if (flags.situationWarning || flags.situationPartWarning) return 2;
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
 * Normalize France (diplomatie.gouv.fr) color codes to unified 1-4 scale.
 * French advisory colors: vert (green), jaune (yellow), orange, rouge (red).
 * Also matches descriptive text variants.
 */
export function normalizeFrColor(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('rouge') || lower.includes('formellement deconseill')) return 4;
  if (lower.includes('orange') || (lower.includes('deconseill') && !lower.includes('formellement'))) return 3;
  if (lower.includes('jaune') || lower.includes('vigilance renforcee') || lower.includes('vigilance renforcée')) return 2;
  return 1; // vert / vigilance normale
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
  if (lower.includes('caution') || lower.includes('high degree')) return 2;
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
 */
export function normalizeBeLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('ne pas voyager') || lower.includes('quitter le pays')) return 4;
  if (lower.includes('déconseillé') || lower.includes('deconseille') || lower.includes('éviter') || lower.includes('eviter')) return 3;
  if (lower.includes('prudence') || lower.includes('vigilance') || lower.includes('attention')) return 2;
  return 1;
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

/**
 * Normalize Italy (Viaggiare Sicuri) advisory text to unified 1-4 scale.
 * Italian text patterns: "non recarsi", "sconsigliato", "cautela", etc.
 */
export function normalizeItLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('non recarsi') || lower.includes('sconsigliato')) return 4;
  if (lower.includes('sconsigliati i viaggi') || lower.includes('evitare')) return 3;
  if (lower.includes('cautela') || lower.includes('attenzione') || lower.includes('particolare prudenza')) return 2;
  return 1;
}

/**
 * Normalize Spain (Exteriores) advisory text to unified 1-4 scale.
 * Spanish text patterns: "se desaconseja todo viaje", "precaucion", etc.
 */
export function normalizeEsLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('se desaconseja todo viaje') || lower.includes('no viajar')) return 4;
  if (lower.includes('se desaconseja') || lower.includes('evitar')) return 3;
  if (lower.includes('precaucion') || lower.includes('prudencia')) return 2;
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
