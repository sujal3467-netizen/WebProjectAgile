// =============================================================
// open-shifts.js – Open Shifts page (owner: Masrur, Jira SS-51, SS-60)
// SS-60: filter bar and paging. Uses:
//   GET /api/me
//   GET /api/shifts/open?from=&to=&position=&page=&limit=
//   POST /api/swaps/:id/accept
// Needs /js/api.js and /employee/js/common.js to be loaded first.
// =============================================================

const PAGE_SIZE = 10;
let currentPage = 1;
let myId = null;   // set in startPage

const listBox = document.getElementById("open-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("open-error");
const successMessage = document.getElementById("open-success");
const filterForm = document.getElementById("filter-form");
const fromInput = document.getElementById("filter-from");
const toInput = document.getElementById("filter-to");
const positionInput = document.getElementById("filter-position");
const clearButton = document.getElementById("clear-button");

// Why can't I accept this shift? Returns a short reason, or "" if I can.
// (We show these shifts too, so the page counts and pages match the server.)
function whyNotAvailable(shift) {
  if (shift.assigned_to === myId) return "This is your own shift";
  if (shift.swap_id === null || shift.swap_id === undefined) return "Waiting for your manager to assign it";
  if (shift.offered_to !== null && shift.offered_to !== myId) return "Offered to a colleague";
  return "";
}

// One ticket per open shift, with an Accept button when I can take it.
function makeCard(shift) {
  const { ticket, body } = makeTicket(shift);
  if (shift.assigned_name) {
    body.append(makeElement("p", "text-muted", `Offered by ${shift.assigned_name}`));
  }
  if (shift.offered_to === myId) {
    body.append(makeElement("span", "status status-pending", "Offered to you"));
  }

  const reason = whyNotAvailable(shift);
  if (reason) {
    body.append(makeElement("p", "text-muted", reason));
    return ticket;
  }

  const actions = makeElement("div", "card-actions");
  const button = makeElement("button", "btn btn-success", "Accept");
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;               // stop double clicks
    setMessage(errorMessage, "");
    try {
      await api.post(`/api/swaps/${shift.swap_id}/accept`);
      await loadShifts();                 // the shift disappears from the list
      setMessage(successMessage, "Shift accepted. It now waits for your manager to approve it.");
    } catch (error) {
      setMessage(successMessage, "");
      setMessage(errorMessage, error.message);
      button.disabled = false;
    }
  });
  actions.append(button);
  body.append(actions);
  return ticket;
}

function filtersAreUsed() {
  return Boolean(fromInput.value || toInput.value || positionInput.value.trim());
}

async function loadShifts() {
  loadingMessage.classList.remove("hidden");
  try {
    const query = makeQuery({
      from: fromInput.value,
      to: toInput.value,
      position: positionInput.value.trim(),
      page: currentPage,
      limit: PAGE_SIZE,
    });
    const result = await api.get("/api/shifts/open?" + query);

    if (result.items.length === 0 && currentPage > 1) {
      currentPage = result.pages;
      return loadShifts();
    }

    listBox.replaceChildren();
    if (result.items.length === 0) {
      const text = filtersAreUsed()
        ? "No open shifts match your filters. Try different dates or clear the filters."
        : "There are no open shifts right now.";
      listBox.append(makeElement("p", "text-muted", text));
    }
    for (const shift of result.items) {
      listBox.append(makeCard(shift));
    }
    showPager(result, "open shift");
  } catch (error) {
    listBox.replaceChildren();
    hidePager();
    setMessage(errorMessage, error.message);
  } finally {
    loadingMessage.classList.add("hidden");
  }
}

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
  setMessage(errorMessage, "");
  setMessage(successMessage, "");
  loadShifts();
});

clearButton.addEventListener("click", () => {
  filterForm.reset();
  currentPage = 1;
  setMessage(errorMessage, "");
  loadShifts();
});

wirePager((change) => {
  currentPage += change;
  loadShifts();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function startPage() {
  try {
    const me = await api.get("/api/me");
    myId = (me.user || me).id;
  } catch (error) {
    setMessage(errorMessage, error.message);
  }
  loadShifts();
}

startPage();
