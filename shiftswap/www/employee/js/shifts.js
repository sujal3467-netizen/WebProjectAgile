// =============================================================
// shifts.js – the My Shifts page (owner: Masrur, Jira SS-42)
// Needs Sujal's /js/api.js to be loaded first.
// =============================================================

// Find the parts of the page we need, using the ids in shifts.html.
const listBox = document.getElementById("shifts-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("shifts-error");
const greeting = document.getElementById("greeting");
const logoutButton = document.getElementById("logout-button");

// Make one HTML element with an optional class and text.
// We use textContent (not innerHTML) so text from the database can
// never be run as code.
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// "2026-11-09" -> a Date at midnight on that day.
// (new Date("2026-11-09") uses UTC and can show the wrong day.)
function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The Monday of the week a date is in. Shifts in the same week
// share the same Monday, so we use it to group them.
function mondayOf(date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;   // Sunday is 0, so it becomes 6
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysSinceMonday);
  return monday;
}

// A text key for a date, like "2026-11-09", to use as a group name.
function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "9 Nov"
function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "Mon, 9 Nov"
function formatDayName(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// Sort shifts by date then start time, then put them into groups by week.
// Returns a list like: [{ monday: Date, shifts: [...] }, ...]
function groupByWeek(shifts) {
  const sorted = [...shifts].sort((a, b) =>
    (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time)
  );

  const groups = new Map();   // a Map remembers the order we add things
  for (const shift of sorted) {
    const monday = mondayOf(parseDate(shift.shift_date));
    const key = dateKey(monday);
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
  return card;
}

// Draw all the shifts on the page, grouped by week.
function showShifts(shifts) {
  listBox.replaceChildren();   // empty the box first

  if (shifts.length === 0) {
    listBox.append(makeElement("p", "text-muted", "You have no upcoming shifts."));
    return;
  }

  for (const group of groupByWeek(shifts)) {
    listBox.append(makeElement("h2", "mt-3", `Week of ${formatShortDate(group.monday)}`));
    for (const shift of group.shifts) {
      listBox.append(makeShiftCard(shift));
    }
  }
}

// Show a red error message.
function showError(text) {
  errorMessage.textContent = text;
  errorMessage.classList.remove("hidden");
}

// Runs when the page opens: get who I am, then my shifts.
async function loadPage() {
  try {
    const me = await api.get("/api/me");
    const user = me.user || me;
    if (user.name) greeting.textContent = `Hello, ${user.name}`;

    const data = await api.get("/api/shifts/mine");
    // The route may send a plain list or { shifts: [...] }. Handle both.
    const shifts = Array.isArray(data) ? data : data.shifts;
    showShifts(shifts || []);

  } catch (error) {
    // If we are not logged in, api.js already sends us to the login page.
    showError(error.message);
  } finally {
    loadingMessage.classList.add("hidden");   // stop showing "Loading..."
  }
}

// Log out button: tell the server, then go back to the login page.
logoutButton.addEventListener("click", async () => {
  try {
    await api.post("/api/logout");
  } catch (error) {
    // Ignore: we leave the page either way.
  }
  window.location.href = "/";
});

loadPage();