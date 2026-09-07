/* ============================================================
   DEMO MODE
   ------------------------------------------------------------
   Lets you click through the whole site — sign in, add a date,
   edit it, delete it, watch it appear on the calendar — with no
   Supabase project, no accounts and no email.

   It turns itself on ONLY when both of these are true:
     1. you are on localhost or opening the file directly, and
     2. Supabase is not configured in config.js yet

   So it cannot appear on your live site, and the moment you fill
   in your real Supabase keys it steps aside on its own. Nothing
   to remember to remove before deploying.

   Shows you add live in this browser's local storage. They are
   not sent anywhere.
   ============================================================ */
(function () {
  const isLocal = ["localhost", "127.0.0.1", "::1", ""].includes(location.hostname);
  const alreadyReal = Boolean(SUPABASE.url && SUPABASE.anonKey);
  if (!isLocal || alreadyReal) return;

  const SHOWS_KEY = "pf-demo-shows";
  const SESSION_KEY = "pf-demo-session";

  /* ---------- storage ---------- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* private browsing — demo just won't persist across reloads */
    }
  }

  let shows = load(SHOWS_KEY, null);
  if (!shows) {
    shows = SAMPLE_SHOWS.map((s) => Object.assign({}, s));
    save(SHOWS_KEY, shows);
  }

  const newId = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "demo-" + Date.now() + "-" + Math.random().toString(16).slice(2);

  /* ---------- a stand-in for the supabase query builder ----------
     The real one is thenable at any point in the chain, so this one
     is too: `await client.from(t).select().eq(...).order(...)` works. */
  function builder(table) {
    const b = {
      _op: "select",
      _filters: [],
      _order: null,
      _payload: null,
      _single: false,
      select() { return b; },
      insert(payload) { b._op = "insert"; b._payload = payload; return b; },
      update(payload) { b._op = "update"; b._payload = payload; return b; },
      delete() { b._op = "delete"; return b; },
      eq(col, val) { b._filters.push([col, val]); return b; },
      order(col, opts) { b._order = [col, !opts || opts.ascending !== false]; return b; },
      single() { b._single = true; return b; },
      maybeSingle() { b._single = true; return b; },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => run(table, b))
          .then(resolve, reject);
      },
    };
    return b;
  }

  function matches(row, filters) {
    return filters.every(([col, val]) => String(row[col]) === String(val));
  }

  function run(table, b) {
    // The allowlist: in demo mode whoever signs in is treated as a member,
    // so you can get to the admin screen without setting anything up.
    if (table === "troupe_members") {
      const session = load(SESSION_KEY, null);
      return {
        data: session ? { email: session.user.email, name: "Demo user" } : null,
        error: null,
      };
    }

    if (table !== "shows") return { data: null, error: { message: "unknown table" } };

    if (b._op === "insert") {
      const row = Object.assign(
        { id: newId(), created_at: new Date().toISOString() },
        b._payload
      );
      shows.push(row);
      save(SHOWS_KEY, shows);
      return { data: row, error: null };
    }

    if (b._op === "update") {
      const row = shows.find((s) => matches(s, b._filters));
      if (!row) return { data: null, error: { message: "not found" } };
      Object.assign(row, b._payload);
      save(SHOWS_KEY, shows);
      return { data: row, error: null };
    }

    if (b._op === "delete") {
      shows = shows.filter((s) => !matches(s, b._filters));
      save(SHOWS_KEY, shows);
      return { data: null, error: null };
    }

    let rows = shows.filter((s) => matches(s, b._filters)).map((s) => Object.assign({}, s));
    if (b._order) {
      const [col, asc] = b._order;
      rows.sort((x, y) => (new Date(x[col]) - new Date(y[col])) * (asc ? 1 : -1));
    }
    return b._single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
  }

  /* ---------- fake auth ---------- */
  const listeners = [];
  const auth = {
    async getSession() {
      return { data: { session: load(SESSION_KEY, null) } };
    },
    onAuthStateChange(cb) {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signInWithOtp({ email }) {
      // No email round trip in demo — you are signed in immediately.
      const session = {
        access_token: "demo-token",
        user: { id: "demo-user", email: email },
      };
      save(SESSION_KEY, session);
      listeners.forEach((cb) => cb("SIGNED_IN", session));
      setTimeout(() => location.reload(), 600);
      return { error: null };
    },
    async signOut() {
      try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
      listeners.forEach((cb) => cb("SIGNED_OUT", null));
      return { error: null };
    },
  };

  /* ---------- wire it in ---------- */
  SUPABASE.url = "https://demo.invalid";
  SUPABASE.anonKey = "demo";
  window.supabase = {
    createClient: () => ({ auth: auth, from: (table) => builder(table) }),
  };

  // The /api/* functions only exist on Vercel. Answer them here so the
  // booking form and the "email the troupe" step complete instead of
  // looking broken — clearly flagged as demo, since nothing is sent.
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.startsWith("/api/")) {
      const payload = url.includes("notify-show")
        ? { ok: true, demo: true, sentTo: 3 }
        : { ok: true, demo: true };
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return realFetch(input, init);
  };

  /* ---------- the banner ---------- */
  window.addEventListener("DOMContentLoaded", function () {
    const bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:200;display:flex;gap:14px;" +
      "align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 16px;" +
      "background:#1d1928;border-top:2px solid #FFDA47;color:#b3aec2;" +
      "font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
    bar.innerHTML =
      '<span><b style="color:#FFDA47">Demo mode.</b> Shows are saved in this browser only. ' +
      'Any email signs you in, and no email is ever sent.</span>' +
      '<a href="admin.html" style="color:#f4f1ea">Show manager</a>' +
      '<button type="button" id="demoReset" style="background:none;border:1px solid #2e2840;' +
      'color:#b3aec2;border-radius:999px;padding:5px 12px;font:inherit;cursor:pointer">' +
      'Reset demo data</button>';
    document.body.appendChild(bar);
    document.body.style.paddingBottom = "64px";

    document.getElementById("demoReset").addEventListener("click", function () {
      try {
        localStorage.removeItem(SHOWS_KEY);
        localStorage.removeItem(SESSION_KEY);
      } catch (_) {}
      location.reload();
    });
  });

  console.info(
    "%cDemo mode active.%c Fill in SUPABASE in assets/js/config.js to switch to the real backend.",
    "color:#FFDA47;font-weight:bold", "color:inherit"
  );
})();
