import { backupDue, exportBackup, markBackedUp, shareOrDownload } from '../backup/backup';
import { useData } from './data';

export async function saveBackupNow(refresh: () => Promise<void>): Promise<boolean> {
  const { filename, json, stamp } = await exportBackup();
  const saved = await shareOrDownload(filename, json);
  if (saved) await markBackedUp(stamp);
  await refresh();
  return saved;
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
