/* Booking inquiry form. Posts to /api/inquiry, which emails the troupe. */

setPageTitle("Book Us");
renderHeader("book.html");
renderFooter();

document.getElementById("bookingTypes").innerHTML = SITE.bookingTypes
  .map(
    (t) => `
    <div class="card">
      <h3 style="margin-bottom:6px">${esc(t.title)}</h3>
      <p class="muted small" style="margin:0">${esc(t.text)}</p>
    </div>`
  )
  .join("");

const kindSelect = document.getElementById("kind");
kindSelect.innerHTML =
  SITE.bookingTypes
    .map((t) => `<option value="${esc(t.title)}">${esc(t.title)}</option>`)
    .join("") + `<option value="Something else">Something else</option>`;

document.getElementById("mailtoLink").href = `mailto:${SITE.bookingEmail}`;

// Turnstile, only if a site key is configured.
if (typeof TURNSTILE_SITE_KEY === "string" && TURNSTILE_SITE_KEY) {
  const slot = document.getElementById("turnstileSlot");
  slot.className = "cf-turnstile";
  slot.dataset.sitekey = TURNSTILE_SITE_KEY;
  slot.dataset.theme = "dark";
  const tag = document.createElement("script");
  tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  tag.async = true;
  tag.defer = true;
  document.head.appendChild(tag);
}

const form = document.getElementById("bookForm");
const okMsg = document.getElementById("okMsg");
const errMsg = document.getElementById("errMsg");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  okMsg.hidden = true;
  errMsg.hidden = true;

  const data = Object.fromEntries(new FormData(form).entries());
  // Turnstile drops its token into a hidden input of this name.
  if (data["cf-turnstile-response"]) {
    data.turnstileToken = data["cf-turnstile-response"];
    delete data["cf-turnstile-response"];
  }

  if (data.website) return; // bot
  if (!data.name || !data.email || !data.message) {
    errMsg.textContent = "Name, email and details are all required.";
    errMsg.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Sending';

  try {
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());

    form.reset();
    okMsg.textContent =
      "Got it — thanks. We will get back to you within a couple of days.";
    okMsg.hidden = false;
  } catch (err) {
    console.error(err);
    const subject = encodeURIComponent(`Booking inquiry — ${data.name}`);
    const body = encodeURIComponent(
      `Name: ${data.name}\nEmail: ${data.email}\nCompany/event: ${data.org || ""}\n` +
      `Phone: ${data.phone || ""}\nType: ${data.kind || ""}\nDate: ${data.event_date || ""}\n\n${data.message}`
    );
    errMsg.innerHTML =
      `That did not send. Please <a href="mailto:${esc(SITE.bookingEmail)}?subject=${subject}&body=${body}">` +
      `email us instead</a> — the message is already filled in.`;
    errMsg.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send inquiry";
  }
});
