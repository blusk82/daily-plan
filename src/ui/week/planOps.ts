import { datesOfWeek } from '../../domain/dates';
import { slotKey, type Library, type PantryItem, type PlannedMeal, type Settings, type WeekPlan } from '../../domain/types';
import { alternativesFor } from '../../planner/adjust';
import type { PlanContext } from '../../planner/mealPlanner';
import { checkDay, checkWeek, dayTarget } from '../../planner/rules';

export function planCtx(plan: WeekPlan, lib: Library, settings: Settings, pantry: PantryItem[]): PlanContext {
  return { lib, settings, inputs: plan.inputs, pantry, recentRecipeIds: [], seed: plan.seed };
}

/** Re-run the day and week checks after a hand edit. */
export function recheck(plan: WeekPlan, lib: Library, settings: Settings): WeekPlan {
  const checks = datesOfWeek(plan.weekStart).map(d => checkDay(d, plan.meals, dayTarget(d, settings, plan.inputs), lib));
  return { ...plan, checks, weekViolations: checkWeek(plan.meals, lib) };
}

export function replaceMeal(plan: WeekPlan, meal: PlannedMeal): WeekPlan {
  return { ...plan, meals: plan.meals.map(m => (m.id === meal.id ? meal : m)) };
}

export function setEatingOut(plan: WeekPlan, meal: PlannedMeal, on: boolean, ctx: PlanContext): WeekPlan {
  const key = slotKey(meal.date, meal.slot);
  const eatOut = on ? [...new Set([...plan.inputs.eatOut, key])] : plan.inputs.eatOut.filter(k => k !== key);
  const withInputs = { ...plan, inputs: { ...plan.inputs, eatOut } };
  if (on) return replaceMeal(withInputs, { ...meal, eatingOut: true, recipeId: '', portion: 0, leftoverOf: undefined });
  const back: PlannedMeal = { ...meal, eatingOut: false };
  const alt = alternativesFor(replaceMeal(withInputs, back), meal.id, { ...ctx, inputs: withInputs.inputs })[0];
  return replaceMeal(withInputs, alt ?? back);
}

export function setGuests(plan: WeekPlan, meal: PlannedMeal, guests: number): WeekPlan {
  const key = slotKey(meal.date, meal.slot);
  const g = { ...plan.inputs.guests };
  if (guests) g[key] = guests; else delete g[key];
  return replaceMeal({ ...plan, inputs: { ...plan.inputs, guests: g } }, { ...meal, guests });
}

/** Meals whose recipe uses one of the "use it up" items. */
export function useUpCount(plan: WeekPlan, lib: Library, pantry: PantryItem[]): { used: number; total: number } {
  const ids = pantry.filter(p => p.useUp).map(p => p.ingredientId);
  const used = ids.filter(id => plan.meals.some(m => !m.eatingOut && !m.leftoverOf && lib.recipes.get(m.recipeId)?.ingredients.some(i => i.ingredientId === id)));
  return { used: used.length, total: ids.length };
}
