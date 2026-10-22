import LogRocket from 'logrocket';

/**
 * LogRocket session replay. On in production builds; off in `npm run dev` so local
 * clicking does not pollute the dashboard. Set VITE_LOGROCKET=1 to force it on locally.
 */
const APP_ID = 'antirithm/steamrollers';
const ENABLED = import.meta.env.PROD || import.meta.env.VITE_LOGROCKET === '1';

const DEVICE_KEY = 'steamrollers.device-id';
const NAME_KEY = 'steamrollers.feedback-name';

let started = false;

/** Stable anonymous id per browser, so one person's sessions group together. */
function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'anonymous';
  }
}

/** Name the visitor last typed into the feedback form (stored by useLocalStorage as JSON). */
function storedName(): string {
  try {
    const raw = localStorage.getItem(NAME_KEY);
    const value: unknown = raw ? JSON.parse(raw) : '';
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export function initAnalytics() {
  if (!ENABLED || started) return;
  started = true;
  LogRocket.init(APP_ID);
  identifyVisitor(storedName());
}

/** There are no accounts: sessions are keyed by device, with the feedback name when we have one. */
export function identifyVisitor(name: string) {
  if (!started) return;
  const trimmed = name.trim();
  LogRocket.identify(deviceId(), trimmed ? { name: trimmed } : {});
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (!started) return;
  LogRocket.track(name, props);
}
