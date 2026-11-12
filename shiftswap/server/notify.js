
import { db } from "./db.js";

/**
 * Save an in-app notification for a ShiftSwap user.
 *
 * @param {number} userId - ID of the recipient.
 * @param {string} message - Notification text.
 * @param {string|null} link - Optional page to open.
 * @returns {number} ID of the new notification.
 */
export function notify(userId, message, link = null) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("notify: userId must be a positive integer");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("notify: message cannot be empty");
  }

  if (link !== null && typeof link !== "string") {
    throw new Error("notify: link must be a string or null");
  }

  const statement = db.prepare(`
    INSERT INTO notifications (user_id, message, link)
    VALUES (?, ?, ?)
  `);

  const result = statement.run(userId, message.trim(), link);

  return Number(result.lastInsertRowid);
}



   // Send the same message to every user with a role ("employee" or "manager"),
   // optionally leaving one person out (e.g. the employee who caused it).
   // Used by the swap routes (SS-47, SS-48).
   export function notifyRole(role, message, link = null, exceptUserId = null) {
     const users = db.prepare("SELECT id FROM users WHERE role = ?").all(role);
     for (const user of users) {
       if (user.id !== exceptUserId) notify(user.id, message, link);
     }
   }
