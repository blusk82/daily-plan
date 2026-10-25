import type { ISODate, PlannedMeal, WeekPlan } from '../domain/types';
import { planWeek, sortMeals, type PlanContext } from './mealPlanner';
import { checkDay, dayTarget, homeTarget, penalty } from './rules';

/** Other recipes that could replace this meal and keep its day on target, best first. */
export function alternativesFor(plan: WeekPlan, mealId: string, ctx: PlanContext, max = 8): PlannedMeal[] {
  const { lib } = ctx;
  const meal = plan.meals.find(m => m.id === mealId);
  if (!meal) return [];
  const day = plan.meals.filter(m => m.date === meal.date);
  const others = day.filter(m => m.id !== mealId);
  const target = dayTarget(meal.date, ctx.settings, plan.inputs);
  const home = homeTarget(target, day, lib.rules.slotShares);
  const othersKcal = others.filter(m => !m.eatingOut).reduce((a, m) => a + (lib.recipes.get(m.recipeId)?.perServe.kcal ?? 0) * m.portion, 0);

  const scored: { meal: PlannedMeal; score: number }[] = [];
  for (const r of lib.recipes.values()) {
    if (r.retired || lib.hiddenRecipeIds.has(r.id) || r.id === meal.recipeId || !r.slots.includes(meal.slot) || r.perServe.kcal <= 0) continue;
    const raw = (home - othersKcal) / r.perServe.kcal;
    const portion = Math.round(Math.min(lib.rules.portionMax, Math.max(lib.rules.portionMin, raw)) * 20) / 20;
    const candidate: PlannedMeal = { ...meal, recipeId: r.id, portion };
    delete candidate.eatingOut;
    delete candidate.leftoverOf;
    const check = checkDay(meal.date, [...others, candidate], target, lib);
    if (!check.onTarget) continue;
    scored.push({ meal: candidate, score: penalty([check], []) });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map(s => s.meal);
}

/** Leftover meals whose cooked source is gone, eaten out, or now a different recipe. */
export function brokenLeftovers(plan: WeekPlan): string[] {
  const byId = new Map(plan.meals.map(m => [m.id, m]));
  return plan.meals
    .filter(m => m.leftoverOf)
    .filter(m => {
      const src = byId.get(m.leftoverOf!);
      return !src || src.eatingOut || src.recipeId !== m.recipeId;
    })
    .map(m => m.id);
}

/**
 * Re-plan the rest of the week from `fromDate`. Earlier meals, locked meals,
 * meals already ticked off, and eating-out decisions stay exactly as they are.
 */
export function replanFrom(plan: WeekPlan, fromDate: ISODate, doneMealIds: Set<string>, ctx: PlanContext): WeekPlan {
  const keep = plan.meals.filter(m => m.date < fromDate || m.locked || doneMealIds.has(m.id) || m.eatingOut);
  const r = planWeek({ ...ctx, inputs: plan.inputs, locked: keep });
  return { ...plan, meals: sortMeals(r.meals), checks: r.checks, weekViolations: r.weekViolations };
}
