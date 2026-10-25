import { useState } from 'react';
import { getOverlay, saveOverlay } from '../../db/repo';
import type { Ingredient, MealSlot, Recipe, Unit } from '../../domain/types';
import { Chip, Sheet, cap } from '../components';
import { useData } from '../data';

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
interface Row { name: string; qty: string; unit: Unit }

function Num({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="field" style={{ padding: '8px 0' }}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" min={0} aria-label={label} value={value} onChange={e => set(e.target.value)} />
    </label>
  );
}

/** The one place typing is expected — and it's optional. Saved to Ben's own additions. */
export function AddRecipe({ onClose }: { onClose: () => void }) {
  const { lib, refresh } = useData();
  const [name, setName] = useState('');
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [n, setN] = useState({ serves: '1', kcal: '', protein: '', carbs: '', fat: '', prep: '20' });
  const [quick, setQuick] = useState(false);
  const [leftoverOk, setLeftoverOk] = useState(false);
  const [tags, setTags] = useState('');
  const [rows, setRows] = useState<Row[]>([{ name: '', qty: '', unit: 'g' }]);
  const [method, setMethod] = useState('');
  const known = [...lib.ingredients.values()];
  const findIng = (nm: string) => known.find(i => i.name.toLowerCase() === nm.trim().toLowerCase());

  const num = (s: string) => Number(s);
  const ok = name.trim() && slots.length && num(n.serves) > 0 && num(n.kcal) > 0 && rows.some(r => r.name.trim() && num(r.qty) > 0);

  async function save() {
    const overlay = await getOverlay();
    const newIngs: Ingredient[] = [];
    const ingredients = rows.filter(r => r.name.trim() && num(r.qty) > 0).map(r => {
      const existing = findIng(r.name) ?? overlay.userIngredients.find(i => i.name.toLowerCase() === r.name.trim().toLowerCase());
      if (existing) return { ingredientId: existing.id, qty: num(r.qty) };
      const ing: Ingredient = { id: `user-${slug(r.name)}`, name: r.name.trim(), unit: r.unit, keepsDays: 5 };
      newIngs.push(ing);
      return { ingredientId: ing.id, qty: num(r.qty) };
    });
    const recipe: Recipe = {
      id: `user-${slug(name)}-${Date.now().toString(36)}`, name: name.trim(), slots, serves: num(n.serves),
      perServe: { kcal: num(n.kcal), protein: num(n.protein) || 0, carbs: num(n.carbs) || 0, fat: num(n.fat) || 0 },
      prepMins: num(n.prep) || 0, quick, leftoverOk, ingredients, prepSteps: [],
      method: method.split('\n').map(s => s.trim()).filter(Boolean),
      tags: tags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean), source: 'user',
    };
    await saveOverlay({ ...overlay, userRecipes: [...overlay.userRecipes, recipe], userIngredients: [...overlay.userIngredients, ...newIngs] });
    await refresh();
    onClose();
  }

  return (
    <Sheet title="Add recipe" onClose={onClose}>
      <datalist id="ingredient-names">{known.map(i => <option key={i.id} value={i.name} />)}</datalist>
      <label className="field" style={{ padding: '8px 0' }}><span>Name</span>
        <input type="text" aria-label="Name" value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="sheet-label">Meals it suits</div>
      <div className="chips">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map(s => (
          <Chip key={s} on={slots.includes(s)} onClick={() => setSlots(slots.includes(s) ? slots.filter(x => x !== s) : [...slots, s])}>{cap(s)}</Chip>
        ))}
      </div>
      <div className="sheet-label">Per serve (from the recipe website)</div>
      <Num label="Serves" value={n.serves} set={v => setN({ ...n, serves: v })} />
      <Num label="kcal per serve" value={n.kcal} set={v => setN({ ...n, kcal: v })} />
      <Num label="Protein g" value={n.protein} set={v => setN({ ...n, protein: v })} />
      <Num label="Carbs g" value={n.carbs} set={v => setN({ ...n, carbs: v })} />
      <Num label="Fat g" value={n.fat} set={v => setN({ ...n, fat: v })} />
      <Num label="Prep minutes" value={n.prep} set={v => setN({ ...n, prep: v })} />
      <div className="chips" style={{ margin: '10px 0' }}>
        <Chip on={quick} onClick={() => setQuick(!quick)}>Quick</Chip>
        <Chip on={leftoverOk} onClick={() => setLeftoverOk(!leftoverOk)}>Good as leftovers</Chip>
      </div>
      <label className="field" style={{ padding: '8px 0' }}><span>Tags</span>
        <input type="text" aria-label="Tags" placeholder="veg, fish" value={tags} onChange={e => setTags(e.target.value)} /></label>
      <div className="sheet-label">Ingredients (whole recipe)</div>
      {rows.map((r, i) => {
        const known1 = findIng(r.name);
        return (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="text-input" list="ingredient-names" aria-label={`Ingredient ${i + 1}`} placeholder="Ingredient" value={r.name}
              onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="text-input" style={{ width: 80 }} type="number" min={0} aria-label={`Amount ${i + 1}`} value={r.qty}
              onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
            <select aria-label={`Unit ${i + 1}`} disabled={!!known1} value={known1?.unit ?? r.unit} style={{ borderRadius: 10, border: '1px solid var(--line)' }}
              onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value as Unit } : x)))}>
              <option value="g">g</option><option value="ml">ml</option><option value="each">each</option>
            </select>
          </div>
        );
      })}
      <button type="button" className="linkbtn" onClick={() => setRows([...rows, { name: '', qty: '', unit: 'g' }])}>+ Ingredient</button>
      <div className="sheet-label">Method</div>
      <textarea className="text-input" style={{ minHeight: 90, padding: 10 }} aria-label="Method, one step per line" value={method} onChange={e => setMethod(e.target.value)} />
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!ok} onClick={save}>Save recipe</button>
      </div>
    </Sheet>
  );
}
