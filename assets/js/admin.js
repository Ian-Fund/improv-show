/* Troupe login + show manager. */

setPageTitle("Troupe login");
renderHeader(null);
renderFooter();

const views = {
  loading: document.getElementById("loadingView"),
  setup:   document.getElementById("setupView"),
  signin:  document.getElementById("signinView"),
  denied:  document.getElementById("deniedView"),
  admin:   document.getElementById("adminView"),
};
function show(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
}

const adminOk   = document.getElementById("adminOk");
const adminErr  = document.getElementById("adminErr");
const adminInfo = document.getElementById("adminInfo");

function flash(el, html) {
  [adminOk, adminErr, adminInfo].forEach((n) => (n.hidden = true));
  el.innerHTML = html;
  el.hidden = false;
}

/* ============================================================
   Boot
   ============================================================ */
let client = null;
let session = null;

(async function boot() {
  if (!supabaseConfigured()) return show("setup");

  client = db();
  if (!client) {
    return flash(adminErr, "Could not load Supabase. Check your connection and refresh.");
  }

  const { data } = await client.auth.getSession();
  session = data.session;

  client.auth.onAuthStateChange((_event, s) => {
    const wasSignedIn = Boolean(session);
    session = s;
    if (!s && wasSignedIn) show("signin");
  });

  if (!session) return show("signin");
  await enterAdmin();
})();

/* ============================================================
   Sign in
   ============================================================ */
document.getElementById("signinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const btn = document.getElementById("signinBtn");
  const sent = document.getElementById("linkSent");
  const err = document.getElementById("signinErr");
  sent.hidden = true;
  err.hidden = true;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending';
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    sent.textContent = `Link sent to ${email}. Open it on this device and you are in.`;
    sent.hidden = false;
  } catch (ex) {
    err.textContent = ex.message || "Could not send the link. Try again.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Email me a link";
  }
});

async function signOut() {
  await client.auth.signOut();
  session = null;
  show("signin");
}
document.getElementById("signOutBtn").addEventListener("click", signOut);
document.getElementById("deniedSignOut").addEventListener("click", signOut);

/* ============================================================
   Membership check + list
   ============================================================ */
async function enterAdmin() {
  const email = session.user.email;

  const { data: member, error } = await client
    .from("troupe_members")
    .select("email, name")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    show("admin");
    return flash(adminErr, `Could not check the troupe list: ${esc(error.message)}`);
  }

  if (!member) {
    document.getElementById("deniedWho").textContent =
      `You are signed in as ${email}, but that address is not on the troupe list.`;
    return show("denied");
  }

  document.getElementById("whoami").textContent = member.name || email;
  show("admin");
  await loadList();
}

let allShows = [];

async function loadList() {
  const list = document.getElementById("adminList");
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

  const { data, error } = await client
    .from("shows")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    list.innerHTML = "";
    return flash(adminErr, `Could not load shows: ${esc(error.message)}`);
  }

  allShows = data || [];
  if (!allShows.length) {
    list.innerHTML =
      '<div class="empty">No dates yet. Hit “Add a date” to put the first one up.</div>';
    return;
  }

  const now = Date.now();
  list.innerHTML = allShows
    .map((s) => {
      const upcoming = new Date(s.starts_at).getTime() >= now;
      return `
        <div class="admin-row">
          <div class="when">
            ${esc(dateLine(s))}<br>
            <span class="muted small">${esc(timeLine(s))} · ${d(s).getFullYear()}</span>
          </div>
          <div>
            <strong>${esc(s.title)}</strong>
            ${s.is_published ? '<span class="pill live">Live</span>' : '<span class="pill">Hidden</span>'}
            <div class="muted small">${esc([s.venue, s.city].filter(Boolean).join(", "))}</div>
          </div>
          <div class="acts">
            ${upcoming
              ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${esc(gcalLink(s))}">Calendar</a>`
              : ""}
            <button class="btn btn-ghost btn-sm" data-edit="${esc(s.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del="${esc(s.id)}">Delete</button>
          </div>
        </div>`;
    })
    .join("");
}

document.getElementById("adminList").addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  if (editId) openForm(allShows.find((s) => String(s.id) === editId));
  if (delId) await removeShow(delId);
});

/* ============================================================
   Add / edit form
   ============================================================ */
const modal = document.getElementById("showModal");
const formErr = document.getElementById("formErr");

function pad(n) { return String(n).padStart(2, "0"); }

/* ---- the venue picker ----
   The regular rooms come from SITE.venues in config.js. Picking one fills
   the fields below rather than hiding them, so a one-off tweak (a different
   door, a lot that closed) is still just typing over what it filled in. */
const OTHER = "__other__";
const venuePick = document.getElementById("f_venuePick");

venuePick.innerHTML =
  (SITE.venues || [])
    .map((v, i) => `<option value="${i}">${esc(v.name)}</option>`)
    .join("") + `<option value="${OTHER}">Somewhere else…</option>`;

document.getElementById("endHint").textContent =
  `Blank means ${SITE.defaultShowMinutes || 60} minutes.`;

function applyVenue(index) {
  const v = (SITE.venues || [])[index];
  const g = (id) => document.getElementById(id);
  if (!v) {
    g("f_venue").value = "";
    g("f_address").value = "";
    g("f_city").value = SITE.city || "";
    g("f_parking").value = "";
    g("f_venue").focus();
    return;
  }
  g("f_venue").value = v.name || "";
  g("f_address").value = v.address || "";
  g("f_city").value = v.city || SITE.city || "";
  g("f_parking").value = v.parking || "";
}

// Only a real click changes the fields. Setting .value from openForm does
// not fire this, so editing an existing show never overwrites what was saved.
venuePick.addEventListener("change", () => {
  applyVenue(venuePick.value === OTHER ? -1 : Number(venuePick.value));
});

// Which entry, if any, does this show's venue match?
function venueIndexFor(show) {
  const name = String((show && show.venue) || "").trim().toLowerCase();
  if (!name) return -1;
  return (SITE.venues || []).findIndex((v) => v.name.trim().toLowerCase() === name);
}

function openForm(existing) {
  formErr.hidden = true;
  document.getElementById("modalTitle").textContent = existing ? "Edit date" : "Add a date";
  document.getElementById("notifyRow").hidden = Boolean(existing);

  const g = (id) => document.getElementById(id);
  g("f_id").value = existing ? existing.id : "";
  g("f_title").value = existing ? existing.title || "" : "";

  if (existing) {
    const idx = venueIndexFor(existing);
    venuePick.value = idx >= 0 ? String(idx) : OTHER;
    g("f_venue").value = existing.venue || "";
    g("f_city").value = existing.city || "";
    g("f_address").value = existing.address || "";
    g("f_parking").value = existing.parking || "";
  } else {
    // New date: default to the first venue listed.
    venuePick.value = (SITE.venues || []).length ? "0" : OTHER;
    applyVenue((SITE.venues || []).length ? 0 : -1);
  }
  g("f_price").value = existing ? existing.price || "" : "";
  g("f_ticket").value = existing ? existing.ticket_url || "" : "";
  g("f_desc").value = existing ? existing.description || "" : "";
  g("f_lineup").value = existing ? existing.lineup || "" : "";
  g("f_published").checked = existing ? Boolean(existing.is_published) : true;
  g("f_notify").checked = true;

  if (existing) {
    const s = new Date(existing.starts_at);
    g("f_date").value = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
    g("f_start").value = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
    if (existing.ends_at) {
      const en = new Date(existing.ends_at);
      g("f_end").value = `${pad(en.getHours())}:${pad(en.getMinutes())}`;
    } else {
      g("f_end").value = "";
    }
  } else {
    g("f_date").value = "";
    g("f_start").value = "20:00";
    g("f_end").value = "";
  }

  modal.hidden = false;
  g("f_title").focus();
}

function closeForm() { modal.hidden = true; }

document.getElementById("newShowBtn").addEventListener("click", () => openForm(null));
document.getElementById("modalClose").addEventListener("click", closeForm);
document.getElementById("cancelBtn").addEventListener("click", closeForm);
modal.addEventListener("click", (e) => { if (e.target === modal) closeForm(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeForm();
});

document.getElementById("showForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  formErr.hidden = true;

  const g = (id) => document.getElementById(id).value.trim();
  const id = g("f_id");
  const date = g("f_date");
  const start = g("f_start");
  const end = g("f_end");

  if (!g("f_title") || !date || !start) {
    formErr.textContent = "Title, date and start time are required.";
    formErr.hidden = false;
    return;
  }

  const startsAt = new Date(`${date}T${start}`);
  if (isNaN(startsAt)) {
    formErr.textContent = "That date and time did not parse. Please re-enter them.";
    formErr.hidden = false;
    return;
  }

  let endsAt = null;
  if (end) {
    endsAt = new Date(`${date}T${end}`);
    // A show that ends before it starts ran past midnight.
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
  }

  const payload = {
    title: g("f_title"),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    venue: g("f_venue") || null,
    city: g("f_city") || null,
    address: g("f_address") || null,
    price: g("f_price") || null,
    ticket_url: g("f_ticket") || null,
    description: g("f_desc") || null,
    lineup: g("f_lineup") || null,
    parking: g("f_parking") || null,
    is_published: document.getElementById("f_published").checked,
  };

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span> Saving';

  try {
    let saved;
    if (id) {
      const { data, error } = await client
        .from("shows").update(payload).eq("id", id).select().single();
      if (error) throw error;
      saved = data;
    } else {
      payload.created_by = session.user.id;
      const { data, error } = await client
        .from("shows").insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }

    closeForm();
    await loadList();

    const wantsEmail = !id && document.getElementById("f_notify").checked;
    if (wantsEmail) {
      const result = await notifyTroupe(saved);
      if (result.ok) {
        flash(adminOk, `Saved. ${esc(result.message)}`);
      } else {
        flash(
          adminInfo,
          `Date saved, but the troupe email did not go out (${esc(result.message)}). ` +
          `<a href="${esc(gcalLink(saved))}" target="_blank" rel="noopener">Add it to your calendar</a> ` +
          `and let them know yourself.`
        );
      }
    } else {
      flash(adminOk, id ? "Changes saved." : "Date saved.");
    }
  } catch (ex) {
    formErr.textContent = ex.message || "Could not save. Try again.";
    formErr.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save date";
  }
});

/* ============================================================
   Delete
   ============================================================ */
async function removeShow(id) {
  const s = allShows.find((x) => String(x.id) === id);
  if (!s) return;
  if (!window.confirm(`Delete “${s.title}” on ${dateLine(s)}? This cannot be undone.`)) return;

  const { error } = await client.from("shows").delete().eq("id", id);
  if (error) return flash(adminErr, `Could not delete: ${esc(error.message)}`);
  await loadList();
  flash(adminOk, "Date deleted.");
}

/* ============================================================
   Email the troupe
   ============================================================ */
async function notifyTroupe(showRow) {
  try {
    const res = await fetch("/api/notify-show", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      // Only the id goes over the wire — the server re-reads the show from
      // the database so the email can never carry forged content.
      body: JSON.stringify({
        showId: showRow.id,
        troupeName: SITE.troupeName,
      }),
    });

    const text = await res.text();
    if (!res.ok) return { ok: false, message: text.slice(0, 200) || `HTTP ${res.status}` };

    let body = {};
    try { body = JSON.parse(text); } catch (_) {}
    if (body.demo) {
      return { ok: true, message: "Demo mode — no email was actually sent." };
    }
    return {
      ok: true,
      message: body.sentTo
        ? `Emailed ${body.sentTo} ${body.sentTo === 1 ? "person" : "people"} with the calendar link.`
        : "The troupe has been emailed.",
    };
  } catch (ex) {
    return { ok: false, message: ex.message || "network error" };
  }
}
