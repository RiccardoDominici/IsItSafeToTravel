---
phase: quick-260708-mxx
plan: 01
type: execute
wave: 1
depends_on: [quick-260708-lb3]
autonomous: true
requirements: [SHIP-SPEC-V91-2.1-methodology-ui, SHIP-SPEC-V91-2.2-secondary-surfaces, SHIP-SPEC-V91-2.3-gates-ship]
files_modified:
  - src/i18n/ui.ts
  - src/pages/en/methodology/index.astro
  - src/pages/zh/methodology/index.astro
  - src/components/country/ScoreHero.astro
  - README.md
  - CLAUDE.md
  - src/components/ApiDocs.astro
  - src/lib/seo.ts
  - src/lib/country-faq-copy.ts
  - src/lib/hub-faq.ts
  - scripts/generate-llms-full.ts
  - public/llms.txt
  - public/llms-full.txt

must_haves:
  truths:
    - "Methodology pages ×7 describe v9.1 Crime = GPI Safety&Security + WB intentional-homicide rate (population-reliability scaled) and Conflict = GPI + advisory consensus + UCDP GED conflict-deaths (CC-BY, UCDP/OWID)"
    - "Methodology Known-Limitations ×7 reflects v9.1: PSE rated above Iran (evidence-based), small-population homicide damping, UCDP quarterly ~3mo lag + preliminary 2025-26 data, Japan advisories displayed-but-excluded — and the four resolved v9 items (PSE stale-GPI, RUS-vs-UKR, ESH step, GUM ca bug) are removed"
    - "A v9.1 changelog section exists on the methodology page ×7 (homicide + population scaling, UCDP signal, GPI-2026 edition/retroactive revisions, advisory nudge ramp)"
    - "Country pages visibly flag low confidence (a 'limited data' note adjacent to the score) for any country with confidence < 0.4 (e.g. TCA conf 0.230, PSE), in all 7 locales"
    - "README, CLAUDE.md, ApiDocs ×7, seo.ts measurementTechnique ×7, country-faq-copy indicator labels ×7, hub-faq ×7 and the llms mechanism sentence all state the v9.1 pillar composition and new ~[3.4, 8.9] range / ~6.60 global mean (bands UNCHANGED)"
    - "Full build + validate:seo pass all-green, dist spot-checks confirm the surfaced v9.1 content, and the change is pushed to master"
  artifacts:
    - path: "src/i18n/ui.ts"
      provides: "v9.1 methodology strings ×7 (crime/conflict descriptions, sources, changelog_v91, limitations rewrite, ucdp source row, wb_homicide/ucdp_conflict_deaths indicator labels, country.limited_data flag)"
      contains: "methodology.changelog_v91_title"
    - path: "src/components/country/ScoreHero.astro"
      provides: "score-adjacent low-confidence flag rendered when country.confidence < 0.4"
      contains: "confidence"
    - path: "src/pages/en/methodology/index.astro"
      provides: "v9.1 changelog section + ucdp dataSources row + corrected gamma exponent (0.96)"
    - path: "public/llms-full.txt"
      provides: "regenerated llms with v9.1 mechanism sentence + range"
  key_links:
    - from: "src/components/country/ScoreHero.astro"
      to: "country.confidence"
      via: "conditional render at threshold 0.4"
      pattern: "confidence"
    - from: "src/pages/en/methodology/index.astro"
      to: "methodology.indicator.wb_homicide / methodology.indicator.ucdp_conflict_deaths"
      via: "weights-table pillar.indicators map"
      pattern: "methodology.indicator."
    - from: "src/pages/en/methodology/index.astro"
      to: "methodology.source.ucdp"
      via: "dataSources array row"
      pattern: "ucdp"
---

<objective>
Formula v9.1 PART 2 — surface & ship. PART 1 (260708-lb3) already shipped the v9.1.0 engine,
regenerated all 669 snapshots (global mean 6.603, TCA 5.458, PSE 4.790, JAM 6.938), and kept
Japan excluded-from-scoring (re-inclusion gate failed 0.362 > 0.25) while shipping the fixed
Japan fetcher. This plan updates every user-facing / documentation surface to describe v9.1,
adds the mandated low-confidence UI flag, then runs the full build+validate:seo+push gate.

THE CONTRACT is `.../scratchpad/V91-SHIP-SPEC.md` (PART 2 section) plus the residual/limitation
evidence in `.../scratchpad/final-constants-v91.json` (round-2 + F4_accepted_notes = the
known-limitations wording source).

Purpose: the live site and docs currently describe v9.0; the new homicide + UCDP signals, the
population-reliability damping, and the PSE>Iran ordering must be explained honestly, and the
newly-thin-data territories must be flagged before this ships to production.
Output: v9.1 docs ×7 locales, a score-adjacent low-confidence flag, regenerated llms, a green
build+validate:seo, and a push to master (auto-deploy).

Weights 30/25/20/15/10 and band thresholds (<5 / 5-6 / 6-7 / 7-8 / >=8) are UNCHANGED — do not
touch band logic. Do NOT touch src/pipeline/**. Never hand-edit generated files (llms via its
generator, scores via the pipeline). Push ONLY with validate:seo all-green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260708-lb3-formula-v9-1-part-1-ucdp-gpi-json-wb-hom/260708-lb3-SUMMARY.md
@CLAUDE.md

# THE CONTRACT (read the PART 2 section + non-negotiables):
@/private/tmp/claude-501/-Users-riccardo-Developer-VibeCoding-Isitsafetotravel/dda1ae2e-57b7-4d23-9610-4f92d047c45e/scratchpad/V91-SHIP-SPEC.md
# Constants + residual/limitation evidence (round-2 F4_accepted_notes = the known-limitations wording source):
@/private/tmp/claude-501/-Users-riccardo-Developer-VibeCoding-Isitsafetotravel/dda1ae2e-57b7-4d23-9610-4f92d047c45e/scratchpad/final-constants-v91.json

<facts>
Verified during planning (do not re-derive):
- weights.json v9.1.0 pillars: crime = [gpi_safety_security (.67), wb_homicide (.33, precision ×pop/(pop+200000))];
  conflict = [gpi_overall (.3275), gpi_militarisation (.1125), A/advisory-consensus (.28), ucdp_conflict_deaths (.28, log-normalized, D_MAX 24000)].
- ScoredCountry already carries BOTH `dataCompleteness` (shown as % in ScoreHero) AND `confidence`
  (0-1, NOT currently surfaced). public/scores.json TCA: confidence 0.230, dataCompleteness 0.257. Flag threshold is confidence < 0.4.
- ui.ts locale blocks: en@22, it@533, es@1042, fr@1551, pt@2060, zh@2569, de@3074 (methodology strings live in each).
- The zh methodology block in ui.ts is ALREADY fully, fluently Chinese (verified: zero English leakage across all methodology.* values).
  So there is NO bulk EN to zh re-translation to do. The zh requirement reduces to: every NEW/CHANGED v9.1 string added in this plan must be
  given a genuine, fluent Chinese translation in the zh block (never an English placeholder), preserving all keys.
- The methodology weights table renders `t('methodology.indicator.${ind}')` per indicator — so `methodology.indicator.wb_homicide`
  and `methodology.indicator.ucdp_conflict_deaths` MUST be added ×7 or the table shows undefined (same bug class 260708-23u fixed for indicator.A).
- Both methodology .astro files hardcode the OLD gamma in the formula block: `Composite<sup>0.79</sup>` (line ~230). gamma is now 0.96.
- README stale bits: line ~23/33 "World Bank WGI" (WGI was replaced by V-Dem in 260511-k2m); line ~26 multilingual list omits zh+de;
  line ~45 "v9.0.0"; line ~50 crime row; line ~71 range 3.7-8.9 mean ~6.75.
- CLAUDE.md Scoring section still says "hard cap (Level-4 -> <=2) and critical floor" — STALE (v9 removed hard caps/floors; v9.1 adds homicide + UCDP + continuous advisory ramp).
- seo.ts measurementTechnique: a per-lang map (lines ~229-236) + 2 English literals (lines ~726, ~804) all say "...World Bank, INFORM and GPI indices".
- country-faq-copy.ts `indicatorLabels` ×7 must match engine indicator .name values — currently missing wb_homicide + ucdp_conflict_deaths.
- generate-llms-full.ts mechanism sentence (line ~201): "Scores range from roughly 3.7 to 8.9 (global mean ~6.75)".
- "40+ sources" framing stays UNCHANGED: adding UCDP + homicide only increases the count; the spec says change only if the counting convention changes — it does not.
- Anchors for dist spot-check: mean ~6.60, JAM 6.94, TCA 5.46, PSE 4.79, ISL 8.87.
</facts>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Methodology surface ×7 + low-confidence UI flag</name>
  <files>src/i18n/ui.ts, src/pages/en/methodology/index.astro, src/pages/zh/methodology/index.astro, src/components/country/ScoreHero.astro</files>
  <action>
Update the methodology surface for v9.1 across all 7 locale blocks in src/i18n/ui.ts (en, it, es, fr, pt, zh, de — real fluent translations in each, no English placeholders; the zh block is already fully Chinese, so match that quality for every new/changed zh string):

1. CRIME pillar — rewrite `methodology.pillar.crime.description` and `methodology.pillar.crime.sources` ×7: Crime now blends the GPI Safety and Security domain (67%) with the World Bank intentional-homicide rate (VC.IHR.PSRC.P5, 33%), where the homicide signal's statistical precision is scaled by population (small-population per-capita rates are damped as statistical noise per the F1 population-reliability model, half-saturation ~200k). Keep the existing "distinct from Governance rule-of-law" framing.

2. CONFLICT pillar — rewrite `methodology.pillar.conflict.description` and `.sources` ×7: Conflict now also incorporates UCDP Georeferenced Event Dataset battle-related and one-sided conflict-death counts (log-normalized), alongside GPI overall/militarisation and the 37-government advisory consensus. Attribution: UCDP GED via the Our World in Data mirror, CC-BY.

3. SOURCES table — ×7:
   - Update `methodology.source.wb_desc`: add "intentional-homicide rate and total population" to the existing under-5 mortality + PM2.5 wording.
   - Update `methodology.source.gpi_desc`: note the current GPI-2026 edition (retroactive/revised vintages are standard IEP practice).
   - Add a NEW UCDP source row: keys `methodology.source.ucdp`, `methodology.source.ucdp_desc`, `methodology.source.ucdp_url` ×7 (name: "UCDP / Our World in Data — conflict deaths"; url: the OWID grapher or https://ucdp.uu.se/; desc: battle-related + one-sided fatalities feeding the Conflict pillar, CC-BY). Then add `{ key: 'ucdp', frequency: t('methodology.frequency.quarterly') }` to the `dataSources` array in BOTH methodology .astro files (en + zh).
   - Add indicator-label keys `methodology.indicator.wb_homicide` ("World Bank intentional-homicide rate") and `methodology.indicator.ucdp_conflict_deaths` ("UCDP conflict-death count") ×7 — mirror the existing `methodology.indicator.A` / `methodology.indicator.gpi_safety_security` style (grep for those to copy tone).

4. CHANGELOG v9.1 — add NEW keys `methodology.changelog_v91_title` + `methodology.changelog_v91_text` ×7 (keep the existing v9 changelog for history), and add a new section rendering them in BOTH methodology .astro files, placed immediately BEFORE the existing "What Changed in v9" section (newest-first). Content: homicide + population-reliability scaling added to Crime; UCDP GED conflict-deaths signal added to Conflict (CC-BY, UCDP/OWID); GPI upgraded to the 2026 edition (retroactive revisions expected); a smooth advisory nudge ramp for thin-advisory territories; the practical score range is now ~[3.4, 8.9] with a global mean ~6.60, and the band thresholds are UNCHANGED.

5. KNOWN LIMITATIONS — rewrite `methodology.limitations_v9_title` to "Known Limitations of Formula v9.1" and fully rewrite `methodology.limitations_v9_text` ×7. REMOVE the four now-resolved items (Palestine stale-GPI lag, Russia-vs-Ukraine ordering, Western-Sahara single-step, Guam mis-coded advisory). ADD, per final-constants-v91.json F4_accepted_notes: (a) Palestine (~4.6) is rated slightly above Iran (~4.2) — evidence-based: Iran carries a near-universal multi-government "Do Not Travel" advisory load plus weaker governance/environment, while Palestine's Gaza conflict-death signal already fully sinks its conflict pillar; (b) homicide rates for very small-population territories are reliability-damped, so a handful of homicides on tens of thousands of people is treated as noise rather than worse-than-war crime; (c) UCDP conflict-death data lags ~3 months (quarterly) and the most recent 2025-26 figures are preliminary; (d) Japan's MOFA advisories are now displayed correctly on country pages but remain excluded from the score pending a dedicated recalibration.

6. FORMULA display — in BOTH methodology .astro files, change the hardcoded final-scale exponent from `Composite<sup>0.79</sup>` to `Composite<sup>0.96</sup>` (gamma was retuned to 0.96 in v9.1). Do not otherwise touch the formula math display.

7. LOW-CONFIDENCE UI FLAG (ScoreHero.astro) per SHIP_REQUIREMENT_UI: `country.confidence` exists but is not surfaced (only `dataCompleteness` % is shown). Add a distinct, visible note adjacent to the score — rendered ONLY when `country.confidence < 0.4` — reading e.g. "Limited data — score leans on a cautious regional baseline." Add i18n key `country.limited_data` ×7 (fluent per locale). Keep the existing dataCompleteness line. Place the flag so it is score-adjacent (near the verdict / last-updated block), styled as a small muted/amber pill consistent with the existing sand/amber palette. Do NOT change how the score itself is computed or displayed.

No fenced code in this plan — mirror the existing string style and Astro patterns already in these files. Keep every translation genuine (translate, do not leave English in non-en blocks).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && for k in methodology.changelog_v91_title methodology.indicator.wb_homicide methodology.indicator.ucdp_conflict_deaths country.limited_data; do n=$(grep -c "$k" src/i18n/ui.ts); echo "$k=$n"; [ "$n" = "7" ] || exit 1; done && grep -q "confidence" src/components/country/ScoreHero.astro && grep -q "0.96" src/pages/en/methodology/index.astro && grep -q "0.96" src/pages/zh/methodology/index.astro && grep -q "ucdp" src/pages/en/methodology/index.astro && echo TASK1_STRINGS_OK</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "astro.config.mjs\|functions/" | head -5; echo "TSC_DONE (no lines above = clean)"</automated>
  </verify>
  <done>All 4 new i18n keys appear exactly 7× (one per locale) with genuine per-locale text; ScoreHero renders a low-confidence flag gated on confidence < 0.4; both methodology .astro files show the UCDP source row, the v9.1 changelog section, and the 0.96 exponent; tsc clean (excluding pre-existing astro.config/functions errors).</done>
</task>

<task type="auto">
  <name>Task 2: README + CLAUDE.md + secondary code surfaces (ApiDocs ×7, seo.ts, faq copy, hub-faq, llms generator)</name>
  <files>README.md, CLAUDE.md, src/components/ApiDocs.astro, src/lib/seo.ts, src/lib/country-faq-copy.ts, src/lib/hub-faq.ts, scripts/generate-llms-full.ts</files>
  <action>
Broad-but-shallow edits — each file gets a few targeted string changes. Do NOT change weights, band thresholds, or the "40+ sources" framing (verified still valid).

1. README.md: bump the Scoring section to v9.1.0 (line ~45 "v9.0.0" -> "v9.1.0"). Crime pillar-table row -> "GPI Safety & Security + World Bank intentional-homicide rate (population-reliability scaled)". Conflict row -> add "UCDP conflict-death counts" to its indicator list. Add a short v9.1 note to the formula section: Crime gained the WB homicide signal (precision damped by population), Conflict gained UCDP GED conflict-deaths (log-normalized), GPI upgraded to the 2026 edition; the practical range is now ~[3.4, 8.9] with a global mean ~6.60 and the SAME bands. Update the multilingual bullet (line ~26) to list all seven languages (add Chinese and German). Clean the two stale "World Bank WGI" references (line ~23 "14+ years of data from World Bank WGI"; source table line ~33 "World Bank WGI | Governance, ...") — governance moved to V-Dem in 260511-k2m, so reword to V-Dem / reflect current sourcing. Fix the range/mean in the formula section (line ~71: 3.7-8.9 mean ~6.75 -> ~[3.4, 8.9], mean ~6.60), bands unchanged.

2. CLAUDE.md Scoring section: it is STALE — it still describes a "hard cap (Level-4 -> <=2) and critical floor". Rewrite to v9.1: weighted geometric mean of 5 pillars (30/25/20/15/10, unchanged); Crime = GPI Safety&Security + population-scaled WB homicide; Conflict = GPI + advisory consensus + UCDP conflict-deaths; continuous advisory nudge/severe ramp with NO hard caps or floors; Bayesian shrinkage toward a regional prior; range ~[3.4, 8.9]. Keep it terse (this is an ops crib sheet).

3. src/components/ApiDocs.astro: update the `fPillars` string in ALL 7 locale `copy` objects: Crime now = GPI Safety & Security domain PLUS the World Bank intentional-homicide rate (population-reliability scaled); Conflict now includes UCDP conflict-death counts alongside GPI and the advisory consensus; rule of law stays under Governance. `fConfidence` semantics are unchanged — leave it. Verify `intro`/`epScores` "40+ public sources" wording stays (do not change).

4. src/lib/seo.ts measurementTechnique: in the per-lang `measurementTechniqueByLang` map (×7) AND the 2 English string literals (~line 726, ~804), add UCDP to the source enumeration (e.g. "...World Bank, INFORM, UCDP and GPI indices"). Homicide is a World Bank indicator, so "World Bank" already covers it — do not over-lengthen.

5. src/lib/country-faq-copy.ts: add to `indicatorLabels` (×7 languages) genuine labels for the two new engine indicator names `wb_homicide` (e.g. "homicide rate (World Bank)") and `ucdp_conflict_deaths` (e.g. "conflict deaths (UCDP)") — these are emitted by the v9.1 engine and are needed by the Q2 driver clause; without them a crime/conflict-driven country renders a broken/missing {labels}. Keep the same style as the existing gpi_* / vdem_* / inform_* entries.

6. src/lib/hub-faq.ts: in the provenance answer that lists sources ("...including government travel advisories, the Global Peace Index and World Bank indicators") ×7, add UCDP conflict data to the enumeration. Do NOT touch the pillar-weight statements (weights unchanged).

7. scripts/generate-llms-full.ts: update the mechanism sentence (line ~201): change "Scores range from roughly 3.7 to 8.9 (global mean ~6.75)" to "~3.4 to 8.9 (global mean ~6.60)"; add homicide/UCDP to the mechanism narrative (Crime pillar bullet ~line 195 -> mention homicide; Conflict bullet -> mention UCDP conflict-death data). Keep "37 government travel advisories" (still accurate). This is the SOURCE for llms.txt — do not edit public/llms*.txt directly (regen happens in Task 3).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && grep -q "v9.1" README.md && grep -qi "chinese\|中文" README.md && grep -q "6.60" scripts/generate-llms-full.ts && grep -c "wb_homicide" src/lib/country-faq-copy.ts | grep -qx 7 && grep -c "ucdp_conflict_deaths" src/lib/country-faq-copy.ts | grep -qx 7 && grep -qi "ucdp" src/lib/seo.ts && grep -qi "homicide" src/components/ApiDocs.astro && echo TASK2_OK</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "astro.config.mjs\|functions/" | head -5; echo "TSC_DONE (no lines above = clean)"</automated>
  </verify>
  <done>README + CLAUDE.md describe v9.1 (crime homicide, conflict UCDP, range ~[3.4,8.9]/~6.60, seven languages, no stale WGI); ApiDocs fPillars ×7, seo.ts measurementTechnique ×7+2, hub-faq provenance ×7, and the llms generator all mention the new signals; country-faq-copy has wb_homicide + ucdp_conflict_deaths labels ×7; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 3: Gates and ship — llms regen, test, full build, validate:seo, spot-checks, push</name>
  <files>public/llms.txt, public/llms-full.txt (regenerated), STATE.md, SUMMARY</files>
  <action>
Run the full ship gate in order. Do not push unless validate:seo is all-green.

1. Regenerate llms via its generator (never hand-edit): `npm run generate:llms`. Confirm public/llms-full.txt now contains the updated mechanism sentence (~6.60 mean, homicide/UCDP).

2. `npm test` — expect all green (PART 1 landed 131/131). If `data/scores/latest.json` gets mutated by the known snapshot/historical test pattern, restore it from git (`git checkout -- data/scores/latest.json`) after the run, exactly as documented in the lb3/efx summaries. A pre-existing score-drift-guard vs data05-historical concurrency flake is acceptable IF the file passes in isolation — do not treat it as a new regression.

3. FULL build (OG must regenerate because scoreDisplay changed under v9.1): `npm run build` with timeout 600000 (~400s+). This runs generate:og -> generate:llms -> astro build -> validate:seo. If the OG regen is the only slow part and already fresh, you may instead run `npx astro build` then `npm run validate:seo` — but because scoreDisplay values moved in PART 1, prefer the FULL build so OG images match the new scores.

4. `npm run validate:seo` — MUST be all-pass (currently ~2213 checks). If any check fails, STOP, fix, and do not push.

5. dist spot-checks (grep dist/client): Jamaica, Turks & Caicos (TCA), and Palestine (PSE) country pages in BOTH en and it — confirm crime copy mentions homicide, conflict mentions UCDP/conflict deaths, and TCA/PSE show the low-confidence "limited data" flag (their confidence < 0.4). Confirm a per-country trend JSON exists/regenerated and the global-safety page renders a mean ~6.6. Anchor sanity: JAM ~6.94, TCA ~5.46, PSE ~4.79, ISL ~8.87.

6. Ship: `git pull --rebase --autostash` (the daily pipeline bot commits often — never push stale), then commit the doc/i18n/UI + regenerated llms changes and push to master. Deploy is automatic on push.

7. GSD bookkeeping: append the STATE.md row for 260708-mxx and write the quick-task SUMMARY. Note the v9 fast-follow / deferred-items that this ships as resolved (v9.1 known-limitations rewrite closes the PSE-stale-GPI / RUS-vs-UKR / ESH / GUM items).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && grep -q "6.60" public/llms-full.txt && grep -qi "ucdp\|homicide" public/llms-full.txt && npm run validate:seo 2>&1 | tail -5 | grep -qi "pass\|✓\|all" && echo VALIDATE_SEO_PASS</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && grep -rl "homicide\|UCDP\|conflict death" dist/client/en/country/jamaica/ dist/client/en/country/turks-and-caicos-islands/ 2>/dev/null | head -1 | grep -q . && echo DIST_SPOTCHECK_OK || echo "DIST_SPOTCHECK_ADJUST_SLUGS_MANUALLY"</automated>
  </verify>
  <done>llms regenerated with v9.1 mechanism; npm test green (latest.json restored if mutated); FULL build with fresh OG; validate:seo all-pass; dist spot-checks confirm v9.1 crime/conflict copy + low-confidence flag on TCA/PSE + global mean ~6.6; pulled --rebase, committed, pushed to master; STATE.md row + SUMMARY written.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo -> production (push to master) | Any push auto-deploys; a broken/incorrect surface ships live |
| docs/claims -> readers & AI answer engines | Published statistics/limitations must be accurate and non-scope-reduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mxx-01 | Tampering | generated files (llms.txt, scores.json, dist) | mitigate | Regenerate llms via `npm run generate:llms` only; never hand-edit; scores untouched (no src/pipeline changes) |
| T-mxx-02 | Information disclosure / integrity | published methodology claims | mitigate | Known-limitations wording sourced verbatim-in-spirit from final-constants-v91.json F4_accepted_notes; state PSE>Iran honestly, no simplified/"v1" framing |
| T-mxx-03 | Denial of service (self-inflicted) | push to master while stale | mitigate | `git pull --rebase --autostash` before push (daily bot); push only with validate:seo green |
| T-mxx-04 | Elevation (broken build ships) | full build + validate:seo gate | mitigate | Blocking: validate:seo must be all-pass and dist spot-checks confirmed before any push |
| T-mxx-SC | Tampering | npm/pip/cargo installs | accept | No new packages installed — docs/i18n/UI edits + existing build scripts only |
</threat_model>

<verification>
- All new i18n keys present ×7 with genuine per-locale text (no English placeholders in non-en blocks).
- Methodology weights table resolves wb_homicide + ucdp_conflict_deaths labels (no "undefined").
- ScoreHero low-confidence flag renders only for confidence < 0.4; visible and score-adjacent.
- No src/pipeline/** modified; no hand-edited generated files (llms regenerated, scores untouched).
- Weights + band thresholds byte-unchanged; only the display exponent (0.79 -> 0.96) and copy changed.
- npm test green; full build succeeds; validate:seo all-pass; dist spot-checks confirm v9.1 copy + flag.
</verification>

<success_criteria>
- Methodology ×7, README, CLAUDE.md, ApiDocs ×7, seo.ts, country-faq-copy, hub-faq, and llms all describe v9.1 (homicide + UCDP, GPI-2026, ~[3.4,8.9]/~6.60, bands unchanged).
- Known-limitations rewritten ×7 (4 resolved items removed; PSE>Iran, small-pop damping, UCDP lag, Japan-displayed-but-excluded added).
- Low-confidence "limited data" flag live on country pages for confidence < 0.4.
- Full build + validate:seo green; pushed to master; STATE.md + SUMMARY updated.
</success_criteria>

<output>
Create `.planning/quick/260708-mxx-formula-v9-1-part-2-docs-x7-known-limita/260708-mxx-SUMMARY.md` when done,
and append the STATE.md row for 260708-mxx.
</output>
