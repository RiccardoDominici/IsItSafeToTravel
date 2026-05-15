---
quick_id: 260515-k5y
slug: fix-kofiwidgetoverlay-javascript-error-o
type: execute
mode: quick
date: 2026-05-15
branch: master
commit_docs: true
files_modified:
  - src/layouts/Base.astro
autonomous: true
must_haves:
  truths:
    - "No ReferenceError or TypeError from kofiWidgetOverlay when ko-fi script is blocked or fails to load"
    - "Ko-fi floating chat widget still renders when the external script loads successfully"
    - "Page rendering and other scripts are unaffected by ko-fi failure"
  artifacts:
    - path: "src/layouts/Base.astro"
      provides: "Defensive ko-fi widget initialization"
      contains: "kofiWidgetOverlay"
  key_links:
    - from: "src/layouts/Base.astro"
      to: "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      via: "onload + onerror handlers with typeof guard"
      pattern: "typeof kofiWidgetOverlay"
---

<objective>
Stop the `kofiWidgetOverlay is not defined` runtime error that fires on every page when the ko-fi CDN script is blocked (adblockers) or fails to load.

Purpose: Eliminate console noise and broken page initialization caused by an unguarded `kofiWidgetOverlay.draw()` call in `src/layouts/Base.astro`.

Output: Single defensive edit to `src/layouts/Base.astro` that guards the ko-fi widget initialization. Ko-fi widget remains functional when the script loads; no error is thrown when it does not.
</objective>

<context>
@src/layouts/Base.astro

## Current problematic markup (lines 127-135)

The ko-fi overlay script is loaded async; the inline script immediately after it calls `kofiWidgetOverlay.draw(...)` with no guard. When the CDN script is blocked (common — ko-fi domains are on most ad/tracker blocklists) or fails to load (network/CSP/404), `kofiWidgetOverlay` is `undefined` and the call throws.

## Investigation already complete

Root cause confirmed in user-provided context. No further research required. Fix is a small markup change; widget removal is a SEPARATE future task (TODO: replace ko-fi with travel affiliate link — do NOT remove ko-fi in this task).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Guard ko-fi widget initialization in Base.astro</name>
  <files>src/layouts/Base.astro</files>
  <action>
Modify the two script tags at lines 127-135 so the `kofiWidgetOverlay.draw()` call is only invoked after the external ko-fi script successfully loads, and is guarded against the `kofiWidgetOverlay` global being undefined.

Specifically:
1. Add an `id="kofi-overlay-script"` attribute to the ko-fi `<script src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js">` tag so it can be referenced. Keep `is:inline`.
2. Replace the second inline script (the one calling `kofiWidgetOverlay.draw(...)`) with a defensive version that:
   - Retrieves the script element by id.
   - Defines an `initKofi()` function that checks `typeof kofiWidgetOverlay !== 'undefined'` AND `typeof kofiWidgetOverlay.draw === 'function'` before calling `.draw('isitsafetotravel', { ...same config as before... })`. The draw config must remain unchanged: type `floating-chat`, donateButton text from the `donateButtonText` define:vars binding, background `#ffffff`, text-color `#323842`.
   - Wraps the `.draw()` call in `try { ... } catch (_) { /* no-op */ }` as a belt-and-suspenders measure.
   - Attaches `addEventListener('load', initKofi)` to the script element so initialization runs after the external script loads.
   - Attaches `addEventListener('error', function () { /* silent no-op */ })` to the script element so blocked/failed loads do not log noise.
   - Also calls `initKofi()` immediately in case the script already loaded by the time this inline runs (race condition safety) — the typeof guard makes this safe.

Keep `is:inline` and the existing `define:vars={{ donateButtonText: t('nav.donate') }}` binding on the inline script. Do not touch any other script in the file (the `tp-em.com` async loader and the `pillar-coverage-tip` import must remain untouched). Do not remove the ko-fi widget — replacement is a separate future task.

Do NOT introduce new dependencies. Do NOT modify other files.
  </action>
  <verify>
    <automated>grep -n "typeof kofiWidgetOverlay" src/layouts/Base.astro &amp;&amp; grep -n "kofi-overlay-script" src/layouts/Base.astro &amp;&amp; npm run build</automated>
  </verify>
  <done>
- `src/layouts/Base.astro` contains a `typeof kofiWidgetOverlay` guard and an `id="kofi-overlay-script"` reference.
- The ko-fi script tag has `load` and `error` event listeners attached via the inline script.
- The original ko-fi config (`floating-chat`, donateButton text/colors) is preserved unchanged.
- `npm run build` completes without errors.
- Manual smoke (executor): load any page with adblock enabled — no `kofiWidgetOverlay` error in the console. Load with adblock disabled — ko-fi floating chat widget renders.
  </done>
</task>

</tasks>

<verification>
- Build: `npm run build` succeeds.
- Source check: `grep -n "typeof kofiWidgetOverlay\|kofi-overlay-script" src/layouts/Base.astro` returns both matches.
- Runtime (manual, post-deploy):
  - With adblocker ON (blocking ko-fi): open https://isitsafetotravels.com/en/india — DevTools console shows NO `kofiWidgetOverlay is not defined` error.
  - With adblocker OFF: same page — ko-fi floating chat button renders in the bottom-right corner.
</verification>

<success_criteria>
- No `ReferenceError: kofiWidgetOverlay is not defined` (or equivalent `TypeError`) in any page's console, regardless of whether the ko-fi CDN script loads.
- Ko-fi floating chat widget still renders when the external script loads successfully.
- No other behavior changes; no new dependencies; single-file diff in `src/layouts/Base.astro`.
- One atomic commit; auto-deploy on push.
</success_criteria>

<output>
After completion, the executor commits the change with a message such as:
`fix(base): guard kofiWidgetOverlay against blocked/failed CDN load`

No SUMMARY.md required (quick mode).
</output>
