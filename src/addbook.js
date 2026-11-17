import { searchBooks } from "./master.js";
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const results = document.getElementById("results");

const noteBox = document.getElementById("noteBox");
const noteInput = document.getElementById("noteInput");
const saveBtn = document.getElementById("saveBtn");

let currentUser = null;
let selectedBook = null;


onAuthReady((user) => {
    currentUser = user;
});

searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = searchInput.value.trim();

    if (!query || !currentUser) {
        searchStatus.textContent = "Please log in to search books.";
        return;
    }

    results.innerHTML = "";
    searchStatus.textContent = "Searching...";

    noteBox.classList.add("d-none");
    saveBtn.disabled = true;
    selectedBook = null;

    try {
        const books = await searchBooks({ q: query });
        
        if (!books || books.length === 0) {
            searchStatus.textContent = "No books found.";
            return;
        }

        searchStatus.textContent = "Select a book:";

        books.forEach((book) => {
            const info = book.volumeInfo;
            const button = document.createElement("button");

            button.type = "button";
            button.className = "list-group-item list-group-item-action d-flex gap-3 align-items-center";

            const imageURL = info.imageLinks?.thumbnail?.replace("http://", "https://");

            if (imageURL) {
                const image = document.createElement("img");
                image.src = imageURL;
                image.alt = "Book cover";
                image.style.width = "55px";
                image.style.height = "80px";
                image.style.objectFit = "cover";
                button.appendChild(image);
            }

            const text = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = info.title ?? "Untitled";
            
            const author = document.createElement("div");
            author.className = "small text-muted";
            author.textContent = info.authors?.join(", ") ?? "Unknown author";

            text.append(title, author);
            button.appendChild(text);

            button.addEventListener("click", () => {
                results.querySelectorAll(".active").forEach((item) => {
                    item.classList.remove("active");
                });

                button.classList.add("active");

                selectedBook = {
                    id: book.id,
                    title: info.title ?? "Untitled",
                    authors: info.authors ?? [],
                    image: imageURL ?? ""
                };

                noteBox.classList.remove("d-none");
                saveBtn.disabled = false;
            });

            results.appendChild(button);
        });

    } catch (error) {
        console.error("Search error:", error);
        searchStatus.textContent = "Could not search for books. Please try again.";
    }
});

// 3. Handle saving the selected book using setDoc and Google Book ID as document name
saveBtn.addEventListener("click", async () => {
    if (!currentUser || !selectedBook) return;

    saveBtn.disabled = true;
    searchStatus.textContent = "Saving book...";

    try {
        const bookRef = doc(db, "users", currentUser.uid, "books", selectedBook.id);

        await setDoc(bookRef, {
            book: {
                id: selectedBook.id,
                title: selectedBook.title,
                authors: selectedBook.authors,
                image: selectedBook.image
            },
            bookInfo: {
                note: noteInput.value.trim(),
                views: 0,
                createdAt: serverTimestamp()
            }
        });

        searchStatus.textContent = "Book saved successfully!";

        searchForm.reset();
        results.innerHTML = "";
        noteInput.value = "";
        noteBox.classList.add("d-none");
        selectedBook = null;

    } catch (error) {
        console.error("Save error:", error);
        searchStatus.textContent = "Could not save the book. Please try again.";
        saveBtn.disabled = false;
    }
});