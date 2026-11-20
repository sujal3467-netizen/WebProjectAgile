// =============================================================
// shifts.js – the My Shifts page (owner: Masrur, Jira SS-42, SS-60)
// SS-60: filter bar and paging. The filters go to the server:
//   GET /api/shifts/mine?from=&to=&position=&include_past=&page=&limit=
// Needs /js/api.js and /employee/js/common.js to be loaded first.
// =============================================================

const PAGE_SIZE = 10;
let currentPage = 1;

// The parts of the page we need, using the ids in shifts.html.
const listBox = document.getElementById("shifts-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("shifts-error");
const greeting = document.getElementById("greeting");
const filterForm = document.getElementById("filter-form");
const fromInput = document.getElementById("filter-from");
const toInput = document.getElementById("filter-to");
const positionInput = document.getElementById("filter-position");
const pastCheckbox = document.getElementById("filter-past");
const clearButton = document.getElementById("clear-button");

// The Monday of the week a date is in. Shifts in the same week
// share the same Monday, so we use it to group them.
function mondayOf(date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;   // Sunday is 0, so it becomes 6
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysSinceMonday);
  return monday;
}

// "9 Nov"
function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Sort the shifts on this page, then put them into groups by week.
// Returns a list like: [{ monday: Date, shifts: [...] }, ...]
function groupByWeek(shifts) {
  const sorted = [...shifts].sort((a, b) =>
    (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time)
  );

  const groups = new Map();   // a Map remembers the order we add things
  for (const shift of sorted) {
    const monday = mondayOf(parseDate(shift.shift_date));
    const key = toDateText(monday);
    if (!groups.has(key)) {
      groups.set(key, { monday: monday, shifts: [] });
    }
    groups.get(key).shifts.push(shift);
  }
  return [...groups.values()];
}

// Build the card for one shift.
function makeShiftCard(shift) {
  const card = makeElement("article", "card mt-3");
  card.append(makeElement("h3", "card-title", formatDayName(parseDate(shift.shift_date))));
  card.append(makeElement("p", "card-description",
    `${shift.start_time} to ${shift.end_time} - ${shift.position}`));

  // A shift marked "open" has been offered to other employees.
  if (shift.status === "open") {
    card.append(makeElement("span", "status status-open", "Offered for swap"));
  }
  // Only shows when "Show past shifts" is ticked.
  if (shift.shift_date < toDateText(new Date())) {
    card.append(makeElement("span", "status status-cancelled", "Past shift"));
  }
  return card;
}

// Has the user typed or ticked any filter?
function filtersAreUsed() {
  return Boolean(fromInput.value || toInput.value || positionInput.value.trim() || pastCheckbox.checked);
}

// Draw the shifts of this page, grouped by week.
function showShifts(shifts) {
  listBox.replaceChildren();   // empty the box first

  if (shifts.length === 0) {
    const text = filtersAreUsed()
      ? "No shifts match your filters. Try different dates or clear the filters."
      : "You have no upcoming shifts.";
    listBox.append(makeElement("p", "text-muted", text));
    return;
  }

  for (const group of groupByWeek(shifts)) {
    listBox.append(makeElement("h2", "mt-3", `Week of ${formatShortDate(group.monday)}`));
    for (const shift of group.shifts) {
      listBox.append(makeShiftCard(shift));
    }
  }
}

// Ask the server for the current page with the current filters.
async function loadShifts() {
  loadingMessage.classList.remove("hidden");
  setMessage(errorMessage, "");
  try {
    // Only the filters that are filled in are sent (see makeQuery).
    const query = makeQuery({
      from: fromInput.value,
      to: toInput.value,
      position: positionInput.value.trim(),
      include_past: pastCheckbox.checked ? "true" : "",
      page: currentPage,
      limit: PAGE_SIZE,
    });
    const result = await api.get("/api/shifts/mine?" + query);

    // We were on a page that no longer exists (e.g. after a change): go to the last one.
    if (result.items.length === 0 && currentPage > 1) {
      currentPage = result.pages;
      return loadShifts();
    }

    showShifts(result.items);
    showPager(result, "shift");
  } catch (error) {
    // If we are not logged in, api.js already sends us to the login page.
    listBox.replaceChildren();
    hidePager();
    setMessage(errorMessage, error.message);   // e.g. "from must be before to"
  } finally {
    loadingMessage.classList.add("hidden");   // stop showing "Loading..."
  }
}

// Apply filters: always start again at page 1.
filterForm.addEventListener("submit", (event) => {
  event.preventDefault();      // stop the page reloading
  currentPage = 1;
  loadShifts();
});

// Clear: empty every filter and show everything again.
clearButton.addEventListener("click", () => {
  filterForm.reset();
  currentPage = 1;
  loadShifts();
});

// Previous / Next: change=-1 or +1.
wirePager((change) => {
  currentPage += change;
  loadShifts();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Runs when the page opens: get who I am, then my shifts.
async function startPage() {
  try {
    const me = await api.get("/api/me");
    const user = me.user || me;
    if (user.name) greeting.textContent = `Hello, ${user.name}`;
  } catch (error) {
    // api.js sends us to the login page if we are not logged in.
  }
  loadShifts();
}

startPage();
