import { db, auth } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { renderRatingStarsWithHalves, renderStars, formatDate } from "./reviewUtils.js";
import { Modal } from "bootstrap";
import { setBookCover } from "./bookCovers.js";

async function getBookData(bookid) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${bookid}?key=${import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching book data:", error);
    throw error;
  }
}

function cleanDescription(html) {
  if (!html) return "No description available.";
  const formatted = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
  const doc = new DOMParser().parseFromString(formatted, "text/html");
  return doc.body.textContent.trim() || "No description available.";
}

function getCleanBookSearch(v) {
  let rawTitle = (v.title || "").trim();

  // Remove bracketed info e.g. (Annotated), [Illustrated], (Peacock Edition)
  let cleanTitle = rawTitle.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");

  // Cut subtitles after colon if main title is already substantial
  if (cleanTitle.includes(":")) {
    const parts = cleanTitle.split(":");
    if (parts[0].trim().length >= 4) {
      cleanTitle = parts[0].trim();
    }
  }

  // Remove descriptors like "written by ...", "illustrated by ..."
  cleanTitle = cleanTitle
    .replace(/\b(written by|illustrated by|with \d+ illustrations|a novel|volume \d+)\b.*/i, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let cleanAuthor = (v.authors?.[0] || "")
    .replace(/^(by|edited by|dr\.|prof\.)\s+/i, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTitle) cleanTitle = rawTitle;

  const combined = `${cleanTitle} ${cleanAuthor}`.trim() || cleanTitle || "books";

  return {
    title: cleanTitle,
    author: cleanAuthor,
    combined,
  };
}

function renderRetailers(bookData, v) {
  const container = document.getElementById("retailerList");
  if (!container) return;

  const search = getCleanBookSearch(v);

  // Real price from Google Books API if available
  const sale = bookData.saleInfo || {};
  let googlePriceBadge = "Check Store";
  if (sale.saleability === "FREE") {
    googlePriceBadge = "Free";
  } else if (sale.retailPrice?.amount) {
    const raw = sale.retailPrice.amount;
    const isUSD = (sale.retailPrice.currencyCode || "").toUpperCase() === "USD";
    const amountCAD = isUSD ? raw * 1.38 : raw;
    googlePriceBadge = `$${amountCAD.toFixed(2)} CAD`;
  }

  const directBuyLink = sale.buyLink || null;

  const retailers = [
    {
      name: "Google Play Books",
      badge: directBuyLink ? "Direct Purchase Page" : "Google Play Store",
      icon: "bi-google-play",
      price: googlePriceBadge,
      url: directBuyLink || `https://play.google.com/store/search?q=${encodeURIComponent(search.combined)}&c=books`,
    },
    {
      name: "Amazon.ca",
      badge: "Amazon Canada Books",
      icon: "bi-bag-check",
      price: "Check Price",
      url: `https://www.amazon.ca/s?k=${encodeURIComponent(search.combined)}&i=stripbooks`,
    },
    {
      name: "Google Shopping (Canada)",
      badge: "Compare Live Canadian Store Prices",
      icon: "bi-search",
      price: "Live Compare",
      url: `https://www.google.ca/search?tbm=shop&q=${encodeURIComponent(search.combined + " book canada")}`,
    },
    {
      name: "Kobo Canada",
      badge: "eBook & Audiobook",
      icon: "bi-tablet",
      price: "Check Price",
      url: `https://www.kobo.com/ca/en/search?query=${encodeURIComponent(search.combined)}`,
    },
    {
      name: "AbeBooks Canada",
      badge: "Canadian Used & New Bookstores",
      icon: "bi-shop",
      price: "Check Price",
      url: `https://www.abebooks.com/servlet/SearchResults?tn=${encodeURIComponent(search.title)}&an=${encodeURIComponent(search.author)}&destination=CA&currency=CAD`,
    },
  ];

  container.innerHTML = "";
  retailers.forEach((r) => {
    const row = document.createElement("a");
    row.href = r.url;
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    row.className =
      "list-group-item list-group-item-action d-flex justify-content-between align-items-center rounded-3 border p-3 text-decoration-none";
    row.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <i class="bi ${r.icon} fs-4 text-secondary"></i>
        <div>
          <div class="fw-semibold text-dark">${r.name}</div>
          <small class="text-muted">${r.badge}</small>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-secondary-subtle text-dark fs-6 fw-normal px-2 py-1">${r.price}</span>
        <i class="bi bi-box-arrow-up-right text-muted small"></i>
      </div>
    `;
    container.append(row);
  });
}

let currentBookData = null;
let modalRating = 0;
let modalSaving = false;

function scrollToReviews() {
  document.getElementById("reviewsSection")?.scrollIntoView({ behavior: "smooth" });
}

function initEvents() {
  const whereToBuyBtn = document.getElementById("whereToBuyBtn");
  if (whereToBuyBtn) {
    whereToBuyBtn.addEventListener("click", () => {
      document.getElementById("whereToBuySection")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Second line with reviews: make all elements scroll to reviews section
  const clickableItems = [
    document.getElementById("ratingItem"),
    document.getElementById("ratingsCountItem"),
    document.getElementById("reviewsCountItem"),
  ];

  clickableItems.forEach((el) => {
    if (!el) return;
    el.addEventListener("click", scrollToReviews);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        scrollToReviews();
      }
    });
  });
}

async function loadReviewsAndRatings(bookid, bookData) {
  const v = bookData?.volumeInfo || {};
  const starIconsEl = document.getElementById("starIcons");
  const ratingScoreEl = document.getElementById("ratingScore");
  const ratingsCountEl = document.getElementById("ratingsCount");
  const reviewsCountEl = document.getElementById("reviewsCount");
  const reviewsListEl = document.getElementById("bookReviewsList");

  const googleRating = typeof v.averageRating === "number" ? v.averageRating : null;
  const googleRatingsCount = typeof v.ratingsCount === "number" ? v.ratingsCount : 0;

  let firestoreReviews = [];
  try {
    const snap = await getDocs(collection(db, "books", bookid, "review"));
    firestoreReviews = snap.docs.map((d) => ({
      id: d.id,
      bookId: bookid,
      ...d.data(),
    }));
    firestoreReviews.sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
  } catch (error) {
    console.error("Could not load Firestore reviews:", error);
  }

  const firestoreCount = firestoreReviews.length;
  const totalRatingsCount = googleRatingsCount + firestoreCount;

  let avgRating = null;
  if (googleRating !== null && googleRatingsCount > 0) {
    if (firestoreCount > 0) {
      const firestoreTotal = firestoreReviews.reduce(
        (sum, r) => sum + (Number(r.rating) || 0),
        0
      );
      avgRating =
        (googleRating * googleRatingsCount + firestoreTotal) / totalRatingsCount;
    } else {
      avgRating = googleRating;
    }
  } else if (googleRating !== null) {
    avgRating = googleRating;
  } else if (firestoreCount > 0) {
    const firestoreTotal = firestoreReviews.reduce(
      (sum, r) => sum + (Number(r.rating) || 0),
      0
    );
    avgRating = firestoreTotal / firestoreCount;
  }

  // Update second line
  if (starIconsEl) {
    starIconsEl.replaceChildren(renderRatingStarsWithHalves(avgRating));
  }
  if (ratingScoreEl) {
    ratingScoreEl.textContent = avgRating !== null ? avgRating.toFixed(1) : "No rating";
  }
  if (ratingsCountEl) {
    ratingsCountEl.textContent =
      totalRatingsCount > 0
        ? `${totalRatingsCount.toLocaleString()} ${totalRatingsCount === 1 ? "rating" : "ratings"}`
        : "0 ratings";
  }
  if (reviewsCountEl) {
    reviewsCountEl.textContent = `${firestoreCount.toLocaleString()} ${firestoreCount === 1 ? "review" : "reviews"}`;
  }

  // Render reviews list
  if (!reviewsListEl) return;
  reviewsListEl.replaceChildren();

  if (firestoreCount === 0) {
    const emptyNotice = document.createElement("div");
    emptyNotice.className = "text-center py-4";
    emptyNotice.innerHTML = `
      <p class="text-secondary mb-3">No reviews yet for this book.</p>
      <button type="button" class="btn btn-secondary btn-sm" data-bs-toggle="modal" data-bs-target="#addReviewModal">
        <i class="bi bi-pencil-square me-1"></i> Be the first to write a review
      </button>
    `;
    reviewsListEl.append(emptyNotice);
    return;
  }

  const currentUserId = auth.currentUser?.uid;

  firestoreReviews.forEach((review) => {
    const card = document.createElement("div");
    card.className = "border rounded-3 p-3 bg-body-tertiary";

    const topRow = document.createElement("div");
    topRow.className = "d-flex justify-content-between align-items-start mb-2";

    const metaWrap = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "fw-semibold text-dark";
    nameEl.textContent = review.userName || "Reader";

    const subMeta = document.createElement("div");
    subMeta.className = "small text-secondary d-flex align-items-center gap-2 mt-1";
    subMeta.append(renderStars(review.rating || 0));

    if (review.createdAt) {
      const dateEl = document.createElement("span");
      dateEl.textContent = formatDate(review.createdAt);
      subMeta.append(dateEl);
    }

    metaWrap.append(nameEl, subMeta);
    topRow.append(metaWrap);

    if (currentUserId && review.userId === currentUserId) {
      const editBtn = document.createElement("a");
      editBtn.href = `./review_detail.html?book=${encodeURIComponent(bookid)}&id=${encodeURIComponent(review.id)}`;
      editBtn.className = "btn btn-outline-secondary btn-sm";
      editBtn.textContent = "Edit";
      topRow.append(editBtn);
    }

    const commentEl = document.createElement("p");
    commentEl.className = "mb-0 text-break";
    commentEl.style.whiteSpace = "pre-wrap";
    commentEl.textContent = review.comment || "";

    card.append(topRow, commentEl);
    reviewsListEl.append(card);
  });
}

function initReviewModal(bookid, bookData) {
  const form = document.getElementById("modalReviewForm");
  const authPrompt = document.getElementById("modalAuthPrompt");
  const starContainer = document.getElementById("modalStarInput");
  const commentInput = document.getElementById("modalCommentInput");
  const messageEl = document.getElementById("modalReviewMessage");
  const submitBtn = document.getElementById("modalSubmitReview");

  if (!form || !starContainer) return;

  starContainer.replaceChildren();
  const starIcons = [];
  for (let i = 1; i <= 5; i++) {
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = "btn btn-link p-0 me-1 fs-3 text-warning border-0";
    starBtn.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);

    const icon = document.createElement("i");
    icon.className = "bi bi-star";
    starBtn.append(icon);

    starBtn.addEventListener("click", () => {
      modalRating = i;
      starIcons.forEach((st, idx) => {
        st.className = `bi ${idx < modalRating ? "bi-star-fill" : "bi-star"}`;
      });
    });

    starIcons.push(icon);
    starContainer.append(starBtn);
  }

  onAuthReady((user) => {
    if (user) {
      form.hidden = false;
      authPrompt.hidden = true;
    } else {
      form.hidden = true;
      authPrompt.hidden = false;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      messageEl.textContent = "Please log in to submit a review.";
      messageEl.className = "small mb-3 text-danger";
      return;
    }

    if (!modalRating) {
      messageEl.textContent = "Please select a star rating.";
      messageEl.className = "small mb-3 text-danger";
      return;
    }

    const comment = commentInput.value.trim();
    if (!comment) {
      messageEl.textContent = "Please write a comment.";
      messageEl.className = "small mb-3 text-danger";
      return;
    }

    modalSaving = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    messageEl.textContent = "Saving your review…";
    messageEl.className = "small mb-3 text-secondary";

    try {
      const v = bookData?.volumeInfo || {};
      const currentTitle = v.title || document.getElementById("title")?.textContent || "Book";

      // 1. Save under books/{bookid}/review/{reviewId}
      const reviewRef = await addDoc(collection(db, "books", bookid, "review"), {
        bookName: currentTitle,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "Reader",
        rating: modalRating,
        comment,
        createdAt: serverTimestamp(),
      });

      // 2. Add to user's myreview list
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { myreview: arrayUnion({ bookId: bookid, reviewId: reviewRef.id }) },
          { merge: true }
        );
      } catch (err) {
        console.error("Could not update myreview:", err);
      }

      // 3. Ensure books/{bookid} has book info for dropdowns
      try {
        await setDoc(doc(db, "books", bookid), { name: currentTitle }, { merge: true });
      } catch (err) {
        console.error("Could not update books document:", err);
      }

      // Hide modal
      const modalEl = document.getElementById("addReviewModal");
      const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl);
      modalInstance?.hide();

      // Reset form
      form.reset();
      modalRating = 0;
      starIcons.forEach((st) => (st.className = "bi bi-star"));
      messageEl.textContent = "";

      // Refresh reviews & second line
      await loadReviewsAndRatings(bookid, bookData);
    } catch (err) {
      console.error("Error saving review:", err);
      messageEl.textContent = "Could not save your review. Please try again.";
      messageEl.className = "small mb-3 text-danger";
    } finally {
      modalSaving = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });
}

async function loadBook() {
  const urlParms = new URLSearchParams(window.location.search);
  const bookid = urlParms.get("bookid");

  if (!bookid) {
    const titleEl = document.getElementById("title");
    if (titleEl) titleEl.textContent = "No book selected";
    return;
  }

  try {
    const bookData = await getBookData(bookid);
    currentBookData = bookData;
    const v = bookData.volumeInfo || {};

    const titleEl = document.getElementById("title");
    if (titleEl) titleEl.textContent = v.title || "Untitled";

    const authorEl = document.getElementById("author");
    if (authorEl) {
      authorEl.textContent = v.authors?.length ? `By ${v.authors.join(", ")}` : "Unknown Author";
    }

    const summaryEl = document.getElementById("summary");
    if (summaryEl) {
      summaryEl.style.whiteSpace = "pre-line";
      summaryEl.textContent = cleanDescription(v.description);
    }

    const coverEl = document.getElementById("cover");
    if (coverEl) {
      setBookCover(coverEl, v.imageLinks, v.title);
    }

    renderRetailers(bookData, v);
    await loadReviewsAndRatings(bookid, bookData);
    initReviewModal(bookid, bookData);

    // Re-render when auth changes so Edit buttons appear/disappear
    onAuthReady(() => {
      loadReviewsAndRatings(bookid, currentBookData);
    });
  } catch (error) {
    console.error("Error loading book data:", error);
    const summaryEl = document.getElementById("summary");
    if (summaryEl) {
      summaryEl.textContent = "Could not load book details. Please try again.";
    }
  }
}

initEvents();
loadBook();
