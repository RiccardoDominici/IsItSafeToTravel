/**
 * Phone push via ntfy.sh, the same channel the pipeline workflow uses.
 * Published as JSON (not via headers) so titles may carry non-ASCII text.
 * Never throws: a failed notification must not hide the original problem in
 * the Worker logs.
 */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Notice {
  title: string;
  message: string;
  /** ntfy priority: 3 = default, 4 = high. */
  priority?: 3 | 4;
  tags?: string[];
}

export async function notify(topic: string | undefined, notice: Notice, fetchImpl: FetchLike = fetch): Promise<void> {
  if (!topic) {
    console.log(`[notify] no NTFY_TOPIC, not sent: ${notice.title}`);
    return;
  }
  try {
    const res = await fetchImpl('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, priority: 3, tags: [], ...notice }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[notify] ntfy answered HTTP ${res.status}`);
  } catch (err) {
    console.error(`[notify] ntfy unreachable: ${String(err)}`);
  }
}
