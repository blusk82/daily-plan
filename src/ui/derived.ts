import type { Completion, ISODate, WeekPlan } from '../domain/types';
import { buildPrepReminders, type PrepReminder } from '../shopping/prep';
import { buildShoppingTrips, type ShopTrip } from '../shopping/shopping';
import type { Data } from './data';

/** Shopping still to do: meals already ticked done need nothing more. */
export function upcomingTrips(d: Pick<Data, 'week' | 'nextWeek' | 'completions' | 'lib' | 'pantry' | 'settings'>): ShopTrip[] {
  const done = new Set(d.completions.filter(c => c.kind === 'meal' && c.status === 'done').map(c => c.itemId));
  return [d.week, d.nextWeek]
    .filter((p): p is WeekPlan => !!p)
    .flatMap(p => buildShoppingTrips({ ...p, meals: p.meals.filter(m => !done.has(m.id)) }, d.lib, d.pantry, d.settings));
}

export function upcomingPreps(d: Pick<Data, 'week' | 'nextWeek' | 'lib'>): PrepReminder[] {
  return [d.week, d.nextWeek].filter((p): p is WeekPlan => !!p).flatMap(p => buildPrepReminders(p, d.lib));
}

export function completionOf(completions: Completion[], itemId: string, date: ISODate): Completion | undefined {
  return completions.find(c => c.itemId === itemId && c.date === date);
}

export const nowStamp = () => new Date().toISOString();

/** FileReader rather than Blob.text(): works on older iOS Safari too. */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
