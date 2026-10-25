import { render } from '@testing-library/react';
import App from '../../src/ui/App';
import { resetDb } from '../../src/db/db';
import { DEFAULT_SETTINGS, saveSettings } from '../../src/db/repo';
import type { Settings } from '../../src/domain/types';

export const TODAY = '2026-10-27'; // a Tuesday

export async function freshApp(
  settings: Partial<Settings> = { setupDone: true, setupAt: `${TODAY}T08:00:00`, lastBackupAt: `${TODAY}T08:00:00` },
  today = TODAY,
  seed?: () => Promise<void>,
) {
  // Let any background loading from the previous test finish, so its writes
  // can't land after this test's reset and seed.
  await new Promise(r => setTimeout(r, 150));
  await resetDb();
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  if (seed) await seed();
  return render(<App today={today} />);
}
