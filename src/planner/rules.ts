import type { DayCheck, ISODate, Library, Macro, MealSlot, Nutrition, PlannedMeal, Settings, WeekInputs } from '../domain/types';

const KCAL_PER_GRAM: Record<Macro, number> = { protein: 4, carbs: 4, fat: 9 };
const ZERO: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const tagLabel = (t: string) => cap(t.replace(/-/g, ' '));

export function dayTarget(date: ISODate, settings: Pick<Settings, 'baseKcal'>, inputs: WeekInputs): number {
  return settings.baseKcal + (inputs.higherBurn[date] ?? 0);
}

/** What you eat from this meal. */
export function mealNutrition(meal: PlannedMeal, lib: Library): Nutrition {
  const r = lib.recipes.get(meal.recipeId);
  if (meal.eatingOut || !r) return ZERO;
  const p = meal.portion;
  return { kcal: r.perServe.kcal * p, protein: r.perServe.protein * p, carbs: r.perServe.carbs * p, fat: r.perServe.fat * p };
}

function sum(ns: Nutrition[]): Nutrition {
  return ns.reduce((a, n) => ({ kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat }), ZERO);
}

function macroPct(n: Nutrition, m: Macro): number {
  return n.kcal > 0 ? (n[m] * KCAL_PER_GRAM[m] * 100) / n.kcal : 0;
}

function rangeMiss(label: string, value: number, min?: number, max?: number, unit = '%'): string | undefined {
  const v = Math.round(value);
  if (min !== undefined && value < min) return `${label} ${v}${unit} (min ${min}${unit})`;
  if (max !== undefined && value > max) return `${label} ${v}${unit} (max ${max}${unit})`;
  return undefined;
}

/** Target for the meals eaten at home: eating-out slots take their share away. */
export function homeTarget(target: number, meals: PlannedMeal[], shares: Record<MealSlot, number>): number {
  const away = meals.filter(m => m.eatingOut).reduce((a, m) => a + shares[m.slot], 0);
  return Math.round(target * (1 - away));
}

export function checkDay(date: ISODate, meals: PlannedMeal[], target: number, lib: Library): DayCheck {
  const { rules } = lib;
  const dayMeals = meals.filter(m => m.date === date);
  const home = dayMeals.filter(m => !m.eatingOut);
  const reduced = homeTarget(target, dayMeals, rules.slotShares);
  const total = sum(home.map(m => mealNutrition(m, lib)));
  const violations: string[] = [];

  for (const rule of rules.rules) {
    if (rule.kind === 'day-macro') {
      const miss = rangeMiss(cap(rule.macro), macroPct(total, rule.macro), rule.minPct, rule.maxPct);
      if (miss) violations.push(miss);
    } else if (rule.kind === 'meal-macro') {
      for (const m of home.filter(m => !rule.slot || m.slot === rule.slot)) {
        const miss = rangeMiss(`${cap(m.slot)} ${rule.macro}`, macroPct(mealNutrition(m, lib), rule.macro), rule.minPct, rule.maxPct);
        if (miss) violations.push(miss);
      }
    } else if (rule.kind === 'meal-tag-required') {
      for (const m of home.filter(m => m.slot === rule.slot)) {
        if (!lib.recipes.get(m.recipeId)?.tags.includes(rule.tag)) violations.push(`${cap(m.slot)} missing ${rule.tag}`);
      }
    }
  }

  const kcal = Math.round(total.kcal);
  const onTarget = reduced === 0 ? kcal === 0 : Math.abs(kcal - reduced) / reduced <= rules.kcalTolerancePct / 100;
  return { date, kcal, target: reduced, onTarget, violations };
}

export function checkWeek(meals: PlannedMeal[], lib: Library): string[] {
  const out: string[] = [];
  for (const rule of lib.rules.rules) {
    if (rule.kind !== 'week-tag-count') continue;
    const count = meals.filter(m => !m.eatingOut && lib.recipes.get(m.recipeId)?.tags.includes(rule.tag)).length;
    const miss = rangeMiss(tagLabel(rule.tag), count, rule.min, rule.max, '× this week');
    if (miss) out.push(miss.replace(/(\d+)× this week \((min|max) (\d+)× this week\)/, '$1× this week ($2 $3)'));
  }
  return out;
}

/** Lower is better. An off-target day always costs more than a single rule miss. */
export function penalty(checks: DayCheck[], weekViolations: string[]): number {
  let p = 20 * weekViolations.length;
  for (const c of checks) {
    const devPct = c.target > 0 ? (Math.abs(c.kcal - c.target) / c.target) * 100 : 0;
    p += c.onTarget ? 0.2 * devPct : 30 + devPct;
    p += 20 * c.violations.length;
  }
  return p;
}
