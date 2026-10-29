// =============================================================
// dashboard.js  –  Manager Dashboard (Lajja)
// Shows: today's shifts, uncovered shifts in the next 7 days,
// and how many swaps are waiting for approval.
// =============================================================

// One card for one shift
function shiftCard(shift) {
  const who = whoIsOn(shift);

  return `
    <div class="card">
      <div class="card-row">
        <div>
          <div class="card-title">${shift.start_time}–${shift.end_time} · ${escapeHtml(shift.position)}</div>
          <div class="card-sub">${niceDate(shift.shift_date)}</div>
        </div>
        <div>${who}</div>
      </div>
    </div>`;
}

async function loadDashboard() {
  const me = await checkManager();
  document.getElementById("welcome").textContent =
    "Hello " + me.name + " – today is " + niceDate(formatDate(new Date()));

  try {
    const today = formatDate(new Date());
    const thisMonday = formatDate(getMonday(new Date()));
    const nextMonday = addDays(thisMonday, 7);
    const inSevenDays = addDays(today, 6);

    // Get this week and next week, so "next 7 days" works on a Sunday too.
    // Promise.all runs the requests at the same time.
    const [thisWeek, nextWeek, swaps] = await Promise.all([
      getWeekShifts(thisMonday),
      getWeekShifts(nextMonday),
      getPendingSwaps(),
    ]);
    const allShifts = thisWeek.concat(nextWeek);

    // Today's shifts
    const todayShifts = allShifts.filter((s) => s.shift_date === today);
    document.getElementById("stat-today").textContent = todayShifts.length;
    document.getElementById("today-list").innerHTML =
      todayShifts.length > 0
        ? todayShifts.map(shiftCard).join("")
        : '<p class="empty">No shifts today.</p>';

    // Uncovered = status 'open' between today and 7 days from now
    const openShifts = allShifts.filter(
      (s) => s.status === "open" && s.shift_date >= today && s.shift_date <= inSevenDays
    );
    document.getElementById("stat-open").textContent = openShifts.length;
    document.getElementById("open-list").innerHTML =
      openShifts.length > 0
        ? openShifts.map(shiftCard).join("")
        : '<p class="empty">Every shift is covered. 🎉</p>';

    // Warning banner
    const warning = document.getElementById("uncovered-warning");
    if (openShifts.length > 0) {
      warning.textContent =
        "⚠️ " + openShifts.length + " shift(s) in the next 7 days have nobody assigned.";
      warning.hidden = false;
    }

    // Swaps waiting
    document.getElementById("stat-swaps").textContent = swaps.length;
  } catch (error) {
    showMessage("Could not load the dashboard: " + error.message, "error");
  }
}

loadDashboard();
