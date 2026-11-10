import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { createCover, renderStars, formatDate } from "./reviewUtils.js";

// reviews.html = everyone's reviews, reviews.html?mine=1 = only my reviews
const mineOnly = new URLSearchParams(window.location.search).get("mine") === "1";

const heading = document.getElementById("reviewsHeading");
const backLink = document.getElementById("backLink");
const searchInput = document.getElementById("reviewsSearch");
const list = document.getElementById("reviewsList");
const message = document.getElementById("reviewsMessage");

let allReviews = [];

heading.textContent = mineOnly ? "My reviews" : "Reviews";
backLink.href = mineOnly ? "./profile.html" : "./main.html";

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `text-${colour}`;
}

// One review row: cover, book, stars, name and a shortened comment.
function buildItem(review) {
  const link = document.createElement("a");
  link.href = `./review_detail.html?id=${encodeURIComponent(review.id)}`;
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

// Reviews are for signed-in users only.
onAuthReady(async (user) => {
  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  showMessage("Loading reviews…");

  try {
    const q = mineOnly
      ? query(collection(db, "reviews"), where("userId", "==", user.uid))
      : query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allReviews = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // "Mine" is sorted here so it doesn't need a Firestore index.
    if (mineOnly) {
      allReviews.sort(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      );
    }

    render();
  } catch (error) {
    console.error("Could not load reviews:", error);
    showMessage("Could not load reviews. Refresh the page to try again.", "danger");
  }
});