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

function cleanDescription(html) {
  if (!html) return "No description available.";
  const formatted = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
  const doc = new DOMParser().parseFromString(formatted, "text/html");
  return doc.body.textContent.trim() || "No description available.";
}

function getCleanBookSearch(v) {
  let rawTitle = (v.title || "").trim();

  // Remove bracketed info e.g. (Annotated), [Illustrated], (Peacock Edition)
  let cleanTitle = rawTitle.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");

  // Cut subtitles after colon if main title is already substantial
  if (cleanTitle.includes(":")) {
    const parts = cleanTitle.split(":");
    if (parts[0].trim().length >= 4) {
      cleanTitle = parts[0].trim();
    }
  }

  // Remove descriptors like "written by ...", "illustrated by ..."
  cleanTitle = cleanTitle
    .replace(/\b(written by|illustrated by|with \d+ illustrations|a novel|volume \d+)\b.*/i, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let cleanAuthor = (v.authors?.[0] || "")
    .replace(/^(by|edited by|dr\.|prof\.)\s+/i, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTitle) cleanTitle = rawTitle;

  const combined = `${cleanTitle} ${cleanAuthor}`.trim() || cleanTitle || "books";

  return {
    title: cleanTitle,
    author: cleanAuthor,
    combined,
  };
}

function renderRetailers(bookData, v) {
  const container = document.getElementById("retailerList");
  if (!container) return;

  const search = getCleanBookSearch(v);

  // Real price from Google Books API if available
  const sale = bookData.saleInfo || {};
  let googlePriceBadge = "Check Store";
  if (sale.saleability === "FREE") {
    googlePriceBadge = "Free";
  } else if (sale.retailPrice?.amount) {
    const raw = sale.retailPrice.amount;
    const isUSD = (sale.retailPrice.currencyCode || "").toUpperCase() === "USD";
    const amountCAD = isUSD ? raw * 1.38 : raw;
    googlePriceBadge = `$${amountCAD.toFixed(2)} CAD`;
  }

  const directBuyLink = sale.buyLink || null;

  const retailers = [
    {
      name: "Google Play Books",
      badge: directBuyLink ? "Direct Purchase Page" : "Google Play Store",
      icon: "bi-google-play",
      price: googlePriceBadge,
      url: directBuyLink || `https://play.google.com/store/search?q=${encodeURIComponent(search.combined)}&c=books`,
    },
    {
      name: "Amazon.ca",
      badge: "Amazon Canada Books",
      icon: "bi-bag-check",
      price: "Check Price",
      url: `https://www.amazon.ca/s?k=${encodeURIComponent(search.combined)}&i=stripbooks`,
    },
    {
      name: "Google Shopping (Canada)",
      badge: "Compare Live Canadian Store Prices",
      icon: "bi-search",
      price: "Live Compare",
      url: `https://www.google.ca/search?tbm=shop&q=${encodeURIComponent(search.combined + " book canada")}`,
    },
    {
      name: "Kobo Canada",
      badge: "eBook & Audiobook",
      icon: "bi-tablet",
      price: "Check Price",
      url: `https://www.kobo.com/ca/en/search?query=${encodeURIComponent(search.combined)}`,
    },
    {
      name: "AbeBooks Canada",
      badge: "Canadian Used & New Bookstores",
      icon: "bi-shop",
      price: "Check Price",
      url: `https://www.abebooks.com/servlet/SearchResults?tn=${encodeURIComponent(search.title)}&an=${encodeURIComponent(search.author)}&destination=CA&currency=CAD`,
    },
  ];

  container.innerHTML = "";
  retailers.forEach((r) => {
    const row = document.createElement("a");
    row.href = r.url;
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    row.className =
      "list-group-item list-group-item-action d-flex justify-content-between align-items-center rounded-3 border p-3 text-decoration-none";
    row.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <i class="bi ${r.icon} fs-4 text-secondary"></i>
        <div>
          <div class="fw-semibold text-dark">${r.name}</div>
          <small class="text-muted">${r.badge}</small>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-secondary-subtle text-dark fs-6 fw-normal px-2 py-1">${r.price}</span>
        <i class="bi bi-box-arrow-up-right text-muted small"></i>
      </div>
    `;
    container.append(row);
  });
}

function initEvents() {
  const whereToBuyBtn = document.getElementById("whereToBuyBtn");
  if (whereToBuyBtn) {
    whereToBuyBtn.addEventListener("click", () => {
      document.getElementById("whereToBuySection")?.scrollIntoView({ behavior: "smooth" });
    });
  }
}

async function loadBook() {
  const urlParms = new URLSearchParams(window.location.search);
  const bookid = urlParms.get("bookid");

  if (!bookid) {
    const titleEl = document.getElementById("title");
    if (titleEl) titleEl.textContent = "No book selected";
    return;
  }

  try {
    const bookData = await getBookData(bookid);
    const v = bookData.volumeInfo || {};

    const titleEl = document.getElementById("title");
    if (titleEl) titleEl.textContent = v.title || "Untitled";

    const authorEl = document.getElementById("author");
    if (authorEl) {
      authorEl.textContent = v.authors?.length ? `By ${v.authors.join(", ")}` : "Unknown Author";
    }

    const summaryEl = document.getElementById("summary");
    if (summaryEl) {
      summaryEl.style.whiteSpace = "pre-line";
      summaryEl.textContent = cleanDescription(v.description);
    }

    const coverEl = document.getElementById("cover");
    if (coverEl) {
      const imgUrl =
        v.imageLinks?.medium || v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "/images/book.jpg";
      coverEl.src = imgUrl.replace("http://", "https://");
    }

    renderRetailers(bookData, v);
  } catch (error) {
    console.error("Error loading book data:", error);
    const summaryEl = document.getElementById("summary");
    if (summaryEl) {
      summaryEl.textContent = "Could not load book details. Please try again.";
    }
  }
}

initEvents();
loadBook();
