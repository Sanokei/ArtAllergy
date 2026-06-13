/**
 * Art Allergy — Email Relay Worker
 *
 * Called via service binding from the Pages Function (not publicly routable).
 * Still applies defense-in-depth: shared-secret auth, recipient allowlist,
 * and replyTo sanitization.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Shared-secret auth — only the Pages Function knows this
    const secret = request.headers.get('X-Relay-Secret');
    if (!secret || secret !== env.SHARED_RELAY_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only allow sending to the editorial desk
    const allowedRecipient = env.RECIPIENT_EMAIL || 'editorial@artallergy.com';

    try {
      const payload = await request.json();
      const { subject, text } = payload;

      // Sanitize all fields against header injection
      const safeSubject = (subject || '').replace(/[\r\n]/g, '').trim();
      const safeText = (text || '').replace(/[\r\n]/g, '');
      let replyTo = '';
      if (payload.replyTo) {
        replyTo = payload.replyTo.replace(/[\r\n]/g, '').trim();
        if (!EMAIL_RE.test(replyTo)) replyTo = '';
      }

      if (!safeSubject || !safeText) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await env.EMAIL.send({
        to: allowedRecipient,
        from: { email: 'submissions@artallergy.com', name: 'Art Allergy Submissions' },
        subject: safeSubject,
        text: safeText,
        ...(replyTo ? { replyTo } : {}),
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Email send failed',
        code: err.code || 'unknown',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
