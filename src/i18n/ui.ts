export const languages = {
  en: 'English',
  it: 'Italiano',
} as const;

export const defaultLang = 'en' as const;
export type Lang = keyof typeof languages;

export const ui = {
  en: {
    'site.title': 'Is It Safe to Travel?',
    'site.description': 'Check safety scores for 200+ travel destinations worldwide, backed by transparent data from trusted public sources.',
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.methodology': 'Methodology',
    'hero.title': 'Is your destination safe?',
    'hero.subtitle': 'Real-time safety scores for every country, powered by open data.',
    'placeholder.coming_soon': 'Interactive safety map coming soon.',
    'placeholder.description': 'We are building a transparent, data-driven travel safety platform. Check back soon for safety scores covering 200+ countries.',
    'footer.disclaimer': 'This information is aggregated from public sources for informational purposes only. Always consult your government\'s official travel advisory before traveling.',
    'footer.sources': 'Sources',
    'footer.methodology': 'Methodology',
    'footer.legal': 'Legal',
    'language.switch': 'Switch language',
    'darkmode.toggle': 'Toggle dark mode',
  },
  it: {
    'site.title': 'Si Puo Viaggiare in Sicurezza?',
    'site.description': 'Consulta i punteggi di sicurezza per oltre 200 destinazioni di viaggio nel mondo, basati su dati trasparenti da fonti pubbliche affidabili.',
    'nav.home': 'Home',
    'nav.about': 'Chi Siamo',
    'nav.methodology': 'Metodologia',
    'hero.title': 'La tua destinazione e sicura?',
    'hero.subtitle': 'Punteggi di sicurezza aggiornati per ogni paese, basati su dati aperti.',
    'placeholder.coming_soon': 'Mappa interattiva di sicurezza in arrivo.',
    'placeholder.description': 'Stiamo costruendo una piattaforma di sicurezza dei viaggi trasparente e basata sui dati. Torna presto per i punteggi di sicurezza di oltre 200 paesi.',
    'footer.disclaimer': 'Queste informazioni sono aggregate da fonti pubbliche a solo scopo informativo. Consulta sempre l\'avviso di viaggio ufficiale del tuo governo prima di viaggiare.',
    'footer.sources': 'Fonti',
    'footer.methodology': 'Metodologia',
    'footer.legal': 'Note Legali',
    'language.switch': 'Cambia lingua',
    'darkmode.toggle': 'Cambia tema',
  },
} as const;

// Translated route slugs for SEO
export const routes = {
  en: {
    country: 'country',
    about: 'about',
    methodology: 'methodology',
  },
  it: {
    country: 'paese',
    about: 'chi-siamo',
    methodology: 'metodologia',
  },
} as const;
