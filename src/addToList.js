import { doc, setDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig.js";
import { getCurrentUser, getUserData, sortLists } from "./favorites.js";

const bookId = new URLSearchParams(window.location.search).get("bookid");

const modal = document.getElementById("addToListModal");
const options = document.getElementById("addToListOptions");
const message = document.getElementById("addToListMessage");
const newToggle = document.getElementById("newListToggle"); 
const newForm = document.getElementById("newListInline");
const newName = document.getElementById("newListInlineName");
const newCreate = document.getElementById("newListInlineCreate");

let currentUser = null; 
let usedNames = new Set(["favorites"]); 

function setCheck(icon, inList) {
  icon.className = inList ? "bi bi-check-circle-fill" : "bi bi-circle";
}

// One row in the popup: the list name + a check when the book is already in it
function renderOption(name, inList, save) {
  const row = document.createElement("button");
  row.type = "button";
  row.className =
    "list-group-item list-group-item-action d-flex justify-content-between align-items-center";

  const label = document.createElement("span");
  label.textContent = name;

  const icon = document.createElement("i");
  setCheck(icon, inList);

  row.append(label, icon);

  // Click: add the book if it's not in the list, remove it if it is
  row.addEventListener("click", async () => {
    const wantIn = !inList;
    row.disabled = true;

    try {
      await save(wantIn);
      inList = wantIn;
      setCheck(icon, inList);
      message.textContent = wantIn ? `Added to ${name}.` : `Removed from ${name}.`;
    } catch (error) {
      console.error("Could not update list:", error);
      message.textContent = "Could not save. Please try again.";
    } finally {
      row.disabled = false;
    }
  });

  return row;
}

async function loadOptions(statusText = "") {
  const userRef = doc(db, "users", currentUser.uid);
  const data = await getUserData(currentUser.uid);
  const favorites = data.favorites ?? [];
  const lists = sortLists(data.myList);

  usedNames = new Set(["favorites", ...lists.map((list) => list.name.toLowerCase())]);

  const rows = [
    // Favorites always first
    renderOption("Favorites", favorites.includes(bookId), (wantIn) =>
      setDoc(
        userRef,
        { favorites: wantIn ? arrayUnion(bookId) : arrayRemove(bookId) },
        { merge: true }
      )
    ),
    // Then the lists the user made
    ...lists.map((list) =>
      renderOption(list.name, (list.books ?? []).includes(bookId), (wantIn) =>
        setDoc(
          userRef,
          {
            myList: {
              [list.id]: {
                books: wantIn ? arrayUnion(bookId) : arrayRemove(bookId),
                updatedAt: serverTimestamp(),
              },
            },
          },
          { merge: true }
        )
      )
    ),
  ];

  options.replaceChildren(...rows);
  message.textContent =
    statusText || (lists.length === 0 ? "You have no lists yet. Select New list to make one." : ""); 
}

// Load Favorites + the user's lists every time the popup opens
modal.addEventListener("show.bs.modal", async () => {
  options.replaceChildren();
  newForm.hidden = true; 
  newName.value = ""; 
  newToggle.disabled = true; 
  message.textContent = "Loading your lists…";

  try {
    currentUser = await getCurrentUser(); // saved so the create form can use it

    if (!currentUser) {
      message.textContent = "Log in to add books to a list.";
      return;
    }

    await loadOptions();
    newToggle.disabled = false; // NEW
  } catch (error) {
    console.error("Could not load lists:", error);
    message.textContent = "Could not load your lists.";
  }
});

// show / hide the "new list" field
newToggle.addEventListener("click", () => {
  newForm.hidden = !newForm.hidden;
  if (!newForm.hidden) newName.focus();
});

// create a list and put this book in it
newForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = newName.value.trim();
  if (!name) return;

  if (usedNames.has(name.toLowerCase())) {
    message.textContent = `You already have a list called "${name}".`;
    return;
  }

  newCreate.disabled = true;

  try {
    const listId = crypto.randomUUID().replaceAll("-", "");

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        myList: {
          [listId]: {
            name,
            books: bookId ? [bookId] : [], // start with this book in it
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );

    newName.value = "";
    newForm.hidden = true;
    await loadOptions(`Created ${name} and added this book.`);
  } catch (error) {
    console.error("Could not create list:", error);
    message.textContent = "Could not create the list. Please try again.";
  } finally {
    newCreate.disabled = false;
  }
});
