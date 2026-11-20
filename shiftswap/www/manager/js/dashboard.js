// =============================================================
// dashboard.js  –  Manager Dashboard (Lajja)
// Shows: today's shifts, uncovered shifts in the next 7 days,
// and how many swaps are waiting for approval.
// =============================================================

// One row of the timeline: time on the left, then position and person
function shiftCard(shift) {
  return `
    <div class="timeline-row ${positionClass(shift.position)}">
      <div class="timeline-time">
        <strong>${shift.start_time}</strong>
        <span>${shift.end_time}</span>
      </div>
      <div class="timeline-body">
        <div class="shift-pos">${escapeHtml(shift.position)} <span class="muted">· ${niceDate(shift.shift_date)}</span></div>
        <div class="shift-who">${personTag(shift)}</div>
      </div>
      ${shift.status === "open"
        ? `<a class="btn btn-secondary btn-small" href="create-shift.html?id=${shift.id}&date=${shift.shift_date}">Fill</a>`
        : ""}
    </div>`;
}

// A small bar chart: how many shifts each day this week,
// blue = covered, amber = open
function weekChart(monday, shifts) {
  const today = formatDate(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dayShifts = shifts.filter((s) => s.shift_date === date);
    const open = dayShifts.filter((s) => s.status === "open").length;
    days.push({ date, total: dayShifts.length, open });
  }
  const most = Math.max(1, ...days.map((d) => d.total));

  return days
    .map((d) => {
      const covered = d.total - d.open;
      return `
      <div class="bar-col${d.date === today ? " is-today" : ""}" title="${niceDate(d.date)}: ${d.total} shift(s), ${d.open} open">
        <span class="bar-value">${d.total}</span>
        <div class="bar-track">
          <div class="bar bar-open" style="height:${(d.open / most) * 100}%"></div>
          <div class="bar bar-covered" style="height:${(covered / most) * 100}%"></div>
        </div>
        <span class="bar-day">${niceDate(d.date).split(" ")[0]}</span>
      </div>`;
    })
    .join("");
}

async function loadDashboard() {
  const me = await checkManager();
  document.getElementById("welcome").textContent =
    "Hello " + me.name.split(" ")[0] + " – today is " + niceDate(formatDate(new Date()));

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

    // This week's chart
    document.getElementById("week-chart").innerHTML = weekChart(thisMonday, thisWeek);

    // Swaps waiting
    document.getElementById("stat-swaps").textContent = swaps.length;
  } catch (error) {
    showMessage("Could not load the dashboard: " + error.message, "error");
  }
}

loadDashboard();
