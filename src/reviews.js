import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, collectionGroup, doc, getDoc, getDocs } from "firebase/firestore";
import { createCover, renderStars, formatDate } from "./reviewUtils.js";

import { getBookById } from "./master.js";
import { setBookCover } from "./bookCovers.js";

// reviews.html = every review, reviews.html?mine=1 = only my reviews
const params = new URLSearchParams(window.location.search);
const mineOnly = params.get("mine") === "1";
const bookFilter =
  params.get("book") ||
  params.get("bookid");
const paramTitle = params.get("title");
const from = params.get("from");

const heading = document.getElementById("reviewsHeading");
const backLink = document.getElementById("backLink");
const searchInput = document.getElementById("reviewsSearch");
const list = document.getElementById("reviewsList");
const message = document.getElementById("reviewsMessage");
const addReviewBtn = document.querySelector('a[href="./add_review.html"]');

let allReviews = [];
const reviewCoverRequests = new Map();

heading.textContent = mineOnly
  ? "My reviews"
  : paramTitle
    ? `Reviews: ${paramTitle}`
    : "Reviews";

backLink.href = mineOnly
  ? "./profile.html"
  : from === "library"
    ? "./library.html"
    : bookFilter
      ? `./book_info.html?bookid=${encodeURIComponent(bookFilter)}`
      : "./library.html";


if (bookFilter && addReviewBtn) {
  addReviewBtn.href = `./add_review.html?bookid=${encodeURIComponent(bookFilter)}${paramTitle ? `&title=${encodeURIComponent(paramTitle)}` : ""}`;
}

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `text-${colour}`;
}

function loadReviewCover(cover, review) {
  let request = reviewCoverRequests.get(review.bookId);
  if (!request) {
    request = getBookById(review.bookId)
      .then((book) => book.volumeInfo?.imageLinks ?? null)
      .catch((error) => {
        console.warn(`Could not load cover for book ${review.bookId}:`, error);
        return null;
      });
    reviewCoverRequests.set(review.bookId, request);
  }

  request.then((imageLinks) => {
    if (imageLinks) setBookCover(cover, imageLinks, review.bookName);
  });
}

// One review row: cover, book, stars, name and a shortened comment.
function buildItem(review) {
  const link = document.createElement("a");
  link.href = `./review_detail.html?book=${encodeURIComponent(review.bookId)}&id=${encodeURIComponent(review.id)}`;
  link.className = "d-flex gap-3 text-decoration-none text-dark";

  const body = document.createElement("div");
  body.className = "flex-grow-1";
  body.style.minWidth = "0";

  const title = document.createElement("div");
  title.className = "fw-semibold text-break";
  title.textContent = review.bookName || "Book";

  const meta = document.createElement("div");
  meta.className = "small text-secondary mb-1";
  meta.append(renderStars(review.rating || 0));
  meta.append(
    ` ${review.userName || "Reader"}${review.createdAt ? " · " + formatDate(review.createdAt) : ""}`
  );

  const text = document.createElement("p");
  text.className = "mb-0 text-break";
  text.style.cssText =
    "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;";
  text.textContent = review.comment || "";

  body.append(title, meta, text);
  const cover = createCover(review.bookName);
  link.append(cover, body);
  loadReviewCover(cover, review);
  return link;
}

function render() {
  const term = searchInput.value.trim().toLowerCase();
  const shown = allReviews.filter(
    (r) =>
      !term ||
      [r.bookName, r.userName, r.comment].some((t) =>
        (t || "").toLowerCase().includes(term)
      )
  );

  list.replaceChildren();

  if (!shown.length) {
    showMessage(
      allReviews.length
        ? "No reviews match your search."
        : mineOnly
          ? "You haven't written any reviews yet. Select Add reviews to write one."
          : bookFilter
            ? "No reviews yet for this book. Select Add reviews to write the first one."
            : "No reviews yet. Select Add reviews to write the first one."
    );
    return;
  }

  showMessage("");
  shown.forEach((review) => list.append(buildItem(review)));
}

searchInput.addEventListener("input", render);

// Every review under every book: books/{bookId}/review/{reviewId}
async function loadAll() {
  const snapshot = await getDocs(collectionGroup(db, "review"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    bookId: d.ref.parent.parent.id,
    ...d.data(),
  }));
}

// Reviews specifically for one book: books/{bookId}/review
async function loadForBook(bookId) {
  const snapshot = await getDocs(collection(db, "books", bookId, "review"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    bookId,
    ...d.data(),
  }));
}

// My reviews: read the myreview list on my user document, then open each review.
async function loadMine(user) {
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const entries = (userSnap.data()?.myreview ?? []).filter(
    (e) => e?.bookId && e?.reviewId
  );

  const reviews = await Promise.all(
    entries.map(async ({ bookId, reviewId }) => {
      const snap = await getDoc(doc(db, "books", bookId, "review", reviewId));
      return snap.exists() ? { id: snap.id, bookId, ...snap.data() } : null;
    })
  );
  return reviews.filter(Boolean);
}

// Reviews are for signed-in users only.
onAuthReady(async (user) => {
  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  showMessage("Loading reviews…");

  try {
    if (mineOnly) {
      allReviews = await loadMine(user);
      if (bookFilter) {
        allReviews = allReviews.filter((r) => r.bookId === bookFilter);
      }
    } else if (bookFilter) {
      try {
        allReviews = await loadForBook(bookFilter);
      } catch (err) {
        console.warn("Could not load from book subcollection, falling back to collectionGroup:", err);
        allReviews = (await loadAll()).filter((r) => r.bookId === bookFilter);
      }
    } else {
      allReviews = await loadAll();
    }

    if (bookFilter) {
      allReviews = allReviews.filter((r) => r.bookId === bookFilter);
      if (paramTitle) {
        heading.textContent = `Reviews: ${paramTitle}`;
      } else if (allReviews.length && allReviews[0].bookName) {
        heading.textContent = `Reviews: ${allReviews[0].bookName}`;
      }
    }
    allReviews.sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
    render();
  } catch (error) {
    console.error("Could not load reviews:", error);
    showMessage("Could not load reviews. Refresh the page to try again.", "danger");
  }
});