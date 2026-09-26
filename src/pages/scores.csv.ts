import type { APIRoute } from 'astro';
import { loadLatestSnapshot } from '../lib/scores';
import { buildScoresCsv } from '../lib/dataset-csv';

export const prerender = true;

// Tabular twin of /scores.json: one row per country (see src/lib/dataset-csv.ts
// for the shared column-building logic, also reused by the monthly GitHub
// Release script in scripts/generate-data-release.ts).
//
// NOTE on the Content-Type header below: this site has no server adapter
// configured (astro.config.mjs has no `adapter`), so Astro's static build
// discards every prerendered Response's headers when writing the output file
// (astro/dist/core/build/generate.js only captures them when
// settings.adapter?.adapterFeatures?.staticHeaders is set). The header that
// actually reaches browsers in production comes from public/_headers, which
// carries the same `Content-Type: text/csv; charset=utf-8` explicitly (Cloudflare
// Pages' own extension-based MIME guess for .csv omits the charset). The header
// set here only takes effect in `astro dev` / `astro preview`, but is kept for
// parity and because it's the technically correct thing for this endpoint to
// declare regardless of how any given host serves the static file.
export const GET: APIRoute = () => {
  const snapshot = loadLatestSnapshot();
  const csv = snapshot ? buildScoresCsv(snapshot) : '';
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
};
