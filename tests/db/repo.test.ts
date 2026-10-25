import { db, resetDb } from '../../src/db/db';
import {
  clearCompletion, completionsBetween, confirmWeek, DEFAULT_SETTINGS, ensureWeek, getLibrary, getPantry, getRecovery, getSettings,
  getWeek, lastInputs, proposeWeek, saveSettings, saveWeek, savePantryItem, setCompletion, setRecovery,
} from '../../src/db/repo';
import type { WeekPlan } from '../../src/domain/types';
import { MON, TUE, inputs, meal } from '../fixtures';

beforeEach(async () => { await resetDb(); });

test('settings default and persist', async () => {
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  expect(DEFAULT_SETTINGS.times).toEqual({ breakfast: '07:00', lunch: '12:30', snack: '15:00', dinner: '18:30', morning: '07:30', evening: '20:00' });
  expect(DEFAULT_SETTINGS).toMatchObject({ baseKcal: 1800, higherBurnKcal: 300, shopDay: 0, setupDone: false });
  await saveSettings({ ...DEFAULT_SETTINGS, baseKcal: 1700 });
  expect((await getSettings()).baseKcal).toBe(1700);
});

test('getLibrary falls back to the sample pack', async () => expect((await getLibrary()).isSample).toBe(true));

test('ensureWeek generates a default plan when none exists', async () => {
  const w = await ensureWeek('2026-10-26', 1);
  expect(w.status).toBe('default');
  expect(w.meals.filter(m => m.slot !== 'snack')).toHaveLength(21);
  expect(w.sessions.length).toBeGreaterThan(0);
  expect(await getWeek('2026-10-26')).toEqual(w);
});

test('ensureWeek returns an existing proposal unchanged', async () => {
  const p = await proposeWeek(inputs({ busyDates: [TUE] }), 3);
  expect(p.status).toBe('proposal');
  expect(await ensureWeek(p.weekStart)).toEqual(p);
});

test('proposeWeek keeps locked meals', async () => {
  const p = await proposeWeek(inputs(), 3);
  const locked = { ...p.meals.find(m => m.slot === 'dinner')!, locked: true };
  const p2 = await proposeWeek(inputs(), 4, [locked]);
  expect(p2.meals).toContainEqual(locked);
});

test('after 3 weeks away only the current week is generated', async () => {
  await ensureWeek('2026-10-26', 1);
  await ensureWeek('2026-11-16', 1);
  expect(await getWeek('2026-11-02')).toBeUndefined();
  expect(await getWeek('2026-11-09')).toBeUndefined();
});

test('confirmWeek sets status confirmed', async () => {
  await proposeWeek(inputs(), 3);
  expect((await confirmWeek(MON)).status).toBe('confirmed');
});

test('lastInputs carries shop day and busy weekdays from the latest week', async () => {
  await proposeWeek(inputs({ shopDay: 6, busyDates: [TUE] }), 3);
  expect(await lastInputs()).toEqual({ shopDay: 6, busyWeekdays: [2] });
});

test('lastInputs ignores later default weeks', async () => {
  await proposeWeek(inputs({ shopDay: 6, busyDates: [TUE] }), 3);
  await ensureWeek('2026-11-02', 1);
  expect(await lastInputs()).toEqual({ shopDay: 6, busyWeekdays: [2] });
});

async function soupWeek(): Promise<WeekPlan> {
  // Soup serves 4 with 1000 g pumpkin: portion 1.6 → 400 g
  const soup = meal(MON, 'lunch', 'l-pumpkin-soup', 1.6, { id: 'soup' });
  const w: WeekPlan = { weekStart: MON, status: 'confirmed', inputs: inputs(), meals: [soup], sessions: [
    { id: 'sess', date: MON, slot: 'morning', time: '07:30', locked: false, exercises: [{ exerciseId: 'bridge' }, { exerciseId: 'cat-cow' }] }],
    checks: [], weekViolations: [], seed: 1 };
  await saveWeek(w);
  return w;
}

test('meal done removes a used-up pantry item; undo restores it', async () => {
  await soupWeek();
  await savePantryItem({ ingredientId: 'pumpkin', qty: 300, useUp: true });
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'done', at: '' });
  expect(await getPantry()).toEqual([]);
  await clearCompletion('soup', MON);
  expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', qty: 300, useUp: true }]);
});

test('meal done decrements a larger pantry quantity; undo restores it', async () => {
  await soupWeek();
  await savePantryItem({ ingredientId: 'pumpkin', qty: 1000, useUp: true });
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'done', at: '' });
  expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', qty: 600, useUp: true }]);
  await clearCompletion('soup', MON);
  expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', qty: 1000, useUp: true }]);
});

test('pantry item without a quantity is removed when used; undo restores it', async () => {
  await soupWeek();
  await savePantryItem({ ingredientId: 'onion', useUp: false });
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'done', at: '' });
  expect(await getPantry()).toEqual([]);
  await clearCompletion('soup', MON);
  expect(await getPantry()).toEqual([{ ingredientId: 'onion', useUp: false }]);
});

test('marking not-done does not touch the pantry', async () => {
  await soupWeek();
  await savePantryItem({ ingredientId: 'pumpkin', qty: 300, useUp: true });
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'not-done', reason: 'ate-out', at: '' });
  expect(await getPantry()).toHaveLength(1);
});

test('re-ticking the same item replaces the previous record', async () => {
  await soupWeek();
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'not-done', reason: 'tired', at: '' });
  await setCompletion({ itemId: 'soup', kind: 'meal', date: MON, status: 'done', at: '' });
  expect(await completionsBetween(MON, MON)).toHaveLength(1);
});

test('single exercise tick does not change the session', async () => {
  await soupWeek();
  await setCompletion({ itemId: 'sess:bridge', kind: 'exercise', date: MON, status: 'not-done', reason: 'pain', pain: 4, area: 'hip', at: '' });
  expect((await completionsBetween(MON, MON)).map(c => c.itemId)).toEqual(['sess:bridge']);
});

test('recovery colour per date', async () => {
  await setRecovery(MON, 'red');
  expect(await getRecovery(MON)).toBe('red');
  await setRecovery(MON, null);
  expect(await getRecovery(MON)).toBeUndefined();
  expect(db.name).toBe('daily-plan');
});
