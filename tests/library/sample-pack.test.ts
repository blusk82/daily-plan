import { parsePack } from '../../src/library/schema';
import { SAMPLE_PACK } from '../../src/library/sample-pack';

test('sample pack parses and is labelled as sample', () => {
  const r = parsePack(SAMPLE_PACK);
  expect(r).toEqual({ ok: true, pack: SAMPLE_PACK });
  expect(SAMPLE_PACK.isSample).toBe(true);
  expect(SAMPLE_PACK.label).toBe('SAMPLE library — not your plan');
  expect(SAMPLE_PACK.recipes.every(r => r.name.startsWith('Sample: '))).toBe(true);
  expect(SAMPLE_PACK.exercises.every(e => e.name.startsWith('Sample: '))).toBe(true);
});

test('sample pack has enough variety for planner tests', () => {
  const by = (s: string) => SAMPLE_PACK.recipes.filter(r => r.slots.includes(s as never));
  expect(by('breakfast').length).toBeGreaterThanOrEqual(6);
  expect(by('lunch').length).toBeGreaterThanOrEqual(6);
  const dinners = by('dinner');
  expect(dinners.length).toBeGreaterThanOrEqual(8);
  expect(dinners.filter(r => r.tags.includes('fish')).length).toBeGreaterThanOrEqual(2);
  expect(dinners.filter(r => r.leftoverOk).length).toBeGreaterThanOrEqual(3);
  expect(dinners.filter(r => r.quick).length).toBeGreaterThanOrEqual(3);
  expect(dinners.some(r => r.prepSteps.some(p => p.leadHours === 24))).toBe(true);
  expect(by('snack').length).toBeGreaterThanOrEqual(4);
  const areas = new Set(SAMPLE_PACK.exercises.flatMap(e => e.areas));
  expect([...areas].sort()).toEqual(['back', 'feet', 'hip', 'neck']);
  expect(new Set(SAMPLE_PACK.exercises.map(e => e.type)).size).toBe(3);
});

test('parsePack rejects a recipe pointing at a missing ingredient', () => {
  const bad = structuredClone(SAMPLE_PACK);
  bad.recipes[0].ingredients[0].ingredientId = 'nope';
  expect(parsePack(bad).ok).toBe(false);
});

test('parsePack rejects a routine item pointing at a missing exercise', () => {
  const bad = structuredClone(SAMPLE_PACK);
  bad.routine[0].exerciseId = 'nope';
  expect(parsePack(bad).ok).toBe(false);
});

test('parsePack rejects a newer pack version', () => {
  expect(parsePack({ ...SAMPLE_PACK, packVersion: 2 })).toEqual({ ok: false, error: 'This library file is from a newer version of the app.' });
});

test('parsePack rejects junk', () => expect(parsePack('hello').ok).toBe(false));
