import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { addComment, listComments, tursoConfigured } from './comments.mjs';
import { clientIp, nicknameForIp } from './nickname.mjs';
import { insertFeedback, listFeedback, openDb, resolveFeedback } from './db.mjs';

/**
 * Tiny API + static host.
 *   POST /api/feedback            { name?, message, context?, page? }  -> { id }
 *   GET  /api/feedback            list (requires ADMIN_KEY via ?key= or x-admin-key header)
 *   POST /api/feedback/:id/resolve  (same key)
 * Serves ./dist when it exists (production). In dev, Vite proxies /api here.
 *
 * Env: PORT (8787), FEEDBACK_DB (data/feedback.db), ADMIN_KEY (list/resolve),
 *      FEEDBACK_WEBHOOK_URL (optional: Slack / Discord / Google Chat incoming webhook that gets pinged per message),
 *      SITE_URL (optional: public origin for share-card links; otherwise taken from each request's host).
 */
const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_KEY = process.env.ADMIN_KEY ?? '';
const WEBHOOK = process.env.FEEDBACK_WEBHOOK_URL ?? '';
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '');

const db = openDb();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Light per-IP throttle: 10 messages / 10 minutes.
const recent = new Map();
function throttled(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (hits.length >= 10) return true;
  hits.push(now);
  recent.set(ip, hits);
  return false;
}

async function ping({ id, name, message, context }) {
  if (!WEBHOOK) return;
  const text = `Playbook feedback #${id}${name ? ` from ${name}` : ''}${context ? ` (${context})` : ''}:\n${message}`;
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text }), // Slack/Google Chat read `text`, Discord reads `content`
    });
  } catch (err) {
    console.error('webhook ping failed:', err.message);
  }
}

app.post('/api/feedback', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'Too many messages, try again in a few minutes.' });
  const body = req.body ?? {};
  const message = String(body.message ?? '').trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const row = {
    name: String(body.name ?? '').trim().slice(0, 80) || null,
    message,
    context: String(body.context ?? '').trim().slice(0, 200) || null,
    page: String(body.page ?? '').trim().slice(0, 200) || null,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
  };
  const id = insertFeedback(db, row);
  console.log(`feedback #${id}${row.name ? ` from ${row.name}` : ''}${row.context ? ` [${row.context}]` : ''}: ${message}`);
  ping({ id, ...row });
  res.status(201).json({ id });
});

/**
 * Clip comments for the Analysis tab. Stored in Turso so every visitor sees the same
 * thread; the client falls back to localStorage when this is unavailable.
 *   GET  /api/comments?clip=<id>
 *   POST /api/comments   { clip, nickname, body }
 */
app.get('/api/comments', async (req, res) => {
  if (!tursoConfigured) return res.status(503).json({ error: 'Comments are not configured.' });
  try {
    res.json({ comments: await listComments(String(req.query.clip ?? '')) });
  } catch (err) {
    console.error('comments list failed:', err.message);
    res.status(502).json({ error: 'Could not load comments.' });
  }
});

/** The commenter's name, fixed by their IP. */
app.get('/api/nickname', (req, res) => {
  res.json({ nickname: nicknameForIp(clientIp(req)) });
});

app.post('/api/comments', async (req, res) => {
  if (!tursoConfigured) return res.status(503).json({ error: 'Comments are not configured.' });
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'Too many comments, try again in a few minutes.' });
  try {
    const comment = await addComment({
      ...(req.body ?? {}),
      nickname: nicknameForIp(clientIp(req)),      // server-assigned, not client-chosen
      userAgent: req.headers['user-agent'],
    });
    if (!comment) return res.status(400).json({ error: 'Need a clip id and a message.' });
    res.status(201).json({ comment });
  } catch (err) {
    console.error('comment insert failed:', err.message);
    res.status(502).json({ error: 'Could not save that.' });
  }
});

function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') ?? req.query.key;
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(401).json({ error: 'Admin key required.' });
  next();
}

app.get('/api/feedback', requireAdmin, (req, res) => {
  res.json(listFeedback(db, { includeResolved: req.query.all === '1' }));
});

app.post('/api/feedback/:id/resolve', requireAdmin, (req, res) => {
  res.json({ changed: resolveFeedback(db, Number(req.params.id)) });
});

/** Link previews (Slack, iMessage, WhatsApp, Facebook, X) need absolute og:image / og:url values. */
const SHARE_META = /(<meta\s+(?:property|name)="(?:og:url|og:image|twitter:image)"\s+content=")(\/[^"]*)"/g;
export function absoluteShareMeta(html, origin) {
  return html.replace(SHARE_META, (_m, prefix, path) => `${prefix}${origin}${path}"`);
}
function requestOrigin(req) {
  if (SITE_URL) return SITE_URL;
  const proto = (req.get('x-forwarded-proto') ?? req.protocol).split(',')[0].trim();
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? `localhost:${PORT}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

const dist = resolve('dist');
if (existsSync(dist)) {
  const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf8');
  app.use(express.static(dist, { index: false }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.type('html').send(absoluteShareMeta(indexHtml, requestOrigin(req))));
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}${existsSync(dist) ? ' (serving dist/)' : ''}`);
  if (!WEBHOOK) console.log('Set FEEDBACK_WEBHOOK_URL to get pinged on each message. Read messages with: npm run feedback');
});
