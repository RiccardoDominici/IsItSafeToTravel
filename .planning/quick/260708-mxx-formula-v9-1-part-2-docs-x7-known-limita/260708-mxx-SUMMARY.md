---
status: complete
---

# Summary — 260708-mxx: Formula v9.1 PART 2 (docs ×7, UI confidence, ship)

## What shipped

**Commits:** `a08114da` (T1 methodology surface ×7 + low-confidence UI flag), `bfcea823`
(T2 README/CLAUDE.md/ApiDocs ×7/seo.ts/FAQ copy), plus orchestrator-completed T3:
UCDP source-attribution fix + definitive test isolation + data regen (see below).

- **T1**: methodology pages ×7 — v9.1 changelog section, crime = GPI Safety&Security 67% +
  WB homicide 33% (population-damped, P_HALF=200k), conflict + UCDP GED (28%, log-norm,
  CC-BY UCDP/OWID attribution), GPI 2026 edition note, known-limitations rewrite (removed
  resolved: PSE stale-GPI, RUS-vs-UKR, ESH step, GUM ca bug; added: PSE>Iran evidence note,
  small-pop homicide damping, UCDP quarterly lag, jp displayed-but-excluded); new i18n keys
  incl. methodology.indicator.wb_homicide/.ucdp_conflict_deaths ×7; ScoreHero "limited data"
  flag for confidence < 0.4 (i18n ×7).
- **T2**: README v9.1 + WGI/locale-list cleanup, CLAUDE.md Scoring → v9.1, ApiDocs ×7,
  seo.ts measurementTechnique, country-faq-copy indicatorLabels, hub-faq, llms generator
  mechanism sentence. (zh was already fully translated — only new strings translated.)
- **T3** (executor rate-limited mid-task; completed by orchestrator):
  - generate:llms; npm test.
  - validate:seo caught TWO real bugs before push:
    (1) 196 empty-url source anchors → SOURCE_CATALOG lacked the `ucdp` entry → added
        (https://ucdp.uu.se/, CC-BY OWID mirror attribution) + full backfill regen (669/669).
    (2) Missing country pages (build had only 2!) → data/scores/latest.json corrupted by a
        TEST-PARALLELISM RACE: the backup/restore pattern in snapshot/data05 tests is racy
        when node:test runs files in parallel; a 2099 fixture reached latest.json and the
        serialized re-runs faithfully preserved the corruption. DEFINITIVE FIX: getScoresDir()
        honors a SCORES_DIR env override; all snapshot-writing test files point at mkdtemp
        dirs; --test-concurrency=1. Verified: 131/131 twice, latest.json byte-identical
        after runs, restored from the intact 2026-07-08 snapshot.
  - Final build: 248 country pages ×7 locales, validate:seo ALL PASS.

## Verification
- npm test 131/131 (×2, real data untouched); validate:seo all-pass; dist spot-checks:
  TCA 5.5 + "Limited data" flag, PSE "Not recommended", global 6.60, UCDP in methodology,
  JPN pages present ×7.
- Production drift vs frozen prototype documented in PART 1 summary (live-data coverage fix).

## Follow-ups (backlog)
- jp advisory re-inclusion: gate correctly REJECTED at 0.362>0.25 — needs recalibration
  (importance/rebase) before entering the consensus; fixed fetcher shipped (display bug gone).
- UCDP token API (trailing-12m precision) as future upgrade over the quarterly OWID mirror.
- WB dataDate-based freshness decay: dataDate now persisted; decay flip deferred (parity).
