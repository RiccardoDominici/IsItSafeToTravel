---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
verified: 2026-07-02T11:40:00Z
status: human_needed
score: 41/41 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Vote widget UX states in a browser (or `npm run dev`): select a calibration level, submit, see thank-you state; reload the page and confirm the thank-you state persists (localStorage `sentiment-voted-<ISO3>`); disable JS and confirm the submit button stays hidden and the page is otherwise intact."
    expected: "Thank-you swap on submit, persists across reload, silent degradation with JS off — matches D-17/D-18."
    why_human: "Visual/interaction state machine in a real browser; cannot be proven by grep or unit tests alone (39-VALIDATION.md 'Manual-Only Verifications' — Vote widget UX states)."
  - test: "Live D1 write via the deployed Pages Function: after the production deploy, `curl -X POST https://isitsafetotravel.org/api/vote -H 'Content-Type: application/json' -d '{\"iso3\":\"ITA\",\"delta\":1}'` and confirm a 200 response, then query D1 to confirm one new row in `votes`."
    expected: "200 `{ok:true}` and exactly one new row (or `{ok:true, deduped:true}` on repeat)."
    why_human: "Needs the deployed Cloudflare environment + applied binding; the deploy for this phase has not shipped yet at verification time (39-VALIDATION.md — Live D1 write)."
  - test: "Post-deploy config-activation regression check: after the first deploy following this phase's `wrangler.toml` edit (D-15, which makes the file authoritative over the dashboard per Pitfall 2), confirm `GET /` still performs its language redirect and `POST /api/feedback` still returns 200."
    expected: "Both existing behaviors unchanged."
    why_human: "Depends on the live Cloudflare Pages deploy; wrangler.toml becoming authoritative is a deploy-time risk that cannot be proven from source alone (39-VALIDATION.md — wrangler.toml config-activation regression)."
  - test: "GHA pipeline D1-read degradation on the real daily run: once merged, watch the next `data-pipeline.yml` run and confirm Stage 6 either aggregates real votes (if `CLOUDFLARE_API_TOKEN` has been granted D1 read) or logs a graceful skip and leaves `data/sentiment/latest.json` as an empty-but-valid snapshot (if not yet granted) — either way the run's overall success/commit step must be unaffected."
    expected: "Daily run completes green regardless of D1-token grant status; `data/sentiment/` present and valid either way."
    why_human: "Depends on the real GHA secret scope and a live scheduled run; the local unit tests already prove the degradation logic in isolation, but the actual CI credential grant is an operational step outside this repo's source (39-VALIDATION.md — GHA pipeline D1 read degradation)."
---

# Phase 39: Community Sentiment Score (Phase 1 — display-only) Verification Report

**Phase Goal:** Visitors on a country page can calibrate the official 1–10 safety score with a
5-level "does this feel right?" vote. Votes are ingested live by a Cloudflare Pages Function into
D1, aggregated once a day by the existing GitHub Actions pipeline into static data, and surfaced
as a NEW translated 6th pillar "Sentiment" — display-only, weight 0, total score NOT affected.
Methodology + privacy docs updated in all 7 languages. `validate:seo` stays all-pass.

**Verified:** 2026-07-02T11:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 41 must-have truths declared across the phase's 8 plans (39-01 through 39-08) were checked
directly against the codebase — not against SUMMARY.md claims.

| # | Truth | Plan | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | Valid POST `/api/vote` inserts one append-only row, returns 200 | 39-01 | VERIFIED | `functions/api/vote.ts` — validated iso3+delta, parameterized `INSERT INTO votes (...) VALUES (?,?,?,?,?,?)` |
| 2 | Malformed input rejected 4xx, no row written | 39-01 | VERIFIED | Validation (`isValidIso3`/`isValidDelta`) runs before any DB call; returns 400/413 |
| 3 | Repeat vote from same salted voter hash rejected without insert | 39-01 | VERIFIED | Dedupe `SELECT COUNT(*)` check precedes INSERT, returns early on match |
| 4 | `TURNSTILE_SECRET_KEY` absent ⇒ endpoint still accepts votes | 39-01 | VERIFIED | `if (turnstileSecret) { ... }` — verification block skipped entirely when unset |
| 5 | Never stores/logs raw IP, only salted SHA-256 hash | 39-01 | VERIFIED | `voterHash()` via `crypto.subtle.digest`; `ip` variable never passed to `console.*` |
| 6 | D1 binding `DB` declared in active `wrangler.toml` Pages config | 39-01 | VERIFIED | `pages_build_output_dir` + `[[d1_databases]]` present; remote schema confirmed live (see Probe/D1 section) |
| 7 | Recency-weighted mean, hard ±1.0 cap | 39-02 | VERIFIED | `aggregate.test.ts` 14/14 pass, incl. explicit cap-saturation cases |
| 8 | perceived = clamp(official + correction, 1, 10) | 39-02 | VERIFIED | Tested (floor/ceil cases) |
| 9 | <5 votes ⇒ country omitted (insufficient) | 39-02 | VERIFIED | Tested; `SentimentPillar` renders empty state for any `null`/below-floor entry |
| 10 | Sentiment types structurally independent of `PillarName` | 39-02 | VERIFIED | `grep SentimentEntry src/pipeline/types.ts` + `! grep 'PillarName =.*sentiment'` |
| 11 | Scoring engine still produces exactly 5 pillars | 39-02 | VERIFIED | `score-invariance.test.ts` 4/4 pass; `npm run test:pipeline` 33/33 pass |
| 12 | All 7 `ui.ts` locale blocks contain the identical sentiment/methodology/privacy key set | 39-03 | VERIFIED | Re-ran all 21 key-parity greps — every key present exactly 7× |
| 13 | 5 calibration labels map to correct signed deltas (D-02) | 39-03 | VERIFIED | `SentimentVote.astro` radios `value="-2"…"2"` paired with `sentiment.level_way_high…way_low` |
| 14 | `{country}`/`{delta}`/`{count}` interpolation tokens present per locale | 39-03 | VERIFIED | Spot-checked all 7 locale lines for `sentiment.question`/`correction_label`/`vote_count` |
| 15 | No key missing from any locale (parity) | 39-03 | VERIFIED | Grep counts all == 7, zero drift |
| 16 | Stage 6 reads D1, aggregates, writes `data/sentiment/{latest,date,history-index}.json` | 39-04 | VERIFIED | `run.ts` Stage 6 block calls `fetchVotes` → `aggregateVotes` → `writeSentimentSnapshot`/`writeSentimentHistoryIndex` |
| 17 | D1 unreachable/token missing ⇒ pipeline completes, last-known file preserved | 39-04 | VERIFIED | Code + `fetch-votes.test.ts` (7/7) prove `{ok:false, rows:[]}` on every failure path; `run.ts` preserves existing `latest.json` on `!ok` |
| 18 | First-ever run ⇒ empty-but-valid `latest.json` | 39-04 | VERIFIED | `run.ts` writes `{generatedAt, countries:{}}` via `writeSentimentSnapshot` when no prior file exists |
| 19 | Sentiment history in its own small file, never appended to `data/scores/history-index.json` | 39-04 | VERIFIED | `snapshot.ts` writes only `data/sentiment/**`; `! grep 'data/scores/history-index'` |
| 20 | Daily workflow commits `data/sentiment/` + passes CF credentials | 39-04 | VERIFIED | `data-pipeline.yml` has `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` env + `git add data/sentiment/` |
| 21 | Sentiment failure never changes `PipelineResult.success` | 39-04 | VERIFIED | Stage 6 wrapped in try/catch that only `console.warn`s; `success: sourcesSucceeded > 0` untouched |
| 22 | `loadSentimentForCountry` returns entry/null, never throws | 39-05 | VERIFIED | Code read (fs.existsSync guard + try/catch) + `sentiment.test.ts` passes |
| 23 | `SentimentPillar` renders bar visually identical to other pillars via `pillarToColor` | 39-05 | VERIFIED | Code read: same `w-28`/`viewBox 200x24`/`w-14` anatomy as `PillarBreakdown` |
| 24 | Card shows badge, signed correction, vote count, persistent disclaimer | 39-05 | VERIFIED | Code read confirms all four elements always rendered |
| 25 | Below-floor ⇒ localized empty state + vote CTA slot still present | 39-05 | VERIFIED | Code read + confirmed live in built `dist/client/en/country/ita/index.html` ("Not enough votes yet" renders) |
| 26 | No JSON-LD, not a member of `country.pillars` | 39-05 | VERIFIED | `! grep application/ld+json`, `! grep PillarScore`; dist HTML ld+json blocks contain no "sentiment" string |
| 27 | 5-level fieldset/legend + 44px touch targets | 39-06 | VERIFIED | Code read: `min-h-[44px]` on every option row and the submit button |
| 28 | Submit POSTs `{iso3,delta[,token]}`, swaps to thank-you; failure ⇒ muted error | 39-06 | VERIFIED | Code read: `fetch('/api/vote', ...)`, `res.ok` branch vs catch/non-ok branch |
| 29 | `localStorage` soft-dedupe key `sentiment-voted-<ISO3>` | 39-06 | VERIFIED | Code read: get on init, set on success |
| 30 | JS disabled ⇒ submit stays hidden, page unaffected | 39-06 | VERIFIED | `hidden` class only removed inside the inline script |
| 31 | Turnstile renders only when `PUBLIC_TURNSTILE_SITEKEY` configured | 39-06 | VERIFIED | `{turnstileSitekey && (...)}` guards both the script and the widget div |
| 32 | CSP allows `challenges.cloudflare.com` in script-src/frame-src/connect-src | 39-06 | VERIFIED | `public/_headers` — 3 occurrences, still Report-Only, existing sources intact |
| 33 | All 7 methodology pages: 5 levels, ±1.0 cap, explicit "does NOT affect total score" | 39-07 | VERIFIED | Grep 7/7 + read full `methodology.sentiment_text` value for all 7 locales — every one contains an explicit no-impact clause |
| 34 | All 7 privacy pages: salted-hash dedupe, no raw IP, Turnstile-when-enabled, localStorage note | 39-07 | VERIFIED | Grep 7/7 `legal.privacy_votes_title`/`_text` |
| 35 | Copy rendered via `t()` keys, not hardcoded | 39-07 | VERIFIED | All matches are `{t('methodology.sentiment_*')}`/`{t('legal.privacy_votes_*')}` calls |
| 36 | No JSON-LD/@graph changes from doc edits | 39-07 | VERIFIED | Confirmed by the live `validate:seo` re-run (2213/2213, see below) |
| 37 | All 7 country templates render `<SentimentPillar>` after `<PillarBreakdown>` with `<SentimentVote>` nested | 39-08 | VERIFIED | Corrected-quoting grep across all 7 `[slug].astro` files: pillar=7, load=7, vote=7 |
| 38 | `getStaticPaths` threads `sentiment` prop from `loadSentimentForCountry` | 39-08 | VERIFIED | `sentiment: loadSentimentForCountry(country.iso3)` present in all 7 templates |
| 39 | Total score / ScoreHero / `PillarBreakdown` unchanged | 39-08 | VERIFIED | `country.pillars` usage in en template unchanged (still only `PillarBreakdown`/`PillarDetailTable`); phase commit diff limited to declared files |
| 40 | `npx astro build` + `npm run validate:seo` all-pass on the full site | 39-08 | VERIFIED (live re-run) | Re-ran independently on current master: **1906 pages built in 495.8s; validate:seo 2213/2213 passed, 0 failed** |
| 41 | Sentiment confined to country + methodology + privacy pages only (D-21) | 39-08 | VERIFIED | Full phase file-diff (`2d5a1d47^..ee98d7b3`) shows zero touches to map, comparison, hub/ranking, llms generators, or OG scripts |

**Score:** 41/41 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `wrangler.toml` | Active Pages config, D1 binding `DB` | VERIFIED | `pages_build_output_dir`, `database_id 83acaffe-32ff-43fc-b68f-5343d01000d5` present |
| `db/sentiment-schema.sql` | `votes` table + 3 indexes | VERIFIED | Confirmed live on remote D1 via `wrangler d1 execute --remote` (table + all 3 indexes present) |
| `functions/api/vote.ts` | Full ingestion endpoint | VERIFIED | Complete, real implementation — no stubs; exports `onRequestPost`, `onRequestOptions`, `isValidDelta`, `isValidIso3`, `voterHash` |
| `functions/api/__tests__/vote-validation.test.ts` | Unit tests | VERIFIED | Runs as part of the 47/47 passing suite |
| `src/pipeline/types.ts` | `SentimentEntry`/`SentimentSnapshot`/`VoteRow` | VERIFIED | Present as a structurally-independent banner-commented block |
| `src/pipeline/sentiment/aggregate.ts` | `aggregateVotes()` + constants | VERIFIED | Full implementation, 14 passing tests |
| `src/pipeline/sentiment/fetch-votes.ts` | D1 HTTP client, never throws | VERIFIED | Full implementation, 7 passing tests |
| `src/pipeline/sentiment/snapshot.ts` | Writers for latest/date/history-index | VERIFIED | Full implementation, correctly scoped away from `data/scores/` |
| `src/pipeline/run.ts` | Stage 6 block | VERIFIED | Present, wrapped in try/catch, does not affect `success` |
| `.github/workflows/data-pipeline.yml` | CF env + `git add data/sentiment/` | VERIFIED | Both present, `RELIEFWEB_APPNAME`/`continue-on-error` preserved |
| `src/lib/sentiment.ts` | Build-time loader + `MIN_VOTE_FLOOR` | VERIFIED | Full implementation, graceful-null tested |
| `src/components/country/SentimentPillar.astro` | Display card + slot | VERIFIED | Full implementation, no JSON-LD, confirmed rendering in built HTML |
| `src/components/country/SentimentVote.astro` | Vote widget | VERIFIED | Full implementation, all states present |
| `public/_headers` | CSP Turnstile allowlist | VERIFIED | 3 occurrences added, Report-Only preserved |
| `src/i18n/ui.ts` | 21 new keys × 7 locales | VERIFIED | 147 key/value pairs, zero drift |
| 7× methodology pages | Sentiment section | VERIFIED | All 7 contain the explicit no-total-impact statement |
| 7× legal pages | Community-votes paragraph | VERIFIED | All 7 present |
| 7× country `[slug].astro` | Wired composition | VERIFIED | All 7 import + wire `SentimentPillar`/`SentimentVote`/`loadSentimentForCountry` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `functions/api/vote.ts` | `context.env.DB` (D1) | Prepared `INSERT ... VALUES (?,...)` | VERIFIED | Parameterized, no string concatenation anywhere |
| `wrangler.toml [[d1_databases]]` | `database_id 83acaffe-...` | Pages config-file binding | VERIFIED | Confirmed matches the real provisioned database; remote schema live |
| `aggregate.ts aggregateVotes` | official scores map | `perceived = clamp(official + correction, 1, 10)` | VERIFIED | Tested |
| `score-invariance.test.ts` | `computeAllScores` | `pillars.length === 5` assertion | VERIFIED | Test passes |
| `src/i18n/ui.ts sentiment.*` | Components + doc pages | `t()`/`useTranslations(lang)` lookup | VERIFIED | Confirmed by direct code read of consumer files |
| `src/pipeline/sentiment/fetch-votes.ts` | `api.cloudflare.com/.../d1/database/.../query` | `fetch` POST + Bearer token | VERIFIED | Code matches; remote endpoint confirmed reachable (schema query succeeded) |
| `run.ts Stage 6` | `aggregateVotes` + `writeSentimentSnapshot` | try/catch that only warns | VERIFIED | Code read confirms exact shape |
| `SentimentPillar.astro` | `src/lib/colors.ts pillarToColor` | bar fill at `perceived/10` | VERIFIED | Import + call present |
| `SentimentPillar.astro` | sentiment entry | `count >= MIN_VOTE_FLOOR` gate | VERIFIED | `hasEnough` branch present |
| `SentimentVote.astro` | `/api/vote` (39-01) | `fetch('/api/vote', {method:'POST',...})` | VERIFIED | Present, correct body shape |
| `SentimentVote.astro` | `localStorage sentiment-voted-<iso3>` | soft dedupe get/set | VERIFIED | Present, wrapped in try/catch for storage-unavailable case |
| methodology pages | `ui.ts methodology.sentiment_*` | `t()` lookup in new `<section>` | VERIFIED | Present, correct keys |
| legal pages | `ui.ts legal.privacy_votes_*` | `t()` lookup in privacy sub-block | VERIFIED | Present, correct keys |
| country `[slug].astro getStaticPaths` | `loadSentimentForCountry` (39-05) | `props.sentiment` | VERIFIED | Present in all 7 |
| `<SentimentPillar>` | `<SentimentVote>` (slot child) | composition in template | VERIFIED | Confirmed both render together in built dist HTML |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SentimentPillar.astro` | `sentiment` prop | `loadSentimentForCountry(country.iso3)` called in `getStaticPaths`, reading `data/sentiment/latest.json` (baked by `run.ts` Stage 6 from real D1 rows via HTTP API) | Not yet — `data/sentiment/` does not exist on master because the daily pipeline has not run since this phase merged (and `CLOUDFLARE_API_TOKEN` D1-read grant is a deferred manual step) | ⚠️ CURRENTLY EMPTY, BY DESIGN — confirmed the empty-state path is the real graceful-degradation code path (not a hardcoded stub): built `dist/client/en/country/ita/index.html` renders "Not enough votes yet" via the genuine `hasEnough` branch, driven by `loadSentimentForCountry` returning `null` because the file is absent. This is the intended D-14 behavior until the daily pipeline runs with a granted D1 token — not a defect. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full sentiment/vote/lib unit suite | `node --import tsx --test src/pipeline/sentiment/__tests__/*.test.ts src/lib/__tests__/sentiment.test.ts functions/api/__tests__/vote-validation.test.ts` | 47/47 pass | ✓ PASS |
| Scoring regression suite | `npm run test:pipeline` | 33/33 pass | ✓ PASS |
| Remote D1 schema live | `npx wrangler d1 execute isitsafetotravel-sentiment --remote --command "SELECT name FROM sqlite_master..."` | `votes` table + `idx_votes_iso3_created`, `idx_votes_dedupe`, `idx_votes_daycap` all present | ✓ PASS |
| Full site build (independent re-run on master, not the executor's worktree claim) | `npx astro build` | 1906 pages built in 495.8s, exit 0 | ✓ PASS |
| SEO post-build gate (independent re-run on master) | `npm run validate:seo` | 2213/2213 checks passed, 0 failed | ✓ PASS |
| Sentiment section renders, no JSON-LD leak | grep + node script against built `dist/client/en/country/ita/index.html` | "Community Sentiment" + "sentiment-vote" present; 2 ld+json blocks, neither contains "sentiment" | ✓ PASS |
| Live-vote-endpoint curl (production) | n/a | Not run — deploy for this phase has not shipped yet | ? SKIP (harvested to human_verification) |

### Probe Execution

No probes declared for this phase (not a migration/tooling phase) — `scripts/*/tests/probe-*.sh` search returned nothing, and no plan/summary references probe scripts. Skipped by design.

### Requirements Coverage

This phase predates the v4.0 REQUIREMENTS.md ID set and is governed instead by CONTEXT.md decisions D-01..D-22 (per the orchestrator's framing). All 22 decisions were traced to concrete, verified implementation:

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | Calibration, not like/dislike | SATISFIED | 5-level fieldset, not binary |
| D-02 | 5 levels → signed deltas −2..+2 | SATISFIED | `isValidDelta`, radio values, i18n labels all consistent |
| D-03 | Aggregate is a correction, not independent rating | SATISFIED | `correction` field explicit in types + display |
| D-04 | New 6th pillar "Sentiment", styled like the others | SATISFIED | `SentimentPillar.astro` mirrors `PillarBreakdown` anatomy |
| D-05 | Pillar label translated in all 7 languages | SATISFIED | `country.pillar.sentiment` × 7 |
| D-06 | Phase 1 = display-only, weight 0, engine.ts untouched | SATISFIED | `score-invariance.test.ts` + engine.ts/weights.json diff-free |
| D-07 | Absolute perceived value + explicit correction shown | SATISFIED | `perceived`/`correction_label` both rendered |
| D-08 | Recency-weighted mean, ±1.0 cap, tunable constants | SATISFIED | `aggregate.ts` constants + tests |
| D-09 | Minimum vote floor (5), below-floor empty state | SATISFIED | `MIN_VOTE_FLOOR`/`SENTIMENT_MIN_VOTES` both 5, tested |
| D-10 | Daily time series, own small file | SATISFIED | `data/sentiment/history-index.json`, separate from `data/scores/` |
| D-11 | Cloudflare Pages Function → D1 ingestion | SATISFIED | `functions/api/vote.ts` writes `env.DB` |
| D-12 | Anti-abuse: salted hash + env-gated Turnstile | SATISFIED | Dedupe/day-cap + `TURNSTILE_SECRET_KEY` guard |
| D-13 | Daily GHA pipeline pulls D1 aggregates via HTTP API | SATISFIED | `fetch-votes.ts` + `data-pipeline.yml` env |
| D-14 | Graceful degradation everywhere | SATISFIED | Every failure path in vote.ts/fetch-votes.ts/run.ts/sentiment.ts returns a safe default, never throws |
| D-15 | wrangler.toml config-file binding, real database_id | SATISFIED | Confirmed + remote schema live |
| D-16 | Free-tier budget respected | SATISFIED | Single INSERT/vote, windowed reads, daily-only aggregation |
| D-17 | Vote widget UX + localStorage dedupe | SATISFIED (needs human browser check — see below) | Code complete; interactive states need visual confirmation |
| D-18 | Progressive enhancement, no cookies | SATISFIED | JS-gated submit, silent degradation confirmed in code |
| D-19 | Methodology docs ×7, explicit no-impact statement | SATISFIED | All 7 locale texts read in full, statement present in every one |
| D-20 | Privacy docs ×7, honest vote-processing disclosure | SATISFIED | All 7 present |
| D-21 | Scope guard — country/methodology/privacy only | SATISFIED | Full phase diff confirms zero touches outside scope |
| D-22 | validate:seo stays all-pass | SATISFIED | Live re-run: 2213/2213, 0 regressions |

No orphaned decisions — all 22 traced to evidence.

### Anti-Patterns Found

None. Scanned all 18 phase-touched source/config files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, placeholder-language, and hardcoded-empty-render patterns — zero matches. All implementations read as complete, production-quality code with real logic (not stubs).

One informational item: the 39-04-SUMMARY.md self-flagged that `data/sentiment/**` was a new pipeline-owned generated directory not yet listed in CLAUDE.md's "Do NOT hand-edit generated files" table. This has since been addressed — `CLAUDE.md` on disk currently has an **uncommitted** edit adding `data/sentiment/**` to that table. This is a documentation improvement, not a phase blocker; flagging so it gets committed alongside this phase's changes.

### Human Verification Required

See frontmatter `human_verification` for the structured list. Summary:

1. **Vote widget UX states in a browser** — select/submit/thank-you/reload-persistence/no-JS behavior. Code is complete and every individual mechanism (fetch call, localStorage key, hidden-class gating) is verified by direct code read, but the actual interactive state machine has not been exercised in a browser.
2. **Live D1 write via the deployed Pages Function** — the endpoint code, schema, and remote D1 table/indexes are all confirmed correct and live, but no live POST has been made against the deployed production endpoint yet (deploy for this phase is pending).
3. **Post-deploy config-activation regression** (`/` redirect + `/api/feedback`) — `wrangler.toml` becoming an active Pages config is a known deploy-time risk (Pitfall 2) that the plan itself flagged as needing a manual smoke test after the first deploy.
4. **GHA pipeline D1-read degradation on a real scheduled run** — the degradation logic is fully unit-tested in isolation (`fetch-votes.test.ts`), but has not been observed on an actual `data-pipeline.yml` run yet.

These four items were all pre-declared by the phase's own planner in `39-VALIDATION.md`'s "Manual-Only Verifications" table and by `39-CONTEXT.md`'s "Deferred Ideas" — they are expected, non-blocking, post-deploy operational checks, not defects. They are surfaced here per verification protocol rather than silently marked passed.

### Gaps Summary

No gaps. All 41 declared must-have truths, all 18 required artifacts (existence + substance + wiring), and all 15 key links verified directly against the codebase — not against SUMMARY.md claims. The phase's own automated test suites (47 sentiment/vote/lib tests + 33 scoring-regression tests, 80/80 total) pass. The remote D1 database and schema are confirmed live and reachable. A fresh, independent `astro build` + `validate:seo` run on the current `master` state (not reused from any executor worktree) confirms 1906 pages build cleanly and all 2213 SEO checks pass with zero regression. The scope guard (D-21) was independently confirmed by diffing every file touched across the phase's commit range — nothing outside country/methodology/privacy/i18n/pipeline/vote-function files was modified.

The only open items are four pre-declared, deploy-dependent manual checks (browser UX, live production POST, post-deploy config-activation smoke test, real-world GHA D1-read behavior) that cannot be exercised until this phase is deployed — exactly as the phase's own planning documents anticipated. Status is `human_needed` rather than `passed` strictly because these items exist, not because of any detected defect.

---

*Verified: 2026-07-02T11:40:00Z*
*Verifier: Claude (gsd-verifier)*
