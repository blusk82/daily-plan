import { useEffect, type ReactNode } from 'react';

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: ReactNode; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Chip({ on, onClick, children, danger, label }: { on?: boolean; onClick: () => void; children: ReactNode; danger?: boolean; label?: string }) {
  return (
    <button type="button" className={`chip${danger ? ' danger' : ''}`} aria-pressed={!!on} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Header({ date, title, children }: { date?: string; title: string; children?: ReactNode }) {
  return (
    <header className="header">
      <div className="row">
        <div>
          {date && <div className="date">{date}</div>}
          <h1>{title}</h1>
        </div>
        {children}
      </div>
    </header>
  );
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span aria-label={label}>{value}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  );
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
