/* Shared helpers. Loaded on every page, after config.js. */

/* ---------- escaping ---------- */
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------- URL safety ----------
   Escaping quotes stops an attacker breaking out of an href attribute, but it
   does NOT stop `javascript:` or `data:` URLs, which execute on click. Show
   links are written by signed-in troupe members, so this guards against a
   compromised member account rather than a stranger — cheap insurance either
   way. Anything that is not a plain absolute http(s) URL is dropped. */
function safeUrl(url, allowMailto) {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return "";
  try {
    const u = new URL(raw); // no base: relative strings are rejected outright
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    if (allowMailto && u.protocol === "mailto:") return u.href;
    return "";
  } catch (_) {
    return "";
  }
}

/* ---------- supabase ---------- */
let _client = null;
function supabaseConfigured() {
  return Boolean(SUPABASE.url && SUPABASE.anonKey);
}
function db() {
  if (!supabaseConfigured()) return null;
  if (!_client) {
    if (!window.supabase || !window.supabase.createClient) {
      console.error("supabase-js did not load from the CDN.");
      return null;
    }
    _client = window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey);
  }
  return _client;
}

/* ---------- dates ---------- */
// How long a show is assumed to run when no end time was entered.
function defaultRunMs() {
  return (SITE.defaultShowMinutes || 60) * 60 * 1000;
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function d(show) { return new Date(show.starts_at); }

function timeStr(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ampm}` : `${h}${ampm}`;
}

function dateLine(show) {
  const s = d(show);
  return `${DAYS[s.getDay()]}, ${MONTHS[s.getMonth()]} ${s.getDate()}`;
}

function timeLine(show) {
  const s = d(show);
  let out = timeStr(s);
  if (show.ends_at) {
    const e = new Date(show.ends_at);
    if (e > s) out += `–${timeStr(e)}`;
  }
  return out;
}

/* ---------- Google Calendar link ---------- */
function gcalStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function gcalLink(show) {
  const start = new Date(show.starts_at);
  const end = show.ends_at
    ? new Date(show.ends_at)
    : new Date(start.getTime() + defaultRunMs());

  const where = [show.venue, show.address, show.city].filter(Boolean).join(", ");
  const parking = parkingFor(show);
  const details = [
    show.description,
    show.lineup ? `Lineup: ${show.lineup}` : "",
    parking ? `Parking: ${parking}` : "",
    show.price ? `Tickets: ${show.price}` : "",
    show.ticket_url,
  ].filter(Boolean).join("\n\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${show.title} — ${SITE.troupeName}`,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
  });
  if (where) params.set("location", where);
  if (details) params.set("details", details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ---------- fetching shows ---------- */
async function fetchShows() {
  const client = db();
  let rows;

  if (!client) {
    rows = SAMPLE_SHOWS.slice();
  } else {
    // Explicit column list: visitors get exactly the fields the page renders,
    // and nothing internal (created_by is not readable by anon anyway).
    const { data, error } = await client
      .from("shows")
      .select(
        "id,title,starts_at,ends_at,venue,address,city,price,ticket_url,description,lineup,parking"
      )
      .eq("is_published", true)
      .order("starts_at", { ascending: true });
    if (error) throw error;
    rows = data || [];
  }

  // "Upcoming" means it has not ended yet — a show still counts as upcoming
  // while it is happening.
  const now = Date.now();
  const endOf = (s) =>
    new Date(s.ends_at || new Date(s.starts_at).getTime() + defaultRunMs()).getTime();

  const upcoming = rows
    .filter((s) => endOf(s) >= now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const past = rows
    .filter((s) => endOf(s) < now)
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));

  return { upcoming, past };
}

/* ---------- venues ---------- */
function venueByName(name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  return (SITE.venues || []).find((v) => v.name.trim().toLowerCase() === wanted) || null;
}

// Prefer what was saved with the show — a venue's parking situation can
// change, and old dates should keep the note that was true at the time.
// Fall back to the venue list for shows saved before parking existed.
function parkingFor(show) {
  if (show.parking && show.parking.trim()) return show.parking.trim();
  const v = venueByName(show.venue);
  return v && v.parking ? v.parking : "";
}

/* ---------- chrome ---------- */
function fullTitle() {
  return SITE.showName && SITE.showName !== SITE.troupeName
    ? `${SITE.troupeName} — ${SITE.showName}`
    : SITE.troupeName;
}

// Short names (like "PF") are the mark. Longer ones get initialled.
function monogramText() {
  const n = SITE.troupeName.trim();
  if (n.replace(/\s/g, "").length <= 3) return n.toUpperCase();
  return n.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function renderHeader(active) {
  const links = [
    ["index.html", "Shows"],
    ["troupe.html", "The Troupe"],
    ["book.html", "Book Us"],
  ];
  const nav = links
    .map(
      ([href, label]) =>
        `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`
    )
    .join("");

  document.getElementById("site-header").innerHTML = `
    <div class="wrap">
      <a class="wordmark" href="index.html" aria-label="${esc(SITE.troupeName)} home">
        <span class="monogram">${esc(monogramText())}</span>
        <span class="locale">${esc(SITE.showName || SITE.city)}</span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-label="Menu">☰</button>
      <nav class="nav" id="navLinks">
        ${nav}
        <a class="btn btn-primary btn-sm" href="index.html#upcoming">Tickets</a>
      </nav>
    </div>`;

  const toggle = document.getElementById("navToggle");
  const navEl = document.getElementById("navLinks");
  const mobile = () => window.matchMedia("(max-width: 760px)").matches;
  const sync = () => {
    if (mobile()) navEl.hidden = toggle.getAttribute("aria-expanded") !== "true";
    else navEl.hidden = false;
  };
  toggle.addEventListener("click", () => {
    toggle.setAttribute(
      "aria-expanded",
      toggle.getAttribute("aria-expanded") === "true" ? "false" : "true"
    );
    sync();
  });
  window.addEventListener("resize", sync);
  sync();
}

function renderFooter() {
  const social = Object.entries(SITE.social)
    .map(([name, url]) => [name, safeUrl(url)])
    .filter(([, url]) => url)
    .map(
      ([name, url]) =>
        `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name[0].toUpperCase() + name.slice(1)}</a>`
    )
    .join("");

  document.getElementById("site-footer").innerHTML = `
    <div class="wrap">
      <div>
        <div style="color:var(--paper-dim);font-weight:700;">${esc(SITE.troupeName)}</div>
        <div>${esc(SITE.city)} · <a href="mailto:${esc(SITE.generalEmail)}">${esc(SITE.generalEmail)}</a></div>
      </div>
      <div class="footer-links">
        ${social}
        <a href="book.html">Book us</a>
        <a href="admin.html">Troupe login</a>
      </div>
    </div>`;
}

function setPageTitle(page) {
  document.title = page ? `${page} · ${fullTitle()}` : fullTitle();
}
