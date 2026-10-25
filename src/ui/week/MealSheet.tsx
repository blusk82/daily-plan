import { useState } from 'react';
import { getLibrary, getOverlay, saveOverlay, saveWeek } from '../../db/repo';
import { longDate } from '../../domain/dates';
import type { PlannedMeal, WeekPlan } from '../../domain/types';
import { alternativesFor } from '../../planner/adjust';
import { Sheet, Stepper, cap } from '../components';
import { useData } from '../data';
import { planCtx, recheck, replaceMeal, setEatingOut, setGuests } from './planOps';

/** Swap, guests, eating out, and "don't suggest again" for one meal. */
export function MealSheet({ plan, meal, onClose }: { plan: WeekPlan; meal: PlannedMeal; onClose: () => void }) {
  const { lib, settings, pantry, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const ctx = planCtx(plan, lib, settings, pantry);
  const alts = meal.eatingOut ? [] : alternativesFor(plan, meal.id, ctx);
  const current = lib.recipes.get(meal.recipeId);

  async function save(next: WeekPlan, close = true) {
    setBusy(true);
    await saveWeek(recheck(next, lib, settings));
    await refresh();
    setBusy(false);
    if (close) onClose();
  }

  async function hide() {
    if (!current) return;
    setBusy(true);
    const overlay = await getOverlay();
    await saveOverlay({ ...overlay, hiddenRecipeIds: [...new Set([...overlay.hiddenRecipeIds, current.id])] });
    const lib2 = await getLibrary();
    const alt = alternativesFor(plan, meal.id, { ...ctx, lib: lib2 })[0];
    await saveWeek(recheck(alt ? replaceMeal(plan, alt) : plan, lib2, settings));
    await refresh();
    onClose();
  }

  return (
    <Sheet title={`${cap(meal.slot)} · ${longDate(meal.date)}`} onClose={onClose}>
      <div className="muted">{meal.eatingOut ? 'Eating out' : current?.name ?? 'Recipe no longer in library'}</div>
      {meal.slot !== 'snack' && (
        <div className="card" style={{ margin: '14px 0' }}>
          <div className="field">
            <span>Guests</span>
            <Stepper label="guests" value={meal.guests} min={0} max={8} onChange={n => save(setGuests(plan, meal, n), false)} />
          </div>
          <div className="field">
            <span>Eating out</span>
            <button type="button" className="chip" aria-pressed={!!meal.eatingOut} disabled={busy}
              onClick={() => save(setEatingOut(plan, meal, !meal.eatingOut, ctx), false)}>Eating out</button>
          </div>
        </div>
      )}
      {current && !meal.eatingOut && (
        <button type="button" className="linkbtn" disabled={busy} onClick={hide}>Don't suggest again</button>
      )}
      {!meal.eatingOut && (
        <>
          <div className="sheet-label">Swap for</div>
          {alts.length === 0 && <div className="muted">No other recipe keeps this day on target.</div>}
          <div className="card" style={{ margin: 0 }}>
            {alts.map(a => {
              const r = lib.recipes.get(a.recipeId)!;
              return (
                <button key={a.recipeId} type="button" className="list-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }}
                  aria-label={`Use ${r.name}`} disabled={busy} onClick={() => save(replaceMeal(plan, a))}>
                  <span className="grow">{r.name}<div className="tl-sub">{Math.round(r.perServe.kcal * a.portion)} kcal · {r.prepMins} min{r.quick ? ' · quick' : ''}</div></span>
                  <span aria-hidden="true">⇄</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Sheet>
  );
}
