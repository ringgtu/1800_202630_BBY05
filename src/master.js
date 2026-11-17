// This is the master code for API connection

const API_URL = "https://www.googleapis.com/books/v1/volumes";
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;

// ---------- Remember books so Google isn't asked twice ----------
const CACHE_KEY = "bookCache";
const CACHE_HOURS = 24;
const pending = new Map(); 

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}

// Keep only what the cards need, so the browser storage stays small
function saveToCache(book) {
  try {
    const cache = readCache();
    const maxAge = CACHE_HOURS * 60 * 60 * 1000;

    // Drop books saved more than 24 hours ago
    for (const id in cache) {
      if (Date.now() - cache[id].savedAt > maxAge) delete cache[id];
    }

    const info = book.volumeInfo ?? {};
    cache[book.id] = {
      savedAt: Date.now(),
      book: {
        id: book.id,
        volumeInfo: {
          title: info.title,
          authors: info.authors,
          categories: info.categories,
          publishedDate: info.publishedDate,
          description: info.description?.slice(0, 600),
          imageLinks: { thumbnail: info.imageLinks?.thumbnail },
        },
      },
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage is full or blocked: just skip caching
  }
}

// Search, record the tags & param for filter as well
export async function searchBooks({ q = "", genres = [], tags = [] } = {}) {
  try {
    const isBestseller = tags.some((t) => t.toLowerCase() === "bestseller");
    const otherTags = tags.filter((t) => t.toLowerCase() !== "bestseller");

    const mapTag = (tag) => {
      const lower = tag.toLowerCase();
      if (lower === "classic") return `subject:classics`;
      if (lower === "teen") return `subject:"young adult fiction"`;
      return `"${tag}"`;
    };

    // Build the query from every part that has a value
    const parts = [
      q.trim(),
      ...otherTags.map(mapTag),
      ...genres.map((genre) => `subject:"${genre}"`),
    ].filter(Boolean);

    if (isBestseller) {
      if (parts.length === 0) {
        parts.push(`subject:fiction ("New York Times bestseller" OR "national bestseller" OR "bestseller")`);
      } else {
        parts.push(`("bestseller" OR "bestselling" OR "best seller")`);
      }
      parts.push(`-intitle:bestseller -intitle:bestselling -intitle:bestsellers -intitle:"best seller" -intitle:"new york times" -intitle:"book review"`);
    }

    // The API requires q, so use a default for the "Recommended" list
    const query = parts.join(" ") || "subject:fiction";

    const fetchItems = async (queryString) => {
      const params = new URLSearchParams({
        q: queryString,
        maxResults: 40,
        printType: "books",
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
    };

    let items = await fetchItems(query);

    if (isBestseller) {
      // Exclude books that literally have "bestseller" or "best seller" in their title
      items = items.filter((book) => {
        const title = (book.volumeInfo?.title ?? "").toLowerCase();
        if (/bestsell|best\s*seller/i.test(title)) return false;
        if (!book.volumeInfo?.authors || book.volumeInfo.authors.length === 0) return false;
        return true;
      });

      // Fallback if the strict bestseller keywords yielded no results
      if (items.length === 0 && (q.trim() || genres.length > 0)) {
        const fallbackParts = [
          q.trim(),
          ...otherTags.map(mapTag),
          ...genres.map((genre) => `subject:"${genre}"`),
          `-intitle:bestseller -intitle:bestselling -intitle:bestsellers -intitle:"best seller"`,
        ].filter(Boolean);
        items = await fetchItems(fallbackParts.join(" "));
        items = items.filter((book) => {
          const title = (book.volumeInfo?.title ?? "").toLowerCase();
          return !/bestsell|best\s*seller/i.test(title);
        });
      }
    }

    return items;
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


// Get a book by its id (from the browser's memory if we have it, otherwise Google)
export async function getBookById(bookId) {
  const saved = readCache()[bookId];
  if (saved && Date.now() - saved.savedAt < CACHE_HOURS * 60 * 60 * 1000) {
    return saved.book;
  }

  // Same book already being fetched right now? Wait for that one.
  if (pending.has(bookId)) return pending.get(bookId);

  const request = fetch(`${API_URL}/${bookId}?key=${API_KEY}`, { method: "GET" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const book = await response.json();
      saveToCache(book);
      return book;
    })
    .finally(() => pending.delete(bookId));

  pending.set(bookId, request);
  return request;
}


// This function is for the cover of list. Cover links of the first few books, null where a book has no cover
export async function getCoverLinks(bookIds, max = 4) {
  const responses = await Promise.allSettled(bookIds.slice(0, max).map(getBookById));

  return responses.map((response) =>
    response.status === "fulfilled"
      ? response.value.volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://") ?? null
      : null
  );
}


// Sometimes the tags from googlebooksAPI can be very long like "Fiction / Mystery"
// Spliting the tags to make genre filter work properly
export function getTags(book, picked = [], max = 3) {
  const categories = (book.volumeInfo.categories ?? [])
    .flatMap((category) => category.split("/")) // "Fiction / Mystery" -> "Fiction ", "Mystery"
    .map((tag) => tag.trim())
    .filter(Boolean);

  const seen = new Set();

  return [...picked, ...categories]
    .filter((tag) => {
      const key = tag.toLowerCase(); // avoid overlap
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}
