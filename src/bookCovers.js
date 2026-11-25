import coverFallback from "../images/cover_not_available.jpg";
const COVER_FALLBACK = coverFallback;
const COVER_SIZE_ORDER = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"];

// Books should have a portrait cover (height >= width, or at least height / width >= 0.75).
// Google Books API sometimes returns text banners or partial page snippets
// (e.g. 1280x205) under extraLarge/large instead of an actual book cover.
const MIN_COVER_ASPECT_RATIO = 0.75; // naturalHeight / naturalWidth

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return null;
  let normalized = url.trim().replace(/^http:/i, "https:");

  // Strip artificial page curl effects (&edge=curl) from Google Books URLs.
  if (isGoogleBooksUrl(normalized)) {
    normalized = normalized.replace(/&edge=curl(&|$)/g, "$1");
  }

  return normalized;
}

function isGoogleBooksUrl(url) {
  return url.includes("books.google.com") || url.includes("googleusercontent.com");
}

export function getBookCoverCandidates(imageLinks) {
  const links = Array.isArray(imageLinks)
    ? imageLinks
    : typeof imageLinks === "string"
      ? [imageLinks]
      : COVER_SIZE_ORDER.map((size) => imageLinks?.[size]);

  return [...new Set(links.map((url) => normalizeUrl(url)).filter(Boolean))];
}

/**
 * Returns true when a loaded image is a Google Books "image not available"
 * placeholder or is too small to be a usable cover.
 *
 * Google returns HTTP 200 for these placeholders in many size variants:
 *   128×170, 128×195, 128×197, 128×201, 575×750, 57×80, …
 * We cannot inspect pixels (CORS), so we reject ALL Google Books images
 * with naturalWidth <= 128.  At that size even a "real" cover is too
 * pixelated to look good in the UI; our styled fallback is better.
 */
const MIN_GOOGLE_COVER_WIDTH = 80; // Try 64 if you want to allow even smaller covers

function isLowQualityGoogleImage(img) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) return false;

  const src = img.src || "";
  if (!isGoogleBooksUrl(src)) return false;

  // Known Google Books "image not available" placeholder dimensions
  if (width === 57 && height === 80) return true;
  if (width === 575 && height === 750) return true;

  // Reject tiny Google Books images below your lowered threshold
  if (width < MIN_GOOGLE_COVER_WIDTH) return true;

  return false;
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
    image.removeAttribute("crossorigin");
    image.src = candidate;
    return true;
  };

  const useFallback = () => {
    if (!fallbackUsed) {
      fallbackUsed = true;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("crossorigin");
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
    // If fallback is already being used, don't re-validate
    if (fallbackUsed) return;

    // Detect Google Books "image not available" placeholder (all size variants)
    // and low-res covers that look worse than our styled fallback.
    if (isLowQualityGoogleImage(image)) {
      void advanceCandidate();
      return;
    }

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
