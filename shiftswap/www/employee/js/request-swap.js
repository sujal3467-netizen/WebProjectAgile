// =============================================================
// request-swap.js – Request Swap page (owner: Masrur, Jira SS-50)
// Uses: GET /api/shifts/mine, POST /api/swaps { shift_id }
// Needs /js/api.js to be loaded first.
// =============================================================

const form = document.getElementById("swap-form");
const shiftSelect = document.getElementById("shift-select");
const submitButton = document.getElementById("submit-button");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("swap-error");
const successMessage = document.getElementById("swap-success");
const noShifts = document.getElementById("no-shifts");
const logoutButton = document.getElementById("logout-button");

// "2026-11-14" -> Date at local midnight (avoids the UTC off-by-one).
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

// Fill the dropdown with shifts I can still offer (assigned, not already offered).
async function loadShifts() {
  loadingMessage.classList.remove("hidden");
  try {
    const data = await api.get("/api/shifts/mine");
    const shifts = (Array.isArray(data) ? data : data.shifts) || [];
    const offerable = shifts
      .filter((shift) => shift.status === "assigned")
      .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));

    shiftSelect.replaceChildren();
    for (const shift of offerable) {
      const option = document.createElement("option");
      option.value = shift.id;
      option.textContent =
        `${formatDayName(parseDate(shift.shift_date))}, ${shift.start_time} to ${shift.end_time} - ${shift.position}`;
      shiftSelect.append(option);
    }

    form.classList.toggle("hidden", offerable.length === 0);
    noShifts.classList.toggle("hidden", offerable.length !== 0);
  } catch (error) {
    showError(error.message);
  } finally {
    loadingMessage.classList.add("hidden");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();               // stop the page reloading
  submitButton.disabled = true;         // stop double clicks
  try {
    await api.post("/api/swaps", { shift_id: Number(shiftSelect.value) });
    await loadShifts();                 // the offered shift leaves the list
    showSuccess("Request sent. Your shift is now open for colleagues.");
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  try { await api.post("/api/logout"); } catch (error) { /* leave anyway */ }
  window.location.href = "/";
});

loadShifts();
