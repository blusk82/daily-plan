import { useEffect, useState } from 'react';
import { lastInputs, proposeWeek } from '../../db/repo';
import { datesOfWeek, weekday } from '../../domain/dates';
import { slotKey, type ISODate, type MealSlot, type WeekInputs, type WeekPlan } from '../../domain/types';
import { Chip, cap } from '../components';
import { useData } from '../data';
import { DAYS_SHORT } from '../Setup';

const dayShort = (d: ISODate) => DAYS_SHORT[weekday(d)];
export const newSeed = () => 1 + Math.floor(Math.random() * 1_000_000_000);

function GuestRows({ slot, dates, draft, set }: { slot: MealSlot; dates: ISODate[]; draft: WeekInputs; set: (d: WeekInputs) => void }) {
  const toggle = (date: ISODate, n: number) => {
    const key = slotKey(date, slot);
    const guests = { ...draft.guests };
    if (guests[key] === n) delete guests[key]; else guests[key] = n;
    set({ ...draft, guests });
  };
  return (
    <div className="card" role="group" aria-label={`Guests at ${slot}`}>
      {dates.map(d => (
        <div className="list-row" key={d}>
          <span style={{ width: 40, fontWeight: 600 }}>{dayShort(d)}</span>
          <div className="chips">
            {[1, 2, 3].map(n => (
              <Chip key={n} label={`${dayShort(d)} +${n}`} on={draft.guests[slotKey(d, slot)] === n} onClick={() => toggle(d, n)}>+{n}</Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Step 1: only what's different this week. Most weeks: just tap through. */
export function StepInputs({ weekStart, existing, onMade, onBack }: { weekStart: ISODate; existing?: WeekPlan; onMade: () => void; onBack: () => void }) {
  const { settings, pantry, lib, refresh } = useData();
  const dates = datesOfWeek(weekStart);
  const [draft, setDraft] = useState<WeekInputs | null>(existing && existing.status !== 'default' ? existing.inputs : null);
  const [moreMeals, setMoreMeals] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (draft) return;
    void lastInputs().then(last => setDraft({
      weekStart, guests: {}, eatOut: [], higherBurn: {},
      busyDates: dates.filter(d => last.busyWeekdays.includes(weekday(d))),
      shopDay: last.shopDay ?? settings.shopDay,
    }));
  }, [draft, weekStart, dates, settings.shopDay]);

  if (!draft) return <div className="empty" role="status">Loading…</div>;
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const useUp = pantry.filter(p => p.useUp);

  async function make() {
    setBusy(true);
    const locked = existing?.status === 'proposal' ? existing.meals.filter(m => m.locked) : [];
    const lockedSessions = existing?.status === 'proposal' ? existing.sessions.filter(s => s.locked) : [];
    await proposeWeek(draft!, newSeed(), locked, lockedSessions);
    await refresh();
    onMade();
  }

  return (
    <>
      <div className="section-title">Guests at dinner</div>
      <GuestRows slot="dinner" dates={dates} draft={draft} set={setDraft} />
      <button type="button" className="linkbtn" style={{ marginLeft: 18 }} onClick={() => setMoreMeals(!moreMeals)}>
        {moreMeals ? 'Fewer meals' : 'Guests at other meals'}
      </button>
      {moreMeals && (['breakfast', 'lunch'] as MealSlot[]).map(s => (
        <div key={s}><div className="section-title">Guests at {s}</div><GuestRows slot={s} dates={dates} draft={draft} set={setDraft} /></div>
      ))}

      <div className="section-title">Busy nights (quick meals)</div>
      <div className="card" style={{ padding: 12 }} role="group" aria-label="Busy nights">
        <div className="chips">
          {dates.map(d => <Chip key={d} on={draft.busyDates.includes(d)} onClick={() => setDraft({ ...draft, busyDates: toggleIn(draft.busyDates, d) })}>{dayShort(d)}</Chip>)}
        </div>
      </div>

      <div className="section-title">Eating out</div>
      <div className="card" role="group" aria-label="Eating out">
        {dates.map(d => (
          <div className="list-row" key={d}>
            <span style={{ width: 40, fontWeight: 600 }}>{dayShort(d)}</span>
            <div className="chips">
              {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map(s => (
                <Chip key={s} label={`Eat out ${dayShort(d)} ${s}`} on={draft.eatOut.includes(slotKey(d, s))}
                  onClick={() => setDraft({ ...draft, eatOut: toggleIn(draft.eatOut, slotKey(d, s)) })}>{cap(s)}</Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Higher-burn days</div>
      <div className="card" role="group" aria-label="Higher-burn days">
        <div className="chips" style={{ padding: 12 }}>
          {dates.map(d => (
            <Chip key={d} on={d in draft.higherBurn} onClick={() => {
              const hb = { ...draft.higherBurn };
              if (d in hb) delete hb[d]; else hb[d] = settings.higherBurnKcal;
              setDraft({ ...draft, higherBurn: hb });
            }}>{dayShort(d)}</Chip>
          ))}
        </div>
        {Object.keys(draft.higherBurn).sort().map(d => (
          <label className="field" key={d}>
            <span>{dayShort(d)} extra kcal</span>
            <input type="number" inputMode="numeric" step={50} min={0} max={2000} aria-label={`Extra kcal ${dayShort(d)}`} value={draft.higherBurn[d]}
              onChange={e => setDraft({ ...draft, higherBurn: { ...draft.higherBurn, [d]: Number(e.target.value) || 0 } })} />
          </label>
        ))}
      </div>

      <div className="section-title">Use it up</div>
      <div className="card">
        {useUp.length === 0 && <div className="list-row muted">Nothing marked “use it up”. Add items in Pantry.</div>}
        {useUp.map(p => <div className="list-row" key={p.ingredientId}>{lib.ingredients.get(p.ingredientId)?.name ?? p.ingredientId}{p.qty ? ` · ${p.qty}` : ''}</div>)}
      </div>

      <div className="section-title">Main shop day</div>
      <div className="card" style={{ padding: 12 }} role="group" aria-label="Main shop day">
        <div className="chips">
          {DAYS_SHORT.map((d, i) => <Chip key={d} on={draft.shopDay === i} onClick={() => setDraft({ ...draft, shopDay: i })}>{d}</Chip>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: 14 }}>
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={make}>Make my week →</button>
      </div>
    </>
  );
}
