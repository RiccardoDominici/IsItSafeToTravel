// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { getAlternateLinks, getLocalizedPath } from './src/i18n/utils';
import { buildLastmodMap } from './src/lib/lastmod';

// Smart lastmod (only updates when displayed content actually changes) — shared
// with the country page templates via src/lib/lastmod.ts so JSON-LD dateModified
// and the sitemap lastmod stay consistent.
const lastmodMap = buildLastmodMap();

// Country route slugs per language (to extract ISO3 from URLs)
const countryRouteSlugs = ['country', 'paese', 'pais', 'pays', 'land'];

function getCountryIso3FromUrl(url) {
  const urlPath = new URL(url).pathname;
  const segments = urlPath.split('/').filter(Boolean);
  // Pattern: /{lang}/{countrySlug}/{iso3}/
  if (segments.length >= 3 && countryRouteSlugs.includes(segments[1])) {
    return segments[2].toUpperCase();
  }
  return null;
}

// https://astro.build/config
export default defineConfig({
  site: 'https://isitsafetotravel.org',
  outDir: './dist/client',
  trailingSlash: 'always',

  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          it: 'it',
          es: 'es',
          fr: 'fr',
          pt: 'pt',
          zh: 'zh',
          de: 'de',
        },
      },
      filter(page) {
        // Exclude root URL (it's a 302 redirect handled by Cloudflare Function)
        return page !== 'https://isitsafetotravel.org/';
      },
      serialize(item) {
        const iso3 = getCountryIso3FromUrl(item.url);
        if (iso3 && lastmodMap.countries[iso3]) {
          // Country page: use the date when its displayed content last changed
          item.lastmod = new Date(lastmodMap.countries[iso3] + 'T00:00:00Z').toISOString();
        } else {
          // Non-country pages (homepage, about, etc.): use latest data snapshot date
          item.lastmod = new Date(lastmodMap.snapshotDate + 'T00:00:00Z').toISOString();
        }
        // Slug-aware hreflang alternates. Astro's built-in i18n matcher groups URLs by
        // their literal de-localed path, which fails for translated slugs (/country/ vs
        // /paese/ vs /pays/ vs /land/) — leaving the it/fr/de sitemaps with almost no
        // alternates. Rebuild links from the same route map the HTML <head> uses so
        // every page advertises all 7 localized URLs + x-default.
        const pathname = new URL(item.url).pathname;
        item.links = [
          ...getAlternateLinks(pathname).map(({ lang, href }) => ({
            lang,
            url: new URL(href, 'https://isitsafetotravel.org').href,
          })),
          { lang: 'x-default', url: new URL(getLocalizedPath(pathname, 'en'), 'https://isitsafetotravel.org').href },
        ];
        return item;
      },
      // Split sitemap by language for better crawl efficiency
      chunks: {
        en: (item) => item.url.includes('/en/') ? item : undefined,
        it: (item) => item.url.includes('/it/') ? item : undefined,
        es: (item) => item.url.includes('/es/') ? item : undefined,
        fr: (item) => item.url.includes('/fr/') ? item : undefined,
        pt: (item) => item.url.includes('/pt/') ? item : undefined,
        zh: (item) => item.url.includes('/zh/') ? item : undefined,
        de: (item) => item.url.includes('/de/') ? item : undefined,
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
