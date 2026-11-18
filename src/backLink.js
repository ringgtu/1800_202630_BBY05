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
