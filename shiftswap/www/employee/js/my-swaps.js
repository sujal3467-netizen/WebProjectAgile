// =============================================================
// my-swaps.js – My Requests page (owner: Masrur, SS-52, SS-60, SS-61)
// SS-60: filter bar and paging.  SS-61: Edit and Cancel buttons.
// Uses:
//   GET  /api/me
//   GET  /api/swaps/mine?status=&side=&from=&to=&page=&limit=
//   PUT  /api/swaps/:id         { to_user_id }   (change who it is offered to)
//   POST /api/swaps/:id/cancel                   (take the request back)
//   GET  /api/shifts/week?start=...              (only to find colleagues' names)
// Needs /js/api.js and /employee/js/common.js to be loaded first.
// =============================================================

const PAGE_SIZE = 10;
let currentPage = 1;
let myId = null;          // set in startPage
let colleagues = null;    // list of { id, name }, loaded the first time it is needed

const listBox = document.getElementById("swaps-list");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("swaps-error");
const successMessage = document.getElementById("swaps-success");
const filterForm = document.getElementById("filter-form");
const statusSelect = document.getElementById("filter-status");
const sideSelect = document.getElementById("filter-side");
const fromInput = document.getElementById("filter-from");
const toInput = document.getElementById("filter-to");
const clearButton = document.getElementById("clear-button");

// Which badge colour each status gets (the classes live in style.css / employee.css).
const STATUS_CLASS = {
  pending: "status-pending",
  accepted: "status-accepted",
  approved: "status-approved",
  rejected: "status-rejected",
  cancelled: "status-cancelled",
};

// A short sentence saying who did what.
function describe(swap) {
  if (swap.from_user_id === myId) {
    if (swap.status === "pending") {
      return swap.to_name ? `You offered this shift to ${swap.to_name}.` : "You offered this shift to anyone.";
    }
    if (swap.status === "accepted") return `${swap.to_name} accepted. Waiting for your manager.`;
    if (swap.status === "approved") return `Approved. ${swap.to_name} now has this shift.`;
    if (swap.status === "cancelled") return "You cancelled this request. The shift is yours again.";
    return "Rejected. The shift stays with you.";
  }
  const giver = swap.from_name;
  if (swap.status === "pending") return `${giver} offered you this shift.`;
  if (swap.status === "accepted") return `You accepted ${giver}'s shift. Waiting for your manager.`;
  if (swap.status === "approved") return `Approved. You now have ${giver}'s shift.`;
  if (swap.status === "cancelled") return `${giver} cancelled this request.`;
  return `Rejected. The shift stays with ${giver}.`;
}

// ----- Colleagues for the Edit dropdown -----
// There is no "list my colleagues" route, so we read the next three weeks of
// the rota (any logged-in user may) and collect the people who have shifts.
async function loadColleagues() {
  if (colleagues !== null) return colleagues;

  const found = new Map();   // id -> name (a Map keeps each person only once)
  const day = new Date();
  for (let week = 0; week < 3; week++) {
    const shifts = await api.get("/api/shifts/week?start=" + toDateText(day));
    for (const shift of shifts) {
      if (shift.assigned_to && shift.assigned_to !== myId && shift.assigned_name) {
        found.set(shift.assigned_to, shift.assigned_name);
      }
    }
    day.setDate(day.getDate() + 7);
  }
  colleagues = [...found].map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return colleagues;
}

// ----- The small panels inside a card -----

// Remove any open panel from a card.
function closePanel(card) {
  const old = card.querySelector(".card-panel");
  if (old) old.remove();
}

// Edit panel: choose anyone or one colleague, then Save.
async function openEditPanel(card, swap) {
  closePanel(card);
  const panel = makeElement("div", "card-panel");
  panel.append(makeElement("p", "text-muted", "Loading colleagues..."));
  card.append(panel);

  let people;
  try {
    people = await loadColleagues();
  } catch (error) {
    panel.replaceChildren(makeElement("p", "error-text", error.message));
    return;
  }

  const group = makeElement("div", "form-group");
  const label = makeElement("label", "", "Offer this shift to");
  const select = makeElement("select");
  label.htmlFor = `offer-to-${swap.id}`;
  select.id = `offer-to-${swap.id}`;

  const anyone = makeElement("option", "", "Anyone (open shift)");
  anyone.value = "";
  select.append(anyone);
  for (const person of people) {
    const option = makeElement("option", "", person.name);
    option.value = person.id;
    select.append(option);
  }
  select.value = swap.to_user_id ? String(swap.to_user_id) : "";
  group.append(label, select);

  const actions = makeElement("div", "card-actions");
  const save = makeElement("button", "btn btn-primary", "Save");
  save.type = "button";
  const close = makeElement("button", "btn btn-secondary", "Close");
  close.type = "button";
  actions.append(save, close);

  close.addEventListener("click", () => closePanel(card));
  save.addEventListener("click", async () => {
    save.disabled = true;
    setMessage(errorMessage, "");
    try {
      // "" means anyone, which the server wants as null.
      const toUserId = select.value === "" ? null : Number(select.value);
      await api.put(`/api/swaps/${swap.id}`, { to_user_id: toUserId });
      await loadSwaps();
      setMessage(successMessage, "Request updated.");
    } catch (error) {
      setMessage(successMessage, "");
      setMessage(errorMessage, error.message);   // e.g. a colleague just accepted it
      save.disabled = false;
    }
  });

  panel.replaceChildren(group, actions);
}

// Cancel panel: ask "Are you sure?" on the page before anything happens.
function openCancelPanel(card, swap) {
  closePanel(card);
  const panel = makeElement("div", "card-panel");
  panel.append(makeElement("p", "", "Cancel this request? The shift will be yours again."));

  const actions = makeElement("div", "card-actions");
  const yes = makeElement("button", "btn btn-danger", "Yes, cancel request");
  yes.type = "button";
  const no = makeElement("button", "btn btn-secondary", "No, keep it");
  no.type = "button";
  actions.append(yes, no);
  panel.append(actions);
  card.append(panel);

  no.addEventListener("click", () => closePanel(card));
  yes.addEventListener("click", async () => {
    yes.disabled = true;
    setMessage(errorMessage, "");
    try {
      await api.post(`/api/swaps/${swap.id}/cancel`);
      await loadSwaps();
      setMessage(successMessage, "Request cancelled.");
    } catch (error) {
      setMessage(successMessage, "");
      setMessage(errorMessage, error.message);   // e.g. "This swap has already been decided"
      yes.disabled = false;
    }
  });
}

// ----- One card per swap -----
function makeCard(swap) {
  const card = makeElement("article", "card mt-3");
  card.append(makeElement("h3", "card-title", formatDayName(parseDate(swap.shift_date))));
  card.append(makeElement("p", "card-description",
    `${swap.start_time} to ${swap.end_time} - ${swap.position}`));
  card.append(makeElement("p", "text-muted", describe(swap)));
  card.append(makeElement("span", `status ${STATUS_CLASS[swap.status] || ""}`, swap.status));

  // Buttons only on MY requests that can still be changed.
  const mine = swap.from_user_id === myId;
  const canEdit = mine && swap.status === "pending";
  const canCancel = mine && (swap.status === "pending" || swap.status === "accepted");

  if (canEdit || canCancel) {
    const actions = makeElement("div", "card-actions");
    if (canEdit) {
      const edit = makeElement("button", "btn btn-secondary", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openEditPanel(card, swap));
      actions.append(edit);
    }
    if (canCancel) {
      const cancel = makeElement("button", "btn btn-danger", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => openCancelPanel(card, swap));
      actions.append(cancel);
    }
    card.append(actions);
  }
  return card;
}

function filtersAreUsed() {
  return Boolean(statusSelect.value || sideSelect.value || fromInput.value || toInput.value);
}

// Ask the server for the current page with the current filters.
async function loadSwaps() {
  loadingMessage.classList.remove("hidden");
  try {
    const query = makeQuery({
      status: statusSelect.value,
      side: sideSelect.value,
      from: fromInput.value,
      to: toInput.value,
      page: currentPage,
      limit: PAGE_SIZE,
    });
    const result = await api.get("/api/swaps/mine?" + query);

    if (result.items.length === 0 && currentPage > 1) {
      currentPage = result.pages;
      return loadSwaps();
    }

    listBox.replaceChildren();
    if (result.items.length === 0) {
      const text = filtersAreUsed()
        ? "No requests match your filters. Try different filters or clear them."
        : "You have no swap requests yet.";
      listBox.append(makeElement("p", "text-muted", text));
    }
    for (const swap of result.items) {   // the server sorts newest first
      listBox.append(makeCard(swap));
    }
    showPager(result, "request");
  } catch (error) {
    listBox.replaceChildren();
    hidePager();
    setMessage(errorMessage, error.message);
  } finally {
    loadingMessage.classList.add("hidden");
  }
}

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
  setMessage(errorMessage, "");
  setMessage(successMessage, "");
  loadSwaps();
});

clearButton.addEventListener("click", () => {
  filterForm.reset();
  currentPage = 1;
  setMessage(errorMessage, "");
  loadSwaps();
});

wirePager((change) => {
  currentPage += change;
  loadSwaps();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function startPage() {
  try {
    const me = await api.get("/api/me");
    myId = (me.user || me).id;
  } catch (error) {
    setMessage(errorMessage, error.message);
  }
  loadSwaps();
}

startPage();
