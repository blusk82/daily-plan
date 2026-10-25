import { useState } from 'react';
import { getOverlay, saveOverlay } from '../../db/repo';
import { BODY_AREAS, type BodyArea, type Exercise, type ExerciseType, type SessionSlot } from '../../domain/types';
import { Chip, Sheet, Stepper, cap } from '../components';
import { useData } from '../data';

const SOURCES: { id: Exercise['source']; label: string }[] = [
  { id: 'physio', label: 'Physio' }, { id: 'osteo', label: 'Osteo' }, { id: 'podiatrist', label: 'Podiatrist' }, { id: 'book', label: 'Book' }, { id: 'user', label: 'Other' },
];

export function AddExercise({ onClose }: { onClose: () => void }) {
  const { refresh } = useData();
  const [name, setName] = useState('');
  const [howTo, setHowTo] = useState('');
  const [areas, setAreas] = useState<BodyArea[]>([]);
  const [type, setType] = useState<ExerciseType | null>(null);
  const [source, setSource] = useState<Exercise['source'] | null>(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState('10');
  const [hold, setHold] = useState('');
  const [perSide, setPerSide] = useState(false);
  const [session, setSession] = useState<SessionSlot>('morning');
  const [times, setTimes] = useState(3);
  const ok = name.trim() && areas.length && type && source;

  async function save() {
    const overlay = await getOverlay();
    const id = `user-ex-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const ex: Exercise = {
      id, name: name.trim(), howTo: howTo.trim(), areas, type: type!, source: source!, sets,
      ...(Number(hold) > 0 ? { holdSecs: Number(hold) } : { reps: Number(reps) || 10 }), ...(perSide ? { perSide } : {}),
    };
    await saveOverlay({
      ...overlay, userExercises: [...overlay.userExercises, ex],
      routineOverrides: { ...overlay.routineOverrides, [id]: { active: true, timesPerWeek: times, session } },
    });
    await refresh();
    onClose();
  }

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <label className="field" style={{ padding: '8px 0' }}><span>Name</span>
        <input type="text" aria-label="Name" value={name} onChange={e => setName(e.target.value)} /></label>
      <textarea className="text-input" style={{ minHeight: 70, padding: 10 }} aria-label="How to do it" placeholder="How to do it" value={howTo} onChange={e => setHowTo(e.target.value)} />
      <div className="sheet-label">Body area</div>
      <div className="chips">{BODY_AREAS.map(a => <Chip key={a} on={areas.includes(a)} onClick={() => setAreas(areas.includes(a) ? areas.filter(x => x !== a) : [...areas, a])}>{cap(a)}</Chip>)}</div>
      <div className="sheet-label">Type</div>
      <div className="chips">{(['mobility', 'strength', 'stretch'] as ExerciseType[]).map(t => <Chip key={t} on={type === t} onClick={() => setType(t)}>{cap(t)}</Chip>)}</div>
      <div className="sheet-label">Who set it</div>
      <div className="chips">{SOURCES.map(s => <Chip key={s.id} on={source === s.id} onClick={() => setSource(s.id)}>{s.label}</Chip>)}</div>
      <div className="sheet-label">Dose</div>
      <div className="field" style={{ padding: '8px 0' }}><span>Sets</span><Stepper label="sets" value={sets} min={1} max={10} onChange={setSets} /></div>
      <label className="field" style={{ padding: '8px 0' }}><span>Reps</span>
        <input type="number" min={1} aria-label="Reps" value={reps} onChange={e => setReps(e.target.value)} /></label>
      <label className="field" style={{ padding: '8px 0' }}><span>Or hold (seconds)</span>
        <input type="number" min={0} aria-label="Hold seconds" value={hold} onChange={e => setHold(e.target.value)} /></label>
      <div className="chips" style={{ margin: '8px 0' }}><Chip on={perSide} onClick={() => setPerSide(!perSide)}>Each side</Chip></div>
      <div className="sheet-label">When</div>
      <div className="chips">
        <Chip on={session === 'morning'} onClick={() => setSession('morning')}>Morning</Chip>
        <Chip on={session === 'evening'} onClick={() => setSession('evening')}>Evening</Chip>
      </div>
      <div className="field" style={{ padding: '8px 0' }}><span>Times a week</span><Stepper label="times a week" value={times} min={1} max={7} onChange={setTimes} /></div>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!ok} onClick={save}>Save exercise</button>
      </div>
    </Sheet>
  );
}
