---
quick_id: 260710-map-pinch
slug: map-pinch-tooltip-fix
date: 2026-07-10
status: done
---

# Fix: preview card appears under a finger during mobile pinch-zoom on the map

Bug report: on mobile, starting a two-finger pinch-zoom on the safety map made the
country "preview card" (tooltip) pop up where one of the two fingers landed.

## Root cause

`SafetyMap.astro` bound tap logic to `touchstart` on each country path. `touchstart`
also fires for the first finger of a pinch (and for the second, with the tooltip
positioned at `touches[0]` — the *other* finger), so starting a pinch showed the card.
A second latent bug: the browser's synthetic `click` after a tap hit the plain `click`
handler, which navigated to the country page on the *first* tap — the intended
"first tap = preview, second tap = navigate" pattern never actually worked.

## Fix (src/components/SafetyMap.astro)

1. Removed the country-path `touchstart` handler. Tap logic moved into the `click`
   handler. The synthetic click only fires for a clean single-finger tap — never
   during a pinch or scroll — so it is the reliable tap signal.
2. Touch vs mouse classified by **touch recency** (`lastTouchTs`, 700ms window),
   NOT `PointerEvent.pointerType` — an adversarial 4-lens review found pointerType
   is mislabeled `'mouse'` on iOS 18.1–18.3 taps and `undefined` on Firefox ≤128
   (which would make hybrid-laptop mouse clicks need two clicks).
3. Container-level **capture-phase** `touchstart` listener: stamps `lastTouchTs`;
   second finger down hides any visible tooltip and resets `lastTappedIso3`.
   Capture on the container is required because d3-zoom
   `stopImmediatePropagation()`s two-finger touchstarts on the svg.
4. Hover handlers (mouseenter/mousemove/mouseleave) ignore synthetic post-tap
   mouse events (recency guard) — DOM mutation in tap-generated hover handlers
   makes iOS WebKit withhold the tap's click.
5. Tap navigation requires the country's preview to be **currently visible**
   (`lastTappedIso3` match + tooltip not hidden) — kills every stale-state
   surprise-navigation path found in review.
6. Preview dismissed + state reset on: document-level touch outside the map
   (self-removing listener), zoom +/− buttons, resize/rotate handler.

## Verification (CDP touch emulation, Playwright) — final suite, all pass

- T1 Pinch over a country → no preview card, zoom works (the reported bug)
- T2 Single tap → preview shows, NO navigation (previously navigated immediately)
- T3 Preview visible, then pinch → dismissed
- T4 Tap after pinch → preview again, no accidental navigation
- T5 Tap zoom '+' button → preview dismissed
- T6 Tap country, touch outside map → dismissed; re-tap same country → preview,
  NOT navigation (stale-state guard)
- T7 Second tap while preview visible → navigates
- T8 Desktop: hover → tooltip, mouse click → direct navigation
- Plus: single-finger scroll starting on a country → no preview, two-finger hint intact
- Adversarial 4-lens review workflow (browser compat, d3 internals, code regressions,
  mobile UX flows) drove refinements 2/4/5/6; production build + validate:seo before ship.

## Known accepted edge (from review, cosmetic)

- Hybrid device: real mouse click within 700ms of a touch is classified as touch
  (shows preview instead of navigating) — practically unreachable.
