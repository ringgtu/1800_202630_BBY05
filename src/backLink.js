// This helper function is for checking what page is the user from to book info,
// and bring them back to the original page
const backLink = document.getElementById("back-link");

backLink.addEventListener("click", (event) => {
  // Check what page is the user from
  const cameFromThisSite =
    document.referrer && new URL(document.referrer).origin === window.location.origin;

  if (cameFromThisSite) {
    event.preventDefault(); 
    history.back();         // go back to the page the user came from
  }
  // otherwise the link works normally and goes to search.html
});
