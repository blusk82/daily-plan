import { useState } from 'react';
import type { HHMM } from '../../domain/types';
import { Sheet } from '../components';

export function TimeSheet({ title, time, onSave, onClose }: { title: string; time: HHMM; onSave: (t: HHMM) => void; onClose: () => void }) {
  const [t, setT] = useState(time);
  const ok = /^\d{2}:\d{2}$/.test(t);
  return (
    <Sheet title="Move" label={`Move ${title}`} onClose={onClose}>
      <div className="muted">{title} — today only</div>
      <label className="field" style={{ padding: '14px 0' }}>
        <span>Time</span>
        <input type="time" aria-label="Time" value={t} onChange={e => setT(e.target.value)} />
      </label>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!ok} onClick={() => onSave(t)}>Save</button>
      </div>
    </Sheet>
  );
}
