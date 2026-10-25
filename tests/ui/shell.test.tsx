import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings } from '../../src/db/repo';
import { TODAY, freshApp } from './helpers';

test('first run shows Setup; Start saves settings and shows the app', async () => {
  await freshApp({ setupDone: false });
  expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
  expect(screen.getByText(/Your data is only safe once the app is installed/)).toBeInTheDocument();
  const kcal = screen.getByLabelText('Calories per day');
  await userEvent.clear(kcal);
  await userEvent.type(kcal, '1700');
  await userEvent.click(screen.getByRole('button', { name: 'Sat' }));
  await userEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  expect(await getSettings()).toMatchObject({ setupDone: true, baseKcal: 1700, shopDay: 6 });
});

test('sample banner shows with the sample library', async () => {
  await freshApp();
  expect(await screen.findByText('Sample library — not your plan. Import your library in More → Library.')).toBeInTheDocument();
});

test('backup banner shows after 8 days', async () => {
  await freshApp({ setupDone: true, lastBackupAt: '2026-10-19T09:00:00' });
  expect(await screen.findByText('No backup for a week')).toBeInTheDocument();
});

test('no backup banner 1 day after a backup', async () => {
  await freshApp({ setupDone: true, lastBackupAt: '2026-10-26T09:00:00' });
  await screen.findByRole('navigation', { name: 'Main' });
  expect(screen.queryByText('No backup for a week')).not.toBeInTheDocument();
});

test('no backup banner right after setup', async () => {
  await freshApp({ setupDone: true, setupAt: `${TODAY}T08:00:00` });
  await screen.findByRole('navigation', { name: 'Main' });
  expect(screen.queryByText('No backup for a week')).not.toBeInTheDocument();
});

test('tabs switch screens', async () => {
  await freshApp();
  await userEvent.click(await screen.findByRole('button', { name: /Week/ }));
  expect(screen.getByRole('button', { name: /Week/ })).toHaveAttribute('aria-current', 'page');
});
