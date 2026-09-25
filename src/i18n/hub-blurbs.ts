/**
 * Per-country data blurb templates for the 5 ranking hubs that don't rank by
 * plain overall score (safest-countries / most-dangerous-countries keep their
 * own strongest/weakest-pillar template in hub.blurb, src/i18n/ui.ts).
 *
 * Each hub type weighs a different subset of pillars (see src/lib/hub-data.ts
 * for the actual weights), so the blurb calls out the pillars that actually
 * drive THAT ranking instead of a generic strongest/weakest pair — e.g. the
 * families hub is weighted health 35% + governance 35% + crime 20%, so its
 * blurb names health and crime, not whatever pillar happens to be extreme.
 *
 * 2026-09 SEO audit (SXO-03 / C6): countries-to-avoid, safest-for-families and
 * safest-for-solo-travelers were the last 3 (of 7) hubs still unenriched;
 * improving-safety/declining-safety reuse the delta the page already computes
 * instead of re-deriving a pillar driver.
 *
 * Kept out of src/i18n/ui.ts (a merge hot spot shared by every SEO-audit
 * workstream this cycle) as its own small module, same reasoning as
 * src/lib/hub-faq.ts.
 */
import type { Lang } from './ui';

export type EnrichedHubType =
  | 'safest-for-families'
  | 'safest-for-solo-travelers'
  | 'countries-to-avoid'
  | 'improving-safety'
  | 'declining-safety';

export const hubBlurbTemplates: Record<EnrichedHubType, Record<Lang, string>> = {
  'safest-for-families': {
    en: '{name} scores {score}/10 — health: {healthScore}/10, crime: {crimeScore}/10 (the two pillars that matter most for family travel).',
    it: "{name} ottiene {score}/10 — sanità: {healthScore}/10, criminalità: {crimeScore}/10 (i due pilastri più importanti per i viaggi in famiglia).",
    es: '{name} obtiene {score}/10 — salud: {healthScore}/10, criminalidad: {crimeScore}/10 (los dos pilares más importantes para viajar en familia).',
    fr: '{name} obtient {score}/10 — santé : {healthScore}/10, criminalité : {crimeScore}/10 (les deux piliers les plus importants pour les voyages en famille).',
    pt: '{name} obtém {score}/10 — saúde: {healthScore}/10, criminalidade: {crimeScore}/10 (os dois pilares mais importantes para viagens em família).',
    zh: '{name} 得分 {score}/10——医疗：{healthScore}/10，犯罪：{crimeScore}/10（家庭出行最看重的两大支柱）。',
    de: '{name} erreicht {score}/10 — Gesundheit: {healthScore}/10, Kriminalität: {crimeScore}/10 (die zwei wichtigsten Säulen für Familienreisen).',
  },
  'safest-for-solo-travelers': {
    en: '{name} scores {score}/10 — crime: {crimeScore}/10, governance: {governanceScore}/10 (the two pillars that matter most when travelling alone).',
    it: '{name} ottiene {score}/10 — criminalità: {crimeScore}/10, governance: {governanceScore}/10 (i due pilastri più importanti per chi viaggia da solo).',
    es: '{name} obtiene {score}/10 — criminalidad: {crimeScore}/10, gobernanza: {governanceScore}/10 (los dos pilares más importantes al viajar en solitario).',
    fr: '{name} obtient {score}/10 — criminalité : {crimeScore}/10, gouvernance : {governanceScore}/10 (les deux piliers les plus importants pour voyager seul).',
    pt: '{name} obtém {score}/10 — criminalidade: {crimeScore}/10, governança: {governanceScore}/10 (os dois pilares mais importantes para quem viaja sozinho).',
    zh: '{name} 得分 {score}/10——犯罪：{crimeScore}/10，治理：{governanceScore}/10（独自旅行最看重的两大支柱）。',
    de: '{name} erreicht {score}/10 — Kriminalität: {crimeScore}/10, Regierungsführung: {governanceScore}/10 (die zwei wichtigsten Säulen für Alleinreisende).',
  },
  'countries-to-avoid': {
    en: '{name} scores {score}/10 — {n} of {total} advisories are currently at the highest level (Do Not Travel); weakest pillar: {weakest} ({weakestScore}/10).',
    it: '{name} ottiene {score}/10 — {n} avvisi su {total} sono attualmente al livello massimo (non viaggiare); pilastro più debole: {weakest} ({weakestScore}/10).',
    es: '{name} obtiene {score}/10 — {n} de {total} avisos están actualmente en el nivel máximo (no viajar); pilar más débil: {weakest} ({weakestScore}/10).',
    fr: '{name} obtient {score}/10 — {n} avis sur {total} sont actuellement au niveau maximal (ne pas voyager) ; pilier le plus faible : {weakest} ({weakestScore}/10).',
    pt: '{name} obtém {score}/10 — {n} de {total} avisos estão atualmente no nível máximo (não viaje); pilar mais fraco: {weakest} ({weakestScore}/10).',
    zh: '{name} 得分 {score}/10——{total} 项警告中有 {n} 项目前处于最高级别（切勿前往）；最弱支柱：{weakest}（{weakestScore}/10）。',
    de: '{name} erreicht {score}/10 — {n} von {total} Reisehinweisen liegen derzeit auf der höchsten Stufe (nicht reisen); schwächste Säule: {weakest} ({weakestScore}/10).',
  },
  'improving-safety': {
    en: "{name}'s score rose to {score}/10 — up {delta} over the past 7 days.",
    it: 'Il punteggio di {name} sale a {score}/10 — +{delta} nell\'ultima settimana.',
    es: 'La puntuación de {name} sube a {score}/10 — +{delta} en la última semana.',
    fr: 'Le score de {name} monte à {score}/10 — +{delta} au cours des 7 derniers jours.',
    pt: 'A pontuação de {name} sobe para {score}/10 — +{delta} nos últimos 7 dias.',
    zh: '{name} 的评分升至 {score}/10——过去 7 天上升 {delta}。',
    de: 'Der Sicherheitswert von {name} steigt auf {score}/10 — +{delta} in den letzten 7 Tagen.',
  },
  'declining-safety': {
    en: "{name}'s score fell to {score}/10 — down {delta} over the past 7 days.",
    it: 'Il punteggio di {name} scende a {score}/10 — -{delta} nell\'ultima settimana.',
    es: 'La puntuación de {name} baja a {score}/10 — -{delta} en la última semana.',
    fr: 'Le score de {name} descend à {score}/10 — -{delta} au cours des 7 derniers jours.',
    pt: 'A pontuação de {name} cai para {score}/10 — -{delta} nos últimos 7 dias.',
    zh: '{name} 的评分降至 {score}/10——过去 7 天下降 {delta}。',
    de: 'Der Sicherheitswert von {name} sinkt auf {score}/10 — -{delta} in den letzten 7 Tagen.',
  },
};
