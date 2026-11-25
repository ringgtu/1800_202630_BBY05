import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { initializeBackLink } from "./backLink.js";

const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;

const form = document.getElementById("reviewForm");
const fields = document.getElementById("reviewFields");
const bookSearch = document.getElementById("bookSearch");
const bookResults = document.getElementById("bookResults");
const selectedBook = document.getElementById("selectedBook");
const starInput = document.getElementById("starInput");
const commentInput = document.getElementById("commentInput");
const saveButton = document.getElementById("saveReview");
const message = document.getElementById("addMessage");

let rating = 0;
let saving = false;
let ready = false;
let selected = null; // { id, title, authors, thumbnail }
let searchTimer = null;
let searchToken = 0; // ignores old search results that arrive late

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `mt-3 mb-0 text-${colour}`;
}

function getThumbnail(imageLinks) {
  const url = imageLinks?.smallThumbnail || imageLinks?.thumbnail || "";
  return url.replace(/^http:/, "https:");
}

function makeCover(src, title) {
  const img = document.createElement("img");
  img.src = src || "/images/book.jpg";
  img.alt = title ? `Cover of ${title}` : "Book cover";
  img.width = 40;
  img.height = 60;
  img.style.objectFit = "cover";
  img.className = "rounded flex-shrink-0";
  return img;
}

// ---------- Selected book ----------

function renderSelected() {
  selectedBook.replaceChildren();

  if (!selected) {
    selectedBook.hidden = true;
    bookSearch.hidden = false;
    return;
  }

  const row = document.createElement("div");
  row.className = "d-flex align-items-center gap-3 p-2 border rounded-3";

  const info = document.createElement("div");
  info.className = "flex-grow-1";
  info.style.minWidth = "0";

  const title = document.createElement("div");
  title.className = "fw-semibold text-break";
  title.textContent = selected.title;
  info.append(title);

  if (selected.authors) {
    const author = document.createElement("div");
    author.className = "small text-secondary";
    author.textContent = selected.authors;
    info.append(author);
  }

  const change = document.createElement("button");
  change.type = "button";
  change.className = "btn btn-outline-secondary btn-sm";
  change.textContent = "Change";
  change.addEventListener("click", () => {
    selected = null;
    renderSelected();
    bookSearch.value = "";
    bookSearch.focus();
  });

  row.append(makeCover(selected.thumbnail, selected.title), info, change);
  selectedBook.append(row);
  selectedBook.hidden = false;
  bookSearch.hidden = true;
  bookResults.hidden = true;
}

function selectBook(book) {
  selected = book;
  bookResults.replaceChildren();
  renderSelected();
}

// ---------- Search the Google Books API while typing ----------

async function searchBooks(term) {
  const token = ++searchToken;

  if (term.length < 2) {
    bookResults.replaceChildren();
    bookResults.hidden = true;
    return;
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=10&printType=books&key=${API_KEY}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (token !== searchToken) return; // the user kept typing, a newer search is coming

    bookResults.replaceChildren();
    const items = data.items ?? [];

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "list-group-item text-secondary";
      empty.textContent = "No books found.";
      bookResults.append(empty);
    }

    items.forEach((item) => {
      const v = item.volumeInfo || {};
      const book = {
        id: item.id,
        title: v.title || "Untitled",
        authors: v.authors?.join(", ") || "",
        thumbnail: getThumbnail(v.imageLinks),
      };

      const option = document.createElement("button");
      option.type = "button";
      option.className = "list-group-item list-group-item-action d-flex align-items-center gap-3";

      const text = document.createElement("div");
      text.style.minWidth = "0";
      const t = document.createElement("div");
      t.className = "fw-semibold text-break";
      t.textContent = book.title;
      text.append(t);
      if (book.authors) {
        const a = document.createElement("div");
        a.className = "small text-secondary";
        a.textContent = book.authors;
        text.append(a);
      }

      option.append(makeCover(book.thumbnail, book.title), text);
      option.addEventListener("click", () => selectBook(book));
      bookResults.append(option);
    });

    bookResults.hidden = false;
  } catch (error) {
    if (token !== searchToken) return;
    console.error("Book search failed:", error);
    bookResults.replaceChildren();
    const err = document.createElement("div");
    err.className = "list-group-item text-danger";
    err.textContent = "Could not search books. Try again.";
    bookResults.append(err);
    bookResults.hidden = false;
  }
}

bookSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchBooks(bookSearch.value.trim()), 300);
});

// Pressing Enter in the search box should not submit the review.
bookSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});

// ---------- Stars ----------

const starIcons = [];
for (let i = 1; i <= 5; i++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-link p-0 me-1 fs-2 text-warning";
  button.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
  const icon = document.createElement("i");
  icon.className = "bi bi-star";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
  button.addEventListener("click", () => {
    rating = i;
    starIcons.forEach((el, index) => {
      el.className = `bi ${index < rating ? "bi-star-fill" : "bi-star"}`;
    });
  });
  starIcons.push(icon);
  starInput.append(button);
}

// ---------- Page setup: only signed-in users can write a review ----------

onAuthReady(async (user) => {
  ready = false;
  fields.disabled = true;

  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramBookId = urlParams.get("bookid") || urlParams.get("book");
  const paramTitle = urlParams.get("title");

  const backLink = document.querySelector('a[aria-label="Back to reviews"]');
  if (backLink && paramBookId) {
    backLink.href = `./book_info.html?bookid=${encodeURIComponent(paramBookId)}`;
    backLink.setAttribute("aria-label", "Back to book details");
  }
  initializeBackLink(backLink);

  // Coming from a book page: pre-select that book.
  if (paramBookId) {
    let book = { id: paramBookId, title: paramTitle || "Selected Book", authors: "", thumbnail: "" };
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(paramBookId)}?key=${API_KEY}`
      );
      if (res.ok) {
        const v = (await res.json()).volumeInfo || {};
        book = {
          id: paramBookId,
          title: v.title || book.title,
          authors: v.authors?.join(", ") || "",
          thumbnail: getThumbnail(v.imageLinks),
        };
      }
    } catch (e) {
      console.warn("Could not fetch book from Google Books:", e);
    }
    selectBook(book);
  }

  ready = true;
  fields.disabled = false;
  showMessage("");
});

// ---------- Save ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user || !ready || saving) return;

  const comment = commentInput.value.trim();

  if (!selected) return showMessage("Please search for and choose a book.", "danger");
  if (!rating) return showMessage("Please choose a star rating.", "danger");
  if (!comment) return showMessage("Please write a comment.", "danger");

  const bookId = selected.id;
  const bookName = selected.title;

  saving = true;
  fields.disabled = true;
  saveButton.textContent = "Saving…";
  showMessage("Saving your review…");

  try {
    // 1. The review is saved under the book: books/{bookId}/review/{reviewId}
    const reviewRef = await addDoc(collection(db, "books", bookId, "review"), {
      bookName,
      userId: user.uid,
      userName: user.displayName || "Reader",
      rating,
      comment,
      createdAt: serverTimestamp(),
    });

    // 2. The review is listed in the user's myreview: users/{uid}/myreview
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { myreview: arrayUnion({ bookId, reviewId: reviewRef.id }) },
        { merge: true }
      );
    } catch (error) {
      console.error("Review saved, but could not update myreview:", error);
    }

    // 3. Ensure books/{bookId} has the title
    try {
      await setDoc(doc(db, "books", bookId), { name: bookName }, { merge: true });
    } catch (error) {
      console.error("Could not update books document:", error);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paramBookId = urlParams.get("bookid") || urlParams.get("book");
    if (paramBookId) {
      window.location.href = `./book_info.html?bookid=${encodeURIComponent(bookId)}`;
    } else {
      window.location.href = "./reviews.html";
    }
  } catch (error) {
    console.error("Could not save review:", error);
    showMessage("Could not save your review. Please try again.", "danger");
    saving = false;
    fields.disabled = false;
    saveButton.textContent = "Save";
  }
});