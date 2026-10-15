// Claude Code Workflow script (run it with the Workflow tool: { scriptPath, args }), not a Node script.
//
// The reviewer swarm of the consistency audit (scripts/calibration/consistency/README.md). One cheap
// reviewer (Haiku) per batch file written by scripts/audit/make-review-batches.ts, then an Opus
// verifier per 13 findings that re-reads the pages and the data and keeps only real problems.
// Batch kinds: language (native-editor review of one language), comparisons (neighbour table and
// related lists), plausibility (score vs evidence on one page), ordering (score bounds and
// orderings per region, for formula constraints).
//
// args: { base: <factsDir>, pagesDir: <factsDir>/pages, latestJson: <repo>/data/scores/latest.json,
//         manifest: <contents of <factsDir>/batches/manifest.json> }
// Save the returned object as JSON and pass it to scripts/audit/assemble-consistency-db.ts --swarm.
//
// Lessons from the 2026-10-15 run, built in here: reviewers run at effort "high" (inheriting a
// "max" session made three of them think through their whole 128k output budget on ~83 pages and
// return nothing), batches are about half that size (make-review-batches.ts defaults), and every
// failed agent (output limit, rate limit) is retried once instead of leaving findings unverified.

export const meta = {
  name: 'consistency-audit',
  description: 'Haiku reviewers audit the built country pages and the score orderings for critique-style inconsistencies; Opus verifies every finding',
  phases: [
    { title: 'Review', detail: 'one Haiku reviewer per batch file (language, comparisons, plausibility, ordering)', model: 'haiku' },
    { title: 'Verify', detail: 'Opus verifiers check each finding against the page text and the data' },
  ],
}

const A = args.base
const PAGES = args.pagesDir
const LATEST = args.latestJson

const CATEGORIES = ['stale-data', 'irrelevant-indicator', 'generic-text', 'broken-text', 'contradiction', 'bad-comparison', 'implausible-value', 'implausible-score', 'other']
const CONSTRAINT_KINDS = ['none', 'score_at_most', 'score_at_least', 'safer_than', 'less_safe_than']

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso3: { type: 'string', description: "ISO3 of the page, or 'ALL' for a template/boilerplate issue seen on many pages" },
          lang: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          field: { type: 'string', description: 'TITLE, DESCRIPTION, H1, HERO, SUMMARY, FAQ, PILLAR BARS, INDICATORS, ADVISORIES, COMPARISON TABLE, RELATED, COMMUNITY, BOILERPLATE, SCORE' },
          quote: { type: 'string', description: 'Exact text copied from the batch file (shortest span that shows the problem)' },
          problem: { type: 'string', description: 'What is wrong, concretely. For a template issue, name 2-3 example ISO3s.' },
          expected: { type: 'string', description: 'What a correct version would say or show' },
          formulaRelevant: { type: 'boolean', description: 'True when the issue is about a score, band, rank, indicator choice or value (not wording)' },
          constraintKind: { type: 'string', enum: CONSTRAINT_KINDS },
          constraintValue: { type: 'string', description: "Number for score_at_most/at_least, ISO3 for safer_than/less_safe_than, '' for none" },
        },
        required: ['iso3', 'lang', 'category', 'severity', 'field', 'quote', 'problem', 'expected', 'formulaRelevant', 'constraintKind', 'constraintValue'],
      },
    },
    coverageNote: { type: 'string', description: 'Which ISO3s you actually read (first and last) and anything you could not read' },
  },
  required: ['findings', 'coverageNote'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          verdict: { type: 'string', enum: ['confirmed', 'rejected', 'uncertain'] },
          reason: { type: 'string', description: 'One or two sentences: what you checked and what you found' },
          category: { type: 'string', enum: CATEGORIES },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          fixArea: { type: 'string', enum: ['formula', 'copy-template', 'country-grammar', 'comparisons', 'data-source', 'advisory-parser', 'ui', 'other'] },
          constraintKind: { type: 'string', enum: CONSTRAINT_KINDS },
          constraintValue: { type: 'string' },
        },
        required: ['index', 'verdict', 'reason', 'category', 'severity', 'fixArea', 'constraintKind', 'constraintValue'],
      },
    },
  },
  required: ['verdicts'],
}

const CONTEXT = `You are auditing isitsafetotravel.org, a free travel-safety site (248 places x 7 languages; scores 1-10, higher = safer; bands: <5 danger, 5-6 high caution, 6-7 moderate, 7-8 good, >=8 excellent). On 2026-10-14 a German travel blogger refused to link it, saying the site "shows how NOT to use AI": data from 2023 shown as current, indicators irrelevant to travellers (air pollution, child mortality for Germany), generic machine sentences ("The biggest concern is governance (3.9/10), while the strongest area is conflict (6.9/10)"), a "compare with neighbours" table with no real neighbours, and "similar countries" lists like Antarctica / Israel / Aland for Ecuador. Your job is to find what is STILL wrong, of that kind, so it can be fixed and so formulas can be evaluated against a database of verified problems.

Known and accepted (do NOT report): scores are written with a dot ("8.5/10") in every language; government advisory cards quote each issuer's own label in its own language (e.g. "Erhoehte Vorsicht", "Zvýšená opatrnost"); places with too little data are grey on purpose ("Partial data", no score, no rank; their neighbour comparison table stays, with the place's own row shown as "Partial data" next to scored neighbours); the pillar formerly called "environment" is now "Natural hazards"; the English name "Aland Islands" lacks the Å; methodology boilerplate describing the formula is intentional unless it is factually wrong or broken.

Rules: quote text EXACTLY as it appears in the batch file. Never invent a page, a quote or a fact. A problem that repeats across many pages because it comes from one template: report it ONCE with iso3 "ALL", naming 2-3 example ISO3s in "problem". Severity: high = misleading for a safety decision, or nonsense in TITLE/H1/HERO/SUMMARY; medium = wrong or contradictory elsewhere; low = style. constraintKind is "none" unless the instructions for your batch say otherwise.`

const PACE = 'Note each problem as you read, keep your reasoning short, do not re-scan the whole file at the end, and answer as soon as you have read the last line.'

const base = (file) => file.split('/').pop()

function reviewerPrompt(item) {
  const scope = `Read the WHOLE file ${A}/${item.file} with the Read tool (400 lines per call) until you reach its last line; it covers ${item.isos.length} places (${item.isos[0]} .. ${item.isos[item.isos.length - 1]}).`
  if (item.kind === 'language') {
    return `${CONTEXT}

YOUR BATCH: language quality review, language = ${item.lang}. ${scope} The file starts with boilerplate FAQ sentences shown once as [B1], [B2]...; ${item.reviewBoilerplate ? 'review those once, then every page' : 'another reviewer covers them, so do NOT report problems inside the boilerplate sentences themselves; use them only to understand the pages, then review every page'}.

Review as a demanding native ${item.lang} editor. Report:
- broken-text: grammar, agreement, gender, case, articles or prepositions with the country name (e.g. wrong "in/nach", "en/à/au", "no/na/em", missing or wrong article), incomplete or truncated sentences, a sentence starting in lowercase, doubled words, stray placeholders, untranslated English (or another language) in ${item.lang} text outside quoted advisory labels, awkward machine-translation phrasing a native would never write;
- generic-text: sentences that sound informative but say nothing concrete (like the blogger's example), or that present a merely "least bad" area as a strength;
- contradiction: two statements on the SAME page that disagree (e.g. SUMMARY names a main risk but the FAQ says no factor stands out; verdict wording vs band; numbers that differ between TITLE/DESCRIPTION/HERO/SUMMARY/FAQ; rank or counts that disagree);
- stale-data: a year or edition shown as current that is old.
Return at most 15 findings, most important first. ${PACE}`
  }
  if (item.kind === 'comparisons') {
    return `${CONTEXT}

YOUR BATCH: comparisons review (English pages). ${scope}

For each place check, using your geography knowledge:
- COMPARISON TABLE ("... compare to neighbouring and nearby countries"): rows without a "nearby" tag should be real land (or immediate maritime) neighbours; rows tagged "nearby" should really be close. Report a missing obvious neighbour only when a real neighbour WITH an official score is absent while a far-away place is shown. The page's own country appears in the table on purpose.
- RELATED "In the same region": are they plausibly the same world region?
- RELATED "Similar risk profile": the list is chosen by similar pillar scores; report it only when it would look absurd or misleading to a traveller (e.g. a war zone listed as similar to a calm country), and say why.
- bad-comparison is the main category here; use contradiction if a score in a table disagrees with the place's own HERO.
Return at most 15 findings, most important first; group repeated patterns. ${PACE}`
  }
  if (item.kind === 'ordering') {
    return `${CONTEXT}

YOUR BATCH: score orderings, ${item.title}. Read the file ${A}/${item.file} with the Read tool (one call is enough): one row per place, sorted by score, with the evidence columns explained in its header line.

Find where the current scores are clearly WRONG against what is widely known in the current year about travelling to these places (crime, terrorism, armed conflict, political unrest, health care, natural hazards) and against the evidence in the rows (government advisory levels, homicide rate, conflict deaths):
- a place rated clearly too safe or too dangerous (band or score);
- a pair in the wrong ORDER that a well-informed traveller would immediately object to (e.g. "Japan rated less safe than Italy"), especially between neighbours or similar destinations.
For each, give ONE formula constraint: score_at_most / score_at_least (a bound on the 1-10 scale with a sensible margin, not a precise target) or safer_than / less_safe_than (iso3 vs constraintValue, another ISO3 that HAS a score; only orderings almost any travel-safety expert would agree with).
Only places with an official score (not grey). Only constraints the current scores violate, or satisfy by less than 0.3 points. Evidence in "problem", the row's ISO3, name and score in "quote"; category implausible-score, field SCORE, formulaRelevant true, lang en. Return at most 12, the most clear-cut first; fewer (or none) is better than weak ones. ${PACE}`
  }
  return `${CONTEXT}

YOUR BATCH: truthfulness and plausibility review (English pages). ${scope}

For each place, using what you know about the world in the current year and the evidence on the page itself, check:
- implausible-score: is the score/band (HERO) at odds with the evidence shown (advisory levels, indicators) or with widely known reality?
- implausible-value: an indicator value that looks wrong for that country (e.g. a homicide rate far off the known order of magnitude), or an advisory level that clearly contradicts that government's well-known stance;
- stale-data: values presented as current that are old (check the year column) or editions mislabelled;
- irrelevant-indicator: an indicator a traveller cannot act on;
- generic-text / contradiction in SUMMARY (e.g. the main risk named is not supported by the indicators).
When you are confident, add a formula constraint a sound scoring formula should satisfy: score_at_most / score_at_least with a number on the 1-10 scale, or safer_than / less_safe_than with another ISO3 (only for orderings that almost any expert would agree with), only for places whose current score violates them or nearly does (0-6 per batch). Flag only clear discrepancies; say "uncertain" in "problem" when you are not sure. Return at most 15 findings, most important first. ${PACE}`
}

function verifierPrompt(item, findings, offset) {
  const list = findings.map((f, i) => `#${offset + i} [${f.category}/${f.severity}] iso3=${f.iso3} lang=${f.lang} field=${f.field}
QUOTE: ${f.quote}
PROBLEM: ${f.problem}
EXPECTED: ${f.expected}
CONSTRAINT: ${f.constraintKind} ${f.constraintValue}`).join('\n\n')
  const what = item.kind === 'language' ? `the ${item.lang} pages` : item.kind === 'ordering' ? `the score table ${item.title}` : `the English pages (${item.kind})`
  return `${CONTEXT}

You are the VERIFIER. A cheaper model reviewed ${what} of ${item.isos.length} places (batch file ${A}/${item.file}) and reported the findings below. Cheap reviewers often misquote, misread tables, misremember facts or confuse which side of an ordering is safer; your job is to keep only real problems.

For each finding:
- open the page text: ${PAGES}/<ISO3>.<lang>.txt (e.g. ${PAGES}/ECU.de.txt); for iso3 "ALL" check at least two of the example pages named in the problem, plus the batch file's boilerplate list; the full data is in ${LATEST} (search it, do not read it whole);
- verdict "confirmed" only if the quoted text really is on the page AND the problem is real; "rejected" if the quote is not there, the claim is wrong, or it is one of the accepted items listed above; "uncertain" when it hinges on a real-world fact you cannot establish with confidence;
- language findings: judge as a native speaker of that language; a mere stylistic preference is "rejected" or severity low;
- plausibility and ordering findings: check the numbers on the page and in the data; for real-world facts use your own knowledge and be strict. A formula constraint enters a database used to judge future formulas, so a wrong one does lasting damage: keep it only if almost any travel-safety expert would accept it, with a margin; correct the bound or the pair when the idea is right but the numbers are off;
- set category and severity to what is right (you may change them), fixArea to where the fix belongs (formula, copy-template, country-grammar, comparisons, data-source, advisory-parser, ui, other), and keep, correct or remove (constraintKind "none") the formula constraint.
Return one verdict per finding, using the # index shown.

FINDINGS:
${list}`
}

/** One agent call, retried once: a failed agent must not silently drop a batch or its verdicts. */
async function withRetry(prompt, opts) {
  const first = await agent(prompt, opts)
  if (first) return first
  log(`${opts.label} failed, retrying once`)
  return agent(`${prompt}\n\n(Second attempt: the first one failed, probably on the output limit. Work in smaller steps and keep your reasoning brief.)`, { ...opts, label: `${opts.label}:retry` })
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const m = args.manifest
const items = [
  // Boilerplate sentences are the same in every file of a language: only its first file reviews them.
  ...m.language.map((x, i, all) => ({ ...x, kind: 'language', reviewBoilerplate: all.findIndex((y) => y.lang === x.lang) === i })),
  ...m.comparisons.map((x) => ({ ...x, kind: 'comparisons' })),
  ...m.plausibility.map((x) => ({ ...x, kind: 'plausibility' })),
  ...(m.ordering ?? []).map((x) => ({ ...x, kind: 'ordering' })),
]
log(`${items.length} reviewer batches`)

const results = await pipeline(
  items,
  (item) => withRetry(reviewerPrompt(item), { label: `review:${base(item.file)}`, phase: 'Review', model: 'haiku', effort: 'high', schema: FINDINGS }),
  async (review, item) => {
    const head = { item: item.file, kind: item.kind, lang: item.lang ?? 'en' }
    if (!review) return { ...head, reviewFailed: true, findings: [] }
    const findings = review.findings ?? []
    const verdictSets = await parallel(chunk(findings, 13).map((g, gi) => () => withRetry(verifierPrompt(item, g, gi * 13), {
      label: `verify:${base(item.file)}#${gi + 1}`, phase: 'Verify', effort: 'high', schema: VERDICTS,
    })))
    const byIndex = new Map()
    verdictSets.forEach((vs) => (vs?.verdicts ?? []).forEach((v) => byIndex.set(v.index, v)))
    const merged = findings.map((f, i) => ({ ...f, batch: item.file, kind: item.kind, verification: byIndex.get(i) ?? null }))
    const unverified = merged.filter((x) => !x.verification).length
    if (unverified) log(`${item.file}: ${unverified} finding(s) came back without a verdict`)
    return { ...head, coverageNote: review.coverageNote, findings: merged }
  },
)

const all = results.filter(Boolean)
const flat = all.flatMap((r) => r.findings)
const n = (k) => flat.filter((f) => f.verification?.verdict === k).length
log(`${flat.length} findings: ${n('confirmed')} confirmed, ${n('uncertain')} uncertain, ${n('rejected')} rejected, ${flat.filter((f) => !f.verification).length} unverified; ${all.filter((r) => r.reviewFailed).length} batch(es) failed`)
return {
  batches: all.map((r) => ({ item: r.item, kind: r.kind, lang: r.lang, reviewFailed: !!r.reviewFailed, coverageNote: r.coverageNote ?? '', count: r.findings.length })),
  findings: flat,
}
