// =============================================================
// ShiftSwap database connection (Week 1, Tuesday) – owner: Sujal
// Jira: SS-6
//
// Every other server file gets the database from here:
//     import { db } from "./db.js";
// so there is only ONE connection and ONE place that knows the file name.
// =============================================================

// Deno has SQLite built in (through its Node compatibility), so we
// don't need to install anything.
import { DatabaseSync } from "node:sqlite";

// The database is a single file in the server/ folder.
// It is NOT committed to Git (see .gitignore) – everyone builds
// their own copy from schema.sql + seed.sql.
const DB_FILE = "server/shiftswap.db";

export const db = new DatabaseSync(DB_FILE);

// SQLite ignores FOREIGN KEY rules unless we switch them on.
// With this on, you can't (for example) give a shift to user 99
// if user 99 doesn't exist.
db.exec("PRAGMA foreign_keys = ON;");

// ----- Run a .sql file (all the statements in it) -----
function runSqlFile(path) {
  const sql = Deno.readTextFileSync(path);
  db.exec(sql);
}

// ----- Build the tables and fill them with test data -----
export function resetDatabase() {
  runSqlFile("server/schema.sql");
  runSqlFile("server/seed.sql");
  console.log("Database rebuilt from schema.sql + seed.sql");
}

// ----- On first start, the file is empty, so set it up automatically -----
function databaseIsEmpty() {
  // sqlite_master is SQLite's own list of tables.
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  return row === undefined;
}

if (databaseIsEmpty()) {
  resetDatabase();
}
