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
