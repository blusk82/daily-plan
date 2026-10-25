import { lightVersion, planSessions, progressionNotes } from '../../src/planner/exercisePlanner';
import { addDays, datesOfWeek, daysBetween } from '../../src/domain/dates';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import type { Completion, PlannedSession } from '../../src/domain/types';
import { SETTINGS, WEEK, sampleLib } from '../fixtures';

const lib = sampleLib();

test('each active routine item appears exactly timesPerWeek times in its session slot', () => {
  const s = planSessions(lib, SETTINGS, WEEK);
  for (const r of lib.routine.filter(r => r.active)) {
    const hits = s.filter(x => x.slot === r.session).flatMap(x => x.exercises).filter(e => e.exerciseId === r.exerciseId);
    expect(hits).toHaveLength(r.timesPerWeek);
  }
});
test('sessions use settings times and stable ids', () => {
  const s = planSessions(lib, SETTINGS, WEEK);
  expect(s.find(x => x.slot === 'morning')).toMatchObject({ time: '07:30', id: `${WEEK}-morning` });
  expect(s.find(x => x.slot === 'evening')!.time).toBe('20:00');
});
test('inactive routine items never appear', () => {
  const off = buildLibrary(SAMPLE_PACK, { ...emptyOverlay(), routineOverrides: { 'chin-tuck': { active: false } } });
  expect(planSessions(off, SETTINGS, WEEK).flatMap(s => s.exercises).some(e => e.exerciseId === 'chin-tuck')).toBe(false);
});
test('strength exercises sharing an area are never on consecutive days (≤3×/week)', () => {
  const s = planSessions(lib, SETTINGS, WEEK);
  for (const area of ['hip', 'back', 'feet', 'neck'] as const) {
    const days = [...new Set(s.filter(x => x.exercises.some(e => {
      const ex = lib.exercises.get(e.exerciseId)!; return ex.type === 'strength' && ex.areas.includes(area);
    })).map(x => x.date))].sort();
    for (let i = 1; i < days.length; i++) expect(daysBetween(days[i - 1], days[i])).toBeGreaterThanOrEqual(2);
  }
});
test('no session on a day with no exercises', () =>
  expect(planSessions(lib, SETTINGS, WEEK).every(s => s.exercises.length > 0)).toBe(true));
test('planSessions copies sets/reps/hold from the library unchanged', () => {
  for (const e of planSessions(lib, SETTINGS, WEEK).flatMap(s => s.exercises)) {
    const ex = lib.exercises.get(e.exerciseId)!;
    expect(e).toEqual({ exerciseId: ex.id, sets: ex.sets, reps: ex.reps, holdSecs: ex.holdSecs });
  }
});
test('locked sessions are kept', () => {
  const locked: PlannedSession = { id: `${WEEK}-morning`, date: WEEK, slot: 'morning', time: '06:00', exercises: [{ exerciseId: 'cat-cow' }], locked: true };
  expect(planSessions(lib, SETTINGS, WEEK, [locked])).toContainEqual(locked);
});
test('lightVersion drops strength exercises only', () => {
  const mixed: PlannedSession = { id: 'x', date: WEEK, slot: 'morning', time: '07:30', locked: false,
    exercises: [{ exerciseId: 'bridge' }, { exerciseId: 'cat-cow' }, { exerciseId: 'hip-flexor' }] };
  expect(lightVersion(mixed, lib).exercises.map(e => e.exerciseId)).toEqual(['cat-cow', 'hip-flexor']);
});

describe('progressionNotes', () => {
  const today = addDays(WEEK, 21 + 2); // Wednesday, three full weeks after WEEK
  const weeks = [WEEK, addDays(WEEK, 7), addDays(WEEK, 14)];
  const sessions = weeks.flatMap(w => planSessions(lib, SETTINGS, w));
  const doneFor = (ws: string[]): Completion[] => sessions
    .filter(s => ws.some(w => datesOfWeek(w).includes(s.date)))
    .flatMap(s => s.exercises.filter(e => e.exerciseId === 'bridge').map(e => ({
      itemId: `${s.id}:${e.exerciseId}`, kind: 'exercise' as const, date: s.date, status: 'done' as const, at: '' })));
  test('note after 3 consistent weeks', () => {
    expect(progressionNotes(doneFor(weeks), sessions, today, lib)).toEqual([
      { exerciseId: 'bridge', text: 'Done consistently for 3 weeks — ask your practitioner about the next level?' }]);
  });
  test('no note after only 2 weeks', () => expect(progressionNotes(doneFor(weeks.slice(1)), sessions, today, lib)).toEqual([]));
  test('uses the source practitioner name', () => {
    const physioLib = { ...lib, exercises: new Map(lib.exercises) };
    physioLib.exercises.set('bridge', { ...lib.exercises.get('bridge')!, source: 'physio' });
    expect(progressionNotes(doneFor(weeks), sessions, today, physioLib)[0].text).toBe('Done consistently for 3 weeks — ask your physio about the next level?');
  });
});
