// functions/lib/email.ts — Resend adapter (fetch-only; runs on Workers edge AND Node 22).
// Imported by functions/api/subscribe.ts (edge) and by scripts/send-daily-digest.ts (Node/tsx),
// via ../functions/lib/email — tsx resolves the .ts directly. Key is passed as an argument so
// this module has no runtime coupling to either caller's env access pattern.

export interface EmailMessage {
  from?: string; // default 'IsItSafeToTravel <updates@isitsafetotravel.org>'
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>; // e.g. List-Unsubscribe, List-Unsubscribe-Post
}

const DEFAULT_FROM = 'IsItSafeToTravel <updates@isitsafetotravel.org>';

/** Send one email. Throws on non-2xx so callers can decide (Function -> 503, script -> log+count). */
export async function sendEmail(apiKey: string, m: EmailMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: m.from ?? DEFAULT_FROM,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      headers: m.headers,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

/** Batch send (Resend /emails/batch, max 100/call). Caller chunks. Returns sent count. */
export async function sendBatch(apiKey: string, msgs: EmailMessage[]): Promise<number> {
  if (msgs.length === 0) return 0;
  const payload = msgs.map((m) => ({
    from: m.from ?? DEFAULT_FROM,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    headers: m.headers,
  }));
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend batch ${res.status}: ${await res.text()}`);
  return msgs.length;
}
