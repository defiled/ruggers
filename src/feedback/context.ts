import { useEffect } from 'react';

/**
 * Where the visitor is on the site, attached to every feedback message
 * (e.g. "Plays · Chopper · Switch 13 · L15 right"). Tabs publish it; the widget reads it.
 */
let current = '';
const listeners = new Set<(v: string) => void>();

export function setFeedbackContext(value: string) {
  if (value === current) return;
  current = value;
  listeners.forEach((l) => l(value));
}

export function getFeedbackContext() {
  return current;
}

export function subscribeFeedbackContext(listener: (v: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFeedbackContext(value: string) {
  useEffect(() => {
    setFeedbackContext(value);
  }, [value]);
}
