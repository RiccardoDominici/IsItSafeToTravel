---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Global Advisory Sources Expansion
status: milestone_complete
stopped_at: Milestone complete (Phase 39 was final phase)
last_updated: 2026-07-08T01:23:25.000Z
last_activity: 2026-07-08 -- Formula v9 fully shipped (x81 PART 1 + 23u PART 2 + efx post-ship hardening): engine + historical regen + product surface + docs x7, deployed
progress:
  total_phases: 24
  completed_phases: 19
  total_plans: 49
  completed_plans: 80
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.
**Current focus:** Milestone complete

## Current Position

Phase: 39
Plan: Not started
Status: Milestone complete
Last activity: 2026-07-08

Progress: [██████████] 100%

## Performance Metrics

**Velocity (from v1.0 through v3.0):**

- Total plans completed: 35
- Average attempts per plan: ~2.2

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0]: Baseline+signal tiered architecture — annual indices at 70%, realtime signals capped at 30%
- [v3.0]: Advisory sources are signal tier with 7-day half-life, 30-day max age
- [v3.0]: Advisory sub-weights in Conflict pillar: US 9%, UK 8%, CA 7%, AU 6%
- [v4.0]: New advisory sources must normalize to unified 1-4 level scale
- [v4.0]: Integration order: cleanup first, then API, HTML, complex, scoring, CI, docs, calibration
- [Phase 28]: Redistributed GDELT/WHO DONs weights proportionally among remaining indicators in v7.0.0
- [Phase 28]: Updated source count from 9 to 7 in all user-facing content after GDELT/WHO DONs removal
- [Phase 29]: UnifiedLevel 1-4 scale as standard for all advisory normalization
- [Phase 29]: Extended AdvisoryInfoMap type with de/nl/jp/sk keys for tier-1 sources
- [Phase 29]: Used static MOFA page ID to ISO3 mapping (120+ entries) for Japan advisory fetcher
- [Phase 30]: Extended dataDate extraction to work from any advisory source (base/tier1/tier2a)
- [Phase 30]: Used cheerio HTML/XML parsing for all Tier 2a sources; Austria BMEIA JS object is most reliable source
- [Phase 31]: Extended advisory level aggregation and info loading for tier2b sources in engine.ts
- [Phase 31]: Followed tier2a pattern exactly for tier2b fetcher module structure
- [Phase 32]: Chinese normalization matches characters directly without toLowerCase; Korean maps 1:1 to unified scale
- [Phase 32]: Used HTML scraping for South Korea instead of API (avoids API key registration)
- [Phase 32]: Created local Korean/Chinese country name mapping tables in fetcher file (not in shared countries.ts)
- [Phase ?]: Plan 38-02: introduced getLocalizedCountryName helper with en fallback for snapshot data lacking new locales
- [Phase ?]: Plan 38-02: publishedLanguages flipped to 7 entries enabling hreflang for /zh/ and /de/ sitewide
- [Phase ?]: Plan 38-02: bulk-migrated 80+ files from country.name[lang] to getLocalizedCountryName helper
- [260706-x81]: Formula v9 = Bayesian shrinkage toward a region-anchored conservative prior (K=1.0), replacing v8.x's eligibility gates / neutral-0.5 defaults / critical floor / majority-L4 hard cap
- [260706-x81]: Pillar recomposition: crime <- gpi_safety_security (was conflict), governance <- +vdem_rule_of_law (was crime); conflict gains an engine-injected synthetic advisory-consensus indicator "A"
- [260706-x81]: New ScoredCountry.confidence field (= sum w_i*n_i/(n_i+K)); weights.json v9.0.0 carries a formulaV9 constants section as the single source of truth for tunables
- [260706-x81]: backfill.ts now treats vdem as year-based (historical vintage-per-file data was previously skipped); GPI per-year vintage (2008-2023) injected per snapshot date via a new parseGpiExcelAllYears() export in gpi.ts
- [260706-x81]: MIN_PILLAR_COVERAGE/LOW_COVERAGE_FLAG_THRESHOLD kept exported from engine.ts (no longer used for score gating) for backward compat with src/lib/seo.ts + 3 Astro components (PART 2 territory)

### Roadmap Evolution

- Phase 38 added: i18n zh+de support and Travelpayouts affiliate replacing Ko-fi (2026-05-03)
- Phase 39 added: Community Sentiment Score — Phase 1 display-only: 5-level calibration votes via Cloudflare Pages Function + D1, daily GHA aggregation baking a new translated Sentiment pillar (weight 0), methodology docs in 7 languages (2026-07-02)

### Pending Todos

None yet.

### Blockers/Concerns

- [Carry-over] Inline data embedding for comparison page needs monitoring (~1MB threshold at ~6 months of daily data)
- [v4.0] Rate limiting across 30+ advisory sources in CI — need staggered fetching
- [v4.0] Text-based advisories (Italy, Spain, China) may need LLM/NLP for level extraction
- [v4.0] Diverse level systems (3/4/5/6-level, color-coded) need normalization mapping
- [260706-x81→260708-23u] Formula v9 PART 2 COMPLETED 2026-07-08 (bands/verdicts recalibrated, methodology+README+seo+FAQ ×7, llms/OG regen, validate:seo 2213/2213, deployed). Remaining v9 fast-follows (formula-level, deliberate): wb_homicide crime indicator, jp advisory parser fix, Guam ca=4 pipeline data bug, active-conflict signal for PSE/RUS-type cases — ALL FOUR shipped in 260708-lb3 (Formula v9.1 PART 1, 2026-07-08).
- [260708-efx] The three test bugs previously logged here are FIXED (2026-07-08): latest.json backup/restore added to snapshot.test.ts AND data05-historical.test.ts (both corrupted real data/scores/latest.json on every `npm test`), globalScore assertion aligned to 2-decimal implementation, history dc:0 expectations added. npm test 120/120, data/scores clean post-run.
- [260708-lb3] Formula v9.1 PART 1 shipped 2026-07-08 (pipeline core only — see Quick Tasks table): parity gate PASSED byte-exact (0.0000/248, jp excluded). jp re-inclusion gate FAILED (max 0.362 on ESH vs 0.25 threshold, 5 band flips) — jp stays excluded in weights.json; the FIXED fetcher ships anyway (fixes the user-facing spurious-L4 display bug). travel.gc.ca (Canada advisories) was unreachable from this session's execution environment all session (existing per-source cache fallback engaged correctly) — CA hardening logic implemented+reviewed but not exercised live against a genuinely ambiguous page; will self-verify on the next daily GHA run. PART 2 (docs/i18n/UI/methodology/README/llms/deploy) NOT started — next up.
- [260708-lb3] npm test full-suite has a pre-existing, unrelated flaky race: score-drift-guard.test.ts vs data05-historical.test.ts's temp 2098-06-0X.json fixtures collide when node --test schedules both concurrently (intermittent ENOENT). Confirmed pre-existing (neither file touched by 260708-lb3); isolated runs always pass. Authoritative final run: 131/131 pass, 0 fail.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260320-ip2 | Fix 5 UI issues: language selector dropdown, health chart, back button, category summary, comparison search | 2026-03-20 | 6a94a4d | [260320-ip2-fix-5-ui-issues-language-selector-dropdo](./quick/260320-ip2-fix-5-ui-issues-language-selector-dropdo/) |
| 260323-mcr | Add CA/AU government advisories, populate AdvisoryInfo, 4-card frontend | 2026-03-23 | 8d37e41, d2a026b | [260323-mcr-add-government-advisories-section-with-c](./quick/260323-mcr-add-government-advisories-section-with-c/) |
| Phase 28 P01 | 5min | 2 tasks | 11 files |
| Phase 28 P02 | 15min | 2 tasks | 12 files |
| Phase 29-01 P01 | 2min | 2 tasks | 6 files |
| Phase 29 P02 | 245s | 2 tasks | 3 files |
| Phase 30 P01 | 156s | 2 tasks | 5 files |
| Phase 30 P02 | 211s | 2 tasks | 3 files |
| Phase 31 P01 | 121s | 2 tasks | 5 files |
| Phase 31 P02 | 237s | 2 tasks | 2 files |
| Phase 32 P01 | 82s | 2 tasks | 4 files |
| Phase 32 P02 | 354s | 2 tasks | 3 files |
| 260330-h6z | Perplexity AI optimization: visible FAQ, answer-first paragraphs, timestamps, comparison tables, question H2s, Dataset schema | 2026-03-30 | da7c4aa | [260330-h6z-perplexity-ai-optimization-visible-faq-a](./quick/260330-h6z-perplexity-ai-optimization-visible-faq-a/) |
| 260403-o7a | SEO improvements: title freshness, neighbor comparison, 65 hub pages, embeddable badge | 2026-04-03 | 1b5fa07 | [260403-o7a-seo-improvements-title-freshness-neighbo](./quick/260403-o7a-seo-improvements-title-freshness-neighbo/) |
| 260415-qon | Fix INFORM governance mapping, WB partial fallback, regenerate scores | 2026-04-15 | b2ef9ad, 3bce773 | [260415-qon-fix-inform-governance-column-mapping-fix](./quick/260415-qon-fix-inform-governance-column-mapping-fix/) |
| Phase 38 P02 | 1850 | 3 tasks | 130 files |
| 260511-gpu | Pillar coverage threshold gating + UI note (exclude <30%, asterisk <50%) | 2026-05-11 | 1298654, c24fe07 | [260511-gpu-pillar-coverage-threshold-gating-ui-note](./quick/260511-gpu-pillar-coverage-threshold-gating-ui-note/) |
| 260511-k2m | Replace retired WB WGI with V-Dem Institute v16 (rule_of_law, gov_effectiveness, corruption_control), drop wb_political_stability, redistribute conflict weights, rename wb_* → vdem_*, backfill 611 historical snapshots, UI updates 7 locales with CC-BY-SA attribution. Verified 16/16 must_haves. | 2026-05-11 | 950910c, 7b4bc17, 82bdd88, b074a14 | [260511-k2m-replace-retired-wb-wgi-with-v-dem-instit](./quick/260511-k2m-replace-retired-wb-wgi-with-v-dem-instit/) |
| 260515-k5y | Guard kofiWidgetOverlay against blocked/failed CDN load (defensive typeof guard + load/error listeners on overlay-widget.js script tag in Base.astro) — complete | 2026-05-15 | 3d0f47a | [260515-k5y-fix-kofiwidgetoverlay-javascript-error-o](./quick/260515-k5y-fix-kofiwidgetoverlay-javascript-error-o/) |
| 260603-csf | Fix Dataset JSON-LD description field length (GSC alert WNC-10030322) — zh template was 30 chars (under Google's 50-char floor for short country names like 日本); extended to 53+ chars; added validate-seo guard (2199→2213 checks). | 2026-06-03 | b633e2f8 | [260603-csf-fix-dataset-json-ld-description-field-le](./quick/260603-csf-fix-dataset-json-ld-description-field-le/) |
| 260623-wd6 | On-site SEO authority concentration: new AuthorityLinks component on all 7-locale country pages — ranking up-links (safest/most-dangerous hubs, band-matching order, localized slugs from routes) + "Cite this data" copy snippet & embed-badge CTA. Motivated by 2026-06-23 GSC data audit (indexing ~98% solved; real bottleneck = domain authority/ranking). Build 1906 pages OK, validate:seo 2213/2213 pass. | 2026-06-23 | 1a441ab2 | [260623-wd6-on-site-seo-authority-concentration-rank](./quick/260623-wd6-on-site-seo-authority-concentration-rank/) |
| 260702-svw | Restyle Community Sentiment vote widget (Phase-39 form): 5 radios → bordered calibration cards (CSS has-[:checked], sr-only radios + focus-visible ring), terracotta CTA with sand disabled state, branded thanks panel, Community badge retint. Zero i18n strings added, JS contract intact, validate:seo 2213/2213. Multi-agent: Opus designs+judges, Sonnet executes. | 2026-07-02 | 10401d96 | [260702-svw-restyle-sentiment-vote-widget](./quick/260702-svw-restyle-sentiment-vote-widget/) |
| 260702-cpr | Country page section restructure (15→13 blocks, citability-first): PillarDetailTable folded into PillarBreakdown as native <details> (new key country.pillars_detail_toggle ×7 langs), FAQ up after advisories (answer cluster contiguous for AI), TrendChart down to evidence tail, comparison/related/authority links grouped — identical order across 7 locales. Deferred: ComparisonTable⊕NeighborComparison merge (render-guard risk). validate:seo 2213/2213. | 2026-07-02 | a62ee02a | [260702-cpr-country-page-section-restructure](./quick/260702-cpr-country-page-section-restructure/) |
| 260702-ctd | Dedicated "Cite this data" page ×7 locales (shared CitePage.astro, ApiDocs pattern): country/whole-dataset selector, live badge preview, 6 citation formats (plain/HTML/Markdown/APA/MLA/BibTeX) with auto access date, FAQ+FAQPage schema, license w/ commercial→feedback routing. Country pages decluttered: AuthorityLinks cite sub-block removed (Rankings kept), deep-linked #c=iso3 text link + site-wide Footer link. New 'cite' routes slugs ×7 → hreflang+sitemap automatic. validate:seo 2213/2213 + manual hreflang grep on all 7 built pages. | 2026-07-02 | 71594c13 | [260702-ctd-cite-this-data-page](./quick/260702-ctd-cite-this-data-page/) |
| 260706-pcc | FAQ v2 country pages: Q1 opens with explicit Sì/No verdict (3 risk bands ×7 locales) + inline pillar-meaning explanation; Q2 indicator-driven (15-label indicator map ×7 langs, advisory_level_* grouped, single-indicator degrade); Q3 insurance REMOVED → advisory-consensus question from country.advisories (level distribution, majority-L4 cap explained in place, Intl.DisplayNames govt names, uk→GB, zero-advisory fallback). Deferred fixes shipped: MIN_PILLAR_COVERAGE eligible-pillar filter (Monaco zero-data bug) in seo.ts+AnswerFirstParagraph, source framing unified to 40+. Build 1913 pages, validate:seo 2213/2213. | 2026-07-06 | 1e59c789, 8f86dc5d, 488864a6 | [260706-pcc-faq-v2-si-no-verdict-inline-pillar-expla](./quick/260706-pcc-faq-v2-si-no-verdict-inline-pillar-expla/) |
| 260706-x81 | Formula v9 PART 1 (pipeline core): full engine.ts port of the frozen Bayesian-shrinkage scorer (byte-exact parity vs. prototype-scorer.mjs ground truth, max abs delta 0.0000/248 countries); weights.json v9.0.0 (crime<-gpi_safety_security, governance<-+vdem_rule_of_law, formulaV9 constants); regions.ts extended 199->241/248 iso3 (incl. RUS); backfill.ts vdem year-based fix + per-date GPI vintage injection (gpi.ts parseGpiExcelAllYears); rewrote engine/crisis-validation/weights-config tests + added npm test script; parity gate script + committed fixture; live backfill regenerated all 668 historical snapshots + public/scores.json (mean 6.754, range [3.72 YEM, 8.89 ISL], anchors match). score-drift-guard flipped green post-regen. PART 2 (bands/verdicts/docs/i18n/SEO/llms/OG/deploy) not started. | 2026-07-08 | 2aee6916, cc4c8b83, f305a75f | [260706-x81-formula-v9-part-1-engine-rewrite-weights](./quick/260706-x81-formula-v9-part-1-engine-rewrite-weights/) |
| 260708-23u | Formula v9 PART 2 (product surface): recalibrated every 1–10 band/verdict/color threshold to the v9 scale (<5 danger / 5–6 high caution / 6–7 moderate / 7–8 good / ≥8 excellent) across ScoreHero, seo.ts, map/colors scales, badge, OG colors, hub components; rewrote v9 docs & strings ×7 locales (methodology incl. changelog+known-limitations, README, ui.ts crime=GPI-Safety&Security, hub-faq, country-faq-copy, ApiDocs+confidence); llms-full v9 mechanism sentence + regen; fixed live "undefined" methodology.indicator.A key ×7 and stale duplicate color scale in colors.ts; build 1913 pages + validate:seo 2213/2213; pushed → deploy. | 2026-07-08 | c4f863c7, dd88eb69, 6f5e1620, 5a119b03 | [260708-23u-formula-v9-part-2-bands-verdicts-methodo](./quick/260708-23u-formula-v9-part-2-bands-verdicts-methodo/) |
| 260708-efx | Formula v9 post-ship: methodology pillar-sections moved before formula ×7 locales (user request); adversarial FAQ/answers audit vs v9 (content clean); band-on-displayed-value fix at 12 sites (Nicaragua "6.0"-vs-verdict mismatch class bug); test-suite real-data corruption fixed in snapshot.test.ts + data05-historical.test.ts (latest.json backup/restore) + 2 stale assertions → npm test 120/120 with clean data/scores. | 2026-07-08 | c7108052, f6e17337, 59af6cf5 | [260708-efx-formula-v9-post-ship-methodology-reorder](./quick/260708-efx-formula-v9-post-ship-methodology-reorder/) |
| 260708-mxx | Formula v9.1 PART 2 (surface): methodology ×7 changelog v9.1 + crime/conflict recomposition docs + known-limitations rewrite; ScoreHero limited-data flag (confidence<0.4) ×7; README/CLAUDE.md/ApiDocs/seo.ts/FAQ copy v9.1; UCDP SOURCE_CATALOG attribution fix (196 empty-url anchors caught by validate:seo); DEFINITIVE test isolation (SCORES_DIR env + mkdtemp + --test-concurrency=1) after a parallel-test race corrupted latest.json; full regen + build 248×7 pages + validate:seo all-pass + push. | 2026-07-08 | a08114da, bfcea823, +fix/data | [260708-mxx-formula-v9-1-part-2-docs-x7-known-limita](./quick/260708-mxx-formula-v9-1-part-2-docs-x7-known-limita/) |
| 260711-nml | Daily safety-news system + newsletter: pipeline Stage 7 news engine (6 event types, thresholds/hysteresis/cooldowns, 11 unit tests), homepage NewsHomeSection ×7 + localized news pages ×7 (validate:seo 2213→2228), 30-day backfill (29 events); mailing list on sentiment D1 (subscribers+digest_log, migrations applied remote), double-opt-in /api/{subscribe,confirm,unsubscribe} with GDPR consent record v1-2026-07-11, NewsletterSignup on country+news pages ×7, daily Resend digest via GHA (idempotent, ≥1-event days only); votes now record country_iso (CF country, no IP); legal pages ×7 updated (newsletter consent, vote-country LI, processors/DPF). Doc-only deliverables: COMMUNITY-SCORE-FORMULA-DESIGN.md (v10 draft: bounded post-composite modifier, diversity gate on voter origins) + LEGAL-PRIVACY-ASSESSMENT.md (no cookie banner needed; pre-existing Clarity cookie issue flagged SHOULD-fix). Multi-agent: Fable orchestrates, Opus plans, Sonnet executes. USER ACTION: add RESEND_API_KEY to GitHub secrets. | 2026-07-12 | f8daf833..(HEAD) | [260711-daily-news-and-mailing-list](./quick/260711-daily-news-and-mailing-list/) |
| 260708-lb3 | Formula v9.1 PART 1 (pipeline core): worldbank.ts mrnev=1 fix (restores wb_air_pollution coverage, 199 countries) + NEW wb_homicide/wb_population; NEW ucdp.ts (OWID/UCDP GED mirror, 196 countries); gpi.ts JSON-manifest primary source (GPI-2026 edition, 162 countries); advisories-tier1.ts fetchJpAdvisories full rewrite (dynamic riskmap discovery + name-based ISO3 map, fixes stale-page-ID spurious-L4 bug, 205/206 mapped, all discovery anchors live-verified); advisories.ts CA banner-ambiguity hardening + debug file; scripts/correct-gum-ca-history.ts (GUM ca=4 4-day blip, run). Engine v9.1.0 D1-D4 ported byte-exact (parity 0.0000/248, jp excluded); jp re-inclusion gate FAILED (0.362 > 0.25 threshold, kept excluded, fixed fetcher ships anyway). backfill.ts UCDP+WB-history vintage injection (dual-wired into run.ts too); all 669 historical snapshots + public/scores.json regenerated under v9.1.0; npm test 131/131. PART 2 (docs/i18n/UI/methodology) not started. | 2026-07-08 | 242fedaa, 4db345ea, 686afce3, ce8cb1a1, e5daeab0 | [260708-lb3-formula-v9-1-part-1-ucdp-gpi-json-wb-hom](./quick/260708-lb3-formula-v9-1-part-1-ucdp-gpi-json-wb-hom/) |

## Session Continuity

Last activity: 2026-07-12 - Daily news system + newsletter shipped (260711-nml): news engine Stage 7 + homepage/news pages ×7 + mailing list (double opt-in, daily digest) + vote geolocation + legal updates ×7. Formula v10 community-score design + legal/GDPR assessment delivered as docs (no code). Pending: RESEND_API_KEY in GitHub secrets (digest silently skips until then); Clarity cookie-banner question open (SHOULD).
Last session: 2026-07-12T10:50:00.000Z
Stopped at: Quick task 260711-nml complete, deployed
Resume file: None
