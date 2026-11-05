// =============================================================
// Passwords and sessions (Week 2, Monday) – owner: Sujal
//
// HOW LOGIN WORKS
// 1. Passwords are never stored. We store a "hash": a one-way scramble.
//    To check a password we hash what the user typed (with the same salt)
//    and compare the two hashes.
// 2. After a correct login we create a SESSION: a long random token saved
//    in the sessions table and sent to the browser in a cookie.
// 3. The browser sends that cookie with every request, so each route can
//    look up which user is asking (getCurrentUser below).
// =============================================================

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

const ITERATIONS = 100000;        // how many times to scramble (slower = harder to crack)
const SESSION_HOURS = 8;          // how long a login lasts
const COOKIE_NAME = "session";

// ----- Make a hash for a new password -----
// Format: pbkdf2$iterations$salt$hash  (the same format as seed.sql)
// The salt is random, so two users with the same password get different hashes.
export function hashPassword(password) {
  const salt = randomBytes(16);   // 16 random bytes
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  // Store both as hex text so they fit in a TEXT column.
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// ----- Check a typed password against a stored hash -----
export function checkPassword(password, storedHash) {
  const [method, iterations, salt, expectedHex] = storedHash.split("$");
  if (method !== "pbkdf2") return false;

  // The salt is stored as hex text, so turn it back into the original bytes.
  const saltBytes = Buffer.from(salt, "hex");
  const actual = pbkdf2Sync(password, saltBytes, Number(iterations), 32, "sha256");
  const expected = Buffer.from(expectedHex, "hex");

  // timingSafeEqual compares in constant time, so attackers can't guess
  // the hash bit by bit from how long the check takes.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ----- Start a session for a user and return its token -----
export function createSession(userId) {
  const token = randomBytes(32).toString("hex");   // 64 random characters
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

// ----- End a session (logout) -----
export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ----- Build the Set-Cookie header value -----
// HttpOnly  = page JavaScript can't read it (protects against stolen tokens)
// SameSite  = other websites can't make the browser send it
// Max-Age=0 = delete the cookie straight away (used by logout)
export function sessionCookie(token, maxAgeSeconds = SESSION_HOURS * 3600) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

// ----- Read the session token from the request's Cookie header -----
export function getToken(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  // The header looks like: "session=abc123; other=xyz"
  for (const part of cookieHeader.split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

// ----- Who is making this request? -----
// Returns the user (without the password hash), or null if not logged in
// or the session is older than SESSION_HOURS.
export function getCurrentUser(request) {
  const token = getToken(request);
  if (!token) return null;

  const user = db.prepare(`
    SELECT users.id, users.name, users.email, users.role, users.hourly_rate
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
      AND sessions.created_at > datetime('now', ?)
  `).get(token, `-${SESSION_HOURS} hours`);

  return user || null;
}
