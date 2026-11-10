import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/styles/style.css";
import "./components/site-navbar.js";
import { auth, db } from "./firebaseConfig.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Modal from "bootstrap/js/dist/modal";

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

/* Strips raw HTML descriptions into clean readable text */
const plain = (html) =>
  new DOMParser().parseFromString(html ?? "", "text/html").body.textContent.trim();

const thumb = (v) =>
  (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "").replace("http://", "https://");

const looksLikeIsbn = (s) => /^[\d-]{10,17}X?$/i.test(String(s).trim());

/* ============ Google Books API ============ */

/* Looks up a single book by Google Books Volume ID or ISBN */
async function lookupBook(id) {
  const clean = String(id ?? "").trim();
  if (!clean) throw new Error("No book ID");
  const isIsbn = looksLikeIsbn(clean);
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const url = isIsbn
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean.replace(/-/g, ""))}&maxResults=1${keyParam}`
    : `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(clean)}?${keyParam.slice(1)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Books lookup failed: " + res.status);
  const json = await res.json();
  const item = isIsbn ? json.items?.[0] : json;
  if (!item?.volumeInfo) throw new Error("Book not found: " + clean);
  const v = item.volumeInfo;
  return {
    title: v.title ?? clean,
    authors: (v.authors ?? []).join(", "),
    description: plain(v.description),
    image: thumb(v),
  };
}

/* Searches Google Books by title, author, or ISBN */
async function searchBooks(text) {
  const q = text.trim();
  const isIsbn = looksLikeIsbn(q);
  const query = isIsbn ? `isbn:${q.replace(/-/g, "")}` : q;
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books${keyParam}`
  );
  if (!res.ok) throw new Error("Search failed: " + res.status);
  const json = await res.json();
  return (json.items ?? [])
    .filter((it) => it.volumeInfo)
    .map((it) => ({
      id: it.id,
      title: it.volumeInfo.title ?? "Untitled",
      authors: (it.volumeInfo.authors ?? []).join(", "),
      image: thumb(it.volumeInfo),
    }));
}

/* ============ Firestore ============
   users/{uid}.book is a map of books keyed by Google Books volume ID:
   book = { "<volumeId>": { book: "<volumeId>", "book info": "User note", added: 1700000000000 } }
*/
let books = [];
async function loadBooks(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  const field = snap.data().book;
  if (!field || typeof field !== "object") return [];

  const entries = [];
  if (typeof field.book === "string" || "book info" in field) {
    entries.push(["legacy", { book: field.book, "book info": field["book info"], added: 0 }]);
  }
  for (const [key, value] of Object.entries(field)) {
    if (value && typeof value === "object") entries.push([key, value]);
  }
  entries.sort((a, b) => (a[1].added ?? 0) - (b[1].added ?? 0)); // oldest first

  return Promise.all(
    entries.map(async ([key, info], i) => {
      const bookVolumeId = info.book || key;
      const note = info["book info"] ?? "";
      let title = bookVolumeId,
        authors = "",
        description = "",
        image = "";
      try {
        ({ title, authors, description, image } = await lookupBook(bookVolumeId));
      } catch (err) {
        console.warn(err);
      }
      const short = description.length > 300 ? description.slice(0, 300).trimEnd() + "…" : description;
      return {
        ...palette[i % palette.length],
        id: bookVolumeId,
        name: title,
        subtitle: authors,
        image,
        page:
          `<h2>${esc(title)}</h2>` +
          (authors ? `<p class="small text-muted mb-2">By ${esc(authors)}</p>` : "") +
          (short ? `<p>${esc(short)}</p>` : "") +
          (note ? `<p class="fst-italic border-start border-2 border-secondary ps-2 my-2">${esc(note)}</p>` : "") +
          `<div class="mt-3"><a href="/html/book_info.html?bookid=${encodeURIComponent(bookVolumeId)}" class="btn btn-sm btn-book">View Details & Retailers</a></div>`,
      };
    })
  );
}

/* ============ 3D Book on the Page ============ */
const shelf = document.getElementById("shelf");
const book = document.getElementById("book");
const hint = document.getElementById("hint");
const heading = document.getElementById("heading");
const label = document.getElementById("label");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");

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
      <div class="face front cover">
        <h1>${esc(b.name)}</h1>
        <p class="mb-0">${esc(b.subtitle)}</p>
      </div>
      <div class="face back inside">
        ${
          b.image
            ? `<img src="${esc(b.image)}" alt="Cover of ${esc(b.name)}">`
            : `<div class="emoji">${b.emoji}</div>`
        }
      </div>
    </div>`;

  if (heading) heading.textContent = b.name;
  if (label) label.textContent = `Book ${i + 1} of ${books.length}`;
  updateHint();
}

function updateHint() {
  if (!hint) return;
  hint.textContent = book.classList.contains("open")
    ? "Tap the book to close it. Swipe or use arrow keys for another book."
    : "Tap the book to open it";
}

function switchBook(dir) {
  if (busy || !books.length) return;
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

/* Reloads the user's books from Firestore and focuses the one with this ID */
async function refresh(showId) {
  if (!currentUser) return;
  books = await loadBooks(currentUser.uid);
  if (!books.length) {
    book.innerHTML = "";
    if (heading) heading.textContent = "My Library";
    if (label) label.textContent = "";
    if (hint) hint.textContent = 'No books yet. Press "Add book" in the top right to add your first one.';
    return;
  }
  bookIdx = Math.max(
    0,
    books.findIndex((b) => b.id === showId)
  );
  buildBook(bookIdx);
}

if (nextBtn) nextBtn.addEventListener("click", () => switchBook(1));
if (prevBtn) prevBtn.addEventListener("click", () => switchBook(-1));

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) return; // Don't switch books while typing in the modal
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

/* ============ "Add Book" Modal ============ */
const addModalEl = document.getElementById("addModal");
const addModal = addModalEl ? Modal.getOrCreateInstance(addModalEl) : null;
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const resultsEl = document.getElementById("results");
const noteBox = document.getElementById("noteBox");
const noteInput = document.getElementById("noteInput");
const saveBtn = document.getElementById("saveBtn");
let selected = null; // Currently chosen search result

function resetModal() {
  selected = null;
  if (searchInput) searchInput.value = "";
  if (searchStatus) searchStatus.textContent = "";
  if (resultsEl) resultsEl.innerHTML = "";
  if (noteInput) noteInput.value = "";
  if (noteBox) noteBox.classList.add("d-none");
  if (saveBtn) saveBtn.disabled = true;
}

if (addModalEl) {
  addModalEl.addEventListener("show.bs.modal", resetModal);
  addModalEl.addEventListener("shown.bs.modal", () => searchInput?.focus());
}

function selectResult(item, button) {
  resultsEl?.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
  button.classList.add("active");
  selected = item;
  if (noteBox) noteBox.classList.remove("d-none");
  if (saveBtn) saveBtn.disabled = false;
  noteInput?.focus();
}

function renderResults(list) {
  if (!resultsEl) return;
  resultsEl.innerHTML = "";
  list.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-group-item list-group-item-action d-flex gap-3 align-items-center";
    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      img.className = "result-thumb";
      button.append(img);
    }
    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "fw-semibold";
    title.textContent = item.title;
    const authors = document.createElement("div");
    authors.className = "small text-muted";
    authors.textContent = item.authors;
    text.append(title, authors);
    button.append(text);
    button.addEventListener("click", () => selectResult(item, button));
    resultsEl.append(button);
  });
}

if (searchForm) {
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = searchInput?.value.trim() ?? "";
    if (!text) return;
    selected = null;
    if (saveBtn) saveBtn.disabled = true;
    if (noteBox) noteBox.classList.add("d-none");
    if (resultsEl) resultsEl.innerHTML = "";
    if (searchStatus) searchStatus.textContent = "Searching…";
    try {
      const list = await searchBooks(text);
      if (searchStatus) {
        searchStatus.textContent = list.length
          ? "Pick a book from the list below:"
          : "No books found. Try a different title, author or ISBN.";
      }
      renderResults(list);
    } catch (err) {
      console.error(err);
      if (searchStatus) {
        searchStatus.textContent = "Could not reach Google Books. Check your internet connection.";
      }
    }
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    if (!selected || !currentUser) return;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      // Save book under the user's document
      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          book: {
            [selected.id]: {
              book: selected.id,
              "book info": noteInput?.value.trim() ?? "",
              added: Date.now(),
            },
          },
        },
        { merge: true }
      );

      addModal?.hide();
      await refresh(selected.id);
      setTimeout(() => {
        book?.classList.add("open");
        updateHint();
      }, 400);
    } catch (err) {
      console.error("Could not save book:", err);
      if (searchStatus) {
        searchStatus.textContent = "Could not save the book. Please try again.";
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save book";
    }
  });
}

/* ============ Auth State Listener ============ */
if (hint) hint.textContent = "Loading books…";
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const addBtn = document.getElementById("addBtn");
  if (!user) {
    if (addBtn) addBtn.classList.add("d-none");
    if (hint) {
      hint.innerHTML = 'Please <a href="/html/login.html" class="fw-semibold text-decoration-none">log in</a> to see your library.';
    }
    return;
  }
  if (addBtn) addBtn.classList.remove("d-none");
  refresh().catch((err) => {
    console.error("Could not load library:", err);
    if (hint) hint.textContent = "Could not load books. Refresh the page to try again.";
  });
});
