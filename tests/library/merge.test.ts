import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { buildLibrary, emptyOverlay, mergePack } from '../../src/library/merge';

test('buildLibrary hides recipes and applies routine overrides', () => {
  const ov = { ...emptyOverlay(), hiddenRecipeIds: [SAMPLE_PACK.recipes[0].id],
    routineOverrides: { [SAMPLE_PACK.routine[0].exerciseId]: { active: false, timesPerWeek: 2 } } };
  const lib = buildLibrary(SAMPLE_PACK, ov);
  // Hidden recipes stay available to planned meals; only the planners skip them.
  expect(lib.recipes.has(SAMPLE_PACK.recipes[0].id)).toBe(true);
  expect(lib.hiddenRecipeIds.has(SAMPLE_PACK.recipes[0].id)).toBe(true);
  const r = lib.routine.find(r => r.exerciseId === SAMPLE_PACK.routine[0].exerciseId)!;
  expect(r.active).toBe(false);
  expect(r.timesPerWeek).toBe(2);
  expect(lib.isSample).toBe(true);
});

test('user recipes, exercises and ingredients are included', () => {
  const user = { ...SAMPLE_PACK.recipes[1], id: 'u1', source: 'user' as const };
  const ing = { id: 'kale', name: 'Kale', unit: 'g' as const, keepsDays: 5 };
  const lib = buildLibrary(SAMPLE_PACK, { ...emptyOverlay(), userRecipes: [user], userIngredients: [ing] });
  expect(lib.recipes.has('u1')).toBe(true);
  expect(lib.ingredients.get('kale')).toEqual(ing);
});

test('mergePack keeps a removed recipe that the plan still references, marked retired', () => {
  const next = structuredClone(SAMPLE_PACK);
  const gone = next.recipes.shift()!;
  const merged = mergePack(SAMPLE_PACK, next, new Set([gone.id]), new Set());
  expect(merged.recipes.find(r => r.id === gone.id)?.retired).toBe(true);
  const lib = buildLibrary(merged, emptyOverlay());
  expect(lib.recipes.get(gone.id)?.retired).toBe(true);
});

test('mergePack keeps referenced exercises and their ingredients', () => {
  const next = structuredClone(SAMPLE_PACK);
  const goneEx = next.exercises.shift()!;
  next.routine = next.routine.filter(r => r.exerciseId !== goneEx.id);
  const merged = mergePack(SAMPLE_PACK, next, new Set(), new Set([goneEx.id]));
  expect(merged.exercises.find(e => e.id === goneEx.id)?.retired).toBe(true);
});

test('mergePack drops removed, unreferenced recipes', () => {
  const next = structuredClone(SAMPLE_PACK);
  const gone = next.recipes.shift()!;
  expect(mergePack(SAMPLE_PACK, next, new Set(), new Set()).recipes.some(r => r.id === gone.id)).toBe(false);
});

test('mergePack with no old pack returns the new pack', () => {
  expect(mergePack(null, SAMPLE_PACK, new Set(), new Set())).toEqual(SAMPLE_PACK);
});
