import type { Library, LibraryPack, UserOverlay } from '../domain/types';

export function emptyOverlay(): UserOverlay {
  return { hiddenRecipeIds: [], routineOverrides: {}, userRecipes: [], userExercises: [], userIngredients: [] };
}

/**
 * The library the app works from: the imported pack plus Ben's own overlay.
 * Hidden and retired recipes both stay (planners skip them) so existing
 * plans can still show them.
 */
export function buildLibrary(pack: LibraryPack, overlay: UserOverlay): Library {
  const hidden = new Set(overlay.hiddenRecipeIds);
  const ingredients = new Map([...pack.ingredients, ...overlay.userIngredients].map(i => [i.id, i]));
  // Hidden recipes stay in the map so planned meals keep working; planners skip them.
  const recipes = new Map([...pack.recipes, ...overlay.userRecipes].map(r => [r.id, r]));
  const exercises = new Map([...pack.exercises, ...overlay.userExercises].map(e => [e.id, e]));

  const routine = pack.routine.map(r => ({ ...r, ...overlay.routineOverrides[r.exerciseId] }));
  // User exercises with an override join the routine (morning by default).
  for (const e of overlay.userExercises) {
    const o = overlay.routineOverrides[e.id];
    if (o && !routine.some(r => r.exerciseId === e.id)) {
      routine.push({ exerciseId: e.id, session: o.session ?? 'morning', timesPerWeek: o.timesPerWeek ?? 3, active: o.active ?? true });
    }
  }

  return { ingredients, recipes, exercises, routine, rules: pack.rules, isSample: pack.isSample, label: pack.label, hiddenRecipeIds: hidden };
}

/**
 * Bring in an updated pack. Entries the new pack drops are kept, marked
 * retired, only while a stored plan still refers to them.
 */
export function mergePack(
  oldPack: LibraryPack | null,
  newPack: LibraryPack,
  referencedRecipeIds: Set<string>,
  referencedExerciseIds: Set<string>,
): LibraryPack {
  if (!oldPack) return newPack;
  const newRecipeIds = new Set(newPack.recipes.map(r => r.id));
  const keptRecipes = oldPack.recipes
    .filter(r => !newRecipeIds.has(r.id) && referencedRecipeIds.has(r.id))
    .map(r => ({ ...r, retired: true }));
  const newExIds = new Set(newPack.exercises.map(e => e.id));
  const keptExercises = oldPack.exercises
    .filter(e => !newExIds.has(e.id) && referencedExerciseIds.has(e.id))
    .map(e => ({ ...e, retired: true }));
  const newIngIds = new Set(newPack.ingredients.map(i => i.id));
  const neededIng = new Set(keptRecipes.flatMap(r => r.ingredients.map(i => i.ingredientId)));
  const keptIngredients = oldPack.ingredients.filter(i => !newIngIds.has(i.id) && neededIng.has(i.id));
  return {
    ...newPack,
    ingredients: [...newPack.ingredients, ...keptIngredients],
    recipes: [...newPack.recipes, ...keptRecipes],
    exercises: [...newPack.exercises, ...keptExercises],
  };
}
