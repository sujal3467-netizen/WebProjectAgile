// =============================================================
// create-shift.js  –  Create Shift form (Lajja)
// The same page also EDITS a shift:
//   create-shift.html                         -> create a new shift
//   create-shift.html?id=5&date=2026-11-03    -> edit shift 5
// (there's no "get one shift" route, so we load that week and find it)
// =============================================================

const form = document.getElementById("shift-form");
const dateInput = document.getElementById("shift-date");
const startInput = document.getElementById("start-time");
const endInput = document.getElementById("end-time");
const positionInput = document.getElementById("position");
const employeeInput = document.getElementById("employee");
const saveButton = document.getElementById("save-button");

// Read ?id= and ?date= from the address bar
const params = new URLSearchParams(window.location.search);
const editId = params.get("id") ? Number(params.get("id")) : null;

// Fill the employee dropdown from GET /api/staff
async function loadEmployees() {
  const staff = await getStaff();
  staff.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    employeeInput.appendChild(option);
  });
}

// If editing, put the shift's current values into the form
async function loadShiftToEdit() {
  const date = params.get("date");
  const shifts = await getWeekShifts(formatDate(getMonday(parseDate(date))));
  const shift = shifts.find((s) => s.id === editId);

  if (!shift) {
    showMessage("That shift could not be found.", "error");
    return;
  }

  document.querySelector(".top-bar h1").textContent = "Edit Shift";
  document.title = "Edit Shift – ShiftSwap Manager";
  saveButton.textContent = "Save changes";

  dateInput.value = shift.shift_date;
  startInput.value = shift.start_time;
  endInput.value = shift.end_time;
  positionInput.value = shift.position;
  employeeInput.value = shift.assigned_to || "";
  showLength();
}

// Show "6 hours" under the times so the manager can check
function showLength() {
  const lengthText = document.getElementById("shift-length");
  if (startInput.value && endInput.value) {
    const hours = hoursBetween(startInput.value, endInput.value);
    lengthText.textContent = hours > 0 ? "Shift length: " + hours + " hours" : "";
  }
}

// Check the form. Returns an error message, or "" if everything is fine.
function validate() {
  if (!dateInput.value) return "Please choose a date.";
  if (!startInput.value || !endInput.value) return "Please enter a start and end time.";
  if (toMinutes(endInput.value) <= toMinutes(startInput.value)) {
    return "The end time must be after the start time.";
  }
  if (hoursBetween(startInput.value, endInput.value) > 12) {
    return "A shift can't be longer than 12 hours.";
  }
  if (!positionInput.value) return "Please choose a position.";
  if (!editId && dateInput.value < formatDate(new Date())) {
    return "You can't create a shift in the past.";
  }
  return "";
}

async function saveShift(event) {
  event.preventDefault(); // stop the page reloading

  const problem = validate();
  if (problem) {
    showMessage(problem, "error");
    return;
  }

  // The body Sujal's route expects (same names as the shifts table)
  const assignedTo = employeeInput.value ? Number(employeeInput.value) : null;
  const shift = {
    shift_date: dateInput.value,
    start_time: startInput.value,
    end_time: endInput.value,
    position: positionInput.value,
    assigned_to: assignedTo,
    status: assignedTo ? "assigned" : "open",
  };

  saveButton.disabled = true; // stop double clicks
  try {
    if (editId) {
      await updateShift(editId, shift);
      showMessage("✔ Shift updated.", "success");
    } else {
      await createShift(shift);
      const who = assignedTo ? employeeInput.options[employeeInput.selectedIndex].text : "open";
      showMessage(
        "✔ Shift saved: " + niceDate(shift.shift_date) + ", " +
          shift.start_time + "–" + shift.end_time + " (" + who + ").",
        "success"
      );
      form.reset(); // ready for the next one
      document.getElementById("shift-length").textContent = "";
    }
  } catch (error) {
    showMessage("Could not save the shift: " + error.message, "error");
  }
  saveButton.disabled = false;
}

async function start() {
  await checkManager();
  dateInput.min = editId ? "" : formatDate(new Date()); // no past dates when creating
  try {
    await loadEmployees();
    if (editId) await loadShiftToEdit();
  } catch (error) {
    showMessage("Could not load the form: " + error.message, "error");
  }
}

startInput.addEventListener("change", showLength);
endInput.addEventListener("change", showLength);
form.addEventListener("submit", saveShift);
start();
