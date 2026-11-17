<<<<<<< HEAD
import { doc, setDoc, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig.js";
import { getBookById, getTags } from "./master.js";
import { getCurrentUser, getFavorites, getUserData } from "./favorites.js";
=======
import { doc, setDoc, arrayRemove } from "firebase/firestore";
import { db } from "./firebaseConfig.js";
import { getBookById, getTags } from "./master.js";
import { getCurrentUser, getFavorites } from "./favorites.js";
>>>>>>> 6e3e478e7714128c78286773bf366d5319d89544

const results = document.getElementById("results");
const heading = document.getElementById("results-heading");
const template = document.getElementById("book-card-template");
const pageTitle = document.getElementById("page-title");
const backLink = document.getElementById("back-link"); 

const listId = new URLSearchParams(window.location.search).get("list");
if (listId) backLink.href = "lists.html"; 

const emptyText = listId 
  ? "This list is empty."
  : "No favorites yet. Tap the heart on a book to save it here.";

let failedCount = 0;


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
<<<<<<< HEAD
    heading.textContent = failedCount ? "Could not load your books." : emptyText;
    return;
  }

   heading.textContent =
    `${count} ${count === 1 ? "book" : "books"} ${listId ? "in this list" : "saved"}` +
    (failedCount ? ` (${failedCount} could not be loaded)` : "") +
=======
    heading.textContent = failedCount
      ? "Could not load your favorites."
      : "No favorites yet. Tap the heart on a book to save it here.";
    return;
  }

  heading.textContent =
    `${count} ${count === 1 ? "book" : "books"} saved` +
    (unfavCount ? ` (${unfavCount} could not be loaded)` : "") +
>>>>>>> 6e3e478e7714128c78286773bf366d5319d89544
    ":";
}


<<<<<<< HEAD
async function removeFromList(card, bookID, user) {
=======
async function removeFavorite(card, bookID, user) {
>>>>>>> 6e3e478e7714128c78286773bf366d5319d89544
  card.hidden = true;
  updateHeading();

  try {
<<<<<<< HEAD
    const userRef = doc(db, "users", user.uid);

    if (listId) {
      await setDoc(
        userRef,
        { myList: { [listId]: { books: arrayRemove(bookID), updatedAt: serverTimestamp() } } }, 
        { merge: true }
      );
    } else {
      await setDoc(userRef, { favorites: arrayRemove(bookID) }, { merge: true });
    }
  } catch (error) {
    console.error("Error removing book:", error);
=======
    await setDoc(
      doc(db, "users", user.uid),
      { favorites: arrayRemove(bookID) },
      { merge: true }
    );
  } catch (error) {
    console.error("Error removing favorite:", error);
    // The save failed, so bring the card back
>>>>>>> 6e3e478e7714128c78286773bf366d5319d89544
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

    if (listId) { // in a list the button removes the book from the list
    heart.className = "bi bi-x-lg";
    button.setAttribute("aria-label", "Remove from list");
    button.title = "Remove from list";
  } else {
    fillHeart(heart); // in Favorites every book starts as a filled heart
  }

    button.addEventListener("click", () => removeFromList(card, book.id, user));

    return card;
}

async function showBooks() { 
  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.replace("/html/login.html");
      return;
    }

    let bookIds;

    if (listId) {
      const data = await getUserData(user.uid);
      const list = data.myList?.[listId]; 

      if (!list) {
        pageTitle.textContent = "List not found";
        heading.textContent = "This list doesn't exist.";
        return;
      }

      pageTitle.textContent = list.name;
      document.title = list.name;
      bookIds = list.books ?? [];
    } else {
      bookIds = await getFavorites(user.uid);
    }

    if (bookIds.length === 0) {
      heading.textContent = emptyText; 
      return;
    }

    const responses = await Promise.allSettled([...bookIds].reverse().map(getBookById));
    const books = responses
      .filter((response) => response.status === "fulfilled")
      .map((response) => response.value);

<<<<<<< HEAD
    failedCount = responses.length - books.length;
    results.replaceChildren(...books.map((book) => renderBook(book, user)));
    updateHeading();
=======
    unfavCount = responses.length - books.length;

    results.replaceChildren(...books.map((book) => renderBook(book, user)));
    updateHeading()
>>>>>>> 6e3e478e7714128c78286773bf366d5319d89544
  } catch (error) {
    console.error("Error loading books:", error);
    heading.textContent = "Something went wrong. Please try again.";
  }
}

showBooks(); 
