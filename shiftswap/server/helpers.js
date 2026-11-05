// =============================================================
// Small helpers every route uses (Week 2, Monday) – owner: Sujal
// =============================================================

// ----- Send a JavaScript object back as JSON -----
// status 200 = OK, 201 = created, 400 = bad input, 401 = not logged in,
// 403 = not allowed, 404 = not found, 500 = server error.
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

// ----- Send an error in our agreed format: { "error": "..." } -----
export function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}

// ----- Read the JSON body a page sent us -----
// Returns the object, or null if the body is missing or not valid JSON.
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// =============================================================
// Input checks (Week 2, Tuesday) – used by the shift and swap routes
// =============================================================

// "2026-11-05" -> true.  "2026-13-40", "5/11/2026", 123 -> false
export function isValidDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + "T00:00:00Z");
  // new Date("2026-02-31") quietly becomes 3 March, so check it didn't change.
  return !isNaN(date) && date.toISOString().slice(0, 10) === text;
}

// "09:30" -> true.  "9:30", "24:00", "12:60" -> false
export function isValidTime(text) {
  return typeof text === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

// Turn the ":id" part of a URL into a whole number, or null if it isn't one.
export function toId(text) {
  const id = Number(text);
  return Number.isInteger(id) && id > 0 ? id : null;
}
