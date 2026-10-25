import { planWeek, type PlanContext } from '../../src/planner/mealPlanner';
import { addDays, datesOfWeek } from '../../src/domain/dates';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import type { Library, WeekInputs } from '../../src/domain/types';
import { FRI, SETTINGS, THU, TUE, WED, WEEK, inputs, sampleLib } from '../fixtures';

const lib = sampleLib();
function ctx(over: Partial<Omit<PlanContext, 'inputs'>> & { inputs?: Partial<WeekInputs> } = {}): PlanContext {
  return { lib, settings: SETTINGS, pantry: [], recentRecipeIds: [], seed: 1, ...over, inputs: inputs(over.inputs) };
}

test('fills breakfast, lunch, dinner every day of the week', () => {
  const { meals } = planWeek(ctx());
  for (const d of datesOfWeek(WEEK)) for (const s of ['breakfast', 'lunch', 'dinner'] as const)
    expect(meals.filter(m => m.date === d && m.slot === s)).toHaveLength(1);
});
test('every day is on target with the sample pack, with no rule misses', () => {
  const r = planWeek(ctx());
  expect(r.checks.filter(c => !c.onTarget)).toEqual([]);
  expect(r.checks.flatMap(c => c.violations)).toEqual([]);
});
test('is deterministic for the same seed', () => expect(planWeek(ctx({ seed: 7 }))).toEqual(planWeek(ctx({ seed: 7 }))));
test('different seeds give different weeks', () =>
  expect(planWeek(ctx({ seed: 7 })).meals.map(m => m.recipeId)).not.toEqual(planWeek(ctx({ seed: 8 })).meals.map(m => m.recipeId)));
test('uses every use-up item at least once', () => {
  for (const id of ['pumpkin', 'tofu', 'feta']) {
    const { meals } = planWeek(ctx({ pantry: [{ ingredientId: id, useUp: true }] }));
    expect(meals.some(m => lib.recipes.get(m.recipeId)?.ingredients.some(i => i.ingredientId === id))).toBe(true);
  }
});
test('busy nights get quick dinners', () => {
  const { meals } = planWeek(ctx({ inputs: { busyDates: [TUE, WED] } }));
  for (const d of [TUE, WED]) {
    const m = meals.find(m => m.date === d && m.slot === 'dinner')!;
    expect(m.leftoverOf ? true : lib.recipes.get(m.recipeId)!.quick).toBe(true);
  }
});
test('meets week-tag-count fish ≥ 2', () => expect(planWeek(ctx()).weekViolations).toEqual([]));
test('no recipe is cooked twice within 7 days', () => {
  const cooked = planWeek(ctx()).meals.filter(m => !m.leftoverOf && !m.eatingOut && m.slot !== 'snack');
  expect(new Set(cooked.map(m => m.recipeId)).size).toBe(cooked.length);
});
test('recipes eaten in the previous week are avoided', () => {
  const first = planWeek(ctx());
  const recent = first.meals.filter(m => m.slot === 'dinner').map(m => ({ date: addDays(m.date, -7), recipeId: m.recipeId }));
  const dinners = planWeek(ctx({ recentRecipeIds: recent.slice(-4), seed: 3 })).meals.filter(m => m.slot === 'dinner' && m.date < '2026-10-29');
  for (const d of dinners) expect(recent.slice(-4).map(r => r.recipeId)).not.toContain(d.recipeId);
});
test('leftover lunches point at an earlier dinner of the same recipe within 2 days', () => {
  const { meals } = planWeek(ctx());
  const left = meals.filter(m => m.leftoverOf);
  expect(left.length).toBeGreaterThan(0);
  for (const l of left) {
    const src = meals.find(m => m.id === l.leftoverOf)!;
    expect(src.slot).toBe('dinner');
    expect(l.slot).toBe('lunch');
    expect(l.recipeId).toBe(src.recipeId);
    expect(l.date > src.date).toBe(true);
    expect(lib.recipes.get(src.recipeId)!.leftoverOk).toBe(true);
  }
});
test('leftover chain never exceeds the recipe serves', () => {
  const { meals } = planWeek(ctx({ inputs: { guests: { [`${FRI}|dinner`]: 2 } } }));
  for (const src of meals.filter(m => meals.some(l => l.leftoverOf === m.id))) {
    const chain = meals.filter(l => l.leftoverOf === src.id);
    const serves = src.portion + src.guests + chain.reduce((a, l) => a + l.portion, 0);
    expect(serves).toBeLessThanOrEqual(lib.recipes.get(src.recipeId)!.serves + 1e-9);
  }
});
test('guests do not change Ben’s portion range and are recorded', () => {
  const r = planWeek(ctx({ inputs: { guests: { [`${FRI}|dinner`]: 2 } } }));
  const m = r.meals.find(m => m.date === FRI && m.slot === 'dinner')!;
  expect(m.guests).toBe(2);
  expect(m.portion).toBeGreaterThanOrEqual(0.75);
  expect(m.portion).toBeLessThanOrEqual(1.5);
});
test('eat-out slot is marked and has no recipe', () => {
  const r = planWeek(ctx({ inputs: { eatOut: [`${THU}|dinner`] } }));
  const m = r.meals.find(m => m.date === THU && m.slot === 'dinner')!;
  expect(m.eatingOut).toBe(true);
  expect(m.recipeId).toBe('');
  expect(r.checks.find(c => c.date === THU)!.onTarget).toBe(true);
});
test('locked meals are kept exactly', () => {
  const first = planWeek(ctx());
  const breakfast = SAMPLE_PACK.recipes.find(r => r.slots.includes('breakfast'))!.id;
  const lockedMeal = { ...first.meals.find(m => m.slot === 'breakfast')!, locked: true, recipeId: breakfast, portion: 1 };
  expect(planWeek(ctx({ locked: [lockedMeal], seed: 5 })).meals).toContainEqual(lockedMeal);
});
test('higher-burn day gets more kcal and stays on target', () => {
  const r = planWeek(ctx({ inputs: { higherBurn: { [WED]: 300 } } }));
  const c = r.checks.find(c => c.date === WED)!;
  expect(c.target).toBe(2100);
  expect(c.onTarget).toBe(true);
});
test('times come from settings', () => {
  const { meals } = planWeek(ctx());
  expect(meals.find(m => m.slot === 'dinner')!.time).toBe('18:30');
  expect(meals.find(m => m.slot === 'breakfast')!.time).toBe('07:00');
});
test('hidden recipes are never chosen', () => {
  const hidden = buildLibrary(SAMPLE_PACK, { ...emptyOverlay(), hiddenRecipeIds: ['d-lemon-salmon', 'b-yoghurt-oats'] });
  const { meals } = planWeek(ctx({ lib: hidden }));
  expect(meals.some(m => m.recipeId === 'd-lemon-salmon' || m.recipeId === 'b-yoghurt-oats')).toBe(false);
});
test('runs in under 300 ms with the sample pack', () => {
  const t0 = performance.now(); planWeek(ctx()); expect(performance.now() - t0).toBeLessThan(300);
});
// Review Focus 2
test('impossible rules: still fills the week, finishes, and reports the miss', () => {
  const thin: Library = {
    ...lib,
    recipes: new Map([...lib.recipes].filter(([id]) => ['b-eggs-toast', 'l-chicken-wrap', 'd-steak-mash', 's-yoghurt'].includes(id))),
    rules: { ...lib.rules, rules: [{ kind: 'week-tag-count', tag: 'fish', min: 5 }] },
  };
  const t0 = performance.now();
  const r = planWeek(ctx({ lib: thin }));
  expect(performance.now() - t0).toBeLessThan(2000);
  expect(r.meals.filter(m => m.slot !== 'snack')).toHaveLength(21);
  expect(r.weekViolations).toEqual(['Fish 0× this week (min 5)']);
});
test('empty library: fills slots with nothing and does not throw', () => {
  const empty: Library = { ...lib, recipes: new Map() };
  const r = planWeek(ctx({ lib: empty }));
  expect(r.checks.every(c => !c.onTarget)).toBe(true);
});
