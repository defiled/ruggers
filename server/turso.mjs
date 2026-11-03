/**
 * Minimal Turso (libSQL) client over the HTTP pipeline API.
 *
 * @libsql/client would pull in a native binding, which is awkward on Vercel, and all
 * we need is one POST. Works unchanged on Node 22 and in a serverless function.
 *
 * Env: TURSO_DATABASE_URL (libsql://... or https://...), TURSO_AUTH_TOKEN
 */
const RAW_URL = process.env.TURSO_DATABASE_URL ?? '';
const TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';

export const tursoConfigured = Boolean(RAW_URL && TOKEN);

function endpoint() {
  const host = RAW_URL.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  return `${host}/v2/pipeline`;
}

/** libSQL returns every value tagged; unwrap to plain JS. */
function decode(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  return cell.value;
}

/**
 * Run one statement. `args` are positional (?) parameters.
 * Returns { rows: Array<Record<string, unknown>>, lastInsertRowid: number|null }.
 */
export async function query(sql, args = []) {
  if (!tursoConfigured) throw new Error('Turso is not configured (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(toArg) } },
        { type: 'close' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}`);
  const body = await res.json();
  const first = body.results?.[0];
  if (first?.type === 'error') throw new Error(first.error?.message ?? 'Turso error');
  const result = first?.response?.result;
  if (!result) return { rows: [], lastInsertRowid: null };
  const cols = result.cols.map((c) => c.name);
  return {
    rows: result.rows.map((r) => Object.fromEntries(r.map((cell, i) => [cols[i], decode(cell)]))),
    lastInsertRowid: result.last_insert_rowid ? Number(result.last_insert_rowid) : null,
  };
}

function toArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}
