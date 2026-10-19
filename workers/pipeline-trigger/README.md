# pipeline-trigger

A Cloudflare Worker that starts the daily data pipeline (`.github/workflows/data-pipeline.yml`) on time.

## Why

GitHub's `schedule` trigger is best-effort. For a cron set to 06:00 UTC it fired at these average delays:

| Month | Average delay | Worst delay |
|---|---|---|
| June 2026 | 3.8 h | 5.9 h |
| September 2026 | 5.1 h | 7.1 h |
| October 2026 | 6.2 h | 8.6 h |

Through October the runs started between 10:13 and 14:34 UTC. Many other repositories reported the same in 2026. A `workflow_dispatch` call, by contrast, starts a run within seconds.

## What it does

All times are UTC. The slot list lives in `src/trigger.ts` as `DAILY_CRONS`, and `wrangler.toml` repeats it; a unit test keeps the two in sync.

| Cron | Job |
|---|---|
| `5 6 * * *` | Start today's run. |
| `40 6 * * *` | Retry if the 06:05 run failed. A run takes about 16 minutes, 45 at most. |
| `5 8 * * *` | Last retry. |
| `20 12 * * 1` | Weekly self-check of the token. It reads the runs and makes a dispatch probe to a branch that does not exist, so it starts nothing. |

**The daily rule** (`src/decide.ts`):

- **Wait:** if any run is still going, do nothing.
- **Skip:** if a "daily" run created since 05:55 UTC has already succeeded, do nothing.
- **Dispatch:** otherwise, start a run, or a retry if a daily run failed. Retries are capped at 4 daily runs a day.

**What counts as a daily run:** the workflow's `run-name` marks the two kinds of manual run that do not count:

- `… for YYYY-MM-DD` is a backfill for another date.
- `… (no digest)` is a corrective run that does not send the newsletter.

**GitHub's own cron stays as a fallback.** It moved to 06:17 UTC. Its `guard` job applies the same rule and skips the run if today's daily run has already succeeded. When the Worker is working, the late fallback does nothing. When the Worker is down, the day behaves as it did before.

**Phone alerts** go through ntfy, to the same topic as the pipeline. They are sent when:

- the GitHub token is missing, rejected or expiring within 14 days;
- a dispatch fails;
- a retry was needed;
- the Worker gives up for the day.

A normal day sends nothing from the Worker; the pipeline sends its own end-of-run notification.

## Setup

1. **Create a fine-grained token** on GitHub:
   - Open this pre-filled page: <https://github.com/settings/personal-access-tokens/new?name=isitsafetotravel-pipeline-trigger&description=Cloudflare+Worker+that+starts+the+daily+data+pipeline&expires_in=none&actions=write>
   - Under **Repository access**, choose **Only select repositories**, then **IsItSafeToTravel**.
   - The only permission is **Actions: Read and write**; Metadata: read is added automatically.
2. **Store it as the Worker secret.** Copy the token, then run from the repository root:
   ```sh
   pbpaste | npx wrangler secret put GITHUB_TOKEN --config workers/pipeline-trigger/wrangler.toml
   ```
3. **Deploy.** Deploy again after any change; the site's deploy workflow does not deploy this Worker.
   ```sh
   npx wrangler deploy --config workers/pipeline-trigger/wrangler.toml
   ```
4. **Read the logs:**
   ```sh
   npx wrangler tail isitsafetotravel-pipeline-trigger
   ```
   They are also in the Cloudflare dashboard (Workers → isitsafetotravel-pipeline-trigger → Logs).

## Tests

```sh
node --import tsx --test workers/pipeline-trigger/__tests__/*.test.ts
```

`npm test` runs them too.
