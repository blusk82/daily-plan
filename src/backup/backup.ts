import { z } from 'zod';
import { db } from '../db/db';
import { allWeeks, getPack, getSettings, saveSettings, savePack } from '../db/repo';
import { daysBetween, nowTime, todayLocal } from '../domain/dates';
import type { ISODate, Settings } from '../domain/types';
import { mergePack } from '../library/merge';
import { parsePack } from '../library/schema';

const SCHEMA_VERSION = 1;
const BACKUP_DUE_DAYS = 7;

const mealSchema = z.object({
  id: z.string(), date: z.string(), slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), time: z.string(),
  recipeId: z.string(), portion: z.number(), guests: z.number(), leftoverOf: z.string().optional(),
  locked: z.boolean(), eatingOut: z.boolean().optional(),
}).passthrough();
const sessionSchema = z.object({
  id: z.string(), date: z.string(), slot: z.enum(['morning', 'evening']), time: z.string(), locked: z.boolean(),
  exercises: z.array(z.object({ exerciseId: z.string() }).passthrough()),
}).passthrough();
const backupSchema = z.object({
  app: z.literal('daily-plan'),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string(),
  kv: z.array(z.object({ key: z.string(), value: z.unknown() })),
  weeks: z.array(z.object({
    weekStart: z.string(), status: z.enum(['proposal', 'confirmed', 'default']),
    inputs: z.object({ weekStart: z.string() }).passthrough(), meals: z.array(mealSchema), sessions: z.array(sessionSchema),
  }).passthrough()),
  completions: z.array(z.object({
    itemId: z.string(), date: z.string(), kind: z.string(), status: z.enum(['done', 'not-done']),
  }).passthrough()),
  pantry: z.array(z.object({ ingredientId: z.string(), useUp: z.boolean() }).passthrough()),
});

/**
 * Build the backup file. The phone's "last backup" is only updated once the
 * file has actually been shared or saved (markBackedUp); the file itself
 * carries the time so a restore doesn't nag straight away.
 */
export async function exportBackup(): Promise<{ filename: string; json: string; stamp: string }> {
  const today = todayLocal();
  const stamp = `${today}T${nowTime()}:00`;
  const kv = (await db.kv.toArray()).filter(k => k.key !== 'settings');
  kv.push({ key: 'settings', value: { ...(await getSettings()), lastBackupAt: stamp } });
  const data = {
    app: 'daily-plan', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    kv, weeks: await db.weeks.toArray(), completions: await db.completions.toArray(), pantry: await db.pantry.toArray(),
  };
  return { filename: `daily-plan-backup-${today}.json`, json: JSON.stringify(data), stamp };
}

export async function markBackedUp(stamp: string): Promise<void> {
  await saveSettings({ ...(await getSettings()), lastBackupAt: stamp });
}

/** Everything is checked before anything is written; a bad file changes nothing. */
export async function importBackup(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: 'This file isn’t a Daily Plan backup.' }; }
  const v = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if ((raw as { app?: unknown } | null)?.app === 'daily-plan' && typeof v === 'number' && v > SCHEMA_VERSION) {
    return { ok: false, error: 'This backup is from a newer version of the app.' };
  }
  const r = backupSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: 'This file isn’t a valid Daily Plan backup. Nothing was changed.' };
  const d = raw as { kv: never[]; weeks: never[]; completions: never[]; pantry: never[] };
  await db.transaction('rw', db.kv, db.weeks, db.completions, db.pantry, async () => {
    await Promise.all([db.kv.clear(), db.weeks.clear(), db.completions.clear(), db.pantry.clear()]);
    await db.kv.bulkPut(d.kv);
    await db.weeks.bulkPut(d.weeks);
    await db.completions.bulkPut(d.completions);
    await db.pantry.bulkPut(d.pantry);
  });
  return { ok: true };
}

/** Bring in a library file (recipes, exercises, routine, rules). Ben's own changes are kept. */
export async function importPack(json: string): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: 'This file isn’t a library file.' }; }
  const r = parsePack(raw);
  if (!r.ok) return r;
  const weeks = await allWeeks();
  const recipeIds = new Set(weeks.flatMap(w => w.meals.map(m => m.recipeId)));
  const exerciseIds = new Set(weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.exerciseId))));
  // Merge against what is in use now, including the sample pack before the first import.
  await savePack(mergePack(await getPack(), r.pack, recipeIds, exerciseIds));
  return { ok: true, label: r.pack.label };
}

/**
 * iPhone: the share sheet (Files, iCloud Drive, OneDrive, Mail). Elsewhere: a download.
 * Returns false if Ben cancelled the share sheet.
 */
export async function shareOrDownload(filename: string, json: string): Promise<boolean> {
  const file = new File([json], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: filename }); return true; } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function backupDue(settings: Settings, today: ISODate): boolean {
  if (!settings.lastBackupAt) return true;
  return daysBetween(settings.lastBackupAt.slice(0, 10), today) >= BACKUP_DUE_DAYS;
}
