// Small helpers shared by the review pages.
import { setBookCover } from "./bookCovers.js";

export function createCover(bookName, width = 80) {
  const cover = document.createElement("img");
  cover.className = "review-cover rounded-2 flex-shrink-0";
  cover.style.width = `${width}px`;
  cover.style.height = `${Math.round(width * 1.4)}px`;
  setBookCover(cover, null, bookName);
  return cover;
}

// Five stars, filled up to the rating.
export function renderStars(rating) {
  const wrap = document.createElement("span");
  wrap.setAttribute("aria-label", `${rating} out of 5 stars`);
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("i");
    star.className = `bi ${i <= rating ? "bi-star-fill" : "bi-star"} text-warning`;
    star.setAttribute("aria-hidden", "true");
    wrap.append(star);
  }
  return wrap;
}

// Five stars with support for half stars for average ratings.
export function renderRatingStarsWithHalves(rating) {
  const wrap = document.createElement("span");
  wrap.className = "d-inline-flex gap-1 align-items-center text-warning";
  if (!rating || rating <= 0) {
    wrap.setAttribute("aria-label", "No rating");
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("i");
      star.className = "bi bi-star text-secondary";
      star.setAttribute("aria-hidden", "true");
      wrap.append(star);
    }
    return wrap;
  }

  wrap.setAttribute("aria-label", `${rating.toFixed(1)} out of 5 stars`);
  const rounded = Math.round(rating * 2) / 2;
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("i");
    if (i <= rounded) {
      star.className = "bi bi-star-fill text-warning";
    } else if (i - 0.5 <= rounded) {
      star.className = "bi bi-star-half text-warning";
    } else {
      star.className = "bi bi-star text-warning";
    }
    star.setAttribute("aria-hidden", "true");
    wrap.append(star);
  }
  return wrap;
}

export function formatDate(timestamp) {
  return timestamp?.toDate
    ? timestamp.toDate().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
}