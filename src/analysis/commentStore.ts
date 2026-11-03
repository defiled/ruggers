/**
 * Clip comments. Talks to the API (Turso-backed) when it is there, and falls back to
 * per-device localStorage when it is not — so the page still works if the API is
 * unreachable or the Turso credentials are missing.
 */
export interface Comment {
  id: number;
  clip: string;
  nickname: string;
  body: string;
  createdAt: string;
}

export type Mode = 'remote' | 'local';

const localKey = (clip: string) => `frederick.analysis-comments.${clip}`;

function readLocal(clip: string): Comment[] {
  try {
    const raw = localStorage.getItem(localKey(clip));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Comment[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(clip: string, rows: Comment[]) {
  try {
    localStorage.setItem(localKey(clip), JSON.stringify(rows));
  } catch {
    /* storage unavailable: the comment lives for this render only */
  }
}

/** Load a clip's thread. Reports which store answered so the UI can say so. */
export async function list(clip: string): Promise<{ comments: Comment[]; mode: Mode }> {
  try {
    const res = await fetch(`/api/comments?clip=${encodeURIComponent(clip)}`);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { comments?: Comment[] };
    if (!Array.isArray(body.comments)) throw new Error('bad payload');
    return { comments: body.comments, mode: 'remote' };
  } catch {
    return { comments: readLocal(clip), mode: 'local' };
  }
}

export async function add(clip: string, nickname: string, body: string): Promise<{ comment: Comment; mode: Mode }> {
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clip, nickname, body }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const payload = (await res.json()) as { comment?: Comment };
    if (!payload.comment) throw new Error('bad payload');
    return { comment: payload.comment, mode: 'remote' };
  } catch {
    const comment: Comment = {
      id: Date.now(),
      clip,
      nickname,
      body,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    writeLocal(clip, [...readLocal(clip), comment]);
    return { comment, mode: 'local' };
  }
}

/** "just now" / "4 min ago" / "2 Nov". SQLite hands back UTC without a zone marker. */
export function whenLabel(createdAt: string): string {
  const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} h ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
