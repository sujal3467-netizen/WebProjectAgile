// =============================================================
// api.js – the ONE way our pages talk to the server – owner: Sujal
//
// Add this to any page (before your own script):
//     <script src="/js/api.js"></script>
//
// Then, inside an async function:
//     const me     = await api.get("/api/me");
//     const result = await api.post("/api/login", { email, password });
//     await api.put("/api/shifts/7", { position: "Till" });
//     await api.del("/api/shifts/7");
//
// If the server sends an error, it is THROWN, so wrap calls in try/catch:
//     try {
//       await api.post("/api/login", { email, password });
//     } catch (error) {
//       message.textContent = error.message;   // e.g. "Email or password is wrong"
//     }
// =============================================================

const api = (() => {
  // Is this page the login page? (We never redirect away from it.)
  function onLoginPage() {
    return location.pathname === "/" || location.pathname === "/index.html";
  }

  // Send one request and return the JSON the server sent back.
  async function request(method, url, body) {
    const options = { method: method, headers: {} };

    // Only POST and PUT send data. It goes as JSON text.
    if (body !== undefined) {
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    // The browser adds our session cookie automatically (same website).
    const response = await fetch(url, options);

    // Every route returns JSON; if it somehow doesn't, use an empty object.
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    // 401 = not logged in (or the session expired): go to the login page.
    if (response.status === 401 && !onLoginPage()) {
      location.href = "/";
    }

    // Any error status (400, 401, 403, 404, 500): throw the server's message.
    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    return data;
  }

  // The four shortcuts pages use.
  return {
    get: (url) => request("GET", url),
    post: (url, body = {}) => request("POST", url, body),
    put: (url, body = {}) => request("PUT", url, body),
    del: (url) => request("DELETE", url),
  };
})();
