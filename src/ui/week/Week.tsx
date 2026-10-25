import { useState } from 'react';
import { saveWeek } from '../../db/repo';
import { addDays, planningWeekStart, shortDate } from '../../domain/dates';
import type { ISODate, WeekPlan, WeekStatus } from '../../domain/types';
import { brokenLeftovers, replanFrom } from '../../planner/adjust';
import { Header } from '../components';
import { useData } from '../data';
import { planCtx } from './planOps';
import { StepConfirm } from './StepConfirm';
import { StepInputs } from './StepInputs';
import { StepReview } from './StepReview';

type Mode = { step: 'overview' } | { step: 'inputs' | 'review' | 'confirm'; weekStart: ISODate };

const STATUS: Record<WeekStatus, string> = { proposal: 'Proposal', confirmed: 'Confirmed', default: 'Default' };

function Badge({ plan }: { plan?: WeekPlan }) {
  return <span className={`pill${plan?.status === 'confirmed' ? ' green' : ''}`}>{plan ? STATUS[plan.status] : 'Not planned'}</span>;
}

const range = (ws: ISODate) => `${shortDate(ws)} – ${shortDate(addDays(ws, 6))}`;

export function Week() {
  const data = useData();
  const { week, nextWeek, today, completions, lib, settings, pantry, refresh } = data;
  const [mode, setMode] = useState<Mode>({ step: 'overview' });
  const [busy, setBusy] = useState(false);
  const next = planningWeekStart(today);
  const planFor = (ws: ISODate) => (ws === week?.weekStart ? week : ws === nextWeek?.weekStart ? nextWeek : undefined);
  const broken = week ? brokenLeftovers(week) : [];

  async function replanRest() {
    if (!week) return;
    setBusy(true);
    const done = new Set(completions.filter(c => c.kind === 'meal' && c.status === 'done').map(c => c.itemId));
    await saveWeek(replanFrom(week, today, done, planCtx(week, lib, settings, pantry)));
    await refresh();
    setBusy(false);
  }

  if (mode.step !== 'overview') {
    const plan = planFor(mode.weekStart);
    const back = () => setMode({ step: 'overview' });
    const titles = { inputs: 'Anything different?', review: 'Review', confirm: 'Confirm' };
    return (
      <>
        <Header date={range(mode.weekStart)} title={titles[mode.step]} />
        {mode.step === 'inputs' && (
          <StepInputs weekStart={mode.weekStart} existing={plan} onBack={back} onMade={() => setMode({ step: 'review', weekStart: mode.weekStart })} />
        )}
        {mode.step === 'review' && plan && (
          <StepReview plan={plan} isCurrent={plan.weekStart === week?.weekStart}
            onBack={() => (plan.weekStart === week?.weekStart ? back() : setMode({ step: 'inputs', weekStart: mode.weekStart }))}
            onNext={() => (plan.weekStart === week?.weekStart ? back() : setMode({ step: 'confirm', weekStart: mode.weekStart }))} />
        )}
        {mode.step === 'confirm' && plan && (
          <StepConfirm plan={plan} onBack={() => setMode({ step: 'review', weekStart: mode.weekStart })} onDone={back} />
        )}
      </>
    );
  }

  return (
    <>
      <Header date="Plan" title="Week" />
      <div className="section-title">Next week · {range(next)}</div>
      <div className="card">
        <div className="list-row"><span className="grow">Status</span><Badge plan={nextWeek} /></div>
        <div className="list-row" style={{ gap: 8 }}>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => setMode({ step: 'inputs', weekStart: next })}>Plan next week</button>
          {nextWeek && <button type="button" className="btn" onClick={() => setMode({ step: 'review', weekStart: next })}>Review</button>}
        </div>
      </div>
      {week && (
        <>
          <div className="section-title">This week · {range(week.weekStart)}</div>
          <div className="card">
            <div className="list-row"><span className="grow">Status</span><Badge plan={week} /></div>
            {broken.length > 0 && <div className="list-row" style={{ color: 'var(--red)' }}>A leftover meal lost its source — re-plan?</div>}
            <div className="list-row" style={{ gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setMode({ step: 'review', weekStart: week.weekStart })}>Review this week</button>
              <button type="button" className={`btn${broken.length ? ' primary' : ''}`} disabled={busy} onClick={replanRest}>Re-plan rest of week</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
