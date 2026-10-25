import { buildTimeline, currentItemId, sessionMinutes } from '../../src/timeline/timeline';
import { planWeek } from '../../src/planner/mealPlanner';
import { planSessions } from '../../src/planner/exercisePlanner';
import { buildShoppingTrips } from '../../src/shopping/shopping';
import { buildPrepReminders } from '../../src/shopping/prep';
import type { Completion, WeekPlan } from '../../src/domain/types';
import { FRI, MON, SETTINGS, TUE, WEEK, inputs, sampleLib } from '../fixtures';

const lib = sampleLib();
const inp = inputs({ guests: { [`${FRI}|dinner`]: 2 }, eatOut: [`${TUE}|dinner`] });
const r = planWeek({ lib, settings: SETTINGS, inputs: inp, pantry: [], recentRecipeIds: [], seed: 1 });
const plan: WeekPlan = { weekStart: WEEK, status: 'confirmed', inputs: inp, meals: r.meals, sessions: planSessions(lib, SETTINGS, WEEK), checks: r.checks, weekViolations: [], seed: 1 };
const trips = buildShoppingTrips(plan, lib, [], SETTINGS);
const preps = buildPrepReminders(plan, lib);
const tl = (date: string, rec?: 'red') => buildTimeline(date, plan, trips, preps, lib, rec);

test('items are sorted by time', () => {
  const items = tl(MON);
  for (let i = 1; i < items.length; i++) expect(items[i - 1].time <= items[i].time).toBe(true);
  expect(items.map(i => i.kind)).toContain('meal');
  expect(items.map(i => i.kind)).toContain('session');
});
test('only items for that date', () => {
  expect(tl(MON).every(i =>
    (i.kind === 'meal' && i.meal.date === MON) || (i.kind === 'session' && i.session.date === MON) ||
    (i.kind === 'shop' && i.trip.date === MON) || (i.kind === 'prep' && i.prep.date === MON))).toBe(true);
});
test('guest title and recipe subtitle', () => {
  const d = tl(FRI).find(i => i.kind === 'meal' && i.meal.slot === 'dinner')!;
  expect(d.title).toBe('Dinner (+2)');
  expect(d.subtitle).toBe(lib.recipes.get((d as { meal: { recipeId: string } }).meal.recipeId)!.name);
});
test('eating out subtitle', () => {
  expect(tl(TUE).find(i => i.kind === 'meal' && i.meal.slot === 'dinner')!.subtitle).toBe('Eating out');
});
test('leftover subtitle names the source day', () => {
  const left = plan.meals.find(m => m.leftoverOf)!;
  const src = plan.meals.find(m => m.id === left.leftoverOf)!;
  const item = tl(left.date).find(i => i.id === left.id)!;
  expect(item.subtitle).toMatch(new RegExp(` · leftover from ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(src.date + 'T00:00').getDay()]} dinner$`));
});
test('shop item appears before the dinner that needs it', () => {
  const top = trips.find(t => t.kind === 'top-up');
  if (!top) return;
  const items = tl(top.date);
  const shopIdx = items.findIndex(i => i.kind === 'shop');
  expect(items[shopIdx].title).toBe(`Shop · ${top.lines.length} items`);
  expect(items[shopIdx].subtitle).toBe(top.reason);
  const needed = items.findIndex(i => i.kind === 'meal' && i.meal.id === top.lines[0].neededBy.mealId);
  if (needed >= 0) expect(shopIdx).toBeLessThan(needed);
});
test('session titles and durations', () => {
  const morning = tl(MON).find(i => i.kind === 'session' && i.session.slot === 'morning')!;
  expect(morning.title).toMatch(/^Exercise · \d+ min$/);
  const evening = tl(MON).find(i => i.kind === 'session' && i.session.slot === 'evening');
  if (evening) expect(evening.title).toMatch(/^Stretch · \d+ min$/);
  // bridge 3×12 → 3×(48s+30s) = 234 s; chin tuck 2×10 → 2×(40+30) = 140 s; total 374 s → 10 min
  expect(sessionMinutes({ id: 's', date: MON, slot: 'morning', time: '07:30', locked: false,
    exercises: [{ exerciseId: 'bridge', sets: 3, reps: 12 }, { exerciseId: 'chin-tuck', sets: 2, reps: 10 }] }, lib)).toBe(10);
});
test('red recovery removes strength work and says so', () => {
  const s = tl(MON, 'red').find(i => i.kind === 'session' && i.session.slot === 'morning')!;
  expect(s.subtitle.endsWith(' · lighter today')).toBe(true);
  if (s.kind === 'session') expect(s.session.exercises.every(e => lib.exercises.get(e.exerciseId)!.type !== 'strength')).toBe(true);
});
test('ties: prep, shop, session, meal', () => {
  const items = buildTimeline(MON, { ...plan, meals: plan.meals.filter(m => m.date === MON).map(m => ({ ...m, time: '07:30' })) },
    [{ id: 't', date: MON, byTime: '07:30', kind: 'top-up', reason: 'x', lines: [{ ingredientId: 'eggs', name: 'Eggs', qty: 2, unit: 'each', display: '×2', neededBy: { date: MON, mealId: 'x' } }] }],
    [{ id: 'p', date: MON, time: '07:30', label: 'Defrost', forMealId: 'x', forText: 'for x' }], lib);
  const at730 = items.filter(i => i.time === '07:30').map(i => i.kind);
  expect(at730.slice(0, 3)).toEqual(['prep', 'shop', 'session']);
  expect(at730.slice(3).every(k => k === 'meal')).toBe(true);
});
test('currentItemId skips completed items and old ones', () => {
  const items = tl(MON);
  const done: Completion[] = [{ itemId: items[0].id, kind: 'meal', date: MON, status: 'done', at: '' }];
  expect(currentItemId(items, done, '00:00')).toBe(items[1].id);
  const later = items.find(i => i.time >= '12:00')!;
  expect(currentItemId(items, [], '12:15')).toBe(later.id);
  expect(currentItemId(items, [], '23:59')).toBe(items[0].id); // nothing ahead → first not done
});
