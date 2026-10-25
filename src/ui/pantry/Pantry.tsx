import { useState } from 'react';
import { removePantryItem, savePantryItem, saveSettings } from '../../db/repo';
import type { PantryItem } from '../../domain/types';
import { Header } from '../components';
import { useData } from '../data';

/** Things to use up, plus staples that never go on the list. Not a stock count. */
export function Pantry() {
  const { lib, pantry, settings, refresh } = useData();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const inPantry = new Set(pantry.map(p => p.ingredientId));
  const staples = new Set([...settings.stapleIds, ...[...lib.ingredients.values()].filter(i => i.staple).map(i => i.id)]);
  const matches = query
    ? [...lib.ingredients.values()].filter(i => i.name.toLowerCase().includes(query)).slice(0, 8)
    : [];
  const name = (id: string) => lib.ingredients.get(id)?.name ?? id;

  async function save(p: PantryItem) { await savePantryItem(p); await refresh(); }
  async function add(id: string) { setQ(''); await save({ ingredientId: id, useUp: true }); }
  async function setStaple(id: string, on: boolean) {
    const ids = on ? [...new Set([...settings.stapleIds, id])] : settings.stapleIds.filter(x => x !== id);
    await saveSettings({ ...settings, stapleIds: ids });
    await refresh();
  }

  return (
    <>
      <Header date="What you have" title="Pantry" />
      <div className="card" style={{ padding: 12 }}>
        <input className="text-input" type="search" placeholder="Add an ingredient…" aria-label="Find an ingredient" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="card">
          {matches.map(i => (
            <div className="list-row" key={i.id}>
              <span className="grow">{i.name}</span>
              <button type="button" className="btn small primary" disabled={inPantry.has(i.id)} aria-label={`Add ${i.name}`} onClick={() => add(i.id)}>Add</button>
              <button type="button" className="btn small" disabled={staples.has(i.id)} aria-label={`Staple: ${i.name}`} onClick={() => setStaple(i.id, true)}>Staple</button>
            </div>
          ))}
        </div>
      )}
      {query && matches.length === 0 && <div className="empty">No ingredient called “{q}” in your library.</div>}

      <div className="section-title">Use it up</div>
      <div className="card">
        {pantry.length === 0 && <div className="list-row tl-sub">Add things you have and want used — the planner will use them first.</div>}
        {pantry.map(p => {
          const n = name(p.ingredientId);
          const unit = lib.ingredients.get(p.ingredientId)?.unit ?? 'g';
          return (
            <div className="list-row" role="group" aria-label={n} key={p.ingredientId}>
              <span className="grow">{n}</span>
              <input type="number" inputMode="decimal" min={0} placeholder="amount" style={{ width: 84, minHeight: 38, border: '1px solid var(--line)', borderRadius: 10, padding: '0 8px' }}
                aria-label={`Amount of ${n} (${unit})`} defaultValue={p.qty ?? ''}
                onBlur={e => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                  if (v !== p.qty) void save(v === undefined ? { ingredientId: p.ingredientId, useUp: p.useUp } : { ...p, qty: v });
                }} />
              <button type="button" className="chip" aria-pressed={p.useUp} onClick={() => save({ ...p, useUp: !p.useUp })}>Use it up</button>
              <button type="button" className="icon-btn" aria-label={`Remove ${n}`} onClick={async () => { await removePantryItem(p.ingredientId); await refresh(); }}>✕</button>
            </div>
          );
        })}
      </div>

      <div className="section-title">Staples — never on the shopping list</div>
      <div className="card">
        {[...staples].map(id => (
          <div className="list-row" key={id}>
            <span className="grow">{name(id)}</span>
            {settings.stapleIds.includes(id)
              ? <button type="button" className="icon-btn" aria-label={`Remove staple ${name(id)}`} onClick={() => setStaple(id, false)}>✕</button>
              : <span className="tl-sub">from library</span>}
          </div>
        ))}
      </div>
    </>
  );
}
