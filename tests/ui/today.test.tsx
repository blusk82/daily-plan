import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { completionsBetween, getWeek, saveWeek } from '../../src/db/repo';
import { planSessions } from '../../src/planner/exercisePlanner';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import type { WeekPlan } from '../../src/domain/types';
import { SETTINGS, inputs } from '../fixtures';
import { TODAY, freshApp } from './helpers';

const row = (name: string | RegExp) => screen.getByRole('group', { name });
const findRow = (name: string | RegExp) => screen.findByRole('group', { name });

test('tapping a meal tick marks it done and tapping again undoes', async () => {
  await freshApp();
  const breakfast = await findRow(/^Breakfast/);
  await userEvent.click(within(breakfast).getByRole('button', { name: 'Mark done' }));
  await waitFor(async () => expect((await completionsBetween(TODAY, TODAY)).map(c => c.itemId)).toEqual([`${TODAY}-breakfast`]));
  await userEvent.click(await within(await findRow(/^Breakfast/)).findByRole('button', { name: 'Undo done' }));
  await waitFor(async () => expect(await completionsBetween(TODAY, TODAY)).toEqual([]));
});

test('not-done exercise: pain 4, Hip, then Pain saves all three', async () => {
  await freshApp();
  await userEvent.click(within(await findRow(/^Exercise · /)).getByRole('button', { name: /^Exercise · / }));
  const ex = await findRow('Sample: Chin tuck');
  await userEvent.click(within(ex).getByRole('button', { name: 'Not done' }));
  const dlg = await screen.findByRole('dialog');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Pain 4' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Hip' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Pain' }));
  await waitFor(async () => {
    const c = (await completionsBetween(TODAY, TODAY)).find(c => c.itemId.endsWith(':chin-tuck'))!;
    expect(c).toMatchObject({ kind: 'exercise', status: 'not-done', reason: 'pain', pain: 4, area: 'hip' });
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('meal not done offers Ate out and saves in one tap', async () => {
  await freshApp();
  await userEvent.click(within(await findRow(/^Lunch/)).getByRole('button', { name: 'Not done' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ate out' }));
  await waitFor(async () => expect((await completionsBetween(TODAY, TODAY))[0]).toMatchObject({ reason: 'ate-out', status: 'not-done' }));
  expect(within(await findRow(/^Lunch/)).getByText('Not done · Ate out')).toBeInTheDocument();
});

test('Other… needs text and Save', async () => {
  await freshApp();
  await userEvent.click(within(await findRow(/^Dinner/)).getByRole('button', { name: 'Not done' }));
  const dlg = await screen.findByRole('dialog');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Other…' }));
  await userEvent.type(within(dlg).getByRole('textbox'), 'Visiting family');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
  await waitFor(async () => expect((await completionsBetween(TODAY, TODAY))[0]).toMatchObject({ reason: 'other', otherText: 'Visiting family' }));
});

test('red recovery shows a lighter session without strength exercises; full session restores', async () => {
  await freshApp();
  await userEvent.click(await screen.findByRole('button', { name: 'Red recovery' }));
  expect(await screen.findByText('Red recovery — lighter session suggested.')).toBeInTheDocument();
  const lib = buildLibrary(SAMPLE_PACK, emptyOverlay());
  const strengthNames = [...lib.exercises.values()].filter(e => e.type === 'strength').map(e => e.name);
  const session = await findRow(/^Exercise · /);
  expect(within(session).getByText(/lighter today$/)).toBeInTheDocument();
  await userEvent.click(within(session).getByRole('button', { name: /^Exercise · / }));
  for (const n of strengthNames) expect(screen.queryByRole('group', { name: n })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Use full session' }));
  expect(screen.queryByText(/lighter today$/)).not.toBeInTheDocument();
});

test('shop row appears before the dinner that needs it and ticking it ticks every line', async () => {
  const FRI = '2026-10-30';
  const lib = buildLibrary(SAMPLE_PACK, emptyOverlay());
  await freshApp(undefined, FRI, async () => {
    const plan: WeekPlan = {
      weekStart: '2026-10-26', status: 'confirmed', inputs: inputs(), checks: [], weekViolations: [], seed: 1,
      meals: [{ id: `${FRI}-dinner`, date: FRI, slot: 'dinner', time: '18:30', recipeId: 'd-lemon-salmon', portion: 1, guests: 1, locked: false }],
      sessions: planSessions(lib, SETTINGS, '2026-10-26'),
    };
    await saveWeek(plan);
  });
  const groups = await screen.findAllByRole('group');
  const names = groups.map(g => g.getAttribute('aria-label'));
  const shopIdx = names.findIndex(n => n?.startsWith('Shop · '));
  const dinnerIdx = names.findIndex(n => n?.startsWith('Dinner'));
  expect(shopIdx).toBeGreaterThanOrEqual(0);
  expect(shopIdx).toBeLessThan(dinnerIdx);
  expect(within(groups[shopIdx]).getByText("needed for tonight's dinner")).toBeInTheDocument();
  await userEvent.click(within(groups[shopIdx]).getByRole('button', { name: 'Mark done' }));
  await waitFor(async () => {
    const ids = (await completionsBetween(FRI, FRI)).map(c => c.itemId).sort();
    expect(ids).toEqual([`${FRI}:top-up`, `${FRI}:top-up:salmon`]);
  });
});

test('moving dinner to 19:30 persists for that date', async () => {
  await freshApp();
  await userEvent.click(within(await findRow(/^Dinner/)).getByRole('button', { name: /Change time/ }));
  const dlg = await screen.findByRole('dialog');
  const input = within(dlg).getByLabelText('Time');
  await userEvent.clear(input);
  await userEvent.type(input, '19:30');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
  await waitFor(async () => expect((await getWeek('2026-10-26'))!.meals.find(m => m.id === `${TODAY}-dinner`)!.time).toBe('19:30'));
});

test('tapping a meal opens its recipe with your portion', async () => {
  await freshApp();
  const dinner = await findRow(/^Dinner/);
  await userEvent.click(within(dinner).getByRole('button', { name: /^Dinner/ }));
  const dlg = await screen.findByRole('dialog');
  expect(within(dlg).getByText(/^Your portion: ×/)).toBeInTheDocument();
  expect(within(dlg).getByText('Ingredients')).toBeInTheDocument();
});

test('row for an item done shows the undo control after reload', async () => {
  await freshApp();
  await userEvent.click(within(await findRow(/^Breakfast/)).getByRole('button', { name: 'Mark done' }));
  expect(await within(await findRow(/^Breakfast/)).findByRole('button', { name: 'Undo done' })).toBeInTheDocument();
});

test('row is visible for every main meal today', async () => {
  await freshApp();
  for (const n of [/^Breakfast/, /^Lunch/, /^Dinner/]) expect(await findRow(n)).toBeInTheDocument();
  expect(row(/^Exercise · /)).toBeInTheDocument();
});
