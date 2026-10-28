// =============================================================
// ShiftSwap server (Week 1, Monday) – owner: Sujal
// Jira: SS-5 Set up repo and Deno server
//
// What this file does:
//   1. Any URL starting with /api/ is handled as our JSON API.
//   2. Every other URL is treated as a file inside the www/ folder
//      (e.g. /  -> www/index.html,  /css/style.css -> www/css/style.css).
// =============================================================

// serveDir is Deno's standard helper for sending files from a folder.
// It also blocks tricks like /../../secret.txt, so we don't have to.
import { serveDir } from "jsr:@std/http@1/file-server";

// Our database connection (Week 1 Tuesday, SS-6).
import { db } from "./db.js";

// ----- Settings -----
const PORT = 8000;
// "0.0.0.0" means "listen on every network address this laptop has".
// "localhost" would only allow this laptop; 0.0.0.0 lets phones on the
// same Wi-Fi/hotspot open the site during our demos.
const HOSTNAME = "0.0.0.0";

// ----- Helper: send a JavaScript object back as JSON -----
// Every API route will use this, so all our responses look the same.
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// ----- Helper: how many rows are in each table? -----
// Handy for the demo: you can SEE the database is there.
// (Table names can't use ? placeholders, but this list is fixed by us,
// never typed by a user, so joining them into the SQL is safe here.)
function countRows() {
  const tables = ["users", "shifts", "swap_requests", "notifications", "sessions"];
  const counts = {};
  for (const table of tables) {
    counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  }
  return counts;
}

// ----- API routes (/api/...) -----
// Today we only have one test route. In Week 2 we add login, shifts, etc.
function handleApi(request, url) {
  // GET /api/health  ->  proves the server, API AND database are working
  if (url.pathname === "/api/health" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "ShiftSwap server is running",
      database: countRows(),
    });
  }

  // Any /api/ URL we don't know about gets a clear JSON error.
  return jsonResponse({ error: "Route not found" }, 404);
}

// ----- Main handler: runs once for every request -----
function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(request, url);
  }

  // Not an API call, so send a file from www/.
  // fsRoot is relative to where you run "deno task start" (the project root).
  return serveDir(request, { fsRoot: "www", quiet: true });
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
