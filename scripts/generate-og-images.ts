/**
 * Build-time OG image generator.
 * Produces 1200x630 PNG images for every country page (with score badge)
 * plus a generic branded default image for non-country pages.
 *
 * Usage: npx tsx scripts/generate-og-images.ts
 */

import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

interface CountryData {
  iso3: string;
  name: Record<string, string>;
  score: number;
}

interface LatestData {
  countries: CountryData[];
}

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'og');
const SCORES_PATH = path.join(process.cwd(), 'data', 'scores', 'latest.json');

function scoreColor(score: number): string {
  if (score >= 7) return '#22c55e';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildCountrySvg(name: string, score: number): string {
  const color = scoreColor(score);
  const displayScore = score.toFixed(1);
  const escapedName = escapeXml(name);
  // Adjust font size for long country names
  const nameFontSize = name.length > 28 ? 44 : name.length > 20 ? 52 : 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f0eb"/>
      <stop offset="100%" stop-color="#ede6dd"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" fill="none" stroke="#ddd" stroke-width="2" rx="0"/>

  <!-- Site name -->
  <text x="48" y="60" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#888" font-weight="600">IsItSafeToTravel</text>

  <!-- Country name -->
  <text x="600" y="240" font-family="Arial, Helvetica, sans-serif" font-size="${nameFontSize}" fill="#1a1a1a" font-weight="700" text-anchor="middle">${escapedName}</text>

  <!-- Score badge background -->
  <circle cx="600" cy="380" r="80" fill="${color}" opacity="0.15"/>
  <circle cx="600" cy="380" r="72" fill="${color}" opacity="0.25"/>

  <!-- Score number -->
  <text x="600" y="400" font-family="Arial, Helvetica, sans-serif" font-size="80" fill="${color}" font-weight="700" text-anchor="middle">${displayScore}</text>
  <text x="600" y="440" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${color}" font-weight="400" text-anchor="middle">/10</text>

  <!-- Bottom text -->
  <text x="600" y="580" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#666" text-anchor="middle">Safety Score - Updated Daily</text>
</svg>`;
}

function buildDefaultSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f0eb"/>
      <stop offset="100%" stop-color="#ede6dd"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" fill="none" stroke="#ddd" stroke-width="2" rx="0"/>

  <!-- Site name large -->
  <text x="600" y="240" font-family="Arial, Helvetica, sans-serif" font-size="72" fill="#1a1a1a" font-weight="700" text-anchor="middle">IsItSafeToTravel</text>

  <!-- Tagline -->
  <text x="600" y="320" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#555" font-weight="400" text-anchor="middle">Travel Safety Scores for 248 Countries</text>

  <!-- Sub-tagline -->
  <text x="600" y="380" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#888" font-weight="400" text-anchor="middle">Free - Open Source - Updated Daily</text>

  <!-- Decorative score circles -->
  <circle cx="300" cy="490" r="30" fill="#22c55e" opacity="0.2"/>
  <circle cx="600" cy="490" r="30" fill="#f59e0b" opacity="0.2"/>
  <circle cx="900" cy="490" r="30" fill="#ef4444" opacity="0.2"/>
  <text x="300" y="498" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#22c55e" font-weight="600" text-anchor="middle">Safe</text>
  <text x="600" y="498" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#f59e0b" font-weight="600" text-anchor="middle">Caution</text>
  <text x="900" y="498" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#ef4444" font-weight="600" text-anchor="middle">Unsafe</text>
</svg>`;
}

function renderPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

function main(): void {
  // Load scores
  if (!fs.existsSync(SCORES_PATH)) {
    console.error(`Scores file not found: ${SCORES_PATH}`);
    process.exit(1);
  }

  const data: LatestData = JSON.parse(fs.readFileSync(SCORES_PATH, 'utf-8'));
  const countries = data.countries;

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Generate country images
  let count = 0;
  for (const country of countries) {
    const name = country.name.en; // Use English name for OG images (universal)
    const svg = buildCountrySvg(name, country.score);
    const png = renderPng(svg);
    const filename = `country-${country.iso3.toLowerCase()}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), png);
    count++;
  }

  // Generate default image
  const defaultSvg = buildDefaultSvg();
  const defaultPng = renderPng(defaultSvg);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'default.png'), defaultPng);
  count++;

  console.log(`Generated ${count} OG images in ${OUTPUT_DIR}`);
}

main();
