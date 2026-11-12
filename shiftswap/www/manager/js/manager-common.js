// =============================================================
// manager-common.js  –  shared code for every manager page (Lajja)
//
// 1. Small helpers (dates, hours, messages)
// 2. checkManager()  – only managers may open these pages
// 3. Data functions  – every page gets data ONLY through these.
//    They call Sujal's API through api.js (full paths like "/api/me"),
//    or use sample data for the parts whose routes are not ready yet.
// =============================================================

// Which parts use the REAL server. Switch each one to true when
// Sujal's routes for it are merged into main.
//   shifts: GET/POST/PUT/DELETE /api/shifts...      (SS-39, merged)
//   swaps:  GET /api/swaps/pending, approve, reject (SS-47, SS-48)
//   staff:  GET /api/staff                           (not planned yet)
   const REAL = { shifts: true, swaps: true, staff: false };

// true while EVERYTHING is still sample data (no login needed)
const USE_SAMPLE_DATA = !REAL.shifts && !REAL.swaps && !REAL.staff;

// ---------- 1. Helpers ----------

// Date object -> 'YYYY-MM-DD' (built by hand so time zones can't shift the day)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// 'YYYY-MM-DD' -> Date object at midnight local time
function parseDate(text) {
  const parts = text.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// The Monday of the week that contains "date"
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = d.getDay(); // Sunday = 0, Monday = 1 ...
  const daysSinceMonday = dayNumber === 0 ? 6 : dayNumber - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

// Add whole days to a 'YYYY-MM-DD' string
function addDays(dateText, days) {
  const d = parseDate(dateText);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// '2026-11-03' -> 'Tue 3 Nov'
function niceDate(dateText) {
  return parseDate(dateText).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// 'HH:MM' -> minutes since midnight
function toMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// Hours between two times, e.g. '09:00' and '17:30' -> 8.5
function hoursBetween(start, end) {
  return (toMinutes(end) - toMinutes(start)) / 60;
}

// £ format
function money(amount) {
  return "£" + amount.toFixed(2);
}

// Stop names like "<b>Ben</b>" being treated as HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show a green (success) or red (error) message in <div id="message">
function showMessage(text, type) {
  const box = document.getElementById("message");
  if (!box) return;
  box.textContent = text;
  box.className = "message message-" + type; // message-success / message-error
  box.hidden = false;
  // Hide success messages after 4 seconds
  if (type === "success") {
    setTimeout(() => (box.hidden = true), 4000);
  }
}

// Who is on a shift, as HTML. A shift can be:
//  - assigned:            "Aisha Khan"
//  - open with a name:    the person posted it for a swap (still theirs until approved)
//  - open with no name:   nobody is on it at all
function whoIsOn(shift) {
  if (shift.status === "open" && shift.assigned_name) {
    return escapeHtml(shift.assigned_name) + ' <span class="status status-pending">Up for swap</span>';
  }
  if (shift.status === "open") {
    return '<span class="status status-open">Open – nobody assigned</span>';
  }
  return escapeHtml(shift.assigned_name);
}

// ---------- 2. Only managers allowed ----------

async function checkManager() {
  if (USE_SAMPLE_DATA) return { id: 1, name: "Priya Shah", role: "manager" }; // same as seed.sql
  try {
    const me = await api.get("/api/me");
    if (me.role !== "manager") {
      window.location.href = "/"; // employees go back to the login page
    }
    return me;
  } catch (error) {
    window.location.href = "/"; // not logged in
  }
}

// Log out button in the top bar (same as Masrur's employee pages)
async function logOut() {
  try {
    await api.post("/api/logout");
  } catch (error) {
    // even if the server fails, go back to the login page
  }
  window.location.href = "/";
}
document.addEventListener("click", (event) => {
  if (event.target.id === "logout-button") logOut();
});

// ---------- 3. Sample data store (only used while USE_SAMPLE_DATA) ----------
// Saved in localStorage so a shift created on one page shows on the next.

function loadSample() {
  try {
    const saved = localStorage.getItem("shiftswap-manager-sample-v2");
    if (saved) return JSON.parse(saved);
  } catch (error) {
    // localStorage blocked: just use fresh data
  }
  return buildSampleData();
}

function saveSample(data) {
  try {
    localStorage.setItem("shiftswap-manager-sample-v2", JSON.stringify(data));
  } catch (error) {
    // ignore
  }
}

// Call this from the browser console to start the demo again: resetSampleData()
function resetSampleData() {
  try {
    localStorage.removeItem("shiftswap-manager-sample-v2");
  } catch (error) {}
  location.reload();
}

// Like a SQL JOIN: add the employee's name to each shift
function addNames(shifts, staff) {
  return shifts.map((shift) => {
    const person = staff.find((s) => s.id === shift.assigned_to);
    return { ...shift, assigned_name: person ? person.name : null };
  });
}

// Sort by date, then start time
function sortShifts(shifts) {
  return shifts.sort((a, b) =>
    (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time)
  );
}

// ---------- 3. Data functions used by the pages ----------

// GET /api/shifts/week?start=YYYY-MM-DD  (start = a Monday)
async function getWeekShifts(start) {
  if (REAL.shifts) return api.get("/api/shifts/week?start=" + start);

  const data = loadSample();
  const end = addDays(start, 6);
  const week = data.shifts.filter((s) => s.shift_date >= start && s.shift_date <= end);
  return sortShifts(addNames(week, data.staff));
}

// POST /api/shifts
async function createShift(shift) {
  if (REAL.shifts) return api.post("/api/shifts", shift);

  const data = loadSample();
  const newShift = { id: data.nextShiftId, ...shift };
  data.nextShiftId = data.nextShiftId + 1;
  data.shifts.push(newShift);
  saveSample(data);
  return newShift;
}

// PUT /api/shifts/:id
async function updateShift(id, shift) {
  if (REAL.shifts) return api.put("/api/shifts/" + id, shift);

  const data = loadSample();
  const index = data.shifts.findIndex((s) => s.id === id);
  if (index === -1) throw new Error("Shift not found");
  data.shifts[index] = { id: id, ...shift };
  saveSample(data);
  return data.shifts[index];
}

// DELETE /api/shifts/:id
async function deleteShift(id) {
  if (REAL.shifts) return api.del("/api/shifts/" + id);

  const data = loadSample();
  data.shifts = data.shifts.filter((s) => s.id !== id);
  data.swaps = data.swaps.filter((s) => s.shift_id !== id);
  saveSample(data);
  return { ok: true };
}

// GET /api/swaps/pending  – swaps a colleague has accepted, waiting for the manager
async function getPendingSwaps() {
  if (REAL.swaps) return api.get("/api/swaps/pending");

  const data = loadSample();
  const waiting = data.swaps.filter((s) => s.status === "accepted");

  // Add the shift details and both names, like a JOIN would
  return waiting.map((swap) => {
    const shift = data.shifts.find((s) => s.id === swap.shift_id) || {};
    const from = data.staff.find((s) => s.id === swap.from_user_id);
    const to = data.staff.find((s) => s.id === swap.to_user_id);
    return {
      ...swap,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      position: shift.position,
      from_name: from ? from.name : "Unknown",
      to_name: to ? to.name : "Unknown",
    };
  });
}

// POST /api/swaps/:id/approve  – the real server does this in one SQL transaction
async function approveSwap(id) {
  if (REAL.swaps) return api.post("/api/swaps/" + id + "/approve");

  const data = loadSample();
  const swap = data.swaps.find((s) => s.id === id);
  const shift = data.shifts.find((s) => s.id === swap.shift_id);
  swap.status = "approved";
  shift.assigned_to = swap.to_user_id; // the shift now belongs to the colleague
  shift.status = "assigned";
  saveSample(data);

  // Until Sujal's swap routes exist, also move the REAL shift, so the
  // real rota shows the change. Remove this when REAL.swaps is true.
  if (REAL.shifts) {
    await updateShift(swap.shift_id, { assigned_to: swap.to_user_id });
  }
  return { ok: true };
}

// POST /api/swaps/:id/reject
async function rejectSwap(id) {
  if (REAL.swaps) return api.post("/api/swaps/" + id + "/reject");

  const data = loadSample();
  const swap = data.swaps.find((s) => s.id === id);
  swap.status = "rejected";
  saveSample(data);
  return { ok: true };
}

// GET /api/staff  – employees and their hours this week
async function getStaff() {
  if (REAL.staff) return api.get("/api/staff");

  const data = loadSample();
  const monday = formatDate(getMonday(new Date()));
  const sunday = addDays(monday, 6);

  // Staff names come from sample data (same people as seed.sql), but the
  // hours come from the REAL rota once shifts are real.
  if (REAL.shifts) data.shifts = await getWeekShifts(monday);

  // Same idea as SQL: SUM of shift hours for each employee this week
  return data.staff.map((person) => {
    const theirShifts = data.shifts.filter(
      (s) => s.assigned_to === person.id && s.shift_date >= monday && s.shift_date <= sunday
    );
    let hours = 0;
    theirShifts.forEach((s) => (hours += hoursBetween(s.start_time, s.end_time)));
    return { ...person, shifts_this_week: theirShifts.length, hours_this_week: hours };
  });
}


// ---------- 4. Log out button on every manager page (SS-56, Sujal) ----------
// Adds a "Log out" button to the top bar, so no HTML page needs changing.

async function logOut() {
  try {
    await api.post("/api/logout");   // deletes the session on the server
  } catch (error) {
    // Already logged out – go to the login page anyway
  }
  window.location.href = "../index.html";
}

function addLogoutButton() {
  const topBar = document.querySelector(".top-bar");
  if (!topBar) return;               // page has no top bar – nothing to do
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = "Log out";
  button.addEventListener("click", logOut);
  topBar.append(button);
}

addLogoutButton();