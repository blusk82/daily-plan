import { addDays, datesOfWeek, weekStartOf } from '../domain/dates';
import type { BodyArea, Completion, ISODate, Library, PlannedSession, RoutineItem, SessionSlot, Settings } from '../domain/types';

const SLOTS: SessionSlot[] = ['morning', 'evening'];

/**
 * Spread each routine item over the week. Practitioners set the routine; this
 * only decides which days, never sets, reps or difficulty.
 */
export function planSessions(lib: Library, settings: Settings, weekStart: ISODate, locked: PlannedSession[] = []): PlannedSession[] {
  const dates = datesOfWeek(weekStart);
  const out: PlannedSession[] = [];

  for (const slot of SLOTS) {
    const lockedHere = new Map(locked.filter(s => s.slot === slot && dates.includes(s.date)).map(s => [s.date, s]));
    const items = lib.routine.filter(r => r.session === slot && r.active && lib.exercises.get(r.exerciseId) && !lib.exercises.get(r.exerciseId)!.retired);
    const isStrength = (r: RoutineItem) => lib.exercises.get(r.exerciseId)!.type === 'strength';
    // Strength first (most constrained), then by frequency.
    const ordered = [...items].sort((a, b) => Number(isStrength(b)) - Number(isStrength(a)) || b.timesPerWeek - a.timesPerWeek);

    const dayItems: RoutineItem[][] = dates.map(() => []);
    const strengthAreas: Set<BodyArea>[] = dates.map(() => new Set());

    for (const item of ordered) {
      const ex = lib.exercises.get(item.exerciseId)!;
      const t = Math.min(7, item.timesPerWeek);
      let bestDays: number[] = [];
      let bestScore = Infinity;
      for (let offset = 0; offset < 7; offset++) {
        const days = Array.from({ length: t }, (_, i) => (offset + Math.floor((i * 7) / t)) % 7).sort((a, b) => a - b);
        let score = days.reduce((a, d) => a + dayItems[d].length ** 2, 0);
        if (ex.type === 'strength' && t <= 3) {
          for (const d of days) for (const n of [d - 1, d + 1]) {
            if (n >= 0 && n < 7 && !days.includes(n) && ex.areas.some(a => strengthAreas[n].has(a))) score += 1000;
          }
          // Prefer sharing days with same-area strength so rest days stay free.
          for (const d of days) if (ex.areas.some(a => strengthAreas[d].has(a))) score -= 5;
        }
        if (score < bestScore) { bestScore = score; bestDays = days; }
      }
      for (const d of bestDays) {
        dayItems[d].push(item);
        if (ex.type === 'strength') ex.areas.forEach(a => strengthAreas[d].add(a));
      }
    }

    dates.forEach((date, d) => {
      const lockedSession = lockedHere.get(date);
      if (lockedSession) { out.push(lockedSession); return; }
      if (!dayItems[d].length) return;
      // Keep routine order within a session.
      const inOrder = items.filter(r => dayItems[d].includes(r));
      out.push({
        id: `${date}-${slot}`, date, slot, time: settings.times[slot], locked: false,
        exercises: inOrder.map(r => {
          const ex = lib.exercises.get(r.exerciseId)!;
          return { exerciseId: ex.id, sets: ex.sets, reps: ex.reps, holdSecs: ex.holdSecs };
        }),
      });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}

/** On a red recovery day: mobility and stretching only. Never stored. */
export function lightVersion(s: PlannedSession, lib: Library): PlannedSession {
  return { ...s, exercises: s.exercises.filter(e => lib.exercises.get(e.exerciseId)?.type !== 'strength') };
}

export const exerciseItemId = (sessionId: string, exerciseId: string) => `${sessionId}:${exerciseId}`;

const PRACTITIONER: Record<string, string> = { physio: 'physio', osteo: 'osteo', podiatrist: 'podiatrist' };

/**
 * A nudge, never a change: exercises done in at least 80% of their planned
 * sessions in each of the last three full weeks.
 */
export function progressionNotes(completions: Completion[], sessions: PlannedSession[], today: ISODate, lib: Library): { exerciseId: string; text: string }[] {
  const thisWeek = weekStartOf(today);
  const weeks = [21, 14, 7].map(n => addDays(thisWeek, -n));
  const done = new Set(completions.filter(c => c.kind === 'exercise' && c.status === 'done').map(c => c.itemId));
  const exerciseIds = [...new Set(sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))];

  const notes: { exerciseId: string; text: string }[] = [];
  for (const id of exerciseIds) {
    const consistent = weeks.every(w => {
      const dates = datesOfWeek(w);
      const planned = sessions.filter(s => dates.includes(s.date) && s.exercises.some(e => e.exerciseId === id));
      if (!planned.length) return false;
      const did = planned.filter(s => done.has(exerciseItemId(s.id, id))).length;
      return did / planned.length >= 0.8;
    });
    if (consistent) {
      const who = PRACTITIONER[lib.exercises.get(id)?.source ?? ''] ?? 'practitioner';
      notes.push({ exerciseId: id, text: `Done consistently for 3 weeks — ask your ${who} about the next level?` });
    }
  }
  return notes;
}
