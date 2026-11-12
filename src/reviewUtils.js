// Small helpers shared by the review pages.
const palette = [
  ["#7a2e2e", "#4d1717", "#f2d9a0"],
  ["#1f4e79", "#0e2a47", "#bfe3f5"],
  ["#2f6b4f", "#173a2a", "#e6f0c2"],
  ["#6b3f7a", "#3a1f45", "#f0d6f7"],
];

// The book cover. Uses the real cover from Google Books when we have one,
// otherwise a coloured cover with the title on it.
export function createCover(bookId, bookName, width = 80, image = "") {
  const height = Math.round(width * 1.4);

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = `Cover of ${bookName || "book"}`;
    img.className = "rounded-2 flex-shrink-0";
    img.style.cssText = `width:${width}px;height:${height}px;object-fit:cover;box-shadow:0 2px 6px rgba(0,0,0,.3);`;
    img.addEventListener("error", () => img.replaceWith(createCover(bookId, bookName, width)));
    return img;
  }

  let n = 0;
  for (const ch of String(bookId || "")) n += ch.charCodeAt(0);
  const [c1, c2, ink] = palette[n % palette.length];
  const cover = document.createElement("div");
  cover.className =
    "d-flex align-items-center justify-content-center text-center rounded-2 flex-shrink-0 p-1 fw-semibold";
  cover.style.cssText = `width:${width}px;height:${height}px;background:linear-gradient(135deg,${c1},${c2});color:${ink};font-family:Georgia,serif;font-size:${width > 100 ? 1.2 : 0.8}rem;overflow:hidden;`;
  cover.textContent = bookName || "Book";
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

export function formatDate(timestamp) {
  return timestamp?.toDate
    ? timestamp.toDate().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
}