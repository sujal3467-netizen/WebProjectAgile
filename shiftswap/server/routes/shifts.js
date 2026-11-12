// =============================================================
// Shift routes (Week 2, Tuesday) – owner: Sujal – Jira SS-39
//
//   GET    /api/shifts/mine                    my upcoming shifts        (logged in)
//   GET    /api/shifts/week?start=YYYY-MM-DD   7 days from "start"       (logged in)
//   GET    /api/shifts/open                    upcoming open shifts      (logged in)
//   POST   /api/shifts                         create a shift            (managers)
//   PUT    /api/shifts/:id                     edit a shift              (managers)
//   DELETE /api/shifts/:id                     delete a shift            (managers)
// =============================================================

import { db, transaction } from "../db.js";
import { checkAccess } from "../auth.js";
import {
  jsonResponse, errorResponse, readJson,
  isValidDate, isValidTime, toId,
} from "../helpers.js";

// Every shift we send back has the same shape, including the employee's
// name (LEFT JOIN, because an open shift may have nobody assigned).
const SHIFT_COLUMNS = `
  shifts.id, shifts.shift_date, shifts.start_time, shifts.end_time,
  shifts.position, shifts.assigned_to, users.name AS assigned_name, shifts.status
  FROM shifts
  LEFT JOIN users ON users.id = shifts.assigned_to
`;
const ORDER = "ORDER BY shifts.shift_date, shifts.start_time";

// ----- Find one shift by id (or undefined) -----
function findShift(id) {
  return db.prepare(`SELECT ${SHIFT_COLUMNS} WHERE shifts.id = ?`).get(id);
}

// ----- Check the fields of a new or edited shift -----
// Returns an error message (text), or null if everything is fine.
function checkShiftFields(shift) {
  if (!isValidDate(shift.shift_date)) return "shift_date must be a date like 2026-11-05";
  if (!isValidTime(shift.start_time)) return "start_time must be a time like 09:00";
  if (!isValidTime(shift.end_time)) return "end_time must be a time like 17:00";
  // "HH:MM" text compares correctly as text: "09:00" < "17:00"   (rule BR6)
  if (shift.end_time <= shift.start_time) return "end_time must be after start_time";
  if (typeof shift.position !== "string" || shift.position.trim() === "") {
    return "position is required, e.g. Barista";
  }
  if (shift.position.length > 50) return "position must be 50 characters or fewer";

  // assigned_to may be null (an open shift) or an EMPLOYEE's id   (rule BR4)
  if (shift.assigned_to !== null) {
    const employee = db.prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'employee'",
    ).get(shift.assigned_to);
    if (!employee) return "assigned_to must be an employee's id, or null for an open shift";
  }
  return null;
}

// ===================== READ ROUTES (anyone logged in) =====================

// ----- GET /api/shifts/mine -----
export function handleMyShifts(request) {
  const { user, error } = checkAccess(request);
  if (error) return error;

  const shifts = db.prepare(`
    SELECT ${SHIFT_COLUMNS}
    WHERE shifts.assigned_to = ? AND shifts.shift_date >= date('now', 'localtime')
    ${ORDER}
  `).all(user.id);
  return jsonResponse(shifts);
}

// ----- GET /api/shifts/week?start=2026-11-02 -----
export function handleWeekShifts(request, url) {
  const { error } = checkAccess(request);
  if (error) return error;

  const start = url.searchParams.get("start");
  if (!isValidDate(start)) {
    return errorResponse("Add ?start=YYYY-MM-DD, e.g. /api/shifts/week?start=2026-11-02", 400);
  }

  // The week = start day plus the next 6 days.
  const shifts = db.prepare(`
    SELECT ${SHIFT_COLUMNS}
    WHERE shifts.shift_date BETWEEN ? AND date(?, '+6 days')
    ${ORDER}
  `).all(start, start);
  return jsonResponse(shifts);
}

// ----- GET /api/shifts/open -----
export function handleOpenShifts(request) {
  const { error } = checkAccess(request);
  if (error) return error;

  // Week 3: also send the swap request behind each open shift, so the
  // Accept button knows which swap to accept (swap_id). A shift a manager
  // left unassigned has no swap request, so its swap_id is null.
  const shifts = db.prepare(`
    SELECT shifts.id, shifts.shift_date, shifts.start_time, shifts.end_time,
           shifts.position, shifts.assigned_to, users.name AS assigned_name, shifts.status,
           swap.id AS swap_id, swap.to_user_id AS offered_to
    FROM shifts
    LEFT JOIN users ON users.id = shifts.assigned_to
    LEFT JOIN swap_requests AS swap
      ON swap.shift_id = shifts.id AND swap.status = 'pending'
    WHERE shifts.status = 'open' AND shifts.shift_date >= date('now', 'localtime')
      -- hide shifts a colleague has already taken (waiting for the manager)
      AND NOT EXISTS (
        SELECT 1 FROM swap_requests AS taken
        WHERE taken.shift_id = shifts.id AND taken.status = 'accepted'
      )
    ${ORDER}
  `).all();
  return jsonResponse(shifts);
}

// ===================== CHANGE ROUTES (managers only) =====================

// ----- POST /api/shifts -----
export async function handleCreateShift(request) {
  const { error } = checkAccess(request, "manager");
  if (error) return error;

  const body = await readJson(request);
  if (!body) return errorResponse("Please send the shift as JSON", 400);

  const shift = {
    shift_date: body.shift_date,
    start_time: body.start_time,
    end_time: body.end_time,
    position: typeof body.position === "string" ? body.position.trim() : body.position,
    assigned_to: body.assigned_to ?? null,   // missing = nobody yet
  };
  const problem = checkShiftFields(shift);
  if (problem) return errorResponse(problem, 400);

  // A shift with nobody on it is "open"; otherwise it's "assigned".
  const status = shift.assigned_to === null ? "open" : "assigned";

  const result = db.prepare(`
    INSERT INTO shifts (shift_date, start_time, end_time, position, assigned_to, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(shift.shift_date, shift.start_time, shift.end_time,
         shift.position, shift.assigned_to, status);

  // 201 = "created". Send back the new shift, including its new id.
  return jsonResponse(findShift(Number(result.lastInsertRowid)), 201);
}

// ----- PUT /api/shifts/:id -----
// Send only the fields you want to change, e.g. { "position": "Till" }.
export async function handleUpdateShift(request, url, params) {
  const { error } = checkAccess(request, "manager");
  if (error) return error;

  const id = toId(params.id);
  const existing = id && findShift(id);
  if (!existing) return errorResponse("Shift not found", 404);

  const body = await readJson(request);
  if (!body) return errorResponse("Please send the changes as JSON", 400);

  // Start from the current shift and overwrite only what was sent.
  const shift = {
    shift_date: body.shift_date ?? existing.shift_date,
    start_time: body.start_time ?? existing.start_time,
    end_time: body.end_time ?? existing.end_time,
    position: typeof body.position === "string" ? body.position.trim() : existing.position,
    assigned_to: "assigned_to" in body ? body.assigned_to : existing.assigned_to,
  };
  const problem = checkShiftFields(shift);
  if (problem) return errorResponse(problem, 400);

  // If the manager changed who works it, the status follows; otherwise keep it.
  const status = "assigned_to" in body
    ? (shift.assigned_to === null ? "open" : "assigned")
    : existing.status;

  const employeeChanged = "assigned_to" in body && shift.assigned_to !== existing.assigned_to;

  transaction(() => {
    db.prepare(`
      UPDATE shifts
      SET shift_date = ?, start_time = ?, end_time = ?, position = ?, assigned_to = ?, status = ?
      WHERE id = ?
    `).run(shift.shift_date, shift.start_time, shift.end_time,
           shift.position, shift.assigned_to, status, id);

    // If the manager gave the shift to someone else, any swap request for it
    // is out of date (it was made by the old employee), so close it.
    if (employeeChanged) {
      db.prepare(`
        UPDATE swap_requests SET status = 'rejected'
        WHERE shift_id = ? AND status IN ('pending', 'accepted')
      `).run(id);
    }
  });

  return jsonResponse(findShift(id));
}

// ----- DELETE /api/shifts/:id -----
export function handleDeleteShift(request, url, params) {
  const { error } = checkAccess(request, "manager");
  if (error) return error;

  const id = toId(params.id);
  if (!id || !findShift(id)) return errorResponse("Shift not found", 404);

  // Swap requests point at this shift (foreign key), so they must go first.
  // The transaction makes both deletes happen together, or neither does.
  transaction(() => {
    db.prepare("DELETE FROM swap_requests WHERE shift_id = ?").run(id);
    db.prepare("DELETE FROM shifts WHERE id = ?").run(id);
  });
  return jsonResponse({ ok: true });
}
