/**
 * Vercel serverless route for clip comments.
 *
 * The static build has no Node server, so this is what backs the Analysis tab in
 * production. Queries live in server/comments.mjs, shared with the Express app.
 *
 * Needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the project's environment.
 */
import { addComment, listComments, tursoConfigured } from '../server/comments.mjs';
import { clientIp, nicknameForIp } from '../server/nickname.mjs';

export default async function handler(req, res) {
  if (!tursoConfigured) return res.status(503).json({ error: 'Comments are not configured.' });

  try {
    if (req.method === 'GET') {
      const clip = String(req.query?.clip ?? '');
      return res.status(200).json({ comments: await listComments(clip) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const comment = await addComment({
        ...body,
        nickname: nicknameForIp(clientIp(req)),    // server-assigned, not client-chosen
        userAgent: req.headers['user-agent'],
      });
      if (!comment) return res.status(400).json({ error: 'Need a clip id and a message.' });
      return res.status(201).json({ comment });
    }

    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('comments failed:', err.message);
    return res.status(502).json({ error: 'Comment store unavailable.' });
  }
}
