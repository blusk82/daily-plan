import { db, resetDb } from '../../src/db/db';
import { backupDue, exportBackup, importBackup, importPack } from '../../src/backup/backup';
import { ensureWeek, getLibrary, getOverlay, getSettings, saveOverlay, savePantryItem, setCompletion, getStoredPack } from '../../src/db/repo';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { MON, SETTINGS } from '../fixtures';

beforeEach(async () => { await resetDb(); });

async function seed() {
  await ensureWeek(MON, 1);
  await savePantryItem({ ingredientId: 'pumpkin', qty: 300, useUp: true });
  await setCompletion({ itemId: `${MON}-breakfast`, kind: 'meal', date: MON, status: 'not-done', reason: 'tired', at: 'x' });
}
async function dumpAll() {
  return { kv: await db.kv.toArray(), weeks: await db.weeks.toArray(), completions: await db.completions.toArray(), pantry: await db.pantry.toArray() };
}

test('export → wipe → import round-trips everything (the file carries its own backup time)', async () => {
  await seed();
  const { filename, json, stamp } = await exportBackup();
  expect(filename).toMatch(/^daily-plan-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const before = await dumpAll();
  await resetDb();
  expect(await importBackup(json)).toEqual({ ok: true });
  const after = await dumpAll();
  expect(after.weeks).toEqual(before.weeks);
  expect(after.completions).toEqual(before.completions);
  expect(after.pantry).toEqual(before.pantry);
  expect((await getSettings()).lastBackupAt).toBe(stamp);
});

test('corrupt backup is rejected and existing data is untouched', async () => {
  await seed();
  const before = await dumpAll();
  expect((await importBackup('{"app":"daily-plan","schemaVersion":1,"weeks":"oops"}')).ok).toBe(false);
  expect((await importBackup('not json')).ok).toBe(false);
  expect((await importBackup('{"app":"something-else","schemaVersion":1}')).ok).toBe(false);
  expect(await dumpAll()).toEqual(before);
});

test('newer schemaVersion is rejected with a clear message', async () => {
  expect(await importBackup(JSON.stringify({ app: 'daily-plan', schemaVersion: 99 })))
    .toEqual({ ok: false, error: 'This backup is from a newer version of the app.' });
});

test('importPack stores a real pack and keeps overlay hidden recipes and on/off settings', async () => {
  await saveOverlay({ ...(await getOverlay()), hiddenRecipeIds: ['b-smoothie'], routineOverrides: { 'chin-tuck': { active: false } } });
  const mine = { ...structuredClone(SAMPLE_PACK), isSample: false, label: 'My library v1' };
  expect(await importPack(JSON.stringify(mine))).toEqual({ ok: true, label: 'My library v1' });
  const lib = await getLibrary();
  expect(lib.isSample).toBe(false);
  expect(lib.hiddenRecipeIds.has('b-smoothie')).toBe(true);
  expect(lib.routine.find(r => r.exerciseId === 'chin-tuck')!.active).toBe(false);
});

test('importPack keeps recipes the stored plans still use', async () => {
  const w = await ensureWeek(MON, 1);
  await importPack(JSON.stringify({ ...SAMPLE_PACK, isSample: false }));
  const usedDinner = w.meals.find(m => m.slot === 'dinner')!.recipeId;
  const next = { ...structuredClone(SAMPLE_PACK), isSample: false, recipes: SAMPLE_PACK.recipes.filter(r => r.id !== usedDinner) };
  expect((await importPack(JSON.stringify(next))).ok).toBe(true);
  expect((await getStoredPack())!.recipes.find(r => r.id === usedDinner)?.retired).toBe(true);
});

test('invalid pack shows the error and keeps the old one', async () => {
  await importPack(JSON.stringify({ ...SAMPLE_PACK, isSample: false, label: 'old' }));
  const r = await importPack('{"packVersion":1}');
  expect(r.ok).toBe(false);
  expect((await getLibrary()).label).toBe('old');
});

test('backupDue after 7 days', () => {
  expect(backupDue({ ...SETTINGS }, '2026-10-25')).toBe(true);
  expect(backupDue({ ...SETTINGS, lastBackupAt: '2026-10-18T09:00:00' }, '2026-10-25')).toBe(true);
  expect(backupDue({ ...SETTINGS, lastBackupAt: '2026-10-19T09:00:00' }, '2026-10-25')).toBe(false);
});
