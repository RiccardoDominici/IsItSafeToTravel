/**
 * ntfy.sh push for pipeline alerts (same service the daily workflow uses for its
 * status push). The topic is never hard-coded here: callers read NTFY_TOPIC, which the
 * workflow sets and local runs and tests leave unset, so nothing is sent by accident.
 */

export const NTFY_BASE_URL = 'https://ntfy.sh';
const NTFY_TIMEOUT_MS = 10_000;

export interface NtfyMessage {
  /** Sent as an HTTP header, so it must be ASCII. */
  title: string;
  /** Plain UTF-8 body. */
  body: string;
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';
  /** ntfy tag shortcodes (rendered as emoji), e.g. "warning". */
  tags: string[];
}

/**
 * The topic from the environment, or null when it is unset or blank. A null result
 * means "do not push". Local runs and tests have no NTFY_TOPIC.
 */
export function ntfyTopicFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const topic = env.NTFY_TOPIC?.trim();
  return topic ? topic : null;
}

/**
 * POST one message to ntfy. Never throws: a failed push is logged and reported as
 * false, so an alert can never fail the pipeline.
 */
export async function pushNtfy(
  topic: string,
  message: NtfyMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${NTFY_BASE_URL}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        Title: message.title,
        Priority: message.priority,
        Tags: message.tags.join(','),
      },
      body: message.body,
      signal: AbortSignal.timeout(NTFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[NTFY] push "${message.title}" failed: HTTP ${response.status} (non-blocking)`);
      return false;
    }
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[NTFY] push "${message.title}" failed (non-blocking): ${msg}`);
    return false;
  }
}
