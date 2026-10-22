import { listFeedback, openDb, resolveFeedback } from '../server/db.mjs';

/**
 * npm run feedback            -> list open messages
 * npm run feedback -- --all   -> include resolved
 * npm run feedback -- --resolve 12
 */
const args = process.argv.slice(2);
const db = openDb();
const resolveIdx = args.indexOf('--resolve');
if (resolveIdx >= 0) {
  const id = Number(args[resolveIdx + 1]);
  console.log(resolveFeedback(db, id) ? `#${id} resolved` : `#${id} not found`);
  process.exit(0);
}
const rows = listFeedback(db, { includeResolved: args.includes('--all') });
if (rows.length === 0) {
  console.log('No feedback yet.');
} else {
  for (const r of rows) {
    console.log(`#${r.id}  ${r.created_at}  ${r.resolved ? '[resolved] ' : ''}${r.name ?? 'anonymous'}${r.context ? `  (${r.context})` : ''}`);
    console.log(`    ${r.message.replace(/\n/g, '\n    ')}`);
  }
}
