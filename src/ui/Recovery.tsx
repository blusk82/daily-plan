import { Component, useState, type ReactNode } from 'react';
import { importBackup } from '../backup/backup';
import { Header } from './components';
import { readFileText } from './derived';

/** Shown when the stored data can't be loaded or shown: never a dead end. */
export function RecoveryScreen({ error }: { error: unknown }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="screen">
      <Header date="Daily Plan" title="Problem" />
      <div className="banner red" role="alert">Something went wrong loading your data.</div>
      <div className="card" style={{ padding: 14, lineHeight: 1.5 }}>
        <p style={{ marginTop: 0 }}>Try again first. If it keeps happening, restore your latest backup.</p>
        <p className="tl-sub" style={{ overflowWrap: 'anywhere' }}>{String((error as Error)?.message ?? error)}</p>
        <button type="button" className="btn primary" onClick={() => location.reload()}>Try again</button>
      </div>
      {msg && <div className={`banner ${msg.ok ? 'backup' : 'red'}`} role="status">{msg.text}</div>}
      <div className="card">
        <label className="list-row">
          <span className="grow">Restore backup</span>
          <input type="file" accept="application/json,.json" aria-label="Restore backup" style={{ maxWidth: 170 }}
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = await importBackup(await readFileText(f));
              setMsg(r.ok ? { ok: true, text: 'Backup restored. Tap Try again.' } : { ok: false, text: r.error });
            }} />
        </label>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() { return this.state.error ? <RecoveryScreen error={this.state.error} /> : this.props.children; }
}
