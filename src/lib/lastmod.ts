// --- Smart lastmod: only update when displayed content actually changes ---
// Shared by astro.config.mjs (sitemap lastmod) and the country page templates
// (JSON-LD dateModified + visible "Last update" date) so Google sees a single,
// consistent freshness signal.
import fs from 'node:fs';
import path from 'node:path';

export interface LastmodMap {
  countries: Record<string, string>;
  snapshotDate: string;
}

export function buildLastmodMap(): LastmodMap {
  const scoresDir = path.join(process.cwd(), 'data', 'scores');
  const latestPath = path.join(scoresDir, 'latest.json');
  if (!fs.existsSync(latestPath)) return { countries: {}, snapshotDate: new Date().toISOString() };

  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
  const snapshotDate: string = latest.date; // e.g. "2026-04-05"

  // Build fingerprint for each country from latest: scoreDisplay + pillar scores (1 decimal)
  const latestFingerprints: Record<string, string> = {};
  for (const c of latest.countries) {
    const pillarKey = c.pillars.map((p: { score: number }) => p.score.toFixed(1)).join(',');
    latestFingerprints[c.iso3] = `${c.scoreDisplay}|${pillarKey}`;
  }

  // Walk backwards through snapshot files to find when each country's fingerprint last changed
  const snapshotFiles = fs.readdirSync(scoresDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse(); // newest first

  const countryLastmod: Record<string, string> = {};
  const resolved = new Set<string>();

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
      const pillarKey = c.pillars.map((p: { score: number }) => p.score.toFixed(1)).join(',');
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

  // Nothing on the live site predates launch (2026-03-19). A placeholder page whose
  // displayed content matches all the way back through the historical backfill would
  // otherwise resolve to a 2012 lastmod — a false staleness signal in the sitemap.
  // Clamp every resolved date up to the launch floor.
  const SITE_LAUNCH = '2026-03-19';
  for (const iso3 of Object.keys(countryLastmod)) {
    if (countryLastmod[iso3] < SITE_LAUNCH) countryLastmod[iso3] = SITE_LAUNCH;
  }

  return { countries: countryLastmod, snapshotDate };
}

let cached: LastmodMap | null = null;

/** Lazy singleton — the map walks every snapshot file, so build it at most once per process. */
export function getLastmodMap(): LastmodMap {
  if (!cached) cached = buildLastmodMap();
  return cached;
}
