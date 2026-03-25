// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
// https://astro.build/config
export default defineConfig({
  site: 'https://isitsafetotravel.org',
  outDir: './dist/client',

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
      serialize(item) {
        // Set lastmod to today's date (site rebuilds daily with fresh scores)
        item.lastmod = new Date().toISOString().split('T')[0];
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
