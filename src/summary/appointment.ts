import { addDays, weekStartOf } from '../domain/dates';
import type { BodyArea, Completion, ISODate, Library, Reason, WeekPlan } from '../domain/types';

export interface AppointmentSummary {
  from: ISODate; to: ISODate;
  /** Sessions; planned − done − notDone = not recorded. */
  weeks: { weekStart: ISODate; planned: number; done: number; notDone: number }[];
  reasons: { reason: Reason; count: number }[];
  pain: { date: ISODate; area: BodyArea | 'unspecified'; value: number }[];
  flagged: { exerciseId: string; name: string; painCount: number }[];
}

const FLAG_PAIN = 4;
const FLAG_COUNT = 2;

const sessionOf = (c: Completion) => (c.kind === 'session' ? c.itemId : c.itemId.split(':')[0]);

export function summarise(from: ISODate, to: ISODate, weeks: WeekPlan[], completions: Completion[], lib: Library): AppointmentSummary {
  const inRange = completions.filter(c => c.date >= from && c.date <= to && (c.kind === 'session' || c.kind === 'exercise'));
  const sessions = weeks.flatMap(w => w.sessions).filter(s => s.date >= from && s.date <= to);

  const weekRows: AppointmentSummary['weeks'] = [];
  for (let w = weekStartOf(from); w <= to; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const here = sessions.filter(s => s.date >= w && s.date <= end);
    let done = 0, notDone = 0;
    for (const s of here) {
      const mine = inRange.filter(c => sessionOf(c) === s.id);
      if (mine.some(c => c.status === 'done')) done++;
      else if (mine.length) notDone++;
    }
    weekRows.push({ weekStart: w, planned: here.length, done, notDone });
  }

  const reasonCounts = new Map<Reason, number>();
  for (const c of inRange) if (c.status === 'not-done' && c.reason) reasonCounts.set(c.reason, (reasonCounts.get(c.reason) ?? 0) + 1);
  const reasons = [...reasonCounts].map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const pain = inRange.filter(c => c.pain !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => ({ date: c.date, area: c.area ?? ('unspecified' as const), value: c.pain! }));

  const painByExercise = new Map<string, number>();
  for (const c of inRange) {
    if (c.kind !== 'exercise') continue;
    if (c.reason === 'pain' || (c.pain ?? 0) >= FLAG_PAIN) {
      const id = c.itemId.split(':')[1];
      painByExercise.set(id, (painByExercise.get(id) ?? 0) + 1);
    }
  }
  const flagged = [...painByExercise].filter(([, n]) => n >= FLAG_COUNT)
    .map(([exerciseId, painCount]) => ({ exerciseId, name: lib.exercises.get(exerciseId)?.name ?? exerciseId, painCount }))
    .sort((a, b) => b.painCount - a.painCount);

  return { from, to, weeks: weekRows, reasons, pain, flagged };
}
