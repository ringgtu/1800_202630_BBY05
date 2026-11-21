// This code is for display the book from the API. To achieve the goal, the first 
// book card placeholder will be selected as a reference and renderBook() will gather
// the info and replace it. After the user do the action, 
import { doc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebaseConfig.js"; 
import { searchBooks, sortBooks, getRecommendedBooks, getTags, getBookById } from "./master.js";
import { getCurrentUser, getUserData } from "./favorites.js";
import { setBookCover } from "./bookCovers.js";

const params = new URLSearchParams(window.location.search);

// Search
const q = params.get("q") ?? "";

// Sort 
const sort = params.get("sort") ?? "";

// Filter
const genres = [...new Set(params.getAll("genre"))]; 
const tags = [...new Set(params.getAll("tag"))]; 

// After action
const results = document.getElementById("results");
const heading = document.getElementById("results-heading");
const searchInput = document.getElementById("search-input");

// Keep a copy of placeholder card to use as a pattern
const template = document.getElementById("book-card-template");

// Sort label for displaying
const sortLabels = {
  az: "Alphabet (A-Z)",
  za: "Alphabet (Z-A)",
  new: "Release Date (Newest)",
  old: "Release Date (Oldest)",
  pop: "Most Popular",
};

// Put the current keyword back in the search box
searchInput.value = q;

// Sort/Filter links carry the current search with them
document.querySelectorAll("[data-keep-params]").forEach((link) => {
  const page = link.getAttribute("href").split("?")[0];
  link.href = `${page}?${params}`;
});

let currentUser = null;
let favorites = [];
let myGenre = "";
try {
  currentUser = await getCurrentUser();

  if (currentUser) {
    const data = await getUserData(currentUser.uid); 
    favorites = data.favorites ?? [];
    myGenre = (data.identity ?? "").trim(); 
  }
} catch (error) {
  console.error("Error loading favorites:", error);
}

// Strip description to plain text
function stripHtml(html) {
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

// ---------- Heart (favorite) ----------
function fillHeart(heart) {
  heart.classList.replace("bi-heart", "bi-heart-fill");
}

function emptyHeart(heart) {
  heart.classList.replace("bi-heart-fill", "bi-heart");
}

function setupHeart(card, bookID) {
  const button = card.querySelector(".fav-btn"); 
  const heart = button.querySelector("i");      

  if (favorites.includes(bookID)) {
    fillHeart(heart);
  }

  button.addEventListener("click", function () {
    toggleFavorite(heart, bookID);
  });
}
async function toggleFavorite(heart, bookID) {
  if (!currentUser) {
    alert("Please log in to save favorites.");
    return;
  }

  const wasFilled = heart.classList.contains("bi-heart-fill");

  if (wasFilled) {
    emptyHeart(heart);
  } else {
    fillHeart(heart);
  }

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(
      userRef,
      { favorites: wasFilled ? arrayRemove(bookID) : arrayUnion(bookID) },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving favorite:", error);

    if (wasFilled) {
      fillHeart(heart);
    } else {
      emptyHeart(heart);
    }
  }
}

function renderBook(book) {
  const info = book.volumeInfo;
  const card = template.content.firstElementChild.cloneNode(true);

    // Title & link 
    const title = card.querySelector(".book-title");
    title.textContent = info.title ?? "Untitled";
    title.href = `book_info.html?bookid=${book.id}`;

    setBookCover(
      card.querySelector(".book-cover"),
      info.imageLinks,
      info.title,
      () => getBookById(book.id).then((fullBook) => fullBook.volumeInfo?.imageLinks)
    );

    // Short Description
    const text = stripHtml(info.description ?? "No description available.");
    card.querySelector(".book-desc").textContent =
    text.length > 150 ? text.slice(0, 150) + "…" : text;

    // Tags: remove the placeholder
    const tagBox = card.querySelector(".book-tags");
    getTags(book, genres).forEach((tag) => { 
    const badge = document.createElement("span");
    badge.className = "badge rounded-pill bg-secondary-subtle text-body fw-normal fs-6 px-3 py-2";
    badge.textContent = tag; // CHANGED
    tagBox.append(badge);
  });

    setupHeart(card, book.id);

    return card;
}


// Display sort option
function buildHeading(count) {
  const picked = [...genres, ...tags];
  const byText = picked.length ? ` by ${picked.join(", ")}` : "";
  const sortText = sortLabels[sort] ? `, sort by ${sortLabels[sort]}` : "";
  const word = count === 1 ? "Result" : "Results";

  return `Found ${count} ${word}${byText}${sortText}:`;
}

try {
  const isSearching = q || sort || genres.length > 0 || tags.length > 0;

  if (isSearching) {
    // After search / sort / filter
    const books = sortBooks(await searchBooks({ q, genres, tags }), sort);

    heading.textContent = books.length
      ? buildHeading(books.length)
      : "No books found. Try fewer filters.";
    results.replaceChildren(...books.map(renderBook));
  } else {
    // Before any action: display 4 random books from My genre when it is set
    const { books, matchedGenre } = await getRecommendedBooks(myGenre);

    heading.textContent = matchedGenre ? `Recommended for you: ${matchedGenre}` : "Recommended:";
    results.replaceChildren(...books.map(renderBook));
  }
} catch (error) {
  console.error("Error loading books:", error);
  heading.textContent = "Something went wrong. Please try again.";
  results.replaceChildren();
}
