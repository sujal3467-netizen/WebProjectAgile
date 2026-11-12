// =============================================================
// notify() – create an in-app notification (owner: Bikram)
//
// STARTER VERSION written by Sujal in Week 3 so the swap routes can
// send notifications. Bikram owns this file (his notify() ticket) and
// can extend it – just keep the same function name and parameters:
//
//     notify(userId, message, link)
//
// The notification appears on the user's bell page as unread (is_read = 0).
// =============================================================

import { db } from "./db.js";

export function notify(userId, message, link = null) {
  db.prepare(
    "INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)",
  ).run(userId, message, link);
}

// Send the same message to every user with a role ("employee" or "manager"),
// optionally leaving one person out (e.g. the employee who caused it).
export function notifyRole(role, message, link = null, exceptUserId = null) {
  const users = db.prepare("SELECT id FROM users WHERE role = ?").all(role);
  for (const user of users) {
    if (user.id !== exceptUserId) notify(user.id, message, link);
  }
}
