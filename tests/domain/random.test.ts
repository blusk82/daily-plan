import { makeRng } from '../../src/domain/random';

test('makeRng is deterministic and in [0,1)', () => {
  const a = makeRng(42), b = makeRng(42);
  const xs = [a(), a(), a()];
  expect(xs).toEqual([b(), b(), b()]);
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  expect(makeRng(1)()).not.toBe(makeRng(2)());
});
