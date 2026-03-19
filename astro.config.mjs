// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

// Cloudflare adapter: only in production (breaks getStaticPaths dev mode)
const adapter = process.env.CF_PAGES
  ? (await import('@astrojs/cloudflare')).default({ platformProxy: { enabled: true } })
  : undefined;

// https://astro.build/config
export default defineConfig({
  site: 'https://isitsafetotravels.com',
  ...(adapter && { adapter }),

  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          it: 'it',
        },
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@data': fileURLToPath(new URL('./data', import.meta.url)),
      },
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'it'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
