import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const form = document.getElementById("profileForm");
const fields = document.getElementById("profileFields");
const heading = document.getElementById("profileName");
const emailDisplay = document.getElementById("profileEmail");
const nameInput = document.getElementById("nameInput");
const countryInput = document.getElementById("countryInput");
const identityInput = document.getElementById("identityInput");
const saveButton = document.getElementById("saveProfile");
const message = document.getElementById("profileMessage");

let loadedUserId = null;
let saving = false;

// Show feedback underneath the form.
function showMessage(text, colour = "secondary") {
  message.textContent = text;
  message.className = `mt-3 mb-0 text-${colour}`;
}

// READ: load the signed-in user's details from Firestore.
onAuthReady(async (user) => {
  loadedUserId = null;
  fields.disabled = true;
  form.reset();
  heading.textContent = "My profile";
  emailDisplay.textContent = "";

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

    nameInput.value = profile.name ?? user.displayName ?? "";
    countryInput.value = profile.country ?? "";
    identityInput.value = profile.identity ?? "BookLover";

    heading.textContent = nameInput.value || "My profile";
    emailDisplay.textContent = user.email || profile.email || "";

    loadedUserId = user.uid;
    fields.disabled = false;

    showMessage(
      snapshot.exists()
        ? "Your profile is loaded. You can edit your details below."
        : "Complete your details and select Save changes."
    );
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
    await setDoc(
      userRef,
      {
        name,
        country,
        identity,
        email: user.email || "",
      },
      { merge: true }
    );

    if (auth.currentUser?.uid !== user.uid) return;

    heading.textContent = name;
    nameInput.value = name;
    countryInput.value = country;
    identityInput.value = identity;

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
          "Your profile was saved, but your home-page name could not be updated. Select Save changes to retry.",
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