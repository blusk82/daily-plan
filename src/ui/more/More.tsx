import { useState } from 'react';
import { Header } from '../components';
import { useData } from '../data';
import { LibraryScreen } from './LibraryScreen';
import { SettingsScreen } from './SettingsScreen';
import { Summary } from './Summary';

type Sub = 'menu' | 'summary' | 'library' | 'settings';

export function More() {
  const { lib } = useData();
  const [sub, setSub] = useState<Sub>('menu');
  const back = () => setSub('menu');
  if (sub === 'summary') return <Summary onBack={back} />;
  if (sub === 'library') return <LibraryScreen onBack={back} />;
  if (sub === 'settings') return <SettingsScreen onBack={back} />;
  const item = (id: Sub, label: string, hint: string) => (
    <button type="button" className="list-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} aria-label={label} onClick={() => setSub(id)}>
      <span className="grow"><div className="tl-title">{label}</div><div className="tl-sub">{hint}</div></span>
      <span aria-hidden="true">›</span>
    </button>
  );
  return (
    <>
      <Header date="Daily Plan" title="More" />
      <div className="card">
        {item('summary', 'Appointment summary', 'Exercise done, skipped, why, and pain — to show your practitioner')}
        {item('library', 'Library', lib.label)}
        {item('settings', 'Settings', 'Times, calorie target, shop day, backup')}
      </div>
    </>
  );
}

export function BackRow({ onBack }: { onBack: () => void }) {
  return <button type="button" className="linkbtn" style={{ marginLeft: 14 }} onClick={onBack}>‹ More</button>;
}
