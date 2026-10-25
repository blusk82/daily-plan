import { addDays, addMinutes, dayName, daysBetween, toMinutes, weekday } from '../domain/dates';
import type { HHMM, ISODate, Library, PantryItem, PlannedMeal, Settings, Unit, WeekPlan } from '../domain/types';

export interface ShopLine { ingredientId: string; name: string; qty: number; unit: Unit; display: string; neededBy: { date: ISODate; mealId: string } }
export interface ShopTrip { id: string; date: ISODate; byTime: HHMM; kind: 'main' | 'top-up'; reason: string; lines: ShopLine[] }

const MAIN_SHOP_TIME = '17:00';
const TOP_UP_LEAD_MINS = 90;
const EARLIEST_SHOP = '10:00';

/** Is this a meal that gets cooked (not leftovers, not eaten out)? */
export const isCooked = (m: PlannedMeal) => !m.eatingOut && !m.leftoverOf && !!m.recipeId;

/** Serves to cook for this meal: Ben, guests, and every leftover meal it feeds (with its guests). */
export function servesCooked(meal: PlannedMeal, meals: PlannedMeal[]): number {
  return meal.portion + meal.guests + meals.filter(l => l.leftoverOf === meal.id).reduce((a, l) => a + l.portion + l.guests, 0);
}

/** Ingredient quantities for cooking one meal, in base units. */
export function mealIngredients(meal: PlannedMeal, meals: PlannedMeal[], lib: Library): { ingredientId: string; qty: number }[] {
  const r = lib.recipes.get(meal.recipeId);
  if (!r || !isCooked(meal)) return [];
  const factor = servesCooked(meal, meals) / r.serves;
  return r.ingredients.map(i => ({ ingredientId: i.ingredientId, qty: i.qty * factor }));
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** What to put on the list: rounded up to something you can buy. */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'each') return `×${Math.ceil(qty - 1e-9)}`;
  const rounded = Math.ceil(qty / 10 - 1e-9) * 10;
  if (rounded >= 1000) return `${trim(rounded / 1000)} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${rounded} ${unit}`;
}

/**
 * The main shop: the first shop day from the planning Sunday (the day before
 * the week) onwards, so it is never in the past when the week is planned.
 * Meals before it get their own top-up trips.
 */
export function mainShopDate(weekStart: ISODate, shopDay: number): ISODate {
  const sunday = addDays(weekStart, -1);
  return addDays(sunday, (shopDay - weekday(sunday) + 7) % 7);
}

function reasonFor(tripDate: ISODate, m: PlannedMeal): string {
  if (tripDate === m.date) return m.slot === 'dinner' ? "needed for tonight's dinner" : `needed for today's ${m.slot}`;
  return `needed for ${dayName(m.date)} ${m.slot}`;
}

export function buildShoppingTrips(plan: WeekPlan, lib: Library, pantry: PantryItem[], settings: Settings): ShopTrip[] {
  const staples = new Set(settings.stapleIds);
  const cooked = plan.meals.filter(isCooked).sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.time) - toMinutes(b.time));

  // Pantry is used up in date order.
  const left = new Map<string, number>(pantry.map(p => [p.ingredientId, p.qty ?? Infinity]));
  const needs: { meal: PlannedMeal; ingredientId: string; qty: number }[] = [];
  for (const m of cooked) {
    for (const { ingredientId, qty } of mealIngredients(m, plan.meals, lib)) {
      const ing = lib.ingredients.get(ingredientId);
      if (!ing || ing.staple || staples.has(ingredientId)) continue;
      const have = left.get(ingredientId) ?? 0;
      if (have === Infinity) { left.set(ingredientId, 0); continue; } // no amount given: covers this need
      const take = Math.min(have, qty);
      if (take > 0) left.set(ingredientId, have - take);
      if (qty - take > 1e-9) needs.push({ meal: m, ingredientId, qty: qty - take });
    }
  }

  const mainDate = mainShopDate(plan.weekStart, settings.shopDay);
  const trips = new Map<string, ShopTrip>();
  const tripFor = (date: ISODate, kind: ShopTrip['kind'], byTime: HHMM, reason: string): ShopTrip => {
    const id = `${date}:${kind}`;
    let t = trips.get(id);
    if (!t) { t = { id, date, byTime, kind, reason, lines: [] }; trips.set(id, t); }
    else if (toMinutes(byTime) < toMinutes(t.byTime)) { t.byTime = byTime; t.reason = reason; }
    return t;
  };

  for (const n of needs) {
    const ing = lib.ingredients.get(n.ingredientId)!;
    let trip: ShopTrip;
    const gap = daysBetween(mainDate, n.meal.date);
    const beforeMain = gap < 0 || (gap === 0 && toMinutes(n.meal.time) < toMinutes(MAIN_SHOP_TIME));
    if (!beforeMain && ing.keepsDays >= gap) {
      trip = tripFor(mainDate, 'main', MAIN_SHOP_TIME, 'Main shop');
    } else {
      const by = addMinutes(n.meal.date, n.meal.time, -TOP_UP_LEAD_MINS);
      const early = by.date !== n.meal.date || toMinutes(by.time) < toMinutes(EARLIEST_SHOP);
      const date = early ? addDays(n.meal.date, -1) : n.meal.date;
      const time = early ? MAIN_SHOP_TIME : by.time;
      trip = tripFor(date, 'top-up', time, reasonFor(date, n.meal));
    }
    const line = trip.lines.find(l => l.ingredientId === n.ingredientId);
    if (line) line.qty += n.qty;
    else trip.lines.push({ ingredientId: n.ingredientId, name: ing.name, qty: n.qty, unit: ing.unit, display: '', neededBy: { date: n.meal.date, mealId: n.meal.id } });
  }

  const out = [...trips.values()];
  for (const t of out) for (const l of t.lines) {
    l.qty = Math.round(l.qty * 1000) / 1000;
    l.display = formatQty(l.qty, l.unit);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.byTime) - toMinutes(b.byTime));
}

/** Trips from different weeks can fall on the same day: show them as one. */
export function mergeTrips(trips: ShopTrip[]): ShopTrip[] {
  const byId = new Map<string, ShopTrip>();
  for (const t of trips) {
    const seen = byId.get(t.id);
    if (!seen) { byId.set(t.id, { ...t, lines: t.lines.map(l => ({ ...l, neededBy: { ...l.neededBy } })) }); continue; }
    if (toMinutes(t.byTime) < toMinutes(seen.byTime)) { seen.byTime = t.byTime; seen.reason = t.reason; }
    for (const l of t.lines) {
      const same = seen.lines.find(x => x.ingredientId === l.ingredientId);
      if (!same) { seen.lines.push({ ...l, neededBy: { ...l.neededBy } }); continue; }
      same.qty = Math.round((same.qty + l.qty) * 1000) / 1000;
      if (l.neededBy.date < same.neededBy.date) same.neededBy = { ...l.neededBy };
    }
  }
  const out = [...byId.values()];
  for (const t of out) for (const l of t.lines) l.display = formatQty(l.qty, l.unit);
  return out.sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.byTime) - toMinutes(b.byTime));
}
