/**
 * Marker labels and caption for the formula changes on a score history chart (formula v10, SPEC §6:
 * "the trend chart marks the v10 date"; v10.1 followed two days later, so a chart can hold several).
 * Shared by the country trend chart (TrendChart.astro) and the global trend chart
 * (GlobalSafetyPage.astro): past snapshots stay on the formula they were computed with, so a jump on
 * a switch day is the method changing, not the country or the world.
 */
import type { Lang } from './ui';
import type { FormulaChange } from '../lib/scores';

interface FormulaChangeCopy {
  marker: string;
  /** Caption when one change falls inside the plotted history. */
  note: string;
  /** Caption when several do: {list} is the joined `item`s. */
  notes: string;
  item: string;
  separator: string;
}

const COPY: Record<Lang, FormulaChangeCopy> = {
  en: {
    marker: 'Formula v{v}',
    note: 'The dashed line marks {date}, when the score moved to formula v{v}; earlier points were computed with the previous formula.',
    notes: 'The dashed lines mark the formula changes ({list}); points before each line were computed with the previous formula.',
    item: 'v{v} on {date}',
    separator: '; ',
  },
  it: {
    marker: 'Formula v{v}',
    note: 'La linea tratteggiata indica il {date}, quando il punteggio è passato alla formula v{v}; i valori precedenti sono stati calcolati con la formula precedente.',
    notes: 'Le linee tratteggiate indicano i cambi di formula ({list}); i valori prima di ogni linea sono stati calcolati con la formula precedente.',
    item: 'v{v} il {date}',
    separator: '; ',
  },
  es: {
    marker: 'Fórmula v{v}',
    note: 'La línea discontinua marca el {date}, cuando la puntuación pasó a la fórmula v{v}; los valores anteriores se calcularon con la fórmula anterior.',
    notes: 'Las líneas discontinuas marcan los cambios de fórmula ({list}); los valores anteriores a cada línea se calcularon con la fórmula anterior.',
    item: 'v{v} el {date}',
    separator: '; ',
  },
  fr: {
    marker: 'Formule v{v}',
    note: 'La ligne pointillée marque le {date}, date du passage du score à la formule v{v} ; les valeurs antérieures ont été calculées avec la formule précédente.',
    notes: 'Les lignes pointillées marquent les changements de formule ({list}) ; les valeurs antérieures à chaque ligne ont été calculées avec la formule précédente.',
    item: 'v{v} le {date}',
    separator: ' ; ',
  },
  pt: {
    marker: 'Fórmula v{v}',
    note: 'A linha tracejada marca {date}, quando a pontuação passou para a fórmula v{v}; os valores anteriores foram calculados com a fórmula anterior.',
    notes: 'As linhas tracejadas marcam as mudanças de fórmula ({list}); os valores anteriores a cada linha foram calculados com a fórmula anterior.',
    item: 'v{v} em {date}',
    separator: '; ',
  },
  zh: {
    marker: '公式 v{v}',
    note: '虚线标出{date}，即评分改用公式 v{v} 的日期；此前的数值按旧公式计算。',
    notes: '虚线标出公式变更（{list}）；每条虚线之前的数值按旧公式计算。',
    item: '{date}改用 v{v}',
    separator: '；',
  },
  de: {
    marker: 'Formel v{v}',
    note: 'Die gestrichelte Linie markiert den {date}, an dem die Bewertung auf Formel v{v} umgestellt wurde; frühere Werte wurden mit der vorherigen Formel berechnet.',
    notes: 'Die gestrichelten Linien markieren die Formelwechsel ({list}); Werte vor jeder Linie wurden mit der vorherigen Formel berechnet.',
    item: 'v{v} am {date}',
    separator: '; ',
  },
};

const DATE_LOCALE: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

function longDate(lang: Lang, isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(DATE_LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** One chart marker per formula change ("Formula v10", "Formula v10.1"); the chart script keeps those in its range. */
export function formulaChangeMarkers(lang: Lang, changes: readonly FormulaChange[]): Array<{ date: string; label: string }> {
  return changes.map((c) => ({ date: c.date, label: COPY[lang].marker.replace('{v}', c.version) }));
}

/** Caption for the formula changes inside a plotted history ('' when there is none). */
export function formulaChangeNote(lang: Lang, changesInRange: readonly FormulaChange[]): string {
  const c = COPY[lang];
  if (changesInRange.length === 0) return '';
  if (changesInRange.length === 1) {
    const only = changesInRange[0];
    return c.note.replaceAll('{v}', only.version).replace('{date}', longDate(lang, only.date));
  }
  const list = changesInRange
    .map((ch) => c.item.replace('{v}', ch.version).replace('{date}', longDate(lang, ch.date)))
    .join(c.separator);
  return c.notes.replace('{list}', list);
}

/** The changes whose date falls strictly inside the plotted history (a line at the first point says nothing). */
export function formulaChangesInRange(changes: readonly FormulaChange[], dates: readonly string[]): FormulaChange[] {
  if (dates.length < 2) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  return changes.filter((c) => first < c.date && last >= c.date);
}
