/**
 * Short menu/footer labels for the Rankings dropdown, the mobile menu and the
 * footer (2026-09-26 nav restructure).
 *
 * WHY this module exists: the site's own page titles are long, keyword-shaped
 * SEO strings ("Safest Countries for Solo Travelers (2026)", "Travel Safety
 * Index: …") that read fine as an `<h1>` but overflow a menu column or wrap
 * to two lines in a footer row. This module holds the short, parallel forms
 * used ONLY in navigation chrome (Header.astro, Footer.astro) — never in
 * page titles/H1s/meta, which keep their own full copy. Kept out of ui.ts
 * (merge hot spot several other workstreams edit this same round) like the
 * page-specific `*-copy.ts` modules.
 *
 * Casing: English uses Title Case like the rest of the menu (small
 * prepositions lower-case, matching the site's existing hub titles, e.g.
 * "Safest Countries **to** Visit"); it/es/fr/pt use native sentence case;
 * German capitalises nouns per its own grammar (not a Title Case rule); zh
 * uses natural, particle-free phrasing. Spelling: American English
 * throughout ("traveler(s)"), matching the site's existing hub.*.title
 * strings (48 occurrences of "traveler(s)" in ui.ts vs. zero "traveller(s)").
 *
 * 2026-09-26 restructure: the Rankings dropdown grew to one long column
 * mixing full SEO titles with short labels (owner feedback: "cluttered").
 * Replaced by a two-column panel, short parallel labels grouped under small
 * section headings — see Header.astro / Footer.astro. `countriesToAvoid` is
 * a NEW nav link: the `/countries-to-avoid/` hub page (routes.ts key
 * `countries-to-avoid`) existed already but had no header/footer entry.
 */
import type { Lang } from './ui';

export interface NavExtraCopy {
  /** Column-2 section heading over allGovernmentsCompared/whereTheyDisagree. */
  governmentGroup: string;
  /** Column-2 second section heading over whatTravelersSay. */
  travelersGroup: string;

  /** → routes.travel-safety-index. First item in the Rankings column, rendered slightly emphasised (it's the flagship page). */
  fullRanking: string;
  /** → routes.safest-countries. */
  safestCountries: string;
  /** → routes.most-dangerous-countries. */
  mostDangerousCountries: string;
  /** → routes.countries-to-avoid (see file header: previously unlinked from nav/footer). */
  countriesToAvoid: string;
  /** → routes.regions (the region index page itself lists its sub-regions — no need to repeat them here). */
  byRegion: string;
  /** → routes.safest-for-solo-travelers. */
  forSoloTravelers: string;
  /** → routes.safest-for-families. */
  forFamilies: string;

  /** → routes.government-advisories (the hub). */
  allGovernmentsCompared: string;
  /** → routes.governments-disagree. */
  whereTheyDisagree: string;
  /** → routes.community-vs-data (renamed page, see community-vs-data-copy.ts). */
  whatTravelersSay: string;
}

export const navExtraCopy: Record<Lang, NavExtraCopy> = {
  en: {
    governmentGroup: 'Government Advisories',
    travelersGroup: 'Travelers',
    fullRanking: 'Full Ranking',
    safestCountries: 'Safest Countries',
    mostDangerousCountries: 'Most Dangerous Countries',
    countriesToAvoid: 'Countries to Avoid',
    byRegion: 'By Region',
    forSoloTravelers: 'For Solo Travelers',
    forFamilies: 'For Families',
    allGovernmentsCompared: 'Compare Governments',
    whereTheyDisagree: 'Where They Disagree',
    whatTravelersSay: 'What Travelers Say',
  },
  it: {
    governmentGroup: 'Avvisi dei governi',
    travelersGroup: 'Viaggiatori',
    fullRanking: 'Classifica completa',
    safestCountries: 'Paesi più sicuri',
    mostDangerousCountries: 'Paesi più pericolosi',
    countriesToAvoid: 'Paesi da evitare',
    byRegion: 'Per regione',
    forSoloTravelers: 'Per chi viaggia da solo',
    forFamilies: 'Per famiglie',
    allGovernmentsCompared: 'Tutti i governi a confronto',
    whereTheyDisagree: "Dove non sono d'accordo",
    whatTravelersSay: 'Il parere dei viaggiatori',
  },
  es: {
    governmentGroup: 'Avisos gubernamentales',
    travelersGroup: 'Viajeros',
    fullRanking: 'Clasificación completa',
    safestCountries: 'Países más seguros',
    mostDangerousCountries: 'Países más peligrosos',
    countriesToAvoid: 'Países a evitar',
    byRegion: 'Por región',
    forSoloTravelers: 'Para viajar en solitario',
    forFamilies: 'Para familias',
    allGovernmentsCompared: 'Gobiernos comparados',
    whereTheyDisagree: 'Dónde discrepan',
    whatTravelersSay: 'La opinión de los viajeros',
  },
  fr: {
    governmentGroup: 'Avis des gouvernements',
    travelersGroup: 'Voyageurs',
    fullRanking: 'Classement complet',
    safestCountries: 'Pays les plus sûrs',
    mostDangerousCountries: 'Pays les plus dangereux',
    countriesToAvoid: 'Pays à éviter',
    byRegion: 'Par région',
    forSoloTravelers: 'Pour voyager seul',
    forFamilies: 'Pour les familles',
    allGovernmentsCompared: 'Gouvernements comparés',
    whereTheyDisagree: 'Où ils divergent',
    whatTravelersSay: "L'avis des voyageurs",
  },
  pt: {
    governmentGroup: 'Alertas dos governos',
    travelersGroup: 'Viajantes',
    fullRanking: 'Classificação completa',
    safestCountries: 'Países mais seguros',
    mostDangerousCountries: 'Países mais perigosos',
    countriesToAvoid: 'Países a evitar',
    byRegion: 'Por região',
    forSoloTravelers: 'Para quem viaja sozinho',
    forFamilies: 'Para famílias',
    allGovernmentsCompared: 'Governos comparados',
    whereTheyDisagree: 'Onde divergem',
    whatTravelersSay: 'A opinião dos viajantes',
  },
  zh: {
    governmentGroup: '政府警示',
    travelersGroup: '旅行者',
    fullRanking: '完整排行',
    safestCountries: '最安全国家',
    mostDangerousCountries: '最危险国家',
    countriesToAvoid: '应避免的国家',
    byRegion: '按地区',
    forSoloTravelers: '独自旅行',
    forFamilies: '家庭旅行',
    allGovernmentsCompared: '各国政府对比',
    whereTheyDisagree: '各国分歧',
    whatTravelersSay: '旅行者怎么说',
  },
  de: {
    governmentGroup: 'Reisewarnungen',
    travelersGroup: 'Reisende',
    fullRanking: 'Gesamtrangliste',
    safestCountries: 'Sicherste Länder',
    mostDangerousCountries: 'Gefährlichste Länder',
    countriesToAvoid: 'Zu meidende Länder',
    byRegion: 'Nach Region',
    forSoloTravelers: 'Für Alleinreisende',
    forFamilies: 'Für Familien',
    allGovernmentsCompared: 'Regierungen im Vergleich',
    whereTheyDisagree: 'Wo sie uneins sind',
    whatTravelersSay: 'Was Reisende sagen',
  },
};
