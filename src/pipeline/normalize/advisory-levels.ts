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
