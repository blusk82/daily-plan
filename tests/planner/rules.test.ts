import { checkDay, checkWeek, dayTarget, mealNutrition, penalty } from '../../src/planner/rules';
import { MON, TUE, eatOutDinner, inputs, meal, mealsTotalling, testLib } from '../fixtures';

const lib = testLib();

test('dayTarget adds higher burn', () => {
  expect(dayTarget(TUE, { baseKcal: 1800 }, inputs({ higherBurn: { [TUE]: 300 } }))).toBe(2100);
  expect(dayTarget(MON, { baseKcal: 1800 }, inputs({ higherBurn: { [TUE]: 300 } }))).toBe(1800);
});
test('mealNutrition scales by portion and is zero when eating out', () => {
  expect(mealNutrition(meal(MON, 'lunch', 'unit', 1.5), lib).kcal).toBe(150);
  expect(mealNutrition(eatOutDinner(), lib).kcal).toBe(0);
});
test('day within ±5% is on target', () => expect(checkDay(MON, mealsTotalling(1850), 1800, lib).onTarget).toBe(true));
test('day at 1900 of 1800 is off target', () => expect(checkDay(MON, mealsTotalling(1900), 1800, lib).onTarget).toBe(false));
test('eating-out dinner reduces the target by the dinner share', () => {
  const c = checkDay(MON, [meal(MON, 'breakfast', 'unit', 5.85), meal(MON, 'lunch', 'unit', 5.85), eatOutDinner()], 1800, lib);
  expect(c.target).toBe(1170);
  expect(c.onTarget).toBe(true);
});
test('day-macro protein min reports a violation', () => {
  const v = checkDay(MON, mealsTotalling(1800, MON, 'lowp'), 1800, lib).violations;
  expect(v).toEqual(['Protein 18% (min 25%)']);
});
test('meal-tag-required flags a dinner without veg', () => {
  const ms = [...mealsTotalling(1200), meal(MON, 'dinner', 'noveg', 6)].filter((_, i) => i !== 2);
  expect(checkDay(MON, ms, 1800, lib).violations).toContain('Dinner missing veg');
});
test('week-tag-count fish min 2 counts leftovers', () => {
  const one = [meal(MON, 'dinner', 'fishy')];
  expect(checkWeek(one, lib)).toEqual(['Fish 1× this week (min 2)']);
  const withLeftover = [...one, meal(TUE, 'lunch', 'fishy', 1, { leftoverOf: one[0].id })];
  expect(checkWeek(withLeftover, lib)).toEqual([]);
});
test('penalty: an off-target day costs more than one rule miss', () => {
  const off = [{ date: MON, kcal: 1900, target: 1800, onTarget: false, violations: [] }];
  const miss = [{ date: MON, kcal: 1800, target: 1800, onTarget: true, violations: ['x'] }];
  expect(penalty(off, [])).toBeGreaterThan(penalty(miss, []));
  expect(penalty(miss, [])).toBeGreaterThan(penalty([{ ...miss[0], violations: [] }], []));
});
