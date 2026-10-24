import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

/**
 * Entry gate. Any non-empty password works; what matters is the button sequence:
 * OK → Cancel → OK. Pressing in any other order quietly resets the sequence.
 * Entry is remembered on the device.
 *
 * Off for now: the playbook is not sensitive, so everyone goes straight in. Set GATE_ENABLED
 * back to true to put the password screen back; nothing else has to change.
 */
export const GATE_ENABLED = false;
export const ENTRY_SEQUENCE: Array<'ok' | 'cancel'> = ['ok', 'cancel', 'ok'];

export function Gate({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useLocalStorage('steamrollers.entered', false);
  const [password, setPassword] = useState('');
  const [presses, setPresses] = useState<Array<'ok' | 'cancel'>>([]);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (GATE_ENABLED && !entered) inputRef.current?.focus();
  }, [entered]);

  if (!GATE_ENABLED || entered) return <>{children}</>;

  const press = (kind: 'ok' | 'cancel') => {
    if (!password.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
      return;
    }
    const next = [...presses, kind].slice(-ENTRY_SEQUENCE.length);
    const matches = next.length === ENTRY_SEQUENCE.length && next.every((k, i) => k === ENTRY_SEQUENCE[i]);
    if (matches) {
      setEntered(true);
      return;
    }
    setPresses(next);
    inputRef.current?.focus(); // so Enter keeps meaning OK, whichever button was tapped last
  };

  return (
    <div className="gate">
      <form
        className={`gate__card${shake ? ' is-shake' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          press('ok');
        }}
      >
        <img className="gate__crest" src="/logo.webp" alt="Frederick RFC crest" width="88" height="88" />
        <span className="eyebrow">Frederick RFC</span>
        <h1 className="gate__title">Playbook</h1>
        <p className="muted">Team only. Enter the password to continue.</p>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            ref={inputRef}
            className="field__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            inputMode="text"
          />
        </label>
        <div className="gate__actions">
          <button type="submit" className="btn">
            OK
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => press('cancel')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
