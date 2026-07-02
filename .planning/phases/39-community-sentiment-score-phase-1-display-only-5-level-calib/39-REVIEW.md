---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
reviewed: 2026-07-02T09:32:35Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - functions/api/vote.ts
  - functions/api/__tests__/vote-validation.test.ts
  - src/pipeline/sentiment/aggregate.ts
  - src/pipeline/sentiment/fetch-votes.ts
  - src/pipeline/sentiment/snapshot.ts
  - src/pipeline/sentiment/__tests__/aggregate.test.ts
  - src/pipeline/sentiment/__tests__/fetch-votes.test.ts
  - src/pipeline/sentiment/__tests__/score-invariance.test.ts
  - src/pipeline/run.ts
  - src/pipeline/types.ts
  - src/lib/sentiment.ts
  - src/lib/__tests__/sentiment.test.ts
  - src/components/country/SentimentPillar.astro
  - src/components/country/SentimentVote.astro
  - src/i18n/ui.ts
  - wrangler.toml
  - db/sentiment-schema.sql
  - public/_headers
  - .github/workflows/data-pipeline.yml
  - src/pages/en/country/[slug].astro
  - src/pages/en/methodology/index.astro
  - src/pages/en/legal/index.astro
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-07-02T09:32:35Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 39 adds a display-only "Community Sentiment" surface: a public `POST /api/vote`
Cloudflare Pages Function writing to D1, a daily pipeline aggregation stage, a build-time
loader, and a 7-locale UI widget. I reviewed against the eight phase invariants supplied by
the orchestrator and traced the vote path end-to-end (ingest → D1 → fetch → aggregate →
snapshot → build-time load → render).

**The load-bearing invariants hold.** The display-only guarantee is intact: `PillarName`
remains the closed 5-member union (`src/pipeline/types.ts:42`), `computeAllScores` is untouched,
`run.ts` writes sentiment to a separate `data/sentiment/` tree *after* the snapshot without
mutating `scoredCountries`, and `score-invariance.test.ts` fails the build if a 6th pillar or a
`sentiment` pillar ever appears. SQL is parameterized throughout (no string interpolation into
D1 binds). The IP is only ever salted-SHA-256 hashed, never stored or logged. Graceful
degradation is thorough: `fetchVotes` never throws, Stage 6 is wrapped so it can never flip
`PipelineResult.success`, `loadSentimentForCountry` returns `null` on missing/malformed data,
and the widget hides its submit control until JS runs. All 21 i18n keys are present exactly 7×
with consistent `{country}`/`{delta}`/`{count}` tokens across every locale. `wrangler.toml`,
the D1 schema, and the pipeline workflow's secret passthrough are correct.

**No blockers found.** The findings below are anti-abuse and code-hygiene gaps, not
correctness or security failures that would corrupt data or the real score. The most
substantive is a check-then-insert race that lets a single IP bypass both the weekly dedupe
and the daily cap (WR-01) — bounded by the ±1.0 display cap, but it defeats the exact
anti-manipulation control this phase exists to provide.

## Warnings

### WR-01: Non-atomic check-then-insert lets one IP bypass weekly dedupe and daily cap

**Status: FIXED** (commit `20499a06`) — added `CREATE UNIQUE INDEX IF NOT EXISTS
idx_votes_unique_voter ON votes (iso3, voter_hash)` to `db/sentiment-schema.sql`, and changed
`functions/api/vote.ts` step 8 to `INSERT OR IGNORE`, returning `{ok:true, deduped:true}` when
`res.meta.changes === 0`. The DB now enforces one-vote-per-IP-per-country-per-week atomically;
the existing SELECT-based check remains as a cheap pre-check that saves a write for the common
case. Daily-cap check is unchanged (bounded residual race remains, as noted in the original
finding).

**File:** `functions/api/vote.ts:131-157`, `db/sentiment-schema.sql:7-15`
**Issue:** The dedupe check (step 6, `SELECT COUNT(*) … WHERE voter_hash = ?`), the daily-cap
check (step 7), and the `INSERT` (step 8) are three separate statements with no transaction and
no uniqueness constraint. A client that fires N concurrent `POST /api/vote` requests will have
every request observe `COUNT = 0` before any of them inserts, so all N rows land. This defeats
both the per-country weekly dedupe and the 30/day per-visitor cap from a *single* IP. Because
the aggregation surfaces a country at only 5 votes and the correction saturates at ±1.0, a
short burst from one IP is enough to move a low-traffic country's displayed "perceived" score
by the full cap. The schema has no `UNIQUE` index (`grep -c UNIQUE` → 0), so the DB does not
catch the duplicates either. Display-only, so it cannot corrupt the real score — but it nullifies
the anti-abuse guarantee the phase is built around.
**Fix:** `voter_hash` already encodes the week bucket (`${iso3}:${weekBucket}`), so a uniqueness
constraint enforces one-vote-per-bucket atomically and removes reliance on the read-back:
```sql
-- db/sentiment-schema.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_dedupe_unique ON votes (iso3, voter_hash);
```
```ts
// vote.ts step 8 — let the DB reject the duplicate atomically
const res = await db
  .prepare('INSERT OR IGNORE INTO votes (iso3, delta, official_score, voter_hash, day_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .bind(iso3, delta, null, voter_hash, day_hash, nowSec)
  .run();
if (res.meta?.changes === 0) return json({ ok: true, deduped: true }, 200);
```
The daily cap is a softer control; if burst-proofing it also matters, gate the insert on a
`D1.batch([...])` transaction rather than two independent statements.

### WR-02: `official_score` column stores unvalidated client input; comment contradicts the code

**Status: FIXED** (commit `6adfdd4a`) — added an exported `normalizeOfficialScore(x)` helper in
`functions/api/vote.ts` that returns the value only if it is a finite number in `[1, 10]`,
otherwise `null`; the INSERT now binds `officialScore ?? null` where `officialScore` is the
validated result. The adjacent comment was corrected to describe the validated 1-10-or-null
contract rather than the previous (inaccurate) "always explicitly nulled" claim. Unit tests
cover bounds, non-numeric input, `NaN`/`Infinity`, and the real-world `undefined` case.

**File:** `functions/api/vote.ts:150-156`
**Issue:** The comment states officialScore "is always explicitly nulled here," but the code
binds `body.officialScore ?? null` — i.e. it trusts and stores whatever `officialScore` the
client puts in the POST body. The documented contract is `{iso3, delta, token?}`, so in the
real widget flow this is always `undefined → null`, but a crafted request can write arbitrary
numbers/strings into the `official_score` column. It is never read back (`fetchVotes` selects
only `iso3, delta, created_at`), so impact is limited to junk audit data — and if a caller sends
a non-bindable type (object/array), `.bind()` throws `D1_TYPE_ERROR`, the outer catch swallows it,
and the legitimate vote is silently dropped with a generic `{ok:false}`. Either way the code does
not match its own comment, which is a maintenance trap.
**Fix:** Bind the literal, matching the stated contract:
```ts
.bind(iso3, delta, null, voter_hash, day_hash, nowSec)
```

### WR-03: State-changing endpoint has no origin/CSRF check and does not enforce Content-Type

**Status: FIXED** (commit `84ff01fd`) — added `isJsonContentType` and `isSameOriginOrAbsent`
helpers in `functions/api/vote.ts`, invoked as a guard at the top of `onRequestPost` before the
body is read: a `Content-Type` other than `application/json` (ignoring charset params) is
rejected with 415, and a present-but-mismatched `Origin` header is rejected with 403. An absent
`Origin` (curl, some same-origin browser fetches) stays allowed, and no CORS response headers
were added for cross-origin requests. This forces a real preflight for cross-origin POSTs (since
`application/json` is not a CORS-simple Content-Type) and the origin check gates it. Rate
limiting (WR-01 fix) remains the backstop.

**File:** `functions/api/vote.ts:37-41,70-83`
**Issue:** `Access-Control-Allow-Origin: *` plus the fact that the handler `JSON.parse`s the body
without checking `Content-Type` means any third-party page can cast votes using its visitors'
browsers/IPs. A `text/plain` POST is a CORS "simple request" (no preflight), so tightening the
CORS header alone would not close this — the request still reaches the handler. Combined with
WR-01, a malicious page could have each visitor fire a burst. This is a public, unauthenticated
write endpoint; the only real defense today is the per-IP rate limiting. Note this mirrors the
existing `functions/api/feedback.ts` convention (also wildcard CORS, also parses without a
Content-Type check), and the feature is display-only, so severity is modest — flagging so the
team can make an informed call rather than inherit the pattern unexamined.
**Fix:** For a state-changing endpoint, verify `Origin`/`Referer` against an allowlist of the
site's own hosts and reject mismatches, and/or require `Content-Type: application/json` (and
reject other types) so the browser is forced through a preflight that the origin check gates.
Rate limiting (WR-01 fix) remains the backstop.

## Info

### IN-01: Unused `official` prop in SentimentPillar

**File:** `src/components/country/SentimentPillar.astro:10,14`
**Issue:** `Props.official: number` is declared and passed from the country page
(`official={country.score}`) but never destructured or used — the component reads
`sentiment.perceived`/`sentiment.correction` exclusively. Dead prop.
**Fix:** Remove `official` from `Props` and the call site, or use it (e.g. to render the
official-vs-perceived comparison the audit fields imply).

### IN-02: Unused `officialScore` prop in SentimentVote

**File:** `src/components/country/SentimentVote.astro:12,17`
**Issue:** `Props.officialScore: number` is declared and passed (`officialScore={country.score}`)
but never destructured, and it is never sent in the POST body. The `official_score` audit column
(WR-02) was evidently meant to capture "score shown at vote time," but the wire never carries it.
Dead prop + unrealized audit intent.
**Fix:** Drop the prop if the audit column stays unused; or, to realize the intent, send it and
validate it server-side instead of the current `?? null` passthrough.

### IN-03: Bucketed hash vs. rolling window makes dedupe/cap double at epoch boundaries

**File:** `functions/api/vote.ts:115-118,130,140`
**Issue:** `voter_hash`/`day_hash` embed *fixed* epoch buckets (`weekBucket`, `dayBucket` from
`Math.floor(nowMs / …)`), but the dedupe and cap queries filter on a *rolling* `created_at`
window. Since the hash already encodes the bucket, the rolling filter is largely redundant, and
at each bucket boundary the hash changes so a visitor gets a fresh allowance — two "weekly" votes
can land minutes apart across a 7-day epoch boundary (same for the daily cap at UTC midnight).
Low impact for a display-only surface, but the two mechanisms are conceptually inconsistent.
**Fix:** Pick one model. If the WR-01 unique-index fix lands, the rolling dedupe filter can be
dropped entirely (uniqueness on `(iso3, voter_hash)` is the dedupe). Otherwise, base the window
purely on `created_at` and drop the bucket from the hash scope.

### IN-04: Aggregation read query has no LIMIT

**File:** `src/pipeline/sentiment/fetch-votes.ts:50`
**Issue:** `SELECT iso3, delta, created_at FROM votes WHERE created_at > ? ORDER BY created_at DESC`
is bounded only by the 180-day window (`run.ts:14`), not by row count, so D1 free-tier rows-read
scales with total vote volume. Naturally small today given the per-IP caps, but it will grow
unbounded within the window if volume rises, and the `ORDER BY` is unnecessary work for an
order-insensitive aggregation.
**Fix:** Add a defensive `LIMIT` (e.g. a generous ceiling well above expected daily volume) and
drop the `ORDER BY`, so a runaway table can never blow the free-tier read budget in one query.

### IN-05: `no_db`/unexpected-error paths return HTTP 200, so a dropped vote looks like success

**File:** `functions/api/vote.ts:122-124,161-164` with `src/components/country/SentimentVote.astro:154-160`
**Issue:** When the D1 binding is missing (`no_db`) or an unexpected error is caught, the endpoint
returns HTTP 200 with `{ok:false}`. The widget keys its success path on `res.ok` (HTTP status),
so it shows the "thanks" state and writes the `sentiment-voted-<ISO3>` localStorage flag even
though nothing was recorded — and the client-side dedupe then suppresses re-prompting. This is
consistent with the D-14 "never break the UX" decision, but it makes a silently dropped vote
indistinguishable from a recorded one.
**Fix:** Acceptable as a deliberate trade-off; if you want the client to be able to distinguish,
have it branch on the parsed `{ok}` body rather than `res.ok`, and skip the localStorage write
when `ok === false`.

---

_Reviewed: 2026-07-02T09:32:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
