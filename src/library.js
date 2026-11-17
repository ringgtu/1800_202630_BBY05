import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/styles/style.css";
import "./components/site-navbar.js";
import { auth, db } from "./firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const palette = [
  { c1: "#6D2432", c2: "#2E2A26", ink: "#D9B382", emoji: "📕" },
  { c1: "#A44A3F", c2: "#6D2432", ink: "#F4ECE0", emoji: "📙" },
  { c1: "#D9B382", c2: "#A44A3F", ink: "#2E2A26", emoji: "📒" },
  { c1: "#2E2A26", c2: "#6D2432", ink: "#D9B382", emoji: "📓" },
];

/* Escapes HTML special characters to prevent XSS */
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

/* ============ Firestore ============
   Books live in the subcollection users/{uid}/books/{volumeId}:
   {
     book:     { id, title, authors: [], image },
     bookInfo: { note, views, createdAt }
   }
*/
let books = [];

async function loadBooks(uid) {
  const snap = await getDocs(collection(db, "users", uid, "books"));

  // Oldest first. A just-saved doc can have a null createdAt for a moment.
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.bookInfo?.createdAt?.toMillis?.() ?? Infinity) - (b.bookInfo?.createdAt?.toMillis?.() ?? Infinity));

  return Promise.all(
    docs.map(async (data, i) => {
      const info = data.book ?? {};
      const volumeId = info.id || data.id;
      const title = info.title ?? "Untitled";
      const authors = Array.isArray(info.authors) ? info.authors.join(", ") : (info.authors ?? "");
      const image = info.image ?? "";
      const note = data.bookInfo?.note ?? "";

      return {
        ...palette[i % palette.length],
        id: volumeId,
        name: title,
        subtitle: authors,
        image,
        page:
          (note
            ? `<p class="fst-italic border-start border-2 border-secondary ps-2 my-2">${esc(note)}</p>`
            : `<p class="small text-muted">No note for this book.</p>`) +
          `<div class="mt-3"><a href="/html/book_info.html?bookid=${encodeURIComponent(volumeId)}" class="btn btn-sm btn-book">View Details & Retailers</a></div>`,
      };
    })
  );
}

/* ============ 3D Book on the Page ============ */
const stage = document.getElementById("stage");
const shelf = document.getElementById("shelf");
const book = document.getElementById("book");
const hint = document.getElementById("hint");
const heading = document.getElementById("heading");
const label = document.getElementById("label");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const controls = document.getElementById("controls");
const reviewsContainer = document.getElementById("reviewsContainer");
const reviewsBtn = document.getElementById("reviewsBtn");

let bookIdx = 0;
let busy = false;
let currentUser = null;

function buildBook(i) {
  const b = books[i];
  if (!b) return;

  book.classList.remove("open");
  book.style.setProperty("--c1", b.c1);
  book.style.setProperty("--c2", b.c2);
  book.style.setProperty("--ink", b.ink);
  book.innerHTML = `
    <div class="base"><div class="face front">${b.page}</div></div>
    <div class="leaf">
      ${
        b.image
          ? `<div class="face front cover has-image">
               <img src="${esc(b.image.replace("zoom=1", "zoom=2"))}" alt="Cover of ${esc(b.name)}">
             </div>`
          : `<div class="face front cover">
               <div class="emoji">${b.emoji}</div>
               <h1>${esc(b.name)}</h1>
               <p class="mb-0">${esc(b.subtitle)}</p>
             </div>`
      }
      <div class="face back inside">
        <h2>${esc(b.name)}</h2>
        <p class="mb-0">${esc(b.subtitle)}</p>
      </div>
    </div>`;

  if (heading) heading.textContent = b.name;
  if (label) label.textContent = `Book ${i + 1} of ${books.length}`;

  if (reviewsBtn) {
    reviewsBtn.href = `./reviews.html?bookid=${encodeURIComponent(b.id)}&title=${encodeURIComponent(b.name)}&from=library`;
  }

  if (prevBtn && nextBtn) {
    const single = books.length <= 1;
    prevBtn.disabled = single;
    nextBtn.disabled = single;
    prevBtn.classList.toggle("opacity-50", single);
    nextBtn.classList.toggle("opacity-50", single);
  }

  updateHint();
}

function updateHint() {
  if (!hint) return;
  hint.textContent = book.classList.contains("open")
    ? "Tap the book to close it. Swipe or use arrow keys for another book."
    : "Tap the book to open it";
}

function switchBook(dir) {
  if (busy || books.length <= 1) return;
  busy = true;
  shelf.classList.add(dir > 0 ? "out-left" : "out-right");
  setTimeout(() => {
    bookIdx = (bookIdx + dir + books.length) % books.length;
    book.style.transition = "none";
    buildBook(bookIdx);
    shelf.classList.remove("out-left", "out-right");
    shelf.classList.add(dir > 0 ? "out-right" : "out-left");
    void shelf.offsetWidth;
    requestAnimationFrame(() => {
      book.style.transition = "";
      shelf.classList.remove("out-left", "out-right");
      setTimeout(() => {
        busy = false;
      }, 350);
    });
  }, 350);
}

/* Loads the user's books from Firestore and shows the first one */
async function refresh() {
  if (!currentUser) return;
  books = await loadBooks(currentUser.uid);
  if (!books.length) {
    book.innerHTML = "";
    if (stage) stage.classList.add("d-none");
    if (controls) controls.classList.add("d-none");
    if (reviewsContainer) reviewsContainer.classList.add("d-none");
    if (heading) heading.textContent = "My Library";
    if (label) label.textContent = "";
    if (hint) hint.textContent = 'No books yet. Press "Add book" in the top right to add your first one.';
    return;
  }
  if (stage) stage.classList.remove("d-none");
  if (controls) controls.classList.remove("d-none");
  if (reviewsContainer) reviewsContainer.classList.remove("d-none");
  bookIdx = 0;
  buildBook(bookIdx);
}

if (nextBtn) nextBtn.addEventListener("click", () => switchBook(1));
if (prevBtn) prevBtn.addEventListener("click", () => switchBook(-1));

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") switchBook(1);
  if (e.key === "ArrowLeft") switchBook(-1);
});

/* Tap to open/close book, swipe to navigate */
let startX = null;
if (book) {
  book.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
  });
  book.addEventListener("pointerup", (e) => {
    if (startX === null || !books.length) {
      startX = null;
      return;
    }
    const dx = e.clientX - startX;
    startX = null;
    if (dx < -40) switchBook(1);
    else if (dx > 40) switchBook(-1);
    else if (Math.abs(dx) <= 10) {
      book.classList.toggle("open");
      updateHint();
    }
  });
  book.addEventListener("pointercancel", () => {
    startX = null;
  });
}

/* ============ Auth State Listener ============ */
if (hint) hint.textContent = "Loading books…";
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const addBtn = document.getElementById("addBtn");
  if (!user) {
    if (stage) stage.classList.add("d-none");
    if (controls) controls.classList.add("d-none");
    if (reviewsContainer) reviewsContainer.classList.add("d-none");
    if (addBtn) addBtn.classList.add("d-none");
    if (hint) {
      hint.innerHTML = 'Please <a href="/html/login.html" class="fw-semibold text-decoration-none">log in</a> to see your library.';
    }
    return;
  }
  if (addBtn) addBtn.classList.remove("d-none");
  refresh().catch((err) => {
    console.error("Could not load library:", err);
    if (stage) stage.classList.add("d-none");
    if (controls) controls.classList.add("d-none");
    if (reviewsContainer) reviewsContainer.classList.add("d-none");
    if (hint) hint.textContent = "Could not load books. Refresh the page to try again.";
  });
});