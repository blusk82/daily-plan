export type ISODate = string; // 'YYYY-MM-DD', local calendar date
export type HHMM = string; // '18:30'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SessionSlot = 'morning' | 'evening';
export type BodyArea = 'back' | 'hip' | 'neck' | 'feet';
export type Unit = 'g' | 'ml' | 'each';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MAIN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
export const BODY_AREAS: BodyArea[] = ['back', 'hip', 'neck', 'feet'];

/** Per serve, grams for macros. */
export interface Nutrition { kcal: number; protein: number; carbs: number; fat: number }
export interface Ingredient { id: string; name: string; unit: Unit; keepsDays: number; staple?: boolean; tags?: string[] }
/** Quantity in the ingredient's base unit, for the whole recipe. */
export interface RecipeIngredient { ingredientId: string; qty: number }
export interface PrepStep { label: string; leadHours: number }
export interface Recipe {
  id: string; name: string; slots: MealSlot[]; serves: number; perServe: Nutrition;
  prepMins: number; quick: boolean; leftoverOk: boolean; ingredients: RecipeIngredient[];
  prepSteps: PrepStep[]; method: string[]; tags: string[];
  source: 'book' | 'web' | 'user' | 'sample'; sourceRef?: string; retired?: boolean;
}

export type ExerciseType = 'mobility' | 'strength' | 'stretch';
export interface Exercise {
  id: string; name: string; howTo: string; image?: string; areas: BodyArea[]; type: ExerciseType;
  sets?: number; reps?: number; holdSecs?: number; perSide?: boolean;
  source: 'physio' | 'osteo' | 'podiatrist' | 'book' | 'user' | 'sample'; sourceRef?: string; retired?: boolean;
}
export interface RoutineItem { exerciseId: string; timesPerWeek: number; session: SessionSlot; active: boolean }

export type Macro = 'protein' | 'carbs' | 'fat';
export type Rule =
  | { kind: 'day-macro'; macro: Macro; minPct?: number; maxPct?: number }
  | { kind: 'meal-macro'; slot?: MealSlot; macro: Macro; minPct?: number; maxPct?: number }
  | { kind: 'meal-tag-required'; slot: MealSlot; tag: string }
  | { kind: 'week-tag-count'; tag: string; min?: number; max?: number };
export interface BalanceRules {
  kcalTolerancePct: number; portionMin: number; portionMax: number;
  slotShares: Record<MealSlot, number>; maxSnacksPerDay: number; varietyWindowDays: number; rules: Rule[];
}

export interface LibraryPack {
  packVersion: number; label: string; isSample: boolean; createdAt: string;
  ingredients: Ingredient[]; recipes: Recipe[]; exercises: Exercise[]; routine: RoutineItem[]; rules: BalanceRules;
}
export interface UserOverlay {
  hiddenRecipeIds: string[];
  routineOverrides: Record<string, { active?: boolean; timesPerWeek?: number }>;
  userRecipes: Recipe[]; userExercises: Exercise[]; userIngredients: Ingredient[];
}
export interface Library {
  ingredients: Map<string, Ingredient>; recipes: Map<string, Recipe>; exercises: Map<string, Exercise>;
  routine: RoutineItem[]; rules: BalanceRules; isSample: boolean; label: string;
  hiddenRecipeIds: Set<string>;
}

export interface PlannedMeal {
  id: string; date: ISODate; slot: MealSlot; time: HHMM; recipeId: string;
  /** Ben's serves. */
  portion: number;
  /** Guest serves at 1.0 each. */
  guests: number;
  /** Id of the PlannedMeal that cooked it. */
  leftoverOf?: string;
  locked: boolean; eatingOut?: boolean;
}
export interface PlannedExercise { exerciseId: string; sets?: number; reps?: number; holdSecs?: number }
export interface PlannedSession { id: string; date: ISODate; slot: SessionSlot; time: HHMM; exercises: PlannedExercise[]; locked: boolean }
export interface PantryItem { ingredientId: string; qty?: number; useUp: boolean }

export interface WeekInputs {
  weekStart: ISODate;
  /** key `${date}|${slot}` */
  guests: Record<string, number>;
  busyDates: ISODate[];
  /** keys `${date}|${slot}` */
  eatOut: string[];
  higherBurn: Record<ISODate, number>;
  /** 0=Sun..6=Sat */
  shopDay: number;
}
export type WeekStatus = 'proposal' | 'confirmed' | 'default';
export interface DayCheck { date: ISODate; kcal: number; target: number; onTarget: boolean; violations: string[] }
export interface WeekPlan {
  weekStart: ISODate; status: WeekStatus; inputs: WeekInputs; meals: PlannedMeal[]; sessions: PlannedSession[];
  checks: DayCheck[]; weekViolations: string[]; seed: number;
}

export type Reason = 'pain' | 'no-time' | 'tired' | 'forgot' | 'ate-out' | 'other';
export type ItemKind = 'meal' | 'session' | 'exercise' | 'shop' | 'shop-item' | 'prep';
export interface Completion {
  itemId: string; kind: ItemKind; date: ISODate; status: 'done' | 'not-done';
  reason?: Reason; otherText?: string; pain?: number; area?: BodyArea; at: string;
  /** Pantry changes made when a meal was ticked, so un-ticking can restore them. */
  pantryDelta?: { ingredientId: string; qty: number | null; useUp: boolean }[];
}
export type Recovery = 'green' | 'yellow' | 'red';
export interface Settings {
  times: Record<MealSlot | SessionSlot, HHMM>; baseKcal: number; higherBurnKcal: number; shopDay: number;
  stapleIds: string[]; lastBackupAt?: string; setupDone: boolean;
}

export const slotKey = (date: ISODate, slot: MealSlot) => `${date}|${slot}`;
