// =============================================================
// staff.js  –  Staff List (Lajja)
// Every employee with their shifts and hours this week,
// plus estimated pay (hours × hourly_rate). Data: GET /api/staff
// =============================================================

function staffCard(person) {
  const pay = person.hours_this_week * person.hourly_rate;
  return `
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-title">${escapeHtml(person.name)}</div>
          <div class="card-sub">${escapeHtml(person.email)} · ${money(person.hourly_rate)}/h</div>
        </div>
        <div style="text-align:right">
          <div class="card-title">${person.hours_this_week} h</div>
          <div class="card-sub">${person.shifts_this_week} shift(s) · ${money(pay)}</div>
        </div>
      </div>
    </div>`;
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
    document.getElementById("total-pay").textContent = "Estimated wage bill: " + money(totalPay);
    document.getElementById("staff-list").innerHTML =
      staff.length > 0 ? staff.map(staffCard).join("") : '<p class="empty">No employees yet.</p>';
  } catch (error) {
    document.getElementById("staff-list").innerHTML = "";
    showMessage("Could not load staff: " + error.message, "error");
  }
}

checkManager().then(loadStaff);
