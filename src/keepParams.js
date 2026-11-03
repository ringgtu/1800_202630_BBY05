const params = new URLSearchParams(window.location.search);
const form = document.querySelector("form");
const owns = form.dataset.owns.split(","); 

// Carry over everything this form doesn't control (e.g. q)
for (const [name, value] of params) {
  if (owns.includes(name)) continue;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = name;
  hidden.value = value;
  form.append(hidden);
}

// Re-select the previous choices
owns.forEach((name) => {
  const selected = params.getAll(name);
  form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
    if (selected.includes(input.value)) input.checked = true;
  });
});

// The X button goes back to the results (or the search page if there are none)
const closeLink = document.getElementById("close-link");
closeLink.href = params.toString() ? `filtered.html?${params}` : "search.html";