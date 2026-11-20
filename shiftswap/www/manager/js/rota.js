// =============================================================
// rota.js  –  Weekly Rota (Lajja)
// View every shift in a week (Mon–Sun), move between weeks,
// edit a shift (opens the Create Shift form) or delete it.
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

// Build the HTML for one shift
function rotaShift(shift) {
  const who = whoIsOn(shift);

  return `
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-title">${shift.start_time}–${shift.end_time} · ${escapeHtml(shift.position)}</div>
          <div class="card-sub">${who} · ${hoursBetween(shift.start_time, shift.end_time)} h</div>
        </div>
        <div class="btn-group no-print">
          <a class="btn btn-secondary btn-small"
             href="create-shift.html?id=${shift.id}&date=${shift.shift_date}">Edit</a>
          <button class="btn btn-danger btn-small" data-delete="${shift.id}">Delete</button>
        </div>
      </div>
    </div>`;
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

    // Go through the 7 days and list each day's shifts.
    // With a filter on, days without matching shifts are left out.
    let html = "";
    for (let i = 0; i < 7; i++) {
      const date = addDays(currentMonday, i);
      const dayShifts = shifts.filter((s) => s.shift_date === date);
      if (dayShifts.length === 0 && filtersAreOn()) continue;

      html += `<h2>${niceDate(date)}</h2>`;
      html += dayShifts.length > 0
        ? dayShifts.map(rotaShift).join("")
        : '<p class="empty">No shifts.</p>';
    }
    if (html === "") {
      html = '<p class="empty">No shifts match your filters this week. Try another week or press Clear.</p>';
    }
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
