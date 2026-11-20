// =============================================================
// Large test data + speed check (Week 4) – owner: Sujal – SS-59
//
//   deno task seed-large
//
// 1. Rebuilds the database with the normal test data (Tom, Leo, Priya...),
//    so every demo still works exactly as before.
// 2. Adds a LOT more: 80 extra employees and about a year of shifts
//    (six months back, six months ahead) with swaps in every state.
// 3. Times the filtered lists our routes run, with and without the
//    indexes, and shows that SQLite uses the indexes.
//
// Go back to the small data set any time with: deno task reset-db
// =============================================================

import { db, resetDatabase, transaction } from "./db.js";
import { hashPassword } from "./auth.js";

// ----- How big? Change these to make more or less data -----
const EXTRA_EMPLOYEES = 80;
const WEEKS_BACK = 26;          // about six months of past shifts
const WEEKS_AHEAD = 26;         // about six months of future shifts
const SHIFTS_PER_DAY = 30;

const FIRST_NAMES = ["Amir", "Bella", "Chen", "Dina", "Eli", "Fatima", "Grace", "Hugo", "Isla", "Jay",
  "Kofi", "Lena", "Maya", "Nico", "Omar", "Priyanka", "Quinn", "Rosa", "Sam", "Tara"];
const LAST_NAMES = ["Adams", "Bose", "Costa", "Diaz", "Evans", "Fox", "Gill", "Hart", "Iqbal", "Jones",
  "Khan", "Lopez", "Moore", "Nair", "Okafor", "Patel", "Reid", "Singh", "Turner", "Wood"];
const POSITIONS = ["Barista", "Till", "Stock", "Kitchen", "Cleaning", "Supervisor"];
const TIME_SLOTS = [["07:00", "12:00"], ["09:00", "15:00"], ["10:00", "18:00"], ["12:00", "17:00"], ["17:00", "22:00"]];

// ----- A random generator that gives the SAME data every run -----
// (Math.random would give different data each time, which makes
//  bugs hard to repeat. This is a tiny standard "LCG" generator.)
let seed = 12345;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(list) {
  return list[Math.floor(random() * list.length)];
}

// 'YYYY-MM-DD' for today + n days (local time)
function dayFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// ================================ 1 + 2: DATA ================================
resetDatabase();
console.log("Adding large test data...");
const started = performance.now();

// One hash for every extra employee: hashing is slow on purpose (that's
// what protects real passwords), and these are test accounts anyway.
const testHash = hashPassword("password123");

transaction(() => {
  // ----- Extra employees -----
  const addUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role, hourly_rate) VALUES (?, ?, ?, 'employee', ?)",
  );
  for (let i = 1; i <= EXTRA_EMPLOYEES; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const rate = 11.5 + Math.round(random() * 14) * 0.25;   // £11.50 – £15.00
    addUser.run(`${first} ${last}`, `${first.toLowerCase()}.${last.toLowerCase()}${i}@shiftswap.test`, testHash, rate);
  }
  const employeeIds = db.prepare("SELECT id FROM users WHERE role = 'employee'").all().map((u) => u.id);

  // ----- Shifts for every day in the range -----
  // The demo users (Tom, Aisha, Leo, Sara) get some too, so "my shifts"
  // with filters and paging has plenty to show for them.
  const addShift = db.prepare(`
    INSERT INTO shifts (shift_date, start_time, end_time, position, assigned_to, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const addSwap = db.prepare(`
    INSERT INTO swap_requests (shift_id, from_user_id, to_user_id, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const giveShiftTo = db.prepare("UPDATE shifts SET assigned_to = ? WHERE id = ?");
  const openShift = db.prepare("UPDATE shifts SET status = 'open' WHERE id = ?");

  for (let dayOffset = -WEEKS_BACK * 7; dayOffset <= WEEKS_AHEAD * 7; dayOffset++) {
    if (dayOffset >= -1 && dayOffset <= 6) continue;   // leave this week to seed.sql's demo shifts
    const date = dayFromToday(dayOffset);

    for (let n = 0; n < SHIFTS_PER_DAY; n++) {
      const [start, end] = pick(TIME_SLOTS);
      const position = pick(POSITIONS);
      // About 1 in 20 future shifts has nobody yet (open)
      const unassigned = dayOffset > 0 && random() < 0.05;
      const person = unassigned ? null : (random() < 0.08 ? pick([2, 3, 4, 5]) : pick(employeeIds));
      const result = addShift.run(date, start, end, position, person, unassigned ? "open" : "assigned");
      const shiftId = Number(result.lastInsertRowid);

      // About 1 in 10 assigned shifts has a swap request
      if (person === null || random() >= 0.1) continue;
      let colleague = pick(employeeIds);
      if (colleague === person) colleague = null;   // offered to anyone
      const created = dayFromToday(dayOffset - 3) + " 10:00:00";

      if (dayOffset < 0) {
        // In the past, every swap was finished one way or another.
        const status = pick(["approved", "approved", "rejected", "cancelled"]);
        addSwap.run(shiftId, person, colleague, status, created);
        if (status === "approved" && colleague !== null) {
          giveShiftTo.run(colleague, shiftId);
        }
      } else {
        // In the future, swaps can still be waiting.
        const status = pick(["pending", "pending", "accepted", "cancelled"]);
        const taker = status === "accepted" && colleague === null ? pick(employeeIds.filter((id) => id !== person)) : colleague;
        addSwap.run(shiftId, person, taker, status, created);
        if (status === "pending" || status === "accepted") {
          openShift.run(shiftId);
        }
      }
    }
  }
});

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
console.log(`Done in ${Math.round(performance.now() - started)} ms:`);
console.log(`  ${count("users")} users, ${count("shifts")} shifts, ${count("swap_requests")} swap requests\n`);

// ================================ 3: SPEED CHECK ================================
// The same kind of SQL our filtered routes run. Each is timed over many
// runs, because one run takes well under a millisecond either way.
const today = dayFromToday(0);
const in30 = dayFromToday(30);
const CHECKS = [
  ["Tom's shifts, next 30 days (my shifts + from/to)",
    "SELECT * FROM shifts WHERE assigned_to = 2 AND shift_date >= ? AND shift_date <= ? ORDER BY shift_date", [today, in30]],
  ["Open shifts from today (open shifts)",
    "SELECT * FROM shifts WHERE status = 'open' AND shift_date >= ? ORDER BY shift_date LIMIT 20", [today]],
  ["One week of the rota (week)",
    "SELECT * FROM shifts WHERE shift_date BETWEEN ? AND date(?, '+6 days') ORDER BY shift_date", [today, today]],
  ["Swaps waiting for a manager (pending swaps)",
    "SELECT * FROM swap_requests WHERE status = 'accepted'", []],
  ["Leo's swaps (my swaps)",
    "SELECT * FROM swap_requests WHERE from_user_id = 4 OR to_user_id = 4", []],
];
const RUNS = 200;

function timeIt(sql, values) {
  const statement = db.prepare(sql);
  const t0 = performance.now();
  for (let i = 0; i < RUNS; i++) statement.all(...values);
  return (performance.now() - t0) / RUNS;   // milliseconds per run
}

// How SQLite plans to find the rows: "USING INDEX" means it jumps straight
// to them; "SCAN shifts" means it reads the whole table.
function plan(sql, values) {
  return db.prepare("EXPLAIN QUERY PLAN " + sql).all(...values).map((row) => row.detail).join("; ");
}

const indexNames = db.prepare(
  "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
).all();

// Time WITHOUT indexes: drop them inside a transaction, measure, then
// ROLLBACK so the indexes come straight back. Nothing is lost.
const without = {};
db.exec("BEGIN");
for (const index of indexNames) db.exec(`DROP INDEX ${index.name}`);
for (const [name, sql, values] of CHECKS) without[name] = timeIt(sql, values);
db.exec("ROLLBACK");

console.log("Speed of filtered lists (average of " + RUNS + " runs):\n");
for (const [name, sql, values] of CHECKS) {
  const withIndex = timeIt(sql, values);
  console.log(`  ${name}`);
  console.log(`    without indexes: ${without[name].toFixed(3)} ms   with indexes: ${withIndex.toFixed(3)} ms` +
    `   (${(without[name] / withIndex).toFixed(0)}x faster)`);
  console.log(`    plan: ${plan(sql, values)}`);
}
console.log("\nLog in as usual (tom@shiftswap.test / password123). Back to the small data: deno task reset-db");
