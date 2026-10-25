import { useState } from 'react';
import type { ISODate } from '../domain/types';
import { DataProvider, useData } from './data';
import { Nav, type Tab } from './Nav';
import { Setup } from './Setup';
import { Today } from './today/Today';
import { Week } from './week/Week';
import { Shop } from './shop/Shop';
import { Pantry } from './pantry/Pantry';
import { More } from './more/More';
import './theme.css';

function Shell() {
  const { settings } = useData();
  const [tab, setTab] = useState<Tab>('today');
  if (!settings.setupDone) return <Setup />;
  return (
    <>
      <main className="screen">
        {tab === 'today' && <Today />}
        {tab === 'week' && <Week />}
        {tab === 'shop' && <Shop />}
        {tab === 'pantry' && <Pantry />}
        {tab === 'more' && <More />}
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
