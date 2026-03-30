// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
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
        },
      },
      filter(page) {
        // Exclude root URL (it's a 302 redirect handled by Cloudflare Function)
        return page !== 'https://isitsafetotravel.org/';
      },
      serialize(item) {
        // Set lastmod to today's date (site rebuilds daily with fresh scores)
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'it', 'es', 'fr', 'pt'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
