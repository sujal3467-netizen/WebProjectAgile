// =============================================================
// Swap routes (Week 3, Monday) – owner: Sujal
// Use cases: "Offer a shift", "Take an open shift", "Approve or reject swaps"
//
//   POST /api/swaps                { shift_id, to_user_id? }   offer my shift      (employees)
//   GET  /api/swaps/mine                                       my swaps            (employees)
//          ?status= &side=given|taken &from= &to= &page= &limit=   (Week 4, SS-57)
//   POST /api/swaps/:id/accept                                 take a shift        (employees)
//   PUT  /api/swaps/:id            { to_user_id }              change my request   (employees, Week 4, SS-58)
//   POST /api/swaps/:id/cancel                                 cancel my request   (employees, Week 4, SS-58)
//   GET  /api/swaps/pending                                    waiting for decision (managers)
//   POST /api/swaps/:id/approve                                approve             (managers)
//   POST /api/swaps/:id/reject                                 reject              (managers)
//
// THE SWAP FLOW
//   pending   – an employee offered their shift (the shift becomes "open")
//   accepted  – a colleague took it (still waiting for the manager)
//   approved  – the manager agreed: the shift now belongs to the colleague
//   rejected  – the manager said no: the shift stays with the original employee
//   cancelled – the employee who offered it took it back before the manager decided
// =============================================================

import { db, transaction } from "../db.js";
import { checkAccess } from "../auth.js";
import { notify, notifyRole } from "../notify.js";
import {
  jsonResponse, errorResponse, readJson, toId,
  readPaging, readDateFilter, readChoiceFilter,
} from "../helpers.js";
import { runList } from "../list.js";

// Every swap we send back has the same shape: the request, its shift,
// and the names of both employees.
const SWAP_FIELDS = `
  swap_requests.id, swap_requests.status, swap_requests.created_at,
  swap_requests.shift_id, shifts.shift_date, shifts.start_time, shifts.end_time, shifts.position,
  swap_requests.from_user_id, giver.name AS from_name,
  swap_requests.to_user_id, taker.name AS to_name
`;
const SWAP_FROM = `
  FROM swap_requests
  JOIN shifts ON shifts.id = swap_requests.shift_id
  JOIN users AS giver ON giver.id = swap_requests.from_user_id
  LEFT JOIN users AS taker ON taker.id = swap_requests.to_user_id
`;
const SWAP_COLUMNS = SWAP_FIELDS + SWAP_FROM;
const SWAP_STATUSES = ["pending", "accepted", "approved", "rejected", "cancelled"];

function findSwap(id) {
  return db.prepare(`SELECT ${SWAP_COLUMNS} WHERE swap_requests.id = ?`).get(id);
}

// "2026-11-12 12:00–17:00 (Barista)" – used in notification messages.
function describeShift(swap) {
  return `${swap.shift_date} ${swap.start_time}–${swap.end_time} (${swap.position})`;
}

// ----- Check who a swap is offered to (BR9) -----
// null / left out = anyone; otherwise it must be ANOTHER employee's id.
// toId turns "3" into 3, so the id is always a number from here on.
// Returns { value } (an id, or null for anyone) or { error }.
function readColleague(rawId, user) {
  if (rawId === undefined || rawId === null) return { value: null };
  const message = "to_user_id must be another employee's id, or null to offer to anyone";
  const id = toId(rawId);
  if (id === null || id === user.id) return { error: message };
  const colleague = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'employee'").get(id);
  if (!colleague) return { error: message };
  return { value: id };
}

// ================================ EMPLOYEES ================================

// ----- POST /api/swaps  – offer one of my shifts -----
export async function handleCreateSwap(request) {
  const { user, error } = checkAccess(request, "employee");
  if (error) return error;

  const body = await readJson(request);
  const shiftId = toId(body?.shift_id);
  if (!shiftId) return errorResponse("Please send the shift_id of the shift to swap", 400);

  const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(shiftId);
  if (!shift) return errorResponse("Shift not found", 404);

  // BR7: you can only give away a shift that is yours...
  if (shift.assigned_to !== user.id) {
    return errorResponse("You can only swap your own shifts", 403);
  }
  // ...and that hasn't happened yet.
  const today = db.prepare("SELECT date('now', 'localtime') AS today").get().today;
  if (shift.shift_date < today) {
    return errorResponse("You can only swap shifts that haven't happened yet", 400);
  }

  // BR8: only one active (pending or accepted) request per shift.
  const active = db.prepare(`
    SELECT id FROM swap_requests
    WHERE shift_id = ? AND status IN ('pending', 'accepted')
  `).get(shiftId);
  if (active) return errorResponse("This shift already has a swap request", 400);

  // BR9: offered to anyone (left out / null) or to ANOTHER employee.
  const colleague = readColleague(body.to_user_id, user);
  if (colleague.error) return errorResponse(colleague.error, 400);
  const toUserId = colleague.value;

  // Save the request, open the shift and send notifications – all or nothing.
  const swapId = transaction(() => {
    const result = db.prepare(`
      INSERT INTO swap_requests (shift_id, from_user_id, to_user_id, status)
      VALUES (?, ?, ?, 'pending')
    `).run(shiftId, user.id, toUserId);
    db.prepare("UPDATE shifts SET status = 'open' WHERE id = ?").run(shiftId);

    const id = Number(result.lastInsertRowid);
    const message = `${user.name} offered their shift ${describeShift(shift)}`;
    if (toUserId !== null) {
      notify(toUserId, message + " to you", "/employee/");
    } else {
      notifyRole("employee", message, "/employee/", user.id);
    }
    return id;
  });

  return jsonResponse(findSwap(swapId), 201);
}

// ----- GET /api/swaps/mine  – swaps I gave away, took, or was offered -----
// Filters: ?status=pending  ?side=given|taken  ?from= &to= (the shift's date)
export function handleMySwaps(request, url) {
  const { user, error } = checkAccess(request, "employee");
  if (error) return error;

  const paging = readPaging(url);
  const status = readChoiceFilter(url, "status", SWAP_STATUSES);
  const side = readChoiceFilter(url, "side", ["given", "taken"]);
  const from = readDateFilter(url, "from");
  const to = readDateFilter(url, "to");
  const problem = paging.error || status.error || side.error || from.error || to.error;
  if (problem) return errorResponse(problem, 400);
  if (from.value && to.value && from.value > to.value) {
    return errorResponse("from must be before to", 400);
  }

  const conditions = [];
  const values = [];

  // Which of my swaps: ones I gave away, ones I took (or was offered), or both.
  if (side.value === "given") {
    conditions.push("swap_requests.from_user_id = ?");
    values.push(user.id);
  } else if (side.value === "taken") {
    conditions.push("swap_requests.to_user_id = ?");
    values.push(user.id);
  } else {
    conditions.push("(swap_requests.from_user_id = ? OR swap_requests.to_user_id = ?)");
    values.push(user.id, user.id);
  }

  if (status.value) {
    conditions.push("swap_requests.status = ?");
    values.push(status.value);
  }
  if (from.value) {
    conditions.push("shifts.shift_date >= ?");
    values.push(from.value);
  }
  if (to.value) {
    conditions.push("shifts.shift_date <= ?");
    values.push(to.value);
  }

  return runList({
    fields: SWAP_FIELDS, from: SWAP_FROM, conditions, values,
    order: "ORDER BY swap_requests.created_at DESC, swap_requests.id DESC",
    paging,
  });
}

// ----- POST /api/swaps/:id/accept  – take a colleague's shift -----
export function handleAcceptSwap(request, url, params) {
  const { user, error } = checkAccess(request, "employee");
  if (error) return error;

  const id = toId(params.id);
  const swap = id && findSwap(id);
  if (!swap) return errorResponse("Swap not found", 404);

  // The order of these checks matters: once someone has accepted, to_user_id
  // is set, so check the status BEFORE "offered to someone else".
  if (swap.from_user_id === user.id) {
    return errorResponse("You can't accept your own swap", 400);            // BR9
  }
  if (swap.status !== "pending") {
    return errorResponse("This swap is no longer available", 400);
  }
  if (swap.to_user_id !== null && swap.to_user_id !== user.id) {
    return errorResponse("This swap was offered to someone else", 403);     // BR9
  }
  const today = db.prepare("SELECT date('now', 'localtime') AS today").get().today;
  if (swap.shift_date < today) {
    return errorResponse("This shift has already happened", 400);
  }

  const accepted = transaction(() => {
    // "AND status = 'pending'" makes this safe if two people click Accept
    // at the same moment: only the first UPDATE changes a row.
    const result = db.prepare(`
      UPDATE swap_requests SET status = 'accepted', to_user_id = ?
      WHERE id = ? AND status = 'pending'
    `).run(user.id, id);
    if (result.changes === 0) return false;

    notify(swap.from_user_id,
      `${user.name} accepted your shift ${describeShift(swap)} – waiting for manager approval`,
      "/employee/");
    notifyRole("manager",
      `Swap waiting for approval: ${swap.from_name} → ${user.name}, ${describeShift(swap)}`,
      "/manager/");
    return true;
  });
  if (!accepted) return errorResponse("This swap is no longer available", 400);

  return jsonResponse(findSwap(id));
}

// ----- Shared checks for changing MY OWN request (edit and cancel) -----
// Returns { swap, user } if this employee may change it, or { error }.
function checkMyRequest(request, params) {
  const { user, error } = checkAccess(request, "employee");
  if (error) return { error };

  const id = toId(params.id);
  const swap = id && findSwap(id);
  if (!swap) return { error: errorResponse("Swap not found", 404) };

  // Only the employee who offered the shift can change or cancel the request.
  if (swap.from_user_id !== user.id) {
    return { error: errorResponse("You can only change your own swap requests", 403) };
  }
  if (swap.status === "cancelled") {
    return { error: errorResponse("This swap request is already cancelled", 400) };
  }
  if (swap.status === "approved" || swap.status === "rejected") {
    return { error: errorResponse("This swap has already been decided", 400) };
  }
  return { swap, user };
}

// ----- PUT /api/swaps/:id  – change who my pending request is offered to -----
// Send { "to_user_id": 3 } for a colleague, or { "to_user_id": null } for anyone.
export async function handleEditSwap(request, url, params) {
  const { swap, user, error } = checkMyRequest(request, params);
  if (error) return error;

  // Once a colleague has accepted, it's waiting for the manager:
  // it can still be cancelled, but no longer offered to someone else.
  if (swap.status !== "pending") {
    return errorResponse("Only pending swap requests can be changed – you can still cancel it", 400);
  }

  const body = await readJson(request);
  if (!body || !("to_user_id" in body)) {
    return errorResponse("Send to_user_id: an employee's id, or null to offer to anyone", 400);
  }
  const colleague = readColleague(body.to_user_id, user);
  if (colleague.error) return errorResponse(colleague.error, 400);
  const toUserId = colleague.value;

  const changed = transaction(() => {
    // "AND status = 'pending'" so a colleague accepting at the same moment wins.
    const result = db.prepare(`
      UPDATE swap_requests SET to_user_id = ?
      WHERE id = ? AND status = 'pending'
    `).run(toUserId, swap.id);
    if (result.changes === 0) return false;

    const message = `${user.name} offered their shift ${describeShift(swap)}`;
    if (toUserId !== null) {
      notify(toUserId, message + " to you", "/employee/");
    } else {
      notifyRole("employee", message, "/employee/", user.id);
    }
    return true;
  });
  if (!changed) {
    return errorResponse("A colleague has just accepted this swap – you can still cancel it", 400);
  }

  return jsonResponse(findSwap(swap.id));
}

// ----- POST /api/swaps/:id/cancel  – take my request back -----
// Allowed while it is pending or accepted (before the manager decides).
// The shift was always still mine, so it just becomes "assigned" again.
export function handleCancelSwap(request, url, params) {
  const { swap, user, error } = checkMyRequest(request, params);
  if (error) return error;

  const cancelled = transaction(() => {
    // Only cancel if it is still undecided (a manager may have just decided).
    const result = db.prepare(`
      UPDATE swap_requests SET status = 'cancelled'
      WHERE id = ? AND status IN ('pending', 'accepted')
    `).run(swap.id);
    if (result.changes === 0) return false;

    db.prepare("UPDATE shifts SET status = 'assigned' WHERE id = ?").run(swap.shift_id);

    // Tell whoever was involved.
    const message = `${user.name} cancelled the swap for ${describeShift(swap)}`;
    if (swap.to_user_id !== null) notify(swap.to_user_id, message, "/employee/");
    if (swap.status === "accepted") notifyRole("manager", message, "/manager/");
    return true;
  });
  if (!cancelled) return errorResponse("This swap has already been decided", 400);

  return jsonResponse(findSwap(swap.id));
}

// ================================ MANAGERS ================================

// ----- GET /api/swaps/pending  – accepted swaps waiting for a decision -----
export function handlePendingSwaps(request) {
  const { error } = checkAccess(request, "manager");
  if (error) return error;

  const swaps = db.prepare(`
    SELECT ${SWAP_COLUMNS}
    WHERE swap_requests.status = 'accepted'
    ORDER BY shifts.shift_date, shifts.start_time
  `).all();
  return jsonResponse(swaps);
}

// ----- Shared checks for approve and reject -----
// Returns { swap } if the manager may decide this swap, or { error }.
function checkDecision(request, params, action) {
  const { error } = checkAccess(request, "manager");
  if (error) return { error };

  const id = toId(params.id);
  const swap = id && findSwap(id);
  if (!swap) return { error: errorResponse("Swap not found", 404) };

  // BR10: only a swap a colleague has accepted can be decided.
  if (swap.status === "pending") {
    return { error: errorResponse(`Only accepted swaps can be ${action} – nobody has taken this shift yet`, 400) };
  }
  if (swap.status !== "accepted") {
    return { error: errorResponse("This swap has already been decided", 400) };
  }
  return { swap };
}

// ----- POST /api/swaps/:id/approve -----
export function handleApproveSwap(request, url, params) {
  const { swap, error } = checkDecision(request, params, "approved");
  if (error) return error;

  // BR11: the request AND the shift change together, or not at all.
  transaction(() => {
    db.prepare("UPDATE swap_requests SET status = 'approved' WHERE id = ?").run(swap.id);
    db.prepare("UPDATE shifts SET assigned_to = ?, status = 'assigned' WHERE id = ?")
      .run(swap.to_user_id, swap.shift_id);

    notify(swap.from_user_id,
      `Your swap was approved: ${swap.to_name} now works ${describeShift(swap)}`, "/employee/");
    notify(swap.to_user_id,
      `Your swap was approved: you now work ${describeShift(swap)}`, "/employee/");
  });

  return jsonResponse(findSwap(swap.id));
}

// ----- POST /api/swaps/:id/reject -----
export function handleRejectSwap(request, url, params) {
  const { swap, error } = checkDecision(request, params, "rejected");
  if (error) return error;

  // The shift goes back to the original employee (it never left them).
  transaction(() => {
    db.prepare("UPDATE swap_requests SET status = 'rejected' WHERE id = ?").run(swap.id);
    db.prepare("UPDATE shifts SET assigned_to = ?, status = 'assigned' WHERE id = ?")
      .run(swap.from_user_id, swap.shift_id);

    notify(swap.from_user_id,
      `Your swap was rejected: you still work ${describeShift(swap)}`, "/employee/");
    notify(swap.to_user_id,
      `The swap for ${describeShift(swap)} was rejected by the manager`, "/employee/");
  });

  return jsonResponse(findSwap(swap.id));
}
