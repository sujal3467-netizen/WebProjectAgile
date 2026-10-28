// =============================================================
// Rebuild the database from scratch: deno task reset-db
// Use it after changing schema.sql or seed.sql, or when test data
// gets messy (e.g. before every Thursday demo).
// =============================================================
import { resetDatabase } from "./db.js";

resetDatabase();
