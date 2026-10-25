import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ensureWeek, getOverlay, getSettings, getWeek, proposeWeek, saveWeek } from '../../src/db/repo';
import { brokenLeftovers } from '../../src/planner/adjust';
import { inputs } from '../fixtures';
import { freshApp } from './helpers';

const NEXT = '2026-11-02';
const THIS = '2026-10-26';

beforeAll(() => {
  // jsdom has no object URLs; the backup falls back to a download link.
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

async function openPlanning() {
  await userEvent.click(await screen.findByRole('button', { name: /^Week$|Week/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Plan next week' }));
}

async function makeWeek() {
  await openPlanning();
  await userEvent.click(await screen.findByRole('button', { name: 'Make my week →' }));
  await screen.findByRole('button', { name: 'Looks good →' });
}

test('step 1 is prefilled from the last week (shop day, busy weekdays)', async () => {
  await freshApp(undefined, undefined, async () => { await proposeWeek(inputs({ weekStart: THIS, shopDay: 6, busyDates: ['2026-10-27'] }), 3); });
  await openPlanning();
  const shop = await screen.findByRole('group', { name: 'Main shop day' });
  expect(within(shop).getByRole('button', { name: 'Sat' })).toHaveAttribute('aria-pressed', 'true');
  const busy = screen.getByRole('group', { name: 'Busy nights' });
  expect(within(busy).getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'true');
});

test('Make my week produces a proposal using the chosen inputs', async () => {
  await freshApp();
  await openPlanning();
  const guests = await screen.findByRole('group', { name: 'Guests at dinner' });
  await userEvent.click(within(guests).getByRole('button', { name: 'Fri +2' }));
  await userEvent.click(screen.getByRole('button', { name: 'Make my week →' }));
  await screen.findByRole('button', { name: 'Looks good →' });
  const w = (await getWeek(NEXT))!;
  expect(w.status).toBe('proposal');
  expect(w.inputs.guests['2026-11-06|dinner']).toBe(2);
  expect(w.meals.find(m => m.id === '2026-11-06-dinner')!.guests).toBe(2);
});

test('swap replaces a meal with an alternative', async () => {
  await freshApp();
  await makeWeek();
  const before = (await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.recipeId;
  await userEvent.click(screen.getByRole('button', { name: 'Swap Dinner' }));
  const dlg = await screen.findByRole('dialog');
  const options = within(dlg).getAllByRole('button', { name: /^Use / });
  await userEvent.click(options[0]);
  await waitFor(async () => expect((await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.recipeId).not.toBe(before));
});

test('a locked meal survives Regenerate', async () => {
  await freshApp();
  await makeWeek();
  const before = (await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.recipeId;
  await userEvent.click(screen.getByRole('button', { name: 'Lock Dinner' }));
  await waitFor(async () => expect((await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.locked).toBe(true));
  const seedBefore = (await getWeek(NEXT))!.seed;
  await userEvent.click(screen.getByRole('button', { name: 'Regenerate unlocked' }));
  await waitFor(async () => expect((await getWeek(NEXT))!.seed).not.toBe(seedBefore));
  const after = (await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!;
  expect(after.recipeId).toBe(before);
  expect(after.locked).toBe(true);
});

test("Don't suggest again hides the recipe and swaps the meal", async () => {
  await freshApp();
  await makeWeek();
  const before = (await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.recipeId;
  await userEvent.click(screen.getByRole('button', { name: 'Swap Dinner' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: "Don't suggest again" }));
  await waitFor(async () => expect((await getOverlay()).hiddenRecipeIds).toContain(before));
  await waitFor(async () => expect((await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.recipeId).not.toBe(before));
});

test('Confirm and save backup confirms the week and records the backup', async () => {
  await freshApp();
  await makeWeek();
  await userEvent.click(screen.getByRole('button', { name: 'Looks good →' }));
  expect(await screen.findByText(/^Main shop · /)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm and save backup' }));
  await waitFor(async () => expect((await getWeek(NEXT))!.status).toBe('confirmed'));
  await waitFor(async () => expect((await getSettings()).lastBackupAt).toBeDefined());
  await screen.findByRole('button', { name: 'Plan next week' }); // back on the overview: all saving finished
});

test('a broken leftover shows the re-plan prompt and re-planning clears it', async () => {
  await freshApp(undefined, undefined, async () => {
    const w = await ensureWeek(THIS, 1);
    const src = w.meals.find(m => m.date >= '2026-10-27' && w.meals.some(l => l.leftoverOf === m.id))!;
    await saveWeek({ ...w, meals: w.meals.map(m => (m.id === src.id ? { ...m, eatingOut: true, recipeId: '', portion: 0 } : m)) });
  });
  await userEvent.click(await screen.findByRole('button', { name: /Week/ }));
  expect(await screen.findByText('A leftover meal lost its source — re-plan?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Re-plan rest of week' }));
  await waitFor(async () => expect(brokenLeftovers((await getWeek(THIS))!)).toEqual([]));
  await waitFor(() => expect(screen.queryByText('A leftover meal lost its source — re-plan?')).not.toBeInTheDocument());
});

test('eating out from the review sheet marks the meal', async () => {
  await freshApp();
  await makeWeek();
  await userEvent.click(screen.getByRole('button', { name: 'Swap Dinner' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eating out' }));
  await waitFor(async () => expect((await getWeek(NEXT))!.meals.find(m => m.id === `${NEXT}-dinner`)!.eatingOut).toBe(true));
});
