import { doc, setDoc, serverTimestamp } from "firebase/firestore"; 
import { db } from "./firebaseConfig.js";
import { getCoverLinks } from "./master.js"; 
import { getCurrentUser, getUserData, sortLists } from "./favorites.js"; 

const listsBox = document.getElementById("lists");
const message = document.getElementById("listsMessage");
const template = document.getElementById("list-card-template");
const newButton = document.getElementById("newListButton");
const newForm = document.getElementById("newListForm");
const nameInput = document.getElementById("newListName");
const createButton = document.getElementById("createList");

let currentUser = null;
let usedNames = new Set(["favorites"]); 

// Timestamp -> "2026-11-16"
function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return date.toLocaleDateString("en-CA");
}

// Build one list card
function renderList({ name, href, note, count, covers }) {
  const card = template.content.firstElementChild.cloneNode(true);

  const link = card.querySelector(".list-name");
  link.textContent = name;
  link.href = href;

  card.querySelector(".list-updated").textContent = note;
  card.querySelector(".list-count").textContent = `${count} ${count === 1 ? "book" : "books"}`;

  // The 2x2 picture: a cover where we have one, a plain square where we don't
  const grid = card.querySelector(".list-covers");
  for (let i = 0; i < 4; i++) {
    if (covers[i]) {
      const image = document.createElement("img");
      image.src = covers[i];
      image.alt = "";
      image.className = "w-100 h-100";
      image.style.objectFit = "cover";
      grid.append(image);
    } else {
      const empty = document.createElement("div");
      empty.className = i % 3 === 0 ? "bg-light" : "bg-dark-subtle"; // checker pattern
      grid.append(empty);
    }
  }

  return card;
}

// Load Favorites + the user's lists and draw them
async function showLists() {
  try {
    const data = await getUserData(currentUser.uid);
    const favoriteIds = data.favorites ?? [];
    const lists = sortLists(data.myList);

    usedNames = new Set(["favorites", ...lists.map((list) => list.name.toLowerCase())]);

    const items = [
      // Favorites always first
      { name: "Favorites", href: "favorite_list.html", note: "Default list", books: favoriteIds },
        ...lists.map((list) => ({
        name: list.name,
        href: `favorite_list.html?list=${list.id}`,
        note: `Last updated: ${formatDate(list.updatedAt)}`, 
        books: list.books ?? [], 
      })),
    ];

    const cards = await Promise.all(
      items.map(async (item) =>
        renderList({ ...item, count: item.books.length, covers: await getCoverLinks(item.books), })
      )
    );

    listsBox.replaceChildren(...cards);
    message.textContent = lists.length ? "" : "No lists yet. Select New list to make one.";
  } catch (error) {
    console.error("Error loading lists:", error);
    message.textContent = "Something went wrong. Please try again.";
  }
}

// Show / hide the "new list" form
newButton.addEventListener("click", () => {
  newForm.hidden = !newForm.hidden;
  if (!newForm.hidden) nameInput.focus();
});

// Create a list
newForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  if (!name) return;

  if (usedNames.has(name.toLowerCase())) {
    message.textContent = `You already have a list called "${name}".`;
    return;
  }

  createButton.disabled = true;

  try {
    const listId = crypto.randomUUID().replaceAll("-", "");

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        myList: {
          [listId]: {
            name,
            books: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );

    nameInput.value = "";
    newForm.hidden = true;
    await showLists();
  } catch (error) {
    console.error("Error creating list:", error);
    message.textContent = "Could not create the list. Please try again.";
  } finally {
    createButton.disabled = false;
  }
});

currentUser = await getCurrentUser();

if (!currentUser) {
  window.location.replace("/html/login.html");
} else {
  await showLists();
}
