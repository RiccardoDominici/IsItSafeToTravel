/**
 * The one formatter for /10 values (overall score and pillar values) inside country-page prose:
 * meta description, top summary and FAQ.
 *
 * WHY a helper that does almost nothing yet: every surface printed `x.toFixed(1)` on its own, so the
 * planned site-wide pass that localises decimal separators (2026-10-15 audit, owner decision) would
 * have to find each call. It changes this function only. The bars, the hero and the title use the
 * same one-decimal rounding, so the number in the text always equals the number on the bar.
 */
import type { Lang } from '../i18n/ui';

/** A value already on the /10 scale, one decimal: 4.39 -> "4.4" (convert a 0-1 pillar with x * 10 first). */
export function formatTenths(value10: number, _lang: Lang): string {
  return value10.toFixed(1);
}
