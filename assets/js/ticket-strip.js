/* ticket-strip.js — fills the yellow bar above the header (test 4).
   It reads the same show list as the calendar, so the bar always names
   the next show without any hand edits. If nothing is scheduled, or the
   list cannot load, the bar stays hidden and the page works as normal. */
(async function () {
  const bar = document.getElementById("ticketStrip");
  if (!bar) return;
  try {
    const { upcoming } = await fetchShows();
    const show = upcoming[0];
    if (!show) return;

    const s = d(show);
    const when = `${DAYS[s.getDay()].slice(0, 3)}, ${MONTHS[s.getMonth()]} ${s.getDate()} · ${timeStr(s)}`;
    const tickets = safeUrl(show.ticket_url);
    const go = tickets
      ? `<a class="ts-go" href="${esc(tickets)}" target="_blank" rel="noopener noreferrer">Get tickets &rarr;</a>`
      : `<a class="ts-go" href="#nextShow">Details &rarr;</a>`;

    bar.innerHTML =
      `<span class="ts-label">Next show</span>` +
      `<span class="ts-title">${esc(show.title)}</span>` +
      `<span class="ts-when">${esc(when)}</span>` +
      (show.venue ? `<span class="ts-where">${esc(show.venue)}</span>` : "") +
      go;
    bar.hidden = false;
  } catch (err) {
    console.error(err);
  }
})();
