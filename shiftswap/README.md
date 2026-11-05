# ShiftSwap

A website that lets part-time workers (cafés, retail, warehouses) swap shifts without messy group chats. Works on phones and laptops. Two roles: **employees** and **managers**.

Agile Development Team Project – 6 one-week Scrum sprints. Jira space key: **SS**.

| Person | Part |
|---|---|
| Masrur | Employee app (`www/employee/`) and login page (`www/index.html`) |
| Lajja | Manager app (`www/manager/`) and the Jira board |
| Sujal | Backend: Deno server, SQLite database, API routes, `www/js/api.js` – and Scrum Master |
| Bikram | Style guide and `style.css`, notifications, responsive design, testing |

---

## Run it

You need **Deno 2.2 or newer** (`deno --version`; update with `deno upgrade`).

```bash
deno task start        # starts the server on port 8000
deno task reset-db     # wipes the database and reloads the test data
```

- Laptop: open http://localhost:8000 (use Chrome phone view: F12 → phone icon).
- Phone: connect to the same Wi-Fi/hotspot and open `http://<laptop-IP>:8000`
  (Windows: `ipconfig` → IPv4 Address). Allow Deno through the firewall if asked.
- The database (`server/shiftswap.db`) is created automatically on first start. It is **not** in Git – everyone has their own copy.

Check it works: http://localhost:8000/api/health shows the row count of every table.

## Test logins

All passwords are **password123**.

| id | Name | Email | Role |
|---|---|---|---|
| 1 | Priya Shah | priya@shiftswap.test | manager |
| 2 | Tom Baker | tom@shiftswap.test | employee |
| 3 | Aisha Khan | aisha@shiftswap.test | employee |
| 4 | Leo Martin | leo@shiftswap.test | employee |
| 5 | Sara Novak | sara@shiftswap.test | employee |

The test data always holds 10 shifts for the **current** week, two swaps (Leo's Thursday shift 7 waiting to be taken; Sara's Friday shift 8 accepted by Aisha, waiting for the manager) and two unread notifications.

## Folders

```
server/            backend (Sujal; notify.js is Bikram's)
  server.js        starts the server, sends /api/ to the routes, serves www/
  db.js            the one database connection
  schema.sql       the 5 tables
  seed.sql         test data
  routes/          API route files (from Week 2)
www/               the website
  index.html       login page (Masrur)
  employee/        employee pages (Masrur)
  manager/         manager pages (Lajja)
  css/style.css    shared styles (Bikram)
  js/api.js        fetch helper – use this, don't write fetch yourself (Sujal)
  notifications.html, js/notifications.js   bell page (Bikram)
docs/testing/      test cases (Bikram)
```

## Git workflow

One branch per Jira item, named after it: `SS-12-login-page`. Never commit straight to `main`.

```bash
git checkout main
git pull                          # get everyone's latest work
git checkout -b SS-12-login-page  # your branch
# ...work...
git add .
git commit -m "SS-12: login form posts to /api/login"
git push -u origin SS-12-login-page
```

Then open a pull request on GitHub and ask one teammate to review it.

---

## API

All routes start with `/api/`, send and return **JSON**, and are called through `www/js/api.js`. Add it to your page before your own script:

```html
<script src="/js/api.js"></script>
```

Then, inside an `async` function:

```js
const me     = await api.get("/api/me");
const result = await api.post("/api/swaps", { shift_id: 7 });
await api.put("/api/shifts/7", { position: "Till" });
await api.del("/api/shifts/7");
```

- If the server answers with an error, `api` **throws** it, with the server's message in `error.message`. Wrap calls in `try/catch` to show it on the page.
- If the user isn't logged in (401), `api` sends them to the login page automatically (except on the login page itself).
- Never write `fetch` yourself – if `api.js` is missing something, ask Sujal.

**Example – login form (for Masrur):**

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api.post("/api/login", {
      email: emailInput.value,
      password: passwordInput.value,
    });
    // Send each role to its own pages
    location.href = result.user.role === "manager" ? "/manager/" : "/employee/";
  } catch (error) {
    message.textContent = error.message;   // "Email or password is wrong"
  }
});
```

**Example – check who is logged in (any page):**

```js
const me = await api.get("/api/me");          // not logged in -> goes to login page
welcome.textContent = `Hello, ${me.name}`;
```

### Rules every route follows

- **Logging in:** after `POST /api/login`, the server sets a secure cookie holding a session token. The browser sends it automatically, so pages never handle the token themselves.
- **Success:** status `200` (or `201` when something was created) and JSON data.
- **Errors:** always `{ "error": "message a human can read" }` with a status code:

| Code | Meaning | Example |
|---|---|---|
| 400 | Bad input | `{ "error": "end_time must be after start_time" }` |
| 401 | Not logged in | `{ "error": "Please log in" }` |
| 403 | Wrong role / not yours | `{ "error": "Only managers can approve swaps" }` |
| 404 | Doesn't exist | `{ "error": "Shift not found" }` |

- Dates are `"YYYY-MM-DD"`, times are `"HH:MM"` (24-hour).

### Route list (the contract)

**Who:** E = employee, M = manager, All = anyone logged in, Public = no login.

#### Login (Sprint 1)

| Method | Route | Who | Send | Returns |
|---|---|---|---|---|
| POST | `/api/login` | Public | `{ email, password }` | `{ user: { id, name, role } }` |
| POST | `/api/logout` | All | – | `{ ok: true }` |
| GET | `/api/me` | All | – | `{ id, name, email, role, hourly_rate }` |

After login, send managers to `/manager/` and employees to `/employee/` based on `user.role`.

- Email is not case-sensitive (`Tom@ShiftSwap.test` works).
- Wrong email **or** wrong password both give `401 { "error": "Email or password is wrong" }` – on purpose, so attackers can't find out which emails exist.
- Missing email/password gives `400 { "error": "Please send an email and a password" }`.
- A login lasts **8 hours**; after that `/api/me` returns 401 and `api.js` sends the user to the login page.

#### Shifts (Sprint 1)

| Method | Route | Who | Send | Returns |
|---|---|---|---|---|
| GET | `/api/shifts/mine` | E | – | my shifts, earliest first |
| GET | `/api/shifts/week?start=YYYY-MM-DD` | All | `start` = a Monday | all shifts Mon–Sun, with the employee's name |
| GET | `/api/shifts/open` | All | – | shifts with status `open` |
| POST | `/api/shifts` | M | `{ shift_date, start_time, end_time, position, assigned_to }` | the new shift (201) |
| PUT | `/api/shifts/:id` | M | any of the fields above | the updated shift |
| DELETE | `/api/shifts/:id` | M | – | `{ ok: true }` |

A shift looks like this:

```json
{ "id": 7, "shift_date": "2026-10-29", "start_time": "12:00", "end_time": "17:00",
  "position": "Barista", "assigned_to": 4, "assigned_name": "Leo Martin", "status": "open" }
```

#### Swaps (Sprint 2)

| Method | Route | Who | Send | Returns |
|---|---|---|---|---|
| POST | `/api/swaps` | E (own shift) | `{ shift_id, to_user_id }` (`to_user_id` optional – leave it out to offer to anyone) | the new request (201); shift becomes `open` |
| GET | `/api/swaps/mine` | E | – | requests I made or that were offered to me |
| POST | `/api/swaps/:id/accept` | E (not the giver) | – | request now `accepted` |
| GET | `/api/swaps/pending` | M | – | requests waiting for a manager (`accepted`) |
| POST | `/api/swaps/:id/approve` | M | – | request `approved`; shift moves to the new employee |
| POST | `/api/swaps/:id/reject` | M | – | request `rejected`; shift goes back to the original employee |

**Swap flow:** `pending` (posted) → `accepted` (a colleague takes it) → `approved` or `rejected` (manager decides). Each step sends a notification to the people involved.

#### Hours and staff (Sprint 3)

| Method | Route | Who | Send | Returns |
|---|---|---|---|---|
| GET | `/api/hours/mine` | E | – | `{ hours, hourly_rate, pay }` for my shifts |
| GET | `/api/staff` | M | – | every employee with their hours and pay |

#### Notifications (Bikram, Sprint 3)

| Method | Route | Who | Send | Returns |
|---|---|---|---|---|
| GET | `/api/notifications` | All | – | my notifications, newest first, plus `unread` count |
| POST | `/api/notifications/:id/read` | All (own only) | – | `{ ok: true }` |

#### Working now

| Method | Route | Who | Returns |
|---|---|---|---|
| GET | `/api/health` | Public | `{ ok, message, database: { table: rowCount } }` |
| POST | `/api/login` | Public | `{ user: { id, name, role } }` + session cookie |
| POST | `/api/logout` | All | `{ ok: true }` |
| GET | `/api/me` | All | `{ id, name, email, role, hourly_rate }` |

**Quick test without a login page:** start the server, open http://localhost:8000, press F12 → **Console**, and type:

```js
await api.post("/api/login", { email: "tom@shiftswap.test", password: "password123" })
await api.get("/api/me")
```

---

*Route shapes may change slightly while building – any change gets agreed with the person who uses it and updated here first.*
