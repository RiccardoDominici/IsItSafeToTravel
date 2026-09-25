/**
 * Single source of truth for the short verdict copy tied to each safety band.
 *
 * WHY this file exists: the 2026-09-25 audit (I4) found three independent text
 * generators disagreeing on the same country page — ScoreHero used 5 numeric
 * bands with one label set, the FAQ/meta-description used 3 coarser bands with
 * different labels at the *same* 7/5 boundaries, and src/lib/bands.ts (a fourth,
 * numerically-identical set used by the news engine) was never wired to the UI
 * at all. A Jersey-type country (5.6/10) could read "Only for experienced
 * travelers" in the hero and "Yes, but with caution... most trips are
 * trouble-free" in the FAQ one scroll down — same score, opposite tone.
 *
 * The fix: `getBand()` in bands.ts (thresholds frozen, untouched here) is now
 * the *only* place that turns a score into a band, and this file is the *only*
 * place that turns a band into copy. ScoreHero's pill, AnswerFirstParagraph's
 * risk label, the FAQ's a1Verdict opener and buildCountryMetaDescription's risk
 * label all read from `getBandVerdictCopy()` — so a band can never say
 * "cautiously yes" in one place and "risky" in another again.
 *
 * `riskLabel` is the short inline noun phrase ("Moderate risk") reused verbatim
 * across all four surfaces. `badge` is ScoreHero-specific short imperative/
 * statement copy (kept here rather than inline in ScoreHero.astro so it stays
 * next to, and visibly derived from, the same band it must never contradict).
 */
import type { Lang } from '../i18n/ui';
// bands.ts imports BandKey for its own use but doesn't re-export it (and is
// kept read-mostly for this fix round) — import the type straight from its
// source instead of adding an export there.
import type { BandKey } from '../pipeline/news/types';
import { getBand } from './bands';

export interface BandVerdictCopy {
  /** ScoreHero pill text (short, 2-5 words). */
  badge: string;
  /** Short risk-level noun phrase, reused inline by the FAQ, the answer-first
   *  paragraph and the meta description — this is the string that must never
   *  disagree with `badge`'s tone for the same band. */
  riskLabel: string;
}

const BAND_VERDICT_COPY: Record<Lang, Record<BandKey, BandVerdictCopy>> = {
  en: {
    excellent: { badge: 'Yes, safe to travel', riskLabel: 'Very low risk' },
    good: { badge: 'Generally safe', riskLabel: 'Low risk' },
    moderate: { badge: 'Exercise caution', riskLabel: 'Moderate risk' },
    high_caution: { badge: 'Only for experienced travelers', riskLabel: 'High caution' },
    danger: { badge: 'Not recommended', riskLabel: 'High risk' },
  },
  it: {
    excellent: { badge: 'Sì, sicuro per viaggiare', riskLabel: 'rischio molto basso' },
    good: { badge: 'Generalmente sicuro', riskLabel: 'rischio basso' },
    moderate: { badge: 'Prestare attenzione', riskLabel: 'rischio moderato' },
    high_caution: { badge: 'Solo per viaggiatori esperti', riskLabel: 'cautela elevata' },
    danger: { badge: 'Non raccomandato', riskLabel: 'rischio alto' },
  },
  es: {
    excellent: { badge: 'Sí, seguro para viajar', riskLabel: 'riesgo muy bajo' },
    good: { badge: 'Generalmente seguro', riskLabel: 'riesgo bajo' },
    moderate: { badge: 'Tener precaución', riskLabel: 'riesgo moderado' },
    high_caution: { badge: 'Solo para viajeros expertos', riskLabel: 'precaución alta' },
    danger: { badge: 'No recomendado', riskLabel: 'riesgo alto' },
  },
  fr: {
    excellent: { badge: 'Oui, sûr pour voyager', riskLabel: 'risque très faible' },
    good: { badge: 'Généralement sûr', riskLabel: 'risque faible' },
    moderate: { badge: 'Faire preuve de prudence', riskLabel: 'risque modéré' },
    high_caution: { badge: 'Uniquement pour voyageurs expérimentés', riskLabel: 'prudence élevée' },
    danger: { badge: 'Non recommandé', riskLabel: 'risque élevé' },
  },
  pt: {
    excellent: { badge: 'Sim, seguro para viajar', riskLabel: 'risco muito baixo' },
    good: { badge: 'Geralmente seguro', riskLabel: 'risco baixo' },
    moderate: { badge: 'Tenha cautela', riskLabel: 'risco moderado' },
    high_caution: { badge: 'Apenas para viajantes experientes', riskLabel: 'cautela elevada' },
    danger: { badge: 'Não recomendado', riskLabel: 'risco alto' },
  },
  zh: {
    excellent: { badge: '是，可以安全出行', riskLabel: '风险极低' },
    good: { badge: '总体安全', riskLabel: '低风险' },
    moderate: { badge: '请保持谨慎', riskLabel: '中等风险' },
    high_caution: { badge: '仅限经验丰富的旅行者', riskLabel: '高度谨慎' },
    danger: { badge: '不推荐前往', riskLabel: '高风险' },
  },
  de: {
    excellent: { badge: 'Ja, sicher zu bereisen', riskLabel: 'sehr niedriges Risiko' },
    good: { badge: 'Allgemein sicher', riskLabel: 'niedriges Risiko' },
    moderate: { badge: 'Vorsicht geboten', riskLabel: 'mittleres Risiko' },
    high_caution: { badge: 'Nur für erfahrene Reisende', riskLabel: 'hohe Vorsicht geboten' },
    danger: { badge: 'Nicht empfohlen', riskLabel: 'hohes Risiko' },
  },
};

/** The single lookup every country-page surface should use for band copy. */
export function getBandVerdictCopy(score: number, lang: Lang): BandVerdictCopy {
  return BAND_VERDICT_COPY[lang][getBand(score)];
}
