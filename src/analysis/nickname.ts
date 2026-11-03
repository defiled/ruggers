/**
 * The commenter's throwaway name.
 *
 * It is assigned by the server from the caller's IP, so the same person keeps the
 * same name across tabs, sessions and devices on that network. We also cache it for
 * the browser session, which keeps the name steady if their IP changes mid-session
 * (wifi to cellular, say). Between the two, a name sticks to a person both ways.
 *
 * There is deliberately no reroll: the name is a lock, not a costume. The word lists
 * live only on the server (server/nickname.mjs) since it is the one that decides.
 */
const KEY = 'frederick.analysis-nickname';
const FALLBACK = 'Anonymous Prop';

function cached(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function remember(name: string) {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    /* private browsing: the name lasts as long as the page does */
  }
}

/** The session's name, asking the server the first time. */
export async function loadNickname(): Promise<string> {
  const seen = cached();
  if (seen) return seen;
  try {
    const res = await fetch('/api/nickname');
    if (!res.ok) throw new Error(String(res.status));
    const { nickname } = (await res.json()) as { nickname?: string };
    if (!nickname) throw new Error('no nickname');
    remember(nickname);
    return nickname;
  } catch {
    // No API (static hosting, or offline): comments are device-local anyway.
    return FALLBACK;
  }
}
