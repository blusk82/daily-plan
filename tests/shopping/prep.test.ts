import { buildPrepReminders } from '../../src/shopping/prep';
import type { PlannedMeal, WeekPlan } from '../../src/domain/types';
import { MON, WED, inputs, meal, sampleLib } from '../fixtures';

const lib = sampleLib();
const plan = (meals: PlannedMeal[]): WeekPlan => ({ weekStart: MON, status: 'confirmed', inputs: inputs(), meals, sessions: [], checks: [], weekViolations: [], seed: 1 });

test('24 h defrost for Mon 18:30 dinner fires Sun 18:30', () => {
  const m = { ...meal(MON, 'dinner', 'd-chicken-traybake'), time: '18:30' };
  expect(buildPrepReminders(plan([m]), lib)).toEqual([
    { id: `${m.id}:prep:0`, date: '2026-10-25', time: '18:30', label: 'Defrost chicken thighs', forMealId: m.id, forText: 'for Monday dinner' }]);
});
test('prep that would fall before 07:00 moves to 21:00 the day before', () => {
  const m = { ...meal(WED, 'breakfast', 'b-overnight-oats'), time: '07:00' }; // 10 h lead → 21:00 Tue
  expect(buildPrepReminders(plan([m]), lib)[0]).toMatchObject({ date: '2026-10-27', time: '21:00' });
  const early = { ...m, time: '06:00' }; // → 20:00 Tue, fine
  expect(buildPrepReminders(plan([early]), lib)[0]).toMatchObject({ date: '2026-10-27', time: '20:00' });
  const lib2 = { ...lib, recipes: new Map(lib.recipes) };
  lib2.recipes.set('b-overnight-oats', { ...lib.recipes.get('b-overnight-oats')!, prepSteps: [{ label: 'Soak', leadHours: 4 }] });
  expect(buildPrepReminders(plan([m]), lib2)[0]).toMatchObject({ date: '2026-10-27', time: '21:00' }); // 03:00 → 21:00 day before
});
test('prep after 21:00 is pulled back to 21:00 the same day', () => {
  const lib2 = { ...lib, recipes: new Map(lib.recipes) };
  lib2.recipes.set('d-chicken-traybake', { ...lib.recipes.get('d-chicken-traybake')!, prepSteps: [{ label: 'Marinate', leadHours: 20 }] });
  const m = { ...meal(WED, 'dinner', 'd-chicken-traybake'), time: '18:30' }; // 22:30 Tue → 21:00 Tue
  expect(buildPrepReminders(plan([m]), lib2)[0]).toMatchObject({ date: '2026-10-27', time: '21:00' });
});
test('leftover and eating-out meals need no prep', () => {
  const src = { ...meal(MON, 'dinner', 'd-chicken-traybake'), eatingOut: true };
  const left = meal('2026-10-27', 'lunch', 'd-chicken-traybake', 1, { leftoverOf: 'x' });
  expect(buildPrepReminders(plan([src, left]), lib)).toEqual([]);
});
