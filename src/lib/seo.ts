import type { ScoredCountry, PillarName, PillarScore } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { routes } from '../i18n/ui';
import { getLocalizedCountryName } from './scores';
import { getRegion } from './regions';
import { countryFaqCopy, faqPillarLabels, indicatorLabels, advisoryLevelWords, listConnector } from './country-faq-copy';
import { MIN_PILLAR_COVERAGE } from '../pipeline/scoring/engine';
import wikidataMapJson from '../data/countries-wikidata.json';

// ISO3 → Wikidata QID + English Wikipedia article, for Place.sameAs entity grounding
// (helps AI answer engines and Google disambiguate the country entity).
const wikidataMap = wikidataMapJson as Record<string, { qid?: string; wikipedia?: string }>;

// Locale maps for consistent 7-language handling
const localeMap: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

// Human-readable region names for Place.containedInPlace (schema.org), per locale.
// Keep all 7 langs covered for every region key so non-EN pages don't leak English text.
const regionDisplayNames: Record<string, Record<Lang, string>> = {
  europe: { en: 'Europe', it: 'Europa', es: 'Europa', fr: 'Europe', pt: 'Europa', zh: '欧洲', de: 'Europa' },
  asia: { en: 'Asia', it: 'Asia', es: 'Asia', fr: 'Asie', pt: 'Ásia', zh: '亚洲', de: 'Asien' },
  africa: { en: 'Africa', it: 'Africa', es: 'África', fr: 'Afrique', pt: 'África', zh: '非洲', de: 'Afrika' },
  americas: { en: 'Americas', it: 'Americhe', es: 'América', fr: 'Amériques', pt: 'Américas', zh: '美洲', de: 'Amerika' },
  oceania: { en: 'Oceania', it: 'Oceania', es: 'Oceanía', fr: 'Océanie', pt: 'Oceania', zh: '大洋洲', de: 'Ozeanien' },
  middle_east: { en: 'Middle East', it: 'Medio Oriente', es: 'Oriente Medio', fr: 'Moyen-Orient', pt: 'Oriente Médio', zh: '中东', de: 'Naher Osten' },
};

// Pillar name translations for meta descriptions
const pillarLabels: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'environment' },
  it: { conflict: 'conflitto', crime: 'criminalita', health: 'salute', governance: 'governance', environment: 'ambiente' },
  es: { conflict: 'conflicto', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'medio ambiente' },
  fr: { conflict: 'conflit', crime: 'criminalite', health: 'sante', governance: 'gouvernance', environment: 'environnement' },
  pt: { conflict: 'conflito', crime: 'criminalidade', health: 'saude', governance: 'governanca', environment: 'meio ambiente' },
  zh: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '环境' },
  de: { conflict: 'Konflikt', crime: 'Kriminalität', health: 'Gesundheit', governance: 'Regierungsführung', environment: 'Umwelt' },
};

/**
 * Pick the pillar set eligible to be named as weakest/strongest.
 * Mirrors the engine's own composite-score gate (engine.ts lines 153-157):
 * keep only pillars whose dataCompleteness clears MIN_PILLAR_COVERAGE, but if
 * none clear it fall back to all pillars. This stops sparse micro-territories
 * (e.g. Monaco, whose crime/governance/environment pillars have zero data) from
 * naming a zero-data pillar as their weakest or strongest area.
 */
export function selectEligiblePillars(pillars: PillarScore[]): PillarScore[] {
  const eligible = pillars.filter((p) => p.dataCompleteness >= MIN_PILLAR_COVERAGE);
  return eligible.length > 0 ? eligible : pillars;
}

/**
 * Name the 1-2 lowest-scoring indicators driving a weak pillar, for Q2.
 * All advisory_level_* indicators collapse to the single 'advisory_group'
 * label (counted once, represented by their lowest normalizedValue). Entries
 * are sorted ascending by normalizedValue (lower = bigger drag) and the lowest
 * distinct labels are returned. Returns [] when the pillar yields no usable
 * labels, so the caller can omit the driver clause entirely.
 */
function selectPillarDriverLabels(pillar: PillarScore, lang: Lang): string[] {
  const labelMap = indicatorLabels[lang];
  const entries: { key: string; nv: number }[] = [];
  let advisoryMin: number | null = null;
  for (const ind of pillar.indicators) {
    if (ind.name.startsWith('advisory_level_')) {
      advisoryMin = advisoryMin === null ? ind.normalizedValue : Math.min(advisoryMin, ind.normalizedValue);
    } else if (labelMap[ind.name]) {
      entries.push({ key: ind.name, nv: ind.normalizedValue });
    }
  }
  if (advisoryMin !== null) entries.push({ key: 'advisory_group', nv: advisoryMin });
  entries.sort((a, b) => a.nv - b.nv);
  const labels: string[] = [];
  for (const e of entries) {
    const lbl = labelMap[e.key];
    if (lbl && !labels.includes(lbl)) labels.push(lbl);
    if (labels.length === 2) break;
  }
  return labels;
}

// Priority order for naming governments in Q3 (major advisory issuers first),
// used to pick a stable 1-2 names among those at the highest present level.
const ADVISORY_GOV_PRIORITY = [
  'us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'nz', 'jp', 'at', 'ch', 'be', 'ie',
  'es', 'it', 'dk', 'se', 'no', 'fi', 'pl', 'cz', 'hu', 'pt', 'ro', 'sg', 'hk',
  'ee', 'hr', 'rs', 'sk', 'cn', 'in', 'br', 'ar', 'ph',
];

/**
 * Generate a unique meta description for a country page based on score data.
 * Each country gets a differentiated description using its score, risk level,
 * strongest pillar, and weakest pillar.
 */
export function buildCountryMetaDescription(country: ScoredCountry, lang: Lang): string {
  const score = country.score;

  // Determine risk level
  const riskLevels: Record<Lang, [string, string, string]> = {
    en: ['Low risk', 'Moderate risk', 'High risk'],
    it: ['rischio basso', 'rischio moderato', 'rischio alto'],
    es: ['riesgo bajo', 'riesgo moderado', 'riesgo alto'],
    fr: ['risque faible', 'risque modere', 'risque eleve'],
    pt: ['risco baixo', 'risco moderado', 'risco alto'],
    zh: ['低风险', '中等风险', '高风险'],
    de: ['niedriges Risiko', 'mittleres Risiko', 'hohes Risiko'],
  };
  const [low, moderate, high] = riskLevels[lang];
  const riskLevel = score >= 7 ? low : score >= 5 ? moderate : high;

  // Find strongest and weakest pillars (score is 0-1, display as x10 for /10 scale).
  // Only pillars with sufficient data coverage are eligible, so a zero-data pillar
  // (e.g. Monaco's crime/governance/environment) is never named as best or worst.
  const pillars = selectEligiblePillars(country.pillars);
  let strongest = pillars[0];
  let weakest = pillars[0];
  for (const p of pillars) {
    if (p.score > strongest.score) strongest = p;
    if (p.score < weakest.score) weakest = p;
  }

  const strongestScore = (strongest.score * 10).toFixed(1);
  const weakestScore = (weakest.score * 10).toFixed(1);
  const strongestLabel = pillarLabels[lang][strongest.name];
  const weakestLabel = pillarLabels[lang][weakest.name];
  // Fixed site-wide "40+" source framing (matches hub-faq.ts / ApiDocs / CitePage).
  const sourceCount = 40;
  const name = getLocalizedCountryName(country, lang);

  const roundedScore = score.toFixed(1);
  const templates: Record<Lang, string> = {
    en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). Top concern: ${weakestLabel} (${weakestScore}). Best: ${strongestLabel} (${strongestScore}). Free data from ${sourceCount}+ sources, updated daily. Check before you travel.`,
    it: `Punteggio sicurezza ${name}: ${roundedScore}/10 (${riskLevel}). Rischio principale: ${weakestLabel} (${weakestScore}). Punto forte: ${strongestLabel} (${strongestScore}). Dati gratuiti da ${sourceCount}+ fonti, aggiornati ogni giorno. Verifica prima di partire.`,
    es: `Seguridad de ${name}: ${roundedScore}/10 (${riskLevel}). Mayor riesgo: ${weakestLabel} (${weakestScore}). Punto fuerte: ${strongestLabel} (${strongestScore}). Datos gratuitos de ${sourceCount}+ fuentes, actualizados diariamente. Verifica antes de viajar.`,
    fr: `Securite de ${name} : ${roundedScore}/10 (${riskLevel}). Risque principal : ${weakestLabel} (${weakestScore}). Point fort : ${strongestLabel} (${strongestScore}). Donnees gratuites de ${sourceCount}+ sources, mises a jour chaque jour. Verifiez avant de partir.`,
    pt: `Seguranca de ${name}: ${roundedScore}/10 (${riskLevel}). Maior risco: ${weakestLabel} (${weakestScore}). Ponto forte: ${strongestLabel} (${strongestScore}). Dados gratuitos de ${sourceCount}+ fontes, atualizados diariamente. Verifique antes de viajar.`,
    zh: `${name} 安全评分：${roundedScore}/10（${riskLevel}）。主要关注：${weakestLabel}（${weakestScore}）。最佳类别：${strongestLabel}（${strongestScore}）。来自 ${sourceCount}+ 个来源的免费数据，每日更新。出行前请查阅。`,
    de: `Sicherheits-Score für ${name}: ${roundedScore}/10 (${riskLevel}). Hauptrisiko: ${weakestLabel} (${weakestScore}). Stärkste Kategorie: ${strongestLabel} (${strongestScore}). Kostenlose Daten aus ${sourceCount}+ Quellen, täglich aktualisiert. Vor der Reise prüfen.`,
  };
  return templates[lang];
}

/**
 * Build JSON-LD structured data for a country detail page.
 * Uses @graph with WebPage and Place nodes.
 */
// ---------- per-Lang JSON-LD string tables (country page) ----------

// WebPage.name (suffix appended to the country name, e.g. "Japan Safety Score")
const webPageNameTemplates: Record<Lang, (name: string) => string> = {
  en: (n) => `${n} Safety Score`,
  it: (n) => `Punteggio di sicurezza ${n}`,
  es: (n) => `Puntuación de seguridad de ${n}`,
  fr: (n) => `Score de sécurité ${n}`,
  pt: (n) => `Pontuação de segurança de ${n}`,
  zh: (n) => `${n} 安全评分`,
  de: (n) => `Sicherheits-Score ${n}`,
};

// Place.description
const placeDescriptions: Record<Lang, (name: string) => string> = {
  en: (n) => `Safety information for ${n}`,
  it: (n) => `Informazioni di sicurezza per ${n}`,
  es: (n) => `Información de seguridad para ${n}`,
  fr: (n) => `Informations de sécurité pour ${n}`,
  pt: (n) => `Informações de segurança sobre ${n}`,
  zh: (n) => `${n} 的安全信息`,
  de: (n) => `Sicherheitsinformationen zu ${n}`,
};

// Risk bands used in TouristDestination.description (Low / Moderate / High risk)
const riskBands: Record<Lang, [string, string, string]> = {
  en: ['Low risk', 'Moderate risk', 'High risk'],
  it: ['rischio basso', 'rischio moderato', 'rischio alto'],
  es: ['riesgo bajo', 'riesgo moderado', 'riesgo alto'],
  fr: ['risque faible', 'risque modéré', 'risque élevé'],
  pt: ['risco baixo', 'risco moderado', 'risco alto'],
  zh: ['低风险', '中等风险', '高风险'],
  de: ['niedriges Risiko', 'mittleres Risiko', 'hohes Risiko'],
};

// TouristDestination.touristType (segment of travellers)
const touristTypes: Record<Lang, [string, string, string]> = {
  en: ['All travelers including families', 'General travelers', 'Adventure travelers'],
  it: ['Tutti i viaggiatori incluse le famiglie', 'Viaggiatori in generale', 'Viaggiatori avventurosi'],
  es: ['Todos los viajeros incluidas las familias', 'Viajeros en general', 'Viajeros de aventura'],
  fr: ['Tous les voyageurs y compris les familles', 'Voyageurs en général', "Voyageurs d'aventure"],
  pt: ['Todos os viajantes incluindo famílias', 'Viajantes em geral', 'Viajantes de aventura'],
  zh: ['所有旅行者（包括家庭）', '普通旅行者', '冒险旅行者'],
  de: ['Alle Reisenden einschließlich Familien', 'Allgemeine Reisende', 'Abenteuerreisende'],
};

// TouristDestination.description
const touristDescriptions: Record<Lang, (name: string, score: string, band: string) => string> = {
  en: (n, s, b) => `Travel safety information for ${n}. Safety score: ${s}/10 (${b}). Data from IsItSafeToTravel.org, updated daily.`,
  it: (n, s, b) => `Informazioni sulla sicurezza dei viaggi per ${n}. Punteggio di sicurezza: ${s}/10 (${b}). Dati da IsItSafeToTravel.org, aggiornati ogni giorno.`,
  es: (n, s, b) => `Información de seguridad de viaje para ${n}. Puntuación de seguridad: ${s}/10 (${b}). Datos de IsItSafeToTravel.org, actualizados a diario.`,
  fr: (n, s, b) => `Informations de sécurité voyage pour ${n}. Score de sécurité : ${s}/10 (${b}). Données de IsItSafeToTravel.org, mises à jour quotidiennement.`,
  pt: (n, s, b) => `Informações de segurança de viagem para ${n}. Pontuação de segurança: ${s}/10 (${b}). Dados de IsItSafeToTravel.org, atualizados diariamente.`,
  zh: (n, s, b) => `${n} 旅行安全信息。安全评分：${s}/10（${b}）。数据来自 IsItSafeToTravel.org，每日更新。`,
  de: (n, s, b) => `Reise-Sicherheitsinformationen für ${n}. Sicherheits-Score: ${s}/10 (${b}). Daten von IsItSafeToTravel.org, täglich aktualisiert.`,
};

// Dataset.name (year is appended)
const datasetNames: Record<Lang, (name: string, year: number) => string> = {
  en: (n, y) => `${n} Travel Safety Data ${y}`,
  it: (n, y) => `Dati sulla sicurezza di viaggio ${n} ${y}`,
  es: (n, y) => `Datos de seguridad de viaje ${n} ${y}`,
  fr: (n, y) => `Données de sécurité voyage ${n} ${y}`,
  pt: (n, y) => `Dados de segurança de viagem ${n} ${y}`,
  zh: (n, y) => `${n} 旅行安全数据 ${y}`,
  de: (n, y) => `Reise-Sicherheitsdaten ${n} ${y}`,
};

// Dataset.description
const datasetDescriptions: Record<Lang, (name: string) => string> = {
  en: (n) => `Daily updated safety scores for ${n}, covering conflict, crime, health, governance, and environment.`,
  it: (n) => `Punteggi di sicurezza aggiornati ogni giorno per ${n}, che coprono conflitto, criminalità, salute, governance e ambiente.`,
  es: (n) => `Puntuaciones de seguridad actualizadas diariamente para ${n}, que cubren conflicto, criminalidad, salud, gobernanza y medio ambiente.`,
  fr: (n) => `Scores de sécurité mis à jour quotidiennement pour ${n}, couvrant conflit, criminalité, santé, gouvernance et environnement.`,
  pt: (n) => `Pontuações de segurança atualizadas diariamente para ${n}, cobrindo conflito, criminalidade, saúde, governança e meio ambiente.`,
  zh: (n) => `${n} 每日更新的安全评分，基于 40 多个公开来源，涵盖武装冲突、犯罪、健康、治理和自然灾害五大风险类别。`,
  de: (n) => `Täglich aktualisierte Sicherheits-Scores für ${n}, die Konflikt, Kriminalität, Gesundheit, Regierungsführung und Umwelt abdecken.`,
};

// Dataset.measurementTechnique
const measurementTechniqueByLang: Record<Lang, string> = {
  en: 'Weighted geometric mean of 5 category scores from 40+ public sources including government advisories, World Bank, INFORM, and GPI indices',
  it: 'Media geometrica ponderata di 5 punteggi di categoria da oltre 40 fonti pubbliche tra cui avvisi governativi, Banca Mondiale, INFORM e indici GPI',
  es: 'Media geométrica ponderada de 5 puntuaciones por categoría de más de 40 fuentes públicas incluidos avisos gubernamentales, Banco Mundial, INFORM e índices GPI',
  fr: 'Moyenne géométrique pondérée de 5 scores de catégorie provenant de plus de 40 sources publiques, dont les avis gouvernementaux, la Banque mondiale, INFORM et les indices GPI',
  pt: 'Média geométrica ponderada de 5 pontuações de categoria provenientes de mais de 40 fontes públicas, incluindo avisos governamentais, Banco Mundial, INFORM e índices GPI',
  zh: '基于来自 40 多个公开来源（包括政府旅行警告、世界银行、INFORM 和 GPI 指数）的 5 个类别评分的加权几何平均值',
  de: 'Gewichtetes geometrisches Mittel aus 5 Kategorie-Scores aus über 40 öffentlichen Quellen, darunter Regierungs-Reisehinweise, Weltbank, INFORM und GPI-Indizes',
};

// Dataset.variableMeasured entries (PropertyValue name + description)
const datasetVariablesByLang: Record<Lang, { name: string; description: string; unitText?: string }[]> = {
  en: [
    { name: 'Safety Score', description: 'Composite safety score on 1-10 scale', unitText: 'score' },
    { name: 'Conflict Risk', description: 'Armed conflict and political violence risk assessment' },
    { name: 'Crime Risk', description: 'Personal crime and safety risk assessment' },
    { name: 'Health Risk', description: 'Health infrastructure and disease risk assessment' },
    { name: 'Governance', description: 'Rule of law, corruption, and institutional stability' },
    { name: 'Environment Risk', description: 'Natural disaster and climate hazard risk' },
  ],
  it: [
    { name: 'Punteggio di sicurezza', description: 'Punteggio di sicurezza composito su scala 1-10', unitText: 'score' },
    { name: 'Rischio di conflitto', description: 'Valutazione del rischio di conflitto armato e violenza politica' },
    { name: 'Rischio criminalità', description: 'Valutazione del rischio di criminalità e sicurezza personale' },
    { name: 'Rischio sanitario', description: 'Valutazione del rischio sanitario e delle infrastrutture mediche' },
    { name: 'Governance', description: 'Stato di diritto, corruzione e stabilità istituzionale' },
    { name: 'Rischio ambientale', description: 'Rischio di disastri naturali e pericoli climatici' },
  ],
  es: [
    { name: 'Puntuación de seguridad', description: 'Puntuación de seguridad compuesta en escala 1-10', unitText: 'score' },
    { name: 'Riesgo de conflicto', description: 'Evaluación del riesgo de conflicto armado y violencia política' },
    { name: 'Riesgo de criminalidad', description: 'Evaluación del riesgo de criminalidad y seguridad personal' },
    { name: 'Riesgo sanitario', description: 'Evaluación del riesgo sanitario y de la infraestructura médica' },
    { name: 'Gobernanza', description: 'Estado de derecho, corrupción y estabilidad institucional' },
    { name: 'Riesgo ambiental', description: 'Riesgo de desastres naturales y peligros climáticos' },
  ],
  fr: [
    { name: 'Score de sécurité', description: 'Score de sécurité composite sur une échelle de 1 à 10', unitText: 'score' },
    { name: 'Risque de conflit', description: 'Évaluation du risque de conflit armé et de violence politique' },
    { name: 'Risque de criminalité', description: 'Évaluation du risque de criminalité et de sécurité personnelle' },
    { name: 'Risque sanitaire', description: "Évaluation du risque sanitaire et de l'infrastructure médicale" },
    { name: 'Gouvernance', description: 'État de droit, corruption et stabilité institutionnelle' },
    { name: 'Risque environnemental', description: 'Risque de catastrophes naturelles et de dangers climatiques' },
  ],
  pt: [
    { name: 'Pontuação de segurança', description: 'Pontuação de segurança composta na escala de 1 a 10', unitText: 'score' },
    { name: 'Risco de conflito', description: 'Avaliação do risco de conflito armado e violência política' },
    { name: 'Risco de criminalidade', description: 'Avaliação do risco de criminalidade e segurança pessoal' },
    { name: 'Risco sanitário', description: 'Avaliação do risco sanitário e da infraestrutura médica' },
    { name: 'Governança', description: 'Estado de direito, corrupção e estabilidade institucional' },
    { name: 'Risco ambiental', description: 'Risco de desastres naturais e perigos climáticos' },
  ],
  zh: [
    { name: '安全评分', description: '1-10 分制的综合安全评分', unitText: 'score' },
    { name: '冲突风险', description: '武装冲突与政治暴力风险评估' },
    { name: '犯罪风险', description: '人身犯罪与安全风险评估' },
    { name: '健康风险', description: '医疗基础设施与疾病风险评估' },
    { name: '治理', description: '法治、腐败与制度稳定性' },
    { name: '环境风险', description: '自然灾害与气候危害风险' },
  ],
  de: [
    { name: 'Sicherheits-Score', description: 'Zusammengesetzter Sicherheits-Score auf einer Skala von 1 bis 10', unitText: 'score' },
    { name: 'Konfliktrisiko', description: 'Bewertung des Risikos bewaffneter Konflikte und politischer Gewalt' },
    { name: 'Kriminalitätsrisiko', description: 'Bewertung des Risikos persönlicher Kriminalität und Sicherheit' },
    { name: 'Gesundheitsrisiko', description: 'Bewertung von Gesundheitsinfrastruktur und Krankheitsrisiko' },
    { name: 'Regierungsführung', description: 'Rechtsstaatlichkeit, Korruption und institutionelle Stabilität' },
    { name: 'Umweltrisiko', description: 'Risiko von Naturkatastrophen und klimatischen Gefahren' },
  ],
};

export function buildCountryJsonLd(country: ScoredCountry, lang: Lang, canonicalUrl: string, dateModified?: string): Record<string, unknown> {
  const countryName = getLocalizedCountryName(country, lang);
  const regionKey = getRegion(country.iso3);
  const regionName = regionDisplayNames[regionKey]?.[lang];
  const scoreStr = country.score.toFixed(1);
  const bandIdx = country.score >= 7 ? 0 : country.score >= 5 ? 1 : 2;
  const band = riskBands[lang][bandIdx];
  const tourType = touristTypes[lang][bandIdx];
  const year = new Date().getFullYear();

  // Entity grounding: link the Place node to Wikidata/Wikipedia when we have a mapping.
  const wikidataEntry = wikidataMap[country.iso3];
  const sameAs = wikidataEntry
    ? [
        wikidataEntry.qid && `https://www.wikidata.org/wiki/${wikidataEntry.qid}`,
        wikidataEntry.wikipedia,
      ].filter(Boolean)
    : [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: webPageNameTemplates[lang](countryName),
        description: buildCountryMetaDescription(country, lang),
        inLanguage: localeMap[lang],
        author: {
          '@type': 'Person',
          name: 'Riccardo Dominici',
          url: `https://isitsafetotravel.org/${lang}/${routes[lang].about}/`,
        },
        publisher: { '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
        ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
      },
      {
        // NOTE: do NOT add aggregateRating/Review here. Google rejects review snippets
        // on a Place node ("Invalid object type for field <parent_node>"), and a computed
        // safety score is not user reviews. Removed twice now — see git a2491daf (Mar 2026)
        // and the May 2026 GSC regression caused by re-adding it in ca86a406.
        '@type': 'Place',
        '@id': `${canonicalUrl}#place`,
        name: countryName,
        description: placeDescriptions[lang](countryName),
        ...(sameAs.length > 0 && { sameAs }),
        ...(regionName && { containedInPlace: { '@type': 'Place', name: regionName } }),
      },
      buildCountryFaqJsonLd(country, lang),
      {
        '@type': 'TouristDestination',
        name: countryName,
        description: touristDescriptions[lang](countryName, scoreStr, band),
        touristType: tourType,
        url: canonicalUrl,
      },
      {
        '@type': 'Dataset',
        name: datasetNames[lang](countryName, year),
        description: datasetDescriptions[lang](countryName),
        url: canonicalUrl,
        license: 'https://creativecommons.org/licenses/by-nc/4.0/',
        temporalCoverage: '2025/..',
        creator: { '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
        variableMeasured: datasetVariablesByLang[lang].map((v) => ({
          '@type': 'PropertyValue',
          name: v.name,
          description: v.description,
          ...(v.unitText && { unitText: v.unitText }),
        })),
        measurementTechnique: measurementTechniqueByLang[lang],
      },
    ],
  };
}

/**
 * Build JSON-LD structured data for the homepage.
 * Includes WebSite schema with SearchAction.
 */
export function buildHomepageJsonLd(siteUrl: string, lang: Lang, dateModified?: string): Record<string, unknown> {
  const descriptions: Record<Lang, string> = {
    en: 'Find out how safe your travel destination is',
    it: 'Scopri quanto e sicura la tua destinazione di viaggio',
    es: 'Descubre que tan seguro es tu destino de viaje',
    fr: 'Decouvrez si votre destination de voyage est sure',
    pt: 'Descubra se seu destino de viagem e seguro',
    zh: '了解您的旅行目的地有多安全',
    de: 'Erfahren Sie, wie sicher Ihr Reiseziel ist',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: descriptions[lang],
    inLanguage: localeMap[lang],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${lang}/${routes[lang].country}/{search_term_string}/`,
      },
      'query-input': 'required name=search_term_string',
    },
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build JSON-LD structured data for the global safety page.
 * Uses a plain WebPage schema (no aggregateRating — Google rejects review snippets here).
 */
export function buildGlobalSafetyJsonLd(
  globalScore: number,
  canonicalUrl: string,
  lang: Lang,
  dateModified?: string,
): Record<string, unknown> {
  const names: Record<Lang, string> = {
    en: 'Global Safety Score',
    it: 'Punteggio di Sicurezza Globale',
    es: 'Puntuacion de Seguridad Global',
    fr: 'Score de Securite Mondial',
    pt: 'Pontuacao de Seguranca Global',
    zh: '全球安全评分',
    de: 'Globaler Sicherheits-Score',
  };

  const descriptions: Record<Lang, string> = {
    en: `Current global safety score: ${globalScore.toFixed(1)}/10. Track world safety trends over time.`,
    it: `Punteggio di sicurezza globale attuale: ${globalScore.toFixed(1)}/10. Segui le tendenze di sicurezza mondiale nel tempo.`,
    es: `Puntuacion de seguridad global actual: ${globalScore.toFixed(1)}/10. Sigue las tendencias de seguridad mundial a lo largo del tiempo.`,
    fr: `Score de securite mondial actuel : ${globalScore.toFixed(1)}/10. Suivez les tendances de securite mondiale.`,
    pt: `Pontuacao de seguranca global atual: ${globalScore.toFixed(1)}/10. Acompanhe as tendencias de seguranca mundial.`,
    zh: `当前全球安全评分：${globalScore.toFixed(1)}/10。跟踪全球安全趋势变化。`,
    de: `Aktueller globaler Sicherheits-Score: ${globalScore.toFixed(1)}/10. Verfolgen Sie weltweite Sicherheitstrends.`,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: names[lang],
    description: descriptions[lang],
    inLanguage: localeMap[lang],
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build Person JSON-LD structured data for the author.
 */
export function buildPersonJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Riccardo Dominici',
    jobTitle: 'Independent developer and data analyst',
    url: 'https://github.com/RiccardoDominici',
  };
}

/**
 * Build simple WebPage JSON-LD for static pages (methodology, legal).
 */
export function buildWebPageJsonLd(title: string, description: string, canonicalUrl: string, lang: Lang, dateModified?: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: localeMap[lang],
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build BreadcrumbList JSON-LD structured data.
 * Each item becomes a ListItem with position, name, and @id (url).
 */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Build Organization JSON-LD structured data for the homepage.
 */
export function buildOrganizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: 'Free travel safety platform providing transparent, data-driven safety scores for 200+ countries worldwide.',
    // Google requires a raster logo >= 112x112px; icon-512.png is the largest PNG we ship.
    logo: `${siteUrl}/icon-512.png`,
    founder: { '@type': 'Person', name: 'Riccardo Dominici', url: 'https://github.com/RiccardoDominici' },
    sameAs: ['https://github.com/RiccardoDominici/IsItSafeToTravel'],
    foundingDate: '2026',
  };
}

/**
 * Build FAQPage JSON-LD structured data.
 * Each question/answer pair becomes a Question with acceptedAnswer.
 */
export function buildFaqPageJsonLd(questions: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  };
}

/**
 * Get raw FAQ question/answer pairs for a country page.
 * Used by both the JSON-LD builder and the visible FaqSection component.
 * Questions are stable (they match long-standing search queries); answers are
 * assembled from banded templates in src/lib/country-faq-copy.ts filled with
 * per-country data, so every page gets a self-contained, citable answer
 * instead of boilerplate that defers to other sections.
 */
export function getCountryFaqData(country: ScoredCountry, lang: Lang): { question: string; answer: string }[] {
  const copy = countryFaqCopy[lang];
  const name = getLocalizedCountryName(country, lang);
  const score = country.score;
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthYear = now.toLocaleDateString(localeMap[lang], { month: 'long', year: 'numeric' });

  // Determine risk level
  const riskLevels: Record<Lang, [string, string, string]> = {
    en: ['Low risk', 'Moderate risk', 'High risk'],
    it: ['rischio basso', 'rischio moderato', 'rischio alto'],
    es: ['riesgo bajo', 'riesgo moderado', 'riesgo alto'],
    fr: ['risque faible', 'risque modéré', 'risque élevé'],
    pt: ['risco baixo', 'risco moderado', 'risco alto'],
    zh: ['低风险', '中等风险', '高风险'],
    de: ['niedriges Risiko', 'mittleres Risiko', 'hohes Risiko'],
  };
  const [low, moderate, high] = riskLevels[lang];
  const riskBand: 'low' | 'moderate' | 'high' = score >= 7 ? 'low' : score >= 5 ? 'moderate' : 'high';
  const riskLevel = riskBand === 'low' ? low : riskBand === 'moderate' ? moderate : high;

  // Sort ELIGIBLE pillars weakest-first so answers name the score's actual
  // drivers and never a zero-data pillar (Monaco fix). When only one pillar is
  // eligible, `second` falls back to the weakest so slots never render "undefined".
  const sorted = [...selectEligiblePillars(country.pillars)].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const second = sorted[1] ?? weakest;
  const strongest = sorted[sorted.length - 1];
  const weakest10 = weakest.score * 10;
  const labels = faqPillarLabels[lang];

  // Practical meaning of the weakest pillar, and the indicator-driven clause
  // naming the actual signals behind its low score (both feed Q1 and Q2).
  const weakestBand: 'critical' | 'mid' | 'strong' = weakest10 < 4 ? 'critical' : weakest10 < 7 ? 'mid' : 'strong';
  let driverClause = '';
  if (weakestBand !== 'strong') {
    const driverLabels = selectPillarDriverLabels(weakest, lang);
    if (driverLabels.length === 1) {
      driverClause = copy.a2DriverClause.one.replace('{labels}', driverLabels[0]);
    } else if (driverLabels.length >= 2) {
      driverClause = copy.a2DriverClause.two.replace('{labels}', driverLabels.slice(0, 2).join(listConnector[lang]));
    }
  }

  const slots: Record<string, string> = {
    name,
    year,
    monthYear,
    score: score.toFixed(1),
    riskLevel,
    weakest: labels[weakest.name],
    weakestScore: weakest10.toFixed(1),
    second: labels[second.name],
    secondScore: (second.score * 10).toFixed(1),
    strongest: labels[strongest.name],
    strongestScore: (strongest.score * 10).toFixed(1),
    meaning: copy.pillarMeaning[weakest.name],
    drivers: driverClause,
  };
  const fill = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (m, key) => slots[key] ?? m);
  const joiner = lang === 'zh' ? '' : ' ';
  // Collapse any double ASCII spaces left when the {drivers} clause is empty.
  const tidy = (s: string) => s.replace(/ {2,}/g, ' ').trim();

  // A1 — verdict, how the score works, why this country's number (drag pillars
  // + what the weakest one means), provenance.
  const drivers = weakest10 >= 7 ? copy.a1Drivers.allStrong : copy.a1Drivers.normal;
  const a1 = tidy([copy.a1Verdict[riskBand], copy.a1Formula, drivers, copy.a1Provenance].map(fill).join(joiner));

  // A2 — severity-banded weakest-pillar answer: "biggest risk" phrasing only
  // when the pillar is genuinely weak, so top scorers don't read as alarmist.
  // critical/mid carry the pillar meaning + the indicator-driven {drivers} clause.
  const a2 = tidy(fill(copy.a2[weakestBand]));

  // A3 — government-advisory summary built from country.advisories: count,
  // consensus band, named governments, majority-Level-4 score cap, or a
  // distinct zero-advisory sentence for micro-territories.
  const advisories = country.advisories ?? {};
  const presentAdvisories = (Object.entries(advisories) as [string, { level: number | string; source?: string }][])
    .map(([key, info]) => ({ key, level: Number(info?.level) }))
    .filter((a) => Number.isFinite(a.level) && a.level >= 1 && a.level <= 4);

  let a3: string;
  if (presentAdvisories.length === 0) {
    a3 = tidy(fill(copy.a3None));
  } else {
    const n = presentAdvisories.length;
    // Consensus (modal) level; ties resolve to the higher (more cautious) level.
    const counts = [0, 0, 0, 0, 0];
    for (const a of presentAdvisories) counts[a.level]++;
    let modal = 1;
    for (let l = 1; l <= 4; l++) if (counts[l] >= counts[modal]) modal = l;
    const band: 'normal' | 'caution' | 'reconsider' | 'avoid' =
      modal === 1 ? 'normal' : modal === 2 ? 'caution' : modal === 3 ? 'reconsider' : 'avoid';

    // Name the 1-2 governments issuing the strongest (highest-level) warning.
    const maxLevel = Math.max(...presentAdvisories.map((a) => a.level));
    const topKeys = presentAdvisories
      .filter((a) => a.level === maxLevel)
      .map((a) => a.key)
      .sort((x, y) => {
        const ix = ADVISORY_GOV_PRIORITY.indexOf(x);
        const iy = ADVISORY_GOV_PRIORITY.indexOf(y);
        return (ix === -1 ? 999 : ix) - (iy === -1 ? 999 : iy);
      })
      .slice(0, 2);
    const region = new Intl.DisplayNames([localeMap[lang]], { type: 'region' });
    const govNames = topKeys.map((key) => {
      const code = key === 'uk' ? 'GB' : key.toUpperCase();
      let display: string | undefined;
      try {
        display = region.of(code);
      } catch {
        display = undefined;
      }
      if (!display || display === code) {
        display = (advisories as Record<string, { source?: string }>)[key]?.source ?? code;
      }
      return display;
    });
    slots.governments = govNames.length <= 1 ? govNames[0] ?? '' : govNames.join(listConnector[lang]);
    slots.govLevel = advisoryLevelWords[lang][maxLevel - 1];
    slots.advisoryCount = n === 1 ? copy.advisoryCountNoun.one : copy.advisoryCountNoun.other.replace('{n}', String(n));

    const a3Parts = [copy.a3Intro, copy.a3Consensus[band]];
    // Level-4 hard cap fires only on a strict MAJORITY of Level-4 advisories
    // (mirrors engine.ts: level4Count >= ceil(N/2 + 0.1)).
    if (counts[4] >= Math.ceil(n / 2 + 0.1)) a3Parts.push(copy.a3Cap);
    a3 = tidy(a3Parts.map(fill).join(joiner));
  }

  return [
    { question: fill(copy.q1), answer: a1 },
    { question: fill(copy.q2), answer: a2 },
    { question: fill(copy.q3), answer: a3 },
  ];
}

/**
 * Build FAQPage JSON-LD for a country page with 3 dynamic FAQ items.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 */
export function buildCountryFaqJsonLd(country: ScoredCountry, lang: Lang): Record<string, unknown> {
  const faqData = getCountryFaqData(country, lang);
  return {
    '@type': 'FAQPage',
    mainEntity: faqData.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: { '@type': 'Answer', text: qa.answer },
    })),
  };
}

/**
 * Build Dataset JSON-LD structured data for the homepage.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 */
export function buildDatasetJsonLd(): Record<string, unknown> {
  return {
    '@type': 'Dataset',
    name: 'Global Travel Safety Scores 2026',
    description: 'Daily updated safety scores for 240+ countries, aggregated from government advisories, health data, conflict indicators, and environmental metrics.',
    url: 'https://isitsafetotravel.org/',
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    temporalCoverage: '2025/..',
    spatialCoverage: 'Global',
    creator: { '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Safety Score', description: 'Composite safety score on 1-10 scale', unitText: 'score' },
      { '@type': 'PropertyValue', name: 'Conflict Risk', description: 'Armed conflict and political violence risk assessment' },
      { '@type': 'PropertyValue', name: 'Crime Risk', description: 'Personal crime and safety risk assessment' },
      { '@type': 'PropertyValue', name: 'Health Risk', description: 'Health infrastructure and disease risk assessment' },
      { '@type': 'PropertyValue', name: 'Governance', description: 'Rule of law, corruption, and institutional stability' },
      { '@type': 'PropertyValue', name: 'Environment Risk', description: 'Natural disaster and climate hazard risk' },
    ],
    measurementTechnique: 'Weighted geometric mean of 5 category scores from 40+ public sources including government advisories, World Bank, INFORM, and GPI indices',
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: 'https://isitsafetotravel.org/scores.json',
    },
  };
}

/**
 * Build JSON-LD structured data for the "Cite this data" page.
 * @graph = WebPage + Dataset (reused from buildDatasetJsonLd, as-is) + FAQPage + BreadcrumbList.
 * Inner nodes carry no @context of their own. Deliberately omits HowTo (Google
 * dropped HowTo rich results in 2023).
 */
export function buildCitePageJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  lang: Lang,
  breadcrumbItems: { name: string; url: string }[],
  faqItems: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: localeMap[lang],
      },
      buildDatasetJsonLd(),
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((qa) => ({
          '@type': 'Question',
          name: qa.question,
          acceptedAnswer: { '@type': 'Answer', text: qa.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    ],
  };
}

/**
 * Build Dataset JSON-LD for methodology pages.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 */
export function buildMethodologyDatasetJsonLd(): Record<string, unknown> {
  return {
    '@type': 'Dataset',
    name: 'IsItSafeToTravel Global Safety Scores',
    description: 'Daily updated composite safety scores for 240+ countries, aggregating 40+ public data sources.',
    url: 'https://isitsafetotravel.org/',
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    temporalCoverage: '2025/..',
    spatialCoverage: { '@type': 'Place', name: 'Global' },
    creator: { '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Safety Score', description: 'Composite safety score on 1-10 scale', unitText: 'score' },
      { '@type': 'PropertyValue', name: 'Conflict Risk' },
      { '@type': 'PropertyValue', name: 'Crime Risk' },
      { '@type': 'PropertyValue', name: 'Health Risk' },
      { '@type': 'PropertyValue', name: 'Governance Quality' },
      { '@type': 'PropertyValue', name: 'Environment Risk' },
    ],
    measurementTechnique: 'Weighted geometric mean of 5 category scores from 40+ public sources including government advisories, World Bank, INFORM, and GPI indices',
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: 'https://isitsafetotravel.org/scores.json',
    },
  };
}
