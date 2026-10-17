/**
 * Data-revision marker for the daily snapshot format/content.
 *
 * Bump this whenever a pipeline change would make a naive day-over-day diff
 * misleading — either a schema change, or (as with rev 2) a one-time
 * correction to score inputs that isn't a real change in conditions on the
 * ground. `writeSnapshot` stamps every new snapshot with the current value;
 * `computeNews` (src/pipeline/news/engine.ts) compares prev vs curr and, on
 * a mismatch, suppresses EVERY event type for that one run (score_jump,
 * band_change, rank_overtake, top10_change, new_country, severe_advisory) —
 * otherwise the correction itself would be reported as "movement". Rev 2->3
 * (2026-09-26) is why new_country/severe_advisory are no longer exempt: they
 * are existence/threshold checks, not score deltas, but they are still
 * DIFF-derived (present-vs-absent, now-level-vs-was-level), and a frozen or
 * broken source can make a country's data look "new" or a level look like it
 * "just became" severe purely because yesterday's snapshot never resolved it
 * at all — see the rev 3 entry below for the real incident this caused.
 *
 * Changelog:
 *   1 (implicit/default) — every snapshot written before 2026-09-25. No
 *     `dataRevision` field on disk; `?? 1` is the fallback everywhere this
 *     is read, so old snapshots are treated as revision 1 without a backfill.
 *   2 (2026-09-25) — audit cleanup, two corrections landing in the same run:
 *       a) source-floor.ts restore policy bounded to MAX_RESTORE_AGE_DAYS
 *          (14). Previously an issuer past its floor was restored from
 *          whichever cached file held its ALL-TIME MAXIMUM coverage, with no
 *          age limit — nine issuers that had been dead since spring 2026
 *          (it/pl/pt/be/ie among them) kept republishing pre-death data every
 *          day through 2026-09-25, e.g. Italy/Ireland showing "normal
 *          precautions" for Afghanistan from a 2026-03-27 cache.
 *       b) hk/dk/ch/rs advisory parsers stopped defaulting to level 1 when
 *          they could not determine a real level (dead/redesigned source
 *          page, unrecognized phrasing) — they now emit nothing for that
 *          country instead.
 *     Countries affected by either fix see a score change that reflects the
 *     correction, not a real overnight change in safety.
 *
 *     Same revision, same run: the broader source-repair pass from the
 *     2026-09-25 audit (findings/inconsistencies.md I2) landed alongside a/b
 *     above. Status as of that run, kept here (not just in a commit message)
 *     because it explains score movement that isn't a real overnight change:
 *       - Repaired (now fetch live again): us (JSON API/RSS chain rebuilt),
 *         fr, ie, be, it, es, pl, pt, sk, cz, hu, sg, br.
 *       - uk/jp/hk/dk/rs/ch/in advisory parsers no longer default to level 1
 *         when they can't determine a real level (see (b) above for
 *         hk/dk/ch/rs specifically; uk/jp/in got the same treatment here).
 *       - de: parser now also recognizes the "wird abgeraten" ("advised
 *         against") phrasing the source site uses for partial warnings —
 *         previously unmatched text fell through to a stale/default level;
 *         this alone changes the resolved level for 36 countries.
 *       - Still blocked by anti-bot challenges (no/fi/ph/ro): fetchers run
 *         but the source blocks the request before any level can be parsed.
 *       - Still not implemented (hr/kr/se): no fetcher exists yet, distinct
 *         from the anti-bot cases above — there is nothing to repair, only
 *         to build.
 *
 *   3 (2026-09-26) — first production run of the rev-2 parser repairs surfaced wrong data of its
 *     own; second-pass fixes for four sources, plus a computeNews rule gap the run exposed:
 *       a) ES (Spain): a text-extraction bug (DOM blocks glued together, no separator) let an
 *          unrelated "de noche" curfew aside zone-scope and so suppress the Central African
 *          Republic's whole-country evacuation banner, reporting level 1 for an active "leave the
 *          country" order. Fixed in the shared normalizeAdvisoryText (also used by Italy — zero
 *          regression there, verified against 8 live IT dossiers). Also added Spain's "SE ACONSEJA
 *          APLAZAR SU VIAJE" (postpone your trip) wording as level 3, live on 7 Gulf/Middle-East
 *          states that were all wrongly reporting level 1.
 *       b) SK (Slovakia): 139 countries were stuck on level 1 because the "nothing matched"
 *          fallback defaulted to it. Added MZV's own whole-country "does not recommend travel"
 *          and "consider the necessity of travel" phrase families; level 1 now requires an
 *          affirmative calm statement instead of being the default.
 *       c) RS (Serbia): the listing-page fetch started failing with a network-level error
 *          ("fetch failed", not an HTTP status) on the exact request pattern that had worked
 *          hours earlier — added retry-with-backoff. Separately, normalizeRsLevel had NO path to
 *          level 1 at all (a rev-2 fix for its escalated end left calm countries — Switzerland,
 *          Canada, China, confirmed live — falling through to null); added calm-phrase detection.
 *       d) DK (Denmark): coverage looked like a regression (41 -> 7) but the extractor introduced
 *          in rev 2 had zero failures — the historical "41" baseline was itself mostly fabricated
 *          level-1 data for "no guidance published" stub pages the OLD parser never excluded.
 *          Removed an unrelated "first 80 countries" sample cap that was hiding 168 untried
 *          countries (including Ukraine, Myanmar) for free; honest coverage: 7 -> 31.
 *       e) computeNews (src/pipeline/news/engine.ts): the SK/ES/RS/DK repairs above landing in
 *          this same rev-2->3 run proved new_country and severe_advisory were NOT safe to exempt
 *          from the dataRevision guard after all (see the doc comment above `computeNews`) — the
 *          US advisory source had been frozen on a stale cache, its parser never matched Burma/
 *          North Korea/West Bank and Gaza, and once (a)-(d) let those countries resolve correctly
 *          the diff read their real, years-old level-4 advisories as 7 brand-new severe_advisory
 *          events and emailed them as "new today". All six event types are now suppressed across
 *          any dataRevision mismatch, not just the four score-delta ones.
 *     Countries affected by (a)-(d) see a score/advisory change that reflects the correction, not
 *     a real overnight change in safety; (e) is why none of that shows up as "news" regardless.
 *   4 (2026-09-26) — BE (Belgium): the rev-3 production data still showed level 1 "Pas de
 *     restrictions" for South Sudan, whose page orders Belgians to leave the country. Added the
 *     missing "quitter"/"retourner" travel verbs (with a governing advisory verb required, so
 *     China's drug-law "obligation de quitter le pays" stays out), a word-boundary fix for the
 *     whole-country name check (Somalia's "somaliennes" had matched "somalie"), and the same
 *     level-1-only-when-affirmed rule as SK: 25 countries 1 -> no data, SSD 1 -> 4, ARE 1 -> 2.
 *     Bumped so the correction lands without news events, like revs 2 and 3.
 *   5 (2026-09-26) — two issuers that had been silently contributing nothing start contributing:
 *       a) HK (Hong Kong OTA): the index page renders its alert table client-side, so the
 *          server HTML the old fetcher parsed never contained a single alert. Now read from the
 *          OTA's own JSON (`/json/ota_index/ota_index.json`, `showInIndex` entries only — the
 *          same array keeps superseded alerts back to 2021); regional entries are capped at 2.
 *          Coverage 0 -> 27 countries (black 4 / red 3 / amber 2; HK never states "no risk", so
 *          countries without an alert stay no-data rather than level 1).
 *       b) CH (Swiss FDFA): eda.admin.ch was rebuilt on Nuxt and the scraped listing page no
 *          longer carries any risk information. Now read from the site's own JSON API
 *          (`advice_against` enum: general 4 / tourists 3 / regional 2; 'none' is level 1 only
 *          with the FDFA's explicit "gilt grundsätzlich als sicher" phrase, otherwise 2).
 *          Coverage ~3 -> 176 countries.
 *     Both change the advisory consensus for many countries at once — a correction in our
 *     inputs, not an overnight change on the ground — so the run that picks them up must not
 *     emit news. DATA_REVISION_SINCE stays 2026-09-26: every cache from that date on was
 *     written by rev-4 code for all other issuers, and HK/CH caches from before the fix are
 *     far below the new high-water marks, so the floor check can never restore them.
 *   6 (2026-09-26) — regional warnings were being promoted to a whole-country "do not travel": ten
 *     parsers read a warning about ONE region (a border strip, a separatist territory, a single
 *     province) as level 4 for the entire country, inflating the advisory consensus of popular
 *     destinations. Found by comparing every issuer's level 4s against the median of the other
 *     governments for the same country, then checked sentence by sentence against the live sources:
 *       - AT: BMEIA's `securityPartial` peak was maxed with the country level; now the page's own
 *         "Rest des Landes" level is read (a partial warning alone caps at 2). L4 40 -> 17
 *         (Thailand, Turkey, Egypt, Morocco, India, Kenya... were all regional).
 *       - HU: KKM's multi-value badge lists every tier on the page; the country's own residual tier is
 *         now read from the body. L4 35 -> 28.
 *       - JP: MOFA only publishes per-region levels and the parser took the worst region; sub-national
 *         entries now cap at 2 unless the country-wide catch-all is higher. L4 34 -> 14.
 *       - NZ: now reads SafeTravel's own structured overall `adviceLevel` (coverage 14 -> 220).
 *       - TW: one table row per alert; the country's bare/catch-all row now wins over regional rows
 *         (coverage 166 -> 216; YEM 3 -> 4 was under-counted via Saudi Arabia's row).
 *       - IT: border/exclave/separatist wording, "presenti a qualsiasi titolo", parenthetical mentions
 *         of other countries (Mauritania's text bans Mali); Guinea's "massima prudenza negli
 *         spostamenti" is now 2, not a fallback 1. L4 20 -> 11.
 *       - ES: zone markers (península, anaphoric "la zona", glued headings). L4 22 -> 17.
 *       - FR: the ±120-char window crossed section, exception and country boundaries. L4 18 -> 15.
 *       - BE: Liberia's "voyager seul à l'intérieur du pays" (a manner tip) no longer reads as a
 *         whole-country verdict. RS: Panama's Bocas del Toro-only warning. SG: Tajikistan's border /
 *         Gorno-Badakhshan warning. Each 4 -> 2 or 3.
 *     Every level 4 that still sits against a calm peer median has a quoted country-wide sentence.
 *     Scores move for many countries because our inputs were wrong, not because anything changed on
 *     the ground — bumped so that run emits no news, like revs 2-5.
 *   7 (formula v10, SPEC .planning/quick/261014-formula-v10/SPEC.md; first scheduled run after the
 *     v10 merge) — the scoring formula itself changes, so every score moves on the switch day for
 *     methodological reasons only:
 *       a) indicator set: INFORM is read from the newest edition with exact columns (Access to
 *          health care, Epidemic, Natural, Governance), dropping Human-as-health and
 *          River-Flood-as-climate; child mortality and PM2.5 leave the formula; the conflict
 *          pillar is unchanged (gpi_conflict is fetched but unscored);
 *       b) 5-year max age: 81 stale values (75 World Bank homicide rates, 6 V-Dem rows for VAT/PSE
 *          dated 1870/1948) count as missing on 2026-10-14;
 *       c) grey rule: 56 places with < 4 sources get score null (scoreStatus insufficient_data)
 *          instead of a prior-driven number, so they leave every score-derived surface;
 *       d) per-pillar scale continuity for health, governance and environment (weights.json
 *          formulaV9.pillarCalibration) and the bounded community adjustment (at most +/-1.0
 *          point, only for active communities);
 *       e) (same day, after the first v10 run) the disaster-alert feeds GDACS and ReliefWeb no
 *          longer count toward the four-source floor (scoring/coverage.ts): a GDACS alert had
 *          given Guam a fourth "source" and a score resting on two real datasets. Only Guam
 *          changed (scored 6.55 -> grey); it lands on 2026-10-15 under this same revision.
 *     Without this bump the switch run would diff v9.1 against v10 and email 28 band changes and
 *     dozens of score jumps that are the formula change, not news. The first production run must
 *     ALSO be dispatched with skip_digest=true (SPEC §6): the digest step reads the news file, and
 *     the bump already empties it, but skipping is the belt to these braces.
 *       f) (same day) advisory-outlier audit: every issuer level two or more steps from its
 *          country's peer median (91 in the 2026-10-14 data) was re-read on the live official page
 *          and the parser rules that produced the wrong ones were fixed generically, each commit
 *          quoting the official sentence (merge f30faf1e). jp: North Korea's whole-territory
 *          "渡航を自粛してください" 1 -> 4. rs: tips, transport text and calm "high level" no longer
 *          read as level 3. fr: a sentence naming the country as destination is national. be: the
 *          "Dernière mise à jour" verdict is read and "tous les voyages" is level 4. it: activity
 *          tips and "evitare le aree". es: zone- or activity-scoped "extremar la precaución". cz:
 *          MZV's "varuje před cestami" verb form, rest-of-country catch-alls, and no level-1
 *          default for unmatched prose (North Korea and South Sudan 1 -> 4). de: a warning with
 *          named exceptions is national (Burkina Faso 2 -> 4). sg: a verdict naming the country is
 *          not capped, and the Middle-East-wide "defer all travel to the region" is level 4. sk:
 *          "zvýšená ostražitosť" is level 2. About 88 countries' advisory consensus moves for this
 *          reason alone; coverage rs 105 -> 104, be 151 -> 154, sg 43 -> 45, sk 78 -> 80.
 *     DATA_REVISION_SINCE moves to 2026-10-15 with (f): every advisory cache written before the
 *     first run with the fixed parsers holds pre-fix levels (Belgium's Yemen at 2, Czechia's North
 *     Korea at 1, Singapore's Lebanon at 2), and a source-floor restore within the next 14 days
 *     would bring them back. (The earlier v10 runs of 2026-10-15 used the old parsers, but a
 *     restore source must be dated strictly before the run date, and later runs of the same day
 *     rewrite that day's caches, so the 2026-10-15 caches that tomorrow's run could restore from
 *     are the fixed ones.)
 *   8 (formula v10.1, weights 10.1.0; first scheduled run after the merge) — the 2026-10-15
 *     consistency audit (scripts/calibration/consistency/) changed the formula again, so scores
 *     move on the switch day for methodological reasons only:
 *       a) level-3 "reconsider travel" advisories count at half weight in the severe modifier
 *          (Kuwait -0.5, Saudi Arabia, Bahrain, Cuba, Jordan about -0.35; Pakistan enters the
 *          danger band);
 *       b) the natural-hazards indicator is exposure combined with INFORM's lack of coping capacity
 *          (Japan +0.33, South Korea +0.24), read from a new INFORM column (inform_coping);
 *       c) the UCDP conflict-death curve keeps falling past 24,000 deaths (Ukraine, Sudan);
 *       d) the prior lost its 0.60 ceiling (calm European places up to +0.14);
 *       e) a source counts, and is listed, only when it supplies a value the score uses: 96 source
 *          lists lose a population-only World Bank entry and nine places go grey (BRN, FSM, KIR,
 *          MHL, NRU, PLW, TON, TUV, WSM).
 *     The same release also changes advisory inputs (same audit, same switch run):
 *       f) Canada is read from Global Affairs Canada's open-data JSON (OGL-Canada) instead of the
 *          travel.gc.ca markup, which had been dead since 2026-10-01 (the old fallback kept
 *          republishing that day); a US/UK/CA/AU cache now counts for 7 days at most, then the
 *          issuer is dropped and the staleness alert fires;
 *       g) country names are matched accent- and apostrophe-insensitively: the UK FCDO now
 *          resolves 228 places instead of 193 (North Korea, Hong Kong, Côte d'Ivoire...) and the
 *          US feed resolves Côte d'Ivoire, the Republic of the Congo and São Tomé and Príncipe;
 *       h) the UK level reads the whole-country verdict (Sudan, Somalia, CAR, Libya, Ukraine 3 -> 4),
 *          Japan's MOFA levels map one step up (display only: jp is frozen-excluded), and a
 *          ministry's page about its own country is no longer an advisory (Austria, Argentina).
 *     10 band changes on the 2026-10-15 data. Without this bump the switch run would report them,
 *     the nine new grey places and dozens of score jumps as news. Dispatch the first production
 *     run with skip_digest=true as for rev 7. DATA_REVISION_SINCE moves to 2026-10-17, the day of
 *     the switch run (the merge reached master on 2026-10-17 07:45 UTC, after the 2026-10-16 run):
 *     the advisory caches of 2026-10-15 and 2026-10-16 were written by the old CA/UK/JP parsers
 *     and the old name matching, so they must never be restored; the switch run writes the
 *     2026-10-17 caches with the new parsers.
 */
export const DATA_REVISION = 8;

/**
 * The calendar date (YYYY-MM-DD, pipeline run date) this revision first takes
 * effect — the first SCHEDULED run using the rev-2 code, not the day the PR
 * merged. Unchanged by the rev 3 bump: rev 3's parser fixes (a)-(d) above
 * landed the same day, ahead of the same next scheduled run, so one cutoff
 * date still correctly excludes every pre-fix cache from both revisions.
 * `source-floor.ts` uses this as a hard floor on restore eligibility, in
 * addition to MAX_RESTORE_AGE_DAYS: a cache dated before this is NEVER used
 * as a restore source, no matter how high its count or how recent it is
 * relative to MAX_RESTORE_AGE_DAYS. Every cache before this date was written
 * by a parser rev 2 or rev 3 fixed (hk/dk/ch/rs defaulting to level 1 and the
 * unbounded historical-max restore itself in rev 2; the ES/SK/RS/DK second-
 * pass bugs in rev 3) — a "healthy" pre-revision count just means the bug was
 * productive, not that the data is trustworthy. Without this cutoff, the
 * 14-day bound alone still lets a currently-broken issuer's LAST pre-fix day
 * (which always looks recent and healthy) keep getting restored for up to 14
 * more days after a fix ships, before finally erroring — this closes that gap
 * outright: from DATA_REVISION_SINCE's first run onward, a fixed parser's
 * deliberate omissions stay omitted immediately.
 * Moved from 2026-09-26 to 2026-10-15 with rev 7 (f), the advisory-outlier audit.
 * Moved to 2026-10-17 with rev 8 (f-h), the advisory and name-matching fixes.
 */
export const DATA_REVISION_SINCE = '2026-10-17';
