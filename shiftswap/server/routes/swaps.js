// =============================================================
// Swap routes (Week 3, Monday) – owner: Sujal
// Use cases: "Offer a shift", "Take an open shift", "Approve or reject swaps"
//
//   POST /api/swaps                { shift_id, to_user_id? }   offer my shift      (employees)
//   GET  /api/swaps/mine                                       my swaps            (employees)
//   POST /api/swaps/:id/accept                                 take a shift        (employees)
//   GET  /api/swaps/pending                                    waiting for decision (managers)
//   POST /api/swaps/:id/approve                                approve             (managers)
//   POST /api/swaps/:id/reject                                 reject              (managers)
//
// THE SWAP FLOW
//   pending   – an employee offered their shift (the shift becomes "open")
//   accepted  – a colleague took it (still waiting for the manager)
//   approved  – the manager agreed: the shift now belongs to the colleague
//   rejected  – the manager said no: the shift stays with the original employee
// =============================================================

import { db, transaction } from "../db.js";
import { checkAccess } from "../auth.js";
import { notify, notifyRole } from "../notify.js";
import { jsonResponse, errorResponse, readJson, toId } from "../helpers.js";

// Every swap we send back has the same shape: the request, its shift,
// and the names of both employees.
const SWAP_COLUMNS = `
  swap_requests.id, swap_requests.status, swap_requests.created_at,
  swap_requests.shift_id, shifts.shift_date, shifts.start_time, shifts.end_time, shifts.position,
  swap_requests.from_user_id, giver.name AS from_name,
  swap_requests.to_user_id, taker.name AS to_name
  FROM swap_requests
  JOIN shifts ON shifts.id = swap_requests.shift_id
  JOIN users AS giver ON giver.id = swap_requests.from_user_id
  LEFT JOIN users AS taker ON taker.id = swap_requests.to_user_id
`;

function findSwap(id) {
  return db.prepare(`SELECT ${SWAP_COLUMNS} WHERE swap_requests.id = ?`).get(id);
}

// "2026-11-12 12:00–17:00 (Barista)" – used in notification messages.
function describeShift(swap) {
  return `${swap.shift_date} ${swap.start_time}–${swap.end_time} (${swap.position})`;
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

  // BR9: offered to anyone (null) or to ANOTHER employee.
  const toUserId = body.to_user_id ?? null;
  if (toUserId !== null) {
    const colleague = db.prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'employee'",
    ).get(toUserId);
    if (!colleague || colleague.id === user.id) {
      return errorResponse("to_user_id must be another employee's id, or left out to offer to anyone", 400);
    }
  }

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
export function handleMySwaps(request) {
  const { user, error } = checkAccess(request, "employee");
  if (error) return error;

  const swaps = db.prepare(`
    SELECT ${SWAP_COLUMNS}
    WHERE swap_requests.from_user_id = ? OR swap_requests.to_user_id = ?
    ORDER BY swap_requests.created_at DESC, swap_requests.id DESC
  `).all(user.id, user.id);
  return jsonResponse(swaps);
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
