# Deferred items — quick-260511-k2m

Items discovered during V-Dem migration execution that are NOT directly caused
by this task's scope. Out-of-scope per executor SCOPE BOUNDARY rule. To be
addressed by a future test-modernization task.

## crisis-validation.test.ts uses retired wb_* WGI indicator names

**File:** `src/pipeline/__tests__/crisis-validation.test.ts`

**Status:** Tests still PASS (5/5 green), but the synthesized
`wb_political_stability`, `wb_rule_of_law`, `wb_gov_effectiveness`,
`wb_corruption_control` indicators are now silently dropped by
`normalizeIndicators()` (no entry in `INDICATOR_RANGES` after v8.1.0).

**Impact:** Reduced test signal quality. The crisis scenarios may no longer
discriminate as intended because the conflict / crime / governance pillars
end up with fewer effective indicators per fixture.

**Fix (out of scope):** Update the test-local `WEIGHTS` constant + raw
indicator fixtures to use `vdem_rule_of_law`, `vdem_gov_effectiveness`,
`vdem_corruption_control`, and drop `wb_political_stability` entirely. Tune
fixture values to preserve crisis-vs-baseline contrast.

**Why deferred:** The test still passes and does not block production. The
fix requires rebalancing fixture values (not a mechanical rename), which is
a test-modernization concern separate from the V-Dem data migration.
