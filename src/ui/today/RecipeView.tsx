import { dayName } from '../../domain/dates';
import type { Library, PlannedMeal } from '../../domain/types';
import { formatQty, mealIngredients, servesCooked } from '../../shopping/shopping';
import { Sheet } from '../components';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function RecipeView({ meal, meals, lib, onClose }: { meal: PlannedMeal; meals: PlannedMeal[]; lib: Library; onClose: () => void }) {
  const r = lib.recipes.get(meal.recipeId);
  if (meal.eatingOut || !r) {
    return <Sheet title={meal.eatingOut ? 'Eating out' : 'Recipe not found'} onClose={onClose}><div className="muted">Nothing to cook.</div></Sheet>;
  }
  const src = meal.leftoverOf ? meals.find(m => m.id === meal.leftoverOf) : undefined;
  const kcal = Math.round(r.perServe.kcal * meal.portion);
  return (
    <Sheet title={r.name} onClose={onClose}>
      <div className="muted">
        {r.prepMins} min · {kcal} kcal for you{meal.guests ? ` · +${meal.guests} guest${meal.guests > 1 ? 's' : ''}` : ''}
      </div>
      <p style={{ fontWeight: 650, margin: '12px 0 0' }}>Your portion: ×{fmt(meal.portion)}</p>
      {meal.leftoverOf ? (
        <p>Leftovers{src ? ` from ${dayName(src.date)} dinner` : ''} — just reheat your portion.</p>
      ) : (
        <>
          <div className="sheet-label">Ingredients</div>
          <div className="muted" style={{ marginBottom: 6 }}>For {fmt(servesCooked(meal, meals))} serves (includes guests and leftovers)</div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {mealIngredients(meal, meals, lib).map(i => {
              const ing = lib.ingredients.get(i.ingredientId);
              return <li key={i.ingredientId}>{ing?.name ?? i.ingredientId} — {formatQty(i.qty, ing?.unit ?? 'g')}</li>;
            })}
          </ul>
          <div className="sheet-label">Method</div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>{r.method.map((s, n) => <li key={n}>{s}</li>)}</ol>
        </>
      )}
    </Sheet>
  );
}
