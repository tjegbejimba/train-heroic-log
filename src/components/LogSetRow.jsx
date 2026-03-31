import { useState, useRef, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import { formatSet } from '../csv/exerciseData';
import { parseLogKey } from '../constants';

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
  allLogs,
  workoutTitle,
  exerciseTitle,
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

  // Sync local state from prop when loggedSet changes externally
  // (e.g. undo: completed goes from true to false, or crash recovery)
  useEffect(() => {
    const propReps = loggedSet?.actualReps ?? '';
    const propWeight = loggedSet?.actualWeight ?? '';
    const propCompleted = loggedSet?.completed ?? false;

    // Sync on undo (completed transitions from true to false)
    const wasCompleted = latestRef.current.completed;
    const isUndo = wasCompleted && !propCompleted;

    // Sync when both local values are still empty (initial load / crash recovery)
    const localEmpty = localReps === '' && localWeight === '';

    if (isUndo || localEmpty) {
      setLocalReps(propReps === 0 ? '0' : (propReps || ''));
      setLocalWeight(propWeight === 0 ? '0' : (propWeight || ''));
      setIsCompleted(propCompleted);
      latestRef.current = {
        actualReps: propReps,
        actualWeight: propWeight,
        completed: propCompleted,
      };
    }
  }, [loggedSet?.actualReps, loggedSet?.actualWeight, loggedSet?.completed]);

  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);

  const isBodyweight = set.unit === 'bw' || set.unit === 'reps';
  const weightLabel = UNIT_LABELS[set.unit] || 'Weight';
  const repsLabel = set.repsUnit && set.repsUnit !== 'reps' ? (UNIT_LABELS[set.repsUnit] || set.repsUnit) : 'Reps';

  // Compute "last time" hint: find most recent log (before today) with this exercise
  const lastHint = (() => {
    if (!allLogs || !workoutTitle || !exerciseTitle) return null;
    const today = new Date().toISOString().slice(0, 10);
    const matchingLogs = Object.values(allLogs)
      .filter((log) => {
        if (!log || !log.date || !log.exercises) return false;
        if (log.date >= today) return false;
        const logKey = log.key || log.logKey;
        if (!logKey) return false;
        const parsed = parseLogKey(logKey);
        return parsed.workoutTitle === workoutTitle && log.exercises[exerciseTitle];
      })
      .sort((a, b) => (b.date > a.date ? 1 : -1));
    if (matchingLogs.length === 0) return null;
    const prevSets = matchingLogs[0].exercises[exerciseTitle];
    if (!prevSets || !prevSets[setIndex]) return null;
    const prev = prevSets[setIndex];
    if (prev.actualReps === '' && prev.actualWeight === '') return null;
    if (prev.actualReps !== '' && prev.actualWeight !== '' && !isBodyweight) {
      return `Last: ${prev.actualReps} × ${prev.actualWeight} ${UNIT_LABELS[prev.unit] || prev.unit || ''}`.trim();
    }
    if (prev.actualReps !== '' && isBodyweight) {
      return `Last: ${prev.actualReps} reps`;
    }
    return null;
  })();

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
        <div className="log-set-row__target-wrap">
          <span className="log-set-row__target">{formatSet(set)}</span>
          {lastHint && (
            <span className="log-set-row__last-hint">{lastHint}</span>
          )}
        </div>
      </div>

      {/* Input fields */}
      <div className="log-set-row__inputs">
        <div className="log-set-row__input-group">
          <label className="log-set-row__input-label">{repsLabel}</label>
          <input
            ref={repsInputRef}
            type="number"
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            min="0"
            value={localReps}
            onChange={(e) => handleRepsChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); weightInputRef.current?.focus(); }
            }}
            placeholder={set.reps != null ? String(set.reps) : '—'}
            disabled={isCompleted}
            className="log-set-row__input"
          />
        </div>

        {!isBodyweight && (
          <div className="log-set-row__input-group">
            <label className="log-set-row__input-label">{weightLabel}</label>
            <div className="log-set-row__weight-row">
              {localWeight !== '' && (
                <button
                  className="log-set-row__adjust-btn"
                  onClick={() => handleWeightChange(String(parseFloat(localWeight) - 2.5))}
                  disabled={isCompleted}
                  aria-label="Decrease weight by 2.5"
                  type="button"
                >
                  −2.5
                </button>
              )}
              <input
                ref={weightInputRef}
                type="number"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                pattern="[0-9.]*"
                min="0"
                step="0.5"
                value={localWeight}
                onChange={(e) => handleWeightChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); weightInputRef.current?.blur(); }
                }}
                placeholder={set.weight != null ? String(set.weight) : '—'}
                disabled={isCompleted}
                className="log-set-row__input"
              />
              {localWeight !== '' && (
                <button
                  className="log-set-row__adjust-btn"
                  onClick={() => handleWeightChange(String(parseFloat(localWeight) + 2.5))}
                  disabled={isCompleted}
                  aria-label="Increase weight by 2.5"
                  type="button"
                >
                  +2.5
                </button>
              )}
            </div>
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
        {isCompleted && <span className="log-set-row__undo-label">undo</span>}
      </button>
    </div>
  );
}
