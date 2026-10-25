import { useState } from 'react';
import type { ISODate } from '../domain/types';
import { Banners } from './Banners';
import { DataProvider, useData } from './data';
import { Nav, type Tab } from './Nav';
import { Setup } from './Setup';
import { Today } from './today/Today';
import { Week } from './week/Week';
import './theme.css';

function Placeholder({ title }: { title: string }) {
  return <h1 style={{ padding: 18 }}>{title}</h1>;
}

function Shell() {
  const { settings } = useData();
  const [tab, setTab] = useState<Tab>('today');
  if (!settings.setupDone) return <Setup />;
  return (
    <>
      <main className="screen">
        {tab === 'today' && <Today />}
        {tab === 'week' && <Week />}
        {tab === 'shop' && <Placeholder title="Shop" />}
        {tab === 'pantry' && <Placeholder title="Pantry" />}
        {tab === 'more' && <Placeholder title="More" />}
        <Banners />
      </main>
      <Nav tab={tab} onTab={setTab} />
    </>
  );
}

export default function App({ today }: { today?: ISODate }) {
  return (
    <div className="app">
      <DataProvider today={today}>
        <Shell />
      </DataProvider>
    </div>
  );
}
