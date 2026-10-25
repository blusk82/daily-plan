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
  await resetDb();
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  if (seed) await seed();
  return render(<App today={today} />);
}
