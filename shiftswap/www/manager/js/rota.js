// =============================================================
// rota.js  –  Weekly Rota (Lajja)
// View every shift in a week (Mon–Sun), move between weeks,
// edit a shift (opens the Create Shift form) or delete it.
// =============================================================

// The Monday of the week we're looking at
let currentMonday = formatDate(getMonday(new Date()));

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
    const shifts = await getWeekShifts(currentMonday);

    // Go through the 7 days and list each day's shifts
    let html = "";
    for (let i = 0; i < 7; i++) {
      const date = addDays(currentMonday, i);
      const dayShifts = shifts.filter((s) => s.shift_date === date);

      html += `<h2>${niceDate(date)}</h2>`;
      html += dayShifts.length > 0
        ? dayShifts.map(rotaShift).join("")
        : '<p class="empty">No shifts.</p>';
    }
    rota.innerHTML = html;
  } catch (error) {
    rota.innerHTML = "";
    showMessage("Could not load the rota: " + error.message, "error");
  }
}

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
