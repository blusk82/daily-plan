import { summarise } from '../../src/summary/appointment';
import { planSessions } from '../../src/planner/exercisePlanner';
import type { Completion, WeekPlan } from '../../src/domain/types';
import { MON, SETTINGS, inputs, sampleLib } from '../fixtures';

const lib = sampleLib();
const week = (start: string): WeekPlan => ({ weekStart: start, status: 'confirmed', inputs: inputs({ weekStart: start }), meals: [],
  sessions: planSessions(lib, SETTINGS, start), checks: [], weekViolations: [], seed: 1 });
const W1 = week(MON), W2 = week('2026-11-02');
const c = (itemId: string, date: string, extra: Partial<Completion>): Completion =>
  ({ itemId, kind: 'exercise', date, status: 'done', at: '', ...extra });

const s1 = W1.sessions[0], s2 = W1.sessions[1], s3 = W2.sessions[0];
const completions: Completion[] = [
  c(s1.id, s1.date, { kind: 'session', status: 'done' }),
  c(s2.id, s2.date, { kind: 'session', status: 'not-done', reason: 'no-time' }),
  c(`${s3.id}:bridge`, s3.date, { status: 'not-done', reason: 'pain', pain: 5, area: 'hip' }),
  c(`${W2.sessions[2].id}:bridge`, W2.sessions[2].date, { status: 'not-done', reason: 'pain', pain: 3, area: 'back' }),
  c(`${W2.sessions[4].id}:cat-cow`, W2.sessions[4].date, { status: 'done', pain: 2 }),
  c(`${W2.sessions[3].id}:chin-tuck`, W2.sessions[3].date, { status: 'not-done', reason: 'no-time' }),
];

test('weekly session counts', () => {
  const s = summarise(MON, '2026-11-08', [W1, W2], completions, lib);
  expect(s.weeks[0]).toEqual({ weekStart: MON, planned: W1.sessions.length, done: 1, notDone: 1 });
  expect(s.weeks[1].weekStart).toBe('2026-11-02');
  expect(s.weeks[1].done).toBe(1);     // the session with a done exercise
  expect(s.weeks[1].notDone).toBe(3);  // sessions with only not-done exercises
});
test('reasons sorted by count, descending', () => {
  expect(summarise(MON, '2026-11-08', [W1, W2], completions, lib).reasons).toEqual([
    { reason: 'no-time', count: 2 }, { reason: 'pain', count: 2 }]);
});
test('pain series per area, in date order', () => {
  const pain = summarise(MON, '2026-11-08', [W1, W2], completions, lib).pain;
  expect(pain.map(p => p.area)).toEqual(['hip', 'back', 'unspecified']);
  expect(pain.map(p => p.value)).toEqual([5, 3, 2]);
});
test('exercise with two pain entries is flagged', () => {
  expect(summarise(MON, '2026-11-08', [W1, W2], completions, lib).flagged).toEqual([
    { exerciseId: 'bridge', name: 'Sample: Glute bridge', painCount: 2 }]);
});
test('period with no data returns zeroed weeks, not an error', () => {
  const s = summarise('2027-01-04', '2027-01-17', [], [], lib);
  expect(s.weeks).toEqual([{ weekStart: '2027-01-04', planned: 0, done: 0, notDone: 0 }, { weekStart: '2027-01-11', planned: 0, done: 0, notDone: 0 }]);
  expect(s.reasons).toEqual([]);
  expect(s.flagged).toEqual([]);
});
