async function getBookData(bookname) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${bookname}?key=${import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}`,
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

try {
  const bookData = await getBookData(bookid);
  console.log(bookData);
  document.getElementById("title").textContent = bookData.volumeInfo.title;
  document.getElementById("author").textContent = `By ${bookData.volumeInfo.authors.join(", ")}`;
  document.getElementById("summary").innerHTML = bookData.volumeInfo.description;
  document.getElementById("cover").src = bookData.volumeInfo.imageLinks.medium;
} catch (error) {
  console.error("Error handling form submission:", error);
}
