/**
 * Marker label and caption for a formula change on a score history chart (formula v10, SPEC §6:
 * "the trend chart marks the v10 date"). Shared by the country trend chart (TrendChart.astro) and
 * the global trend chart (GlobalSafetyPage.astro): past snapshots stay on the formula they were
 * computed with, so a jump on the switch day is the method changing, not the country or the world.
 */
import type { Lang } from './ui';
import type { FormulaChange } from '../lib/scores';

const COPY: Record<Lang, { marker: string; note: string }> = {
  en: { marker: 'Formula v{v}', note: 'The dashed line marks {date}, when the score moved to formula v{v}; earlier points were computed with the previous formula.' },
  it: { marker: 'Formula v{v}', note: 'La linea tratteggiata indica il {date}, quando il punteggio è passato alla formula v{v}; i valori precedenti sono stati calcolati con la formula precedente.' },
  es: { marker: 'Fórmula v{v}', note: 'La línea discontinua marca el {date}, cuando la puntuación pasó a la fórmula v{v}; los valores anteriores se calcularon con la fórmula anterior.' },
  fr: { marker: 'Formule v{v}', note: 'La ligne pointillée marque le {date}, date du passage du score à la formule v{v} ; les valeurs antérieures ont été calculées avec la formule précédente.' },
  pt: { marker: 'Fórmula v{v}', note: 'A linha tracejada marca {date}, quando a pontuação passou para a fórmula v{v}; os valores anteriores foram calculados com a fórmula anterior.' },
  zh: { marker: '公式 v{v}', note: '虚线标出{date}，即评分改用公式 v{v} 的日期；此前的数值按旧公式计算。' },
  de: { marker: 'Formel v{v}', note: 'Die gestrichelte Linie markiert den {date}, an dem die Bewertung auf Formel v{v} umgestellt wurde; frühere Werte wurden mit der vorherigen Formel berechnet.' },
};

const DATE_LOCALE: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

/** Marker label ("Formula v10") and caption for a chart, or empty strings without a change. */
export function formulaChangeTexts(lang: Lang, change: FormulaChange | null): { marker: string; note: string } {
  if (!change) return { marker: '', note: '' };
  const date = new Date(`${change.date}T00:00:00Z`).toLocaleDateString(DATE_LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return {
    marker: COPY[lang].marker.replace('{v}', change.version),
    note: COPY[lang].note.replaceAll('{v}', change.version).replace('{date}', date),
  };
}

/** True when the switch date falls strictly inside the plotted history (worth a caption). */
export function formulaChangeInRange(change: FormulaChange | null, dates: readonly string[]): boolean {
  return change !== null && dates.length >= 2 && dates[0] < change.date && dates[dates.length - 1] >= change.date;
}
