// =============================================================
// Access check for every API route (Week 3, Tuesday) – owner: Sujal – SS-49
//
// Tries every route as: nobody (not logged in), an employee, and a manager,
// and checks the server answers with the status code we expect.
//
// HOW TO RUN (two terminals):
//   1.  deno task reset-db  then  deno task start
//   2.  deno task check-access
//
// It only READS data or sends requests that should be refused, so it
// doesn't change the test data (except a harmless edit that saves nothing new).
// =============================================================

const BASE = "http://localhost:8000";

// ----- Log in and return the session cookie ("session=...") -----
async function login(email) {
  const response = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const setCookie = response.headers.get("set-cookie") || "";
  await response.body?.cancel();
  return setCookie.split(";")[0];          // keep only "session=abc123"
}

// ----- Send one request as a given user and return the status code -----
async function statusOf(cookie, method, path, body) {
  const options = { method, headers: {} };
  if (cookie) options.headers.cookie = cookie;
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(BASE + path, options);
  await response.body?.cancel();
  return response.status;
}

// The Monday of this week, e.g. "2026-11-09" (for /api/shifts/week).
const now = new Date();
const monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const MONDAY = monday.toISOString().slice(0, 10);

// ----- What we expect: [method, path, body, nobody, employee, manager] -----
// 401 = must log in, 403 = wrong role, 404/400 = passed the role check
// but the request itself was refused (fine: we only test WHO can call it).
const ROLE_CHECKS = [
  ["GET", "/api/health", undefined, 200, 200, 200],
  ["GET", "/api/me", undefined, 401, 200, 200],
  ["GET", "/api/shifts/mine", undefined, 401, 200, 200],
  ["GET", `/api/shifts/week?start=${MONDAY}`, undefined, 401, 200, 200],
  ["GET", "/api/shifts/open", undefined, 401, 200, 200],
  ["POST", "/api/shifts", {}, 401, 403, 400],
  ["PUT", "/api/shifts/1", {}, 401, 403, 200],
  ["DELETE", "/api/shifts/99999", undefined, 401, 403, 404],
  ["POST", "/api/swaps", {}, 401, 400, 403],
  ["GET", "/api/swaps/mine", undefined, 401, 200, 403],
  ["POST", "/api/swaps/99999/accept", undefined, 401, 404, 403],
  ["GET", "/api/swaps/pending", undefined, 401, 403, 200],
  ["POST", "/api/swaps/99999/approve", undefined, 401, 403, 404],
  ["POST", "/api/swaps/99999/reject", undefined, 401, 403, 404],
];

// ----- Ownership: right role, but not YOUR thing -----
// [who, method, path, body, expected, what it proves]
// (Uses the fresh test data: shift 6 is Aisha's; swap 1 is Leo's.)
const OWNERSHIP_CHECKS = [
  ["tom", "POST", "/api/swaps", { shift_id: 6 }, 403, "can't offer someone else's shift (BR7)"],
  ["leo", "POST", "/api/swaps/1/accept", undefined, 400, "can't accept your own swap (BR9)"],
  ["tom", "POST", "/api/swaps", { shift_id: 9, to_user_id: "abc" }, 400, "to_user_id must be a real id"],
  ["tom", "POST", "/api/swaps", { shift_id: 9, to_user_id: 1 }, 400, "can't offer a shift to a manager"],
];

// ================================ RUN ================================
const cookies = {
  nobody: null,
  employee: await login("tom@shiftswap.test"),
  manager: await login("priya@shiftswap.test"),
  tom: null,
  leo: await login("leo@shiftswap.test"),
};
cookies.tom = cookies.employee;

let passed = 0;
let failed = 0;
function report(ok, text) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${text}`);
}

console.log("\n=== Role checks: nobody / employee / manager ===");
for (const [method, path, body, ...expected] of ROLE_CHECKS) {
  const actual = [];
  for (const who of ["nobody", "employee", "manager"]) {
    actual.push(await statusOf(cookies[who], method, path, body));
  }
  const ok = actual.every((code, i) => code === expected[i]);
  report(ok, `${method.padEnd(6)} ${path.padEnd(32)} got ${actual.join("/")}` +
    (ok ? "" : `  expected ${expected.join("/")}`));
}

console.log("\n=== Ownership checks ===");
for (const [who, method, path, body, expected, what] of OWNERSHIP_CHECKS) {
  const actual = await statusOf(cookies[who], method, path, body);
  report(actual === expected, `${what.padEnd(42)} got ${actual}` +
    (actual === expected ? "" : `  expected ${expected}`));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) Deno.exit(1);
