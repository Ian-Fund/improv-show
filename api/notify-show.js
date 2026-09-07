/**
 * POST /api/notify-show
 *
 * Called by the admin page right after a new date is saved. It:
 *   1. verifies the caller's Supabase session
 *   2. confirms they are on the troupe allowlist
 *   3. re-reads the show from the database (so nothing is taken on trust)
 *   4. emails the troupe a summary with an "Add to Google Calendar" link
 *
 * Runs on Vercel's Node runtime. No npm packages — Node 18+ has fetch built in.
 *
 * Environment variables (set these in the Vercel dashboard):
 *   SUPABASE_URL         https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY    the anon/public key
 *   RESEND_API_KEY       from resend.com
 *   MAIL_FROM            e.g. "Troupe Calendar <shows@yourdomain.com>"
 *   TROUPE_EMAILS        comma separated list of who gets notified
 *   SITE_NAME            optional, e.g. "PF". Used in the email subject.
 */

const TIMEZONE = process.env.SITE_TIMEZONE || "America/Chicago";
// Keep in step with SITE.defaultShowMinutes in assets/js/config.js.
const DEFAULT_MINUTES = Number(process.env.SHOW_DEFAULT_MINUTES) || 60;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    RESEND_API_KEY,
    MAIL_FROM,
    TROUPE_EMAILS,
  } = process.env;

  const missing = Object.entries({
    SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY, MAIL_FROM, TROUPE_EMAILS,
  }).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    return res.status(500).send(`Server is missing env vars: ${missing.join(", ")}`);
  }

  // ---- 1. who is asking -------------------------------------------------
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).send("Not signed in");

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).send("Session is not valid");
  const user = await userRes.json();
  const email = (user && user.email) || "";
  if (!email) return res.status(401).send("Session has no email");

  // ---- 2. are they on the list -----------------------------------------
  // Read through the caller's own token, so row level security does the
  // checking for us. No service role key needs to live on this server.
  const memberRes = await fetch(
    `${SUPABASE_URL}/rest/v1/troupe_members?email=eq.${encodeURIComponent(email)}&select=email`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const members = memberRes.ok ? await memberRes.json() : [];
  if (!Array.isArray(members) || members.length === 0) {
    return res.status(403).send("Not on the troupe list");
  }

  // ---- 3. read the show back from the database -------------------------
  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const showId = body.showId;
  if (!showId) return res.status(400).send("No showId");

  const showRes = await fetch(
    `${SUPABASE_URL}/rest/v1/shows?id=eq.${encodeURIComponent(showId)}&select=*`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const rows = showRes.ok ? await showRes.json() : [];
  const show = Array.isArray(rows) ? rows[0] : null;
  if (!show) return res.status(404).send("Show not found");

  // ---- 4. send it -------------------------------------------------------
  // Read the name from the server's own config rather than the request body,
  // so nothing a client sends can shape what lands in the troupe's inboxes.
  const troupeName = String(process.env.SITE_NAME || "The troupe").slice(0, 120);
  const to = TROUPE_EMAILS.split(",").map((s) => s.trim()).filter(Boolean);
  const calendarUrl = googleCalendarUrl(show, troupeName);

  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to,
      reply_to: email,
      subject: `New date: ${show.title} — ${formatDate(show.starts_at)}`,
      html: emailHtml({ show, calendarUrl, addedBy: email, troupeName }),
      text: emailText({ show, calendarUrl, addedBy: email, troupeName }),
    }),
  });

  if (!mail.ok) {
    const detail = await mail.text();
    return res.status(502).send(`Email provider said: ${detail.slice(0, 300)}`);
  }

  return res.status(200).json({ ok: true, sentTo: to.length });
};

/* ============================================================
   helpers
   ============================================================ */

function safeJson(s) {
  try { return JSON.parse(s); } catch (_) { return {}; }
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function googleCalendarUrl(show, troupeName) {
  const start = new Date(show.starts_at);
  const end = show.ends_at
    ? new Date(show.ends_at)
    : new Date(start.getTime() + DEFAULT_MINUTES * 60 * 1000);

  const where = [show.venue, show.address, show.city].filter(Boolean).join(", ");
  const details = [
    show.description,
    show.lineup ? `Lineup: ${show.lineup}` : "",
    show.parking ? `Parking: ${show.parking}` : "",
    show.price ? `Tickets: ${show.price}` : "",
    show.ticket_url,
  ].filter(Boolean).join("\n\n");

  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${show.title} — ${troupeName}`,
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  if (where) p.set("location", where);
  if (details) p.set("details", details);

  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: TIMEZONE,
  });
}

function formatDateTime(show) {
  const opts = {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: TIMEZONE,
  };
  let out = new Date(show.starts_at).toLocaleString("en-US", opts);
  if (show.ends_at) {
    out += " – " + new Date(show.ends_at).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: TIMEZONE,
    });
  }
  return out;
}

function emailText({ show, calendarUrl, addedBy, troupeName }) {
  const where = [show.venue, show.address, show.city].filter(Boolean).join(", ");
  return [
    `New date on the ${troupeName} calendar`,
    "",
    show.title,
    formatDateTime(show),
    where,
    show.price ? `Tickets: ${show.price}` : "",
    show.ticket_url || "",
    show.lineup ? `Lineup: ${show.lineup}` : "",
    show.parking ? `Parking: ${show.parking}` : "",
    show.description || "",
    "",
    `Add to Google Calendar: ${calendarUrl}`,
    "",
    `Added by ${addedBy}.`,
    show.is_published ? "" : "Heads up: this one is hidden from the public calendar for now.",
  ].filter(Boolean).join("\n");
}

function emailHtml({ show, calendarUrl, addedBy, troupeName }) {
  const where = [show.venue, show.address, show.city].filter(Boolean).join(", ");
  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:6px 14px 6px 0;color:#8b8698;font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
           <td style="padding:6px 0;color:#1a1726;font-size:15px">${esc(value)}</td>
         </tr>`
      : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="background:#0c0a10;border-radius:14px 14px 0 0;padding:22px 26px">
      <div style="color:#ffc24b;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700">New date added</div>
      <div style="color:#f4f1ea;font-size:22px;font-weight:800;margin-top:6px">${esc(troupeName)}</div>
    </td></tr>

    <tr><td style="background:#ffffff;padding:26px">
      <div style="font-size:21px;font-weight:700;color:#0c0a10;margin-bottom:4px">${esc(show.title)}</div>
      <div style="font-size:15px;color:#5c5670;margin-bottom:18px">${esc(formatDateTime(show))}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #ece8f0;border-bottom:1px solid #ece8f0;margin-bottom:20px">
        ${row("Where", where)}
        ${row("Tickets", show.price)}
        ${row("Lineup", show.lineup)}
        ${row("Parking", show.parking)}
        ${row("Notes", show.description)}
      </table>

      <a href="${esc(calendarUrl)}"
         style="display:inline-block;background:#ffc24b;color:#241a00;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px">
        Add to Google Calendar
      </a>

      ${show.ticket_url
        ? `<a href="${esc(show.ticket_url)}" style="display:inline-block;margin-left:10px;color:#5c5670;font-size:14px;padding:13px 4px">Ticket page</a>`
        : ""}

      ${show.is_published
        ? ""
        : `<p style="margin:20px 0 0;font-size:13px;color:#9a5b00;background:#fff6e0;padding:10px 12px;border-radius:8px">
             This date is hidden from the public calendar for now.
           </p>`}
    </td></tr>

    <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid #ece8f0;padding:16px 26px;color:#8b8698;font-size:12px">
      Added by ${esc(addedBy)}.
    </td></tr>
  </table>
</body></html>`;
}
