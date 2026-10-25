import { useState } from 'react';
import { proposeWeek, saveWeek } from '../../db/repo';
import { datesOfWeek, longDate, weekday } from '../../domain/dates';
import type { HHMM, PlannedMeal, PlannedSession, WeekPlan } from '../../domain/types';
import { brokenLeftovers } from '../../planner/adjust';
import { sortMeals } from '../../planner/mealPlanner';
import { mealSubtitle, sessionMinutes } from '../../timeline/timeline';
import { cap } from '../components';
import { useData } from '../data';
import { DAYS_SHORT } from '../Setup';
import { TimeSheet } from '../today/TimeSheet';
import { MealSheet } from './MealSheet';
import { replaceMeal, useUpCount } from './planOps';
import { newSeed } from './StepInputs';

export function summaryText(plan: WeekPlan, used: { used: number; total: number }): { text: string; ok: boolean } {
  const off = plan.checks.filter(c => !c.onTarget).map(c => DAYS_SHORT[weekday(c.date)]);
  const rules = [...new Set([...plan.checks.flatMap(c => c.violations), ...plan.weekViolations])];
  const useUp = used.total ? ` · uses ${used.used === used.total ? 'all ' : ''}${used.used}${used.used === used.total ? '' : ` of ${used.total}`} “use it up” items` : '';
  if (!off.length && !rules.length) return { text: `On target all 7 days${useUp}`, ok: true };
  const parts = [off.length ? `Off target: ${off.join(', ')}` : '', ...rules].filter(Boolean);
  return { text: parts.join(' · ') + useUp, ok: false };
}

/** Step 2: the app's proposal, one day at a time. Swap, lock, or move anything. */
export function StepReview({ plan, isCurrent, onNext, onBack }: { plan: WeekPlan; isCurrent: boolean; onNext: () => void; onBack: () => void }) {
  const { lib, pantry, today, refresh } = useData();
  const dates = datesOfWeek(plan.weekStart);
  const [day, setDay] = useState(() => Math.max(0, isCurrent ? dates.indexOf(today) : 0));
  const [mealSheet, setMealSheet] = useState<string | null>(null);
  const [timeSheet, setTimeSheet] = useState<{ id: string; title: string; time: HHMM; kind: 'meal' | 'session' } | null>(null);
  const [busy, setBusy] = useState(false);
  const date = dates[day];
  const summary = summaryText(plan, useUpCount(plan, lib, pantry));
  const broken = new Set(brokenLeftovers(plan));

  const meals = sortMeals(plan.meals.filter(m => m.date === date));
  const sessions = plan.sessions.filter(s => s.date === date);
  const label = (m: PlannedMeal) => {
    const sameSlot = meals.filter(x => x.slot === m.slot);
    return sameSlot.length > 1 ? `${cap(m.slot)} ${sameSlot.indexOf(m) + 1}` : cap(m.slot);
  };

  async function save(next: WeekPlan) { await saveWeek(next); await refresh(); }
  const toggleLockMeal = (m: PlannedMeal) => save(replaceMeal(plan, { ...m, locked: !m.locked }));
  const toggleLockSession = (s: PlannedSession) => save({ ...plan, sessions: plan.sessions.map(x => (x.id === s.id ? { ...x, locked: !x.locked } : x)) });

  async function regenerate() {
    setBusy(true);
    await proposeWeek(plan.inputs, newSeed(), plan.meals.filter(m => m.locked), plan.sessions.filter(s => s.locked));
    await refresh();
    setBusy(false);
  }

  async function move(time: HHMM) {
    const t = timeSheet!;
    setTimeSheet(null);
    if (t.kind === 'meal') await save({ ...plan, meals: plan.meals.map(m => (m.id === t.id ? { ...m, time } : m)) });
    else await save({ ...plan, sessions: plan.sessions.map(s => (s.id === t.id ? { ...s, time } : s)) });
  }

  const mealForSheet = plan.meals.find(m => m.id === mealSheet);
  return (
    <>
      <div className={`summary-line${summary.ok ? '' : ' warn'}`} role="status">{summary.text}</div>
      <div className="list-row" style={{ background: 'var(--card)' }}>
        <button type="button" className="icon-btn" aria-label="Previous day" disabled={day === 0} onClick={() => setDay(day - 1)}>‹</button>
        <div className="grow" style={{ textAlign: 'center', fontWeight: 650 }}>{longDate(date)}</div>
        <button type="button" className="icon-btn" aria-label="Next day" disabled={day === 6} onClick={() => setDay(day + 1)}>›</button>
      </div>
      <div className="card">
        {[...meals.map(m => ({ t: m.time, m })), ...sessions.map(s => ({ t: s.time, s }))]
          .sort((a, b) => a.t.localeCompare(b.t))
          .map(row => {
            if ('m' in row && row.m) {
              const m = row.m;
              const l = label(m);
              const title = `${l}${m.guests ? ` (+${m.guests})` : ''}`;
              return (
                <div className="tl-row" role="group" aria-label={title} key={m.id}>
                  <button type="button" className="tl-time" aria-label={`Change time for ${l}`} onClick={() => setTimeSheet({ id: m.id, title, time: m.time, kind: 'meal' })}>{m.time}</button>
                  <div className="tl-main">
                    <div className="tl-title">{title}</div>
                    <div className="tl-sub">{mealSubtitle(m, plan, lib)}</div>
                    {broken.has(m.id) && <div className="tl-sub skipped">Leftover source changed — swap or re-plan</div>}
                  </div>
                  <button type="button" className="icon-btn" aria-label={`Swap ${l}`} onClick={() => setMealSheet(m.id)}>⇄</button>
                  <button type="button" className="icon-btn" aria-label={`Lock ${l}`} aria-pressed={m.locked} onClick={() => toggleLockMeal(m)}>{m.locked ? '🔒' : '🔓'}</button>
                </div>
              );
            }
            const s = (row as { s: PlannedSession }).s;
            const title = `${s.slot === 'morning' ? 'Exercise' : 'Stretch'} · ${sessionMinutes(s, lib)} min`;
            return (
              <div className="tl-row" role="group" aria-label={title} key={s.id}>
                <button type="button" className="tl-time" aria-label={`Change time for ${title}`} onClick={() => setTimeSheet({ id: s.id, title, time: s.time, kind: 'session' })}>{s.time}</button>
                <div className="tl-main">
                  <div className="tl-title">{title}</div>
                  <div className="tl-sub">{s.exercises.map(e => lib.exercises.get(e.exerciseId)?.name ?? e.exerciseId).join(', ')}</div>
                </div>
                <button type="button" className="icon-btn" aria-label={`Lock ${title}`} aria-pressed={s.locked} onClick={() => toggleLockSession(s)}>{s.locked ? '🔒' : '🔓'}</button>
              </div>
            );
          })}
      </div>
      <div className="muted" style={{ margin: '0 18px', fontSize: 13, color: 'var(--muted)' }}>⇄ swap or change guests · 🔒 keep when regenerating · tap a time to move it</div>
      <div style={{ display: 'flex', gap: 10, margin: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onBack}>Back</button>
        {!isCurrent && <button type="button" className="btn" disabled={busy} onClick={regenerate}>Regenerate unlocked</button>}
        <button type="button" className="btn primary" style={{ flex: 1 }} onClick={onNext}>{isCurrent ? 'Done' : 'Looks good →'}</button>
      </div>
      {mealForSheet && <MealSheet plan={plan} meal={mealForSheet} onClose={() => setMealSheet(null)} />}
      {timeSheet && <TimeSheet title={timeSheet.title} time={timeSheet.time} onClose={() => setTimeSheet(null)} onSave={move} />}
    </>
  );
}
