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
import { loadLibraryBooks, searchBooks } from "./libraryBooks.js";
import { createCover } from "./reviewUtils.js";

const picker = document.getElementById("bookPicker");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("bookSearch");
const searchStatus = document.getElementById("searchStatus");
const results = document.getElementById("bookResults");
const form = document.getElementById("reviewForm");
const fields = document.getElementById("reviewFields");
const selectedCover = document.getElementById("selectedCover");
const selectedTitle = document.getElementById("selectedTitle");
const selectedAuthors = document.getElementById("selectedAuthors");
const changeButton = document.getElementById("changeBook");
const starInput = document.getElementById("starInput");
const commentInput = document.getElementById("commentInput");
const saveButton = document.getElementById("saveReview");
const message = document.getElementById("addMessage");

let selected = null; // the book being reviewed { id, title, authors, image }
let rating = 0;
let saving = false;

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `mt-3 mb-0 text-${colour}`;
}

// ---------- five clickable stars ----------
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

// ---------- step 1: pick a book ----------
function renderResults(list) {
  results.replaceChildren();
  list.forEach((book) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "list-group-item list-group-item-action d-flex gap-3 align-items-center";

    item.append(createCover(book.id, book.title, 40, book.image));

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "fw-semibold text-break";
    title.textContent = book.title;
    const authors = document.createElement("div");
    authors.className = "small text-secondary text-break";
    authors.textContent = book.authors;
    text.append(title, authors);
    item.append(text);

    item.addEventListener("click", () => selectBook(book));
    results.append(item);
  });
}

function selectBook(book) {
  selected = book;
  selectedCover.replaceChildren(createCover(book.id, book.title, 60, book.image));
  selectedTitle.textContent = book.title;
  selectedAuthors.textContent = book.authors;
  picker.hidden = true; // search disappears, stars and comment appear
  form.hidden = false;
  showMessage("");
  commentInput.focus();
}

changeButton.addEventListener("click", () => {
  if (saving) return;
  selected = null;
  form.hidden = true;
  picker.hidden = false;
  showMessage("");
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = searchInput.value.trim();
  if (!text) return;

  results.replaceChildren();
  searchStatus.textContent = "Searching…";
  try {
    const list = await searchBooks(text);
    searchStatus.textContent = list.length
      ? "Pick a book:"
      : "No books found. Try a different title, author or ISBN.";
    renderResults(list);
  } catch (error) {
    console.error(error);
    searchStatus.textContent = "Could not reach Google Books. Check your internet and try again.";
  }
});

// Reviews are for signed-in users only. Start with the books in my library.
onAuthReady(async (user) => {
  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  searchStatus.textContent = "Loading your library…";
  try {
    const books = await loadLibraryBooks(user.uid);
    if (books.length) {
      searchStatus.textContent = "From your library (or search above):";
      renderResults(books);
    } else {
      searchStatus.textContent = "Search for the book you want to review.";
    }
  } catch (error) {
    console.error("Could not load library:", error);
    searchStatus.textContent = "Search for the book you want to review.";
  }
});

// ---------- step 2: save ----------
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user || !selected || saving) return;

  const comment = commentInput.value.trim();
  if (!rating) return showMessage("Please choose a star rating.", "danger");
  if (!comment) return showMessage("Please write a comment.", "danger");

  saving = true;
  fields.disabled = true;
  saveButton.textContent = "Saving…";
  showMessage("Saving your review…");

  try {
    // 1. The review is saved under the book: books/{bookId}/review/{reviewId}
    const reviewRef = await addDoc(collection(db, "books", selected.id, "review"), {
      bookName: selected.title,
      bookImage: selected.image || "",
      userId: user.uid,
      userName: user.displayName || "Reader",
      rating,
      comment,
      createdAt: serverTimestamp(),
    });

    // 2. The review is listed in the user's myreview
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { myreview: arrayUnion({ bookId: selected.id, reviewId: reviewRef.id }) },
        { merge: true }
      );
    } catch (error) {
      console.error("Review saved, but could not update myreview:", error);
    }

    window.location.href = "./reviews.html";
  } catch (error) {
    console.error("Could not save review:", error);
    showMessage("Could not save your review. Please try again.", "danger");
    saving = false;
    fields.disabled = false;
    saveButton.textContent = "Save";
  }
});