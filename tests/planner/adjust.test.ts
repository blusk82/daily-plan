import { alternativesFor, brokenLeftovers, replanFrom } from '../../src/planner/adjust';
import { planWeek, type PlanContext } from '../../src/planner/mealPlanner';
import { checkDay } from '../../src/planner/rules';
import type { PlannedMeal, WeekPlan } from '../../src/domain/types';
import { SETTINGS, THU, TUE, inputs, sampleLib } from '../fixtures';

const lib = sampleLib();
const ctx: PlanContext = { lib, settings: SETTINGS, inputs: inputs(), pantry: [], recentRecipeIds: [], seed: 1 };
const r = planWeek(ctx);
const plan: WeekPlan = { weekStart: ctx.inputs.weekStart, status: 'proposal', inputs: ctx.inputs, meals: r.meals, sessions: [], checks: r.checks, weekViolations: r.weekViolations, seed: 1 };
const replace = (meals: PlannedMeal[], m: PlannedMeal) => meals.map(x => (x.id === m.id ? m : x));

test('alternatives keep the day on target, exclude the current recipe, and keep the id', () => {
  const dinnerTue = plan.meals.find(m => m.date === TUE && m.slot === 'dinner')!;
  const alts = alternativesFor(plan, dinnerTue.id, ctx);
  expect(alts.length).toBeGreaterThan(0);
  expect(alts.length).toBeLessThanOrEqual(8);
  for (const a of alts) {
    expect(a.recipeId).not.toBe(dinnerTue.recipeId);
    expect(a.id).toBe(dinnerTue.id);
    expect(lib.recipes.get(a.recipeId)!.slots).toContain('dinner');
    expect(checkDay(TUE, replace(plan.meals, a), 1800, lib).onTarget).toBe(true);
  }
});

test('alternatives never include hidden or retired recipes', () => {
  const dinnerTue = plan.meals.find(m => m.date === TUE && m.slot === 'dinner')!;
  const lib2 = { ...lib, recipes: new Map(lib.recipes) };
  lib2.recipes.set('d-steak-mash', { ...lib.recipes.get('d-steak-mash')!, retired: true });
  expect(alternativesFor(plan, dinnerTue.id, { ...ctx, lib: lib2 }).some(a => a.recipeId === 'd-steak-mash')).toBe(false);
});

function withSourceEatingOut(): { broken: WeekPlan; src: PlannedMeal } {
  const src = plan.meals.find(m => plan.meals.some(l => l.leftoverOf === m.id))!;
  return { src, broken: { ...plan, meals: plan.meals.map(m => (m.id === src.id ? { ...m, eatingOut: true, recipeId: '' } : m)) } };
}

test('eating out at a cooked dinner breaks its leftover lunch', () => {
  const { broken, src } = withSourceEatingOut();
  expect(brokenLeftovers(broken)).toEqual(plan.meals.filter(l => l.leftoverOf === src.id).map(l => l.id));
  expect(brokenLeftovers(plan)).toEqual([]);
});

test('swapping a source dinner to another recipe breaks its leftovers', () => {
  const src = plan.meals.find(m => plan.meals.some(l => l.leftoverOf === m.id))!;
  const swapped = { ...plan, meals: replace(plan.meals, { ...src, recipeId: 'd-steak-mash' }) };
  expect(brokenLeftovers(swapped).length).toBeGreaterThan(0);
});

test('replanFrom leaves earlier, locked and done meals untouched', () => {
  const thuBreakfast = plan.meals.find(m => m.date === THU && m.slot === 'breakfast')!;
  const lockedSat = { ...plan.meals.find(m => m.date === '2026-10-31' && m.slot === 'dinner')!, locked: true };
  const p = { ...plan, meals: replace(plan.meals, lockedSat) };
  const next = replanFrom(p, THU, new Set([thuBreakfast.id]), { ...ctx, seed: 99 });
  for (const m of p.meals.filter(m => m.date < THU || m.locked || m.id === thuBreakfast.id)) expect(next.meals).toContainEqual(m);
  expect(next.status).toBe(p.status);
  expect(next.checks.filter(c => c.date >= THU).every(c => c.onTarget)).toBe(true);
});

test('replanFrom repairs broken leftovers and keeps the eating out', () => {
  const { broken, src } = withSourceEatingOut();
  const fixed = replanFrom(broken, src.date, new Set(), ctx);
  expect(brokenLeftovers(fixed)).toEqual([]);
  expect(fixed.meals.find(m => m.id === src.id)!.eatingOut).toBe(true);
});
