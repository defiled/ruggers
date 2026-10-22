import type { ReactNode } from 'react';

interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  compact,
}: {
  label?: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="control">
      {label && <span className="control__label">{label}</span>}
      <div className={`seg${compact ? ' seg--compact' : ''}`} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={`seg__btn${o.value === value ? ' is-active' : ''}`}
            onClick={() => onChange(o.value)}
            aria-pressed={o.value === value}
            title={o.title}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function Panel({ title, eyebrow, children }: { title?: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {(eyebrow || title) && (
        <header className="panel__head">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title && <h2 className="panel__title">{title}</h2>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Collapsible group: closed by default on phones, open on larger screens. */
export function Disclosure({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details className="disclosure" open={open} key={open ? 'open' : 'closed'}>
      <summary className="disclosure__summary">{title}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
