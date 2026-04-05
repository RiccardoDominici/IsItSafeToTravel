// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

// --- Smart lastmod: only update when displayed content actually changes ---
function buildLastmodMap() {
  const scoresDir = path.join(process.cwd(), 'data', 'scores');
  const latestPath = path.join(scoresDir, 'latest.json');
  if (!fs.existsSync(latestPath)) return { countries: {}, snapshotDate: new Date().toISOString() };

  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
  const snapshotDate = latest.date; // e.g. "2026-04-05"

  // Build fingerprint for each country from latest: scoreDisplay + pillar scores (1 decimal)
  const latestFingerprints = {};
  for (const c of latest.countries) {
    const pillarKey = c.pillars.map(p => p.score.toFixed(1)).join(',');
    latestFingerprints[c.iso3] = `${c.scoreDisplay}|${pillarKey}`;
  }

  // Walk backwards through snapshot files to find when each country's fingerprint last changed
  const snapshotFiles = fs.readdirSync(scoresDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse(); // newest first

  const countryLastmod = {};
  const resolved = new Set();

  for (let i = 0; i < snapshotFiles.length && resolved.size < 248; i++) {
    const file = snapshotFiles[i];
    const date = file.replace('.json', '');

    if (i === 0) {
      // Latest snapshot — all countries start with this date
      for (const iso3 of Object.keys(latestFingerprints)) {
        countryLastmod[iso3] = date;
      }
      continue;
    }

    const snap = JSON.parse(fs.readFileSync(path.join(scoresDir, file), 'utf-8'));
    for (const c of snap.countries) {
      if (resolved.has(c.iso3)) continue;
      const pillarKey = c.pillars.map(p => p.score.toFixed(1)).join(',');
      const fp = `${c.scoreDisplay}|${pillarKey}`;
      if (fp !== latestFingerprints[c.iso3]) {
        // Fingerprint differs — the previous (newer) date was when it changed
        resolved.add(c.iso3);
      } else {
        // Same fingerprint — push lastmod further back
        countryLastmod[c.iso3] = date;
      }
    }
  }

  return { countries: countryLastmod, snapshotDate };
}

const lastmodMap = buildLastmodMap();

// Country route slugs per language (to extract ISO3 from URLs)
const countryRouteSlugs = ['country', 'paese', 'pais', 'pays'];

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
        return item;
      },
      // Split sitemap by language for better crawl efficiency
      chunks: {
        en: (item) => item.url.includes('/en/') ? item : undefined,
        it: (item) => item.url.includes('/it/') ? item : undefined,
        es: (item) => item.url.includes('/es/') ? item : undefined,
        fr: (item) => item.url.includes('/fr/') ? item : undefined,
        pt: (item) => item.url.includes('/pt/') ? item : undefined,
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
