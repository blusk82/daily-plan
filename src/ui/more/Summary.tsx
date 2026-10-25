import { useEffect, useState } from 'react';
import { allWeeks, completionsBetween } from '../../db/repo';
import { addDays, daysBetween, shortDate } from '../../domain/dates';
import type { BodyArea } from '../../domain/types';
import { summarise, type AppointmentSummary } from '../../summary/appointment';
import { Chip, Header, cap } from '../components';
import { useData } from '../data';
import { REASON_LABELS } from '../today/NotDoneSheet';
import { BackRow } from './More';

const AREA_COLOUR: Record<BodyArea | 'unspecified', string> = { back: '#2f7d6b', hip: '#c9792b', neck: '#5b6fd1', feet: '#a04c8f', unspecified: '#888' };

function PainChart({ s }: { s: AppointmentSummary }) {
  if (!s.pain.length) return <div className="list-row tl-sub">No pain ratings recorded.</div>;
  const W = 320, H = 120, pad = 22;
  const span = Math.max(1, daysBetween(s.from, s.to));
  const x = (d: string) => pad + ((W - 2 * pad) * daysBetween(s.from, d)) / span;
  const y = (v: number) => H - pad - ((H - 2 * pad) * v) / 10;
  const areas = [...new Set(s.pain.map(p => p.area))];
  return (
    <div style={{ padding: 12 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pain ratings over time">
        {[0, 5, 10].map(v => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.15} />
            <text x={4} y={y(v) + 4} fontSize={10} fill="currentColor" opacity={0.6}>{v}</text>
          </g>
        ))}
        {areas.map(a => {
          const pts = s.pain.filter(p => p.area === a);
          return (
            <g key={a}>
              <polyline fill="none" stroke={AREA_COLOUR[a]} strokeWidth={2} points={pts.map(p => `${x(p.date)},${y(p.value)}`).join(' ')} />
              {pts.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.value)} r={3.5} fill={AREA_COLOUR[a]} />)}
            </g>
          );
        })}
      </svg>
      <div className="chips" style={{ fontSize: 13 }}>
        {areas.map(a => <span key={a} style={{ color: AREA_COLOUR[a], fontWeight: 650 }}>● {cap(a)}</span>)}
      </div>
    </div>
  );
}

/** One screen to hand across at an appointment. */
export function Summary({ onBack }: { onBack: () => void }) {
  const { today, lib } = useData();
  const [weeks, setWeeks] = useState(4);
  const [s, setS] = useState<AppointmentSummary | null>(null);

  useEffect(() => {
    const from = addDays(today, -(weeks * 7) + 1);
    void (async () => setS(summarise(from, today, await allWeeks(), await completionsBetween(from, today), lib)))();
  }, [weeks, today, lib]);

  return (
    <>
      <Header date={s ? `${shortDate(s.from)} – ${shortDate(s.to)}` : ''} title="Appointment summary" />
      <BackRow onBack={onBack} />
      <div className="chips" style={{ padding: '0 14px' }}>
        {[2, 4, 8].map(n => <Chip key={n} on={weeks === n} onClick={() => setWeeks(n)}>{n} weeks</Chip>)}
      </div>
      {s && (
        <>
          <div className="section-title">Exercise sessions</div>
          <div className="card">
            {s.weeks.map(w => {
              const unrec = Math.max(0, w.planned - w.done - w.notDone);
              const pct = (n: number) => (w.planned ? `${(100 * n) / w.planned}%` : '0');
              return (
                <div className="list-row" key={w.weekStart} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>Week of {shortDate(w.weekStart).slice(4)}</span>
                    <span className="tl-sub">{w.done} done · {w.notDone} skipped · {unrec} not recorded</span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: pct(w.done), background: 'var(--green)' }} />
                    <span style={{ width: pct(w.notDone), background: 'var(--red)' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="section-title">Why sessions were skipped</div>
          <div className="card">
            {s.reasons.length === 0 && <div className="list-row tl-sub">No skipped sessions with a reason.</div>}
            {s.reasons.map(r => <div className="list-row" key={r.reason}><span className="grow">{REASON_LABELS[r.reason]}</span><b>{r.count}</b></div>)}
          </div>
          <div className="section-title">Pain (0–10)</div>
          <div className="card"><PainChart s={s} /></div>
          <div className="section-title">Exercises flagged for pain</div>
          <div className="card">
            {s.flagged.length === 0 && <div className="list-row tl-sub">None.</div>}
            {s.flagged.map(f => <div className="list-row" key={f.exerciseId}><span className="grow">{f.name}</span><span className="pill">{f.painCount}× pain</span></div>)}
          </div>
        </>
      )}
    </>
  );
}
