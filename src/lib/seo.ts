import type { ScoredCountry, PillarName } from '../pipeline/types';
import type { Lang } from '../i18n/ui';

// Pillar name translations for meta descriptions
const pillarLabels: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'environment' },
  it: { conflict: 'conflitto', crime: 'criminalita', health: 'salute', governance: 'governance', environment: 'ambiente' },
};

/**
 * Generate a unique meta description for a country page based on score data.
 * Each country gets a differentiated description using its score, risk level,
 * strongest pillar, and weakest pillar.
 */
export function buildCountryMetaDescription(country: ScoredCountry, lang: Lang): string {
  const score = country.score;

  // Determine risk level
  let riskLevel: string;
  if (lang === 'en') {
    riskLevel = score >= 7 ? 'Low risk' : score >= 4 ? 'Moderate risk' : 'High risk';
  } else {
    riskLevel = score >= 7 ? 'rischio basso' : score >= 4 ? 'rischio moderato' : 'rischio alto';
  }

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

  if (lang === 'en') {
    return `${name} safety score: ${score}/10. ${riskLevel} destination. Strongest: ${strongestLabel} (${strongestScore}). Top concern: ${weakestLabel} (${weakestScore}). Updated daily from ${sourceCount}+ public sources.`;
  } else {
    return `Punteggio di sicurezza ${name}: ${score}/10. Destinazione a ${riskLevel}. Punto forte: ${strongestLabel} (${strongestScore}). Principale preoccupazione: ${weakestLabel} (${weakestScore}). Aggiornato quotidianamente da ${sourceCount}+ fonti pubbliche.`;
  }
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
        inLanguage: lang === 'it' ? 'it-IT' : 'en-US',
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
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: lang === 'en'
      ? 'Find out how safe your travel destination is'
      : 'Scopri quanto e sicura la tua destinazione di viaggio',
    inLanguage: lang === 'it' ? 'it-IT' : 'en-US',
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
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: lang === 'en' ? 'Global Safety Score' : 'Punteggio di Sicurezza Globale',
        description: lang === 'en'
          ? `Current global safety score: ${globalScore.toFixed(1)}/10. Track world safety trends over time.`
          : `Punteggio di sicurezza globale attuale: ${globalScore.toFixed(1)}/10. Segui le tendenze di sicurezza mondiale nel tempo.`,
        inLanguage: lang === 'it' ? 'it-IT' : 'en-US',
      },
      {
        '@type': 'AggregateRating',
        ratingValue: globalScore.toFixed(1),
        bestRating: '10',
        worstRating: '1',
        ratingCount: 248,
        itemReviewed: {
          '@type': 'Place',
          name: lang === 'en' ? 'World' : 'Mondo',
        },
      },
    ],
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
    inLanguage: lang === 'it' ? 'it-IT' : 'en-US',
  };
}
