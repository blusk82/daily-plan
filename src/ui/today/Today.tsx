import { useEffect, useState } from 'react';
import { clearCompletion, completionsBetween, getWeek, saveWeek, setCompletion, setRecovery } from '../../db/repo';
import { addDays, longDate, nowTime, weekStartOf } from '../../domain/dates';
import type { Completion, HHMM, ItemKind, PlannedExercise } from '../../domain/types';
import { exerciseItemId, progressionNotes } from '../../planner/exercisePlanner';
import { buildTimeline, currentItemId, type TimelineItem } from '../../timeline/timeline';
import { Banners } from '../Banners';
import { Header } from '../components';
import { useData } from '../data';
import { completionOf, nowStamp, upcomingPreps, upcomingTrips } from '../derived';
import { NotDoneSheet, REASON_LABELS, type NotDoneResult } from './NotDoneSheet';
import { RecipeView } from './RecipeView';
import { RecoveryPicker } from './RecoveryPicker';
import { TimeSheet } from './TimeSheet';

type SheetState =
  | { kind: 'not-done'; itemId: string; itemKind: ItemKind; title: string }
  | { kind: 'recipe'; mealId: string }
  | { kind: 'time'; item: TimelineItem };

const KIND: Record<TimelineItem['kind'], ItemKind> = { meal: 'meal', session: 'session', shop: 'shop', prep: 'prep' };

function dose(e: PlannedExercise, perSide?: boolean): string {
  const side = perSide ? ' each side' : '';
  if (e.holdSecs) return `${e.sets ?? 1} × ${e.holdSecs} s${side}`;
  return `${e.sets ?? 1} × ${e.reps ?? ''}${side}`;
}

function statusText(c?: Completion): string | undefined {
  if (c?.status !== 'not-done') return undefined;
  const why = c.reason === 'other' ? c.otherText : c.reason ? REASON_LABELS[c.reason] : undefined;
  return `Not done${why ? ` · ${why}` : ''}${c.pain !== undefined ? ` · pain ${c.pain}` : ''}`;
}

function Tick({ done, square, onClick, small }: { done: boolean; square?: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" className={`tick${square ? ' square' : ''}${done ? ' done' : ''}`} style={small ? { width: 36, height: 36 } : undefined}
      aria-label={done ? 'Undo done' : 'Mark done'} onClick={onClick}>
      {done ? '✓' : ''}
    </button>
  );
}

export function Today() {
  const data = useData();
  const { today, week, lib, completions, recovery, refresh } = data;
  const [fullSession, setFullSession] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [notes, setNotes] = useState<Map<string, string>>(new Map());

  // Progression notes look back three full weeks.
  useEffect(() => {
    let live = true;
    (async () => {
      const start = weekStartOf(today);
      const weeks = await Promise.all([21, 14, 7].map(n => getWeek(addDays(start, -n))));
      const past = await completionsBetween(addDays(start, -21), addDays(start, -1));
      const n = progressionNotes(past, weeks.flatMap(w => w?.sessions ?? []), today, lib);
      if (live) setNotes(new Map(n.map(x => [x.exerciseId, x.text])));
    })();
    return () => { live = false; };
  }, [today, lib]);

  if (!week) return null;
  const trips = upcomingTrips(data);
  const preps = upcomingPreps(data);
  const effectiveRecovery = fullSession ? undefined : recovery;
  const items = buildTimeline(today, week, trips, preps, lib, effectiveRecovery);
  const todays = completions.filter(c => c.date === today);
  const current = currentItemId(items, todays, nowTime());
  const statusOf = (id: string) => completionOf(completions, id, today);

  /**
   * Ticking a session or shop trip ticks the items shown under it (a red-day
   * session only covers the lighter exercises). Undo removes only the ticks
   * that the same tap made, so items ticked one by one are kept.
   */
  async function toggle(itemId: string, kind: ItemKind, children: string[] = [], childKind?: ItemKind) {
    const current = statusOf(itemId);
    if (current?.status === 'done') {
      await clearCompletion(itemId, today);
      for (const c of children) {
        const cc = statusOf(c);
        if (cc?.status === 'done' && cc.at === current.at) await clearCompletion(c, today);
      }
    } else {
      const at = nowStamp();
      await setCompletion({ itemId, kind, date: today, status: 'done', at });
      for (const c of children) if (!statusOf(c)) await setCompletion({ itemId: c, kind: childKind!, date: today, status: 'done', at });
    }
    await refresh();
  }

  async function saveNotDone(s: Extract<SheetState, { kind: 'not-done' }>, r: NotDoneResult) {
    setSheet(null);
    const c: Completion = { itemId: s.itemId, kind: s.itemKind, date: today, status: 'not-done', reason: r.reason, at: nowStamp() };
    if (r.pain !== undefined) c.pain = r.pain;
    if (r.area) c.area = r.area;
    if (r.otherText) c.otherText = r.otherText;
    await setCompletion(c);
    await refresh();
  }

  async function moveItem(item: TimelineItem, time: HHMM) {
    setSheet(null);
    const w = week!;
    if (item.kind === 'meal') await saveWeek({ ...w, meals: w.meals.map(m => (m.id === item.id ? { ...m, time } : m)) });
    if (item.kind === 'session') await saveWeek({ ...w, sessions: w.sessions.map(s => (s.id === item.id ? { ...s, time } : s)) });
    await refresh();
  }

  async function chooseRecovery(r: Parameters<typeof setRecovery>[1]) {
    setFullSession(false);
    await setRecovery(today, r);
    await refresh();
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      <Header date={longDate(today)} title="Today">
        <RecoveryPicker value={recovery} onChange={chooseRecovery} />
      </Header>
      <Banners />
      {recovery === 'red' && (
        <div className="banner red" role="note">
          <span>{fullSession ? 'Red recovery — full session chosen.' : 'Red recovery — lighter session suggested.'}</span>
          <button type="button" className="linkbtn" onClick={() => setFullSession(!fullSession)}>
            {fullSession ? 'Use lighter session' : 'Use full session'}
          </button>
        </div>
      )}
      <div className="card">
        {items.length === 0 && <div className="empty">Nothing planned today.</div>}
        {items.map(item => {
          const c = statusOf(item.id);
          const done = c?.status === 'done';
          const job = item.kind === 'shop' || item.kind === 'prep';
          const canMove = item.kind === 'meal' || item.kind === 'session';
          const open = expanded.has(item.id);
          const skipped = statusText(c);
          const childIds = item.kind === 'session' ? item.session.exercises.map(e => exerciseItemId(item.id, e.exerciseId))
            : item.kind === 'shop' ? item.trip.lines.map(l => `${item.id}:${l.ingredientId}`) : [];
          const childKind: ItemKind | undefined = item.kind === 'session' ? 'exercise' : item.kind === 'shop' ? 'shop-item' : undefined;
          const onMain = () => {
            if (item.kind === 'meal') setSheet({ kind: 'recipe', mealId: item.id });
            else if (item.kind === 'session' || item.kind === 'shop') toggleExpand(item.id);
          };
          return (
            <div key={item.id}>
              <div role="group" aria-label={item.title} className={`tl-row${job ? ' job' : ''}${current === item.id ? ' current' : ''}`}>
                {canMove ? (
                  <button type="button" className="tl-time" aria-label={`Change time for ${item.title}`} onClick={() => setSheet({ kind: 'time', item })}>{item.time}</button>
                ) : (
                  <span className="tl-time" style={{ display: 'flex', alignItems: 'center' }}>{item.kind === 'shop' ? `by ${item.time}` : item.time}</span>
                )}
                <Tick done={done} square={job} onClick={() => toggle(item.id, KIND[item.kind], childIds, childKind)} />
                <button type="button" className="tl-main" onClick={onMain} aria-expanded={item.kind === 'session' || item.kind === 'shop' ? open : undefined}>
                  <div className="tl-title">{item.title}</div>
                  <div className="tl-sub">{item.subtitle}</div>
                  {skipped && <div className="tl-sub skipped">{skipped}</div>}
                </button>
                {item.kind !== 'prep' && (
                  <button type="button" className={`skip${c?.status === 'not-done' ? ' on' : ''}`} aria-label="Not done"
                    onClick={() => setSheet({ kind: 'not-done', itemId: item.id, itemKind: KIND[item.kind], title: item.title })}>✕</button>
                )}
              </div>
              {open && item.kind === 'session' && (
                <div className="sub-list">
                  {item.session.exercises.map(e => {
                    const ex = lib.exercises.get(e.exerciseId);
                    const id = exerciseItemId(item.id, e.exerciseId);
                    const ec = statusOf(id);
                    const name = ex?.name ?? e.exerciseId;
                    return (
                      <div key={id} role="group" aria-label={name} className="sub-row">
                        <Tick small done={ec?.status === 'done'} onClick={() => toggle(id, 'exercise')} />
                        <div className="info">
                          <div style={{ fontWeight: 600 }}>{name}</div>
                          <div className="tl-sub">{dose(e, ex?.perSide)}{ex?.source && ex.source !== 'sample' ? ` · ${ex.source}` : ''}</div>
                          {ex?.howTo && <div className="howto">{ex.howTo}</div>}
                          {statusText(ec) && <div className="tl-sub skipped">{statusText(ec)}</div>}
                          {notes.get(e.exerciseId) && <div className="note">{notes.get(e.exerciseId)}</div>}
                        </div>
                        <button type="button" className={`skip${ec?.status === 'not-done' ? ' on' : ''}`} aria-label="Not done"
                          onClick={() => setSheet({ kind: 'not-done', itemId: id, itemKind: 'exercise', title: name })}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {open && item.kind === 'shop' && (
                <div className="sub-list">
                  {item.trip.lines.map(l => {
                    const id = `${item.id}:${l.ingredientId}`;
                    return (
                      <div key={id} role="group" aria-label={l.name} className="sub-row">
                        <Tick small square done={statusOf(id)?.status === 'done'} onClick={() => toggle(id, 'shop-item')} />
                        <div className="info">{l.name} <span className="muted">{l.display}</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sheet?.kind === 'not-done' && (
        <NotDoneSheet title={sheet.title} forMeal={sheet.itemKind === 'meal'} forExercise={sheet.itemKind === 'exercise' || sheet.itemKind === 'session'}
          onClose={() => setSheet(null)} onSave={r => saveNotDone(sheet, r)} />
      )}
      {sheet?.kind === 'recipe' && (
        <RecipeView meal={week.meals.find(m => m.id === sheet.mealId)!} meals={week.meals} lib={lib} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'time' && (
        <TimeSheet title={sheet.item.title} time={sheet.item.time} onClose={() => setSheet(null)} onSave={t => moveItem(sheet.item, t)} />
      )}
    </>
  );
}
