const TYPE_LABELS: Record<string, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug Report',
  data: 'Data Issue',
  compliment: 'Compliment',
  other: 'Other',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();

    if (!body.message || !body.name || !body.email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.message.length > 5000 || body.name.length > 200 || body.email.length > 200) {
      return new Response(JSON.stringify({ error: 'Input too long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiKey = context.env?.RESEND_API_KEY;
    const recipientEmail = context.env?.FEEDBACK_EMAIL;

    if (!apiKey || !recipientEmail) {
      const missing = [];
      if (!apiKey) missing.push('RESEND_API_KEY');
      if (!recipientEmail) missing.push('FEEDBACK_EMAIL');
      return new Response(JSON.stringify({ error: 'Server configuration error', missing }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const typeLabel = TYPE_LABELS[body.type] || body.type;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #c96b4f; padding-bottom: 10px;">
          New Feedback from IsItSafeToTravel
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 120px;">Name</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">${escapeHtml(body.name)}</td>
          </tr>
          <tr style="background: #f9f6f3;">
            <td style="padding: 8px 12px; font-weight: 600; color: #555;">Email</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">
              <a href="mailto:${escapeHtml(body.email)}" style="color: #c96b4f;">${escapeHtml(body.email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #555;">Type</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">${escapeHtml(typeLabel)}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f9f6f3; border-radius: 8px; border-left: 4px solid #c96b4f;">
          <p style="margin: 0; color: #555; font-weight: 600; font-size: 14px;">Message</p>
          <p style="margin: 8px 0 0; color: #1a1a1a; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(body.message)}</p>
        </div>
        <p style="margin-top: 24px; color: #999; font-size: 12px;">
          Sent via IsItSafeToTravel feedback form &middot; ${new Date().toISOString()}
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IsItSafeToTravel <feedback@isitsafetotravel.org>',
        to: [recipientEmail],
        reply_to: body.email,
        subject: `[Feedback] ${typeLabel} from ${body.name}`,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(JSON.stringify({ error: 'Failed to send email', detail: errorText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
