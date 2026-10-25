import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportBackup } from '../../src/backup/backup';
import { getLibrary, getOverlay, getPantry, getSettings, proposeWeek, saveWeek } from '../../src/db/repo';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { planSessions } from '../../src/planner/exercisePlanner';
import type { WeekPlan } from '../../src/domain/types';
import { SETTINGS, inputs } from '../fixtures';
import { freshApp } from './helpers';

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

const tab = async (name: string) => userEvent.click(await screen.findByRole('button', { name: new RegExp(`${name}$`) }));
const upload = (input: HTMLElement, text: string, name = 'f.json') =>
  fireEvent.change(input, { target: { files: [new File([text], name, { type: 'application/json' })] } });

test('ticking a line on Shop shows it ticked on Today', async () => {
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
  await tab('Shop');
  expect(await screen.findByText('Top-up · Fri 30 Oct by 17:00')).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('group', { name: 'Salmon fillets' })).getByRole('button', { name: 'Mark done' }));
  await tab('Today');
  await userEvent.click(within(await screen.findByRole('group', { name: /^Shop · / })).getByRole('button', { name: /^Shop · / }));
  expect(await within(screen.getByRole('group', { name: 'Salmon fillets' })).findByRole('button', { name: 'Undo done' })).toBeInTheDocument();
});

test('adding pumpkin to the pantry puts it on the Use it up list for planning', async () => {
  await freshApp();
  await tab('Pantry');
  await userEvent.type(await screen.findByLabelText('Find an ingredient'), 'pump');
  await userEvent.click(screen.getByRole('button', { name: 'Add Pumpkin' }));
  await waitFor(async () => expect(await getPantry()).toEqual([{ ingredientId: 'pumpkin', useUp: true }]));
  const row = await screen.findByRole('group', { name: 'Pumpkin' });
  expect(within(row).getByRole('button', { name: 'Use it up' })).toHaveAttribute('aria-pressed', 'true');
  await tab('Week');
  await userEvent.click(await screen.findByRole('button', { name: 'Plan next week' }));
  expect(await screen.findByText('Pumpkin')).toBeInTheDocument();
});

test('removing a pantry item and setting a quantity', async () => {
  await freshApp();
  await tab('Pantry');
  await userEvent.type(await screen.findByLabelText('Find an ingredient'), 'feta');
  await userEvent.click(screen.getByRole('button', { name: 'Add Feta' }));
  const row = await screen.findByRole('group', { name: 'Feta' });
  await userEvent.type(within(row).getByLabelText('Amount of Feta (g)'), '200');
  await userEvent.tab();
  await waitFor(async () => expect((await getPantry())[0].qty).toBe(200));
  await userEvent.click(within(await screen.findByRole('group', { name: 'Feta' })).getByRole('button', { name: 'Remove Feta' }));
  await waitFor(async () => expect(await getPantry()).toEqual([]));
});

test('making an ingredient a staple keeps it off shopping lists', async () => {
  await freshApp();
  await tab('Pantry');
  await userEvent.type(await screen.findByLabelText('Find an ingredient'), 'rice');
  await userEvent.click(screen.getByRole('button', { name: 'Staple: Brown rice' }));
  await waitFor(async () => expect((await getSettings()).stapleIds).toEqual(['rice']));
});

test('turning an exercise off removes it from the next proposal', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Active: Sample: Chin tuck' }));
  await waitFor(async () => expect((await getOverlay()).routineOverrides['chin-tuck']).toEqual({ active: false }));
  const w = await proposeWeek(inputs({ weekStart: '2026-11-02' }), 5);
  expect(w.sessions.flatMap(s => s.exercises).some(e => e.exerciseId === 'chin-tuck')).toBe(false);
});

test('hiding and unhiding a recipe from the library', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Hide Sample: Banana oat smoothie' }));
  await waitFor(async () => expect((await getLibrary()).recipes.has('b-smoothie')).toBe(false));
  await userEvent.click(await screen.findByRole('button', { name: 'Unhide Sample: Banana oat smoothie' }));
  await waitFor(async () => expect((await getLibrary()).recipes.has('b-smoothie')).toBe(true));
});

test('importing an invalid pack shows the error and keeps the old library', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  upload(await screen.findByLabelText('Import library file'), '{"packVersion":1}');
  expect(await screen.findByRole('alert')).toHaveTextContent(/Not a valid library file/);
  expect(screen.getByText('SAMPLE library — not your plan')).toBeInTheDocument();
});

test('importing a valid pack switches the library', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  upload(await screen.findByLabelText('Import library file'), JSON.stringify({ ...SAMPLE_PACK, isSample: false, label: 'Ben library v1' }));
  expect(await screen.findByText('Imported “Ben library v1”.')).toBeInTheDocument();
  await waitFor(async () => expect((await getLibrary()).label).toBe('Ben library v1'));
});

test('adding a recipe puts it in the library', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Add recipe' }));
  const dlg = await screen.findByRole('dialog');
  await userEvent.type(within(dlg).getByLabelText('Name'), 'Chicken soup');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Dinner' }));
  for (const [label, v] of [['Serves', '4'], ['kcal per serve', '450'], ['Protein g', '35'], ['Carbs g', '40'], ['Fat g', '12'], ['Prep minutes', '30']]) {
    const el = within(dlg).getByLabelText(label);
    await userEvent.clear(el);
    await userEvent.type(el, v);
  }
  await userEvent.type(within(dlg).getByLabelText('Tags'), 'veg');
  await userEvent.type(within(dlg).getByLabelText('Ingredient 1'), 'Chicken breast');
  await userEvent.type(within(dlg).getByLabelText('Amount 1'), '500');
  await userEvent.type(within(dlg).getByLabelText('Method, one step per line'), 'Simmer everything');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Save recipe' }));
  await waitFor(async () => {
    const r = (await getOverlay()).userRecipes[0];
    expect(r).toMatchObject({ name: 'Chicken soup', slots: ['dinner'], serves: 4, perServe: { kcal: 450, protein: 35, carbs: 40, fat: 12 }, tags: ['veg'], source: 'user' });
    expect(r.ingredients).toEqual([{ ingredientId: 'chicken-breast', qty: 500 }]);
  });
});

test('adding an exercise puts it in the routine', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Library' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
  const dlg = await screen.findByRole('dialog');
  await userEvent.type(within(dlg).getByLabelText('Name'), 'Dead bug');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Back' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Strength' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Physio' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Save exercise' }));
  await waitFor(async () => {
    const lib = await getLibrary();
    const ex = [...lib.exercises.values()].find(e => e.name === 'Dead bug')!;
    expect(ex).toMatchObject({ areas: ['back'], type: 'strength', source: 'physio' });
    expect(lib.routine.find(r => r.exerciseId === ex.id)).toMatchObject({ active: true, timesPerWeek: 3, session: 'morning' });
  });
});

test('restore asks for confirmation before replacing', async () => {
  await freshApp();
  const { json } = await exportBackup();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  upload(await screen.findByLabelText('Restore backup'), json);
  const dlg = await screen.findByRole('dialog');
  expect(within(dlg).getByText('Replace everything on this phone with this backup?')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Replace' }));
  expect(await screen.findByText('Backup restored.')).toBeInTheDocument();
});

test('restore shows the error for a bad file', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  upload(await screen.findByLabelText('Restore backup'), 'nope');
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This file isn’t a Daily Plan backup.');
});

test('settings save the calorie target', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  const kcal = await screen.findByLabelText('Calories per day');
  await userEvent.clear(kcal);
  await userEvent.type(kcal, '1650');
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(async () => expect((await getSettings()).baseKcal).toBe(1650));
});

test('summary renders with no data', async () => {
  await freshApp();
  await tab('More');
  await userEvent.click(await screen.findByRole('button', { name: 'Appointment summary' }));
  expect(await screen.findByRole('heading', { name: 'Appointment summary' })).toBeInTheDocument();
  expect(screen.getByText('No skipped sessions with a reason.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '8 weeks' }));
  expect(screen.getAllByText(/^Week of /).length).toBeGreaterThanOrEqual(8);
});
