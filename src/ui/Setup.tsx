import { useState } from 'react';
import { requestPersistence, saveSettings } from '../db/repo';
import { nowTime } from '../domain/dates';
import type { MealSlot, SessionSlot, Settings } from '../domain/types';
import { Chip, Header } from './components';
import { useData } from './data';

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const TIME_LABELS: Record<MealSlot | SessionSlot, string> = {
  breakfast: 'Breakfast', morning: 'Morning exercise', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner', evening: 'Evening stretch',
};

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
}

export function TimesEditor({ times, onChange }: { times: Settings['times']; onChange: (t: Settings['times']) => void }) {
  return (
    <div className="card">
      {(Object.keys(TIME_LABELS) as (MealSlot | SessionSlot)[]).map(k => (
        <label className="field" key={k}>
          <span>{TIME_LABELS[k]}</span>
          <input type="time" value={times[k]} aria-label={`${TIME_LABELS[k]} time`}
            onChange={e => e.target.value && onChange({ ...times, [k]: e.target.value })} />
        </label>
      ))}
    </div>
  );
}

export function Setup() {
  const { settings, refresh, today } = useData();
  const [s, setS] = useState<Settings>(settings);
  const [kcalText, setKcalText] = useState(String(settings.baseKcal));
  const kcal = Number(kcalText);
  const kcalOk = Number.isFinite(kcal) && kcal >= 1000 && kcal <= 4000;

  async function start() {
    await requestPersistence();
    await saveSettings({ ...s, baseKcal: kcal, setupDone: true, setupAt: `${today}T${nowTime()}:00` });
    await refresh();
  }

  return (
    <div className="screen">
      <Header date="Welcome" title="Daily Plan" />
      <div className="section-title">Daily calorie target</div>
      <div className="card">
        <label className="field">
          <span>Calories per day</span>
          <input type="number" inputMode="numeric" min={1000} max={4000} step={50} value={kcalText} aria-label="Calories per day"
            onChange={e => setKcalText(e.target.value)} />
        </label>
      </div>
      {!kcalOk && <div className="banner red" role="alert">Enter a target between 1000 and 4000.</div>}
      <div className="section-title">Main shop day</div>
      <div className="card" style={{ padding: 12 }}>
        <div className="chips">
          {DAYS_SHORT.map((d, i) => <Chip key={d} on={s.shopDay === i} onClick={() => setS({ ...s, shopDay: i })}>{d}</Chip>)}
        </div>
      </div>
      <div className="section-title">Your usual times</div>
      <TimesEditor times={s.times} onChange={times => setS({ ...s, times })} />
      {!isStandalone() && (
        <>
          <div className="section-title">Add to Home Screen</div>
          <div className="card" style={{ padding: 14, fontSize: 15, lineHeight: 1.5 }}>
            Tap Share, then ‘Add to Home Screen’. Your data is only safe once the app is installed.
          </div>
        </>
      )}
      <button type="button" className="btn primary block" disabled={!kcalOk} onClick={start}>Start</button>
    </div>
  );
}
