// =============================================================
// login.js – handles the login form on index.html (owner: Masrur)
// Uses Sujal's api.js, which must be loaded BEFORE this file.
// =============================================================

// Where each role goes after logging in.
const HOME_PAGES = {
  employee: "/employee/shifts.html",
  manager: "/manager/dashboard.html",
};

// Find the parts of the page we need, using the ids in index.html.
const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("login-error");
const submitButton = form.querySelector("button[type=submit]");

// Show the red message with some text.
function showError(text) {
  errorMessage.textContent = text;
  errorMessage.classList.remove("hidden");   // "hidden" is Bikram's class
}

// Hide the red message again.
function hideError() {
  errorMessage.classList.add("hidden");
}

// Runs when the user presses "Log in".
async function handleLogin(event) {
  event.preventDefault();      // stop the browser from reloading the page
  hideError();
  submitButton.disabled = true;   // stop double-taps while we wait

  try {
    // Send email + password to the server. If they are wrong, api.js
    // throws an error, and the catch block below shows its message.
    const result = await api.post("/api/login", {
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });

    // The user may come back as result.user or directly as result.
    let user = result.user || result;

    // If the role is missing, ask the server who we are.
    if (!user.role) {
      const me = await api.get("/api/me");
      user = me.user || me;
    }

    // Send each role to its own pages.
    const page = HOME_PAGES[user.role];
    if (!page) {
      showError("Login worked, but your role is not recognised.");
      return;
    }
    window.location.href = page;

  } catch (error) {
    showError(error.message);   // e.g. "Email or password is wrong"
  } finally {
    submitButton.disabled = false;   // always re-enable the button
  }
}

// Run handleLogin when the form is submitted (button tap or Enter key).
form.addEventListener("submit", handleLogin);