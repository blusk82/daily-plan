import type { Exercise, Ingredient, LibraryPack, MealSlot, Recipe, RoutineItem } from '../domain/types';

// SAMPLE library for development and testing only. It is not Ben's plan:
// the real recipes, exercises and balance rules come from his books and
// arrive as an imported library file. Every name is prefixed "Sample: ".

const ing = (id: string, name: string, unit: Ingredient['unit'], keepsDays: number, staple = false): Ingredient =>
  staple ? { id, name, unit, keepsDays, staple } : { id, name, unit, keepsDays };

const ingredients: Ingredient[] = [
  ing('greek-yoghurt', 'Greek yoghurt', 'g', 10),
  ing('oats', 'Rolled oats', 'g', 180),
  ing('berries', 'Mixed berries', 'g', 4),
  ing('eggs', 'Eggs', 'each', 21),
  ing('bread', 'Wholegrain bread', 'g', 6),
  ing('spinach', 'Baby spinach', 'g', 4),
  ing('milk', 'Milk', 'ml', 7),
  ing('peanut-butter', 'Peanut butter', 'g', 180),
  ing('cottage-cheese', 'Cottage cheese', 'g', 7),
  ing('tomato', 'Tomatoes', 'each', 6),
  ing('capsicum', 'Capsicum', 'each', 7),
  ing('feta', 'Feta', 'g', 10),
  ing('banana', 'Bananas', 'each', 5),
  ing('tuna', 'Tuna in springwater (tin)', 'g', 365),
  ing('chickpeas-tin', 'Chickpeas (tin)', 'g', 365),
  ing('lettuce', 'Cos lettuce', 'g', 5),
  ing('cucumber', 'Cucumber', 'each', 6),
  ing('lemon', 'Lemons', 'each', 14),
  ing('wrap', 'Wholemeal wraps', 'each', 14),
  ing('chicken-breast', 'Chicken breast', 'g', 2),
  ing('pumpkin', 'Pumpkin', 'g', 14),
  ing('lentils', 'Red lentils (dry)', 'g', 365),
  ing('onion', 'Brown onions', 'each', 30),
  ing('quinoa', 'Quinoa', 'g', 365),
  ing('zucchini', 'Zucchini', 'each', 6),
  ing('tofu', 'Firm tofu', 'g', 10),
  ing('rice', 'Brown rice', 'g', 365),
  ing('broccoli', 'Broccoli', 'g', 6),
  ing('salmon', 'Salmon fillets', 'g', 2),
  ing('white-fish', 'White fish fillets', 'g', 2),
  ing('sweet-potato', 'Sweet potato', 'g', 21),
  ing('chicken-thigh-frozen', 'Chicken thighs (frozen)', 'g', 90),
  ing('beef-mince', 'Lean beef mince', 'g', 2),
  ing('tomato-tin', 'Diced tomatoes (tin)', 'g', 365),
  ing('pasta', 'Wholemeal pasta', 'g', 365),
  ing('chickpeas-dried', 'Chickpeas (dried)', 'g', 365),
  ing('steak', 'Lean beef steak', 'g', 3),
  ing('potato', 'Potatoes', 'g', 21),
  ing('noodles', 'Egg noodles', 'g', 180),
  ing('apple', 'Apples', 'each', 14),
  ing('almonds', 'Almonds', 'g', 120),
  ing('olive-oil', 'Olive oil', 'ml', 365, true),
  ing('garlic', 'Garlic', 'each', 30, true),
  ing('salt-pepper', 'Salt and pepper', 'g', 365, true),
];

type R = Omit<Recipe, 'source' | 'method' | 'prepSteps' | 'leftoverOk' | 'tags'> &
  Partial<Pick<Recipe, 'method' | 'prepSteps' | 'leftoverOk' | 'tags'>>;
const rec = (r: R): Recipe => ({
  method: ['Sample recipe — method comes with your real library.'],
  prepSteps: [], leftoverOk: false, tags: [], source: 'sample', ...r,
});
const n = (kcal: number, protein: number, carbs: number, fat: number) => ({ kcal, protein, carbs, fat });
const s = (...slots: MealSlot[]) => slots;
const i = (ingredientId: string, qty: number) => ({ ingredientId, qty });

const recipes: Recipe[] = [
  // Breakfasts
  rec({ id: 'b-yoghurt-oats', name: 'Sample: Greek yoghurt, oats & berries', slots: s('breakfast'), serves: 1, perServe: n(420, 30, 52, 10), prepMins: 5, quick: true,
    ingredients: [i('greek-yoghurt', 200), i('oats', 40), i('berries', 100)] }),
  rec({ id: 'b-eggs-toast', name: 'Sample: Scrambled eggs on toast with spinach', slots: s('breakfast'), serves: 1, perServe: n(450, 30, 32, 22), prepMins: 10, quick: true,
    ingredients: [i('eggs', 3), i('bread', 80), i('spinach', 40)] }),
  rec({ id: 'b-overnight-oats', name: 'Sample: Peanut overnight oats', slots: s('breakfast'), serves: 1, perServe: n(460, 30, 55, 12), prepMins: 5, quick: true,
    ingredients: [i('oats', 50), i('milk', 250), i('peanut-butter', 15)], prepSteps: [{ label: 'Make overnight oats', leadHours: 10 }] }),
  rec({ id: 'b-cottage-toast', name: 'Sample: Cottage cheese & tomato toast', slots: s('breakfast'), serves: 1, perServe: n(400, 30, 40, 12), prepMins: 5, quick: true,
    ingredients: [i('cottage-cheese', 150), i('bread', 80), i('tomato', 1)] }),
  rec({ id: 'b-omelette', name: 'Sample: Capsicum, spinach & feta omelette', slots: s('breakfast'), serves: 1, perServe: n(380, 28, 8, 26), prepMins: 10, quick: true,
    ingredients: [i('eggs', 3), i('capsicum', 0.5), i('feta', 30), i('spinach', 30)], tags: ['veg'] }),
  rec({ id: 'b-smoothie', name: 'Sample: Banana oat smoothie', slots: s('breakfast'), serves: 1, perServe: n(430, 28, 62, 9), prepMins: 5, quick: true,
    ingredients: [i('milk', 300), i('banana', 1), i('oats', 30), i('greek-yoghurt', 100)] }),
  rec({ id: 'b-egg-muffin', name: 'Sample: Egg & tomato breakfast muffin', slots: s('breakfast'), serves: 1, perServe: n(410, 27, 34, 17), prepMins: 10, quick: true,
    ingredients: [i('eggs', 2), i('bread', 70), i('tomato', 1), i('spinach', 20)] }),
  rec({ id: 'b-porridge', name: 'Sample: Protein porridge with banana', slots: s('breakfast'), serves: 1, perServe: n(440, 29, 60, 9), prepMins: 10, quick: true,
    ingredients: [i('oats', 50), i('milk', 250), i('greek-yoghurt', 80), i('banana', 0.5)] }),
  // Lunches
  rec({ id: 'l-tuna-chickpea', name: 'Sample: Tuna & chickpea salad', slots: s('lunch'), serves: 1, perServe: n(480, 40, 38, 16), prepMins: 10, quick: true,
    ingredients: [i('tuna', 185), i('chickpeas-tin', 200), i('lettuce', 80), i('cucumber', 0.5), i('tomato', 1), i('lemon', 0.5)], tags: ['fish', 'veg'] }),
  rec({ id: 'l-chicken-wrap', name: 'Sample: Chicken salad wrap', slots: s('lunch'), serves: 1, perServe: n(500, 42, 45, 14), prepMins: 15, quick: true,
    ingredients: [i('wrap', 1), i('chicken-breast', 120), i('lettuce', 40), i('tomato', 1)], tags: ['veg'] }),
  rec({ id: 'l-pumpkin-soup', name: 'Sample: Pumpkin & lentil soup', slots: s('lunch'), serves: 4, perServe: n(420, 22, 60, 8), prepMins: 40, quick: false, leftoverOk: true,
    ingredients: [i('pumpkin', 1000), i('lentils', 200), i('onion', 1)], tags: ['veg'] }),
  rec({ id: 'l-egg-sandwich', name: 'Sample: Egg & salad sandwich', slots: s('lunch'), serves: 1, perServe: n(450, 26, 40, 18), prepMins: 15, quick: true,
    ingredients: [i('bread', 80), i('eggs', 2), i('lettuce', 30), i('tomato', 1)], tags: ['veg'] }),
  rec({ id: 'l-quinoa-bowl', name: 'Sample: Quinoa, feta & roast veg bowl', slots: s('lunch'), serves: 1, perServe: n(520, 24, 60, 20), prepMins: 30, quick: false,
    ingredients: [i('quinoa', 70), i('feta', 40), i('zucchini', 1), i('capsicum', 1)], tags: ['veg'] }),
  rec({ id: 'l-tofu-bowl', name: 'Sample: Tofu & broccoli rice bowl', slots: s('lunch'), serves: 1, perServe: n(520, 30, 60, 16), prepMins: 20, quick: true,
    ingredients: [i('tofu', 150), i('rice', 70), i('broccoli', 100)], tags: ['veg'] }),
  rec({ id: 'l-salmon-rice', name: 'Sample: Salmon & cucumber rice salad', slots: s('lunch'), serves: 1, perServe: n(530, 36, 52, 18), prepMins: 15, quick: true,
    ingredients: [i('salmon', 120), i('rice', 60), i('cucumber', 0.5), i('lemon', 0.5)], tags: ['fish', 'veg'] }),
  rec({ id: 'l-cottage-wrap', name: 'Sample: Cottage cheese & veg wrap', slots: s('lunch'), serves: 1, perServe: n(440, 32, 44, 13), prepMins: 10, quick: true,
    ingredients: [i('wrap', 1), i('cottage-cheese', 120), i('capsicum', 0.5), i('lettuce', 40)], tags: ['veg'] }),
  // Dinners
  rec({ id: 'd-lemon-salmon', name: 'Sample: Lemon salmon, greens & rice', slots: s('dinner'), serves: 2, perServe: n(600, 40, 55, 22), prepMins: 25, quick: true,
    ingredients: [i('salmon', 300), i('rice', 140), i('broccoli', 200), i('lemon', 1)], tags: ['fish', 'veg'] }),
  rec({ id: 'd-white-fish', name: 'Sample: Baked white fish with sweet potato', slots: s('dinner'), serves: 2, perServe: n(520, 42, 50, 12), prepMins: 40, quick: false,
    ingredients: [i('white-fish', 360), i('sweet-potato', 400), i('spinach', 100)], tags: ['fish', 'veg'] }),
  rec({ id: 'd-chicken-traybake', name: 'Sample: Chicken thigh & pumpkin traybake', slots: s('dinner'), serves: 4, perServe: n(580, 45, 30, 28), prepMins: 50, quick: false, leftoverOk: true,
    ingredients: [i('chicken-thigh-frozen', 800), i('pumpkin', 600), i('onion', 2), i('capsicum', 2)],
    prepSteps: [{ label: 'Defrost chicken thighs', leadHours: 24 }], tags: ['veg', 'poultry'] }),
  rec({ id: 'd-bolognese', name: 'Sample: Beef & lentil bolognese', slots: s('dinner'), serves: 4, perServe: n(640, 45, 70, 18), prepMins: 45, quick: false, leftoverOk: true,
    ingredients: [i('beef-mince', 500), i('lentils', 100), i('tomato-tin', 800), i('zucchini', 2), i('pasta', 320)], tags: ['veg', 'red-meat'] }),
  rec({ id: 'd-chicken-curry', name: 'Sample: Chicken & chickpea curry', slots: s('dinner'), serves: 4, perServe: n(620, 42, 65, 20), prepMins: 50, quick: false, leftoverOk: true,
    ingredients: [i('chicken-thigh-frozen', 500), i('chickpeas-dried', 200), i('spinach', 200), i('tomato-tin', 400), i('rice', 280)],
    prepSteps: [{ label: 'Defrost chicken thighs', leadHours: 24 }, { label: 'Soak chickpeas', leadHours: 12 }], tags: ['veg', 'poultry'] }),
  rec({ id: 'd-chicken-stirfry', name: 'Sample: Chicken & broccoli stir-fry', slots: s('dinner'), serves: 2, perServe: n(560, 45, 55, 14), prepMins: 20, quick: true,
    ingredients: [i('chicken-breast', 300), i('broccoli', 200), i('capsicum', 1), i('rice', 140)], tags: ['veg', 'poultry'] }),
  rec({ id: 'd-steak-mash', name: 'Sample: Steak, potato mash & greens', slots: s('dinner'), serves: 2, perServe: n(620, 48, 40, 26), prepMins: 25, quick: true,
    ingredients: [i('steak', 300), i('potato', 400), i('broccoli', 200)], tags: ['veg', 'red-meat'] }),
  rec({ id: 'd-tofu-noodles', name: 'Sample: Tofu & veg noodle stir-fry', slots: s('dinner'), serves: 2, perServe: n(580, 34, 65, 18), prepMins: 20, quick: true,
    ingredients: [i('tofu', 300), i('noodles', 160), i('capsicum', 1), i('broccoli', 150)], tags: ['veg'] }),
  // Snacks
  rec({ id: 's-apple-almonds', name: 'Sample: Apple & almonds', slots: s('snack'), serves: 1, perServe: n(200, 6, 22, 11), prepMins: 0, quick: true,
    ingredients: [i('apple', 1), i('almonds', 20)] }),
  rec({ id: 's-yoghurt', name: 'Sample: Greek yoghurt cup', slots: s('snack'), serves: 1, perServe: n(150, 15, 9, 6), prepMins: 0, quick: true,
    ingredients: [i('greek-yoghurt', 150)] }),
  rec({ id: 's-boiled-eggs', name: 'Sample: Two boiled eggs', slots: s('snack'), serves: 1, perServe: n(140, 12, 1, 10), prepMins: 10, quick: true,
    ingredients: [i('eggs', 2)] }),
  rec({ id: 's-cottage-cucumber', name: 'Sample: Cottage cheese & cucumber', slots: s('snack'), serves: 1, perServe: n(150, 18, 8, 5), prepMins: 5, quick: true,
    ingredients: [i('cottage-cheese', 150), i('cucumber', 0.5)] }),
];

const ex = (e: Omit<Exercise, 'source'>): Exercise => ({ ...e, source: 'sample' });
const exercises: Exercise[] = [
  ex({ id: 'bridge', name: 'Sample: Glute bridge', areas: ['hip', 'back'], type: 'strength', sets: 3, reps: 12,
    howTo: 'Lie on your back, knees bent. Squeeze glutes and lift hips until body is straight. Lower slowly.' }),
  ex({ id: 'bird-dog', name: 'Sample: Bird dog', areas: ['back'], type: 'strength', sets: 3, reps: 8, perSide: true,
    howTo: 'On hands and knees, extend opposite arm and leg, keep back flat. Hold 2 seconds, return.' }),
  ex({ id: 'chin-tuck', name: 'Sample: Chin tuck', areas: ['neck'], type: 'mobility', sets: 2, reps: 10,
    howTo: 'Sit tall. Draw chin straight back, making a double chin. Hold 3 seconds, release.' }),
  ex({ id: 'cat-cow', name: 'Sample: Cat-cow', areas: ['back'], type: 'mobility', sets: 2, reps: 10,
    howTo: 'On hands and knees, slowly round the back up then let it dip, moving with the breath.' }),
  ex({ id: 'hip-flexor', name: 'Sample: Kneeling hip flexor stretch', areas: ['hip'], type: 'stretch', sets: 2, holdSecs: 30, perSide: true,
    howTo: 'Half-kneel, tuck pelvis under and shift forward until a stretch is felt at the front of the hip.' }),
  ex({ id: 'thoracic-rotation', name: 'Sample: Thoracic rotation', areas: ['back', 'neck'], type: 'mobility', sets: 2, reps: 8, perSide: true,
    howTo: 'Lie on your side, knees bent. Open the top arm across to the other side, following it with your eyes.' }),
  ex({ id: 'clamshell', name: 'Sample: Clamshell', areas: ['hip'], type: 'strength', sets: 3, reps: 12, perSide: true,
    howTo: 'Lie on your side, knees bent, feet together. Lift top knee without rolling the pelvis back.' }),
  ex({ id: 'calf-raise', name: 'Sample: Calf raise', areas: ['feet'], type: 'strength', sets: 3, reps: 12,
    howTo: 'Stand holding support. Rise onto toes slowly, lower slowly.' }),
  ex({ id: 'towel-scrunch', name: 'Sample: Towel scrunch', areas: ['feet'], type: 'mobility', sets: 2, reps: 15,
    howTo: 'Seated, place a towel under your foot and scrunch it towards you with your toes.' }),
  ex({ id: 'upper-trap', name: 'Sample: Upper trapezius stretch', areas: ['neck'], type: 'stretch', sets: 2, holdSecs: 30, perSide: true,
    howTo: 'Sit tall, gently tilt ear towards shoulder until a stretch is felt along the side of the neck.' }),
];

const rt = (exerciseId: string, timesPerWeek: number, session: RoutineItem['session']): RoutineItem =>
  ({ exerciseId, timesPerWeek, session, active: true });
const routine: RoutineItem[] = [
  rt('bridge', 3, 'morning'), rt('bird-dog', 3, 'morning'), rt('clamshell', 3, 'morning'),
  rt('chin-tuck', 7, 'morning'), rt('cat-cow', 5, 'morning'), rt('calf-raise', 3, 'morning'), rt('towel-scrunch', 4, 'morning'),
  rt('hip-flexor', 7, 'evening'), rt('thoracic-rotation', 4, 'evening'), rt('upper-trap', 5, 'evening'),
];

export const SAMPLE_PACK: LibraryPack = {
  packVersion: 1,
  label: 'SAMPLE library — not your plan',
  isSample: true,
  createdAt: '2026-10-25',
  ingredients,
  recipes,
  exercises,
  routine,
  rules: {
    kcalTolerancePct: 5, portionMin: 0.75, portionMax: 1.5,
    slotShares: { breakfast: 0.25, lunch: 0.3, dinner: 0.35, snack: 0.1 },
    maxSnacksPerDay: 2, varietyWindowDays: 7,
    rules: [
      { kind: 'day-macro', macro: 'protein', minPct: 25 },
      { kind: 'meal-tag-required', slot: 'dinner', tag: 'veg' },
      { kind: 'week-tag-count', tag: 'fish', min: 2 },
    ],
  },
};
