import type { HHMM, ISODate } from './types';

// All dates are local calendar dates. Never use toISOString(): in UTC+10
// (UTC+10) it reports yesterday's date before 10am.

const pad = (n: number) => String(n).padStart(2, '0');

function parse(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function format(dt: Date): ISODate {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function todayLocal(now: Date = new Date()): ISODate {
  return format(now);
}

export function nowTime(now: Date = new Date()): HHMM {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = parse(d);
  dt.setDate(dt.getDate() + n);
  return format(dt);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: ISODate): number {
  return parse(d).getDay();
}

export function weekStartOf(d: ISODate): ISODate {
  return addDays(d, -((weekday(d) + 6) % 7));
}

/** The Monday after today (Sunday → tomorrow, Monday → a week later). */
export function planningWeekStart(today: ISODate): ISODate {
  return addDays(weekStartOf(today), 7);
}

export function datesOfWeek(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function toMinutes(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number): HHMM {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

export function addMinutes(date: ISODate, time: HHMM, mins: number): { date: ISODate; time: HHMM } {
  const total = toMinutes(time) + mins;
  const dayShift = Math.floor(total / 1440);
  return { date: addDays(date, dayShift), time: fromMinutes(total - dayShift * 1440) };
}

export function compareDT(a: { date: ISODate; time: HHMM }, b: { date: ISODate; time: HHMM }): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : toMinutes(a.time) - toMinutes(b.time);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayName(d: ISODate): string {
  return DAY_NAMES[weekday(d)];
}

/** "Sunday 25 Oct" */
export function longDate(d: ISODate): string {
  const dt = parse(d);
  return `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** "Sun 25 Oct" */
export function shortDate(d: ISODate): string {
  const dt = parse(d);
  return `${DAY_NAMES[dt.getDay()].slice(0, 3)} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}
