// =============================================================
// ShiftSwap server – owner: Sujal
// Week 1: serves www/ and /api/health.  Week 2: login and shift routes.  Week 3: swaps.
//
// What this file does:
//   1. Any URL starting with /api/ is looked up in the ROUTES list below.
//   2. Every other URL is treated as a file inside the www/ folder
//      (e.g. /  -> www/index.html,  /css/style.css -> www/css/style.css).
// =============================================================

// serveDir is Deno's standard helper for sending files from a folder.
// It also blocks tricks like /../../secret.txt, so we don't have to.
import { serveDir } from "jsr:@std/http@1/file-server";

import { db } from "./db.js";
import { jsonResponse, errorResponse } from "./helpers.js";
import { handleLogin, handleLogout, handleMe } from "./routes/auth.js";
import {
  handleMyShifts, handleWeekShifts, handleOpenShifts,
  handleCreateShift, handleUpdateShift, handleDeleteShift,
} from "./routes/shifts.js";
import {
  handleCreateSwap, handleMySwaps, handleAcceptSwap,
  handlePendingSwaps, handleApproveSwap, handleRejectSwap,
} from "./routes/swaps.js";

// ----- Settings -----
const PORT = 8000;
// "0.0.0.0" = listen on every network address of this laptop, so phones
// on the same Wi-Fi/hotspot can open the site during demos.
const HOSTNAME = "0.0.0.0";

// ----- GET /api/health: proves the server and database are working -----
// (Table names can't use ? placeholders, but this list is fixed by us,
// never typed by a user, so putting them into the SQL is safe here.)
function handleHealth() {
  const tables = ["users", "shifts", "swap_requests", "notifications", "sessions"];
  const counts = {};
  for (const table of tables) {
    counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  }
  return jsonResponse({ ok: true, message: "ShiftSwap server is running", database: counts });
}

// ----- The route list: [METHOD, path, function that handles it] -----
// ":id" in a path matches any value, e.g. /api/shifts/7 -> params.id = "7".
// To add a route: write its function in server/routes/, import it above,
// add one line here, and add it to the README.
const ROUTES = [
  ["GET", "/api/health", handleHealth],

  ["POST", "/api/login", handleLogin],
  ["POST", "/api/logout", handleLogout],
  ["GET", "/api/me", handleMe],

  ["GET", "/api/shifts/mine", handleMyShifts],
  ["GET", "/api/shifts/week", handleWeekShifts],
  ["GET", "/api/shifts/open", handleOpenShifts],
  ["POST", "/api/shifts", handleCreateShift],
  ["PUT", "/api/shifts/:id", handleUpdateShift],
  ["DELETE", "/api/shifts/:id", handleDeleteShift],

  ["POST", "/api/swaps", handleCreateSwap],
  ["GET", "/api/swaps/mine", handleMySwaps],
  ["POST", "/api/swaps/:id/accept", handleAcceptSwap],
  ["GET", "/api/swaps/pending", handlePendingSwaps],
  ["POST", "/api/swaps/:id/approve", handleApproveSwap],
  ["POST", "/api/swaps/:id/reject", handleRejectSwap],
];

// ----- Find the route for this request -----
// Returns { handler, params } or null if no route matches.
function findRoute(method, pathname) {
  const requestParts = pathname.split("/");          // "/api/shifts/7" -> ["", "api", "shifts", "7"]

  for (const [routeMethod, routePath, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const routeParts = routePath.split("/");
    if (routeParts.length !== requestParts.length) continue;

    // Compare piece by piece. ":something" matches anything and is saved.
    const params = {};
    let matches = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = requestParts[i];
      } else if (routeParts[i] !== requestParts[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return { handler, params };
  }
  return null;
}

// ----- Main handler: runs once for every request -----
async function handleRequest(request) {
  const url = new URL(request.url);

  // Not an API call, so send a file from www/.
  if (!url.pathname.startsWith("/api/")) {
    return serveDir(request, { fsRoot: "www", quiet: true });
  }

  const route = findRoute(request.method, url.pathname);
  if (!route) {
    return errorResponse("Route not found", 404);
  }

  // If a route crashes, log the details for us but send the page a
  // simple JSON error instead of leaking server internals.
  try {
    return await route.handler(request, url, route.params);
  } catch (error) {
    console.error(error);
    return errorResponse("Something went wrong on the server", 500);
  }
}

// ----- Start the server -----
Deno.serve(
  {
    port: PORT,
    hostname: HOSTNAME,
    onListen() {
      console.log(`ShiftSwap running on http://localhost:${PORT}`);
      console.log("Phones on the same Wi-Fi: http://<this-laptop-IP>:" + PORT);
    },
  },
  handleRequest,
);
