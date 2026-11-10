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

try {
  const bookData = await getBookData(bookid);
  const info = bookData.volumeInfo; 

  console.log(bookData);
  document.getElementById("title").textContent = info.title ?? "Untitled"; 
  document.getElementById("author").textContent = `By ${(info.authors ?? ["Unknown author"]).join(", ")}`; 
  document.getElementById("summary").innerHTML = info.description ?? "No description available."; 


  const coverImg = document.getElementById("cover");
  const links = info.imageLinks; 
  const coverUrl =
    links?.medium ?? links?.large ?? links?.small ?? links?.thumbnail ?? links?.smallThumbnail; 

  if (coverUrl) {
    
    coverImg.addEventListener(
      "error",
      () => {
        coverImg.src = "/images/image.png";
      },
      { once: true }
    );
    coverImg.src = coverUrl.replace("http://", "https://"); 
  } 
} catch (error) {
  console.error("Error handling form submission:", error);
}
