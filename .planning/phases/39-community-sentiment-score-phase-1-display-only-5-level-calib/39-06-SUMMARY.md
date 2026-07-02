---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 06
subsystem: ui
tags: [astro, progressive-enhancement, no-framework, localstorage, turnstile, csp]

# Dependency graph
requires:
  - phase: 39-01
    provides: "/api/vote Pages Function ({iso3, delta, token?} POST contract, D1-backed, env-gated Turnstile verification)"
  - phase: 39-03
    provides: "sentiment.* i18n keys in all 7 locales (src/i18n/ui.ts)"
provides:
  - "src/components/country/SentimentVote.astro — the 5-level calibration vote widget (fieldset/legend + 5 radios + JS-gated submit + thank-you/error/soft-dedupe states)"
  - "public/_headers CSP (Report-Only) updated with challenges.cloudflare.com in script-src/connect-src/frame-src, ready for Turnstile the moment secrets are configured"
affects: [39-08, methodology-docs, privacy-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Progressive-enhancement vote widget: define:vars inline <script>, fetch POST, hidden/classList state-swap — mirrors src/pages/en/feedback/index.astro"
    - "localStorage soft-dedupe keyed sentiment-voted-<ISO3>, re-init on astro:after-swap — mirrors src/components/DarkModeToggle.astro"
    - "Env-gated third-party widget: import.meta.env.PUBLIC_<X> checked at build, component renders nothing when unset"

key-files:
  created: [src/components/country/SentimentVote.astro]
  modified: [public/_headers]

key-decisions:
  - "Radio options written as 5 explicit literal <label>/<input> pairs (not a .map() over an array) so each value=\"-2\"…\"2\" is a literal string in source, matching the plan's grep-based verification gate"
  - "officialScore accepted in Props (per the 39-08 component contract: <SentimentVote iso3 officialScore lang />) but not destructured/used in this plan — the vote widget itself never renders or POSTs officialScore; POST body stays exactly {iso3, delta, token?} per the plan's <interfaces> contract. Rendering the score/pillar bar is SentimentPillar's job (39-05/39-08), not this widget's"
  - "Turnstile auto-injects a hidden input[name=cf-turnstile-response] inside the <div class=\"cf-turnstile\"> once its script renders the challenge; the submit handler queries the form for that input at submit time rather than tracking a token globally, so it degrades to undefined (omitted from the JSON body) when Turnstile is absent or not yet solved"

requirements-completed: [D-02, D-12, D-17, D-18]

duration: 20min
completed: 2026-07-02
---

# Phase 39 Plan 06: SentimentVote widget Summary

**No-framework 5-level calibration vote widget (fieldset/legend + native radios, JS-gated progressive-enhancement fetch POST to `/api/vote`, localStorage soft-dedupe, env-gated Turnstile) plus the matching CSP allowlist update.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-02T10:56:00+02:00 (approx, after wave-1 base commit)
- **Completed:** 2026-07-02T11:02:22Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments
- `SentimentVote.astro`: a `<form>`→`<fieldset>`→`<legend>` (localized question with `{country}` interpolated) → 5 native radio options (values `-2,-1,0,1,2` mapped to `sentiment.level_way_high/high/right/low/way_low`) → JS-gated `<button type="submit">`, all meeting the 44px touch target.
- Client script (`define:vars={{ iso3 }}`, inline, re-initialized on `astro:after-swap`): reveals the submit button only after JS runs (silent degradation, D-18); on submit, POSTs `{iso3, delta, token?}` to `/api/vote`; on success sets `localStorage['sentiment-voted-'+iso3]` and swaps to a thank-you state; on failure shows a muted, non-alert error and leaves the selected option intact.
- Returning-voter soft dedupe: on init, if the `sentiment-voted-<ISO3>` localStorage key is present, the thank-you state renders immediately and the prompt is skipped — no cookies (D-17).
- Turnstile script + `.cf-turnstile` div render only when `import.meta.env.PUBLIC_TURNSTILE_SITEKEY` is truthy at build (D-12); the endpoint already degrades gracefully (39-01) when the corresponding secret is unset.
- `public/_headers`: added `challenges.cloudflare.com` to `script-src`, `connect-src`, and `frame-src` in the existing `Content-Security-Policy-Report-Only` line, preserving every existing source (cloudflareinsights, ko-fi, aviasales) and keeping the header in Report-Only mode.

## Task Commits

Each task was committed atomically:

1. **Task 1: SentimentVote.astro — 5-level form, fetch POST, states, localStorage dedupe, env-gated Turnstile** - `d6963d2d` (feat)
2. **Task 2: public/_headers — allow Turnstile origins in CSP (Report-Only)** - `21d0a1c7` (feat)

_Plan metadata commit: pending (this SUMMARY + any orchestrator-level state updates are applied after wave merge, per this plan's parallel-executor contract — STATE.md/ROADMAP.md are NOT touched here)._

## Files Created/Modified
- `src/components/country/SentimentVote.astro` - 5-level calibration vote widget: markup + progressive-enhancement client script; consumed by 39-08 inside `SentimentPillar`'s slot
- `public/_headers` - CSP (Report-Only) line extended with `challenges.cloudflare.com` in `script-src`/`connect-src`/`frame-src`

## Decisions Made
- Wrote the 5 radio options as explicit literal markup (not a data-driven `.map()`) so `value="-2"`…`value="2"` appear as literal strings in the component source — required for the plan's grep-based verification gate to pass against the raw `.astro` file (Astro's `{expr}` interpolation would not produce a literal match in source).
- Kept `officialScore` in the `Props` interface (to satisfy the `<SentimentVote iso3 officialScore lang />` contract 39-08 will use) without destructuring/rendering it — this widget's job is strictly the interactive calibration form; the score/pillar-bar display is `SentimentPillar`'s responsibility, and the POST body must stay exactly `{iso3, delta, token?}` per the plan's `<interfaces>` block.
- Queried for `input[name="cf-turnstile-response"]` at submit time (rather than maintaining a separate token variable) since Cloudflare's Turnstile script injects that hidden input into the containing form once rendered — this naturally yields `undefined` (and is omitted from the JSON body via `JSON.stringify`) when Turnstile is disabled or not yet solved, matching D-12's "absent ⇒ no widget, POST still works."

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated grep verification gates pass, and `npx astro check` (run via a temporary `node_modules` symlink to the main repo checkout, since this worktree has no local `node_modules`; the symlink was removed before committing since `node_modules/` is gitignored) reports 0 errors from `SentimentVote.astro` — only the same benign `astro(4000)` "treated as is:inline" warning already present on every other `define:vars` script in this codebase (e.g. `src/pages/en/feedback/index.astro`, `src/layouts/Base.astro`).

## Issues Encountered
- An early draft of the error-state HTML comment literally contained the string `role="alert"` while explaining that the component deliberately does NOT use it — this tripped the plan's negative grep gate (`! grep -q 'role="alert"'`). Reworded the comment to avoid the literal substring before committing; the actual markup never used `role="alert"`.

## User Setup Required

None - no external service configuration required by this plan. (Turnstile widget creation + `TURNSTILE_SECRET_KEY`/`PUBLIC_TURNSTILE_SITEKEY` remain a deferred, optional manual step tracked since 39-01/39-CONTEXT.md; this widget and the CSP are already ready for it.)

## Next Phase Readiness
- `SentimentVote.astro` is ready to be dropped into `SentimentPillar`'s `<slot/>` by 39-08 with `<SentimentVote iso3={country.iso3} officialScore={score} countryName={localizedName} lang={lang} />`.
- No blockers. CSP change is proactive and harmless while Report-Only; nothing else depends on this plan finishing first within wave 2.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/components/country/SentimentVote.astro
- FOUND: public/_headers
- FOUND: .planning/phases/39-community-sentiment-score-phase-1-display-only-5-level-calib/39-06-SUMMARY.md
- FOUND commit: d6963d2d (Task 1)
- FOUND commit: 21d0a1c7 (Task 2)
- FOUND commit: 8de27086 (docs: summary)
