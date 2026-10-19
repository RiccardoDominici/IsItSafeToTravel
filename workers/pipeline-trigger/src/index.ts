/**
 * Cloudflare Worker entry: cron triggers only, no HTTP route (workers_dev is
 * off in wrangler.toml). See trigger.ts for what each slot does.
 */
import { runSlot, type Env } from './trigger';

// Minimal shapes of the Workers runtime objects we use, declared locally so the
// repo's `astro check` (which type-checks every .ts file) needs no extra
// @cloudflare/workers-types dependency.
interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
}
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  scheduled(controller: ScheduledControllerLike, env: Env, ctx: ExecutionContextLike): void {
    ctx.waitUntil(
      runSlot(env, controller.cron, controller.scheduledTime).then((result) => {
        console.log(`[pipeline-trigger] ${result.kind} → ${result.outcome}: ${result.detail}`);
      }),
    );
  },
};
