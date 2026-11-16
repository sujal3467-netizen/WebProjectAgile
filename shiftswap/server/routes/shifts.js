// =============================================================
// Shift routes (Week 2, Tuesday) – owner: Sujal – Jira SS-39
// Week 4: filters, search and paging on the read routes – SS-57
//
//   GET    /api/shifts/mine                    my shifts                 (logged in)
//            ?from= &to= &position= &include_past=true &page= &limit=
//   GET    /api/shifts/week?start=YYYY-MM-DD   7 days from "start"       (logged in)
//            &employee= &position= &status=assigned|open
//   GET    /api/shifts/open                    upcoming open shifts      (logged in)
//            ?from= &to= &position= &page= &limit=
//   POST   /api/shifts                         create a shift            (managers)
//   PUT    /api/shifts/:id                     edit a shift              (managers)
//   DELETE /api/shifts/:id                     delete a shift            (managers)
// =============================================================

import { db, transaction } from "../db.js";
import { checkAccess } from "../auth.js";
import { runList } from "../list.js";
import {
  jsonResponse, errorResponse, readJson,
  isValidDate, isValidTime, toId,
  readPaging, readDateFilter, readChoiceFilter,
} from "../helpers.js";

// Every shift we send back has the same shape, including the employee's
// name (LEFT JOIN, because an open shift may have nobody assigned).
const SHIFT_FIELDS = `
  shifts.id, shifts.shift_date, shifts.start_time, shifts.end_time,
  shifts.position, shifts.assigned_to, users.name AS assigned_name, shifts.status
`;
const SHIFT_FROM = `
  FROM shifts
  LEFT JOIN users ON users.id = shifts.assigned_to
`;
const SHIFT_COLUMNS = SHIFT_FIELDS + SHIFT_FROM;
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

// ===================== FILTERS AND PAGING (SS-57) =====================
//
// Every list route builds its WHERE clause the same way:
//   conditions = ["shifts.assigned_to = ?", "shifts.position ..."]
//   values     = [ 2,                        "barista"          ]
// Each filter that was sent adds ONE condition and its value.
// Values always go in through ? placeholders, never into the SQL text.

// Read the filters most shift lists share: ?from= &to= &position=
// Adds their conditions to `conditions` / `values`.
// Returns an error message, or null if all is fine.
function addShiftFilters(url, conditions, values) {
  const from = readDateFilter(url, "from");
  const to = readDateFilter(url, "to");
  if (from.error) return from.error;
  if (to.error) return to.error;
  if (from.value && to.value && from.value > to.value) return "from must be before to";

  if (from.value) {
    conditions.push("shifts.shift_date >= ?");
    values.push(from.value);
  }
  if (to.value) {
    conditions.push("shifts.shift_date <= ?");
    values.push(to.value);
  }

  // position: "bar" finds "Barista" – part of the word, upper or lower case
  const position = (url.searchParams.get("position") || "").trim();
  if (position.length > 50) return "position must be 50 characters or fewer";
  if (position) {
    conditions.push("instr(lower(shifts.position), lower(?)) > 0");
    values.push(position);
  }
  return null;
}

// ===================== READ ROUTES (anyone logged in) =====================

// ----- GET /api/shifts/mine -----
// By default only shifts from today; ?include_past=true shows older ones too.
export function handleMyShifts(request, url) {
  const { user, error } = checkAccess(request);
  if (error) return error;

  const paging = readPaging(url);
  const past = readChoiceFilter(url, "include_past", ["true", "false"]);
  if (paging.error) return errorResponse(paging.error, 400);
  if (past.error) return errorResponse(past.error, 400);

  const conditions = ["shifts.assigned_to = ?"];
  const values = [user.id];
  if (past.value !== "true") {
    conditions.push("shifts.shift_date >= date('now', 'localtime')");
  }
  const problem = addShiftFilters(url, conditions, values);
  if (problem) return errorResponse(problem, 400);

  return runList({ fields: SHIFT_FIELDS, from: SHIFT_FROM, conditions, values, order: ORDER, paging });
}

// ----- GET /api/shifts/week?start=2026-11-02 -----
// Optional: &employee=3 &position=bar &status=open  (for the manager's filter bar)
export function handleWeekShifts(request, url) {
  const { error } = checkAccess(request);
  if (error) return error;

  const start = url.searchParams.get("start");
  if (!isValidDate(start)) {
    return errorResponse("Add ?start=YYYY-MM-DD, e.g. /api/shifts/week?start=2026-11-02", 400);
  }

  // The week = start day plus the next 6 days.
  const conditions = ["shifts.shift_date BETWEEN ? AND date(?, '+6 days')"];
  const values = [start, start];

  const status = readChoiceFilter(url, "status", ["assigned", "open"]);
  if (status.error) return errorResponse(status.error, 400);
  if (status.value) {
    conditions.push("shifts.status = ?");
    values.push(status.value);
  }

  const employeeText = url.searchParams.get("employee");
  if (employeeText) {
    const employee = toId(employeeText);
    if (!employee) return errorResponse("employee must be an employee's id", 400);
    conditions.push("shifts.assigned_to = ?");
    values.push(employee);
  }

  const problem = addShiftFilters(url, conditions, values);
  if (problem) return errorResponse(problem, 400);

  return runList({
    fields: SHIFT_FIELDS, from: SHIFT_FROM, conditions, values, order: ORDER,
    paging: { paged: false },   // a week is small, so never paged
  });
}

// ----- GET /api/shifts/open -----
// Also sends the swap request behind each open shift, so the Accept button
// knows which swap to accept (swap_id). A shift a manager left unassigned
// has no swap request, so its swap_id is null.
export function handleOpenShifts(request, url) {
  const { error } = checkAccess(request);
  if (error) return error;

  const paging = readPaging(url);
  if (paging.error) return errorResponse(paging.error, 400);

  const conditions = [
    "shifts.status = 'open'",
    "shifts.shift_date >= date('now', 'localtime')",
    // hide shifts a colleague has already taken (waiting for the manager)
    `NOT EXISTS (
       SELECT 1 FROM swap_requests AS taken
       WHERE taken.shift_id = shifts.id AND taken.status = 'accepted'
     )`,
  ];
  const values = [];
  const problem = addShiftFilters(url, conditions, values);
  if (problem) return errorResponse(problem, 400);

  return runList({
    fields: SHIFT_FIELDS + ", swap.id AS swap_id, swap.to_user_id AS offered_to",
    from: SHIFT_FROM + `
      LEFT JOIN swap_requests AS swap
        ON swap.shift_id = shifts.id AND swap.status = 'pending'`,
    conditions, values, order: ORDER, paging,
  });
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
