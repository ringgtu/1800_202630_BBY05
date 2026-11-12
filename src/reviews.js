import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { doc, getDoc } from "firebase/firestore";
import { createCover } from "./reviewUtils.js";

// This page only shows the signed-in user's own reviews.
// ?mine=1 just means "I came from my profile", so the back arrow goes there.
const fromProfile = new URLSearchParams(window.location.search).get("mine") === "1";

const heading = document.getElementById("reviewsHeading");
const backLink = document.getElementById("backLink");
const searchInput = document.getElementById("reviewsSearch");
const list = document.getElementById("reviewsList");
const message = document.getElementById("reviewsMessage");

let allReviews = [];

heading.textContent = "My reviews";
backLink.href = fromProfile ? "./profile.html" : "./library.html";

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `text-${colour}`;
}

// One row: just the book cover and title.
// Open it to see the stars, the date and the full comment.
function buildItem(review) {
  const link = document.createElement("a");
  link.href = `./review_detail.html?book=${encodeURIComponent(review.bookId)}&id=${encodeURIComponent(review.id)}`;
  link.className = "d-flex gap-3 align-items-center text-decoration-none text-dark";

  const title = document.createElement("div");
  title.className = "fw-semibold fs-5 text-break flex-grow-1";
  title.textContent = review.bookName || "Book";

  const arrow = document.createElement("i");
  arrow.className = "bi bi-chevron-right text-secondary";
  arrow.setAttribute("aria-hidden", "true");

  link.append(createCover(review.bookId, review.bookName, 80, review.bookImage), title, arrow);
  return link;
}

function render() {
  const term = searchInput.value.trim().toLowerCase();
  const shown = allReviews.filter(
    (r) =>
      !term ||
      [r.bookName].some((t) => (t || "").toLowerCase().includes(term))
  );

  list.replaceChildren();

  if (!shown.length) {
    showMessage(
      allReviews.length
        ? "No reviews match your search."
        : "You haven't written any reviews yet. Select Add reviews to review a book from your library."
    );
    return;
  }

  showMessage("");
  shown.forEach((review) => list.append(buildItem(review)));
}

searchInput.addEventListener("input", render);

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

onAuthReady(async (user) => {
  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  showMessage("Loading your reviews…");

  try {
    allReviews = await loadMine(user);
    allReviews.sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
    render();
  } catch (error) {
    console.error("Could not load reviews:", error);
    showMessage("Could not load reviews. Refresh the page to try again.", "danger");
  }
});