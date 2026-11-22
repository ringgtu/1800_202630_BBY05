const COVER_FALLBACK = "/images/book.jpg";
const COVER_SIZE_ORDER = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"];

// Books should have a portrait cover (height >= width, or at least height / width >= 0.75).
// Google Books API sometimes returns text banners or partial page snippets
// (e.g. 1280x205) under extraLarge/large instead of an actual book cover.
const MIN_COVER_ASPECT_RATIO = 0.75; // naturalHeight / naturalWidth

export function getBookCoverCandidates(imageLinks) {
  const links = Array.isArray(imageLinks)
    ? imageLinks
    : typeof imageLinks === "string"
      ? [imageLinks]
      : COVER_SIZE_ORDER.map((size) => imageLinks?.[size]);

  return [
    ...new Set(
      links
        .filter((url) => typeof url === "string" && url.trim())
        .map((url) => url.trim().replace(/^http:/i, "https:")),
    ),
  ];
}

export function setBookCover(image, imageLinks, title = "", loadMoreImageLinks = null) {
  if (!image) return;

  const candidates = getBookCoverCandidates(imageLinks);
  const tried = new Set();
  let lookupAttempted = false;
  let fallbackUsed = false;

  image.alt = title ? `Cover of ${title}` : "Book cover";
  image.hidden = false;
  if (!image.classList.contains("library-cover")) {
    image.style.objectFit = "contain";
  }

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
      image.onload = null;
      image.onerror = null;
      image.hidden = true;
    }
  };

  const advanceCandidate = async () => {
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

  image.onload = () => {
    // If fallback is already being used or image failed to decode properly, don't validate aspect ratio
    if (fallbackUsed) return;

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // Validate that the loaded candidate has book-cover proportions rather than being a banner/snippet
    if (width > 0 && height > 0) {
      const aspectRatio = height / width;
      if (aspectRatio < MIN_COVER_ASPECT_RATIO) {
        void advanceCandidate();
      }
    }
  };

  image.onerror = () => {
    void advanceCandidate();
  };

  if (!useNextCandidate()) {
    if (loadMoreImageLinks) {
      void advanceCandidate();
    } else {
      useFallback();
    }
  }
}

