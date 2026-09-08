/* Landing page: the show calendar. */

setPageTitle("");
renderHeader("index.html");
renderFooter();

const heroTitle = document.getElementById("heroTitle");
heroTitle.textContent =
  SITE.showName && SITE.showName !== SITE.troupeName ? SITE.showName : SITE.troupeName;
// Short names get the oversized poster treatment.
if (heroTitle.textContent.replace(/\s/g, "").length <= 4) {
  heroTitle.classList.add("hero-mark");
}
document.getElementById("heroTagline").textContent = SITE.tagline;
document.getElementById("heroEyebrow").textContent =
  SITE.showName && SITE.showName !== SITE.troupeName
    ? `${SITE.troupeName} presents`
    : `Live improv · ${SITE.city}`;

const ICONS = {
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  car:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14M4 17v-4l2-5h12l2 5v4"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  ticket:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z"/><path d="M15 5v14" stroke-dasharray="2 3"/></svg>',
};

function dateChip(show) {
  const s = d(show);
  return `
    <div class="datechip">
      <div class="m">${MONTHS[s.getMonth()]}</div>
      <div class="d">${s.getDate()}</div>
      <div class="y">${s.getFullYear()}</div>
    </div>`;
}

function metaBits(show) {
  const bits = [
    `<span>${ICONS.clock}${esc(dateLine(show))} · ${esc(timeLine(show))}</span>`,
  ];
  const where = [show.venue, show.city].filter(Boolean).join(", ");
  if (where) bits.push(`<span>${ICONS.pin}${esc(where)}</span>`);
  if (show.price) bits.push(`<span>${ICONS.ticket}${esc(show.price)}</span>`);
  return bits.join("");
}

function actions(show, isPast) {
  if (isPast) return "";
  const out = [];
  const tickets = safeUrl(show.ticket_url);
  if (tickets) {
    out.push(
      `<a class="btn btn-primary btn-sm" href="${esc(tickets)}" target="_blank" rel="noopener noreferrer">Tickets</a>`
    );
  }
  out.push(calendarMenu(show, true));
  return out.join("");
}

// The cards are built as HTML strings, so the click handlers below need a
// way back to the show object. This map is that way back.
const SHOWS_BY_ID = new Map();

function calendarMenu(show, small) {
  const size = small ? " btn-sm" : "";
  return `
    <div class="cal-menu">
      <button type="button" class="btn btn-ghost${size} cal-toggle"
              data-show="${esc(show.id)}" aria-expanded="false" aria-haspopup="true">
        ${ICONS.calendar}Add to calendar
      </button>
      <div class="cal-items" hidden role="menu">
        <a role="menuitem" href="${esc(gcalLink(show))}" target="_blank" rel="noopener noreferrer">
          Google Calendar
        </a>
        <button type="button" role="menuitem" class="cal-ics" data-show="${esc(show.id)}">
          Apple Calendar <span class="cal-hint">.ics file</span>
        </button>
      </div>
    </div>`;
}

function parkingBlock(show) {
  const text = parkingFor(show);
  if (!text) return "";
  return `
    <details class="parking">
      <summary>${ICONS.car}Parking</summary>
      <p>${esc(text)}</p>
    </details>`;
}

function showRow(show, isPast) {
  return `
    <article class="show${isPast ? " past" : ""}">
      ${dateChip(show)}
      <div class="show-body">
        <h3>${esc(show.title)}</h3>
        <div class="show-meta">${metaBits(show)}</div>
        ${show.description ? `<p class="show-desc">${esc(show.description)}</p>` : ""}
        ${parkingBlock(show)}
      </div>
      <div class="show-actions">${actions(show, isPast)}</div>
    </article>`;
}

function nextShowBlock(show) {
  const where = [show.venue, show.address, show.city].filter(Boolean).join(", ");
  const tickets = safeUrl(show.ticket_url);
  return `
    <div class="next-show">
      ${dateChip(show)}
      <div>
        <p class="eyebrow" style="margin-bottom:6px">Next show</p>
        <h2>${esc(show.title)}</h2>
        <p class="meta">
          ${esc(dateLine(show))} at ${esc(timeLine(show))}${where ? " · " + esc(where) : ""}
          ${show.price ? " · " + esc(show.price) : ""}
        </p>
        ${show.description ? `<p class="muted" style="margin-top:-6px">${esc(show.description)}</p>` : ""}
        ${parkingFor(show)
          ? `<p class="next-parking">${ICONS.car}<span><b>Parking.</b> ${esc(parkingFor(show))}</span></p>`
          : ""}
        <div class="actions">
          ${tickets
            ? `<a class="btn btn-primary" href="${esc(tickets)}" target="_blank" rel="noopener noreferrer">Get tickets</a>`
            : ""}
          ${calendarMenu(show, false)}
        </div>
      </div>
    </div>`;
}

(async function () {
  const upcomingEl = document.getElementById("upcomingList");
  const nextEl = document.getElementById("nextShow");

  try {
    const { upcoming, past } = await fetchShows();
    upcoming.concat(past).forEach((s) => SHOWS_BY_ID.set(String(s.id), s));

    if (upcoming.length) {
      nextEl.innerHTML = nextShowBlock(upcoming[0]);
      const rest = upcoming.slice(1);
      upcomingEl.innerHTML = rest.length
        ? rest.map((s) => showRow(s, false)).join("")
        : `<div class="empty">That is the only date on the books right now. More soon.</div>`;
      document.getElementById("upcomingCount").textContent =
        `${upcoming.length} date${upcoming.length === 1 ? "" : "s"} scheduled`;
    } else {
      nextEl.innerHTML = `
        <div class="next-show" style="grid-template-columns:1fr">
          <div>
            <p class="eyebrow" style="margin-bottom:6px">Between runs</p>
            <h2>No dates on the calendar yet</h2>
            <p class="meta">We are booking now. Follow along or drop us a line and we will tell you first.</p>
            <div class="actions">
              <a class="btn btn-primary" href="book.html">Get in touch</a>
            </div>
          </div>
        </div>`;
      upcomingEl.innerHTML = `<div class="empty">Nothing scheduled at the moment. Check back soon.</div>`;
    }

    if (past.length) {
      document.getElementById("archive").hidden = false;
      document.getElementById("archiveSummary").textContent =
        `Past shows (${past.length})`;
      document.getElementById("pastList").innerHTML =
        past.slice(0, 24).map((s) => showRow(s, true)).join("");
    }
  } catch (err) {
    console.error(err);
    upcomingEl.innerHTML =
      `<div class="notice notice-bad">We could not load the calendar just now. Please refresh.</div>`;
    nextEl.innerHTML = "";
  }
})();


/* ============================================================
   The add-to-calendar menu
   ============================================================ */

function closeAllMenus(except) {
  document.querySelectorAll(".cal-menu").forEach(function (menu) {
    if (menu === except) return;
    menu.querySelector(".cal-items").hidden = true;
    menu.querySelector(".cal-toggle").setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("click", function (e) {
  const toggle = e.target.closest(".cal-toggle");
  if (toggle) {
    const menu = toggle.closest(".cal-menu");
    const items = menu.querySelector(".cal-items");
    const open = items.hidden;
    closeAllMenus(menu);
    items.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    return;
  }

  const ics = e.target.closest(".cal-ics");
  if (ics) {
    const show = SHOWS_BY_ID.get(String(ics.dataset.show));
    if (show) downloadIcs(show);
    closeAllMenus();
    return;
  }

  // A click anywhere else closes an open menu.
  closeAllMenus();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeAllMenus();
});
