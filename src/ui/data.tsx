import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  completionsBetween, ensureWeek, getLibrary, getOverlay, getPantry, getRecovery, getSettings, getWeek,
} from '../db/repo';
import { addDays, planningWeekStart, todayLocal, weekStartOf, weekday } from '../domain/dates';
import type { Completion, ISODate, Library, PantryItem, Recovery, Settings, UserOverlay, WeekPlan } from '../domain/types';
import { RecoveryScreen } from './Recovery';

export interface Data {
  today: ISODate;
  settings: Settings;
  lib: Library;
  overlay: UserOverlay;
  pantry: PantryItem[];
  week?: WeekPlan;
  nextWeek?: WeekPlan;
  /** From the Monday before this week to the end of next week. */
  completions: Completion[];
  recovery?: Recovery;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData outside DataProvider');
  return d;
}

type Loaded = Omit<Data, 'refresh'>;

async function load(today: ISODate): Promise<Loaded> {
  const settings = await getSettings();
  const [lib, overlay, pantry, recovery] = await Promise.all([getLibrary(), getOverlay(), getPantry(), getRecovery(today)]);
  const thisWeek = weekStartOf(today);
  const next = planningWeekStart(today);
  let week: WeekPlan | undefined;
  let nextWeek: WeekPlan | undefined;
  if (settings.setupDone) {
    week = await ensureWeek(thisWeek);
    // On Sunday the coming week always has a plan, so tomorrow is never empty.
    nextWeek = weekday(today) === 0 ? await ensureWeek(next) : await getWeek(next);
  }
  const completions = await completionsBetween(addDays(thisWeek, -7), addDays(next, 6));
  return { today, settings, lib, overlay, pantry, week, nextWeek, completions, recovery };
}

export function DataProvider({ children, today: fixedToday }: { children: ReactNode; today?: ISODate }) {
  const [today, setToday] = useState(() => fixedToday ?? todayLocal());
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    const t = fixedToday ?? todayLocal();
    setToday(t);
    try {
      setData(await load(t));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [fixedToday]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Reopening the app the next morning should show the new day.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && !fixedToday && todayLocal() !== today) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, today, fixedToday]);

  const value = useMemo(() => (data ? { ...data, refresh } : null), [data, refresh]);
  if (error) return <RecoveryScreen error={error} />;
  if (!value) return <div className="empty" role="status">Loading…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
