/**
 * Human-readable labels for the raw scoring-engine indicator keys shown in the
 * per-pillar indicator tables (PillarBreakdown.astro, PillarDetailTable.astro).
 *
 * WHY reuse `methodology.indicator.*` instead of a fresh translation table:
 * ui.ts already carries a complete, verified 7-language label for every one of
 * the engine's 18 indicator keys (weights.json's 17 named indicators + the
 * synthetic advisory-consensus indicator "A"), built for the /methodology/
 * page's own indicator table. The pillar tables were rendering the raw key
 * instead ("wb air pollution", "vdem rule of law" — 2026-09-25 audit, C8)
 * purely because nothing pointed them at that existing table. Writing a
 * second, independent translation of the same 18×7 labels here would
 * reproduce exactly the kind of duplicated-source-of-truth drift that audit
 * round's `findings/inconsistencies.md` flags repeatedly (I1-I3, I12) — so
 * this module is a thin, well-documented lookup, not a new copy of the data.
 *
 * `getIndicatorLabel` falls back to a prettified key for any indicator name
 * the engine emits that isn't (yet) in `methodology.indicator.*` — e.g. a
 * newly-added indicator that hasn't had its methodology label written yet —
 * so a table cell never regresses to a raw snake_case key.
 */
import type { TranslationKey } from './utils';

/** `t()`-shaped function, i.e. the return value of useTranslations(lang). */
type TFunction = (key: TranslationKey) => string;

/** "wb_air_pollution" -> "Wb air pollution" (used only when no methodology
 *  label exists yet for a given indicator key). */
function prettifyIndicatorKey(name: string): string {
  const spaced = name.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function getIndicatorLabel(indicatorName: string, t: TFunction): string {
  const translated = t(`methodology.indicator.${indicatorName}` as TranslationKey);
  return translated || prettifyIndicatorKey(indicatorName);
}
