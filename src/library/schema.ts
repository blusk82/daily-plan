import { z } from 'zod';
import type { LibraryPack } from '../domain/types';

export const PACK_VERSION = 1;

const slot = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const area = z.enum(['back', 'hip', 'neck', 'feet']);
const macro = z.enum(['protein', 'carbs', 'fat']);
const pct = z.number().min(0).max(100);

export const ingredientSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), unit: z.enum(['g', 'ml', 'each']),
  keepsDays: z.number().min(0), staple: z.boolean().optional(), tags: z.array(z.string()).optional(),
});

export const recipeSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), slots: z.array(slot).min(1), serves: z.number().positive(),
  perServe: z.object({ kcal: z.number().min(0), protein: z.number().min(0), carbs: z.number().min(0), fat: z.number().min(0) }),
  prepMins: z.number().min(0), quick: z.boolean(), leftoverOk: z.boolean(),
  ingredients: z.array(z.object({ ingredientId: z.string(), qty: z.number().positive() })),
  prepSteps: z.array(z.object({ label: z.string().min(1), leadHours: z.number().positive() })),
  method: z.array(z.string()), tags: z.array(z.string()),
  source: z.enum(['book', 'web', 'user', 'sample']), sourceRef: z.string().optional(), retired: z.boolean().optional(),
});

export const exerciseSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), howTo: z.string(), image: z.string().optional(),
  areas: z.array(area).min(1), type: z.enum(['mobility', 'strength', 'stretch']),
  sets: z.number().int().positive().optional(), reps: z.number().int().positive().optional(),
  holdSecs: z.number().positive().optional(), perSide: z.boolean().optional(),
  source: z.enum(['physio', 'osteo', 'podiatrist', 'book', 'user', 'sample']), sourceRef: z.string().optional(),
  retired: z.boolean().optional(),
});

const ruleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('day-macro'), macro, minPct: pct.optional(), maxPct: pct.optional() }),
  z.object({ kind: z.literal('meal-macro'), slot: slot.optional(), macro, minPct: pct.optional(), maxPct: pct.optional() }),
  z.object({ kind: z.literal('meal-tag-required'), slot, tag: z.string() }),
  z.object({ kind: z.literal('week-tag-count'), tag: z.string(), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() }),
]);

const packSchema = z.object({
  packVersion: z.number().int(), label: z.string(), isSample: z.boolean(), createdAt: z.string(),
  ingredients: z.array(ingredientSchema), recipes: z.array(recipeSchema), exercises: z.array(exerciseSchema),
  routine: z.array(z.object({
    exerciseId: z.string(), timesPerWeek: z.number().int().min(1).max(7),
    session: z.enum(['morning', 'evening']), active: z.boolean(),
  })),
  rules: z.object({
    kcalTolerancePct: z.number().positive(), portionMin: z.number().positive(), portionMax: z.number().positive(),
    slotShares: z.object({ breakfast: z.number(), lunch: z.number(), dinner: z.number(), snack: z.number() }),
    maxSnacksPerDay: z.number().int().min(0), varietyWindowDays: z.number().int().min(0), rules: z.array(ruleSchema),
  }),
});

export type ParseResult = { ok: true; pack: LibraryPack } | { ok: false; error: string };

export function parsePack(json: unknown): ParseResult {
  if (json && typeof json === 'object' && typeof (json as { packVersion?: unknown }).packVersion === 'number'
    && (json as { packVersion: number }).packVersion > PACK_VERSION) {
    return { ok: false, error: 'This library file is from a newer version of the app.' };
  }
  const r = packSchema.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `Not a valid library file (${i.path.join('.')}: ${i.message}).` };
  }
  const pack = r.data as LibraryPack;
  const ingIds = new Set(pack.ingredients.map(i => i.id));
  for (const rec of pack.recipes) {
    const missing = rec.ingredients.find(i => !ingIds.has(i.ingredientId));
    if (missing) return { ok: false, error: `Recipe "${rec.name}" uses unknown ingredient "${missing.ingredientId}".` };
  }
  const exIds = new Set(pack.exercises.map(e => e.id));
  const badRoutine = pack.routine.find(r => !exIds.has(r.exerciseId));
  if (badRoutine) return { ok: false, error: `Routine uses unknown exercise "${badRoutine.exerciseId}".` };
  return { ok: true, pack };
}
