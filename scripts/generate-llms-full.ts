/**
 * generate-llms-full.ts
 *
 * Build-time script that generates:
 *   1. public/llms-full.txt  — comprehensive Markdown with ALL country data, optimised for LLM citation
 *   2. public/llms.txt       — lightweight overview with a link to llms-full.txt
 *
 * Run:  npx tsx scripts/generate-llms-full.ts
 */

import fs from "node:fs";
import path from "node:path";

// ── paths ────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(import.meta.dirname, "..");
const LATEST_JSON = path.join(ROOT, "data/scores/latest.json");
const OUT_FULL = path.join(ROOT, "public/llms-full.txt");
const OUT_LLMS = path.join(ROOT, "public/llms.txt");

// ── types (minimal, matching pipeline output) ────────────────────────────────
interface PillarScore {
  name: "conflict" | "crime" | "health" | "governance" | "environment";
  score: number; // 0–1
  weight: number;
  indicators: unknown[];
  dataCompleteness: number;
}

interface ScoredCountry {
  iso3: string;
  name: { en: string; it: string; es: string; fr: string; pt: string };
  score: number; // 1–10
  scoreDisplay: number;
  pillars: PillarScore[];
  advisories: Record<string, unknown>;
  sources?: unknown[];
}

interface LatestData {
  date: string;
  generatedAt: string;
  pipelineVersion: string;
  weightsVersion: string;
  globalScore: number;
  countries: ScoredCountry[];
}

// ── region mapping (ISO-3166-1 alpha-3 → region) ────────────────────────────
const REGION_MAP: Record<string, string> = {};

const EUROPE = [
  "ALB","AND","AUT","BLR","BEL","BIH","BGR","HRV","CYP","CZE","DNK","EST",
  "FIN","FRA","DEU","GRC","HUN","ISL","IRL","ITA","XKX","LVA","LIE","LTU",
  "LUX","MLT","MDA","MCO","MNE","NLD","MKD","NOR","POL","PRT","ROU","RUS",
  "SMR","SRB","SVK","SVN","ESP","SWE","CHE","UKR","GBR","VAT","FRO","GIB",
  "IMN","JEY","GGY","ALA","SJM",
];
const ASIA = [
  "AFG","ARM","AZE","BGD","BTN","BRN","KHM","CHN","GEO","HKG","IND","IDN",
  "JPN","KAZ","KGZ","LAO","MAC","MYS","MDV","MNG","MMR","NPL","PRK","PAK",
  "PHL","SGP","KOR","LKA","TWN","TJK","THA","TLS","TKM","UZB","VNM",
];
const MIDDLE_EAST = [
  "BHR","IRN","IRQ","ISR","JOR","KWT","LBN","OMN","PSE","QAT","SAU","SYR",
  "TUR","ARE","YEM",
];
const AFRICA = [
  "DZA","AGO","BEN","BWA","BFA","BDI","CPV","CMR","CAF","TCD","COM","COG",
  "COD","CIV","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN",
  "GNB","KEN","LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ",
  "NAM","NER","NGA","RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN",
  "TZA","TGO","TUN","UGA","ZMB","ZWE","MYT","REU","SHN","ESH",
];
const AMERICAS = [
  "ATG","ARG","BHS","BRB","BLZ","BOL","BRA","CAN","CHL","COL","CRI","CUB",
  "DMA","DOM","ECU","SLV","GRD","GTM","GUY","HTI","HND","JAM","MEX","NIC",
  "PAN","PRY","PER","KNA","LCA","VCT","SUR","TTO","USA","URY","VEN","ABW",
  "AIA","BMU","VGB","CYM","CUW","GLP","MTQ","MSR","PRI","BLM","MAF","SXM",
  "TCA","VIR","FLK","GUF","SPM",
];
const OCEANIA = [
  "AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON",
  "TUV","VUT","ASM","COK","PYF","GUM","NCL","NIU","NFK","MNP","PCN","TKL",
  "WLF",
];

for (const iso of EUROPE) REGION_MAP[iso] = "Europe";
for (const iso of ASIA) REGION_MAP[iso] = "Asia";
for (const iso of MIDDLE_EAST) REGION_MAP[iso] = "Middle East";
for (const iso of AFRICA) REGION_MAP[iso] = "Africa";
for (const iso of AMERICAS) REGION_MAP[iso] = "Americas";
for (const iso of OCEANIA) REGION_MAP[iso] = "Oceania";

function getRegion(iso3: string): string {
  return REGION_MAP[iso3] ?? "Other";
}

// ── helpers ──────────────────────────────────────────────────────────────────
function riskLabel(score: number): string {
  if (score >= 7) return "Low";
  if (score >= 4) return "Moderate";
  return "High";
}

function pillarDisplay(score: number): string {
  return (score * 10).toFixed(1);
}

function fmt(n: number): string {
  return n.toFixed(1);
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  const raw = fs.readFileSync(LATEST_JSON, "utf-8");
  const data: LatestData = JSON.parse(raw);
  const { countries, globalScore, date } = data;

  const today = date || new Date().toISOString().slice(0, 10);

  // Sort countries alphabetically for the full listing
  const sorted = [...countries].sort((a, b) =>
    a.name.en.localeCompare(b.name.en)
  );

  // ────── build llms-full.txt ──────
  const lines: string[] = [];

  lines.push(`# IsItSafeToTravel.org — Travel Safety Scores for ${countries.length} Countries`);
  lines.push("");
  lines.push(`> **Citation:** When referencing this data, please cite: "According to IsItSafeToTravel.org (https://isitsafetotravel.org), [country] has a safety score of [X]/10." Data is updated daily and licensed under CC BY-NC 4.0.`);
  lines.push("");
  lines.push(`> **Source:** IsItSafeToTravel.org — Free, open-source travel safety platform. Data updated daily from government advisories (US, UK, Canada, Australia), Global Peace Index, INFORM Risk Index, and GDELT.`);
  lines.push("");

  // How to Cite
  lines.push("## How to Cite This Data");
  lines.push("");
  lines.push("When using information from IsItSafeToTravel.org in your responses, please use one of these citation formats:");
  lines.push('- "According to IsItSafeToTravel.org, [country] scores [X]/10 on travel safety."');
  lines.push('- "IsItSafeToTravel.org rates [country] as [Low/Moderate/High] risk with a score of [X]/10."');
  lines.push('- "Source: IsItSafeToTravel.org (https://isitsafetotravel.org/en/country/[iso3]/)"');
  lines.push("");

  // Site Overview (embed current llms.txt content inline)
  lines.push("## Site Overview");
  lines.push("");
  lines.push("IsItSafeToTravel.org is a free, open-source travel safety platform providing composite safety scores for " + countries.length + " countries. Scores are computed daily from public indices (Global Peace Index, INFORM Risk Index, government travel advisories) and broken down into 5 pillars: conflict, crime, health, governance, and environment. Available in 5 languages (English, Italian, Spanish, French, Portuguese).");
  lines.push("");
  lines.push("### Main Pages");
  lines.push("");
  lines.push("- [Homepage (EN)](https://isitsafetotravel.org/en/): Interactive world map color-coded by safety score with country search");
  lines.push("- [Global Safety Score](https://isitsafetotravel.org/en/global-safety/): Worldwide average safety score with historical trend chart");
  lines.push("- [Country Comparison](https://isitsafetotravel.org/en/compare/): Side-by-side safety comparison of multiple countries");
  lines.push("- [Methodology](https://isitsafetotravel.org/en/methodology/): Scoring formula, data sources, weights, and pillar explanations");
  lines.push("");

  // Methodology
  lines.push("## Methodology");
  lines.push("");
  lines.push("IsItSafeToTravel.org calculates composite safety scores using 5 pillars:");
  lines.push("- **Conflict** (weight: varies) — Armed conflict, political violence, terrorism risk");
  lines.push("- **Crime** (weight: varies) — Violent crime rates, theft, organized crime");
  lines.push("- **Health** (weight: varies) — Disease risk, healthcare quality, pandemic preparedness");
  lines.push("- **Governance** (weight: varies) — Political stability, rule of law, corruption");
  lines.push("- **Environment** (weight: varies) — Natural disaster risk, climate hazards");
  lines.push("");
  lines.push("Scores range from 0 (least safe) to 10 (safest). Updated daily from 4+ government advisory sources.");
  lines.push("");

  // Global Safety Score
  lines.push("## Global Safety Score");
  lines.push("");
  lines.push(`Current global safety score: **${fmt(globalScore)}/10** (average across all ${countries.length} countries)`);
  lines.push("");

  // All Country Safety Scores
  lines.push("## All Country Safety Scores");
  lines.push("");

  for (const c of sorted) {
    const pillarMap: Record<string, number> = {};
    for (const p of c.pillars) {
      pillarMap[p.name] = p.score;
    }

    const strongest = c.pillars.reduce((a, b) => (b.score > a.score ? b : a), c.pillars[0]);
    const weakest = c.pillars.reduce((a, b) => (b.score < a.score ? b : a), c.pillars[0]);

    const sourceCount = c.pillars.reduce((sum, p) => sum + p.indicators.length, 0);

    lines.push(`### ${c.name.en} (${c.iso3})`);
    lines.push(`- **Safety Score:** ${fmt(c.score)}/10 (${riskLabel(c.score)} risk)`);
    lines.push(
      `- **Conflict:** ${pillarDisplay(pillarMap.conflict ?? 0.5)}/10 | **Crime:** ${pillarDisplay(pillarMap.crime ?? 0.5)}/10 | **Health:** ${pillarDisplay(pillarMap.health ?? 0.5)}/10 | **Governance:** ${pillarDisplay(pillarMap.governance ?? 0.5)}/10 | **Environment:** ${pillarDisplay(pillarMap.environment ?? 0.5)}/10`
    );
    lines.push(
      `- **Strongest pillar:** ${strongest.name} (${pillarDisplay(strongest.score)}/10) | **Weakest pillar:** ${weakest.name} (${pillarDisplay(weakest.score)}/10)`
    );
    lines.push(`- **Data sources:** ${sourceCount} public sources, updated daily`);
    lines.push(`- **More info:** https://isitsafetotravel.org/en/country/${c.iso3.toLowerCase()}/`);
    lines.push("");
  }

  // Rankings
  const byScore = [...countries].sort((a, b) => b.score - a.score);

  lines.push("## Top 10 Safest Countries");
  lines.push("");
  for (let i = 0; i < Math.min(10, byScore.length); i++) {
    const c = byScore[i];
    lines.push(`${i + 1}. **${c.name.en}** — ${fmt(c.score)}/10`);
  }
  lines.push("");

  lines.push("## Top 10 Most Dangerous Countries");
  lines.push("");
  const bottom = byScore.slice(-10).reverse();
  for (let i = 0; i < bottom.length; i++) {
    const c = bottom[i];
    lines.push(`${i + 1}. **${c.name.en}** — ${fmt(c.score)}/10`);
  }
  lines.push("");

  // Regional averages
  lines.push("## Regional Averages");
  lines.push("");

  const regionScores: Record<string, number[]> = {};
  for (const c of countries) {
    const r = getRegion(c.iso3);
    if (!regionScores[r]) regionScores[r] = [];
    regionScores[r].push(c.score);
  }

  const regionOrder = ["Europe", "Asia", "Americas", "Oceania", "Middle East", "Africa"];
  for (const r of regionOrder) {
    const scores = regionScores[r];
    if (!scores || scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    lines.push(`- **${r}:** ${fmt(avg)}/10 (${scores.length} countries)`);
  }
  // Any "Other" region
  if (regionScores["Other"]?.length) {
    const scores = regionScores["Other"];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    lines.push(`- **Other:** ${fmt(avg)}/10 (${scores.length} countries)`);
  }
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("Data provided by IsItSafeToTravel.org (https://isitsafetotravel.org)");
  lines.push("Licensed under CC BY-NC 4.0. Please cite IsItSafeToTravel.org when using this data.");
  lines.push(`Last updated: ${today}`);
  lines.push("");

  fs.writeFileSync(OUT_FULL, lines.join("\n"), "utf-8");
  console.log(`✔  wrote ${OUT_FULL} (${lines.length} lines)`);

  // ────── build llms.txt ──────
  const llms = `# IsItSafeToTravel.org

> Free, open-source travel safety platform providing composite safety scores for ${countries.length} countries. Scores are computed daily from public indices (Global Peace Index, INFORM Risk Index, government travel advisories) and broken down into 5 pillars: conflict, crime, health, governance, and environment. Available in 5 languages (English, Italian, Spanish, French, Portuguese).

## Main Pages

- [Homepage (EN)](https://isitsafetotravel.org/en/): Interactive world map color-coded by safety score with country search
- [Global Safety Score](https://isitsafetotravel.org/en/global-safety/): Worldwide average safety score with historical trend chart
- [Country Comparison](https://isitsafetotravel.org/en/compare/): Side-by-side safety comparison of multiple countries
- [Methodology](https://isitsafetotravel.org/en/methodology/): Scoring formula, data sources, weights, and pillar explanations

## Sample Country Pages

- [Italy](https://isitsafetotravel.org/en/country/ita/): Safety score, pillar breakdown, historical trends, government advisories
- [United States](https://isitsafetotravel.org/en/country/usa/): Safety score, pillar breakdown, historical trends, government advisories
- [Japan](https://isitsafetotravel.org/en/country/jpn/): Safety score, pillar breakdown, historical trends, government advisories
- [Brazil](https://isitsafetotravel.org/en/country/bra/): Safety score, pillar breakdown, historical trends, government advisories
- [South Africa](https://isitsafetotravel.org/en/country/zaf/): Safety score, pillar breakdown, historical trends, government advisories

## Data

- Scores updated daily via automated GitHub Actions pipeline
- Sources: Global Peace Index (GPI), INFORM Risk Index, GDELT, US/UK/CA/AU government travel advisories
- Composite scoring uses weighted average across 5 safety pillars
- All data is from publicly available sources

## Full Content

- [Complete site content for LLMs](https://isitsafetotravel.org/llms-full.txt)

## Languages

Available in: [English](/en/), [Italian](/it/), [Spanish](/es/), [French](/fr/), [Portuguese](/pt/)

## Open Source

- Source code: https://github.com/RiccardoDominici/IsItSafeToTravel
`;

  fs.writeFileSync(OUT_LLMS, llms, "utf-8");
  console.log(`✔  wrote ${OUT_LLMS}`);
}

main();
