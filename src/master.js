const API_URL = "https://www.googleapis.com/books/v1/volumes";
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;

// Search, record the tags & param for filter as well
export async function searchBooks({ q = "", genres = [], tags = [] } = {}) {
  try {
    // Build the query from every part that has a value
    const parts = [
      q.trim(),
      ...tags.map((tag) => `"${tag}"`),
      ...genres.map((genre) => `subject:"${genre}"`),
    ].filter(Boolean);

    // The API requires q, so use a default for the "Recommended" list
    const query = parts.join(" ") || "subject:fiction";

    const params = new URLSearchParams({
      q: query,
      maxResults: 40,
      key: API_KEY,
    });

    const response = await fetch(`${API_URL}?${params}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.items ?? [];
  } catch (error) {
    console.error("Error searching books:", error);
    throw error;
  }
}


// Sort
export function sortBooks(books, sort) {
  const title = (book) => book.volumeInfo.title ?? "";
  const date = (book, fallback) => book.volumeInfo.publishedDate ?? fallback;
  const copy = [...books];

  switch (sort) {
    case "az":
      return copy.sort((a, b) => title(a).localeCompare(title(b)));
    case "za":
      return copy.sort((a, b) => title(b).localeCompare(title(a)));
    case "new":
      return copy.sort((a, b) => date(b, "").localeCompare(date(a, "")));
    case "old":
      return copy.sort((a, b) => date(a, "9999").localeCompare(date(b, "9999")));
    case "pop":
      return copy.sort(
        (a, b) => (b.volumeInfo.ratingsCount ?? 0) - (a.volumeInfo.ratingsCount ?? 0)
      );
    default:
      return copy; // no sort chosen: keep Google's order
  }
}

export async function getBookById(bookId) {
  const response = await fetch(`${API_URL}/${bookId}?key=${API_KEY}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
