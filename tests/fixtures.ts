import type { Library, PlannedMeal, Recipe, Settings, WeekInputs, MealSlot } from '../src/domain/types';
import { SAMPLE_PACK } from '../src/library/sample-pack';
import { buildLibrary, emptyOverlay } from '../src/library/merge';

export const WEEK = '2026-10-26'; // Monday
export const MON = '2026-10-26', TUE = '2026-10-27', WED = '2026-10-28', THU = '2026-10-29', FRI = '2026-10-30', SAT = '2026-10-31', SUN = '2026-11-01';

/** A recipe of exactly 100 kcal per serve, 30% protein, for arithmetic tests. */
export const UNIT: Recipe = {
  id: 'unit', name: 'Unit', slots: ['breakfast', 'lunch', 'dinner', 'snack'], serves: 1,
  perServe: { kcal: 100, protein: 7.5, carbs: 10, fat: 3.3 }, prepMins: 5, quick: true, leftoverOk: false,
  ingredients: [], prepSteps: [], method: [], tags: ['veg'], source: 'sample',
};
export const LOW_PROTEIN: Recipe = { ...UNIT, id: 'lowp', perServe: { kcal: 100, protein: 4.5, carbs: 18, fat: 2 } };
export const FISHY: Recipe = { ...UNIT, id: 'fishy', tags: ['veg', 'fish'] };
export const NO_VEG: Recipe = { ...UNIT, id: 'noveg', tags: [] };

export function sampleLib(): Library {
  return buildLibrary(SAMPLE_PACK, emptyOverlay());
}

export function testLib(): Library {
  const lib = sampleLib();
  for (const r of [UNIT, LOW_PROTEIN, FISHY, NO_VEG]) lib.recipes.set(r.id, r);
  return lib;
}

let seq = 0;
export function meal(date: string, slot: MealSlot, recipeId: string, portion = 1, extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return { id: `m${++seq}`, date, slot, time: '12:00', recipeId, portion, guests: 0, locked: false, ...extra };
}

/** Breakfast/lunch/dinner of the UNIT recipe totalling `kcal`. */
export function mealsTotalling(kcal: number, date = MON, recipeId = 'unit'): PlannedMeal[] {
  const each = kcal / 300;
  return [meal(date, 'breakfast', recipeId, each), meal(date, 'lunch', recipeId, each), meal(date, 'dinner', recipeId, each)];
}

export function eatOutDinner(date = MON): PlannedMeal {
  return meal(date, 'dinner', '', 0, { eatingOut: true });
}

export const SETTINGS: Settings = {
  times: { breakfast: '07:00', lunch: '12:30', snack: '15:00', dinner: '18:30', morning: '07:30', evening: '20:00' },
  baseKcal: 1800, higherBurnKcal: 300, shopDay: 0, stapleIds: [], setupDone: true,
};

export function inputs(over: Partial<WeekInputs> = {}): WeekInputs {
  return { weekStart: WEEK, guests: {}, busyDates: [], eatOut: [], higherBurn: {}, shopDay: 0, ...over };
}
