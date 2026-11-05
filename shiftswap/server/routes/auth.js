// =============================================================
// Login routes (Week 2, Monday) – owner: Sujal
//   POST /api/login    { email, password } -> { user: { id, name, role } }
//   POST /api/logout                       -> { ok: true }
//   GET  /api/me                           -> { id, name, email, role, hourly_rate }
// =============================================================

import { db } from "../db.js";
import { jsonResponse, errorResponse, readJson } from "../helpers.js";
import {
  checkPassword, createSession, deleteSession,
  sessionCookie, getToken, getCurrentUser,
} from "../auth.js";

// ----- POST /api/login -----
export async function handleLogin(request) {
  const body = await readJson(request);

  // 1. Check the input is there and is text.
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return errorResponse("Please send an email and a password", 400);
  }
  const email = body.email.trim().toLowerCase();

  // 2. Find the user. The ? placeholder keeps the email OUT of the SQL text,
  //    so nobody can inject SQL through the login form.
  const user = db.prepare(
    "SELECT id, name, role, password_hash FROM users WHERE email = ?",
  ).get(email);

  // 3. Same message whether the email or the password is wrong,
  //    so attackers can't find out which emails exist.
  if (!user || !checkPassword(body.password, user.password_hash)) {
    return errorResponse("Email or password is wrong", 401);
  }

  // 4. Start a session and send the token back in a cookie.
  const token = createSession(user.id);
  return jsonResponse(
    { user: { id: user.id, name: user.name, role: user.role } },
    200,
    { "set-cookie": sessionCookie(token) },
  );
}

// ----- POST /api/logout -----
export function handleLogout(request) {
  const token = getToken(request);
  if (token) deleteSession(token);

  // Max-Age=0 tells the browser to delete the cookie.
  return jsonResponse({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

// ----- GET /api/me -----
export function handleMe(request) {
  const user = getCurrentUser(request);
  if (!user) return errorResponse("Please log in", 401);
  return jsonResponse(user);
}
