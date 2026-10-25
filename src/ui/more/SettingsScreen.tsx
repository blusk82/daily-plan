import { useEffect, useState } from 'react';
import { importBackup } from '../../backup/backup';
import { saveSettings } from '../../db/repo';
import type { Settings } from '../../domain/types';
import { saveBackupNow } from '../Banners';
import { Chip, Header, Sheet } from '../components';
import { useData } from '../data';
import { readFileText } from '../derived';
import { DAYS_SHORT, TimesEditor } from '../Setup';
import { BackRow } from './More';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, refresh } = useData();
  const [s, setS] = useState<Settings>(settings);
  const [kcalText, setKcalText] = useState(String(settings.baseKcal));
  const [burnText, setBurnText] = useState(String(settings.higherBurnKcal));
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const kcal = Number(kcalText), burn = Number(burnText);

  // Reload the form whenever stored settings change (e.g. after a restore).
  useEffect(() => {
    setS(settings);
    setKcalText(String(settings.baseKcal));
    setBurnText(String(settings.higherBurnKcal));
  }, [settings]);
  const valid = kcal >= 1000 && kcal <= 4000 && burn >= 0 && burn <= 2000;

  async function save() {
    await saveSettings({ ...s, baseKcal: kcal, higherBurnKcal: burn, lastBackupAt: settings.lastBackupAt });
    await refresh();
    setMsg({ ok: true, text: 'Settings saved. New plans use them; this week’s plan is unchanged.' });
  }

  async function restore() {
    const json = pendingRestore!;
    setPendingRestore(null);
    const r = await importBackup(json);
    if (r.ok) { setMsg({ ok: true, text: 'Backup restored.' }); await refresh(); }
    else setMsg({ ok: false, text: r.error });
  }

  return (
    <>
      <Header date="More" title="Settings" />
      <BackRow onBack={onBack} />
      {msg && <div className={`banner ${msg.ok ? 'backup' : 'red'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}
      <div className="section-title">Targets</div>
      <div className="card">
        <label className="field"><span>Calories per day</span>
          <input type="number" inputMode="numeric" aria-label="Calories per day" value={kcalText} onChange={e => setKcalText(e.target.value)} /></label>
        <label className="field"><span>Higher-burn day extra</span>
          <input type="number" inputMode="numeric" aria-label="Higher-burn extra kcal" value={burnText} onChange={e => setBurnText(e.target.value)} /></label>
      </div>
      <div className="section-title">Main shop day</div>
      <div className="card" style={{ padding: 12 }}>
        <div className="chips">{DAYS_SHORT.map((d, i) => <Chip key={d} on={s.shopDay === i} onClick={() => setS({ ...s, shopDay: i })}>{d}</Chip>)}</div>
      </div>
      <div className="section-title">Usual times</div>
      <TimesEditor times={s.times} onChange={times => setS({ ...s, times })} />
      <button type="button" className="btn primary block" disabled={!valid} onClick={save}>Save settings</button>

      <div className="section-title">Backup</div>
      <div className="card">
        <div className="list-row">
          <span className="grow tl-sub">{settings.lastBackupAt ? `Last backup ${settings.lastBackupAt.slice(0, 10)}` : 'No backup yet'}</span>
          <button type="button" className="btn small primary" onClick={() => saveBackupNow(refresh)}>Save backup</button>
        </div>
        <label className="list-row">
          <span className="grow">Restore backup</span>
          <input type="file" accept="application/json,.json" aria-label="Restore backup" style={{ maxWidth: 170 }}
            onChange={async e => { const f = e.target.files?.[0]; if (f) setPendingRestore(await readFileText(f)); e.target.value = ''; }} />
        </label>
      </div>
      {pendingRestore !== null && (
        <Sheet title="Restore backup" onClose={() => setPendingRestore(null)}>
          <p>Replace everything on this phone with this backup?</p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setPendingRestore(null)}>Cancel</button>
            <button type="button" className="btn primary" onClick={restore}>Replace</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
