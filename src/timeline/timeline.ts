import { dayName, fromMinutes, toMinutes } from '../domain/dates';
import type { Completion, HHMM, ISODate, Library, PlannedMeal, PlannedSession, Recovery, WeekPlan } from '../domain/types';
import { lightVersion } from '../planner/exercisePlanner';
import type { PrepReminder } from '../shopping/prep';
import type { ShopTrip } from '../shopping/shopping';

export type TimelineItem =
  | { kind: 'meal'; id: string; time: HHMM; meal: PlannedMeal; title: string; subtitle: string }
  | { kind: 'session'; id: string; time: HHMM; session: PlannedSession; title: string; subtitle: string }
  | { kind: 'shop'; id: string; time: HHMM; trip: ShopTrip; title: string; subtitle: string }
  | { kind: 'prep'; id: string; time: HHMM; prep: PrepReminder; title: string; subtitle: string };

const TIE_ORDER: Record<TimelineItem['kind'], number> = { prep: 0, shop: 1, session: 2, meal: 3 };
const SECS_PER_REP = 4;
const REST_PER_SET = 30;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function sessionMinutes(s: PlannedSession, lib: Library): number {
  let secs = 0;
  for (const e of s.exercises) {
    const sides = lib.exercises.get(e.exerciseId)?.perSide ? 2 : 1;
    const work = e.holdSecs ? e.holdSecs * sides : (e.reps ?? 10) * SECS_PER_REP * sides;
    secs += (e.sets ?? 1) * (work + REST_PER_SET);
  }
  return Math.max(5, Math.ceil(secs / 300) * 5);
}

export function recipeName(lib: Library, id: string): string {
  return lib.recipes.get(id)?.name ?? 'Recipe no longer in library';
}

export function mealSubtitle(m: PlannedMeal, plan: WeekPlan, lib: Library): string {
  if (m.eatingOut) return 'Eating out';
  const name = recipeName(lib, m.recipeId);
  if (!m.leftoverOf) return name;
  const src = plan.meals.find(s => s.id === m.leftoverOf);
  return src ? `${name} · leftover from ${dayName(src.date)} dinner` : `${name} · leftovers`;
}

export function buildTimeline(
  date: ISODate, plan: WeekPlan, trips: ShopTrip[], preps: PrepReminder[], lib: Library, recovery?: Recovery,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const m of plan.meals.filter(m => m.date === date)) {
    items.push({ kind: 'meal', id: m.id, time: m.time, meal: m,
      title: `${cap(m.slot)}${m.guests ? ` (+${m.guests})` : ''}`, subtitle: mealSubtitle(m, plan, lib) });
  }
  for (const s0 of plan.sessions.filter(s => s.date === date)) {
    const s = recovery === 'red' ? lightVersion(s0, lib) : s0;
    if (!s.exercises.length) continue;
    const names = s.exercises.map(e => lib.exercises.get(e.exerciseId)?.name ?? e.exerciseId).join(', ');
    items.push({ kind: 'session', id: s.id, time: s.time, session: s,
      title: `${s.slot === 'morning' ? 'Exercise' : 'Stretch'} · ${sessionMinutes(s, lib)} min`,
      subtitle: recovery === 'red' ? `${names} · lighter today` : names });
  }
  for (const t of trips.filter(t => t.date === date && t.lines.length)) {
    items.push({ kind: 'shop', id: t.id, time: t.byTime, trip: t, title: `Shop · ${t.lines.length} items`, subtitle: t.reason });
  }
  for (const p of preps.filter(p => p.date === date)) {
    items.push({ kind: 'prep', id: p.id, time: p.time, prep: p, title: p.label, subtitle: p.forText });
  }
  return items.sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || TIE_ORDER[a.kind] - TIE_ORDER[b.kind]);
}

/** The item to highlight: the next thing not yet ticked either way. */
export function currentItemId(items: TimelineItem[], completions: Completion[], nowTime: HHMM): string | undefined {
  const ticked = new Set(completions.map(c => c.itemId));
  const open = items.filter(i => !ticked.has(i.id));
  const from = fromMinutes(Math.max(0, toMinutes(nowTime) - 30));
  return (open.find(i => toMinutes(i.time) >= toMinutes(from)) ?? open[0])?.id;
}
