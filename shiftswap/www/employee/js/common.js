// =============================================================
// common.js – small helpers shared by the employee pages
// (owner: Masrur, SS-60). Load it AFTER /js/api.js and BEFORE the
// page's own script.
// =============================================================

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

// A Date -> "2026-11-09" (the format the server uses)
function toDateText(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "Mon, 9 Nov"
function formatDayName(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// ----- A shift "ticket": coloured date stub on the left, details on the right -----
// The stub colour comes from the position (see employee.css), so a Barista
// shift and a Stock shift look different at a glance.
// Works for a shift or a swap: both have shift_date, start_time, end_time, position.
// Returns { ticket, body }: add extra lines to `body`, then put `ticket` on the page.
function makeTicket(shift) {
  const date = parseDate(shift.shift_date);

  const ticket = makeElement("article", "ticket");
  ticket.dataset.position = shift.position.trim().toLowerCase();

  const stub = makeElement("div", "ticket-stub");
  stub.append(
    makeElement("span", "stub-weekday", date.toLocaleDateString("en-GB", { weekday: "short" })),
    makeElement("span", "stub-day", String(date.getDate())),
    makeElement("span", "stub-month", date.toLocaleDateString("en-GB", { month: "short" })),
  );

  const body = makeElement("div", "ticket-body");
  body.append(
    makeElement("p", "ticket-time", `${shift.start_time} \u2013 ${shift.end_time}`),
    makeElement("p", "ticket-position", shift.position),
  );

  ticket.append(stub, body);
  return { ticket, body };
}

// Underline the link of the page we are on.
for (const link of document.querySelectorAll(".nav-links a")) {
  if (link.pathname === location.pathname) link.setAttribute("aria-current", "page");
}

// Show a message in a box, or hide the box if the text is empty.
function setMessage(box, text) {
  box.textContent = text || "";
  box.classList.toggle("hidden", !text);
}

// Turn { from: "2026-11-01", to: "", page: 2 } into "from=2026-11-01&page=2".
// Empty values are left out, so only the filters the user filled in are sent.
function makeQuery(values) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value !== "" && value !== null && value !== undefined) {
      params.set(name, value);
    }
  }
  return params.toString();
}

// ----- The pager under a list: "12 shifts", Previous, "Page 2 of 3", Next -----
// Needs these ids on the page: result-count, pager, prev-button,
// page-label, next-button.
function showPager(result, noun) {
  const count = document.getElementById("result-count");
  const pager = document.getElementById("pager");

  count.textContent = result.total === 1 ? `1 ${noun}` : `${result.total} ${noun}s`;
  count.classList.toggle("hidden", result.total === 0);

  document.getElementById("page-label").textContent = `Page ${result.page} of ${result.pages}`;
  document.getElementById("prev-button").disabled = result.page <= 1;
  document.getElementById("next-button").disabled = result.page >= result.pages;
  pager.classList.toggle("hidden", result.pages <= 1);
}

function hidePager() {
  document.getElementById("result-count").classList.add("hidden");
  document.getElementById("pager").classList.add("hidden");
}

// Connect the Previous and Next buttons. goToPage(change) is the page's
// own function: it moves by -1 or +1 and reloads the list.
function wirePager(goToPage) {
  document.getElementById("prev-button").addEventListener("click", () => goToPage(-1));
  document.getElementById("next-button").addEventListener("click", () => goToPage(1));
}

// Log out button: tell the server, then go back to the login page.
document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await api.post("/api/logout");
  } catch (error) {
    // Ignore: we leave the page either way.
  }
  window.location.href = "/";
});
