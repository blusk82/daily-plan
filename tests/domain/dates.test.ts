import { todayLocal, addDays, weekStartOf, planningWeekStart, addMinutes, weekday, datesOfWeek, compareDT } from '../../src/domain/dates';

test('todayLocal uses local date, not UTC (Brisbane 06:30 = UTC previous day)', () => {
  expect(todayLocal(new Date('2026-10-25T20:30:00Z'))).toBe('2026-10-26');
});
test('weekStartOf returns Monday', () => {
  expect(weekStartOf('2026-10-25')).toBe('2026-10-19');
  expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
});
test('planningWeekStart: Sunday plans tomorrow, Monday plans next week', () => {
  expect(planningWeekStart('2026-10-25')).toBe('2026-10-26');
  expect(planningWeekStart('2026-10-26')).toBe('2026-11-02');
  expect(planningWeekStart('2026-10-28')).toBe('2026-11-02');
});
test('addDays crosses month end', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'));
test('addMinutes crosses midnight backwards', () =>
  expect(addMinutes('2026-10-26', '00:30', -60)).toEqual({ date: '2026-10-25', time: '23:30' }));
test('weekday is 0 for Sunday', () => expect(weekday('2026-10-25')).toBe(0));
test('datesOfWeek gives 7 dates from Monday', () =>
  expect(datesOfWeek('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']));
test('compareDT orders by date then time', () => {
  expect(compareDT({ date: '2026-10-26', time: '07:00' }, { date: '2026-10-25', time: '21:00' })).toBeGreaterThan(0);
  expect(compareDT({ date: '2026-10-26', time: '07:00' }, { date: '2026-10-26', time: '08:00' })).toBeLessThan(0);
});
