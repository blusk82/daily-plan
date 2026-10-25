import type { Recovery } from '../../domain/types';

const COLOURS: { id: Recovery; label: string; bg: string }[] = [
  { id: 'green', label: 'Green recovery', bg: '#3aa65a' },
  { id: 'yellow', label: 'Yellow recovery', bg: '#e0b52d' },
  { id: 'red', label: 'Red recovery', bg: '#d24a3f' },
];

/** Optional one tap from Whoop each morning. Tap again to clear. */
export function RecoveryPicker({ value, onChange }: { value?: Recovery; onChange: (r: Recovery | null) => void }) {
  return (
    <div className="recovery">
      <span>Whoop</span>
      {COLOURS.map(c => (
        <button key={c.id} type="button" className="dot" style={{ background: c.bg }} aria-label={c.label}
          aria-pressed={value === c.id} onClick={() => onChange(value === c.id ? null : c.id)} />
      ))}
    </div>
  );
}
