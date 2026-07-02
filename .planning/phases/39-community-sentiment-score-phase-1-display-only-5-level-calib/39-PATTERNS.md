# Phase 39: Community Sentiment Score (Phase 1) - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 24 (1 endpoint, 1 config, ~4 UI surfaces × 7 locales, 1 pipeline module set, 1 workflow)
**Analogs found:** 22 / 24 (2 genuinely new: D1 binding config, anti-abuse hashing)

## Architectural constraint (read first)

`PillarName` (`src/pipeline/types.ts:42`) is a **closed union**: `'conflict' | 'crime' | 'health' | 'governance' | 'environment'`. `PillarScore[]` (typed on this union) flows through `ScoredCountry.pillars`, `computeAllScores` (`src/pipeline/scoring/engine.ts`), `PillarBreakdown.astro`, `PillarDetailTable.astro`, and `TrendChart.astro`'s pillar filter. Both display components import `PillarScore` directly and key their label maps off `pillar.name`.

**Consequence for planning:** Sentiment must NOT be appended to `country.pillars` or to `PillarName`. Doing so would silently feed it into `computeAllScores`'s weighted geometric mean (violating D-06) and would require touching every consumer of the closed union. Sentiment needs its own parallel type (e.g. `SentimentScore`) and its own display component that sits *alongside* `<PillarBreakdown pillars={country.pillars} .../>` in the country page template — visually "the 6th pillar" but structurally independent. `weights.json` / `engine.ts` are correctly untouched per D-06 and CONTEXT.md canonical refs — do not open them for this phase.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/api/vote.ts` (new) | route (Pages Function) | request-response | `functions/api/feedback.ts` | exact |
| `wrangler.toml` (modify — add `[[d1_databases]]`) | config | — | itself (extend) | no analog (new binding type) |
| `src/pipeline/types.ts` (modify — add Sentiment types) | model | — | existing type blocks (`SourcesConfig`, `PillarWeight`) | role-match |
| `src/pipeline/sentiment/aggregate.ts` (new) | service | HTTP fetch + transform | `src/pipeline/fetchers/gdacs.ts` | role-match (fetch+parse+fallback shape) |
| `src/pipeline/sentiment/snapshot.ts` (new, or folded into aggregate.ts) | service | file-I/O (write) | `src/pipeline/scoring/snapshot.ts` | exact (write dated + latest pattern) |
| `src/pipeline/sentiment/history.ts` (new, or folded in) | service | file-I/O (append/consolidate) | `src/pipeline/scoring/history.ts` | exact (own small file, NOT history-index.json per CONTEXT.md) |
| `src/pipeline/run.ts` (modify — add Stage 6) | service | orchestration | itself, existing Stage 4/5 additions | exact |
| `.github/workflows/data-pipeline.yml` (modify — add D1 API token secret) | config | — | itself (`env: RELIEFWEB_APPNAME` passthrough) | exact |
| `src/lib/sentiment.ts` (new, or extend `src/lib/scores.ts`) | utility | file-I/O (read at build time) | `src/lib/scores.ts` (`loadLatestScores`/`loadPillarHistory`) | exact |
| `src/components/country/SentimentPillar.astro` (new) | component | request-response (SSG render) | `src/components/country/PillarBreakdown.astro` | role-match (display shape), NOT type-compatible (see constraint above) |
| `src/components/country/SentimentVote.astro` (new) | component | event-driven (client fetch POST) | `src/pages/en/feedback/index.astro` (form) + `src/components/DarkModeToggle.astro` (localStorage) | exact (combined) |
| `src/pages/{lang}/{country-slug}/[slug].astro` ×7 (modify) | route (Astro page) | request-response (SSG) | itself — `src/pages/en/country/[slug].astro` is the template for the other 6 | exact |
| `src/pages/{lang}/{methodology-slug}/index.astro` ×7 (modify — add Sentiment section) | route (Astro page) | request-response (SSG) | `src/pages/en/methodology/index.astro` | exact |
| `src/pages/{lang}/{legal-slug}/index.astro` ×7 (modify — add privacy addendum) | route (Astro page) | request-response (SSG) | `src/pages/en/legal/index.astro` (`legal.privacy_*` section) | exact |
| `src/i18n/ui.ts` (modify — add `sentiment.*`, `country.pillar.sentiment` keys ×7 locale blocks) | i18n data | — | `country.pillar.*` block + `feedback.*` block (both repeated identically across the 7 `ui.en/it/es/fr/pt/zh/de` objects) | exact |
| anti-abuse hashing (salted IP hash, inside `vote.ts`) | utility | transform | — | no analog (greenfield; use Web Crypto `crypto.subtle.digest`, available in CF Workers runtime) |

## Pattern Assignments

### `functions/api/vote.ts` (route, request-response)

**Analog:** `functions/api/feedback.ts` (full file read, 129 lines — this is the ONLY existing Pages Function handling a POST + JSON body + env secrets in this repo; also see `functions/index.ts` and `functions/_middleware.ts` for the two other `PagesFunction` examples, both simpler redirect handlers).

**Imports / module shape** (`functions/api/feedback.ts:1-22`):
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    if (!body.message || !body.name || !body.email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    ...
```
Copy this exact shape for `vote.ts`: validate `iso3` + `delta` (must be one of -2/-1/0/1/2 per D-02) in the request body, reject with 400 on malformed input, same `corsHeaders` object, same try/catch/500 fallback at the bottom.

**Env-gated config pattern** (`functions/api/feedback.ts:42-53`):
```typescript
const apiKey = context.env?.RESEND_API_KEY;
const recipientEmail = context.env?.FEEDBACK_EMAIL;
if (!apiKey || !recipientEmail) {
  const missing = [];
  if (!apiKey) missing.push('RESEND_API_KEY');
  if (!recipientEmail) missing.push('FEEDBACK_EMAIL');
  return new Response(JSON.stringify({ error: 'Server configuration error', missing }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
```
This is the exact pattern D-12 needs for Turnstile env-gating — but INVERTED: feedback.ts treats missing env as a hard failure (500), whereas D-12 requires the vote endpoint to *degrade gracefully* (skip Turnstile verification, keep working) when `TURNSTILE_SECRET_KEY` is absent. Copy the `context.env?.X` access style, not the fail-hard branch.

**D1 access (new — no existing analog in this repo):** Cloudflare Pages Functions access D1 via `context.env.<BINDING_NAME>` where binding name comes from `wrangler.toml`'s `[[d1_databases]] binding = "..."`. Use `context.env.DB.prepare('INSERT INTO votes (...) VALUES (...)').run()`. This is standard Cloudflare D1 API, not present anywhere yet in the codebase — planner/implementer should treat this as new, well-documented Cloudflare surface, not something to reverse-engineer from local patterns.

**CORS + OPTIONS handler** (`functions/api/feedback.ts:123-128`):
```typescript
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
```
Copy verbatim (vote.ts is same-origin only per D-18 "fetch POST to `/api/vote`", but keeping OPTIONS costs nothing and matches house style).

---

### `wrangler.toml` (config)

**Current file (full contents, 4 lines):**
```toml
name = "isitsafetotravel"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]
```

**No analog** — this repo has never declared a binding. Add (values supplied by the orchestrator's D1 provisioning step per D-15):
```toml
[[d1_databases]]
binding = "DB"
database_name = "isitsafetotravel-sentiment"
database_id = "<provisioned-by-orchestrator>"
```
Confirm this doesn't break `wrangler pages deploy` in `.github/workflows/deploy.yml` (deploy.yml wasn't asked for in scope but reads/wraps the same `wrangler.toml`; no changes needed there — Pages supports config-file D1 bindings natively per D-15).

---

### `src/pipeline/sentiment/aggregate.ts` (service, HTTP fetch + transform)

**Analog:** `src/pipeline/fetchers/gdacs.ts` (full file read, 160 lines) — closest existing shape for "fetch from external HTTP API, parse, write raw JSON, return a `FetchResult`-like summary, degrade gracefully on failure."

**Fetch + graceful degradation pattern** (`src/pipeline/fetchers/gdacs.ts:8-89`):
```typescript
export async function fetchGdacs(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const rawData = await response.json();
    writeJson(join(rawDir, 'gdacs.json'), rawData);
    ...
    return { source: 'gdacs', success: true, countriesFound: uniqueCountries.size, fetchedAt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[GDACS] Fetch failed: ${errorMessage}`);
    // Try fallback to cached data
    const cached = findLatestCached('gdacs-parsed.json');
    if (cached) { /* use cached, still return success:true */ }
    return { source: 'gdacs', success: false, countriesFound: 0, error: errorMessage, fetchedAt };
  }
}
```
For sentiment aggregation, replace the external-API fetch with a Cloudflare D1 HTTP API call (`fetch('https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query', { headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ sql: 'SELECT iso3, delta, created_at FROM votes WHERE created_at > ?' }) })`), same try/catch/degrade shape. D-14 requires this to NEVER fail the pipeline — mirror `fetchGdacs`'s `catch` block returning `success: false` and falling back to the last-known aggregate file (analogous to `findLatestCached`, see `src/pipeline/utils/fs.ts` — read that file if implementing, it wasn't in scope here but exports `findLatestCached`/`getRawDir`/`writeJson`/`readJson` used by every fetcher).

---

### `src/pipeline/sentiment/snapshot.ts` + `history.ts` (service, file-I/O)

**Analog:** `src/pipeline/scoring/snapshot.ts` (61 lines) + `src/pipeline/scoring/history.ts` (73 lines) — both fully read.

**Snapshot write pattern** (`src/pipeline/scoring/snapshot.ts:26-56`):
```typescript
export function writeSnapshot(date: string, countries: ScoredCountry[], ...): DailySnapshot {
  const snapshot: DailySnapshot = { date, generatedAt: new Date().toISOString(), ... };
  const scoresDir = getScoresDir();
  writeJson(join(scoresDir, `${date}.json`), snapshot);
  writeJson(join(scoresDir, 'latest.json'), snapshot);
  return snapshot;
}
```
Mirror this for sentiment: `data/sentiment/{date}.json` + `data/sentiment/latest.json`, one entry per country with `{ iso3, voteCount, correction, displayValue, recencyWeightedMean }`.

**History consolidation pattern** (`src/pipeline/scoring/history.ts:19-72`):
```typescript
export function writeHistoryIndex(): HistoryIndex {
  const dates = listSnapshotDates();
  for (const date of dates) {
    const snapshot = loadSnapshot(date);
    ...
    countries[country.iso3].push({ date, score: country.score });
  }
  const indexPath = join(getScoresDir(), 'history-index.json');
  writeJson(indexPath, index);
  return index;
}
```
**Critical deviation required (per CONTEXT.md specifics):** do NOT write into `data/scores/history-index.json` (already ~73MB, near GitHub's 100MB hard limit — see `~/.claude/projects/.../memory/project_history_file_growth.md`). Write a **separate small file**, e.g. `data/sentiment/history-index.json`, using the exact same consolidation shape but scoped to sentiment's much smaller per-day payload (one aggregate number + vote count per country, not full pillar breakdowns).

**Pipeline registration** (`src/pipeline/run.ts:80-90`, full file read):
```typescript
// Stage 4: Snapshot
writeSnapshot(date, scoredCountries, fetchResults, weightsConfig.version);
// Stage 5: History Index
writeHistoryIndex();
```
Add a new "Stage 6: Sentiment" block after Stage 5, calling the new `aggregateSentiment(date)` → `writeSentimentSnapshot` → `writeSentimentHistoryIndex`, wrapped so any failure only logs a warning and never returns `success: false` for the whole pipeline (per D-14; note existing Stage 1 fetch failures already follow this "never block" philosophy — `fetchAllSources` uses `Promise.allSettled` per `src/pipeline/fetchers/index.ts:37-51`, `settleBatch`).

---

### `.github/workflows/data-pipeline.yml` (config)

**Analog:** itself — existing secret passthrough (`.github/workflows/data-pipeline.yml:39-43`):
```yaml
- name: Run data pipeline
  run: npx tsx src/pipeline/run.ts ${{ github.event.inputs.date || '' }} 2>&1 | tee pipeline-output.log
  env:
    RELIEFWEB_APPNAME: ${{ secrets.RELIEFWEB_APPNAME }}
  continue-on-error: true
  id: pipeline
```
Add `CLOUDFLARE_D1_API_TOKEN` (or similarly named secret) to the same `env:` block. Per CONTEXT.md deferred item, granting this token D1 read permission is a manual user step — the pipeline must run fine with the secret absent (D-14), same as it already runs fine when `RELIEFWEB_APPNAME` is unset (ReliefWeb fetcher degrades — see `src/pipeline/fetchers/reliefweb.ts`, not read here but follows the same `fetchGdacs`-style catch/fallback).

The "Commit and push data" step (`data-pipeline.yml:192-207`) already does `git add data/scores/ ... data/history/ 2>/dev/null || true` — extend the `git add` list with `data/sentiment/` and add `public/sentiment.json` alongside the existing `git add data/raw/ data/scores/ public/scores.json` line. The "Copy scores to public" step (`data-pipeline.yml:108-109`, `cp data/scores/latest.json public/scores.json`) needs an equivalent `cp data/sentiment/latest.json public/sentiment.json` line — this is how build-time-readable JSON reaches `public/` today; do NOT hand-edit `public/sentiment.json` directly (same generated-file rule as `public/scores.json`, per CLAUDE.md).

---

### `src/lib/sentiment.ts` (utility, file-I/O read at build time)

**Analog:** `src/lib/scores.ts` (full file read, 208 lines).

**Load pattern** (`src/lib/scores.ts:26-36`):
```typescript
const DATA_DIR = path.join(process.cwd(), 'data', 'scores');
export function loadLatestSnapshot(): DailySnapshot | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
export function loadLatestScores(): ScoredCountry[] {
  const snapshot = loadLatestSnapshot();
  return snapshot?.countries ?? [];
}
```
Mirror exactly for `data/sentiment/latest.json` → `loadLatestSentiment(): SentimentEntry[]`. Graceful degradation is already baked into this pattern (`fs.existsSync` guard → `null` → `?? []`), which satisfies D-14 automatically: if the pipeline never ran or D1 was unreachable, `data/sentiment/latest.json` simply won't exist and country pages render the "not enough votes" state (D-09) for every country.

**Below-floor display state (D-09):** no direct analog exists (no other component currently has a "not enough X yet" state), but `PillarBreakdown.astro`'s `LOW_COVERAGE_FLAG_THRESHOLD` check (`src/components/country/PillarBreakdown.astro:40`, `const lowCoverage = pillar.dataCompleteness < LOW_COVERAGE_FLAG_THRESHOLD;`) is the closest precedent for "compute a boolean gate at render time and branch the markup" — use the same style: `const hasSufficientVotes = sentiment.voteCount >= MIN_VOTE_FLOOR;` with `MIN_VOTE_FLOOR` as a named, exported constant (D-09 default 5), mirroring how `MIN_PILLAR_COVERAGE` is exported from `src/pipeline/scoring/engine.ts:49`.

---

### `src/components/country/SentimentPillar.astro` (component, SSG render)

**Analog:** `src/components/country/PillarBreakdown.astro` (full file read, 61 lines) for visual/structural shape ONLY — do not import `PillarScore` (see architectural constraint above).

**Structural shape to copy** (`src/components/country/PillarBreakdown.astro:1-60`):
```astro
---
import type { Lang } from '../../i18n/ui';
import { useTranslations } from '../../i18n/utils';
import { pillarToColor } from '../../lib/colors';
interface Props { pillars: PillarScore[]; lang: Lang; }
const { pillars, lang } = Astro.props;
const t = useTranslations(lang);
...
---
<section id="pillars" class="py-6 px-4 max-w-2xl mx-auto">
  <h2 class="text-xl md:text-2xl font-heading font-bold text-sand-800 dark:text-sand-100 mb-4">
    {t('country.pillars_title')}
  </h2>
  <div class="space-y-3">
    {sorted.map((pillar) => {
      const displayScore = (pillar.score * 10).toFixed(1);
      const barWidth = Math.max(pillar.score * 180, 2);
      const color = pillarToColor(pillar.score);
      return (
        <div class="flex items-center gap-3">
          <span class="w-28 shrink-0 text-sm ...">{label}</span>
          <svg viewBox="0 0 200 24" class="flex-1 h-6" role="img" aria-label={...}>
            <rect .../><rect .../>
          </svg>
          <span class="w-14 shrink-0 text-sm font-medium ...">{displayScore}/10</span>
        </div>
      );
    })}
  </div>
</section>
```
Reuse `pillarToColor(score)` from `src/lib/colors.ts` (same bar-color function, already imported in both `PillarBreakdown` and `TrendChart`) so Sentiment's bar matches the other 5 pillars visually. Render the same bar/label/score row structure, but props become `sentiment: SentimentEntry | null; lang: Lang` (no array — one entry per country), and add the D-07-required correction annotation ("+0.4 vs official") plus vote count next to the score, and the D-09 below-floor state as a sibling branch. Place this as a new, separate `<SentimentPillar .../>` element directly after `<PillarBreakdown pillars={country.pillars} lang={lang} />` in each locale's `[slug].astro` (see below) — visually adjacent, not merged into the pillars array.

---

### `src/components/country/SentimentVote.astro` (component, client fetch POST)

**Analog A — form + fetch POST + success/error state:** `src/pages/en/feedback/index.astro` (full file read, 160 lines).

**Form submit pattern** (`src/pages/en/feedback/index.astro:122-158`):
```astro
<script define:vars={{ sendingText: t('feedback.sending'), submitText: t('feedback.submit') }}>
  const form = document.getElementById('feedback-form');
  const successEl = document.getElementById('feedback-success');
  const errorEl = document.getElementById('feedback-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) { form.classList.add('hidden'); successEl.classList.remove('hidden'); }
      else { errorEl.classList.remove('hidden'); }
    } catch { errorEl.classList.remove('hidden'); }
  });
</script>
```
For the vote widget this becomes 5 buttons (one per calibration level, D-02) instead of a form; each click handler does `fetch('/api/vote', { method: 'POST', body: JSON.stringify({ iso3, delta }) })` then swaps to a thank-you state, same `.hidden`/`classList` toggle style. Use `<script define:vars={{...}}>` for passing server-rendered translated strings into the client script — this is the established house pattern for localized client-side text (also used identically in `TrendChart.astro`'s non-`define:vars` inline `<script>` for untranslated D3 logic — use `define:vars` specifically when localized strings must cross the server/client boundary, as `feedback/index.astro` does).

**Analog B — localStorage soft-dedupe:** `src/components/DarkModeToggle.astro:61-65` — only existing `localStorage` usage in the codebase:
```javascript
localStorage.setItem('theme', 'light');
...
localStorage.setItem('theme', 'dark');
```
For D-17's "dedupe via localStorage (soft) so the same visitor isn't re-prompted for that country," use the same direct `localStorage.getItem`/`setItem` calls, no wrapper library — e.g. `localStorage.getItem('voted-' + iso3)` before showing the widget, `localStorage.setItem('voted-' + iso3, '1')` after a successful POST. This keeps the "zero-cookie" claim honest per D-20 (localStorage ≠ cookie, but must be disclosed in the privacy addendum).

**Progressive enhancement / lazy init (D-18):** `TrendChart.astro`'s `IntersectionObserver` pattern (`src/components/country/TrendChart.astro:681-693`) shows the house style for "only run client JS when the widget is visible" — not strictly required for a small vote widget (no D3/chart cost to defer), but if the widget should avoid firing before the user scrolls to it, this is the pattern to copy:
```javascript
const chartContainer = document.getElementById('trend-chart-container');
if (chartContainer) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) { observer.disconnect(); initTrendChart(); } });
  }, { rootMargin: '200px' });
  observer.observe(chartContainer);
}
```

---

### Country page templates ×7 (`src/pages/{lang}/{slug}/[slug].astro`)

**Analog:** `src/pages/en/country/[slug].astro` (full file read, 115 lines) is the template; the other 6 locale files (`it/paese/[slug].astro`, `es/pais/[slug].astro`, `fr/pays/[slug].astro`, `pt/pais/[slug].astro`, `zh/country/[slug].astro`, `de/land/[slug].astro`) are near-identical copies with only `const lang: Lang = 'xx';` and relative-import depth differing — this repo has NO shared layout abstraction for country pages; every locale duplicates the full component tree. Any change to insert `SentimentPillar`/`SentimentVote` must be applied 7 times, once per file.

**Exact insertion point** (`src/pages/en/country/[slug].astro:93-97`):
```astro
<ScoreHero country={country} lang={lang} scoreDelta={scoreDelta} />
<AnswerFirstParagraph country={country} lang={lang} />
<StatsSummary country={country} rank={rank} totalCountries={totalCountries} lang={lang} />
<PillarBreakdown pillars={country.pillars} lang={lang} />
<AdvisorySection advisories={country.advisories} lang={lang} advisorySources={advisorySources} />
```
Insert `<SentimentPillar sentiment={sentiment} lang={lang} />` immediately after `<PillarBreakdown .../>` (visually "the 6th pillar," D-04) and `<SentimentVote iso3={country.iso3} lang={lang} />` somewhere logical nearby (e.g. right after `SentimentPillar`, so users see the score then get asked to calibrate it). `sentiment` is a new prop threaded through `getStaticPaths` exactly like `pillarTrend`/`scoreDelta` are today (`src/pages/en/country/[slug].astro:34-52`):
```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const countries = loadLatestScores();
  const history = loadHistoricalScores();
  return countries.map((country) => ({
    params: { slug: country.iso3.toLowerCase() },
    props: {
      country, allCountries: countries,
      trend: history.get(country.iso3) ?? [],
      pillarTrend: loadPillarHistory(country.iso3),
      scoreDelta: getScoreDelta(country.iso3, history),
      ...
    },
  }));
};
```
Add `sentiment: loadSentimentForCountry(country.iso3)` (from the new `src/lib/sentiment.ts`) to this props object, in all 7 files.

**SEO invariant (D-22):** `buildCountryJsonLd` (`src/pages/en/country/[slug].astro:69`, from `src/lib/seo.ts`, not modified in this phase) already asserts `WebPage + Place + FAQPage + TouristDestination + Dataset`. Do not add Sentiment fields into this JSON-LD graph — D-21 explicitly excludes it from schema/llms/OG generators. `npm run validate:seo` must stay green untouched.

---

### Methodology pages ×7

**File paths (exact):**
| Locale | Path |
|---|---|
| en | `src/pages/en/methodology/index.astro` |
| it | `src/pages/it/metodologia/index.astro` |
| es | `src/pages/es/metodologia/index.astro` |
| fr | `src/pages/fr/methodologie/index.astro` |
| pt | `src/pages/pt/metodologia/index.astro` |
| zh | `src/pages/zh/methodology/index.astro` |
| de | `src/pages/de/methodik/index.astro` |

**Analog:** `src/pages/en/methodology/index.astro` (full file read, 270 lines) — section-by-section `<section class="mb-10">` structure, each with an `<h2>{t('methodology.X_title')}</h2>` + `<p>{t('methodology.X_text')}</p>` pair. Example section to clone (`src/pages/en/methodology/index.astro:184-188`):
```astro
<section class="mb-10">
  <h2 class="text-xl font-heading font-semibold text-sand-800 dark:text-sand-100 mb-3">{t('methodology.tiered_title')}</h2>
  <p class="text-sand-700 dark:text-sand-300 leading-relaxed">{t('methodology.tiered_text')}</p>
</section>
```
Add a new `<section class="mb-10">` (e.g. after "Category Weights" or as its own section before "Limitations") with keys `methodology.sentiment_title` / `methodology.sentiment_text`, covering: the 5 calibration levels (D-02), the ±1.0 cap (D-08), and an explicit "does NOT affect the total score in Phase 1" statement (D-19). The FAQ-JSON-LD block at the top of the file (`src/pages/en/methodology/index.astro:17-23`, `faqQuestions` array feeding `buildFaqPageJsonLd`) is a good place to add one more Q&A pair ("Does the community score affect my destination's overall safety score?" → No, not yet) if the planner wants Sentiment to also surface in the FAQ schema — optional, not required by any locked decision.

---

### Legal/Privacy pages ×7

**File paths (exact):**
| Locale | Path |
|---|---|
| en | `src/pages/en/legal/index.astro` |
| it | `src/pages/it/note-legali/index.astro` |
| es | `src/pages/es/terminos-legales/index.astro` |
| fr | `src/pages/fr/mentions-legales/index.astro` |
| pt | `src/pages/pt/termos-legais/index.astro` |
| zh | `src/pages/zh/legal/index.astro` |
| de | `src/pages/de/impressum/index.astro` |

**Analog:** `src/pages/en/legal/index.astro` (full file read, 90 lines) — already has a dedicated privacy sub-section block (`legal.privacy_*` keys) separated by an `<hr>` from the main legal terms:
```astro
<hr class="border-sand-200 dark:border-sand-700 my-12" />
<h2 class="text-2xl font-heading font-bold ...">{t('legal.privacy_title')}</h2>
<p class="... mb-8">{t('legal.privacy_text')}</p>
<section class="mb-8">
  <h3 class="text-xl font-heading font-semibold ...">{t('legal.privacy_cookies_title')}</h3>
  <p class="...">{t('legal.privacy_cookies_text')}</p>
</section>
<section class="mb-8">
  <h3 ...>{t('legal.privacy_analytics_title')}</h3>
  <p>{t('legal.privacy_analytics_text')}</p>
</section>
<section class="mb-8">
  <h3 ...>{t('legal.privacy_data_title')}</h3>
  <p>{t('legal.privacy_data_text')}</p>
</section>
```
Add one more `<section class="mb-8">` in this exact style, keys `legal.privacy_votes_title` / `legal.privacy_votes_text`, covering: salted-hash dedupe (no raw IP retention), Turnstile when enabled, and the localStorage soft-dedupe note (D-20) — this section must sit inside the existing "Privacy" sub-block (after `<hr>`), not the top "Legal Terms" half of the page.

---

### `src/i18n/ui.ts` (i18n data, ×7 locale blocks)

**File structure** (3555 lines total; `Read` in full is unnecessary — targeted `grep` located every relevant range):
- `export const languages = { en, it, es, fr, pt, zh, de }` at line 1
- `export const ui = { en: {...}, it: {...}, es: {...}, fr: {...}, pt: {...}, zh: {...}, de: {...} }` — each locale is a flat `Record<string, string>` with **identical key sets**, values translated. Locale block start lines: `en` at 22, `it` at ~530 (from earlier grep evidence), `es` at ~1008, `zh` at 2414, `de` at 2888 (confirmed via grep), `fr`/`pt` fall between es and zh/de.
- `export const routes = { en: {...}, it: {...}, ... }` at line 3365 — localized slug map (already fully enumerated above for methodology/legal).

**Existing repeated-across-locales key block to mirror** (`country.pillar.*`, shown for `en` at `src/i18n/ui.ts:58-62` and `it` at `:538-542`):
```typescript
// en
'country.pillar.conflict': 'Conflict',
'country.pillar.crime': 'Crime',
'country.pillar.health': 'Health',
'country.pillar.governance': 'Governance',
'country.pillar.environment': 'Environment',
// it (same keys, translated values)
'country.pillar.conflict': 'Conflitto',
'country.pillar.crime': 'Criminalita',
'country.pillar.health': 'Salute',
'country.pillar.governance': 'Governance',
'country.pillar.environment': 'Ambiente',
```
Add `'country.pillar.sentiment': 'Sentiment'` (translated per locale, D-05) directly after `environment` in all 7 blocks, plus a new key family for the vote widget (5 calibration levels D-02, thank-you state, below-floor state D-09, correction label D-07) and for the new methodology/legal sections described above. Naming is Claude's discretion per CONTEXT.md — suggest namespacing as `sentiment.*` (e.g. `sentiment.pillar_label`, `sentiment.level_much_higher` … `sentiment.level_much_lower`, `sentiment.vote_cta`, `sentiment.thank_you`, `sentiment.not_enough_votes`, `sentiment.correction_label`) to keep it separate from the `country.pillar.*` namespace used by the closed-union pillar system, reinforcing the architectural separation described above.

**Also add to `country.pillar.*` for SentimentPillar's own bar label** (since the display component still wants a "Sentiment" row label styled like the other 5, even though it isn't in `PillarScore[]`): `'country.pillar.sentiment': '...'` — safe to add here since it's a plain string key, not a `PillarName` union member; only the union type in `types.ts` must stay closed.

---

## Shared Patterns

### Graceful degradation (applies to: vote.ts, aggregate.ts, run.ts Stage 6, lib/sentiment.ts, SentimentPillar.astro)
**Source:** `src/pipeline/fetchers/gdacs.ts` catch block + `src/lib/scores.ts` `fs.existsSync` guards.
**Rule:** every layer must independently tolerate "no data yet" — D1 unreachable → pipeline logs warning, completes normally (`src/pipeline/run.ts`'s existing `success: sourcesSucceeded > 0` pattern shows failures never throw, they're captured in return values); missing `data/sentiment/latest.json` → `lib/sentiment.ts` returns `null`/`[]` (mirrors `src/lib/scores.ts:33-36`); `sentiment === null` in a country page → `SentimentPillar.astro` renders the D-09 "not enough votes" state instead of crashing.

### Env-gated optional features (applies to: vote.ts Turnstile check)
**Source:** `functions/api/feedback.ts:42-53` (`context.env?.RESEND_API_KEY` pattern) — copy the `context.env?.X` access style; unlike feedback.ts (which 500s on missing env), D-12 requires vote.ts to silently skip verification and continue when `TURNSTILE_SECRET_KEY` is unset.

### CORS + POST/OPTIONS shape (applies to: vote.ts)
**Source:** `functions/api/feedback.ts:18-22, 123-128` — copy `corsHeaders` object and `onRequestOptions` verbatim; add `onRequestPost` following the same try/catch/JSON-response shape.

### localStorage soft state (applies to: SentimentVote.astro)
**Source:** `src/components/DarkModeToggle.astro:61-65` — only prior art; direct `localStorage.getItem`/`setItem`, no abstraction layer needed for a single boolean-per-country flag.

### Daily pipeline stage registration (applies to: run.ts Stage 6)
**Source:** `src/pipeline/run.ts:80-90` — Stage 4 (Snapshot) / Stage 5 (History Index) show the "call a pure function, log a one-line summary, move on" house style; Stage 6 (Sentiment) should follow identically and must not affect the function's overall `success` flag per D-14 (compare: source-fetch failures in Stage 1 already don't fail the whole run, only `sourcesSucceeded === 0` does — `src/pipeline/run.ts:59-62`).

### Locale-block i18n key mirroring (applies to: all ui.ts additions)
**Source:** any existing key family repeated across all 7 `ui.xx` objects (e.g. `country.pillar.*` shown above, or `feedback.*` at `en:` ~line 380s / repeated per locale). New keys must be added to all 7 blocks in the same relative position (the file has no shared/inherited defaults — every locale is a fully independent flat object) or `useTranslations`'s lookup (`src/i18n/utils.ts`, not read in this pass but referenced throughout) will fall through to a missing-key state for that locale.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| `wrangler.toml` D1 binding | config | — | First-ever Cloudflare binding declared in this repo; standard Cloudflare D1 syntax, not a local pattern to reverse-engineer |
| Salted-hash IP dedupe (inside `vote.ts`) | utility | transform | No hashing/crypto utility exists anywhere in `src/` or `functions/`; use the Workers-runtime-native `crypto.subtle.digest('SHA-256', ...)` — standard Web Crypto API, available in Cloudflare Pages Functions without any new dependency |
| Rate-limit counter storage | utility | event-driven | No existing rate-limiting code in this repo (feedback.ts has none). D1 itself can serve as the counter store (e.g. `SELECT COUNT(*) FROM votes WHERE ip_hash = ? AND created_at > ?`) — Claude's discretion per CONTEXT.md on exact thresholds |
| Cloudflare Turnstile widget integration | component | event-driven | Genuinely new third-party widget; the one-time site-key creation is an explicit manual user step per CONTEXT.md deferred list — implementer should env-gate per the pattern above and leave the actual widget script optional/lazy-loaded |

## Metadata

**Analog search scope:** `functions/`, `src/pipeline/{run.ts, scoring/, fetchers/, types.ts, config/weights.json}`, `src/components/country/`, `src/components/DarkModeToggle.astro`, `src/pages/en/{country,feedback,methodology,legal}/`, all 7 locale country-page/methodology/legal file paths (enumerated via `find`), `src/lib/scores.ts`, `src/i18n/ui.ts` (targeted `grep`, not full read), `.github/workflows/data-pipeline.yml`, `wrangler.toml`, `astro.config.mjs` (confirmed no Cloudflare Astro adapter is configured — static SSG only, Pages Functions are the sole dynamic surface, consistent with CLAUDE.md).
**Files scanned:** ~30 (full reads: 11; targeted greps: 6; directory listings: 5)
**Pattern extraction date:** 2026-07-02
