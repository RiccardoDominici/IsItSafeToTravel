import type { ScoredCountry, PillarName } from '../pipeline/types';
import type { Lang } from '../i18n/ui';

// Locale maps for consistent 3-language handling
const localeMap: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR' };

// Pillar name translations for meta descriptions
const pillarLabels: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'environment' },
  it: { conflict: 'conflitto', crime: 'criminalita', health: 'salute', governance: 'governance', environment: 'ambiente' },
  es: { conflict: 'conflicto', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'medio ambiente' },
  fr: { conflict: 'conflit', crime: 'criminalite', health: 'sante', governance: 'gouvernance', environment: 'environnement' },
  pt: { conflict: 'conflito', crime: 'criminalidade', health: 'saude', governance: 'governanca', environment: 'meio ambiente' },
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
  const sourceCount = country.sources.length || 3; // fallback: pipeline uses 3 public sources
  const name = country.name[lang];

  const roundedScore = score.toFixed(1);
  const templates: Record<Lang, string> = {
    en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). Top concern: ${weakestLabel} (${weakestScore}). Best: ${strongestLabel} (${strongestScore}). Free data from ${sourceCount}+ sources, updated daily. Check before you travel.`,
    it: `Punteggio sicurezza ${name}: ${roundedScore}/10 (${riskLevel}). Rischio principale: ${weakestLabel} (${weakestScore}). Punto forte: ${strongestLabel} (${strongestScore}). Dati gratuiti da ${sourceCount}+ fonti, aggiornati ogni giorno. Verifica prima di partire.`,
    es: `Seguridad de ${name}: ${roundedScore}/10 (${riskLevel}). Mayor riesgo: ${weakestLabel} (${weakestScore}). Punto fuerte: ${strongestLabel} (${strongestScore}). Datos gratuitos de ${sourceCount}+ fuentes, actualizados diariamente. Verifica antes de viajar.`,
    fr: `Securite de ${name} : ${roundedScore}/10 (${riskLevel}). Risque principal : ${weakestLabel} (${weakestScore}). Point fort : ${strongestLabel} (${strongestScore}). Donnees gratuites de ${sourceCount}+ sources, mises a jour chaque jour. Verifiez avant de partir.`,
    pt: `Seguranca de ${name}: ${roundedScore}/10 (${riskLevel}). Maior risco: ${weakestLabel} (${weakestScore}). Ponto forte: ${strongestLabel} (${strongestScore}). Dados gratuitos de ${sourceCount}+ fontes, atualizados diariamente. Verifique antes de viajar.`,
  };
  return templates[lang];
}

/**
 * Build JSON-LD structured data for a country detail page.
 * Uses @graph with WebPage and Place nodes.
 */
export function buildCountryJsonLd(country: ScoredCountry, lang: Lang, canonicalUrl: string, dateModified?: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: `${country.name[lang]} Safety Score`,
        description: buildCountryMetaDescription(country, lang),
        inLanguage: localeMap[lang],
        ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
      },
      {
        '@type': 'Place',
        name: country.name[lang],
        description: `Safety information for ${country.name[lang]}`,
      },
      buildCountryFaqJsonLd(country, lang),
      {
        '@type': 'TouristDestination',
        name: country.name[lang],
        description: `Travel safety information for ${country.name[lang]}. Safety score: ${country.score.toFixed(1)}/10 (${country.score >= 7 ? 'Low risk' : country.score >= 4 ? 'Moderate risk' : 'High risk'}). Data from IsItSafeToTravel.org, updated daily.`,
        touristType: country.score >= 7 ? 'All travelers including families' : country.score >= 4 ? 'General travelers' : 'Adventure travelers',
        url: canonicalUrl,
      },
      {
        '@type': 'Dataset',
        name: `${country.name[lang]} Travel Safety Data ${new Date().getFullYear()}`,
        description: `Daily updated safety scores for ${country.name[lang]}, covering conflict, crime, health, governance, and environment.`,
        url: canonicalUrl,
        license: 'https://creativecommons.org/licenses/by-nc/4.0/',
        temporalCoverage: '2025/..',
        creator: { '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org' },
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
        urlTemplate: `${siteUrl}/${lang}/country/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build JSON-LD structured data for the global safety page.
 * Uses WebPage schema with aggregateRating for the global score.
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
  };

  const descriptions: Record<Lang, string> = {
    en: `Current global safety score: ${globalScore.toFixed(1)}/10. Track world safety trends over time.`,
    it: `Punteggio di sicurezza globale attuale: ${globalScore.toFixed(1)}/10. Segui le tendenze di sicurezza mondiale nel tempo.`,
    es: `Puntuacion de seguridad global actual: ${globalScore.toFixed(1)}/10. Sigue las tendencias de seguridad mundial a lo largo del tiempo.`,
    fr: `Score de securite mondial actuel : ${globalScore.toFixed(1)}/10. Suivez les tendances de securite mondiale.`,
    pt: `Pontuacao de seguranca global atual: ${globalScore.toFixed(1)}/10. Acompanhe as tendencias de seguranca mundial.`,
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
 * Build FAQPage JSON-LD for a country page with 3 dynamic FAQ items.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 */
export function buildCountryFaqJsonLd(country: ScoredCountry, lang: Lang): Record<string, unknown> {
  const name = country.name[lang];
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
    fr: `Est-il sur de voyager au/en ${name} en ${year} ?`,
    pt: `E seguro viajar para ${name} em ${year}?`,
  };
  const a1: Record<Lang, string> = {
    en: `${name} has a safety score of ${roundedScore}/10, classified as ${riskLevel}. This score is updated daily using data from ${country.sources.length || 3}+ public sources including government advisories, health data, and conflict indicators.`,
    it: `${name} ha un punteggio di sicurezza di ${roundedScore}/10, classificato come ${riskLevel}. Questo punteggio viene aggiornato quotidianamente utilizzando dati da ${country.sources.length || 3}+ fonti pubbliche tra cui avvisi governativi, dati sanitari e indicatori di conflitto.`,
    es: `${name} tiene una puntuacion de seguridad de ${roundedScore}/10, clasificado como ${riskLevel}. Esta puntuacion se actualiza diariamente utilizando datos de ${country.sources.length || 3}+ fuentes publicas que incluyen avisos gubernamentales, datos de salud e indicadores de conflicto.`,
    fr: `${name} a un score de securite de ${roundedScore}/10, classe comme ${riskLevel}. Ce score est mis a jour quotidiennement a partir de ${country.sources.length || 3}+ sources publiques incluant les avis gouvernementaux, les donnees sanitaires et les indicateurs de conflit.`,
    pt: `${name} tem uma pontuacao de seguranca de ${roundedScore}/10, classificado como ${riskLevel}. Esta pontuacao e atualizada diariamente usando dados de ${country.sources.length || 3}+ fontes publicas incluindo avisos governamentais, dados de saude e indicadores de conflito.`,
  };

  // FAQ 2: What is the biggest risk when traveling to {country}?
  const q2: Record<Lang, string> = {
    en: `What is the biggest risk when traveling to ${name}?`,
    it: `Qual e il rischio maggiore viaggiando in ${name}?`,
    es: `Cual es el mayor riesgo al viajar a ${name}?`,
    fr: `Quel est le plus grand risque en voyageant au/en ${name} ?`,
    pt: `Qual e o maior risco ao viajar para ${name}?`,
  };
  const a2: Record<Lang, string> = {
    en: `The area of greatest concern for ${name} is ${weakestLabel}, with a score of ${weakestScore}/10. Travelers should pay particular attention to this aspect when planning their trip. Check the full pillar breakdown on this page for detailed insights.`,
    it: `L'area di maggiore preoccupazione per ${name} e ${weakestLabel}, con un punteggio di ${weakestScore}/10. I viaggiatori dovrebbero prestare particolare attenzione a questo aspetto quando pianificano il viaggio. Consulta la ripartizione completa dei pilastri in questa pagina per approfondimenti dettagliati.`,
    es: `El area de mayor preocupacion para ${name} es ${weakestLabel}, con una puntuacion de ${weakestScore}/10. Los viajeros deben prestar especial atencion a este aspecto al planificar su viaje. Consulta el desglose completo de pilares en esta pagina para obtener informacion detallada.`,
    fr: `Le domaine de plus grande preoccupation pour ${name} est ${weakestLabel}, avec un score de ${weakestScore}/10. Les voyageurs doivent accorder une attention particuliere a cet aspect lors de la planification de leur voyage. Consultez la repartition complete des piliers sur cette page pour des informations detaillees.`,
    pt: `A area de maior preocupacao para ${name} e ${weakestLabel}, com uma pontuacao de ${weakestScore}/10. Os viajantes devem prestar atencao especial a este aspecto ao planejar sua viagem. Consulte a divisao completa dos pilares nesta pagina para informacoes detalhadas.`,
  };

  // FAQ 3: Do I need travel insurance for {country}?
  const q3: Record<Lang, string> = {
    en: `Do I need travel insurance for ${name}?`,
    it: `Ho bisogno di un'assicurazione di viaggio per ${name}?`,
    es: `Necesito seguro de viaje para ${name}?`,
    fr: `Ai-je besoin d'une assurance voyage pour ${name} ?`,
    pt: `Preciso de seguro de viagem para ${name}?`,
  };
  const a3: Record<Lang, string> = {
    en: `Travel insurance is strongly recommended for any international trip, including visits to ${name}. A comprehensive policy should cover medical emergencies, trip cancellations, and evacuation. This is especially important given that health-related risks can change rapidly.`,
    it: `L'assicurazione di viaggio e fortemente raccomandata per qualsiasi viaggio internazionale, incluse le visite in ${name}. Una polizza completa dovrebbe coprire emergenze mediche, cancellazioni del viaggio ed evacuazione. Questo e particolarmente importante dato che i rischi legati alla salute possono cambiare rapidamente.`,
    es: `El seguro de viaje es altamente recomendable para cualquier viaje internacional, incluyendo visitas a ${name}. Una poliza integral debe cubrir emergencias medicas, cancelaciones de viaje y evacuacion. Esto es especialmente importante dado que los riesgos relacionados con la salud pueden cambiar rapidamente.`,
    fr: `L'assurance voyage est fortement recommandee pour tout voyage international, y compris les visites au/en ${name}. Une police complete devrait couvrir les urgences medicales, les annulations de voyage et l'evacuation. C'est particulierement important car les risques lies a la sante peuvent evoluer rapidement.`,
    pt: `O seguro de viagem e fortemente recomendado para qualquer viagem internacional, incluindo visitas a ${name}. Uma apolice abrangente deve cobrir emergencias medicas, cancelamentos de viagem e evacuacao. Isso e especialmente importante dado que os riscos relacionados a saude podem mudar rapidamente.`,
  };

  return {
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: q1[lang], acceptedAnswer: { '@type': 'Answer', text: a1[lang] } },
      { '@type': 'Question', name: q2[lang], acceptedAnswer: { '@type': 'Answer', text: a2[lang] } },
      { '@type': 'Question', name: q3[lang], acceptedAnswer: { '@type': 'Answer', text: a3[lang] } },
    ],
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
    url: 'https://isitsafetotravel.org',
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    temporalCoverage: '2025/..',
    spatialCoverage: 'Global',
    creator: { '@type': 'Organization', name: 'Is It Safe to Travel' },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: 'https://isitsafetotravel.org/scores.json',
    },
  };
}
