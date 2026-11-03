#!/usr/bin/env node
/** Create the clip_comments table. Idempotent; safe to re-run. */
import { ensureSchema, tursoConfigured } from '../server/comments.mjs';

if (!tursoConfigured) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first (see .env.example).');
  process.exit(1);
}
await ensureSchema();
console.log('clip_comments is ready.');
