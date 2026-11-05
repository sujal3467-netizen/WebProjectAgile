// =============================================================
// ShiftSwap server – owner: Sujal
// Week 1: serves www/ and /api/health.  Week 2 Monday: login routes.
//
// What this file does:
//   1. Any URL starting with /api/ is looked up in the ROUTES table below.
//   2. Every other URL is treated as a file inside the www/ folder
//      (e.g. /  -> www/index.html,  /css/style.css -> www/css/style.css).
// =============================================================

// serveDir is Deno's standard helper for sending files from a folder.
// It also blocks tricks like /../../secret.txt, so we don't have to.
import { serveDir } from "jsr:@std/http@1/file-server";

import { db } from "./db.js";
import { jsonResponse, errorResponse } from "./helpers.js";
import { handleLogin, handleLogout, handleMe } from "./routes/auth.js";

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

// ----- The route table: "METHOD /path" -> function that handles it -----
// To add a route: write its function in server/routes/, import it above,
// add one line here, and add it to the README.
const ROUTES = {
  "GET /api/health": handleHealth,
  "POST /api/login": handleLogin,
  "POST /api/logout": handleLogout,
  "GET /api/me": handleMe,
};

// ----- Main handler: runs once for every request -----
async function handleRequest(request) {
  const url = new URL(request.url);

  // Not an API call, so send a file from www/.
  if (!url.pathname.startsWith("/api/")) {
    return serveDir(request, { fsRoot: "www", quiet: true });
  }

  const handler = ROUTES[`${request.method} ${url.pathname}`];
  if (!handler) {
    return errorResponse("Route not found", 404);
  }

  // If a route crashes, log the details for us but send the page a
  // simple JSON error instead of leaking server internals.
  try {
    return await handler(request, url);
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
