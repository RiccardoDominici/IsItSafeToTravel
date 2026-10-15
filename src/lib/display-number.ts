/**
 * The one formatter for every number a reader sees on the site: scores ("8,5/10"), pillar values,
 * score changes ("+0,3"), source values ("45,7 homicides", "2.428 deaths") and percentages, on
 * the server (pages, meta, JSON-LD text, emails) and in the browser (map tooltip, compare chart).
 *
 * WHY (2026-10-15 audit, owner decision): every surface printed `x.toFixed(1)` on its own, so the
 * Italian, Spanish, French, Portuguese and German pages showed "8.5" in a title, "8,5" in the
 * methodology prose and a dot again in the indicator table. The rule is now one function:
 *   - decimal separator: comma in it, es, fr, pt, de; dot in en and zh;
 *   - thousands: each locale's own grouping (it "2.428", de "2.428", pt "2.428", fr "2 428" with a
 *     narrow no-break space, en/zh "2,428"; es follows the RAE and groups only from five digits,
 *     "2428" but "24.000"); Italian copy groups every number from 1,000, as its prose does;
 *   - negative numbers use the minus sign U+2212, never a hyphen, and a value that rounds to zero
 *     prints without a sign ("0,0", not "-0,0").
 * Machine-readable output keeps `toFixed` and the dot: JSON-LD numeric fields, data-* attributes,
 * CSV, the JSON endpoints, llms files, the language-neutral SVG badge.
 *
 * Rounding is Intl's (half away from zero on the decimal value: GPI 1.825 -> "1.83"), the same in
 * every locale. Code that needs the displayed value as a number (the band of the printed score,
 * a "pillar above the score" check) uses roundForDisplay, so a label can never sit on the other
 * side of a band edge from the figure printed next to it.
 *
 * Pure module (no Node or data imports): client scripts import it too.
 */
import type { Lang } from '../i18n/ui';

/** BCP 47 locale of each page language, for number formatting. Brazilian Portuguese, like the copy. */
export const NUMBER_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-BR',
  zh: 'zh-CN',
  de: 'de-DE',
};

/**
 * Locales whose CLDR default leaves four-digit numbers ungrouped ("2428") although the same page
 * groups larger ones ("100.000"): Italian copy groups every number from 1,000 (2026-10-15 audit,
 * I53: "2428 persone" next to "100.000 abitanti"). Spanish keeps the RAE rule (no separator for
 * four digits), which its default already follows.
 */
const ALWAYS_GROUP: ReadonlySet<Lang> = new Set<Lang>(['it']);

const MINUS = '−';

/** Intl.NumberFormat is costly to build and a build formats millions of numbers: one per key. */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, decimals: number, grouping: 'locale' | 'always' | 'none'): Intl.NumberFormat {
  const key = `${locale}|${decimals}|${grouping}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    const options: Intl.NumberFormatOptions = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    if (grouping === 'none') options.useGrouping = false;
    // 'always' (ES2023) is not in every TypeScript lib's option type; Node 18+ and current browsers
    // support it, and an older engine reads the string as `true` (the locale's default grouping).
    if (grouping === 'always') (options as { useGrouping?: unknown }).useGrouping = 'always';
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The value as the pages print it, as a number (same rounding as formatNumber): 4.97 -> 5, 1.825 -> 1.83.
 * For decisions that must follow the printed figure (bands, comparisons of displayed values).
 */
export function roundForDisplay(value: number, decimals: number): number {
  return Number(formatterFor('en-US', decimals, 'none').format(value));
}

/**
 * A number in the page language's format with fixed decimals: formatNumber(8.46, 1, 'it') = "8,5",
 * formatNumber(2428, 0, 'de') = "2.428", formatNumber(-3.195, 2, 'fr') = "−3,20".
 */
export function formatNumber(value: number, decimals: number, lang: Lang): string {
  const text = formatterFor(NUMBER_LOCALE[lang] ?? NUMBER_LOCALE.en, decimals, ALWAYS_GROUP.has(lang) ? 'always' : 'locale').format(Math.abs(value));
  // Sign from the value, but only when the printed digits are not all zero ("−0,0" reads as a bug).
  return value < 0 && /[1-9]/.test(text) ? `${MINUS}${text}` : text;
}

/** A value already on the /10 scale, one decimal: 4.39 -> "4.4" / "4,4" (convert a 0-1 pillar with x * 10 first). */
export function formatTenths(value10: number, lang: Lang): string {
  return formatNumber(value10, 1, lang);
}

/** A 0-1 pillar score shown on the /10 scale: 0.734 -> "7.3" / "7,3". */
export function formatPillar10(score01: number, lang: Lang): string {
  return formatNumber(score01 * 10, 1, lang);
}

/**
 * A change with its sign: "+0.3", "−0,12"; "0.0" (no sign) when it rounds to zero. The minus is
 * U+2212, as in formatNumber.
 */
export function formatSigned(value: number, decimals: number, lang: Lang): string {
  const text = formatNumber(value, decimals, lang);
  return value > 0 && /[1-9]/.test(text) ? `+${text}` : text;
}
