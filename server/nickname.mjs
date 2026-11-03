/**
 * Throwaway identities for clip comments.
 *
 * The name is derived from the commenter's IP, so the same person keeps the same
 * name across tabs, sessions and devices on that network, and cannot pick a new one
 * by reopening the browser. The client caches it per browser session as well, which
 * keeps the name steady if their IP changes mid-session (wifi -> cellular).
 *
 * Derivation is salted, so a name never discloses the address behind it.
 */
import { createHash } from 'node:crypto';

const ADJECTIVES = [
  'Offside', 'Knock-On', 'Scrum-Cap', 'Mud-Caked', 'Boot-Laced', 'Late-Tackling',
  'Unbound', 'Crooked-Feed', 'Blindside', 'Overlapping', 'Jet-Lagged', 'Hungover',
  'Unmarked', 'Flat-Footed', 'High-Tackling', 'Rolling-Maul', 'Short-Side', 'Dummy-Running',
  'Terrifying', 'Mildly-Concussed', 'Over-Committed', 'Ever-Present', 'Strapped-Up', 'Breathless',
];

const NOUNS = [
  'Barry', 'Terry', 'Gandalf', 'Prop', 'Hooker', 'Flanker', 'Winger', 'Fullback',
  'Ruck Goblin', 'Lineout Giraffe', 'Scrum Gremlin', 'Touch Judge', 'Water Carrier',
  'Number 8', 'Second Row', 'Tighthead', 'Loosehead', 'Fly Half', 'Sweeper',
  'Bench Warmer', 'Clubhouse Legend', 'Tackle Bag', 'Kicking Tee', 'Dave',
];

const SALT = process.env.NICKNAME_SALT ?? 'frederick-rfc-analysis-v1';

/** Read the real client address, honouring the proxy header Vercel sets. */
export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : String(fwd ?? '').split(',')[0];
  return (first || req.socket?.remoteAddress || 'unknown').trim();
}

export function nicknameForIp(ip) {
  const h = createHash('sha256').update(`${SALT}:${ip}`).digest();
  return `${ADJECTIVES[h.readUInt32BE(0) % ADJECTIVES.length]} ${NOUNS[h.readUInt32BE(4) % NOUNS.length]}`;
}
