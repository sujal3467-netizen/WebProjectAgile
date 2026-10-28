-- =============================================================
-- ShiftSwap database schema (Week 1, Tuesday) – owner: Sujal
-- Jira: SS-6 Create database schema and test data
--
-- 5 tables. Run order matters: a table that points to another
-- table (a FOREIGN KEY) must be created after the table it points to.
-- =============================================================

-- Start clean: drop in reverse order (children before parents).
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS swap_requests;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS users;

-- ---------- users: everyone who can log in ----------
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,          -- no two users with the same email
  password_hash TEXT    NOT NULL,                 -- NEVER the real password
  role          TEXT    NOT NULL CHECK (role IN ('employee', 'manager')),
  hourly_rate   REAL    NOT NULL DEFAULT 0        -- pounds per hour, used in Week 4
);

-- ---------- shifts: one row per shift on the rota ----------
CREATE TABLE shifts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_date  TEXT NOT NULL,                      -- 'YYYY-MM-DD'
  start_time  TEXT NOT NULL,                      -- 'HH:MM' (24-hour)
  end_time    TEXT NOT NULL,                      -- 'HH:MM'
  position    TEXT NOT NULL,                      -- e.g. 'Barista', 'Till'
  assigned_to INTEGER REFERENCES users(id),       -- NULL = nobody has it yet
  status      TEXT NOT NULL DEFAULT 'assigned'
              CHECK (status IN ('assigned', 'open'))
);

-- ---------- swap_requests: an employee giving away a shift ----------
CREATE TABLE swap_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id     INTEGER NOT NULL REFERENCES shifts(id),
  from_user_id INTEGER NOT NULL REFERENCES users(id),  -- who is giving it away
  to_user_id   INTEGER REFERENCES users(id),           -- NULL = offered to anyone
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'approved', 'rejected')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- notifications: messages shown on the bell page (Bikram) ----------
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),   -- who should see it
  message    TEXT    NOT NULL,
  link       TEXT,                                    -- page to open when clicked
  is_read    INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- sessions: who is logged in (used from Week 2) ----------
CREATE TABLE sessions (
  token      TEXT    PRIMARY KEY,                     -- long random string
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
