// =============================================================
// swaps.js  –  Pending swaps page (Lajja) – Jira SS-53
// Lists swaps a colleague has accepted (status 'accepted').
// Approve -> the shift moves to the new person (Sujal's route
// does this in one SQL transaction). Reject -> nothing changes.
// After either, the list reloads, so the rota is up to date too.
// =============================================================

function swapCard(swap) {
  return `
    <article class="swap-card ${positionClass(swap.position)}">
      <div class="swap-when">
        <span class="swap-day">${niceDate(swap.shift_date)}</span>
        <strong>${swap.start_time} – ${swap.end_time}</strong>
        <span class="tag">${escapeHtml(swap.position)}</span>
      </div>
      <div class="swap-people">
        <div class="swap-person">${avatar(swap.from_name)}<span><small>From</small>${escapeHtml(swap.from_name)}</span></div>
        <span class="swap-arrow" aria-label="to">→</span>
        <div class="swap-person">${avatar(swap.to_name)}<span><small>To</small>${escapeHtml(swap.to_name)}</span></div>
      </div>
      <div class="swap-buttons">
        <button class="btn btn-success" type="button" data-approve="${swap.id}">Approve</button>
        <button class="btn btn-secondary btn-reject" type="button" data-reject="${swap.id}">Reject</button>
      </div>
    </article>`;
}

async function loadSwaps() {
  const list = document.getElementById("swap-list");
  try {
    const swaps = await getPendingSwaps();
    list.innerHTML =
      swaps.length > 0
        ? swaps.map(swapCard).join("")
        : '<div class="all-done"><span>✓</span><strong>All caught up</strong><p>No swaps are waiting for you.</p></div>';
  } catch (error) {
    list.innerHTML = "";
    showMessage("Could not load swaps: " + error.message, "error");
  }
}

async function handleClick(event) {
  const approveId = event.target.dataset.approve;
  const rejectId = event.target.dataset.reject;
  if (!approveId && !rejectId) return;

  event.target.disabled = true; // stop double clicks
  try {
    if (approveId) {
      await approveSwap(Number(approveId));
      showMessage("✔ Swap approved. The rota has been updated.", "success");
    } else {
      await rejectSwap(Number(rejectId));
      showMessage("Swap rejected. The shift stays with the original person.", "success");
    }
    loadSwaps();
  } catch (error) {
    event.target.disabled = false;
    showMessage("Something went wrong: " + error.message, "error");
  }
}

document.getElementById("swap-list").addEventListener("click", handleClick);
checkManager().then(loadSwaps);
