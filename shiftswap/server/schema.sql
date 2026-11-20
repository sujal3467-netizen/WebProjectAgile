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
              CHECK (status IN ('assigned', 'open')),
  CHECK (end_time > start_time)                   -- rule BR6: a shift can't end before it starts
);

-- ---------- swap_requests: an employee giving away a shift ----------
CREATE TABLE swap_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id     INTEGER NOT NULL REFERENCES shifts(id),
  from_user_id INTEGER NOT NULL REFERENCES users(id),  -- who is giving it away
  to_user_id   INTEGER REFERENCES users(id),           -- NULL = offered to anyone
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'approved', 'rejected', 'cancelled')),
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

-- =============================================================
-- Indexes (Week 4) – SS-59
-- An index is like the index at the back of a book: SQLite can jump
-- straight to the matching rows instead of reading the whole table.
-- Each one matches a filter that our routes use a lot. Without them,
-- every filtered list reads every shift – fine for 10 shifts, slow
-- for thousands.
-- NOT indexed: swap_requests.status. Measured with deno task seed-large,
-- an index there was SLOWER: a status matches a big share of a small
-- table, so reading it straight through beats jumping via an index.
-- =============================================================
CREATE INDEX idx_shifts_date        ON shifts (shift_date);            -- from / to, week, today onwards
CREATE INDEX idx_shifts_assigned    ON shifts (assigned_to, shift_date); -- "my shifts", in date order
CREATE INDEX idx_shifts_status      ON shifts (status, shift_date);    -- open shifts
CREATE INDEX idx_swaps_shift        ON swap_requests (shift_id, status); -- active swap for a shift (BR8)
CREATE INDEX idx_swaps_from         ON swap_requests (from_user_id);   -- my swaps: given
CREATE INDEX idx_swaps_to           ON swap_requests (to_user_id);     -- my swaps: taken
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read); -- my bell page / unread count
CREATE INDEX idx_sessions_user      ON sessions (user_id);
