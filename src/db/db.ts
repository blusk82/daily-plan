import Dexie, { type Table } from 'dexie';
import type { Completion, PantryItem, WeekPlan } from '../domain/types';

export interface KV { key: string; value: unknown }

class DailyPlanDB extends Dexie {
  kv!: Table<KV, string>;
  weeks!: Table<WeekPlan, string>;
  completions!: Table<Completion, [string, string]>;
  pantry!: Table<PantryItem, string>;

  constructor() {
    super('daily-plan');
    this.version(1).stores({
      kv: 'key',
      weeks: 'weekStart',
      completions: '[itemId+date], date',
      pantry: 'ingredientId',
    });
  }
}

export const db = new DailyPlanDB();

export const TABLES = ['kv', 'weeks', 'completions', 'pantry'] as const;

/** Tests only: wipe everything. */
export async function resetDb(): Promise<void> {
  await db.transaction('rw', db.kv, db.weeks, db.completions, db.pantry, async () => {
    await Promise.all([db.kv.clear(), db.weeks.clear(), db.completions.clear(), db.pantry.clear()]);
  });
}
