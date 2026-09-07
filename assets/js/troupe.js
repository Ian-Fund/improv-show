/* Cast roster with click-through bios. */

setPageTitle("The Troupe");
renderHeader("troupe.html");
renderFooter();

document.getElementById("blurb").textContent = SITE.blurb;

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

document.getElementById("castGrid").innerHTML = SITE.cast
  .map(
    (p, i) => `
    <button class="cast-card" data-i="${i}">
      <div class="cast-photo">${
        p.photo
          ? `<img src="assets/img/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">`
          : esc(initials(p.name))
      }</div>
      <div class="cast-name">${esc(p.name)}</div>
      <div class="cast-role">${esc(p.role || "Performer")}</div>
    </button>`
  )
  .join("");

const modal = document.getElementById("bioModal");
const closeBtn = document.getElementById("bioClose");

function openBio(i) {
  const p = SITE.cast[i];
  document.getElementById("bioName").textContent = p.name;
  document.getElementById("bioRole").textContent = p.role || "Performer";
  document.getElementById("bioText").textContent = p.bio || "";
  modal.hidden = false;
  closeBtn.focus();
}
function closeBio() {
  modal.hidden = true;
}

document.getElementById("castGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".cast-card");
  if (card) openBio(Number(card.dataset.i));
});
closeBtn.addEventListener("click", closeBio);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeBio();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeBio();
});
