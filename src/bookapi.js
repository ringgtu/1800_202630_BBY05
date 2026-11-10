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

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching book data:", error);
    throw error;
  }
}

const urlParms = new URLSearchParams(window.location.search);

const bookid = urlParms.get("bookid");
if (!bookid) {
  document.getElementById("title").textContent = "No book selected";
  return;
}

const v = bookData.volumeInfo || {};
document.getElementById("title").textContent = v.title || "Untitled";
document.getElementById("author").textContent = v.authors ? `By ${v.authors.join(", ")}` : "Unknown Author";
document.getElementById("summary").textContent = v.description || "No description available.";
const imgUrl = v.imageLinks?.medium || v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "/images/book.jpg";
document.getElementById("cover").src = imgUrl.replace("http://", "https://");
