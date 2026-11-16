// =============================================================
// Running a filtered list, a page at a time (Week 4) – owner: Sujal – SS-57
// Used by the shift and swap list routes.
// =============================================================

import { db } from "./db.js";
import { listResponse } from "./helpers.js";

// Run a list query with the conditions, a page at a time if asked.
// `from` is the FROM ... JOIN part; `fields` the columns to select.
// fields, from, conditions and order are fixed text written by us in the
// routes – never typed by a user. Anything a user sends goes in `values`.
export function runList({ fields, from, conditions, values, order, paging }) {
  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  if (!paging.paged) {
    const items = db.prepare(`SELECT ${fields} ${from} ${where} ${order}`).all(...values);
    return listResponse(paging, items, items.length);
  }

  // One query for this page's rows, one for how many there are in total.
  const items = db.prepare(`SELECT ${fields} ${from} ${where} ${order} LIMIT ? OFFSET ?`)
    .all(...values, paging.limit, paging.offset);
  const total = db.prepare(`SELECT COUNT(*) AS n ${from} ${where}`).get(...values).n;
  return listResponse(paging, items, total);
}
