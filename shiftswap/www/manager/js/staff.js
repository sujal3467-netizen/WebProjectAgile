// =============================================================
// staff.js  –  Staff List (Lajja)
// Every employee with their shifts and hours this week,
// plus estimated pay (hours × hourly_rate). Data: GET /api/staff
// =============================================================

// One row per employee. The bar shows their hours compared with
// whoever works the most this week.
function staffCard(person, mostHours) {
  const pay = person.hours_this_week * person.hourly_rate;
  const width = mostHours > 0 ? (person.hours_this_week / mostHours) * 100 : 0;
  return `
    <div class="staff-row">
      ${avatar(person.name)}
      <div class="staff-info">
        <strong>${escapeHtml(person.name)}</strong>
        <span class="muted">${escapeHtml(person.email)} · ${money(person.hourly_rate)}/h</span>
      </div>
      <div class="staff-hours">
        <div class="hours-bar"><span style="width:${width}%"></span></div>
        <span class="muted">${person.shifts_this_week} shift(s)</span>
      </div>
      <div class="staff-total">
        <strong>${person.hours_this_week} h</strong>
        <span class="muted">${money(pay)}</span>
      </div>
    </div>`;
}

// Show the list, keeping only people whose name or email contains the search text
let allStaff = [];
function showStaff() {
  const search = document.getElementById("staff-search").value.trim().toLowerCase();
  const shown = allStaff.filter(
    (p) => p.name.toLowerCase().includes(search) || p.email.toLowerCase().includes(search)
  );
  const mostHours = Math.max(0, ...allStaff.map((p) => p.hours_this_week));
  document.getElementById("staff-list").innerHTML =
    shown.length > 0
      ? shown.map((p) => staffCard(p, mostHours)).join("")
      : '<p class="empty">No employees match your search.</p>';
}

async function loadStaff() {
  const monday = formatDate(getMonday(new Date()));
  document.getElementById("week-range").textContent =
    niceDate(monday) + " – " + niceDate(addDays(monday, 6));

  try {
    const staff = await getStaff();

    // Most hours first
    staff.sort((a, b) => b.hours_this_week - a.hours_this_week);

    let totalHours = 0;
    let totalPay = 0;
    staff.forEach((p) => {
      totalHours += p.hours_this_week;
      totalPay += p.hours_this_week * p.hourly_rate;
    });

    document.getElementById("total-hours").textContent = totalHours + " h";
    document.getElementById("total-pay").textContent = money(totalPay);
    allStaff = staff;
    if (staff.length > 0) showStaff();
    else document.getElementById("staff-list").innerHTML = '<p class="empty">No employees yet.</p>';
  } catch (error) {
    document.getElementById("staff-list").innerHTML = "";
    showMessage("Could not load staff: " + error.message, "error");
  }
}

document.getElementById("staff-search").addEventListener("input", showStaff);
checkManager().then(loadStaff);
