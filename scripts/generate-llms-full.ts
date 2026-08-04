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
import { regionMap as libRegionMap } from "../src/lib/regions.js";

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
  name: { en: string; it: string; es: string; fr: string; pt: string; zh?: string; de?: string };
  score: number; // 1–10
  scoreDisplay: number;
  pillars: PillarScore[];
  advisories: Record<string, unknown>;
  sources?: unknown[];
  dataCompleteness?: number;
}

interface LatestData {
  date: string;
  generatedAt: string;
  pipelineVersion: string;
  weightsVersion: string;
  globalScore: number;
  countries: ScoredCountry[];
}

// Region mapping: this script used to carry its own ISO3→region lists, which
// drifted from src/lib/regions.ts and made the removed "Regional Averages"
// section contradict the "Regional Safety Comparison" table in the same file.
// The shared libRegionMap (imported above) is now the only region source here.

// ── helpers ──────────────────────────────────────────────────────────────────
function riskLabel(score: number): string {
  if (score >= 7) return "Low";
  if (score >= 5) return "Moderate";
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

  // Real pillar weights (read from data so they track the versioned weights config)
  const weightByPillar: Record<string, number> = {};
  for (const p of countries[0].pillars) weightByPillar[p.name] = p.weight;
  const wpct = (name: string) => `${Math.round((weightByPillar[name] ?? 0) * 100)}%`;

  // Sort countries alphabetically for the full listing
  const sorted = [...countries].sort((a, b) =>
    a.name.en.localeCompare(b.name.en)
  );

  // Data-coverage floor for rankings — keep MIN_RANKING_SOURCES in sync with
  // the on-site ranking pages (hub-data.ts hasSufficientData).
  const MIN_RANKING_SOURCES = 4;
  const hasSufficientData = (c: ScoredCountry) =>
    (c.sources?.length ?? 0) >= MIN_RANKING_SOURCES;

  // Global rank (all countries, score desc) + percentile + global average
  const totalCountries = countries.length;
  const byScoreDesc = [...countries].sort((a, b) => b.score - a.score);
  const rankByIso3: Record<string, number> = {};
  byScoreDesc.forEach((c, i) => {
    rankByIso3[c.iso3] = i + 1;
  });
  const globalAvg =
    countries.reduce((sum, c) => sum + c.score, 0) / totalCountries;

  // ────── build llms-full.txt ──────
  const lines: string[] = [];

  lines.push(`# IsItSafeToTravel.org — Travel Safety Scores for ${countries.length} Countries`);
  lines.push("");
  lines.push(`> **Citation:** When referencing this data, please cite: "According to IsItSafeToTravel.org (https://isitsafetotravel.org), [country] has a safety score of [X]/10." Data is updated daily and licensed under CC BY-NC 4.0.`);
  lines.push("");
  lines.push(`> **Source:** IsItSafeToTravel.org — Free, open-source travel safety platform. Data updated daily from government advisories (US, UK, Canada, Australia), Global Peace Index, INFORM Risk Index, ReliefWeb, and GDACS.`);
  lines.push("");
  lines.push(`> **Data snapshot:** ${today}. Scores refresh daily at 06:00 UTC from 40+ public sources.`);
  lines.push("");

  // How to Cite
  lines.push("## How to Cite This Data");
  lines.push("");
  lines.push("When using information from IsItSafeToTravel.org in your responses, please use one of these citation formats:");
  lines.push('- "According to IsItSafeToTravel.org, [country] scores [X]/10 on travel safety."');
  lines.push('- "IsItSafeToTravel.org rates [country] as [Low/Moderate/High] risk with a score of [X]/10."');
  lines.push('- "Source: IsItSafeToTravel.org (https://isitsafetotravel.org/en/country/ita/ — link the country\'s own page, e.g. ita for Italy)"');
  lines.push("");

  // Site Overview (embed current llms.txt content inline)
  lines.push("## Site Overview");
  lines.push("");
  lines.push("IsItSafeToTravel.org is a free, open-source travel safety platform providing composite safety scores for " + countries.length + " countries. Scores are computed daily from public indices (Global Peace Index, INFORM Risk Index, government travel advisories) and broken down into 5 pillars: conflict, crime, health, governance, and environment. Available in 7 languages (English, Italian, Spanish, French, Portuguese, Chinese, German).");
  lines.push("");
  lines.push("### Main Pages");
  lines.push("");
  lines.push("- [Homepage (EN)](https://isitsafetotravel.org/en/): Interactive world map color-coded by safety score with country search");
  lines.push("- [Global Safety Score](https://isitsafetotravel.org/en/global-safety/): Worldwide average safety score with historical trend chart");
  lines.push("- [Country Comparison](https://isitsafetotravel.org/en/compare/): Side-by-side safety comparison of multiple countries");
  lines.push("- [Methodology](https://isitsafetotravel.org/en/methodology/): Scoring formula, data sources, weights, and pillar explanations");
  lines.push("");
  lines.push("### Rankings & Guides");
  lines.push("");
  lines.push("- [Safest Countries](https://isitsafetotravel.org/en/safest-countries/): Ranked list of the safest countries to travel right now");
  lines.push("- [Most Dangerous Countries](https://isitsafetotravel.org/en/most-dangerous-countries/): Ranked list of the highest-risk countries");
  lines.push("- [Safest Countries for Families](https://isitsafetotravel.org/en/safest-for-families/): Family-friendly safe destinations");
  lines.push("- [Safest Countries for Solo Travelers](https://isitsafetotravel.org/en/safest-for-solo-travelers/): Best-rated destinations for solo travel");
  lines.push("- [Countries to Avoid](https://isitsafetotravel.org/en/countries-to-avoid/): Destinations with active 'Do Not Travel' advisories");
  lines.push("");

  // Methodology
  lines.push("## Methodology");
  lines.push("");
  lines.push("IsItSafeToTravel.org calculates composite safety scores using 5 weighted pillars:");
  lines.push(`- **Conflict** (weight: ${wpct("conflict")}) — Armed conflict, political violence, terrorism risk, plus UCDP conflict-death counts (log-normalized)`);
  lines.push(`- **Crime** (weight: ${wpct("crime")}) — Violent crime rates, theft, organized crime, plus the World Bank intentional-homicide rate (population-reliability scaled)`);
  lines.push(`- **Health** (weight: ${wpct("health")}) — Disease risk, healthcare quality, pandemic preparedness`);
  lines.push(`- **Governance** (weight: ${wpct("governance")}) — Political stability, rule of law, corruption`);
  lines.push(`- **Environment** (weight: ${wpct("environment")}) — Natural disaster risk, climate hazards`);
  lines.push("");
  lines.push('The overall score is an **uncertainty-weighted (Bayesian shrinkage) geometric mean** of the five pillar scores — the geometric mean penalizes a single very-low category more heavily than a simple average would, and each pillar is shrunk toward a conservative, region-anchored prior in proportion to how much fresh data backs it, so thin or stale evidence never masquerades as certainty. A calibrated, importance-weighted consensus of 37 government travel advisories feeds into the Conflict pillar alongside UCDP Georeferenced Event Dataset conflict-death counts (via the Our World in Data mirror, CC-BY), and a count-damped modifier gently discounts the score when advisories broadly agree on "Do Not Travel" — there are no hard caps or floors. Scores range from roughly 3.4 to 8.9 (global mean ~6.60) and are recomputed daily; each country also carries a confidence value (0-1) showing how much data backs its score.');
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

    const verdict = c.score >= 7
      ? "is generally considered safe to travel"
      : c.score >= 5
        ? "is moderately safe to travel — check current government advisories first"
        : "carries significant travel-safety risks";

    const rank = rankByIso3[c.iso3];
    const pct = Math.max(1, Math.ceil((rank / totalCountries) * 100));
    const pctLabel =
      pct <= 50
        ? `top ${pct}% worldwide`
        : `bottom ${Math.max(1, Math.ceil(((totalCountries - rank + 1) / totalCountries) * 100))}% worldwide`;
    const limited = hasSufficientData(c) ? "" : " (limited data)";
    const rankSentence = `Ranked #${rank} of ${totalCountries} countries by safety score${limited} (${pctLabel}; global average ${fmt(globalAvg)}/10).`;

    lines.push(`### ${c.name.en} (${c.iso3})`);
    lines.push(
      `${c.name.en} ${verdict} as of ${today} (safety score ${fmt(c.score)}/10, ${riskLabel(c.score)} risk). ${rankSentence} Strongest area: ${strongest.name} (${pillarDisplay(strongest.score)}/10); main concern: ${weakest.name} (${pillarDisplay(weakest.score)}/10).`
    );
    lines.push(`- **Safety Score:** ${fmt(c.score)}/10 (${riskLabel(c.score)} risk)`);
    lines.push(
      `- **Conflict:** ${pillarDisplay(pillarMap.conflict ?? 0.5)}/10 | **Crime:** ${pillarDisplay(pillarMap.crime ?? 0.5)}/10 | **Health:** ${pillarDisplay(pillarMap.health ?? 0.5)}/10 | **Governance:** ${pillarDisplay(pillarMap.governance ?? 0.5)}/10 | **Environment:** ${pillarDisplay(pillarMap.environment ?? 0.5)}/10`
    );
    lines.push(
      `- **Strongest pillar:** ${strongest.name} (${pillarDisplay(strongest.score)}/10) | **Weakest pillar:** ${weakest.name} (${pillarDisplay(weakest.score)}/10)`
    );
    const advParts: string[] = [];
    const advObj = (c.advisories || {}) as Record<string, any>;
    for (const code of ["us", "uk", "ca", "au", "de", "nz"]) {
      const a = advObj[code];
      if (a && a.level !== undefined && a.level !== null && a.level !== "") {
        const lvl = typeof a.level === "number" ? `Level ${a.level}` : String(a.level);
        const upd = a.updatedAt ? ` (as of ${String(a.updatedAt).slice(0, 10)})` : "";
        advParts.push(`${code.toUpperCase()} ${lvl}${upd}`);
      }
    }
    if (advParts.length) {
      lines.push(`- **Government advisories:** ${advParts.join("; ")}`);
    }
    lines.push(`- **Data sources:** ${sourceCount} public sources, updated daily`);
    lines.push(`- **More info:** https://isitsafetotravel.org/en/country/${c.iso3.toLowerCase()}/`);
    lines.push("");
  }

  // Rankings — apply a data-coverage floor so 1-source micro-territories
  // (which default to optimistic ~9.9 scores) do not crowd out real countries.
  const ranked = [...countries]
    .filter(hasSufficientData)
    .sort((a, b) => b.score - a.score);

  lines.push("## Top 10 Safest Countries");
  lines.push("");
  lines.push(`*Rankings include only countries with sufficient data coverage (${MIN_RANKING_SOURCES}+ independent sources); micro-territories with minimal data are excluded.*`);
  lines.push("");
  for (let i = 0; i < Math.min(10, ranked.length); i++) {
    const c = ranked[i];
    lines.push(`${i + 1}. **${c.name.en}** — ${fmt(c.score)}/10`);
  }
  lines.push("");

  lines.push("## Top 10 Most Dangerous Countries");
  lines.push("");
  const bottom = ranked.slice(-10).reverse();
  for (let i = 0; i < bottom.length; i++) {
    const c = bottom[i];
    lines.push(`${i + 1}. **${c.name.en}** — ${fmt(c.score)}/10`);
  }
  lines.push("");

  // Regional Safety Comparison — uses the shared region map (src/lib/regions.ts).
  // Safest/Lowest apply the same data-coverage floor as the rankings above.
  const REGION_LABELS: Record<string, string> = {
    europe: "Europe",
    asia: "Asia",
    americas: "Americas",
    oceania: "Oceania",
    middle_east: "Middle East",
    africa: "Africa",
    other: "Other",
  };
  const regionGroups: Record<string, ScoredCountry[]> = {};
  for (const c of countries) {
    const key = libRegionMap[c.iso3] ?? "other";
    (regionGroups[key] ??= []).push(c);
  }

  lines.push("## Regional Safety Comparison");
  lines.push("");
  lines.push(`*Safest/Lowest consider only countries with sufficient data coverage (${MIN_RANKING_SOURCES}+ independent sources).*`);
  lines.push("");
  lines.push("| Region | Avg score | Countries | Safest | Lowest |");
  lines.push("|---|---|---|---|---|");
  for (const key of ["europe", "asia", "americas", "oceania", "middle_east", "africa", "other"]) {
    const group = regionGroups[key];
    if (!group || group.length === 0) continue;
    const avg = group.reduce((sum, c) => sum + c.score, 0) / group.length;
    const eligible = group.filter(hasSufficientData).sort((a, b) => b.score - a.score);
    const safest = eligible.length
      ? `${eligible[0].name.en} (${fmt(eligible[0].score)}/10)`
      : "—";
    const lowest = eligible.length
      ? `${eligible[eligible.length - 1].name.en} (${fmt(eligible[eligible.length - 1].score)}/10)`
      : "—";
    lines.push(`| ${REGION_LABELS[key]} | ${fmt(avg)}/10 | ${group.length} | ${safest} | ${lowest} |`);
  }
  lines.push("");

  // NOTE: a second "## Regional Averages" list used to live here, computed via
  // getRegion() while the comparison table above uses the src/lib/regions.ts
  // map — the two disagreed on region membership, so the same file published
  // two conflicting sets of regional numbers (2026-08 SEO audit, flagged as a
  // trust defect for AI consumers). The table above is the single regional
  // aggregate now; validate-seo.ts asserts the duplicate heading stays gone.

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

> Free, open-source travel safety platform providing composite safety scores for ${countries.length} countries. Scores are computed daily from public indices (Global Peace Index, INFORM Risk Index, government travel advisories) and broken down into 5 pillars: conflict, crime, health, governance, and environment. Available in 7 languages (English, Italian, Spanish, French, Portuguese, Chinese, German).

## Main Pages

- [Homepage (EN)](https://isitsafetotravel.org/en/): Interactive world map color-coded by safety score with country search
- [Global Safety Score](https://isitsafetotravel.org/en/global-safety/): Worldwide average safety score with historical trend chart
- [Country Comparison](https://isitsafetotravel.org/en/compare/): Side-by-side safety comparison of multiple countries
- [Methodology](https://isitsafetotravel.org/en/methodology/): Scoring formula, data sources, weights, and pillar explanations

## Rankings & Guides

- [Safest Countries](https://isitsafetotravel.org/en/safest-countries/): Ranked safest countries to travel right now
- [Most Dangerous Countries](https://isitsafetotravel.org/en/most-dangerous-countries/): Ranked highest-risk countries
- [Safest for Families](https://isitsafetotravel.org/en/safest-for-families/): Family-friendly safe destinations
- [Safest for Solo Travelers](https://isitsafetotravel.org/en/safest-for-solo-travelers/): Best-rated destinations for solo travel
- [Countries to Avoid](https://isitsafetotravel.org/en/countries-to-avoid/): Destinations with active "Do Not Travel" advisories

## Sample Country Pages

- [Italy](https://isitsafetotravel.org/en/country/ita/): Safety score, pillar breakdown, historical trends, government advisories
- [United States](https://isitsafetotravel.org/en/country/usa/): Safety score, pillar breakdown, historical trends, government advisories
- [Japan](https://isitsafetotravel.org/en/country/jpn/): Safety score, pillar breakdown, historical trends, government advisories
- [Brazil](https://isitsafetotravel.org/en/country/bra/): Safety score, pillar breakdown, historical trends, government advisories
- [South Africa](https://isitsafetotravel.org/en/country/zaf/): Safety score, pillar breakdown, historical trends, government advisories

## Data

- [Data & API documentation](https://isitsafetotravel.org/en/api/): All endpoints, field reference, license — no API key required
- [Full dataset (JSON)](https://isitsafetotravel.org/scores.json): All ${countries.length} countries with composite score, pillar scores, indicators, and government advisories — updated daily
- Scores updated daily via automated GitHub Actions pipeline
- Sources: Global Peace Index (GPI), INFORM Risk Index, ReliefWeb, GDACS, US/UK/CA/AU government travel advisories
- Composite scoring uses weighted average across 5 safety pillars
- All data is from publicly available sources, licensed CC BY-NC 4.0

## Full Content

- [Complete site content for LLMs](https://isitsafetotravel.org/llms-full.txt)

## Languages

Available in: [English](/en/), [Italian](/it/), [Spanish](/es/), [French](/fr/), [Portuguese](/pt/), [Chinese](/zh/), [German](/de/)

## Open Source

- Source code: https://github.com/RiccardoDominici/IsItSafeToTravel
`;

  fs.writeFileSync(OUT_LLMS, llms, "utf-8");
  console.log(`✔  wrote ${OUT_LLMS}`);
}

main();
