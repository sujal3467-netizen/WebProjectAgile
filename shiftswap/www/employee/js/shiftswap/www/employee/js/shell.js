// =============================================================
// shell.js – fills the sidebar on every employee page (owner: Masrur)
// Shows the logged-in person's name and initials next to the log out
// button, like the manager pages do. Needs /js/api.js loaded first.
// =============================================================

// "Aisha Khan" -> "AK"
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

async function fillSidebar() {
  try {
    const me = await api.get("/api/me");
    const user = me.user || me;
    if (user.name) {
      document.getElementById("me-name").textContent = user.name;
      document.getElementById("me-avatar").textContent = initials(user.name);
    }
  } catch (error) {
    // The sidebar name is only extra. api.js sends us to the login page if needed.
  }
}

fillSidebar();
