import type { ScoredCountry, PillarName } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { routes } from '../i18n/ui';
import { getLocalizedCountryName } from './scores';
import { getRegion } from './regions';
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
  const riskLevel = score >= 7 ? low : score >= 4 ? moderate : high;

  // Find strongest and weakest pillars (score is 0-1, display as x10 for /10 scale)
  const pillars = country.pillars;
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
  const sourceCount = country.sources.length || 7;
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
  const bandIdx = country.score >= 7 ? 0 : country.score >= 4 ? 1 : 2;
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
    logo: `${siteUrl}/favicon.svg`,
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
 */
export function getCountryFaqData(country: ScoredCountry, lang: Lang): { question: string; answer: string }[] {
  const name = getLocalizedCountryName(country, lang);
  const score = country.score;
  const roundedScore = score.toFixed(1);
  const year = new Date().getFullYear().toString();

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
  const riskLevel = score >= 7 ? low : score >= 4 ? moderate : high;

  // Find weakest pillar
  const pillars = country.pillars;
  let weakest = pillars[0];
  for (const p of pillars) {
    if (p.score < weakest.score) weakest = p;
  }
  const weakestLabel = pillarLabels[lang][weakest.name];
  const weakestScore = (weakest.score * 10).toFixed(1);

  // FAQ 1: Is it safe to travel to {country} in {year}?
  const q1: Record<Lang, string> = {
    en: `Is it safe to travel to ${name} in ${year}?`,
    it: `E sicuro viaggiare in ${name} nel ${year}?`,
    es: `Es seguro viajar a ${name} en ${year}?`,
    fr: `${name} : est-ce sûr d'y voyager en ${year} ?`,
    pt: `E seguro viajar para ${name} em ${year}?`,
    zh: `${year} 年前往 ${name} 旅行安全吗？`,
    de: `Ist es ${year} sicher, nach ${name} zu reisen?`,
  };
  const a1: Record<Lang, string> = {
    en: `${name} has a safety score of ${roundedScore}/10, classified as ${riskLevel}. This score is updated daily using data from ${country.sources.length || 7}+ public sources including government advisories, health data, and conflict indicators.`,
    it: `${name} ha un punteggio di sicurezza di ${roundedScore}/10, classificato come ${riskLevel}. Questo punteggio viene aggiornato quotidianamente utilizzando dati da ${country.sources.length || 7}+ fonti pubbliche tra cui avvisi governativi, dati sanitari e indicatori di conflitto.`,
    es: `${name} tiene una puntuacion de seguridad de ${roundedScore}/10, clasificado como ${riskLevel}. Esta puntuacion se actualiza diariamente utilizando datos de ${country.sources.length || 7}+ fuentes publicas que incluyen avisos gubernamentales, datos de salud e indicadores de conflicto.`,
    fr: `${name} a un score de securite de ${roundedScore}/10, classe comme ${riskLevel}. Ce score est mis a jour quotidiennement a partir de ${country.sources.length || 7}+ sources publiques incluant les avis gouvernementaux, les donnees sanitaires et les indicateurs de conflit.`,
    pt: `${name} tem uma pontuacao de seguranca de ${roundedScore}/10, classificado como ${riskLevel}. Esta pontuacao e atualizada diariamente usando dados de ${country.sources.length || 7}+ fontes publicas incluindo avisos governamentais, dados de saude e indicadores de conflito.`,
    zh: `${name} 的安全评分为 ${roundedScore}/10，归类为${riskLevel}。该评分每日更新，数据来自 ${country.sources.length || 7}+ 个公开来源，包括政府旅行警告、健康数据和冲突指标。`,
    de: `${name} hat einen Sicherheits-Score von ${roundedScore}/10 und ist als ${riskLevel} eingestuft. Der Score wird täglich aktualisiert auf Basis von ${country.sources.length || 7}+ öffentlichen Quellen, darunter Regierungs-Reisehinweise, Gesundheitsdaten und Konfliktindikatoren.`,
  };

  // FAQ 2: What is the biggest risk when traveling to {country}?
  const q2: Record<Lang, string> = {
    en: `What is the biggest risk when traveling to ${name}?`,
    it: `Qual e il rischio maggiore viaggiando in ${name}?`,
    es: `Cual es el mayor riesgo al viajar a ${name}?`,
    fr: `${name} : quel est le plus grand risque pour les voyageurs ?`,
    pt: `Qual e o maior risco ao viajar para ${name}?`,
    zh: `前往 ${name} 旅行的最大风险是什么？`,
    de: `Was ist das größte Risiko bei einer Reise nach ${name}?`,
  };
  const a2: Record<Lang, string> = {
    en: `The area of greatest concern for ${name} is ${weakestLabel}, with a score of ${weakestScore}/10. Travelers should pay particular attention to this aspect when planning their trip. Check the full pillar breakdown on this page for detailed insights.`,
    it: `L'area di maggiore preoccupazione per ${name} e ${weakestLabel}, con un punteggio di ${weakestScore}/10. I viaggiatori dovrebbero prestare particolare attenzione a questo aspetto quando pianificano il viaggio. Consulta la ripartizione completa dei pilastri in questa pagina per approfondimenti dettagliati.`,
    es: `El area de mayor preocupacion para ${name} es ${weakestLabel}, con una puntuacion de ${weakestScore}/10. Los viajeros deben prestar especial atencion a este aspecto al planificar su viaje. Consulta el desglose completo de pilares en esta pagina para obtener informacion detallada.`,
    fr: `Le domaine de plus grande preoccupation pour ${name} est ${weakestLabel}, avec un score de ${weakestScore}/10. Les voyageurs doivent accorder une attention particuliere a cet aspect lors de la planification de leur voyage. Consultez la repartition complete des piliers sur cette page pour des informations detaillees.`,
    pt: `A area de maior preocupacao para ${name} e ${weakestLabel}, com uma pontuacao de ${weakestScore}/10. Os viajantes devem prestar atencao especial a este aspecto ao planejar sua viagem. Consulte a divisao completa dos pilares nesta pagina para informacoes detalhadas.`,
    zh: `${name} 最值得关注的领域是${weakestLabel}，评分为 ${weakestScore}/10。旅行者在规划行程时应特别注意这一方面。请查看本页面完整的支柱细分以获取详细信息。`,
    de: `Der Bereich mit den größten Bedenken für ${name} ist ${weakestLabel} mit einem Score von ${weakestScore}/10. Reisende sollten diesem Aspekt bei der Reiseplanung besondere Aufmerksamkeit schenken. Die vollständige Säulenaufschlüsselung auf dieser Seite bietet detaillierte Einblicke.`,
  };

  // FAQ 3: Do I need travel insurance for {country}?
  const q3: Record<Lang, string> = {
    en: `Do I need travel insurance for ${name}?`,
    it: `Ho bisogno di un'assicurazione di viaggio per ${name}?`,
    es: `Necesito seguro de viaje para ${name}?`,
    fr: `Ai-je besoin d'une assurance voyage pour ${name} ?`,
    pt: `Preciso de seguro de viagem para ${name}?`,
    zh: `前往 ${name} 需要旅行保险吗？`,
    de: `Brauche ich eine Reiseversicherung für ${name}?`,
  };
  const a3: Record<Lang, string> = {
    en: `Travel insurance is strongly recommended for any international trip, including visits to ${name}. A comprehensive policy should cover medical emergencies, trip cancellations, and evacuation. This is especially important given that health-related risks can change rapidly.`,
    it: `L'assicurazione di viaggio e fortemente raccomandata per qualsiasi viaggio internazionale, incluse le visite in ${name}. Una polizza completa dovrebbe coprire emergenze mediche, cancellazioni del viaggio ed evacuazione. Questo e particolarmente importante dato che i rischi legati alla salute possono cambiare rapidamente.`,
    es: `El seguro de viaje es altamente recomendable para cualquier viaje internacional, incluyendo visitas a ${name}. Una poliza integral debe cubrir emergencias medicas, cancelaciones de viaje y evacuacion. Esto es especialmente importante dado que los riesgos relacionados con la salud pueden cambiar rapidamente.`,
    fr: `L'assurance voyage est fortement recommandée pour tout voyage international, y compris pour un séjour à destination de ${name}. Une police complète devrait couvrir les urgences médicales, les annulations de voyage et l'évacuation. C'est particulièrement important car les risques liés à la santé peuvent évoluer rapidement.`,
    pt: `O seguro de viagem e fortemente recomendado para qualquer viagem internacional, incluindo visitas a ${name}. Uma apolice abrangente deve cobrir emergencias medicas, cancelamentos de viagem e evacuacao. Isso e especialmente importante dado que os riscos relacionados a saude podem mudar rapidamente.`,
    zh: `强烈建议为任何国际旅行（包括前往 ${name}）购买旅行保险。一份全面的保单应涵盖医疗紧急情况、行程取消和撤离。鉴于健康相关风险可能迅速变化，这一点尤为重要。`,
    de: `Eine Reiseversicherung wird für jede internationale Reise, einschließlich Besuche in ${name}, dringend empfohlen. Eine umfassende Police sollte medizinische Notfälle, Reiserücktritte und Evakuierungen abdecken. Dies ist besonders wichtig, da gesundheitsbezogene Risiken sich rasch ändern können.`,
  };

  return [
    { question: q1[lang], answer: a1[lang] },
    { question: q2[lang], answer: a2[lang] },
    { question: q3[lang], answer: a3[lang] },
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
