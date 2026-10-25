import { useEffect, useState } from 'react';
import { importPack } from '../../backup/backup';
import { getPack, saveOverlay } from '../../db/repo';
import type { LibraryPack, MealSlot } from '../../domain/types';
import { Header, Stepper, cap } from '../components';
import { useData } from '../data';
import { readFileText } from '../derived';
import { AddExercise } from './AddExercise';
import { AddRecipe } from './AddRecipe';
import { BackRow } from './More';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function LibraryScreen({ onBack }: { onBack: () => void }) {
  const { lib, overlay, refresh } = useData();
  const [pack, setPack] = useState<LibraryPack | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState<'recipe' | 'exercise' | null>(null);

  useEffect(() => { void getPack().then(setPack); }, [lib]);

  const hidden = new Set(overlay.hiddenRecipeIds);
  const allRecipes = [...(pack?.recipes ?? []), ...overlay.userRecipes].filter(r => !r.retired);

  async function toggleHidden(id: string) {
    const ids = hidden.has(id) ? overlay.hiddenRecipeIds.filter(x => x !== id) : [...overlay.hiddenRecipeIds, id];
    await saveOverlay({ ...overlay, hiddenRecipeIds: ids });
    await refresh();
  }
  async function setOverride(id: string, change: { active?: boolean; timesPerWeek?: number }) {
    await saveOverlay({ ...overlay, routineOverrides: { ...overlay.routineOverrides, [id]: { ...overlay.routineOverrides[id], ...change } } });
    await refresh();
  }
  async function onFile(file: File) {
    const r = await importPack(await readFileText(file));
    setMsg(r.ok ? { ok: true, text: `Imported “${r.label}”.` } : { ok: false, text: r.error });
    if (r.ok) await refresh();
  }

  return (
    <>
      <Header date="More" title="Library" />
      <BackRow onBack={onBack} />
      {msg && <div className={`banner ${msg.ok ? 'backup' : 'red'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}
      <div className="card">
        <div className="list-row"><span className="grow"><b>{lib.label}</b><div className="tl-sub">{allRecipes.length} recipes · {lib.exercises.size} exercises</div></span></div>
        <label className="list-row">
          <span className="grow">Import library file</span>
          <input type="file" accept="application/json,.json" aria-label="Import library file" style={{ maxWidth: 170 }}
            onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        </label>
      </div>

      <div className="section-title">Exercise routine</div>
      <div className="card">
        {lib.routine.map(r => {
          const ex = lib.exercises.get(r.exerciseId);
          if (!ex || ex.retired) return null;
          return (
            <div className="list-row" key={r.exerciseId}>
              <span className="grow">{ex.name}<div className="tl-sub">{cap(r.session)} · {ex.source}</div></span>
              <Stepper label={`times a week for ${ex.name}`} value={r.timesPerWeek} min={1} max={7} onChange={n => setOverride(r.exerciseId, { timesPerWeek: n })} />
              <button type="button" className="chip" aria-pressed={r.active} aria-label={`Active: ${ex.name}`} onClick={() => setOverride(r.exerciseId, { active: !r.active })}>
                {r.active ? 'On' : 'Off'}
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn block" onClick={() => setAdding('exercise')}>Add exercise</button>

      {SLOTS.map(slot => (
        <div key={slot}>
          <div className="section-title">{cap(slot)} recipes</div>
          <div className="card">
            {allRecipes.filter(r => r.slots.includes(slot)).map(r => (
              <div className="list-row" key={r.id}>
                <span className="grow" style={hidden.has(r.id) ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>
                  {r.name}<div className="tl-sub">{r.perServe.kcal} kcal · {r.prepMins} min · {r.source}</div>
                </span>
                <button type="button" className="btn small" aria-label={`${hidden.has(r.id) ? 'Unhide' : 'Hide'} ${r.name}`} onClick={() => toggleHidden(r.id)}>
                  {hidden.has(r.id) ? 'Unhide' : 'Hide'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn block" onClick={() => setAdding('recipe')}>Add recipe</button>
      {adding === 'recipe' && <AddRecipe onClose={() => setAdding(null)} />}
      {adding === 'exercise' && <AddExercise onClose={() => setAdding(null)} />}
    </>
  );
}
