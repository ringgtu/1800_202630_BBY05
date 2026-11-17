const COVER_FALLBACK = "/images/book.jpg";
const COVER_SIZE_ORDER = ["thumbnail", "medium", "large", "small", "smallThumbnail", "extraLarge"];

export function getBookCoverCandidates(imageLinks) {
  const links = Array.isArray(imageLinks)
    ? imageLinks
    : typeof imageLinks === "string"
      ? [imageLinks]
      : COVER_SIZE_ORDER.map((size) => imageLinks?.[size]);

  return [...new Set(
    links
      .filter((url) => typeof url === "string" && url.trim())
      .map((url) => url.trim().replace(/^http:/i, "https:"))
  )];
}

export function setBookCover(image, imageLinks, title = "", loadMoreImageLinks = null) {
  if (!image) return;

  const candidates = getBookCoverCandidates(imageLinks);
  const tried = new Set();
  let lookupAttempted = false;
  let fallbackUsed = false;

  image.alt = title ? `Cover of ${title}` : "Book cover";
  image.hidden = false;
  image.style.objectFit = "contain";

  const useNextCandidate = () => {
    const candidate = candidates.shift();
    if (!candidate) return false;
    tried.add(candidate);
    image.src = candidate;
    return true;
  };

  const useFallback = () => {
    if (!fallbackUsed) {
      fallbackUsed = true;
      image.src = COVER_FALLBACK;
    } else {
      image.onerror = null;
      image.hidden = true;
    }
  };

  const handleImageError = async () => {
    if (useNextCandidate()) return;

    if (loadMoreImageLinks && !lookupAttempted) {
      lookupAttempted = true;
      try {
        const moreCandidates = getBookCoverCandidates(await loadMoreImageLinks());
        candidates.push(...moreCandidates.filter((candidate) => !tried.has(candidate)));
      } catch (error) {
        console.warn(`Could not load alternate covers for "${title || "book"}":`, error);
      }

      if (useNextCandidate()) return;
    }

    useFallback();
  };
  image.onerror = handleImageError;

  if (!useNextCandidate()) {
    if (loadMoreImageLinks) {
      void handleImageError();
    } else {
      useFallback();
    }
  }
}
