---
phase: 39
slug: community-sentiment-score-phase-1-display-only-5-level-calib
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 39-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test via tsx (`node --import tsx --test`) — repo standard (see `test:pipeline`) |
| **Config file** | none — per-file test scripts in package.json (pattern: `src/pipeline/scoring/__tests__/*.test.ts`) |
| **Quick run command** | `node --import tsx --test src/pipeline/sentiment/__tests__/*.test.ts` (Wave 0 creates) |
| **Full suite command** | `npm run test:pipeline && node --import tsx --test src/pipeline/sentiment/__tests__/*.test.ts` |
| **Estimated runtime** | ~10–20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched module (sentiment tests, or `npm run test:pipeline` when engine-adjacent files move)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green + `npx astro build` + `npm run validate:seo` all-pass (2213+ checks)
- **Max feedback latency:** 60 seconds (unit); the full `astro build` (~400s) runs once per wave at most, per CLAUDE.md guidance

---

## Per-Task Verification Map

*To be filled by gsd-planner — every task must map to a row.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/pipeline/sentiment/__tests__/aggregate.test.ts` — stubs for aggregation math (recency weighting, ±1.0 cap, vote floor, delta→display mapping)
- [ ] `functions/api/__tests__/vote-validation.test.ts` (or colocated pure-function module testable via node:test) — input validation (ISO3 allowlist, delta ∈ {−2..+2}), env-gated Turnstile branch, salted-hash dedupe determinism
- [ ] No framework install needed — node:test + tsx already in repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live D1 write via deployed Pages Function | D-11 | Needs deployed CF environment + binding | After deploy: `curl -X POST https://isitsafetotravel.org/api/vote -H 'Content-Type: application/json' -d '{"iso3":"ITA","delta":1}'` → 200; then D1 query shows the row |
| wrangler.toml `pages_build_output_dir` regression (root redirect + feedback form still work) | D-15 | Deploy-time behavior, config becomes authoritative over dashboard | After first deploy: GET / redirects per `functions/index.ts`; POST /api/feedback still 200 |
| GHA pipeline D1 read degradation without token permission | D-13/D-14 | Depends on live token scopes | Run pipeline locally without CF env vars → completes, sentiment step logs skip, site data unchanged |
| Vote widget UX states in browser (prompt/thanks/empty/no-JS) | D-17/D-18 | Visual/interaction | Dev server: vote, reload (localStorage dedupe), disable JS (widget hidden, page intact) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
