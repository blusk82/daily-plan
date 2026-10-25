import { useState } from 'react';
import { confirmWeek } from '../../db/repo';
import { shortDate } from '../../domain/dates';
import type { WeekPlan } from '../../domain/types';
import { buildPrepReminders } from '../../shopping/prep';
import { buildShoppingTrips } from '../../shopping/shopping';
import { saveBackupNow } from '../Banners';
import { useData } from '../data';

/** Step 3: what confirming sets up. Confirm offers a backup in the same tap. */
export function StepConfirm({ plan, onDone, onBack }: { plan: WeekPlan; onDone: () => void; onBack: () => void }) {
  const { lib, pantry, settings, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const trips = buildShoppingTrips(plan, lib, pantry, settings);
  const preps = buildPrepReminders(plan, lib);
  const morning = plan.sessions.filter(s => s.slot === 'morning').length;
  const evening = plan.sessions.filter(s => s.slot === 'evening').length;

  async function confirm(backup: boolean) {
    setBusy(true);
    await confirmWeek(plan.weekStart);
    if (backup) await saveBackupNow(refresh);
    else await refresh();
    onDone();
  }

  return (
    <>
      <div className="section-title">Shopping</div>
      <div className="card">
        {trips.length === 0 && <div className="list-row muted">Nothing to buy.</div>}
        {trips.map(t => (
          <div className="list-row" key={t.id}>
            {t.kind === 'main'
              ? `Main shop · ${shortDate(t.date)} · ${t.lines.length} items`
              : `Top-up · ${shortDate(t.date)} by ${t.byTime} · ${t.lines.map(l => l.name).join(', ')}`}
          </div>
        ))}
      </div>
      <div className="section-title">Prep reminders</div>
      <div className="card">
        {preps.length === 0 && <div className="list-row muted">None this week.</div>}
        {preps.map(p => <div className="list-row" key={p.id}>{shortDate(p.date)} {p.time} · {p.label} ({p.forText})</div>)}
      </div>
      <div className="section-title">Exercise</div>
      <div className="card"><div className="list-row">{morning} exercise sessions · {evening} stretch sessions</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 14 }}>
        <button type="button" className="btn primary" disabled={busy} onClick={() => confirm(true)}>Confirm and save backup</button>
        <button type="button" className="btn" disabled={busy} onClick={() => confirm(false)}>Confirm without backup</button>
        <button type="button" className="linkbtn" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
