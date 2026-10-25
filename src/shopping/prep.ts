import { addDays, addMinutes, dayName, toMinutes } from '../domain/dates';
import type { HHMM, ISODate, Library, WeekPlan } from '../domain/types';
import { isCooked } from './shopping';

export interface PrepReminder { id: string; date: ISODate; time: HHMM; label: string; forMealId: string; forText: string }

const EARLIEST = '07:00';
const LATEST = '21:00';

/** Defrost, soak, marinate: placed on the timeline in waking hours, never later than needed. */
export function buildPrepReminders(plan: WeekPlan, lib: Library): PrepReminder[] {
  const out: PrepReminder[] = [];
  for (const m of plan.meals.filter(isCooked)) {
    const r = lib.recipes.get(m.recipeId);
    r?.prepSteps.forEach((step, n) => {
      let { date, time } = addMinutes(m.date, m.time, -step.leadHours * 60);
      if (toMinutes(time) < toMinutes(EARLIEST)) { date = addDays(date, -1); time = LATEST; }
      else if (toMinutes(time) > toMinutes(LATEST)) time = LATEST;
      out.push({ id: `${m.id}:prep:${n}`, date, time, label: step.label, forMealId: m.id, forText: `for ${dayName(m.date)} ${m.slot}` });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.time) - toMinutes(b.time));
}
