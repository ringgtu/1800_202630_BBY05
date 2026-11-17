import { doc, setDoc, arrayRemove } from "firebase/firestore";
import { db } from "./firebaseConfig.js";
import { getBookById, getTags } from "./master.js";
import { getCurrentUser, getFavorites } from "./favorites.js";

const results = document.getElementById("results");
const heading = document.getElementById("results-heading");
const template = document.getElementById("book-card-template");

let unfavCount = 0;


// ---------- Helpers ----------
function stripHtml(html) {
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}


function fillHeart(heart) {
  heart.classList.replace("bi-heart", "bi-heart-fill");
}


function emptyHeart(heart) {
  heart.classList.replace("bi-heart-fill", "bi-heart");
}


function updateHeading() {
  const count = [...results.children].filter((card) => !card.hidden).length;

  if (count === 0) {
    heading.textContent = failedCount
      ? "Could not load your favorites."
      : "No favorites yet. Tap the heart on a book to save it here.";
    return;
  }

  heading.textContent =
    `${count} ${count === 1 ? "book" : "books"} saved` +
    (unfavCount ? ` (${unfavCount} could not be loaded)` : "") +
    ":";
}


async function removeFavorite(card, bookID, user) {
  card.hidden = true;
  updateHeading();

  try {
    await setDoc(
      doc(db, "users", user.uid),
      { favorites: arrayRemove(bookID) },
      { merge: true }
    );
  } catch (error) {
    console.error("Error removing favorite:", error);
    // The save failed, so bring the card back
    card.hidden = false;
    updateHeading();
  }
}


function renderBook(book, user) {
    const info = book.volumeInfo;
    const card = template.content.firstElementChild.cloneNode(true);

    // Title & link
    const title = card.querySelector(".book-title");
    title.textContent = info.title ?? "Untitled";
    title.href = `book_info.html?bookid=${book.id}`;

    // Cover 
    const thumbnail = info.imageLinks?.thumbnail;
    if (thumbnail) {
    card.querySelector(".book-cover").src = thumbnail.replace("http://", "https://");
    }

    // Description
    const text = stripHtml(info.description ?? "No description available.");
    card.querySelector(".book-desc").textContent =
    text.length > 150 ? text.slice(0, 150) + "…" : text;

    // Tag
    const tagBox = card.querySelector(".book-tags");
    getTags(book).forEach((tag) => { 
    const badge = document.createElement("span");
    badge.className = "badge rounded-pill bg-secondary-subtle text-body fw-normal fs-6 px-3 py-2";
    badge.textContent = tag; 
    tagBox.append(badge);
  });

    // Fav icon
    const button = card.querySelector(".fav-btn").closest("button");
    const heart = button.querySelector("i");
    fillHeart(heart);
    button.addEventListener("click", () => removeFavorite(card, book.id, user));

    return card;
}

async function showFavorites() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.replace("/html/login.html");
      return;
    }

    const bookIds = await getFavorites(user.uid);

    if (bookIds.length === 0) {
      heading.textContent = "No favorites yet. Tap the heart on a book to save it here.";
      return;
    }

    const responses = await Promise.allSettled([...bookIds].reverse().map(getBookById));
    const books = responses
      .filter((response) => response.status === "fulfilled")
      .map((response) => response.value);

    unfavCount = responses.length - books.length;

    results.replaceChildren(...books.map((book) => renderBook(book, user)));
    updateHeading()
  } catch (error) {
    console.error("Error loading favorites:", error);
    heading.textContent = "Something went wrong. Please try again.";
  }
}

showFavorites();
