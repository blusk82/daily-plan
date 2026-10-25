import { addDays, datesOfWeek, weekday } from '../domain/dates';
import type {
  Completion, ISODate, Library, LibraryPack, PantryItem, PlannedMeal, PlannedSession, Recovery, Settings, UserOverlay, WeekInputs, WeekPlan,
} from '../domain/types';
import { buildLibrary, emptyOverlay } from '../library/merge';
import { SAMPLE_PACK } from '../library/sample-pack';
import { planSessions } from '../planner/exercisePlanner';
import { planWeek } from '../planner/mealPlanner';
import { mealIngredients } from '../shopping/shopping';
import { db } from './db';

export const DEFAULT_SETTINGS: Settings = {
  times: { breakfast: '07:00', lunch: '12:30', snack: '15:00', dinner: '18:30', morning: '07:30', evening: '20:00' },
  baseKcal: 1800, higherBurnKcal: 300, shopDay: 0, stapleIds: [], setupDone: false,
};

async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
async function putKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

// --- Settings, library ------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const s = await getKV<Settings>('settings');
  return s ? { ...DEFAULT_SETTINGS, ...s, times: { ...DEFAULT_SETTINGS.times, ...s.times } } : DEFAULT_SETTINGS;
}
export async function saveSettings(s: Settings): Promise<void> { await putKV('settings', s); }

export async function getPack(): Promise<LibraryPack> { return (await getKV<LibraryPack>('pack')) ?? SAMPLE_PACK; }
export async function getStoredPack(): Promise<LibraryPack | undefined> { return getKV<LibraryPack>('pack'); }
export async function savePack(p: LibraryPack): Promise<void> { await putKV('pack', p); }
export async function getOverlay(): Promise<UserOverlay> { return { ...emptyOverlay(), ...(await getKV<UserOverlay>('overlay')) }; }
export async function saveOverlay(o: UserOverlay): Promise<void> { await putKV('overlay', o); }
export async function getLibrary(): Promise<Library> { return buildLibrary(await getPack(), await getOverlay()); }

// --- Weeks --------------------------------------------------------------------

export async function saveWeek(p: WeekPlan): Promise<void> { await db.weeks.put(p); }
export async function getWeek(weekStart: ISODate): Promise<WeekPlan | undefined> { return db.weeks.get(weekStart); }
export async function allWeeks(): Promise<WeekPlan[]> { return db.weeks.toArray(); }

/** A stable per-week seed, so the default plan doesn't change on every launch. */
const seedFor = (weekStart: ISODate) => [...weekStart].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

async function recentFor(weekStart: ISODate, windowDays: number): Promise<{ date: ISODate; recipeId: string }[]> {
  const prev = await getWeek(addDays(weekStart, -7));
  const from = addDays(weekStart, -windowDays);
  return (prev?.meals ?? []).filter(m => m.date >= from && m.recipeId && !m.leftoverOf).map(m => ({ date: m.date, recipeId: m.recipeId }));
}

async function generate(inputs: WeekInputs, seed: number, status: WeekPlan['status'], locked: PlannedMeal[] = [], lockedSessions: PlannedSession[] = []): Promise<WeekPlan> {
  const [lib, settings, pantry] = await Promise.all([getLibrary(), getSettings(), getPantry()]);
  const r = planWeek({ lib, settings, inputs, pantry, recentRecipeIds: await recentFor(inputs.weekStart, lib.rules.varietyWindowDays), locked, seed });
  const plan: WeekPlan = {
    weekStart: inputs.weekStart, status, inputs, meals: r.meals, checks: r.checks, weekViolations: r.weekViolations, seed,
    sessions: planSessions(lib, settings, inputs.weekStart, lockedSessions),
  };
  await saveWeek(plan);
  return plan;
}

/** The week as it stands; if nothing was ever planned, the app's own default plan. */
export async function ensureWeek(weekStart: ISODate, seed?: number): Promise<WeekPlan> {
  const existing = await getWeek(weekStart);
  if (existing) return existing;
  const settings = await getSettings();
  const last = await lastInputs();
  const inputs: WeekInputs = { weekStart, guests: {}, busyDates: [], eatOut: [], higherBurn: {}, shopDay: last.shopDay ?? settings.shopDay };
  return generate(inputs, seed ?? seedFor(weekStart), 'default');
}

export async function proposeWeek(inputs: WeekInputs, seed: number, locked: PlannedMeal[] = [], lockedSessions: PlannedSession[] = []): Promise<WeekPlan> {
  return generate(inputs, seed, 'proposal', locked, lockedSessions);
}

export async function confirmWeek(weekStart: ISODate): Promise<WeekPlan> {
  const w = await getWeek(weekStart);
  if (!w) throw new Error(`No plan for week ${weekStart}`);
  const confirmed = { ...w, status: 'confirmed' as const };
  await saveWeek(confirmed);
  return confirmed;
}

/**
 * Defaults for the next plan: shop day and which weekdays tend to be busy,
 * from the latest week actually planned (default weeks carry no choices).
 */
export async function lastInputs(): Promise<{ shopDay?: number; busyWeekdays: number[] }> {
  const w = await db.weeks.orderBy('weekStart').reverse().filter(w => w.status !== 'default').first();
  if (!w) return { busyWeekdays: [] };
  return { shopDay: w.inputs.shopDay, busyWeekdays: [...new Set(w.inputs.busyDates.map(weekday))].sort() };
}

// --- Completions ----------------------------------------------------------------

async function weekContaining(date: ISODate): Promise<WeekPlan | undefined> {
  for (const w of await db.weeks.toArray()) if (datesOfWeek(w.weekStart).includes(date)) return w;
  return undefined;
}

/** Ticking a cooked meal done uses up what it needed from the pantry. */
async function usePantryFor(itemId: string, date: ISODate): Promise<Completion['pantryDelta']> {
  const week = await weekContaining(date);
  const meal = week?.meals.find(m => m.id === itemId);
  if (!week || !meal) return undefined;
  const lib = await getLibrary();
  const delta: NonNullable<Completion['pantryDelta']> = [];
  for (const { ingredientId, qty } of mealIngredients(meal, week.meals, lib)) {
    const p = await db.pantry.get(ingredientId);
    if (!p) continue;
    if (p.qty === undefined) {
      delta.push({ ingredientId, qty: null, useUp: p.useUp });
      await db.pantry.delete(ingredientId);
      continue;
    }
    const used = Math.min(p.qty, qty);
    delta.push({ ingredientId, qty: used, useUp: p.useUp });
    const left = Math.round((p.qty - used) * 1000) / 1000;
    if (left <= 0) await db.pantry.delete(ingredientId);
    else await db.pantry.put({ ...p, qty: left });
  }
  return delta.length ? delta : undefined;
}

export async function setCompletion(c: Completion): Promise<void> {
  await db.transaction('rw', db.completions, db.pantry, db.weeks, db.kv, async () => {
    if (await db.completions.get([c.itemId, c.date])) await clearCompletion(c.itemId, c.date);
    const record: Completion = { ...c };
    if (c.kind === 'meal' && c.status === 'done') {
      const delta = await usePantryFor(c.itemId, c.date);
      if (delta) record.pantryDelta = delta;
    }
    await db.completions.put(record);
  });
}

export async function clearCompletion(itemId: string, date: ISODate): Promise<void> {
  await db.transaction('rw', db.completions, db.pantry, async () => {
    const c = await db.completions.get([itemId, date]);
    if (!c) return;
    // Give back what this tick used, on top of whatever is there now.
    for (const d of c.pantryDelta ?? []) {
      const now = await db.pantry.get(d.ingredientId);
      if (d.qty === null) {
        if (!now) await db.pantry.put({ ingredientId: d.ingredientId, useUp: d.useUp });
      } else if (!now) {
        await db.pantry.put({ ingredientId: d.ingredientId, qty: d.qty, useUp: d.useUp });
      } else if (now.qty !== undefined) {
        await db.pantry.put({ ...now, qty: Math.round((now.qty + d.qty) * 1000) / 1000 });
      }
    }
    await db.completions.delete([itemId, date]);
  });
}

export async function completionsBetween(from: ISODate, to: ISODate): Promise<Completion[]> {
  return db.completions.where('date').between(from, to, true, true).toArray();
}

// --- Pantry, recovery, storage ---------------------------------------------------

export async function getPantry(): Promise<PantryItem[]> { return db.pantry.toArray(); }
export async function savePantryItem(p: PantryItem): Promise<void> { await db.pantry.put(p); }
export async function removePantryItem(id: string): Promise<void> { await db.pantry.delete(id); }

export async function setRecovery(date: ISODate, r: Recovery | null): Promise<void> {
  if (r === null) await db.kv.delete(`recovery:${date}`);
  else await putKV(`recovery:${date}`, r);
}
export async function getRecovery(date: ISODate): Promise<Recovery | undefined> { return getKV<Recovery>(`recovery:${date}`); }

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
