// Record which websitesite did the user came from and bring them to the website
// when they press back arrow
export function initializeBackLink(backLink) {
  if (!backLink || !document.referrer) return;

  let referrer;
  try {
    referrer = new URL(document.referrer);
  } catch {
    return;
  }

  const currentPage = new URL(window.location.href);
  if (referrer.origin !== currentPage.origin || referrer.href === currentPage.href) return;

  backLink.href = referrer.href;
}

document.querySelectorAll("[data-back-link]").forEach(initializeBackLink);


// prevent looping (profile -> lists -> book info -> (back) lists -> (back) book info)
const TRAIL_KEY = "pageTrail";
const MAX_TRAIL = 30;

const here = window.location.pathname + window.location.search;

function readTrail() {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveTrail(trail) {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-MAX_TRAIL)));
  } catch {
    // Storage blocked: the arrow just uses its own link
  }
}

// Every time a page loads, update the trail
const trail = readTrail();
const seenAt = trail.lastIndexOf(here);

if (seenAt === -1) {
  trail.push(here); // a new page: add it
} else {
  trail.length = seenAt + 1; // visited before (reload or browser Back): cut everything after it
}
saveTrail(trail);

// The arrow (pages without one just record the trail)
const backLink = document.querySelector("#back-link, [data-back-link]");

backLink?.addEventListener("click", (event) => {
  // Ctrl / Cmd / Shift / middle click: let the browser open a new tab
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

  const current = readTrail();
  if (current.length < 2) return; // nothing before this page: the link's own href is used

  event.preventDefault();
  current.pop(); // leave this page
  saveTrail(current);
  window.location.assign(current[current.length - 1]);
});
