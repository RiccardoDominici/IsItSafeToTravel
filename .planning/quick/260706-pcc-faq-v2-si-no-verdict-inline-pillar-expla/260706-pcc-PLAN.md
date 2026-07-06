---
phase: quick-260706-pcc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/country-faq-copy.ts
  - src/lib/seo.ts
  - src/components/country/AnswerFirstParagraph.astro
autonomous: true
requirements: [FAQ-Q1-VERDICT, FAQ-Q2-INDICATORS, FAQ-Q3-ADVISORY, FIX-A-COVERAGE, FIX-B-SOURCECOUNT]

must_haves:
  truths:
    - "Q1 answer opens with an explicit dynamic verdict (Yes / Yes-but-caution / No) matching the score band, then names the drag pillar(s) AND explains in place what that weakest pillar concretely means for the traveler."
    - "Q2 answer explains the weakest ELIGIBLE pillar's risk using the actual lowest-scoring indicators inside it (all advisory_level_* grouped under one label), degrades gracefully for single-indicator pillars (e.g. crime = vdem_rule_of_law only), and stays non-alarmist when the weakest pillar is >=7/10 (Iceland)."
    - "Q3 is the advisory question (insurance question + answer removed), answered only from country.advisories: advisory count, consensus phrasing, named governments (uk->GB), Level-4 score-cap explained in place when a MAJORITY of advisories are Level 4, and a distinct zero-advisory sentence for micro-territories."
    - "Monaco-type sparse countries never name a zero-data pillar (dataCompleteness < MIN_PILLAR_COVERAGE) as weakest or strongest in the FAQ, the meta description, or the answer-first paragraph; fallback to all pillars only when none clear the threshold."
    - "Meta description and answer-first paragraph both state the 40+ source framing (no more '5+')."
    - "Visible FAQ text and FAQPage JSON-LD stay byte-identical (one generator); npx astro build and npm run validate:seo pass all checks."
  artifacts:
    - path: "src/lib/country-faq-copy.ts"
      provides: "Extended CountryFaqCopy (Q1 {meaning}, Q2 {drivers}, advisory Q3 copy), indicatorLabels map, advisoryLevelWords, listConnector — all 7 langs"
      contains: "indicatorLabels"
    - path: "src/lib/seo.ts"
      provides: "Eligible-pillar helper, indicator-driver clause builder, advisory answer builder + Q3 assembly, source count 40"
      exports: ["getCountryFaqData", "buildCountryMetaDescription"]
    - path: "src/components/country/AnswerFirstParagraph.astro"
      provides: "Eligible-pillar filtered weakest/strongest + 40+ source framing"
  key_links:
    - from: "src/lib/seo.ts"
      to: "src/pipeline/scoring/engine.ts"
      via: "import MIN_PILLAR_COVERAGE (one source of truth)"
      pattern: "MIN_PILLAR_COVERAGE"
    - from: "src/lib/seo.ts"
      to: "src/lib/country-faq-copy.ts"
      via: "indicatorLabels / advisoryLevelWords / countryFaqCopy"
      pattern: "indicatorLabels|advisoryLevelWords"
    - from: "src/components/country/FaqSection.astro + buildFaqPageJsonLd"
      to: "getCountryFaqData"
      via: "single generator feeds visible FAQ and JSON-LD"
      pattern: "getCountryFaqData"
---

<objective>
Second-iteration rework of the country-page FAQ generator (getCountryFaqData) plus two deferred bug fixes, per locked owner requirements.

Q1 must give an explicit dynamic Si/No verdict then explain WHY in place (drag pillars + what the weakest pillar means for the traveler). Q2 must explain the weakest pillar's risk using the REAL indicators driving its low score. Q3 drops the insurance question (can't answer accurately) and replaces it with a government-advisory question answered from our own advisory data. Deferred Fix A stops zero-data pillars being named as weakest/strongest (Monaco bug); Fix B unifies the "40+ sources" framing.

Purpose: sharper, more citable, more accurate answers for AI answer engines and readers, with no scope reduction and no deferring to other sections.
Output: reworked src/lib/country-faq-copy.ts + src/lib/seo.ts + AnswerFirstParagraph.astro; build + validate:seo green; edge countries spot-checked.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/lib/country-faq-copy.ts
@src/lib/seo.ts
@src/components/country/AnswerFirstParagraph.astro
@src/lib/hub-faq.ts

<interfaces>
Contracts and data tables the executor needs — no codebase exploration required.

DATA SHAPES (from src/pipeline/types.ts):
- ScoredCountry.pillars: PillarScore[] where PillarScore = { name: 'conflict'|'crime'|'health'|'governance'|'environment'; score: number (0-1); dataCompleteness: number (0-1); indicators: IndicatorScore[] }
- IndicatorScore = { name: string; rawValue: number; normalizedValue: number (0-1); source: string; year: number }  — lower normalizedValue = bigger driver of a low pillar score
- ScoredCountry.advisories: Record<key, { level: number|string; text; source; url; updatedAt }>  — level is 1..4 (coerce with Number()); absent keys omitted

MIN_PILLAR_COVERAGE = 0.30 — exported from src/pipeline/scoring/engine.ts. Import verified build-safe (engine's node imports are erased server-side; FAQ/meta/AnswerFirst all render at build time only). If npx astro build ever externalizes node:fs from this import, fallback: move the const into a new leaf src/pipeline/scoring/constants.ts and re-export from engine.ts.

LEVEL-4 SCORE CAP (verified in engine.ts lines 196-206): applies only when level4Count >= ceil(N/2 + 0.1) of the N present advisories (a strict MAJORITY: 2/2, 2/3, 3/4). AFG (10/15 L4) is capped; MEX (1/13 L4) is NOT. Q3 copy must say the cap kicks in when a MAJORITY of governments issue "Do Not Travel".

DISTINCT INDICATORS (from public/scores.json) and their pillar + EN anchor label for the new indicatorLabels map (15 keys; translate all to it/es/fr/pt/zh/de matching hub-faq.ts terminology):
- gpi_overall (conflict) -> "overall peacefulness (Global Peace Index)"
- gpi_safety_security (conflict) -> "societal safety and security (Global Peace Index)"
- gpi_militarisation (conflict) -> "militarisation (Global Peace Index)"
- vdem_rule_of_law (crime) -> "rule of law (V-Dem)"
- inform_health (health) -> "health-system capacity (INFORM)"
- inform_epidemic (health) -> "epidemic and disease risk (INFORM)"
- wb_child_mortality (health) -> "child mortality (World Bank)"
- vdem_corruption_control (governance) -> "control of corruption (V-Dem)"
- vdem_gov_effectiveness (governance) -> "government effectiveness (V-Dem)"
- inform_governance (governance) -> "institutional/governance fragility (INFORM)"
- inform_natural (environment) -> "exposure to natural hazards (INFORM)"
- inform_climate (environment) -> "climate-related hazard exposure (INFORM)"
- gdacs_disaster_alerts (environment) -> "active disaster alerts (GDACS)"
- reliefweb_active_disasters (environment) -> "ongoing humanitarian emergencies (ReliefWeb)"
- advisory_group -> "government travel-advisory levels"   [all 21 advisory_level_* indicators collapse to this ONE label, counted once]

ADVISORY-KEY -> ISO-3166 region code (for Intl.DisplayNames(lang,{type:'region'})): default = key.toUpperCase(); the ONLY override is uk -> GB. All other present keys (us,ca,au,at,be,ch,cn,de,dk,ee,es,hk,ie,jp,nl,nz,rs,sk,tw,ar) are valid alpha-2 and resolve correctly — note sk = Slovakia (correct), NOT South Korea. Fallback to the advisory's .source string if DisplayNames returns undefined.

listConnector per lang (join max 2 government names): en " and ", it " e ", es " y ", fr " et ", pt " e ", zh (full-width) "和", de " und ".

EDGE COUNTRIES for spot-check (from current public/scores.json):
- ISL score 9.41 — all 5 pillars eligible, weakest = governance 8.7/10 (must read "no significant risk", non-alarmist).
- MCO score 9.62 — ONLY health (dc 0.33) clears 0.30; conflict dc 0.25, crime/gov/env dc 0. After Fix A weakest=strongest=health; second is undefined -> code MUST guard.
- AFG score 1.97 — weakest = crime 0.8/10 driven by the single indicator vdem_rule_of_law (single-indicator degrade case); 10/15 advisories L4 -> cap explanation fires.
- MEX score 5.13 — moderate verdict; advisories span L1..L4, only jp at L4 -> NO cap; consensus = increased caution.
- Zero-advisory territories (15): ALA ATF BES BLM BVT CCK CXR GGY JEY MNP NFK SGS SHN SPM UMI -> Q3 zero-advisory sentence.

CONSUMERS (parity is automatic — do not duplicate logic): FaqSection.astro (visible) and seo.ts buildFaqPageJsonLd (line ~564, JSON-LD) both call getCountryFaqData. validate-seo.ts only asserts the FAQPage @graph node exists, not question text — changing Q3 is safe.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Deferred fixes A + B — eligible-pillar selection and 40+ source framing</name>
  <files>src/lib/seo.ts, src/components/country/AnswerFirstParagraph.astro</files>
  <action>
Fix A (Monaco bug — FIX-A-COVERAGE): stop naming zero-data pillars as weakest/strongest. Import MIN_PILLAR_COVERAGE from '../pipeline/scoring/engine' into seo.ts (and from '../../pipeline/scoring/engine' into AnswerFirstParagraph.astro). Add a small pure helper in seo.ts, e.g. selectEligiblePillars(pillars): filter to pillars with dataCompleteness >= MIN_PILLAR_COVERAGE; if the filtered set is empty, return all pillars (mirrors the engine's own fallback at engine.ts lines 153-157). Use this helper as the pillar set for weakest/strongest selection in BOTH getCountryFaqData (replace the sort at seo.ts:508) and buildCountryMetaDescription (replace the weakest/strongest loop at seo.ts:60-66). In AnswerFirstParagraph.astro replace the weakest/strongest loop (lines 56-61) with the same eligible-filter-then-select logic (inline is fine; keep one threshold source via the imported constant). CRITICAL guard: after filtering, the eligible set may have length 1 (Monaco -> only health). Any code reading sorted[1] (the second slot) MUST guard against undefined — when fewer than 2 eligible pillars exist, second falls back to the weakest so slot fills never crash and never emit "undefined". Keep the health-pillar lookup in getCountryFaqData reading from the full country.pillars (health band is independent of eligibility).

Fix B (source-count consistency — FIX-B-SOURCECOUNT): unify to the site-wide "40+" framing used by hub-faq.ts / ApiDocs / CitePage. In buildCountryMetaDescription change the sourceCount assignment (seo.ts:72) from country.sources.length || 7 to the literal 40 so all 7 meta templates render "40+ ...". In AnswerFirstParagraph.astro change the sourceCount assignment (line 64) from country.sources.length || 7 to the literal 40 so the string renders "40+ ... public sources". Do not touch the 7 ui.ts translation strings and do not lengthen the surrounding meta wording (validate-seo enforces meta-description length). This is a documented decision per FIX-B: fixed count 40 (matches the established 40+ framing).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "seo.ts|AnswerFirst" | head; echo "typecheck-scan-done"</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsx -e "import {buildCountryMetaDescription} from './src/lib/seo.ts'; const d=require('./public/scores.json'); const arr=Array.isArray(d)?d:d.countries; const mco=arr.find(c=>c.iso3==='MCO'); const m=buildCountryMetaDescription(mco,'en'); console.log(m); if(/crime|governance|environment/.test(m)) throw new Error('FAIL: zero-data pillar named for MCO'); if(!/40\+/.test(m)) throw new Error('FAIL: not 40+ framing'); console.log('MCO meta OK');"</automated>
  </verify>
  <done>MIN_PILLAR_COVERAGE imported (not re-declared) in both files; MCO meta names only health (never crime/governance/environment) and reads "40+"; single-eligible-pillar case does not crash and never prints "undefined"; typecheck clean for the two files.</done>
</task>

<task type="auto">
  <name>Task 2: FAQ copy + assembly rework — Q1 verdict+why+meaning, Q2 indicator-driven, Q3 advisory</name>
  <files>src/lib/country-faq-copy.ts, src/lib/seo.ts</files>
  <action>
Build on Task 1's eligible-pillar helper (weakest/second/strongest come from selectEligiblePillars, second guarded). Question text for Q1 and Q2 stays VERBATIM in all 7 langs; only Q3's question text is new. Answers stay plain text (visible FAQ = JSON-LD). Keep the existing zh joiner logic (joiner = '' for zh, ' ' otherwise). Translate every new/edited string across en,it,es,fr,pt,zh,de using hub-faq.ts style/terminology; zh uses full-width punctuation.

Q1 (FAQ-Q1-VERDICT) — explain WHY in place: keep a1Verdict[band] opener and a1Formula unchanged. Edit a1Drivers.normal in all 7 langs to append the weakest pillar's practical meaning: add the {meaning} placeholder to the normal driver sentence (fill {meaning} with copy.pillarMeaning[weakest.name], reusing the existing pillarMeaning library — do NOT drop pillarMeaning). Leave a1Drivers.allStrong unchanged (top scorers have nothing to watch out for). Keep a1Provenance. Net: Q1 = verdict + how-the-score-works + drag-pillars-with-meaning + provenance.

Q2 (FAQ-Q2-INDICATORS) — indicator-driven biggest risk. Add a new indicatorLabels export to country-faq-copy.ts: Record<Lang, Record<string,string>> keyed by the 15 keys in the interfaces block (14 real indicators + 'advisory_group'), all 7 langs. Add a {drivers} placeholder to a2.critical and a2.mid (all 7 langs) — a short clause naming what specifically drives the low score, placed after {meaning}. Leave a2.strong unchanged (no drivers, no alarmism for weakest >=7/10). In seo.ts build the {drivers} clause: take the weakest ELIGIBLE pillar's indicators, collapse ALL advisory_level_* into a single 'advisory_group' entry (represented once, by its lowest normalizedValue), sort the resulting entries by normalizedValue ascending, take the lowest 1-2 distinct labels from indicatorLabels[lang]. Emit a localized clause naming them (EN two: "The lowest-scoring signals here are {a} and {b}."; EN one: "The main signal behind this is {a}."). GRACEFUL DEGRADE: if the pillar yields <2 distinct labels (e.g. crime = only vdem_rule_of_law), use the single-label phrasing; if it yields 0 usable labels, omit the {drivers} clause entirely (fill with empty string) and rely on {meaning}. Use listConnector[lang] to join two names.

Q3 (FAQ-Q3-ADVISORY) — remove insurance, add advisory question. In CountryFaqCopy: repurpose q3 to the new question "What do government travel advisories say about {name}?" (7 langs, new text); remove a3Opening, a3Health, a3Advisory and replace with advisory fields: a3Intro (uses {advisoryCount},{name},{monthYear}); a3Consensus with 4 bands {normal,caution,reconsider,avoid} (uses {name},{governments}); a3Cap (score-cap explanation, uses {name}); a3None (zero-advisory sentence, uses {name}). Also add two exports to country-faq-copy.ts: advisoryLevelWords: Record<Lang,[string,string,string,string]> (level 1..4 phrasing: normal precautions / increased caution / reconsider travel / do not travel) and listConnector: Record<Lang,string> (see interfaces). In seo.ts replace the entire A3 block (seo.ts:544-550) with an advisory builder: collect present advisories (Number(level), keep 1..4). Zero case -> a3None only. Else: compute N (count), modal level -> consensus band; build {governments} by localizing the 1-2 highest-level advisory keys via Intl.DisplayNames(localeMap[lang],{type:'region'}) with key.toUpperCase() and the uk->GB override, fallback to the advisory .source string, joined with listConnector[lang]; assemble a3Intro + a3Consensus[band]. Append a3Cap ONLY when a strict majority are Level 4 (level4Count >= Math.ceil(N/2 + 0.1)) — this mirrors engine.ts exactly. Remove the now-dead hasElevatedAdvisory/healthBand logic. Return the three items as before: the q1/a1 and q2/a2 items unchanged in position, and the third item as { question: advisoryQuestion, answer: advisoryAnswer }.

Update the file-header docblock in country-faq-copy.ts to document the new placeholders ({meaning} in Q1, {drivers} in Q2, {advisoryCount}/{governments} in Q3) and drop the insurance references.
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "seo.ts|country-faq-copy" | head; echo "typecheck-scan-done"</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsx -e "import {getCountryFaqData} from './src/lib/seo.ts'; const d=require('./public/scores.json'); const arr=Array.isArray(d)?d:d.countries; const g=(iso)=>getCountryFaqData(arr.find(c=>c.iso3===iso),'en'); for(const iso of ['ISL','MCO','AFG','MEX','ALA']){const f=g(iso); if(f.length!==3) throw new Error(iso+' not 3 items'); if(/undefined/.test(JSON.stringify(f))) throw new Error(iso+' emits undefined'); if(/insurance/i.test(JSON.stringify(f))) throw new Error(iso+' still mentions insurance'); console.log('== '+iso+' =='); f.forEach(x=>console.log('Q: '+x.question+' | A: '+x.answer));}"</automated>
  </verify>
  <done>Q1 EN for AFG/MEX names the drag pillar AND its meaning; Q2 for AFG names rule of law (single-indicator graceful), MEX names its low indicators, ISL reads non-alarmist ("no significant risk"), advisory indicators appear grouped as one; Q3 question is the advisory question (no insurance anywhere), AFG shows the majority-L4 cap sentence, MEX shows no cap, ALA shows the zero-advisory sentence; uk renders as "United Kingdom" not "UK"; no "undefined" in any output; typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: Build, SEO gate, edge-country + JSON-LD parity spot-check</name>
  <files>src/lib/country-faq-copy.ts, src/lib/seo.ts, src/components/country/AnswerFirstParagraph.astro</files>
  <action>
Run the fast build path (npx astro build — NOT npm run build; OG/llms already on disk) then the SEO gate (npm run validate:seo) against dist/client; both must pass all checks. Then spot-check that visible FAQ and FAQPage JSON-LD agree in the built output: for one built country page per representative case (ISL top-scorer, MCO sparse, AFG capped, MEX moderate), confirm the FAQ answers rendered in HTML match the acceptedAnswer text inside the FAQPage @graph node (single generator, so they must be identical). Confirm the new Q3 advisory question appears and the insurance question is gone. Verify a non-English page (e.g. zh or de) to confirm 7-lang copy filled with no leftover {placeholder} tokens and no "undefined". Do NOT run npm run build. Do NOT edit any generated files (dist/**, public/llms*.txt, public/scores.json, data/**).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx astro build 2>&1 | tail -5 && npm run validate:seo 2>&1 | tail -15</automated>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && node -e "const fs=require('fs'); const files=['dist/client/country/iceland/index.html','dist/client/country/monaco/index.html','dist/client/country/afghanistan/index.html','dist/client/country/mexico/index.html']; let checked=0; for(const f of files){ if(!fs.existsSync(f)){console.log('skip '+f);continue;} const h=fs.readFileSync(f,'utf8'); if(/\{(name|score|weakest|drivers|meaning|governments|advisoryCount)\}/.test(h)) throw new Error('unfilled placeholder in '+f); if(/>undefined<|undefined\//.test(h)) throw new Error('undefined leaked in '+f); checked++; console.log('OK '+f);} if(checked===0) throw new Error('no built country pages found — check dist path'); console.log('spot-check done, '+checked+' pages');"</automated>
    <human-check>Read the AFG, MEX, MCO and one non-English (zh or de) country page: confirm Q1 gives the right verdict + names drag pillars + explains what they mean; Q2 reads with concrete indicator drivers (and no alarmism for ISL); Q3 gives a natural advisory summary with correctly-named governments. Copy reads naturally in each language.</human-check>
  </verify>
  <done>npx astro build succeeds; npm run validate:seo passes all checks (FAQPage node intact); built ISL/MCO/AFG/MEX pages have no unfilled {placeholders} and no leaked "undefined"; visible FAQ text equals FAQPage acceptedAnswer text; a non-English page renders fully translated copy.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-time data (public/scores.json) -> generated HTML + JSON-LD | Trusted, static, committed data flows into rendered country pages at build time. No runtime/user input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-pcc-01 | Tampering | FAQPage JSON-LD from getCountryFaqData | mitigate | Answers stay plain text; buildFaqPageJsonLd JSON.stringifies (escapes quotes/newlines) and FaqSection.astro auto-escapes — same generator guarantees visible/JSON-LD parity, no divergent injection surface. |
| T-pcc-02 | Denial of Service | selectEligiblePillars single-pillar edge (Monaco) | mitigate | Guard the `second` slot against undefined; validated in Task 2 verify (no "undefined" in any output). |
| T-pcc-03 | Information Disclosure | Intl.DisplayNames government naming | accept | Region codes are hard-coded/derived from trusted advisory keys (uk->GB); no external data. Low risk. |
| T-pcc-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages introduced (Intl.DisplayNames is built-in); no install step, no legitimacy gate needed. |
</threat_model>

<verification>
- npx tsc --noEmit clean for the three edited files.
- npx astro build succeeds; npm run validate:seo passes all checks (FAQPage @graph node preserved).
- getCountryFaqData spot-check across ISL/MCO/AFG/MEX/ALA: exactly 3 items, no "undefined", no "insurance", correct verdict bands, indicator-driven Q2, advisory Q3 (cap for AFG, none for MEX, zero-advisory for ALA), uk->United Kingdom.
- Built HTML has no unfilled {placeholder} tokens; visible FAQ text equals FAQPage acceptedAnswer text.
</verification>

<success_criteria>
- Q1 verdict-first + drag-pillar + in-place pillar meaning (all 7 langs).
- Q2 explains the weakest eligible pillar via real indicators (advisories grouped), graceful for single-indicator pillars, non-alarmist at the top.
- Q3 insurance removed and replaced by the government-advisory question answered from country.advisories (count, consensus, named governments, majority-L4 cap explained, zero-advisory handled).
- Fix A: no zero-data pillar named as weakest/strongest in FAQ, meta, or answer-first paragraph; MIN_PILLAR_COVERAGE is the single source of truth (imported from engine.ts).
- Fix B: "40+" source framing in meta description and answer-first paragraph.
- Build + validate:seo green; visible FAQ / JSON-LD parity intact.
</success_criteria>

<output>
Create `.planning/quick/260706-pcc-faq-v2-si-no-verdict-inline-pillar-expla/260706-pcc-SUMMARY.md` when done.
Then commit on master and push with `git pull --rebase --autostash` first (per project convention).
</output>
