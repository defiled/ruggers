import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** SQLite store for site feedback. One table, one file (default ./data/feedback.db). */
export function openDb(file = process.env.FEEDBACK_DB ?? resolve('data', 'feedback.db')) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT,
      message TEXT NOT NULL,
      context TEXT,
      page TEXT,
      user_agent TEXT,
      resolved INTEGER NOT NULL DEFAULT 0
    )
  `);
  return db;
}

export function insertFeedback(db, { name, message, context, page, userAgent }) {
  const stmt = db.prepare('INSERT INTO feedback (name, message, context, page, user_agent) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(name ?? null, message, context ?? null, page ?? null, userAgent ?? null);
  return Number(info.lastInsertRowid);
}

export function listFeedback(db, { includeResolved = true, limit = 200 } = {}) {
  const where = includeResolved ? '' : 'WHERE resolved = 0';
  return db.prepare(`SELECT * FROM feedback ${where} ORDER BY id DESC LIMIT ?`).all(limit);
}

export function resolveFeedback(db, id) {
  return db.prepare('UPDATE feedback SET resolved = 1 WHERE id = ?').run(id).changes;
}
