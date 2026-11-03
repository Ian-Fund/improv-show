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

// A .webp photo gets a .jpg fallback with the same base name, for the rare
// browser that cannot show .webp. Any other format is used as it is.
function photoTag(p) {
  const file = String(p.photo);
  const alt = esc(p.name);
  if (/\.webp$/i.test(file)) {
    const jpg = file.replace(/\.webp$/i, ".jpg");
    return `<picture>
        <source srcset="assets/img/${esc(file)}" type="image/webp">
        <img src="assets/img/${esc(jpg)}" alt="${alt}" loading="lazy" width="600" height="600">
      </picture>`;
  }
  return `<img src="assets/img/${esc(file)}" alt="${alt}" loading="lazy">`;
}

document.getElementById("castGrid").innerHTML = SITE.cast
  .map(
    (p, i) => `
    <button class="cast-card" data-i="${i}">
      <div class="cast-photo">${
        p.photo
          ? photoTag(p)
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

/* ------------------------------------------------------------
   Photo gallery. The list lives in SITE.gallery in config.js.
   Click a photo to see it large. Arrow keys move between photos.
   ------------------------------------------------------------ */
const GALLERY = Array.isArray(SITE.gallery) ? SITE.gallery.filter((g) => g && g.photo) : [];

function galleryTag(g) {
  const file = String(g.photo);
  const alt = esc(g.alt || "");
  const tall = g.shape === "tall";
  const size = tall ? 'width="800" height="1200"' : 'width="1200" height="800"';
  if (/\.webp$/i.test(file)) {
    const jpg = file.replace(/\.webp$/i, ".jpg");
    return `<picture>
        <source srcset="assets/img/gallery/${esc(file)}" type="image/webp">
        <img src="assets/img/gallery/${esc(jpg)}" alt="${alt}" loading="lazy" ${size}>
      </picture>`;
  }
  return `<img src="assets/img/gallery/${esc(file)}" alt="${alt}" loading="lazy" ${size}>`;
}

// On a phone, tall photos sit two to a row. If the count is odd, the last
// tall photo gets the full row (class "solo") so no gap is left.
const TALL = GALLERY.filter((g) => g.shape === "tall");
const SOLO = TALL.length % 2 ? TALL[TALL.length - 1] : null;

if (GALLERY.length) {
  document.getElementById("gallery").innerHTML = GALLERY.map(
    (g, i) => `
    <button class="gallery-item ${g.shape === "tall" ? "tall" : "wide"}${g === SOLO ? " solo" : ""}" data-i="${i}" aria-label="Open photo: ${esc(g.alt || "photo " + (i + 1))}">
      ${galleryTag(g)}
    </button>`
  ).join("");
  document.getElementById("gallerySection").hidden = false;
}

const photoModal = document.getElementById("photoModal");
const photoBig = document.getElementById("photoBig");
const photoCaption = document.getElementById("photoCaption");
const photoClose = document.getElementById("photoClose");
const photoPrev = document.getElementById("photoPrev");
const photoNext = document.getElementById("photoNext");
let photoIndex = 0;
let photoOpener = null;

function showPhoto(i) {
  photoIndex = (i + GALLERY.length) % GALLERY.length;
  const g = GALLERY[photoIndex];
  // Use the same file the small photo loaded (.webp or .jpg).
  const thumb = document.querySelector(`.gallery-item[data-i="${photoIndex}"] img`);
  const file = String(g.photo);
  photoBig.src = (thumb && thumb.currentSrc) || "assets/img/gallery/" + file.replace(/\.webp$/i, ".jpg");
  photoBig.alt = g.alt || "";
  photoBig.className = g.shape === "tall" ? "tall" : "wide";
  photoCaption.textContent = g.alt || "";
}
function openPhoto(i, opener) {
  photoOpener = opener || null;
  showPhoto(i);
  const many = GALLERY.length > 1;
  photoPrev.hidden = !many;
  photoNext.hidden = !many;
  photoModal.hidden = false;
  photoClose.focus();
}
function closePhoto() {
  photoModal.hidden = true;
  photoBig.removeAttribute("src");
  if (photoOpener) photoOpener.focus();
}

document.getElementById("gallery").addEventListener("click", (e) => {
  const item = e.target.closest(".gallery-item");
  if (item) openPhoto(Number(item.dataset.i), item);
});
photoClose.addEventListener("click", closePhoto);
photoPrev.addEventListener("click", () => showPhoto(photoIndex - 1));
photoNext.addEventListener("click", () => showPhoto(photoIndex + 1));
photoModal.addEventListener("click", (e) => {
  if (e.target === photoModal) closePhoto();
});
document.addEventListener("keydown", (e) => {
  if (photoModal.hidden) return;
  if (e.key === "Escape") closePhoto();
  else if (e.key === "ArrowLeft" && GALLERY.length > 1) showPhoto(photoIndex - 1);
  else if (e.key === "ArrowRight" && GALLERY.length > 1) showPhoto(photoIndex + 1);
});
