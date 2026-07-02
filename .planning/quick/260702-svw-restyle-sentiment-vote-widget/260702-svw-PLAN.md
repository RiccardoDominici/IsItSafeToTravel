---
phase: quick-260702-svw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/country/SentimentVote.astro
  - src/components/country/SentimentPillar.astro
autonomous: true
requirements: [UI-SENTIMENT-POLISH]
must_haves:
  truths:
    - "The 5 calibration options render as bordered selectable cards with a custom radio indicator, hover/selected/focus-visible states, light + dark"
    - "JS contract unchanged: ids sentiment-vote-form/-submit/-thanks/-error, input name=calibration values -2..2, .sentiment-vote-option hook, submit hidden+disabled until JS init, localStorage soft-dedupe, fetch POST /api/vote"
    - "Zero new i18n strings — only aria-hidden decorative SVGs added; all 7 locales unaffected"
    - "Turnstile conditional block byte-identical; aria-live thanks region and muted error (no role=alert) preserved"
    - "Native radios stay keyboard-focusable (sr-only, not display:none) with visible has-[:focus-visible] ring; >=44px touch targets"
    - "npm run validate:seo stays all-pass"
  artifacts:
    - path: "src/components/country/SentimentVote.astro"
      provides: "Restyled calibration-cards vote form (selected state in CSS has-[:checked], simplified change listener)"
    - path: "src/components/country/SentimentPillar.astro"
      provides: "Community badge retinted terracotta (only permitted touch)"
---

<objective>
Restyle the Phase-39 Community Sentiment vote widget from bare native radios + washed-out
disabled button into a branded, polished control — without touching SEO-critical markup,
i18n strings, or the progressive-enhancement JS contract.

Executed via ad-hoc multi-agent workflow (not gsd-quick): 3 Opus design proposals with
distinct lenses (segmented Likert / refined cards / brand-integrated) → Opus judge
synthesized "Calibration Cards" (P2 core + P3's terracotta CTA, badge retint, branded
thanks panel; P1's diverging color scale REJECTED — coloring the too-high pole warm and
too-low pole sage could bias calibration votes, a data-quality liability) → Sonnet
executor applied the spec → Fable orchestrator verified (live behavior check, screenshots
light/dark/mobile, astro build + validate:seo 2213/2213) and shipped.
</objective>
