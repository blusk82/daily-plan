import { backupDue, exportBackup, shareOrDownload } from '../backup/backup';
import { useData } from './data';

export async function saveBackupNow(refresh: () => Promise<void>): Promise<void> {
  const { filename, json } = await exportBackup();
  await shareOrDownload(filename, json);
  await refresh();
}

export function Banners() {
  const { lib, settings, today, refresh } = useData();
  const due = backupDue({ ...settings, lastBackupAt: settings.lastBackupAt ?? settings.setupAt }, today);
  return (
    <>
      {lib.isSample && (
        <div className="banner sample" role="note">Sample library — not your plan. Import your library in More → Library.</div>
      )}
      {due && (
        <div className="banner backup" role="note">
          <span>No backup for a week</span>
          <button type="button" className="btn small primary" onClick={() => saveBackupNow(refresh)}>Save backup</button>
        </div>
      )}
    </>
  );
}
