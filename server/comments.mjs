/**
 * Clip comments, stored in Turso so everyone sees the same thread.
 *
 * Shared by the Express server (npm start) and the Vercel function (api/comments.js)
 * so the queries and the validation live in exactly one place.
 */
import { query, tursoConfigured } from './turso.mjs';

export { tursoConfigured };

export const MAX_BODY = 2000;
export const MAX_NICKNAME = 60;
const CLIP_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function validClipId(id) {
  return typeof id === 'string' && CLIP_ID.test(id);
}

/**
 * Trim and cap the fields; returns null when there is nothing worth storing.
 * `nickname` is derived from the caller's IP by the route, never read from the
 * request body, so a commenter cannot post under someone else's name.
 */
export function cleanComment({ clip, nickname, body, userAgent }) {
  if (!validClipId(clip)) return null;
  const text = String(body ?? '').trim().slice(0, MAX_BODY);
  if (!text) return null;
  return {
    clip,
    nickname: String(nickname ?? '').trim().slice(0, MAX_NICKNAME) || 'Anonymous Prop',
    body: text,
    userAgent: String(userAgent ?? '').slice(0, 300) || null,
  };
}

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS clip_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      clip_id    TEXT    NOT NULL,
      nickname   TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      user_agent TEXT,
      hidden     INTEGER NOT NULL DEFAULT 0
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS clip_comments_clip ON clip_comments (clip_id, id)');
}

export async function listComments(clipId) {
  if (!validClipId(clipId)) return [];
  const { rows } = await query(
    'SELECT id, clip_id, nickname, body, created_at FROM clip_comments WHERE clip_id = ? AND hidden = 0 ORDER BY id ASC LIMIT 200',
    [clipId],
  );
  return rows.map((r) => ({ id: r.id, clip: r.clip_id, nickname: r.nickname, body: r.body, createdAt: r.created_at }));
}

export async function addComment(input) {
  const row = cleanComment(input);
  if (!row) return null;
  const { lastInsertRowid } = await query(
    'INSERT INTO clip_comments (clip_id, nickname, body, user_agent) VALUES (?, ?, ?, ?)',
    [row.clip, row.nickname, row.body, row.userAgent],
  );
  const { rows } = await query('SELECT id, clip_id, nickname, body, created_at FROM clip_comments WHERE id = ?', [lastInsertRowid]);
  const r = rows[0];
  return r ? { id: r.id, clip: r.clip_id, nickname: r.nickname, body: r.body, createdAt: r.created_at } : null;
}
