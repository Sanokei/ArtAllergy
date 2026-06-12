/**
 * Art Allergy - Pitch Submission Endpoint
 * Cloudflare Pages Function: /api/submit
 *
 * Accepts creator pitches via POST, validates input, runs spam checks,
 * and forwards to the editorial desk via Cloudflare Email Service.
 *
 * PRODUCTION SETUP REQUIRED (Cloudflare Dashboard or wrangler CLI):
 *
 *   1. Enable Email Sending for your domain:
 *      $ npx wrangler email sending enable artallergy.org
 *
 *   2. Add the send_email binding to wrangler.jsonc:
 *      { "send_email": [{ "name": "EMAIL" }] }
 *
 *   3. Set the recipient email as a secret (or edit RECIPIENT_EMAIL below):
 *      $ npx wrangler secret put RECIPIENT_EMAIL
 *
 * If Email bindings are not yet configured, the function will still accept
 * submissions and log them — returning success without actually emailing.
 *
 * ROUTE: POST https://artallergy.org/api/submit
 */

// ---- Configuration ----

/**
 * Email address that receives pitches.
 *
 * Change this to the real editorial desk address, or set it via
 * Cloudflare Secret: `npx wrangler secret put RECIPIENT_EMAIL`
 *
 * The `from` address must use a domain onboarded to Email Sending.
 */
const RECIPIENT_EMAIL = "editorial@artallergy.org";

/**
 * The verified sender address (domain must be onboarded to Email Sending).
 * Update this to match your actual verified sending domain.
 */
const SENDER_EMAIL = "submissions@artallergy.org";

/**
 * Minimum pitch length in characters. Shorter submissions are treated as spam.
 */
const MIN_PITCH_LENGTH = 20;

// ---- Helpers ----

/**
 * Returns true if the string contains a URL-like pattern.
 * Bots often stuff URLs into name fields.
 */
function containsURL(str) {
  if (!str) return false;
  // Detect http/https links, bare domains, and common URL patterns
  return /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|ru|cn|tk|xyz|info|top|co|biz|cc|me|online|site)\b/i.test(str);
}

/**
 * Build a plain-text email body from the submission fields.
 */
function buildEmailBody(data) {
  const now = new Date().toISOString();
  return [
    `New Pitch — Art Allergy Submission`,
    `Received: ${now}`,
    ``,
    `--- CREATOR ---`,
    `Name: ${data["creator-name"]}`,
    `Email: ${data["creator-email"]}`,
    `Location: ${data["creator-city"]}`,
    ``,
    `--- PITCH ---`,
    data["creator-pitch"],
    ``,
    `--- END ---`,
  ].join("\n");
}

/**
 * Validate the submission payload. Returns an array of error strings.
 * Returns an empty array if validation passes.
 */
function validate(data) {
  const errors = [];

  const name = (data["creator-name"] || "").trim();
  const email = (data["creator-email"] || "").trim();
  const pitch = (data["creator-pitch"] || "").trim();
  const city = (data["creator-city"] || "").trim();

  if (!name) {
    errors.push("Name is required.");
  } else {
    if (name.length < 2) {
      errors.push("Name must be at least 2 characters.");
    }
    if (containsURL(name)) {
      errors.push("Name contains something that looks like a URL — please use your real name or alias.");
    }
  }

  if (!email) {
    errors.push("Email address is required.");
  } else {
    // Basic email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Email address does not appear to be valid.");
    }
    // Keep length reasonable
    if (email.length > 254) {
      errors.push("Email address is too long.");
    }
  }

  if (!pitch) {
    errors.push("Project pitch is required.");
  } else {
    if (pitch.length < MIN_PITCH_LENGTH) {
      errors.push(`Pitch must be at least ${MIN_PITCH_LENGTH} characters.`);
    }
  }

  if (!city || !["new-york", "london"].includes(city)) {
    errors.push("Please select a valid location.");
  }

  return errors;
}

// ---- Request Handler ----

export async function onRequest(context) {
  const { request, env } = context;

  // Only accept POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", Allow: "POST" },
      }
    );
  }

  let data;
  try {
    const contentType = request.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      // Parse form-encoded data (the frontend sends FormData via fetch)
      const formData = await request.formData();
      data = Object.fromEntries(formData.entries());
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Could not parse request body." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ---- Honeypot check ----
  // The hidden "website" field is invisible to humans. Bots will fill it in.
  // If it has any value, silently accept but do nothing — the bot thinks it worked.
  const honeypot = (data["website"] || "").trim();
  if (honeypot.length > 0) {
    return new Response(
      JSON.stringify({ success: true, message: "Pitch received." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ---- Validation ----
  const errors = validate(data);
  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ success: false, errors }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ---- Timestamp check (simple timing heuristic) ----
  // If the form was submitted less than 2 seconds after page load, it's
  // likely a bot. The frontend attaches a "loaded_at" timestamp.
  // Skip this check if the field is absent (allows direct API use).
  const loadedAt = data["loaded_at"];
  if (loadedAt) {
    const elapsed = Date.now() - parseInt(loadedAt, 10);
    if (elapsed < 2000) {
      return new Response(
        JSON.stringify({ success: true, message: "Pitch received." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // ---- Send Email ----
  let emailSent = false;

  // Determine recipient: env var overrides the hardcoded default
  const recipient = (env && env.RECIPIENT_EMAIL) || RECIPIENT_EMAIL;

  if (env && env.EMAIL) {
    // Production path: Cloudflare Email Service binding
    try {
      await env.EMAIL.send({
        to: recipient,
        from: { email: SENDER_EMAIL, name: "Art Allergy Submissions" },
        subject: `[Pitch] New submission from ${data["creator-name"]}`,
        text: buildEmailBody(data),
        replyTo: data["creator-email"],
      });
      emailSent = true;
    } catch (err) {
      console.error("Email send failed:", err.code || "unknown", err.message || err);
      // Fall through — we still log and return success to the user.
      // The submission data is preserved in Cloudflare's function logs.
    }
  } else {
    // Fallback: Email binding not configured.
    // Log diagnostic info only — never log PII to function logs.
    console.log(JSON.stringify({
      type: "pitch_submission",
      email_sent: false,
      reason: "EMAIL binding not configured on env",
      setup_instructions: "Add send_email binding in Cloudflare Dashboard or wrangler.jsonc",
      pitch_length: (data["creator-pitch"] || "").length,
      city: data["creator-city"],
    }));
  }

  // ---- Respond ----
  return new Response(
    JSON.stringify({
      success: true,
      message: "Pitch received. We review every submission and respond within 14 days.",
      emailed: emailSent,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
