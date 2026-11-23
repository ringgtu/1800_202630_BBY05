import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/styles/style.css";
import "./components/site-navbar.js";
import { requireAuth } from "./authentication.js";
import { auth, db } from "./firebaseConfig.js";
import { collection, deleteDoc, doc, getDocs, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getBookById } from "./master.js";
import { setBookCover } from "./bookCovers.js";
import { getUserData } from "./favorites.js";

/* Escapes HTML special characters to prevent XSS */
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/* ============ Firestore ============
   Books live in the subcollection users/{uid}/books/{volumeId}:
   {
     book:     { id, title, authors: [], image, imageLinks },
     bookInfo: { note, views, createdAt }
   }
*/
let books = [];

async function loadBooks(uid) {
  const snap = await getDocs(collection(db, "users", uid, "books"));

  // Oldest first. A just-saved doc can have a null createdAt for a moment.
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) => (a.bookInfo?.createdAt?.toMillis?.() ?? Infinity) - (b.bookInfo?.createdAt?.toMillis?.() ?? Infinity),
    );

  return Promise.all(
    docs.map(async (data) => {
      const info = data.book ?? {};
      const volumeId = info.id || data.id;
      const title = info.title ?? "Untitled";
      const authors = Array.isArray(info.authors) ? info.authors.join(", ") : (info.authors ?? "");
      let coverImageLinks = info.imageLinks ?? info.image;
      if (!coverImageLinks?.extraLarge) {
        try {
          const apiBook = await getBookById(volumeId);
          if (apiBook.volumeInfo?.imageLinks) {
            coverImageLinks = apiBook.volumeInfo.imageLinks;
          }
        } catch (error) {
          console.warn(`Could not load cover variants for book ${volumeId}:`, error);
        }
      }
      const note = data.bookInfo?.note ?? "";

      return {
        id: volumeId,
        name: title,
        subtitle: authors,
        note,
        coverImageLinks,
        page:
          (note
            ? `<p class="fst-italic border-start border-2 border-secondary ps-2 my-2">${esc(note)}</p>`
            : `<p class="small text-muted">No note for this book.</p>`) +
          `<div class="mt-3"><a href="/html/book_info.html?bookid=${encodeURIComponent(volumeId)}" class="btn btn-sm btn-book">View Details & Retailers</a></div>`,
      };
    }),
  );
}

/* ============ 3D Book on the Page ============ */
const stage = document.getElementById("stage");
const shelf = document.getElementById("shelf");
const book = document.getElementById("book");
const sidePrev = document.getElementById("sidePrev");
const sideNext = document.getElementById("sideNext");
const hint = document.getElementById("hint");
const heading = document.getElementById("heading");
const label = document.getElementById("label");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const controls = document.getElementById("controls");
const reviewsContainer = document.getElementById("reviewsContainer");
const reviewsBtn = document.getElementById("reviewsBtn");
const deleteBtn = document.getElementById("deleteBtn");
const searchBox = document.getElementById("searchBox");
const librarySearch = document.getElementById("librarySearch");
const searchResults = document.getElementById("searchResults");
const favBtn = document.getElementById("favBtn");

let bookIdx = 0;
let busy = false;
let currentUser = null;
let favorites = [];

function updateFavButton() {
  if (!favBtn) return;

  const current = books[bookIdx];
  favBtn.classList.toggle("d-none", !current); // hidden when the library is empty
  if (!current) return;

  const isFav = favorites.includes(current.id);
  favBtn.querySelector("i").className = isFav ? "bi bi-heart-fill" : "bi bi-heart";
  favBtn.setAttribute("aria-pressed", String(isFav));
  favBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
}

/* ----- the smaller previous and next books on each side ----- */

/* Fills one side button with a book's cover, or hides it when there is no book */
function renderSideBook(button, b) {
  if (!button) return;
  button.replaceChildren();
  button.classList.toggle("is-empty", !b);
  if (!b) {
    button.removeAttribute("aria-label");
    return;
  }
  button.setAttribute("aria-label", `${b.name}`);
  const img = document.createElement("img");
  setBookCover(img, b.coverImageLinks, b.name);
  button.append(img);
}

/* The books on the left and the right of book i, wrapping around like the Previous/Next buttons.
   With only 2 books the other one is shown once, on the right, instead of on both sides. */
function neighbors(i) {
  const n = books.length;
  if (n <= 1) return [null, null];
  if (n === 2) return [null, books[1 - i]];
  return [books[(i - 1 + n) % n], books[(i + 1) % n]];
}

function renderSideBooks(i) {
  const [before, after] = neighbors(i);
  renderSideBook(sidePrev, before);
  renderSideBook(sideNext, after);
}

/* Used whenever there is no library to show: hides the side books and the search box */
function clearLibraryExtras() {
  renderSideBook(sidePrev, null);
  renderSideBook(sideNext, null);
  setSearchVisible(false);
}

function buildBook(i) {
  const b = books[i];
  if (!b) return;

  book.classList.remove("open");
  book.innerHTML = `
    <div class="base"><div class="face front">${b.page}</div></div>
    <div class="leaf">
      <div class="face front cover has-image">
        <img class="library-cover" src="/images/cover_not_available.jpg" alt="Cover of ${esc(b.name)}">
      </div>
      <div class="face back inside">
        <h2>${esc(b.name)}</h2>
        <p class="mb-0">${esc(b.subtitle)}</p>
      </div>
    </div>`;
  setBookCover(book.querySelector(".library-cover"), b.coverImageLinks, b.name, () =>
    getBookById(b.id).then((apiBook) => apiBook.volumeInfo?.imageLinks),
  );

  renderSideBooks(i);

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
  updateFavButton();
}

function updateHint() {
  if (!hint) return;
  hint.textContent = book.classList.contains("open")
    ? "Tap the book to close it. Swipe or use arrow keys for another book."
    : "Tap the book to open it";
}

/* Slides to the book at index i. dir is the way the shelf slides: 1 = to the left, -1 = to the right */
function goTo(i, dir) {
  if (busy || i === bookIdx || !books[i]) return;
  busy = true;
  shelf.classList.add(dir > 0 ? "out-left" : "out-right");
  setTimeout(() => {
    bookIdx = i;
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

/* Previous / next book, wrapping around */
function switchBook(dir) {
  if (books.length <= 1) return;
  goTo((bookIdx + dir + books.length) % books.length, dir);
}

/* ----- search my library -----
   The books are already loaded from Firestore into the books array,
   so searching them needs no extra reads. */
function setSearchVisible(show) {
  if (!searchBox) return;
  searchBox.classList.toggle("d-none", !show);
  if (!show) hideSearchResults();
}

function hideSearchResults() {
  if (!searchResults) return;
  searchResults.classList.add("d-none");
  searchResults.replaceChildren();
}

/* Every word typed must appear in the title, the authors or the user's note */
function searchLibrary(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return books
    .map((b, index) => ({ b, index, haystack: `${b.name} ${b.subtitle} ${b.note}`.toLowerCase() }))
    .filter(({ haystack }) => words.every((w) => haystack.includes(w)));
}

/* Brings a book to the front. If it already is the front book, just opens it. */
function showBookAt(index) {
  hideSearchResults();
  if (librarySearch) librarySearch.value = "";
  if (index === bookIdx) {
    book.classList.add("open");
    updateHint();
    return;
  }
  goTo(index, index > bookIdx ? 1 : -1);
}

function renderSearchResults(matches) {
  searchResults.replaceChildren();

  if (!matches.length) {
    const none = document.createElement("div");
    none.className = "list-group-item text-body-secondary small";
    none.textContent = "No books in your library match that.";
    searchResults.append(none);
  } else {
    matches.slice(0, 6).forEach(({ b, index }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";

      const title = document.createElement("div");
      title.className = "fw-semibold";
      title.textContent = b.name;

      const authors = document.createElement("div");
      authors.className = "small";
      authors.textContent = b.subtitle;

      item.append(title, authors);
      item.addEventListener("click", () => showBookAt(index));
      searchResults.append(item);
    });
  }

  searchResults.classList.remove("d-none");
}

if (librarySearch) {
  librarySearch.addEventListener("input", () => {
    const text = librarySearch.value.trim();
    if (!text) {
      hideSearchResults();
      return;
    }
    renderSearchResults(searchLibrary(text));
  });

  librarySearch.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      librarySearch.value = "";
      hideSearchResults();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const first = searchLibrary(librarySearch.value.trim())[0];
      if (first) showBookAt(first.index);
    }
  });
}

/* Clicking anywhere else closes the list of matches */
document.addEventListener("click", (e) => {
  if (searchBox && !searchBox.contains(e.target)) hideSearchResults();
});

/* Loads the user's books from Firestore and shows the first one */
async function refresh() {
  if (!currentUser) return;

  try {
    favorites = (await getUserData(currentUser.uid)).favorites ?? [];
  } catch (error) {
    console.error("Could not load favorites:", error);
    favorites = [];
  }

  books = await loadBooks(currentUser.uid);
  if (!books.length) {
    book.innerHTML = "";
    clearLibraryExtras();
    updateFavButton();
    if (stage) stage.classList.add("d-none");
    if (controls) controls.classList.add("d-none");
    if (reviewsContainer) reviewsContainer.classList.add("d-none");
    if (heading) heading.textContent = "My Library";
    if (label) label.textContent = "";
    if (hint) hint.textContent = 'No books yet. Press "Add book" in the top right to add your first one.';
    return;
  }
  if (stage) stage.classList.remove("d-none");
  setSearchVisible(true);
  if (controls) controls.classList.remove("d-none");
  if (reviewsContainer) reviewsContainer.classList.remove("d-none");
  bookIdx = 0;
  buildBook(bookIdx);
}

if (nextBtn) nextBtn.addEventListener("click", () => switchBook(1));
if (prevBtn) prevBtn.addEventListener("click", () => switchBook(-1));

/* Click a side book to go to it */
if (sideNext) sideNext.addEventListener("click", () => switchBook(1));
if (sidePrev) sidePrev.addEventListener("click", () => switchBook(-1));

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) return;      // arrow keys move the cursor while typing in the search box
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

if (favBtn) {
  favBtn.addEventListener("click", async () => {
    const current = books[bookIdx];
    if (!currentUser || !current) return;

    const wasFav = favorites.includes(current.id);

    // Update the screen
    favorites = wasFav ? favorites.filter((id) => id !== current.id) : [...favorites, current.id];
    updateFavButton();

    try {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { favorites: wasFav ? arrayRemove(current.id) : arrayUnion(current.id) },
        { merge: true },
      );
    } catch (error) {
      console.error("Error saving favorite:", error);

      favorites = wasFav ? [...favorites, current.id] : favorites.filter((id) => id !== current.id);
      updateFavButton();
    }
  });
}

/* ============ Delete current book ============ */
if (deleteBtn) {
  deleteBtn.addEventListener("click", async () => {
    if (!currentUser || !books.length) return;

    const current = books[bookIdx];
    if (!confirm(`Remove "${current.name}" from your library?`)) return;

    deleteBtn.disabled = true;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "books", current.id));
      books.splice(bookIdx, 1);

      if (!books.length) {
        // Last book removed — hide everything
        book.innerHTML = "";
        clearLibraryExtras();
        updateFavButton();
        if (stage) stage.classList.add("d-none");
        if (controls) controls.classList.add("d-none");
        if (reviewsContainer) reviewsContainer.classList.add("d-none");
        if (heading) heading.textContent = "My Library";
        if (label) label.textContent = "";
        if (hint) hint.textContent = 'No books yet. Press "Add book" in the top right to add your first one.';
      } else {
        // Show the next book (or wrap to 0)
        bookIdx = bookIdx % books.length;
        buildBook(bookIdx);
      }
    } catch (err) {
      console.error("Could not delete book:", err);
      alert("Could not remove the book. Please try again.");
    } finally {
      deleteBtn.disabled = false;
    }
  });
}

/* ============ Auth State Listener ============ */
if (hint) hint.textContent = "Loading books…";
requireAuth((user) => {
  currentUser = user;
  const addBtn = document.getElementById("addBtn");
  if (addBtn) addBtn.classList.remove("d-none");
  refresh().catch((err) => {
    console.error("Could not load library:", err);
    clearLibraryExtras();
    if (stage) stage.classList.add("d-none");
    if (controls) controls.classList.add("d-none");
    if (reviewsContainer) reviewsContainer.classList.add("d-none");
    if (hint) hint.textContent = "Could not load books. Refresh the page to try again.";
  });
});