import { useState, useRef } from 'react';
import { Check } from 'lucide-react';
import { formatSet } from '../csv/exerciseData';

const UNIT_LABELS = {
  lb: 'lb', kg: 'kg', '%': '%', yd: 'yd', m: 'm',
  RPE: 'RPE', in: 'in', ft: 'ft', sec: 'sec', time: 'sec',
};

export default function LogSetRow({
  setIndex,
  set,
  loggedSet,
  onUpdate,
  isNext,
}) {
  const [localReps, setLocalReps] = useState(loggedSet?.actualReps ?? '');
  const [localWeight, setLocalWeight] = useState(loggedSet?.actualWeight ?? '');
  const [isCompleted, setIsCompleted] = useState(loggedSet?.completed ?? false);

  // Track accumulated local values to avoid stale-prop race condition:
  // if the user types reps then immediately types weight, both onChange handlers
  // fire before the parent re-renders, so spreading loggedSet would lose the
  // first change. We spread latestRef instead.
  const latestRef = useRef({
    actualReps: loggedSet?.actualReps ?? '',
    actualWeight: loggedSet?.actualWeight ?? '',
    completed: loggedSet?.completed ?? false,
  });

  const isBodyweight = set.unit === 'bw' || set.unit === 'reps';
  const weightLabel = UNIT_LABELS[set.unit] || 'Weight';
  const repsLabel = set.repsUnit && set.repsUnit !== 'reps' ? (UNIT_LABELS[set.repsUnit] || set.repsUnit) : 'Reps';

  const handleRepsChange = (value) => {
    const numVal = value === '' ? '' : parseInt(value, 10);
    setLocalReps(value);
    latestRef.current.actualReps = numVal;
    onUpdate({ ...loggedSet, ...latestRef.current });
  };

  const handleWeightChange = (value) => {
    const numVal = value === '' ? '' : parseFloat(value);
    setLocalWeight(value);
    latestRef.current.actualWeight = numVal;
    onUpdate({ ...loggedSet, ...latestRef.current });
  };

  const handleToggleComplete = () => {
    const newCompleted = !isCompleted;
    setIsCompleted(newCompleted);
    latestRef.current.completed = newCompleted;

    // Auto-fill from target when marking complete with empty fields
    if (newCompleted) {
      if (latestRef.current.actualReps === '' && set.reps !== null) {
        latestRef.current.actualReps = set.reps;
        setLocalReps(String(set.reps));
      }
      if (!isBodyweight && latestRef.current.actualWeight === '' && set.weight !== null) {
        latestRef.current.actualWeight = set.weight;
        setLocalWeight(String(set.weight));
      }
      navigator.vibrate?.(50);
    }

    onUpdate({ ...loggedSet, ...latestRef.current });
  };

  const classNames = [
    'log-set-row',
    isCompleted ? 'log-set-row--completed' : '',
    isNext && !isCompleted ? 'log-set-row--next' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {/* Set number + target */}
      <div className="log-set-row__meta">
        <span className="log-set-row__set-num">{setIndex + 1}</span>
        <span className="log-set-row__target">{formatSet(set)}</span>
      </div>

      {/* Input fields */}
      <div className="log-set-row__inputs">
        <div className="log-set-row__input-group">
          <label className="log-set-row__input-label">{repsLabel}</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={localReps}
            onChange={(e) => handleRepsChange(e.target.value)}
            placeholder={set.reps != null ? String(set.reps) : '—'}
            disabled={isCompleted}
            className="log-set-row__input"
          />
        </div>

        {!isBodyweight && (
          <div className="log-set-row__input-group">
            <label className="log-set-row__input-label">{weightLabel}</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={localWeight}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder={set.weight != null ? String(set.weight) : '—'}
              disabled={isCompleted}
              className="log-set-row__input"
            />
          </div>
        )}
      </div>

      {/* Complete toggle */}
      <button
        className={`log-set-row__complete${isCompleted ? ' log-set-row__complete--active' : ''}`}
        onClick={handleToggleComplete}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        <Check size={20} strokeWidth={3} />
      </button>
    </div>
  );
}
