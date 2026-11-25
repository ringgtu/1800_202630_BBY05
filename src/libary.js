
import { searchBooks } from "./master.js";

const resultsContainer = document.querySelector("#results");
const heading = document.querySelector("#results-heading");

// Get the search query from the URL
const params = new URLSearchParams(window.location.search);
const query = params.get("q") ?? "";

async function displayBooks() {
    heading.textContent = `Results for "${query}"`;
    resultsContainer.innerHTML = "<p>Loading books...</p>";

    try {
        // Search using the existing Google Books API function
        const books = await searchBooks({ q: query });

        resultsContainer.innerHTML = "";

        if (books.length === 0) {
            heading.textContent = "No books found";
            resultsContainer.textContent =
                "Try searching for another book title.";
            return;
        }

        heading.textContent = `Found ${books.length} Results:`;

        books.forEach((book) => {
            const info = book.volumeInfo;

            // Create book card
            const col = document.createElement("div");
            col.className = "col";

            const card = document.createElement("div");
            card.className = "card border-0 mb-4";

            const row = document.createElement("div");
            row.className = "row g-3";

            // Book cover
            const imageCol = document.createElement("div");
            imageCol.className = "col-4 col-md-3";

            const image = document.createElement("img");
            image.src =
                info.imageLinks?.thumbnail ?? "/images/book.jpg";
            image.alt = `Cover of ${info.title ?? "book"}`;
            image.className = "img-fluid rounded book-cover";

            imageCol.appendChild(image);

            // Book information
            const textCol = document.createElement("div");
            textCol.className = "col-8 col-md-9";

            const title = document.createElement("h3");
            title.className = "h5 mb-2";

            const link = document.createElement("a");
            link.href = book_info.html;
            link.className = "book-title text-body text-decoration-none";
            link.textContent = info.title ?? "Untitled";

            title.appendChild(link);

            const authors = document.createElement("p");
            authors.className = "mb-2";
            authors.textContent =
                info.authors?.join(", ") ?? "Unknown author";

            const description = document.createElement("p");
            description.className = "mt-2 mb-0 book-desc";
            description.textContent =
                info.description?.slice(0, 200) ??
                "No description available.";

            textCol.append(title, authors, description);

            row.append(imageCol, textCol);
            card.appendChild(row);
            col.appendChild(card);

            resultsContainer.appendChild(col);
        });

    } catch (error) {
        console.error("Failed to display books:", error);

        heading.textContent = "Search Error";
        resultsContainer.textContent =
            "Unable to load books. Please try again.";
    }
}

// Run the search
if (query.trim()) {
    displayBooks();
} else {
    heading.textContent = "Please enter a book title.";
    resultsContainer.innerHTML = "";
}
