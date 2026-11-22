import { auth, db } from "./firebaseConfig.js";
import { logoutUser, onAuthReady } from "./authentication.js";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { getBookById, getCoverLinks } from "./master.js";
import { sortLists } from "./favorites.js";
import { setBookCover } from "./bookCovers.js";

const form = document.getElementById("profileForm");
const fields = document.getElementById("profileFields");
const heading = document.getElementById("profileName");
const emailDisplay = document.getElementById("profileEmail");
const nameInput = document.getElementById("nameInput");
const countryInput = document.getElementById("countryInput");
const identityInput = document.getElementById("identityInput");
const saveButton = document.getElementById("saveProfile");
const message = document.getElementById("profileMessage");
const favoritesList = document.getElementById("favoritesList");
const favoritesMessage = document.getElementById("favoritesMessage");
const favoriteTemplate = document.getElementById("favorite-card-template");
const listsPreview = document.getElementById("listsPreview");
const listsMessage = document.getElementById("listsMessage");
const listTemplate = document.getElementById("list-preview-template");

// View / navigation elements
const profileCard = document.getElementById("profileCard");
const profileSummary = document.getElementById("profileSummary");
const profileHint = document.getElementById("profileHint");
const profileChevron = document.getElementById("profileChevron");
const profileView = document.getElementById("profileView");
const profileExtras = document.getElementById("profileExtras");
const viewName = document.getElementById("viewName");
const viewCountry = document.getElementById("viewCountry");
const viewGenre = document.getElementById("viewGenre");
const editButton = document.getElementById("editProfile");
const cancelButton = document.getElementById("cancelEdit");
const backButton = document.getElementById("backToProfile");
const logoutButton = document.getElementById("logoutButton");
const profilePhoto = document.getElementById("profilePhoto");
const profileIcon = document.getElementById("profileIcon");
const photoInput = document.getElementById("photoInput");
const removePhotoButton = document.getElementById("removePhoto");

const MAX_SHOWN_FAVORITES = 9;
const MAX_SHOWN_LISTS = 9;

let loadedUserId = null;
let saving = false;

// "overview" = profile page, "detail" = your full profile, "edit" = edit form
let mode = "overview";

// The last saved details. Used to fill the form and to undo on Cancel.
let savedData = { name: "", country: "", identity: "", photo: "" };

// A photo chosen in the edit form but not saved yet
let pendingPhoto = undefined;

// Show feedback underneath the profile card.
function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `mt-3 mb-0 text-${colour}`;
}

// Show the right parts of the page for each mode.
function setMode(newMode) {
  mode = newMode;
  const loaded = Boolean(loadedUserId);

  const overview = mode === "overview";
  const detail = mode === "detail";
  const edit = mode === "edit";

  profileExtras.hidden = !overview; // Favorites, Lists, My reviews
  profileHint.hidden = !(overview && loaded);
  profileChevron.hidden = !(overview && loaded);
  profileView.hidden = !detail;
  form.hidden = !edit;
  editButton.hidden = !detail; // Edit only appears once the profile is open
  backButton.hidden = !detail;

  profileCard.style.cursor = overview && loaded ? "pointer" : "default";
}

// Show the photo, or the person icon when there is none
function showPhoto(dataUrl) {
  profilePhoto.classList.toggle("d-none", !dataUrl); 
  profileIcon.classList.toggle("d-none", Boolean(dataUrl)); 

  if (dataUrl) {
    profilePhoto.src = dataUrl;
  } else {
    profilePhoto.removeAttribute("src"); 
  }
}

// "Remove picture" only appears when there is a picture to remove
function updatePhotoControls() {
  const current = pendingPhoto !== undefined ? pendingPhoto : savedData.photo;
  removePhotoButton.hidden = !current;
}

// Crop the middle square of the image and shrink it to size x size pixels
async function resizeToSquare(file, size = 200) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.85);
}

// A file was chosen: resize it and preview it right away
photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    photoInput.value = "";
    showMessage("Please choose an image file.", "danger");
    return;
  }

  try {
    pendingPhoto = await resizeToSquare(file);
    showPhoto(pendingPhoto);
    updatePhotoControls();
    showMessage("");
  } catch (error) {
    console.error("Could not read the image:", error);
    photoInput.value = "";
    showMessage("Could not read that image. Try a JPG or PNG.", "danger");
  }
});

// Remove picture
removePhotoButton.addEventListener("click", () => {
  pendingPhoto = "";
  photoInput.value = "";
  showPhoto("");
  updatePhotoControls();
});

// Show the saved details as plain text.
function renderView() {
  heading.textContent = savedData.name || "My profile";
  viewName.textContent = savedData.name || "—";
  viewCountry.textContent = savedData.country || "—";
  viewGenre.textContent = savedData.identity || "—";
  showPhoto(savedData.photo)
}

// Put the saved details into the form inputs.
function fillForm() {
  nameInput.value = savedData.name;
  countryInput.value = savedData.country;
  identityInput.value = savedData.identity;
  pendingPhoto = undefined;     
  photoInput.value = "";        
  showPhoto(savedData.photo);     
  updatePhotoControls();         
}

// Profile page -> full profile
function openProfile() {
  if (mode !== "overview" || !loadedUserId) return;
  showMessage("");
  setMode("detail");
}

profileCard.addEventListener("click", (event) => {
  if (event.target.closest("button, form, a")) return;
  openProfile();
});
profileSummary.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openProfile();
  }
});

// Full profile -> back to profile page
backButton.addEventListener("click", () => {
  if (mode === "detail") setMode("overview");
});

// Full profile -> edit form (current info pre-filled)
editButton.addEventListener("click", () => {
  if (mode !== "detail" || !loadedUserId || saving) return;
  fillForm();
  fields.disabled = false;
  showMessage("");
  setMode("edit");
  nameInput.focus();
});

// Edit form -> back to full profile without saving
cancelButton.addEventListener("click", () => {
  if (saving) return;
  fillForm(); // discard anything typed
  showMessage("");
  setMode("detail");
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await logoutUser();
  } catch (error) {
    console.error("Could not log out:", error);
    showMessage("Could not log out. Please try again.", "danger");
    logoutButton.disabled = false;
  }
});

// READ: load the signed-in user's details from Firestore.
onAuthReady(async (user) => {
  loadedUserId = null;
  fields.disabled = true;
  form.reset();
  setMode("overview");
  heading.textContent = "My profile";
  emailDisplay.textContent = "";
  favoritesList.replaceChildren();
  favoritesMessage.textContent = "";
  listsPreview.replaceChildren();     
  listsMessage.textContent = "";     

  if (!user) {
    window.location.replace("/html/login.html");
    return;
  }

  showMessage("Loading your profile…");

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    // Ignore the result if the signed-in account changed.
    if (auth.currentUser?.uid !== user.uid) return;

    const profile = snapshot.exists() ? snapshot.data() : {};

    savedData = {
      name: profile.name ?? user.displayName ?? "",
      country: profile.country ?? "",
      identity: profile.genre || profile.identity || "",
      photo: profile.photo ?? "",
    };

    renderView();
    fillForm();
    emailDisplay.textContent = user.email || profile.email || "";

    loadedUserId = user.uid;
    setMode("overview");

    showMessage(
      snapshot.exists() ? "" : "Select your profile, then Edit, to add your details."
    );

    showFavorites(profile.favorites ?? [], user.uid);
    showListPreviews(profile.myList ?? {}, user.uid);
    
  } catch (error) {
    if (auth.currentUser?.uid !== user.uid) return;

    console.error("Could not load profile:", error);
    showMessage(
      "Could not load your profile. Refresh the page to try again.",
      "danger"
    );
  }
});

// WRITE: save edited details to the same user's document.
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user || user.uid !== loadedUserId || saving) return;

  const name = nameInput.value.trim();
  const country = countryInput.value.trim();
  const identity = identityInput.value.trim();

  if (!name || !country || !identity) {
    showMessage("Please fill in all three fields.", "danger");
    return;
  }

  saving = true;
  fields.disabled = true;
  saveButton.textContent = "Saving…";
  showMessage("Saving your changes…");

  try {
    const userRef = doc(db, "users", user.uid);

    // Merge preserves other fields already in this document.
    const update = { name, country, genre: identity, email: user.email || "" };
    
    update.identity = deleteField();

    // Only touch the photo when the user changed it
    if (pendingPhoto === "") update.photo = deleteField();
    else if (pendingPhoto) update.photo = pendingPhoto;

    await setDoc(userRef, update, { merge: true });

    if (auth.currentUser?.uid !== user.uid) return;

    // Update the saved data, then return to the full profile.
    savedData = {
      name,
      country,
      identity,
      photo: pendingPhoto === undefined ? savedData.photo : pendingPhoto,
    };
    pendingPhoto = undefined;
    renderView();
    setMode("detail");

    // Also update the name used by the home-page greeting.
    try {
      await updateProfile(user, { displayName: name });

      if (auth.currentUser?.uid === user.uid) {
        showMessage("Your profile was saved successfully.", "success");
      }
    } catch (error) {
      console.error("Could not update account display name:", error);

      if (auth.currentUser?.uid === user.uid) {
        showMessage(
          "Your profile was saved, but your home-page name could not be updated. Select Edit, then Save changes to retry.",
          "warning"
        );
      }
    }
  } catch (error) {
    if (auth.currentUser?.uid === user.uid) {
      console.error("Could not save profile:", error);
      showMessage(
        "Could not save your changes. Please try again.",
        "danger"
      );
    }
  } finally {
    saving = false;
    saveButton.textContent = "Save changes";

    if (auth.currentUser?.uid === loadedUserId && loadedUserId) {
      fields.disabled = false;
    }
  }
});


function renderFavorite(book) {
  const info = book.volumeInfo;
  const title = info.title ?? "Untitled";
  const card = favoriteTemplate.content.firstElementChild.cloneNode(true);

  const link = card.querySelector(".favorite-title");
  link.textContent = title;
  link.title = title; // full name on hover, since long names get cut after 2 lines
  link.href = `book_info.html?bookid=${book.id}`;

  const cover = card.querySelector(".favorite-cover");
  cover.alt = title;
  setBookCover(cover, info.imageLinks, title);

  return card;
}


// Turn the saved book ids into cards
async function showFavorites(bookIds, userId) {
  if (bookIds.length === 0) {
    favoritesList.replaceChildren();
    favoritesMessage.textContent = "No favorites yet. Tap the heart on a book to save it here.";
    return;
  }

  favoritesMessage.textContent = "Loading favorites…";

  try {
    // Newest favorite first, only can show up to 9 fav on profile
    const newest = bookIds.slice(-MAX_SHOWN_FAVORITES).reverse();
    const results = await Promise.allSettled(newest.map(getBookById));

    // Ignore the result if the signed-in account changed
    if (auth.currentUser?.uid !== userId) return;

    const cards = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => renderFavorite(result.value));

    favoritesList.replaceChildren(...cards);
    favoritesMessage.textContent = cards.length ? "" : "Could not load your favorites.";
  } catch (error) {
    console.error("Could not show favorites:", error);
    favoritesMessage.textContent = "Could not load your favorites.";
  }
}


// Build one list card
function renderListPreview(list, covers) {
  const count = list.books?.length ?? 0;
  const card = listTemplate.content.firstElementChild.cloneNode(true);

  const link = card.querySelector(".list-name");
  link.textContent = list.name;
  link.title = list.name; 
  link.href = `favorite_list.html?list=${list.id}`;

  card.querySelector(".list-count").textContent = `${count} ${count === 1 ? "book" : "books"}`;

  // 2x2 picture: a cover where we have one, a plain square where we don't
  const grid = card.querySelector(".list-covers");
  for (let i = 0; i < 4; i++) {
    if (covers[i]?.length) {
      const image = document.createElement("img");
      image.className = "w-100 h-100";
      setBookCover(image, covers[i], list.name);
      grid.append(image);
    } else {
      const empty = document.createElement("div");
      empty.className = i % 3 === 0 ? "bg-light" : "bg-dark-subtle"; 
      grid.append(empty);
    }
  }

  return card;
}


// Show the user's 9 most recently updated lists
async function showListPreviews(myList, userId) {
  const lists = sortLists(myList).slice(0, MAX_SHOWN_LISTS);

  if (lists.length === 0) {
    listsPreview.replaceChildren();
    listsMessage.textContent = "No lists yet. Select Lists to create one.";
    return;
  }

  listsMessage.textContent = "Loading lists…";

  try {
    const cards = await Promise.all(
      lists.map(async (list) => renderListPreview(list, await getCoverLinks(list.books ?? [])))
    );

    // Ignore the result if the signed-in account changed
    if (auth.currentUser?.uid !== userId) return;

    listsPreview.replaceChildren(...cards);
    listsMessage.textContent = "";
  } catch (error) {
    console.error("Could not show lists:", error);
    listsMessage.textContent = "Could not load your lists.";
  }
}
