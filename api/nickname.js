/** The commenter's name, fixed by their IP. See server/nickname.mjs. */
import { clientIp, nicknameForIp } from '../server/nickname.mjs';

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({ nickname: nicknameForIp(clientIp(req)) });
}
