/**
 * Dashed formula-change markers for the score history charts: the country trend chart
 * (TrendChart.astro) and the global chart (GlobalSafetyPage.astro). Runs in the browser, because
 * both charts redraw on every range change and the markers must use the same x scale as the line.
 *
 * Several changes can sit a few days apart (v10 on 2026-10-15, v10.1 on 2026-10-17): each one gets
 * its own dashed line, and a label that would print over the previous one moves a line down.
 * The markers come from formulaChangeMarkers (src/i18n/formula-change-copy.ts) as a JSON
 * data attribute on the chart container.
 */
export interface ChartFormulaMarker {
  date: string;
  label: string;
}

/** Horizontal room one label needs before the next one can sit on the same line (px). */
const LABEL_GAP = 90;
const LABEL_LINE_HEIGHT = 13;

/** Markers from the container's data-formula-markers attribute; [] when absent or unreadable. */
export function parseFormulaMarkers(raw: string | undefined): ChartFormulaMarker[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChartFormulaMarker => typeof m?.date === 'string' && typeof m?.label === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * SVG for the markers strictly after the first plotted date and up to the last one: a line at the
 * first point would separate nothing. Labels sit right of the line, or left of it near the right
 * edge; a label closer than LABEL_GAP to the previous label goes one line lower.
 */
export function formulaMarkersSvg(
  markers: readonly ChartFormulaMarker[],
  firstDate: Date,
  lastDate: Date,
  xScale: (d: Date) => number,
  innerWidth: number,
  innerHeight: number,
): string {
  let svg = '';
  let previousX: number | null = null;
  let row = 0;
  const sorted = [...markers].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    const d = new Date(`${m.date}T00:00:00Z`);
    if (!(d > firstDate && d <= lastDate)) continue;
    const x = xScale(d);
    row = previousX !== null && Math.abs(x - previousX) < LABEL_GAP ? row + 1 : 0;
    previousX = x;
    const nearRight = x > innerWidth - LABEL_GAP;
    const y = 11 + row * LABEL_LINE_HEIGHT;
    svg +=
      `<line x1="${x}" x2="${x}" y1="0" y2="${innerHeight}" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.55" />` +
      `<text x="${nearRight ? x - 4 : x + 4}" y="${y}" text-anchor="${nearRight ? 'end' : 'start'}" font-size="11" class="fill-sand-600 dark:fill-sand-400">${m.label}</text>`;
  }
  return svg;
}
