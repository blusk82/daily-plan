// Regression tests for the final review's findings.
import { resetDb } from '../../src/db/db';
import { clearCompletion, ensureWeek, getLibrary, getOverlay, getPantry, getSettings, saveOverlay, savePantryItem, saveWeek, setCompletion, completionsBetween } from '../../src/db/repo';
import { exportBackup, importPack } from '../../src/backup/backup';
import { buildShoppingTrips, mergeTrips, servesCooked, type ShopTrip } from '../../src/shopping/shopping';
import { planWeek } from '../../src/planner/mealPlanner';
import { mealNutrition } from '../../src/planner/rules';
import { alternativesFor } from '../../src/planner/adjust';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import type { PlannedMeal, WeekPlan } from '../../src/domain/types';
import { MON, SETTINGS, TUE, inputs, meal } from '../fixtures';

beforeEach(async () => { await resetDb(); });
const plan = (meals: PlannedMeal[], weekStart = MON): WeekPlan =>
  ({ weekStart, status: 'confirmed', inputs: inputs({ weekStart }), meals, sessions: [], checks: [], weekViolations: [], seed: 1 });

// Important 1
test('main shop falls on or after the planning Sunday, never in the past (shop day Sat)', () => {
  const lib = buildLibrary(SAMPLE_PACK, emptyOverlay());
  const meals = [{ ...meal('2026-11-03', 'dinner', 'd-bolognese'), time: '18:30' }, { ...meal('2026-11-07', 'dinner', 'd-bolognese'), time: '18:30' }];
  for (const shopDay of [0, 1, 2, 3, 4, 5, 6]) {
    const trips = buildShoppingTrips(plan(meals, '2026-11-02'), lib, [], { ...SETTINGS, shopDay });
    for (const t of trips) expect(t.date >= '2026-11-01').toBe(true);
  }
  const sat = buildShoppingTrips(plan(meals, '2026-11-02'), lib, [], { ...SETTINGS, shopDay: 6 });
  expect(sat.find(t => t.kind === 'main')!.date).toBe('2026-11-07');
  // The Tuesday meal comes before Saturday's shop, so it needs its own trip.
  expect(sat.some(t => t.kind === 'top-up' && t.date <= '2026-11-03')).toBe(true);
});

// Important 2
test('first real import over the sample pack keeps recipes the current plan uses', async () => {
  const w = await ensureWeek(MON, 1);
  const renamed = { ...structuredClone(SAMPLE_PACK), isSample: false, label: 'Real',
    recipes: SAMPLE_PACK.recipes.map(r => ({ ...r, id: `real-${r.id}` })) };
  expect((await importPack(JSON.stringify(renamed))).ok).toBe(true);
  const lib = await getLibrary();
  for (const m of w.meals.filter(m => m.recipeId)) expect(lib.recipes.get(m.recipeId)?.retired).toBe(true);
});

// Important 3
test('hiding a recipe keeps planned meals intact but stops it being suggested', async () => {
  await saveOverlay({ ...(await getOverlay()), hiddenRecipeIds: ['d-steak-mash'] });
  const lib = await getLibrary();
  const m = meal(MON, 'dinner', 'd-steak-mash');
  expect(mealNutrition(m, lib).kcal).toBeGreaterThan(0);
  expect(lib.hiddenRecipeIds.has('d-steak-mash')).toBe(true);
  const r = planWeek({ lib, settings: SETTINGS, inputs: inputs(), pantry: [], recentRecipeIds: [], seed: 1 });
  expect(r.meals.some(x => x.recipeId === 'd-steak-mash')).toBe(false);
  const p = plan([meal(MON, 'dinner', 'd-lemon-salmon')]);
  expect(alternativesFor(p, p.meals[0].id, { lib, settings: SETTINGS, inputs: p.inputs, pantry: [], recentRecipeIds: [], seed: 1 })
    .some(a => a.recipeId === 'd-steak-mash')).toBe(false);
});

// Important 4
test('undoing ticks out of order restores exactly what each used', async () => {
  // Two soups each use 400 g pumpkin (portion 1.6 of a 4-serve, 1000 g recipe).
  await saveWeek(plan([meal(MON, 'lunch', 'l-pumpkin-soup', 1.6, { id: 'a' }), meal(TUE, 'lunch', 'l-pumpkin-soup', 1.6, { id: 'b' })]));
  await savePantryItem({ ingredientId: 'pumpkin', qty: 1000, useUp: true });
  await setCompletion({ itemId: 'a', kind: 'meal', date: MON, status: 'done', at: '' });
  await setCompletion({ itemId: 'b', kind: 'meal', date: TUE, status: 'done', at: '' });
  expect((await getPantry())[0].qty).toBe(200);
  await clearCompletion('a', MON);
  expect((await getPantry())[0].qty).toBe(600);
  await clearCompletion('b', TUE);
  expect((await getPantry())[0].qty).toBe(1000);
});

test('undo when the item was used up entirely brings back the amount taken', async () => {
  await saveWeek(plan([meal(MON, 'lunch', 'l-pumpkin-soup', 1.6, { id: 'a' }), meal(TUE, 'lunch', 'l-pumpkin-soup', 1.6, { id: 'b' })]));
  await savePantryItem({ ingredientId: 'pumpkin', qty: 500, useUp: true });
  await setCompletion({ itemId: 'a', kind: 'meal', date: MON, status: 'done', at: '' }); // 100 left
  await setCompletion({ itemId: 'b', kind: 'meal', date: TUE, status: 'done', at: '' }); // gone (took 100)
  expect(await getPantry()).toEqual([]);
  await clearCompletion('a', MON);
  expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', qty: 400, useUp: true }]);
  await clearCompletion('b', TUE);
  expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', qty: 500, useUp: true }]);
});

// Important 5 (repo side): the repo no longer invents exercise ticks from the stored session.
test('ticking a session in the repo records only the session', async () => {
  await saveWeek({ ...plan([]), sessions: [{ id: 's', date: MON, slot: 'morning', time: '07:30', locked: false, exercises: [{ exerciseId: 'bridge' }] }] });
  await setCompletion({ itemId: 's', kind: 'session', date: MON, status: 'done', at: '' });
  expect((await completionsBetween(MON, MON)).map(c => c.itemId)).toEqual(['s']);
});

// Important 6
test('guests at a leftover meal count towards what is cooked', () => {
  const src = meal(MON, 'dinner', 'd-chicken-traybake', 1, { id: 'src' });
  const left = meal(TUE, 'lunch', 'd-chicken-traybake', 1, { leftoverOf: 'src', guests: 2 });
  expect(servesCooked(src, [src, left])).toBe(4);
});

test('planner keeps leftover chains within serves when the leftover meal has guests', () => {
  const lib = buildLibrary(SAMPLE_PACK, emptyOverlay());
  const guests = Object.fromEntries(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map(d => [`${d}|lunch`, 2]));
  const r = planWeek({ lib, settings: SETTINGS, inputs: inputs({ guests }), pantry: [], recentRecipeIds: [], seed: 1 });
  for (const s of r.meals.filter(m => r.meals.some(l => l.leftoverOf === m.id))) {
    expect(servesCooked(s, r.meals)).toBeLessThanOrEqual(lib.recipes.get(s.recipeId)!.serves + 1e-9);
  }
});

// Important 7 (export side)
test('exporting does not mark a backup as done; the file itself carries the timestamp', async () => {
  const { json } = await exportBackup();
  expect((await getSettings()).lastBackupAt).toBeUndefined();
  const kv = JSON.parse(json).kv as { key: string; value: { lastBackupAt?: string } }[];
  expect(kv.find(k => k.key === 'settings')?.value.lastBackupAt).toBeDefined();
});

// Promoted minor: two trips on the same day share an id
test('mergeTrips joins trips with the same id and sums shared lines', () => {
  const line = (id: string, qty: number) => ({ ingredientId: id, name: id, qty, unit: 'g' as const, display: '', neededBy: { date: '2026-11-01', mealId: 'x' } });
  const a: ShopTrip = { id: '2026-11-01:top-up', date: '2026-11-01', byTime: '17:00', kind: 'top-up', reason: 'r1', lines: [line('salmon', 200)] };
  const b: ShopTrip = { id: '2026-11-01:top-up', date: '2026-11-01', byTime: '16:00', kind: 'top-up', reason: 'r2', lines: [line('salmon', 100), line('berries', 50)] };
  const merged = mergeTrips([a, b]);
  expect(merged).toHaveLength(1);
  expect(merged[0].byTime).toBe('16:00');
  expect(merged[0].lines.map(l => [l.ingredientId, l.qty])).toEqual([['salmon', 300], ['berries', 50]]);
  expect(merged[0].lines[0].display).toBe('300 g');
});
