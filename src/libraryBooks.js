// Reads the books in the signed-in user's library (users/{uid}.book)
// and looks each one up in the Google Books API, like the library page does.
import { db } from "./firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

// Optional Google Books API key (VITE_GOOGLE_BOOKS_API_KEY in .env).
// With a key, requests use the project's own quota instead of the shared anonymous one.
const BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
const withKey = (url) =>
  BOOKS_KEY ? `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(BOOKS_KEY)}` : url;

const looksLikeIsbn = (s) => /^[\d-]{10,17}X?$/i.test(String(s).trim());
const thumb = (v) =>
  (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "").replace("http://", "https://");

// Looks one book up by Google Books ID or ISBN (no API key needed).
async function lookupBook(id) {
  const clean = String(id ?? "").trim();
  if (!clean) throw new Error("No book ID");

  const isIsbn = looksLikeIsbn(clean);
  const url = isIsbn
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean.replace(/-/g, ""))}&maxResults=1`
    : `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(clean)}`;

  const res = await fetch(withKey(url));
  if (!res.ok) throw new Error("Google Books lookup failed: " + res.status);
  const json = await res.json();
  const item = isIsbn ? json.items?.[0] : json;
  const v = item?.volumeInfo;
  if (!v) throw new Error("Book not found: " + clean);

  return {
    id: item.id ?? clean,
    title: v.title ?? clean,
    authors: (v.authors ?? []).join(", "),
    image: thumb(v),
  };
}

// Returns [{ id, title, authors, image }] for every book in my library.
export async function loadLibraryBooks(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const field = snap.exists() ? snap.data().book : null;
  if (!field || typeof field !== "object") return [];

  const ids = [];
  if (typeof field.book === "string") ids.push(field.book); // older single-book format
  for (const value of Object.values(field)) {
    if (value && typeof value === "object" && typeof value.book === "string") {
      ids.push(value.book);
    }
  }

  const results = await Promise.all(
    [...new Set(ids)].map((id) =>
      lookupBook(id).catch((error) => {
        console.warn(error); // test entries that aren't real books are skipped
        return null;
      })
    )
  );

  const seen = new Set();
  return results
    .filter(Boolean)
    .filter((b) => !seen.has(b.id) && seen.add(b.id))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// Searches the whole Google Books API by title, author or ISBN (short list).
export async function searchBooks(text) {
  const q = text.trim();
  const query = looksLikeIsbn(q) ? `isbn:${q.replace(/-/g, "")}` : q;
  const res = await fetch(
    withKey(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books`
    )
  );
  if (!res.ok) throw new Error("Search failed: " + res.status);
  const json = await res.json();
  return (json.items ?? [])
    .filter((it) => it.volumeInfo)
    .map((it) => ({
      id: it.id,
      title: it.volumeInfo.title ?? "Untitled",
      authors: (it.volumeInfo.authors ?? []).join(", "),
      image: thumb(it.volumeInfo),
    }));
}