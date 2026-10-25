import { useState } from 'react';
import { BODY_AREAS, type BodyArea, type Reason } from '../../domain/types';
import { Chip, Sheet, cap } from '../components';

export const REASON_LABELS: Record<Reason, string> = {
  pain: 'Pain', 'no-time': 'No time', tired: 'Tired', forgot: 'Forgot', 'ate-out': 'Ate out', other: 'Other',
};

export interface NotDoneResult { reason: Reason; pain?: number; area?: BodyArea; otherText?: string }

/** One tap on a reason saves. Pain level and area are optional taps first. */
export function NotDoneSheet({ title, forMeal, forExercise, onSave, onClose }: {
  title: string; forMeal?: boolean; forExercise?: boolean; onSave: (r: NotDoneResult) => void; onClose: () => void;
}) {
  const [pain, setPain] = useState<number | undefined>();
  const [area, setArea] = useState<BodyArea | undefined>();
  const [other, setOther] = useState<string | null>(null);
  const reasons: Reason[] = ['pain', 'no-time', 'tired', 'forgot', ...(forMeal ? (['ate-out'] as Reason[]) : [])];
  const extras = forExercise ? { pain, area } : {};

  return (
    <Sheet title="Not done" label={`Not done: ${title}`} onClose={onClose}>
      <div className="muted">{title}</div>
      {forExercise && (
        <>
          <div className="sheet-label">Pain (optional)</div>
          <div className="chips">
            {Array.from({ length: 11 }, (_, n) => (
              <Chip key={n} on={pain === n} danger={n >= 4} label={`Pain ${n}`} onClick={() => setPain(pain === n ? undefined : n)}>{n}</Chip>
            ))}
          </div>
          <div className="sheet-label">Where (optional)</div>
          <div className="chips">
            {BODY_AREAS.map(a => <Chip key={a} on={area === a} onClick={() => setArea(area === a ? undefined : a)}>{cap(a)}</Chip>)}
          </div>
        </>
      )}
      <div className="sheet-label">Why?</div>
      <div className="chips">
        {reasons.map(r => <Chip key={r} onClick={() => onSave({ reason: r, ...extras })}>{REASON_LABELS[r]}</Chip>)}
        <Chip on={other !== null} onClick={() => setOther(other === null ? '' : null)}>Other…</Chip>
      </div>
      {other !== null && (
        <>
          <input className="text-input" style={{ marginTop: 12 }} type="text" autoFocus placeholder="What happened?"
            value={other} onChange={e => setOther(e.target.value)} />
          <div className="sheet-actions">
            <button type="button" className="btn primary" disabled={!other.trim()}
              onClick={() => onSave({ reason: 'other', otherText: other.trim(), ...extras })}>Save</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
