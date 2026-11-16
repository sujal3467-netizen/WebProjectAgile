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

// =============================================================
// Filters and paging (Week 4, Monday) – SS-57
// =============================================================

// Read ?page= and ?limit= from the URL.
// No ?page=  -> { paged: false }  (the route returns a plain list, as before)
// ?page=2&limit=20 -> { paged: true, page: 2, limit: 20, offset: 20 }
// Bad values -> { error: "..." }
export function readPaging(url) {
  const pageText = url.searchParams.get("page");
  const limitText = url.searchParams.get("limit");
  if (pageText === null && limitText === null) return { paged: false };

  const page = pageText === null ? 1 : toId(pageText);
  const limit = limitText === null ? 20 : toId(limitText);
  if (!page) return { error: "page must be a whole number from 1" };
  if (!limit || limit > 100) return { error: "limit must be a whole number from 1 to 100" };
  return { paged: true, page, limit, offset: (page - 1) * limit };
}

// Read an optional date filter such as ?from=2026-11-01.
// Returns { value } (null if it wasn't sent) or { error }.
export function readDateFilter(url, name) {
  const text = url.searchParams.get(name);
  if (text === null || text === "") return { value: null };
  if (!isValidDate(text)) return { error: `${name} must be a date like 2026-11-01` };
  return { value: text };
}

// Read an optional filter that must be one of a fixed list,
// e.g. readChoiceFilter(url, "status", ["assigned", "open"]).
export function readChoiceFilter(url, name, allowed) {
  const text = url.searchParams.get(name);
  if (text === null || text === "") return { value: null };
  if (!allowed.includes(text)) return { error: `${name} must be one of: ${allowed.join(", ")}` };
  return { value: text };
}

// Send a list back: a plain array when the page didn't ask for paging
// (so older pages keep working), or the paged format when it did:
// { items, total, page, limit, pages }
export function listResponse(paging, items, total) {
  if (!paging.paged) return jsonResponse(items);
  return jsonResponse({
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    pages: Math.max(1, Math.ceil(total / paging.limit)),
  });
}
