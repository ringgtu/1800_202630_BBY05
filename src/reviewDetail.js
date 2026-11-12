import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  arrayRemove,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { createCover, renderStars, formatDate } from "./reviewUtils.js";

const message = document.getElementById("detailMessage");
const article = document.getElementById("detailReview");
const commentEl = document.getElementById("detailComment");
const editButton = document.getElementById("editReview");
const deleteButton = document.getElementById("deleteReview");
const editForm = document.getElementById("editForm");
const editFields = document.getElementById("editFields");
const editStars = document.getElementById("editStars");
const editComment = document.getElementById("editComment");
const saveButton = document.getElementById("saveEdit");
const cancelButton = document.getElementById("cancelEdit");
const actionMessage = document.getElementById("actionMessage");

let reviewRef = null;
let bookId = null;
let reviewId = null;
let review = null;
let isOwner = false;
let rating = 0;
let busy = false;

function showAction(text, colour = "secondary") {
  actionMessage.textContent = text;
  actionMessage.className = `mt-3 mb-0 text-${colour}`;
}

// Fill the page from the review data.
function render() {
  document.getElementById("detailCover").replaceChildren(
    createCover(review.bookId, review.bookName, 110, review.bookImage)
  );
  document.getElementById("detailBook").textContent = review.bookName || "Book";
  document.getElementById("detailStars").replaceChildren(renderStars(review.rating || 0));
  document.getElementById("detailMeta").textContent =
    `${review.userName || "Reader"}${review.createdAt ? " · " + formatDate(review.createdAt) : ""}${review.edited ? " · edited" : ""}`;
  commentEl.textContent = review.comment || "";
}

function showViewMode() {
  editForm.hidden = true;
  commentEl.hidden = false;
  editButton.hidden = !isOwner; // Edit shows top right, author only
}

// Five clickable stars for the edit form.
const starIcons = [];
function paintStars() {
  starIcons.forEach((icon, index) => {
    icon.className = `bi ${index < rating ? "bi-star-fill" : "bi-star"}`;
  });
}
for (let i = 1; i <= 5; i++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-link p-0 me-1 fs-2 text-warning";
  button.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
  button.addEventListener("click", () => {
    rating = i;
    paintStars();
  });
  starIcons.push(icon);
  editStars.append(button);
}

// Edit: open the form with the current rating and comment filled in.
editButton.addEventListener("click", () => {
  if (!isOwner || busy) return;
  rating = review.rating || 0;
  paintStars();
  editComment.value = review.comment || "";
  commentEl.hidden = true;
  editButton.hidden = true;
  editForm.hidden = false;
  showAction("");
  editComment.focus();
});

// Cancel: back to reading, nothing saved.
cancelButton.addEventListener("click", () => {
  if (busy) return;
  showAction("");
  showViewMode();
});

// Save the edit (only the author can do this).
editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner || busy) return;

  const comment = editComment.value.trim();
  if (!rating) return showAction("Please choose a star rating.", "danger");
  if (!comment) return showAction("Please write a comment.", "danger");

  busy = true;
  editFields.disabled = true;
  saveButton.textContent = "Saving…";
  showAction("Saving your changes…");

  try {
    await updateDoc(reviewRef, { rating, comment, editedAt: serverTimestamp() });
    review = { ...review, rating, comment, edited: true };
    render();
    showViewMode();
    showAction("Your review was updated.", "success");
  } catch (error) {
    console.error("Could not update review:", error);
    showAction("Could not save your changes. Please try again.", "danger");
  } finally {
    busy = false;
    editFields.disabled = false;
    saveButton.textContent = "Save changes";
  }
});

// Delete (only the author, and only after confirming).
deleteButton.addEventListener("click", async () => {
  if (!isOwner || busy) return;
  if (!window.confirm("Delete this review? This can't be undone.")) return;

  busy = true;
  deleteButton.disabled = true;
  showAction("Deleting…");

  try {
    await deleteDoc(reviewRef);

    // Also remove it from the user's myreview list.
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { myreview: arrayRemove({ bookId, reviewId }) },
        { merge: true }
      );
    } catch (error) {
      console.error("Review deleted, but could not update myreview:", error);
    }

    window.location.href = "./reviews.html";
  } catch (error) {
    console.error("Could not delete review:", error);
    showAction("Could not delete your review. Please try again.", "danger");
    busy = false;
    deleteButton.disabled = false;
  }
});

onAuthReady(async (user) => {
  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  bookId = params.get("book");
  reviewId = params.get("id");
  if (!bookId || !reviewId) {
    message.textContent = "No review selected.";
    return;
  }

  try {
    reviewRef = doc(db, "books", bookId, "review", reviewId);
    const snapshot = await getDoc(reviewRef);
    if (!snapshot.exists()) {
      message.textContent = "This review could not be found.";
      return;
    }

    review = { ...snapshot.data(), bookId, edited: Boolean(snapshot.data().editedAt) };
    isOwner = review.userId === auth.currentUser?.uid;

    // Reviews are personal: you can only open your own.
    if (!isOwner) {
      message.textContent = "You can only open your own reviews.";
      return;
    }

    render();
    showViewMode();
    message.textContent = "";
    article.hidden = false;
  } catch (error) {
    console.error("Could not load review:", error);
    message.textContent = "Could not load this review. Refresh the page to try again.";
    message.className = "text-danger";
  }
});