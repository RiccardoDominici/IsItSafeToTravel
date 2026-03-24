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

  const templates: Record<Lang, string> = {
    en: `${name} safety score: ${score}/10. ${riskLevel} destination. Strongest: ${strongestLabel} (${strongestScore}). Top concern: ${weakestLabel} (${weakestScore}). Updated daily from ${sourceCount}+ public sources.`,
    it: `Punteggio di sicurezza ${name}: ${score}/10. Destinazione a ${riskLevel}. Punto forte: ${strongestLabel} (${strongestScore}). Principale preoccupazione: ${weakestLabel} (${weakestScore}). Aggiornato quotidianamente da ${sourceCount}+ fonti pubbliche.`,
    es: `Puntuacion de seguridad de ${name}: ${score}/10. Destino de ${riskLevel}. Punto fuerte: ${strongestLabel} (${strongestScore}). Principal preocupacion: ${weakestLabel} (${weakestScore}). Actualizado diariamente de ${sourceCount}+ fuentes publicas.`,
    fr: `Score de securite de ${name} : ${score}/10. Destination a ${riskLevel}. Point fort : ${strongestLabel} (${strongestScore}). Principale preoccupation : ${weakestLabel} (${weakestScore}). Mis a jour quotidiennement a partir de ${sourceCount}+ sources publiques.`,
    pt: `Pontuacao de seguranca de ${name}: ${score}/10. Destino de ${riskLevel}. Ponto forte: ${strongestLabel} (${strongestScore}). Principal preocupacao: ${weakestLabel} (${weakestScore}). Atualizado diariamente de ${sourceCount}+ fontes publicas.`,
  };
  return templates[lang];
}

/**
 * Build JSON-LD structured data for a country detail page.
 * Uses @graph with WebPage and Place nodes.
 */
export function buildCountryJsonLd(country: ScoredCountry, lang: Lang, canonicalUrl: string): Record<string, unknown> {
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
      },
      {
        '@type': 'Place',
        name: country.name[lang],
        description: `Safety information for ${country.name[lang]}`,
      },
    ],
  };
}

/**
 * Build JSON-LD structured data for the homepage.
 * Includes WebSite schema with SearchAction.
 */
export function buildHomepageJsonLd(siteUrl: string, lang: Lang): Record<string, unknown> {
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
  };
}

/**
 * Build simple WebPage JSON-LD for static pages (methodology, legal).
 */
export function buildWebPageJsonLd(title: string, description: string, canonicalUrl: string, lang: Lang): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: localeMap[lang],
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
