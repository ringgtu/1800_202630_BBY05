import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const form = document.getElementById("reviewForm");
const fields = document.getElementById("reviewFields");
const bookSelect = document.getElementById("bookSelect");
const starInput = document.getElementById("starInput");
const commentInput = document.getElementById("commentInput");
const saveButton = document.getElementById("saveReview");
const message = document.getElementById("addMessage");

let rating = 0;
let saving = false;
let ready = false;
const bookNames = {}; // book document id -> title

function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `mt-3 mb-0 text-${colour}`;
}

// Five clickable stars.
const starIcons = [];
for (let i = 1; i <= 5; i++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-link p-0 me-1 fs-2 text-warning";
  button.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
  const icon = document.createElement("i");
  icon.className = "bi bi-star";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
  button.addEventListener("click", () => {
    rating = i;
    starIcons.forEach((el, index) => {
      el.className = `bi ${index < rating ? "bi-star-fill" : "bi-star"}`;
    });
  });
  starIcons.push(icon);
  starInput.append(button);
}

// Only signed-in users can write a review.
onAuthReady(async (user) => {
  ready = false;
  fields.disabled = true;

  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "books"));
    const books = snapshot.docs
      .map((d) => ({ id: d.id, name: d.data().name ?? d.id }))
      .sort((a, b) => a.name.localeCompare(b.name));

    books.forEach((book) => {
      bookNames[book.id] = book.name;
      const option = document.createElement("option");
      option.value = book.id;
      option.textContent = book.name;
      bookSelect.append(option);
    });

    ready = true;
    fields.disabled = false;
    showMessage(books.length ? "" : "No books found to review yet.");
  } catch (error) {
    console.error("Could not load books:", error);
    showMessage("Could not load the books. Refresh the page to try again.", "danger");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user || !ready || saving) return;

  const bookId = bookSelect.value;
  const comment = commentInput.value.trim();

  if (!bookId) return showMessage("Please choose a book.", "danger");
  if (!rating) return showMessage("Please choose a star rating.", "danger");
  if (!comment) return showMessage("Please write a comment.", "danger");

  saving = true;
  fields.disabled = true;
  saveButton.textContent = "Saving…";
  showMessage("Saving your review…");

  try {
    // 1. The review is saved under the book: books/{bookId}/review/{reviewId}
    const reviewRef = await addDoc(collection(db, "books", bookId, "review"), {
      bookName: bookNames[bookId] || "",
      userId: user.uid,
      userName: user.displayName || "Reader",
      rating,
      comment,
      createdAt: serverTimestamp(),
    });

    // 2. The review is listed in the user's myreview: users/{uid}/myreview
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { myreview: arrayUnion({ bookId, reviewId: reviewRef.id }) },
        { merge: true }
      );
    } catch (error) {
      console.error("Review saved, but could not update myreview:", error);
    }

    window.location.href = "./reviews.html";
  } catch (error) {
    console.error("Could not save review:", error);
    showMessage("Could not save your review. Please try again.", "danger");
    saving = false;
    fields.disabled = false;
    saveButton.textContent = "Save";
  }
});