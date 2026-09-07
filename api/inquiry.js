/**
 * POST /api/inquiry
 *
 * The booking form on book.html. Emails the inquiry to the troupe with the
 * sender set as reply-to, so hitting Reply goes straight back to them.
 *
 * Environment variables:
 *   RESEND_API_KEY     from resend.com
 *   MAIL_FROM          e.g. "Troupe Site <shows@yourdomain.com>"
 *   BOOKING_EMAILS     comma separated. Falls back to TROUPE_EMAILS.
 *   TURNSTILE_SECRET   optional. Set it (plus the site key in config.js) and
 *                      every submission must carry a valid Cloudflare
 *                      Turnstile token. This is the real defence against
 *                      form spam; leave it unset and the endpoint is open.
 */

// Best-effort flood control. Serverless containers are recycled and requests
// spread across them, so this stops a naive script hammering one instance --
// it is NOT a substitute for Turnstile.
const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooManyFrom(ip) {
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear(); // never let the map grow unbounded
  return recent.length > MAX_PER_WINDOW;
}

async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // not configured, nothing to check
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const out = await r.json();
    return Boolean(out && out.success);
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const { RESEND_API_KEY, MAIL_FROM, BOOKING_EMAILS, TROUPE_EMAILS } = process.env;
  const recipients = (BOOKING_EMAILS || TROUPE_EMAILS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (!RESEND_API_KEY || !MAIL_FROM || !recipients.length) {
    return res.status(500).send("Server is missing email configuration");
  }

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (raw.length > 20000) return res.status(413).send("That message is too long");

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};

  // Honeypot — bots fill hidden fields, people do not. Answer 200 so they
  // cannot tell the difference between being filtered and getting through.
  if (body.website) return res.status(200).json({ ok: true });

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!(await turnstileOk(body.turnstileToken, ip))) {
    return res.status(403).send("Could not verify you are human. Please reload and try again.");
  }

  if (tooManyFrom(ip)) {
    return res.status(429).send("That is a lot of messages. Please try again a bit later.");
  }

  // Strip control characters. Newlines stay only in the message body --
  // a name or subject containing them is either a mistake or an attempt at
  // header injection.
  const clean = (v, max, keepNewlines) =>
    String(v == null ? "" : v)
      .replace(keepNewlines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, max);
  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const message = clean(body.message, 5000, true);

  if (!name || !email || !message) {
    return res.status(400).send("Name, email and details are required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).send("That email address does not look right");
  }

  const fields = {
    Name: name,
    Email: email,
    "Company / event": clean(body.org, 200),
    Phone: clean(body.phone, 60),
    "Event type": clean(body.kind, 120),
    "Date in mind": clean(body.event_date, 40),
  };

  const rows = Object.entries(fields)
    .filter(([, v]) => v)
    .map(
      ([k, v]) => `<tr>
        <td style="padding:6px 14px 6px 0;color:#8b8698;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td>
        <td style="padding:6px 0;color:#1a1726;font-size:15px">${esc(v)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="background:#0c0a10;border-radius:14px 14px 0 0;padding:22px 26px">
      <div style="color:#ffc24b;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700">Booking inquiry</div>
      <div style="color:#f4f1ea;font-size:22px;font-weight:800;margin-top:6px">${esc(name)}</div>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 14px 14px;padding:26px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #ece8f0;margin-bottom:18px">${rows}</table>
      <div style="white-space:pre-wrap;color:#1a1726;font-size:15px;line-height:1.6">${esc(message)}</div>
      <p style="margin:22px 0 0;font-size:13px;color:#8b8698">Just hit reply — it goes to ${esc(email)}.</p>
    </td></tr>
  </table>
</body></html>`;

  const text = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n") + `\n\n${message}`;

  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: recipients,
      reply_to: email,
      subject: `Booking inquiry — ${name}${fields["Company / event"] ? " (" + fields["Company / event"] + ")" : ""}`,
      html,
      text,
    }),
  });

  if (!mail.ok) {
    const detail = await mail.text();
    return res.status(502).send(`Email provider said: ${detail.slice(0, 300)}`);
  }

  return res.status(200).json({ ok: true });
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (_) { return {}; }
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
