import { clearCompletion, setCompletion } from '../../db/repo';
import { shortDate } from '../../domain/dates';
import { Header } from '../components';
import { useData } from '../data';
import { completionOf, nowStamp, upcomingTrips } from '../derived';

/** Everything still to buy. Ticks here and on Today are the same ticks. */
export function Shop() {
  const data = useData();
  const { today, completions, refresh } = data;
  const trips = upcomingTrips(data).filter(t => t.date >= today && t.lines.length);

  async function toggle(id: string, date: string) {
    if (completionOf(completions, id, date)?.status === 'done') await clearCompletion(id, date);
    else await setCompletion({ itemId: id, kind: 'shop-item', date, status: 'done', at: nowStamp() });
    await refresh();
  }

  return (
    <>
      <Header date="Shopping" title="Shop" />
      {trips.length === 0 && <div className="empty">Nothing to buy right now.</div>}
      {trips.map(t => {
        const left = t.lines.filter(l => completionOf(completions, `${t.id}:${l.ingredientId}`, t.date)?.status !== 'done').length;
        return (
          <section key={t.id}>
            <div className="section-title">
              {t.kind === 'main' ? `Main shop · ${shortDate(t.date)} · ${t.lines.length} items` : `Top-up · ${shortDate(t.date)} by ${t.byTime}`}
            </div>
            <div className="card">
              {t.kind === 'top-up' && <div className="list-row tl-sub">{t.reason}</div>}
              {t.lines.map(l => {
                const id = `${t.id}:${l.ingredientId}`;
                const done = completionOf(completions, id, t.date)?.status === 'done';
                return (
                  <div className="list-row" role="group" aria-label={l.name} key={id}>
                    <button type="button" className={`tick square${done ? ' done' : ''}`} style={{ width: 36, height: 36 }}
                      aria-label={done ? 'Undo done' : 'Mark done'} onClick={() => toggle(id, t.date)}>{done ? '✓' : ''}</button>
                    <span className="grow" style={done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{l.name}</span>
                    <span className="tl-sub">{l.display}</span>
                  </div>
                );
              })}
              {left === 0 && <div className="list-row tl-sub">All bought ✓</div>}
            </div>
          </section>
        );
      })}
    </>
  );
}
