import { daysBetween, datesOfWeek } from '../domain/dates';
import { makeRng } from '../domain/random';
import {
  MAIN_SLOTS, slotKey,
  type DayCheck, type ISODate, type Library, type MealSlot, type PantryItem, type PlannedMeal, type Recipe, type Settings, type WeekInputs,
} from '../domain/types';
import { checkDay, checkWeek, dayTarget, homeTarget, penalty } from './rules';

export interface PlanContext {
  lib: Library; settings: Settings; inputs: WeekInputs; pantry: PantryItem[];
  /** Meals eaten shortly before this week, for variety. */
  recentRecipeIds: { date: ISODate; recipeId: string }[];
  /** Kept exactly as given. */
  locked?: PlannedMeal[];
  seed: number;
}

export interface PlanResult { meals: PlannedMeal[]; checks: DayCheck[]; weekViolations: string[] }

// A choice for one main slot: cook a recipe, or eat leftovers from an earlier dinner.
type Choice = { cook: string } | { leftoverFrom: ISODate };
interface Variable { date: ISODate; slot: MealSlot; options: Choice[] }

const ITERATIONS = 1500;
const W = { variety: 15, busy: 10, unusedUseUp: 25, leftoverBonus: 4, overServed: 60, brokenLeftover: 100 };

const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

export const mealId = (date: ISODate, slot: MealSlot, n = 0) => (slot === 'snack' ? `${date}-snack-${n}` : `${date}-${slot}`);

export function sortMeals(meals: PlannedMeal[]): PlannedMeal[] {
  return [...meals].sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || a.id.localeCompare(b.id));
}

export function planWeek(ctx: PlanContext): PlanResult {
  const { lib, settings, inputs } = ctx;
  const rng = makeRng(ctx.seed);
  const dates = datesOfWeek(inputs.weekStart);
  const locked = ctx.locked ?? [];
  const lockedKeys = new Set(locked.map(m => (m.slot === 'snack' ? `${m.date}|snack` : slotKey(m.date, m.slot))));
  const eatOut = new Set(inputs.eatOut);
  const usable = [...lib.recipes.values()].filter(r => !r.retired && !lib.hiddenRecipeIds.has(r.id));
  const bySlot = (slot: MealSlot) => usable.filter(r => r.slots.includes(slot));
  const snacks = bySlot('snack');
  const useUpIds = ctx.pantry.filter(p => p.useUp).map(p => p.ingredientId);
  const lockedById = new Map(locked.map(m => [m.id, m]));

  // Fixed meals: locked ones as given, eating-out slots as placeholders.
  const fixed: PlannedMeal[] = [...locked];
  for (const date of dates) for (const slot of MAIN_SLOTS) {
    const key = slotKey(date, slot);
    if (!lockedKeys.has(key) && eatOut.has(key)) {
      fixed.push({ id: mealId(date, slot), date, slot, time: settings.times[slot], recipeId: '', portion: 0,
        guests: inputs.guests[key] ?? 0, locked: false, eatingOut: true });
    }
  }

  // Variables: every main slot that isn't fixed.
  const vars: Variable[] = [];
  for (const date of dates) for (const slot of MAIN_SLOTS) {
    const key = slotKey(date, slot);
    if (lockedKeys.has(key) || eatOut.has(key)) continue;
    const options: Choice[] = bySlot(slot).map(r => ({ cook: r.id }));
    if (slot === 'lunch') for (const back of [1, 2]) {
      const src = dates[dates.indexOf(date) - back];
      if (src) options.push({ leftoverFrom: src });
    }
    if (options.length) vars.push({ date, slot, options });
  }

  const recipeOf = (id: string): Recipe | undefined => lib.recipes.get(id);
  const targetOf = (date: ISODate) => dayTarget(date, settings, inputs);

  // --- Building a concrete week from choices -------------------------------
  const dayCache = new Map<string, PlannedMeal[]>();

  function fitDay(date: ISODate, mains: { slot: MealSlot; recipeId: string; leftoverOf?: string }[]): PlannedMeal[] {
    const dayFixed = fixed.filter(m => m.date === date);
    const key = `${date}|${mains.map(m => `${m.slot}:${m.recipeId}:${m.leftoverOf ?? ''}`).join(',')}`;
    const hit = dayCache.get(key);
    if (hit) return hit;

    const target = homeTarget(targetOf(date), dayFixed, lib.rules.slotShares);
    const fixedKcal = dayFixed.filter(m => !m.eatingOut)
      .reduce((a, m) => a + (recipeOf(m.recipeId)?.perServe.kcal ?? 0) * m.portion, 0);
    const baseKcal = mains.reduce((a, m) => a + (recipeOf(m.recipeId)?.perServe.kcal ?? 0), 0);
    const lockedSnack = dayFixed.some(m => m.slot === 'snack');

    // Rotate snack order by day so the week isn't all the same snack.
    const rot = dates.indexOf(date) % Math.max(1, snacks.length);
    const snackOrder = [...snacks.slice(rot), ...snacks.slice(0, rot)];
    const combos: Recipe[][] = [[]];
    if (!lockedSnack) {
      for (let a = 0; a < snackOrder.length && lib.rules.maxSnacksPerDay >= 1; a++) {
        combos.push([snackOrder[a]]);
        if (lib.rules.maxSnacksPerDay >= 2) for (let b = a + 1; b < snackOrder.length; b++) combos.push([snackOrder[a], snackOrder[b]]);
      }
    }

    let best: PlannedMeal[] = [];
    let bestScore = Infinity;
    for (const combo of combos) {
      const snackKcal = combo.reduce((a, r) => a + r.perServe.kcal, 0);
      const raw = baseKcal > 0 ? (target - fixedKcal - snackKcal) / baseKcal : 1;
      const k = Math.round(Math.min(lib.rules.portionMax, Math.max(lib.rules.portionMin, raw)) * 20) / 20;
      const meals: PlannedMeal[] = [
        ...mains.map(m => ({
          id: mealId(date, m.slot), date, slot: m.slot, time: settings.times[m.slot], recipeId: m.recipeId, portion: k,
          guests: inputs.guests[slotKey(date, m.slot)] ?? 0, locked: false, ...(m.leftoverOf ? { leftoverOf: m.leftoverOf } : {}),
        })),
        ...combo.map((r, n) => ({
          id: mealId(date, 'snack', n), date, slot: 'snack' as const, time: settings.times.snack, recipeId: r.id, portion: 1,
          guests: 0, locked: false,
        })),
      ];
      const score = penalty([checkDay(date, [...dayFixed, ...meals], targetOf(date), lib)], []);
      if (score < bestScore - 1e-9) { bestScore = score; best = meals; }
    }
    dayCache.set(key, best);
    return best;
  }

  function build(assign: Choice[]): PlannedMeal[] {
    const mainsByDate = new Map<ISODate, { slot: MealSlot; recipeId: string; leftoverOf?: string }[]>();
    for (const date of dates) mainsByDate.set(date, []);
    // Dinners first so leftovers can find their source.
    const dinnerRecipe = new Map<ISODate, string>();
    for (const m of fixed) if (m.slot === 'dinner' && !m.eatingOut) dinnerRecipe.set(m.date, m.recipeId);
    vars.forEach((v, i) => { const c = assign[i]; if (v.slot === 'dinner' && 'cook' in c) dinnerRecipe.set(v.date, c.cook); });
    vars.forEach((v, i) => {
      const c = assign[i];
      if ('cook' in c) mainsByDate.get(v.date)!.push({ slot: v.slot, recipeId: c.cook });
      else {
        const lockedDinner = locked.find(m => m.date === c.leftoverFrom && m.slot === 'dinner');
        mainsByDate.get(v.date)!.push({
          slot: v.slot, recipeId: dinnerRecipe.get(c.leftoverFrom) ?? '',
          leftoverOf: lockedDinner?.id ?? mealId(c.leftoverFrom, 'dinner'),
        });
      }
    });
    const meals = [...fixed];
    for (const date of dates) meals.push(...fitDay(date, mainsByDate.get(date)!));
    return meals;
  }

  function evaluate(assign: Choice[]): { score: number; meals: PlannedMeal[]; checks: DayCheck[]; weekViolations: string[] } {
    const meals = build(assign);
    const checks = dates.map(d => checkDay(d, meals, targetOf(d), lib));
    const weekViolations = checkWeek(meals, lib);
    let score = penalty(checks, weekViolations);

    const byId = new Map(meals.map(m => [m.id, m]));
    const cooked = meals.filter(m => !m.eatingOut && !m.leftoverOf && m.slot !== 'snack' && m.recipeId);
    // Variety: the same recipe cooked twice within the window.
    const window = lib.rules.varietyWindowDays;
    for (let a = 0; a < cooked.length; a++) {
      for (let b = a + 1; b < cooked.length; b++) {
        if (cooked[a].recipeId === cooked[b].recipeId && Math.abs(daysBetween(cooked[a].date, cooked[b].date)) < window) score += W.variety;
      }
      for (const r of ctx.recentRecipeIds) {
        if (r.recipeId === cooked[a].recipeId && Math.abs(daysBetween(r.date, cooked[a].date)) < window) score += W.variety;
      }
    }
    for (const m of meals) {
      if (m.slot === 'dinner' && !m.eatingOut && !m.leftoverOf && inputs.busyDates.includes(m.date) && !recipeOf(m.recipeId)?.quick) score += W.busy;
      if (m.leftoverOf) {
        const src = byId.get(m.leftoverOf) ?? lockedById.get(m.leftoverOf);
        if (!src || src.eatingOut || !recipeOf(src.recipeId)?.leftoverOk) score += W.brokenLeftover;
        else score -= W.leftoverBonus;
      }
    }
    // A cooked meal must stretch to everyone eating it, leftovers included.
    for (const src of cooked) {
      const chain = meals.filter(l => l.leftoverOf === src.id);
      if (!chain.length) continue;
      const serves = src.portion + src.guests + chain.reduce((a, l) => a + l.portion + l.guests, 0);
      if (serves > (recipeOf(src.recipeId)?.serves ?? 0) + 1e-9) score += W.overServed;
    }
    for (const id of useUpIds) {
      if (!cooked.some(m => recipeOf(m.recipeId)?.ingredients.some(i => i.ingredientId === id))) score += W.unusedUseUp;
    }
    return { score, meals, checks, weekViolations };
  }

  // --- Greedy start, then local search --------------------------------------
  const assign: Choice[] = vars.map(v => {
    const target = targetOf(v.date) * lib.rules.slotShares[v.slot];
    let best = v.options[0];
    let bestScore = Infinity;
    for (const o of v.options) {
      if (!('cook' in o)) continue;
      const r = recipeOf(o.cook)!;
      let s = Math.abs(r.perServe.kcal - target) / target + rng() * 0.6;
      if (useUpIds.some(id => r.ingredients.some(i => i.ingredientId === id))) s -= 0.3;
      if (v.slot === 'dinner' && inputs.busyDates.includes(v.date) && !r.quick) s += 1;
      if (s < bestScore) { bestScore = s; best = o; }
    }
    return best;
  });

  let current = evaluate(assign);
  for (let it = 0; it < ITERATIONS && vars.length; it++) {
    const vi = Math.floor(rng() * vars.length);
    const options = vars[vi].options;
    const next = options[Math.floor(rng() * options.length)];
    const prev = assign[vi];
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    assign[vi] = next;
    const cand = evaluate(assign);
    if (cand.score < current.score - 1e-9) current = cand;
    else assign[vi] = prev;
  }

  return { meals: sortMeals(current.meals), checks: current.checks, weekViolations: current.weekViolations };
}
