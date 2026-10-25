import { buildShoppingTrips, formatQty } from '../../src/shopping/shopping';
import type { PlannedMeal, Recipe, WeekPlan } from '../../src/domain/types';
import { FRI, MON, SETTINGS, THU, TUE, inputs, meal, sampleLib } from '../fixtures';

const lib = sampleLib();
const OILY: Recipe = { ...lib.recipes.get('d-steak-mash')!, id: 'oily', ingredients: [{ ingredientId: 'olive-oil', qty: 20 }, { ingredientId: 'steak', qty: 300 }] };
lib.recipes.set('oily', OILY);
const plan = (meals: PlannedMeal[]): WeekPlan => ({ weekStart: MON, status: 'confirmed', inputs: inputs(), meals, sessions: [], checks: [], weekViolations: [], seed: 1 });
const at = (m: PlannedMeal, time: string) => ({ ...m, time });
const lines = (trips: ReturnType<typeof buildShoppingTrips>) => trips.flatMap(t => t.lines);
const lineFor = (trips: ReturnType<typeof buildShoppingTrips>, id: string) => lines(trips).find(l => l.ingredientId === id)!;

const traybake = at(meal(MON, 'dinner', 'd-chicken-traybake', 1, { guests: 2 }), '18:30');
const leftover = at(meal(TUE, 'lunch', 'd-chicken-traybake', 1, { leftoverOf: traybake.id }), '12:30');

test('scales by total serves including guests and leftovers', () => {
  // serves 4, 800 g chicken; dinner 1 + guests 2 + leftover 1 = 4 serves → 800 g
  expect(lineFor(buildShoppingTrips(plan([traybake, leftover]), lib, [], SETTINGS), 'chicken-thigh-frozen').qty).toBe(800);
});
test('leftover meals add no ingredients of their own', () => {
  expect(lineFor(buildShoppingTrips(plan([traybake]), lib, [], SETTINGS), 'chicken-thigh-frozen').qty).toBe(600); // 3 serves
});
test('eating-out meals add nothing', () => {
  expect(lines(buildShoppingTrips(plan([meal(MON, 'dinner', '', 0, { eatingOut: true })]), lib, [], SETTINGS))).toEqual([]);
});
test('staples never appear (ingredient flag or settings)', () => {
  const trips = buildShoppingTrips(plan([at(meal(MON, 'dinner', 'oily'), '18:30')]), lib, [], SETTINGS);
  expect(lines(trips).some(l => l.ingredientId === 'olive-oil')).toBe(false);
  const t2 = buildShoppingTrips(plan([at(meal(MON, 'dinner', 'oily'), '18:30')]), lib, [], { ...SETTINGS, stapleIds: ['steak'] });
  expect(lines(t2)).toEqual([]);
});
test('pantry quantity is subtracted; item without qty covers the first need', () => {
  const trips = buildShoppingTrips(plan([traybake, leftover]), lib,
    [{ ingredientId: 'pumpkin', qty: 500, useUp: true }, { ingredientId: 'onion', useUp: false }], SETTINGS);
  expect(lineFor(trips, 'pumpkin').qty).toBe(100);
  expect(lineFor(trips, 'onion')).toBeUndefined();
});
test('main shop is the Sunday before a Monday week, by 17:00', () => {
  expect(buildShoppingTrips(plan([traybake]), lib, [], SETTINGS).find(t => t.kind === 'main'))
    .toMatchObject({ id: '2026-10-25:main', date: '2026-10-25', byTime: '17:00', reason: 'Main shop' });
});
test('main shop on the Saturday inside the week when that is the shop day', () => {
  const sat = { ...meal('2026-10-31', 'dinner', 'd-bolognese'), time: '18:30' };
  expect(buildShoppingTrips(plan([sat]), lib, [], { ...SETTINGS, shopDay: 6 }).find(t => t.kind === 'main')!.date).toBe('2026-10-31');
});
test('salmon (keeps 2 days) for Friday dinner gets a Friday top-up by 17:00', () => {
  const trips = buildShoppingTrips(plan([at(meal(FRI, 'dinner', 'd-lemon-salmon', 1, { guests: 1 }), '18:30')]), lib, [], SETTINGS);
  const top = trips.find(t => t.kind === 'top-up')!;
  expect(top).toMatchObject({ id: `${FRI}:top-up`, date: FRI, byTime: '17:00', reason: "needed for tonight's dinner" });
  expect(top.lines.map(l => l.ingredientId)).toEqual(['salmon']);
  expect(trips.find(t => t.kind === 'main')!.lines.map(l => l.ingredientId).sort()).toEqual(['broccoli', 'lemon', 'rice']);
});
test('top-up before 10:00 moves to the previous evening', () => {
  const trips = buildShoppingTrips(plan([at(meal(FRI, 'breakfast', 'b-yoghurt-oats'), '07:00')]), lib, [], SETTINGS);
  expect(trips.find(t => t.kind === 'top-up')).toMatchObject({ date: THU, byTime: '17:00', reason: 'needed for Friday breakfast' });
});
test('same ingredient for two meals in one trip is merged', () => {
  const trips = buildShoppingTrips(plan([at(meal(MON, 'breakfast', 'b-yoghurt-oats'), '07:00'), at(meal(TUE, 'breakfast', 'b-yoghurt-oats'), '07:00')]), lib, [], SETTINGS);
  const y = lines(trips).filter(l => l.ingredientId === 'greek-yoghurt');
  expect(y).toHaveLength(1);
  expect(y[0].qty).toBe(400);
  expect(y[0].neededBy.date).toBe(MON);
});
test('formatQty rounds up to something you can buy', () => {
  expect(formatQty(1500, 'g')).toBe('1.5 kg');
  expect(formatQty(3, 'each')).toBe('×3');
  expect(formatQty(1.5, 'each')).toBe('×2');
  expect(formatQty(250, 'ml')).toBe('250 ml');
  expect(formatQty(243, 'g')).toBe('250 g');
  expect(formatQty(1250, 'ml')).toBe('1.3 L');
});
