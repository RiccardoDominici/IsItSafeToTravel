---
phase: 39
slug: community-sentiment-score-phase-1-display-only-5-level-calib
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
updated: 2026-07-02
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 39-RESEARCH.md "## Validation Architecture". Per-Task Map filled by gsd-planner.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test via tsx (`node --import tsx --test`) — repo standard (see `test:pipeline`) |
| **Config file** | none — per-file test scripts in package.json (pattern: `src/pipeline/scoring/__tests__/*.test.ts`) |
| **Quick run command** | `node --import tsx --test <touched-test-file>` (Wave 0 files created by 39-01/39-02/39-04/39-05) |
| **Full suite command** | `npm run test:pipeline && npm run test:freshness && node --import tsx --test src/pipeline/sentiment/__tests__/*.test.ts functions/api/__tests__/*.test.ts src/lib/__tests__/sentiment.test.ts` |
| **Phase gate** | `npx astro build && npm run validate:seo` all-pass (~2213 checks, D-22) |
| **Estimated runtime** | unit ~10–20s; phase gate ~400s (build) run once at Wave 3 |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched module (sentiment/vote/lib tests, or `npm run test:pipeline` when scoring-adjacent).
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** Full suite green + `npx astro build` + `npm run validate:seo` all-pass.
- **Max feedback latency:** 60s (unit); the full build (~400s) runs once at Wave 3 per CLAUDE.md guidance.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-T1 | 39-01 | 1 | D-11,D-15,D-16 | T-39-01 | D1 binding via config; append-only schema; parameterizable | config assertion | `grep pages_build_output_dir/database_id/CREATE TABLE` | ✅ creates | ⬜ pending |
| 39-01-T2 | 39-01 | 1 | D-01,D-02,D-11,D-12 | T-39-01,02,03 | input validation, salted-hash dedupe, env-gated Turnstile, parameterized INSERT, no raw IP | source assertion | `grep crypto.subtle / INSERT…VALUES(? / TURNSTILE / !node:crypto` | ✅ creates | ⬜ pending |
| 39-01-T3 | 39-01 | 1 | D-01,D-02,D-12 | T-39-01,02,03 | validation + hash determinism (no raw IP in hash) | unit | `node --import tsx --test functions/api/__tests__/vote-validation.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-02-T1 | 39-02 | 1 | D-03,D-07,D-08,D-09 | T-39-08 | ±1.0 cap, floor, perceived clamp bound influence | unit | `node --import tsx --test src/pipeline/sentiment/__tests__/aggregate.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-02-T2 | 39-02 | 1 | D-06 | T-39-10 | sentiment never enters 5-pillar scoring | unit | `node --import tsx --test src/pipeline/sentiment/__tests__/score-invariance.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-03-T1 | 39-03 | 1 | D-02,D-05,D-07,D-09,D-17 | T-39-12 | locale key parity (no fallthrough) | integration (grep) | `grep -c '<key>' == 7` per key | ✅ edits | ⬜ pending |
| 39-03-T2 | 39-03 | 1 | D-19,D-20 | T-39-11,24 | honest privacy + no-total-impact copy | integration (grep) | `grep -c methodology.sentiment_/legal.privacy_votes_ == 7` | ✅ edits | ⬜ pending |
| 39-04-T1 | 39-04 | 2 | D-13,D-14 | T-39-13,14 | fetchVotes never throws; degrade on missing env | unit | `node --import tsx --test src/pipeline/sentiment/__tests__/fetch-votes.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-04-T2 | 39-04 | 2 | D-10,D-14 | T-39-14,16 | keep-last-known; separate small history file; never fail run | unit + source | `npm run test:pipeline` + `grep Stage 6 / !data/scores/history-index` | ✅ edits | ⬜ pending |
| 39-04-T3 | 39-04 | 2 | D-13,D-16 | T-39-13 | CF creds passthrough; commit data/sentiment | source assertion | `grep CLOUDFLARE_API_TOKEN / git add data/sentiment/` | ✅ edits | ⬜ pending |
| 39-05-T1 | 39-05 | 2 | D-14 | T-39-19 | loader returns null gracefully (no throw) | unit | `node --import tsx --test src/lib/__tests__/sentiment.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-05-T2 | 39-05 | 2 | D-04,D-06,D-07,D-09 | T-39-17,18 | no JSON-LD; display-only; below-floor state | source + astro check | `grep slot/disclaimer/!ld+json/!PillarScore` + `npx astro check` | ✅ creates | ⬜ pending |
| 39-06-T1 | 39-06 | 2 | D-02,D-12,D-17,D-18 | T-39-20,21,22 | progressive enhancement; silent degrade; localStorage; env-gated Turnstile; no role=alert | source assertion | `grep /api/vote / sentiment-voted- / PUBLIC_TURNSTILE / aria-live / !role=alert` | ✅ creates | ⬜ pending |
| 39-06-T2 | 39-06 | 2 | D-12 | T-39-23 | CSP allows Turnstile origins; stays Report-Only | source assertion | `grep challenges.cloudflare.com x3 / Report-Only` | ✅ edits | ⬜ pending |
| 39-07-T1 | 39-07 | 2 | D-19 | T-39-25 | methodology states no total-score impact; no @graph change | integration (grep) + phase gate | `grep -rl methodology.sentiment_title == 7` | ✅ edits | ⬜ pending |
| 39-07-T2 | 39-07 | 2 | D-20 | T-39-24 | honest vote-processing disclosure | integration (grep) | `grep -rl legal.privacy_votes_title == 7` | ✅ edits | ⬜ pending |
| 39-08-T1 | 39-08 | 3 | D-04,D-06,D-21 | T-39-27,28 | sibling section (not a pillar); scope-limited to 7 templates | source assertion | `grep -rl SentimentPillar/loadSentimentForCountry == 7` | ✅ edits | ⬜ pending |
| 39-08-T2 | 39-08 | 3 | D-22 | T-39-26 | country @graph invariant + description uniqueness intact | integration | `npx astro build && npm run validate:seo` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `functions/api/__tests__/vote-validation.test.ts` (39-01) — isValidDelta/isValidIso3/voterHash determinism + no-raw-IP.
- [ ] `src/pipeline/sentiment/__tests__/aggregate.test.ts` (39-02) — recency weighting, ±1.0 cap, floor, perceived clamp.
- [ ] `src/pipeline/sentiment/__tests__/score-invariance.test.ts` (39-02) — D-06 guard (exactly 5 scoring pillars).
- [ ] `src/pipeline/sentiment/__tests__/fetch-votes.test.ts` (39-04) — degradation: missing env / thrown fetch ⇒ {ok:false, rows:[]}.
- [ ] `src/lib/__tests__/sentiment.test.ts` (39-05) — loader returns null on missing file/country (no throw).
- [ ] No framework install needed — node:test + tsx already in repo.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live D1 write via deployed Pages Function | D-11 | Needs deployed CF env + binding + applied schema | After schema apply + deploy: `curl -X POST https://isitsafetotravel.org/api/vote -H 'Content-Type: application/json' -d '{"iso3":"ITA","delta":1}'` → 200; D1 query shows one row |
| wrangler.toml config-activation regression | D-15 | Config becomes authoritative over dashboard (Pitfall 2) | After first deploy: GET / redirects (functions/index.ts) and POST /api/feedback still 200 |
| GHA pipeline D1 read degradation without token perm | D-13/D-14 | Depends on live token scopes | Run `npx tsx src/pipeline/run.ts <date>` without CF env → completes, Stage 6 logs skip, empty-but-valid data/sentiment/latest.json, no data/scores change |
| Vote widget UX states in browser | D-17/D-18 | Visual/interaction | Dev server: vote → thank-you; reload → still thank-you (localStorage); disable JS → submit hidden, page intact |

---

## Post-Phase User / Orchestrator Actions (deferred, non-blocking)

1. Apply schema to remote D1: `npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/sentiment-schema.sql` (id 83acaffe-32ff-43fc-b68f-5343d01000d5).
2. Set Pages secret `VOTE_HASH_SALT` (long random string).
3. Grant `CLOUDFLARE_API_TOKEN` D1 read permission (pipeline degrades gracefully until then — D-14).
4. OPTIONAL: create a Turnstile widget; set `TURNSTILE_SECRET_KEY` (Pages secret) + `PUBLIC_TURNSTILE_SITEKEY` (build env). Endpoint + widget work without them (env-gated — D-12).
5. Post-deploy smoke test of `/` redirect + `/api/feedback` (Pitfall 2).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit); phase build gate runs once at Wave 3
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-complete (pending checker)
