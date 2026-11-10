import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collectionGroup, doc, getDoc, getDocs } from "firebase/firestore";
import { createCover, renderStars, formatDate } from "./reviewUtils.js";

// reviews.html = every review, reviews.html?mine=1 = only my reviews
const mineOnly = new URLSearchParams(window.location.search).get("mine") === "1";

const heading = document.getElementById("reviewsHeading");
const backLink = document.getElementById("backLink");
const searchInput = document.getElementById("reviewsSearch");
const list = document.getElementById("reviewsList");
const message = document.getElementById("reviewsMessage");

let allReviews = [];

heading.textContent = mineOnly ? "My reviews" : "Reviews";
backLink.href = mineOnly ? "./profile.html" : "./library.html";

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `text-${colour}`;
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
  link.append(createCover(review.bookId, review.bookName), body);
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
    allReviews = mineOnly ? await loadMine(user) : await loadAll();
    allReviews.sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
    render();
  } catch (error) {
    console.error("Could not load reviews:", error);
    showMessage("Could not load reviews. Refresh the page to try again.", "danger");
  }
});