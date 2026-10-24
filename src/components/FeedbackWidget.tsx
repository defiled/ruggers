import { useEffect, useRef, useState, type FormEvent } from 'react';
import { identifyVisitor, trackEvent } from '../analytics';
import { getFeedbackContext, subscribeFeedbackContext } from '../feedback/context';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IconChat, IconClose } from './icons';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FALLBACK_EMAIL = import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined;

/** Floating "Say something" button available on every screen, with a small form. */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useLocalStorage('steamrollers.feedback-name', '');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [context, setContext] = useState(getFeedbackContext());
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => subscribeFeedbackContext(setContext), []);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setError('');
    const id = setTimeout(() => textRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: text, context, page: window.location.href }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Server said ${res.status}`);
      }
      setStatus('sent');
      setMessage('');
      identifyVisitor(name);
      trackEvent('feedback_sent', { context });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send.');
    }
  };

  const mailto = FALLBACK_EMAIL
    ? `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent('Playbook feedback')}&body=${encodeURIComponent(`${message}\n\n(${context})`)}`
    : null;

  return (
    <>
      <button type="button" className="fab" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="Say something" title="Say something">
        <IconChat size={20} />
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onClick={(e) => e.stopPropagation()}>
            <header className="sheet__head">
              <div>
                <span className="eyebrow">Feedback</span>
                <h2 id="feedback-title" className="sheet__title">
                  Have a question or see something wrong?
                </h2>
              </div>
              <button type="button" className="sheet__close" onClick={() => setOpen(false)} aria-label="Close">
                <IconClose size={18} />
              </button>
            </header>

            {status === 'sent' ? (
              <div className="sheet__body">
                <p className="lead">Thanks. It's logged and the coaches will see it.</p>
                <div className="sheet__actions">
                  <button type="button" className="btn" onClick={() => setOpen(false)}>
                    Done
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setStatus('idle')}>
                    Send another
                  </button>
                </div>
              </div>
            ) : (
              <form className="sheet__body" onSubmit={submit}>
                <label className="field">
                  <span className="field__label">Your name (optional)</span>
                  <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
                </label>
                <label className="field">
                  <span className="field__label">What's up?</span>
                  <textarea
                    ref={textRef}
                    className="field__input field__textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    required
                    placeholder="A question, a wrong line, a better idea…"
                  />
                </label>
                {context && <p className="field__hint">Attached: {context}</p>}
                {status === 'error' && (
                  <p className="field__error">
                    Couldn't send ({error}).{' '}
                    {mailto && (
                      <a href={mailto} className="link">
                        Email it instead
                      </a>
                    )}
                  </p>
                )}
                <div className="sheet__actions">
                  <button type="submit" className="btn" disabled={status === 'sending' || !message.trim()}>
                    {status === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
