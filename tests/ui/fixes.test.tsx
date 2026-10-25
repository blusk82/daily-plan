// UI regression tests for the final review's findings.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportBackup } from '../../src/backup/backup';
import { db } from '../../src/db/db';
import { completionsBetween, DEFAULT_SETTINGS, getSettings, saveSettings } from '../../src/db/repo';
import { planSessions } from '../../src/planner/exercisePlanner';
import { buildLibrary, emptyOverlay } from '../../src/library/merge';
import { SAMPLE_PACK } from '../../src/library/sample-pack';
import { saveBackupNow } from '../../src/ui/Banners';
import { TODAY, freshApp } from './helpers';

const lib = buildLibrary(SAMPLE_PACK, emptyOverlay());

// Important 5
test('ticking the lighter session on a red day records no strength exercises', async () => {
  // A day whose morning session includes strength work, so the test means something.
  const day = planSessions(lib, { ...DEFAULT_SETTINGS }, '2026-10-26')
    .find(s => s.slot === 'morning' && s.exercises.some(e => lib.exercises.get(e.exerciseId)!.type === 'strength'))!.date;
  await freshApp(undefined, day);
  await userEvent.click(await screen.findByRole('button', { name: 'Red recovery' }));
  await screen.findAllByText(/lighter today$/);
  const session = screen.getByRole('group', { name: /^Exercise · / });
  await userEvent.click(within(session).getByRole('button', { name: 'Mark done' }));
  await waitFor(async () => expect((await completionsBetween(day, day)).some(c => c.kind === 'session')).toBe(true));
  const ex = (await completionsBetween(day, day)).filter(c => c.kind === 'exercise');
  expect(ex.length).toBeGreaterThan(0);
  for (const c of ex) expect(lib.exercises.get(c.itemId.split(':')[1])!.type).not.toBe('strength');
});

// Promoted minor: undoing a session tick keeps exercises ticked one by one
test('undoing a session tick keeps an exercise that was ticked on its own', async () => {
  await freshApp();
  await userEvent.click(within(await screen.findByRole('group', { name: /^Exercise · / })).getByRole('button', { name: /^Exercise · / }));
  await userEvent.click(within(await screen.findByRole('group', { name: 'Sample: Chin tuck' })).getByRole('button', { name: 'Mark done' }));
  await waitFor(async () => expect(await completionsBetween(TODAY, TODAY)).toHaveLength(1));
  const session = screen.getByRole('group', { name: /^Exercise · / });
  await userEvent.click(within(session).getByRole('button', { name: 'Mark done' }));
  await userEvent.click(await within(screen.getByRole('group', { name: /^Exercise · / })).findByRole('button', { name: 'Undo done' }));
  await waitFor(async () => expect((await completionsBetween(TODAY, TODAY)).map(c => c.itemId)).toEqual([`${TODAY}-morning:chin-tuck`]));
});

// Important 7
test('cancelling the share sheet does not count as a backup', async () => {
  const nav = navigator as Navigator & { canShare?: unknown; share?: unknown };
  const saved = { canShare: nav.canShare, share: nav.share };
  Object.assign(navigator, { canShare: () => true, share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) });
  try {
    await freshApp({ setupDone: true, lastBackupAt: '2026-10-01T09:00:00' });
    await screen.findByRole('navigation', { name: 'Main' }); // let the app finish its own loading first
    expect(await saveBackupNow(async () => {})).toBe(false);
    expect((await getSettings()).lastBackupAt).toBe('2026-10-01T09:00:00');
  } finally {
    Object.assign(navigator, saved);
  }
});

// Promoted minor: an error must not leave the app stuck with no way to restore
test('a data error shows a recovery screen with Restore, not an endless Loading', async () => {
  await freshApp(undefined, undefined, async () => {
    await db.weeks.put({ weekStart: '2026-10-26', status: 'confirmed' } as never); // corrupt: no meals/sessions
  });
  expect(await screen.findByText('Something went wrong loading your data.')).toBeInTheDocument();
  expect(screen.getByLabelText('Restore backup')).toBeInTheDocument();
});

// Promoted minor: Settings must not undo a restore
test('after a restore, Settings shows the restored values', async () => {
  await freshApp();
  await saveSettings({ ...(await getSettings()), baseKcal: 1550 });
  const { json } = await exportBackup();
  await saveSettings({ ...(await getSettings()), baseKcal: 2000 });
  await userEvent.click(await screen.findByRole('button', { name: /More$/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(await screen.findByLabelText('Restore backup'), { target: { files: [new File([json], 'b.json')] } });
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace' }));
  await screen.findByText('Backup restored.');
  await waitFor(() => expect(screen.getByLabelText('Calories per day')).toHaveValue(1550));
});
