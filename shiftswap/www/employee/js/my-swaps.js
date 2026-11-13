// =============================================================
// my-swaps.js – My Requests page (owner: Masrur, Jira SS-52)
// Uses: GET /api/me, GET /api/swaps/mine
// Needs /js/api.js to be loaded first.
// =============================================================

const listBox = document.getElementById("swaps-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("swaps-error");
const logoutButton = document.getElementById("logout-button");

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayName(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// style.css has no .status-accepted, so accepted reuses the blue "open" look.
const STATUS_CLASS = {
  pending: "status-pending",
  accepted: "status-open",
  approved: "status-approved",
  rejected: "status-rejected",
};

// A short sentence saying who did what.
function describe(swap, myId) {
  if (swap.from_user_id === myId) {
    if (swap.status === "pending") return "You offered this shift.";
    if (swap.status === "accepted") return `${swap.to_name} accepted. Waiting for your manager.`;
    if (swap.status === "approved") return `Approved. ${swap.to_name} now has this shift.`;
    return "Rejected. The shift stays with you.";
  }
  const giver = swap.from_name;
  if (swap.status === "pending") return `${giver} offered you this shift.`;
  if (swap.status === "accepted") return `You accepted ${giver}'s shift. Waiting for your manager.`;
  if (swap.status === "approved") return `Approved. You now have ${giver}'s shift.`;
  return `Rejected. The shift stays with ${giver}.`;
}

function makeCard(swap, myId) {
  const card = makeElement("article", "card mt-3");
  card.append(makeElement("h3", "card-title", formatDayName(parseDate(swap.shift_date))));
  card.append(makeElement("p", "card-description",
    `${swap.start_time} to ${swap.end_time} - ${swap.position}`));
  card.append(makeElement("p", "text-muted", describe(swap, myId)));
  card.append(makeElement("span", `status ${STATUS_CLASS[swap.status] || ""}`, swap.status));
  return card;
}

async function loadPage() {
  try {
    const me = await api.get("/api/me");
    const myId = (me.user || me).id;

    const data = await api.get("/api/swaps/mine");
    const swaps = (Array.isArray(data) ? data : data.swaps) || [];

    listBox.replaceChildren();
    if (swaps.length === 0) {
      listBox.append(makeElement("p", "text-muted", "You have no swap requests yet."));
    }
    for (const swap of swaps) {         // server already sorts newest first
      listBox.append(makeCard(swap, myId));
    }
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.classList.remove("hidden");
  } finally {
    loadingMessage.classList.add("hidden");
  }
}

logoutButton.addEventListener("click", async () => {
  try { await api.post("/api/logout"); } catch (error) { /* leave anyway */ }
  window.location.href = "/";
});

loadPage();
