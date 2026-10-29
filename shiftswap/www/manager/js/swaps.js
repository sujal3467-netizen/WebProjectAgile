// =============================================================
// swaps.js  –  Swap Approvals (Lajja)
// Lists swaps a colleague has accepted (status 'accepted').
// Approve -> the shift moves to the new person (Sujal's route
// does this in one SQL transaction). Reject -> nothing changes.
// After either, the list reloads, so the rota is up to date too.
// =============================================================

function swapCard(swap) {
  return `
    <div class="card">
      <div class="card-title">${niceDate(swap.shift_date)} · ${swap.start_time}–${swap.end_time}</div>
      <div class="card-sub">${escapeHtml(swap.position)}</div>
      <p>
        <strong>${escapeHtml(swap.from_name)}</strong> ➜ <strong>${escapeHtml(swap.to_name)}</strong>
      </p>
      <div class="btn-group">
        <button class="btn btn-success" style="flex:1" data-approve="${swap.id}">Approve</button>
        <button class="btn btn-danger" style="flex:1" data-reject="${swap.id}">Reject</button>
      </div>
    </div>`;
}

async function loadSwaps() {
  const list = document.getElementById("swap-list");
  try {
    const swaps = await getPendingSwaps();
    list.innerHTML =
      swaps.length > 0
        ? swaps.map(swapCard).join("")
        : '<p class="empty">No swaps waiting. You\'re all caught up. ✅</p>';
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
