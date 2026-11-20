// =============================================================
// rota.js  –  Weekly Rota (Lajja)
// View every shift in a week (Mon–Sun), move between weeks,
// edit a shift (opens the Create Shift form) or delete it.
// Design v2: the week is shown as 7 day columns with colour-coded shift cards.
// SS-62: filter bar – by employee, position and status. The filters
// are sent to the server, so only matching shifts are loaded.
// =============================================================

// The Monday of the week we're looking at
let currentMonday = formatDate(getMonday(new Date()));

const filterForm = document.getElementById("filter-form");
const employeeSelect = document.getElementById("filter-employee");
const positionInput = document.getElementById("filter-position");
const statusSelect = document.getElementById("filter-status");
const resultCount = document.getElementById("result-count");

// The filters the manager has chosen (empty = no filter).
// They stay the same when moving to another week.
function currentFilters() {
  return {
    employee: employeeSelect.value,
    position: positionInput.value.trim(),
    status: statusSelect.value,
  };
}

function filtersAreOn() {
  const f = currentFilters();
  return Boolean(f.employee || f.position || f.status);
}

// Fill the Employee list: the staff from seed.sql, plus anyone
// who appears on the rota, sorted by name
const knownEmployees = new Map();
function rememberEmployees(people) {
  people.forEach((p) => { if (p.id && p.name) knownEmployees.set(p.id, p.name); });
  const chosen = employeeSelect.value;
  const sorted = [...knownEmployees].sort((a, b) => a[1].localeCompare(b[1]));
  employeeSelect.innerHTML = '<option value="">All employees</option>' +
    sorted.map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("");
  employeeSelect.value = chosen;
}
rememberEmployees(buildSampleData().staff);

// Build the HTML for one shift: a small card with a colour stripe
// for its position (colours are in manager.css)
function rotaShift(shift) {
  return `
    <article class="shift ${positionClass(shift.position)}">
      <div class="shift-time">${shift.start_time} – ${shift.end_time}<span>${hoursBetween(shift.start_time, shift.end_time)} h</span></div>
      <div class="shift-pos">${escapeHtml(shift.position)}</div>
      <div class="shift-who">${personTag(shift)}</div>
      <div class="shift-actions no-print">
        <a class="link-btn" href="create-shift.html?id=${shift.id}&date=${shift.shift_date}">Edit</a>
        <button class="link-btn link-danger" type="button" data-delete="${shift.id}">Delete</button>
      </div>
    </article>`;
}

async function loadRota() {
  const sunday = addDays(currentMonday, 6);
  document.getElementById("week-label").textContent =
    niceDate(currentMonday) + " – " + niceDate(sunday);

  const rota = document.getElementById("rota");
  rota.innerHTML = '<p class="loading">Loading…</p>';

  try {
    const shifts = await getWeekShifts(currentMonday, currentFilters());
    rememberEmployees(shifts.map((s) => ({ id: s.assigned_to, name: s.assigned_name })));

    // How many shifts match, so the manager knows the filter worked
    const word = shifts.length === 1 ? "shift" : "shifts";
    resultCount.textContent = filtersAreOn()
      ? `${shifts.length} ${word} match your filters this week.`
      : `${shifts.length} ${word} this week.`;

    // Go through the 7 days: one column per day.
    // With a filter on, days without matching shifts are left out.
    const today = formatDate(new Date());
    let html = "";
    let columns = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(currentMonday, i);
      const dayShifts = shifts.filter((s) => s.shift_date === date);
      if (dayShifts.length === 0 && filtersAreOn()) continue;
      columns++;

      const [dayName, dayNumber, month] = niceDate(date).split(" ");
      html += `
        <section class="day${date === today ? " is-today" : ""}">
          <header class="day-head">
            <span class="day-name">${dayName}</span>
            <span class="day-date">${dayNumber} ${month}</span>
            <span class="day-count">${dayShifts.length}</span>
          </header>
          <div class="day-shifts">
            ${dayShifts.length > 0 ? dayShifts.map(rotaShift).join("") : '<p class="empty">No shifts</p>'}
          </div>
        </section>`;
    }
    if (html === "") {
      html = '<p class="empty empty-big">No shifts match your filters this week. Try another week or press Clear.</p>';
    }
    rota.style.setProperty("--columns", Math.max(columns, 1));
    rota.innerHTML = html;
  } catch (error) {
    rota.innerHTML = "";
    resultCount.textContent = "";
    // e.g. the server's "status must be one of: assigned, open"
    showMessage("Could not load the rota: " + error.message, "error");
  }
}

// Apply / Clear the filters
filterForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stay on the page
  loadRota();
});
document.getElementById("clear-button").addEventListener("click", () => {
  filterForm.reset();
  loadRota();
});

// One click listener for all Delete buttons ("event delegation"),
// because the buttons are created after the page loads
async function handleRotaClick(event) {
  const id = event.target.dataset.delete;
  if (!id) return; // the click wasn't on a Delete button

  if (!confirm("Delete this shift? This can't be undone.")) return;

  try {
    await deleteShift(Number(id));
    showMessage("✔ Shift deleted.", "success");
    loadRota(); // refresh the list
  } catch (error) {
    showMessage("Could not delete the shift: " + error.message, "error");
  }
}

document.getElementById("prev-week").addEventListener("click", () => {
  currentMonday = addDays(currentMonday, -7);
  loadRota();
});
document.getElementById("next-week").addEventListener("click", () => {
  currentMonday = addDays(currentMonday, 7);
  loadRota();
});
document.getElementById("print-button").addEventListener("click", () => window.print());
document.getElementById("rota").addEventListener("click", handleRotaClick);

checkManager().then(loadRota);
