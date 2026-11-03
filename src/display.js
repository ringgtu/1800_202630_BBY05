// This code is for display the book from the API. To achieve the goal, the first 
// book card placeholder will be selected as a reference and renderBook() will gather
// the info and replace it. After the user do the action, 
import { searchBooks, sortBooks } from "./master.js";

const params = new URLSearchParams(window.location.search);
const q = params.get("q") ?? "";
const sort = params.get("sort") ?? "";
const genres = params.getAll("genre");   
const tags = params.getAll("tag");       

const results = document.getElementById("results");
const heading = document.getElementById("results-heading");
const searchInput = document.getElementById("search-input");

// Keep a copy of placeholder card to use as a pattern
const cardPattern = results.firstElementChild.cloneNode(true);

// Put the current keyword back in the search box
searchInput.value = q;

// Sort/Filter links carry the current search with them
document.querySelectorAll("[data-keep-params]").forEach((link) => {
  const page = link.getAttribute("href").split("?")[0];
  link.href = `${page}?${params}`;
});

// Strip description to plain text
function stripHtml(html) {
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}


function renderBook(book) {
    const info = book.volumeInfo;
    const card = cardPattern.cloneNode(true);

    // Title & link 
    const title = card.querySelector(".book-title");
    title.textContent = info.title ?? "Untitled";
    title.href = `book_info.html?bookid=${book.id}`;

    // Book cover (keep it as placeholder if the book has none)
    const thumbnail = info.imageLinks?.thumbnail;
    if (thumbnail) {
        card.querySelector(".book-cover").src = thumbnail.replace("http://", "https://");
    }

    // Short Description
    const text = stripHtml(info.description ?? "No description available.");
    card.querySelector(".book-desc").textContent =
    text.length > 150 ? text.slice(0, 150) + "…" : text;

    // Tags: remove the placeholder
    const tagBox = card.querySelector(".book-tags");
     tagBox.querySelectorAll(".badge").forEach((badge) => badge.remove());
    (info.categories ?? []).slice(0, 3).forEach((category) => {
        const badge = document.createElement("span");
        badge.className = "badge rounded-pill bg-secondary-subtle text-body fw-normal fs-6 px-3 py-2";
        badge.textContent = category;
        tagBox.append(badge);
    });

    return card;
}


// There will be 4 recommended book appear on search.html, if the user refresh the page it will provide random 4 book cards
// I did some research and found Fisher-Yates shuffle, returns a randomly ordered copy of the array
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}


try {
  const books = sortBooks(await searchBooks({ q, genres, tags }), sort);
  const isSearching = q || sort || genres.length > 0 || tags.length > 0; // Check Search/Sort/Filter 

  if (isSearching) {
    // After Action
    heading.textContent = books.length
      ? `Found ${books.length} Results:`
      : "No books found. Try fewer filters.";
    results.replaceChildren(...books.map(renderBook));
  } else {
    // Before action
    heading.textContent = "Recommended:";
    results.replaceChildren(...shuffle(books).slice(0, 4).map(renderBook));
  }
} catch (error) {
  console.error("Error loading books:", error);
  heading.textContent = "Something went wrong. Please try again.";
  results.replaceChildren();
}
