// =============================================================
// open-shifts.js – Open Shifts page (owner: Masrur, Jira SS-51)
// Uses: GET /api/me, GET /api/shifts/open, POST /api/swaps/:id/accept
// Needs /js/api.js to be loaded first.
// =============================================================

const listBox = document.getElementById("open-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("open-error");
const successMessage = document.getElementById("open-success");
const logoutButton = document.getElementById("logout-button");

let myId = null;   // set in loadPage

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayName(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function showError(text) {
  successMessage.classList.add("hidden");
  errorMessage.textContent = text;
  errorMessage.classList.remove("hidden");
}

function showSuccess(text) {
  errorMessage.classList.add("hidden");
  successMessage.textContent = text;
  successMessage.classList.remove("hidden");
}

// One card per open shift, with an Accept button.
function makeCard(shift) {
  const card = makeElement("article", "card mt-3");
  card.append(makeElement("h3", "card-title", formatDayName(parseDate(shift.shift_date))));
  card.append(makeElement("p", "card-description",
    `${shift.start_time} to ${shift.end_time} - ${shift.position}`));
  if (shift.assigned_name) {
    card.append(makeElement("p", "text-muted", `Offered by ${shift.assigned_name}`));
  }
  if (shift.offered_to === myId) {
    card.append(makeElement("span", "status status-pending", "Offered to you"));
  }

  const button = makeElement("button", "btn btn-success mt-3", "Accept");
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api.post(`/api/swaps/${shift.swap_id}/accept`);
      showSuccess("Shift accepted. It now waits for your manager to approve it.");
      await loadShifts();               // the shift disappears from the list
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
  card.append(button);
  return card;
}

async function loadShifts() {
  try {
    const data = await api.get("/api/shifts/open");
    const shifts = (Array.isArray(data) ? data : data.shifts) || [];

    // Keep only shifts I can really take:
    //  - it has a swap request to accept (swap_id)
    //  - it is not my own shift
    //  - it is not offered to somebody else
    const available = shifts
      .filter((shift) => shift.swap_id !== null && shift.swap_id !== undefined)
      .filter((shift) => shift.assigned_to !== myId)
      .filter((shift) => shift.offered_to === null || shift.offered_to === myId)
      .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));

    listBox.replaceChildren();
    if (available.length === 0) {
      listBox.append(makeElement("p", "text-muted", "There are no open shifts right now."));
      return;
    }
    for (const shift of available) {
      listBox.append(makeCard(shift));
    }
  } catch (error) {
    showError(error.message);
  }
}

async function loadPage() {
  try {
    const me = await api.get("/api/me");
    myId = (me.user || me).id;
    await loadShifts();
  } catch (error) {
    showError(error.message);
  } finally {
    loadingMessage.classList.add("hidden");
  }
}

logoutButton.addEventListener("click", async () => {
  try { await api.post("/api/logout"); } catch (error) { /* leave anyway */ }
  window.location.href = "/";
});

loadPage();
