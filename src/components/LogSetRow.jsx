import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Minus } from 'lucide-react';
import { formatSet, secondsToMmss, mmssToSeconds } from '../csv/exerciseData';
import { parseLogKey } from '../constants';
import { hapticLight } from '../utils/haptics';

const UNIT_LABELS = {
  lb: 'lb', kg: 'kg', '%': '%', yd: 'yd', m: 'm',
  RPE: 'RPE', in: 'in', ft: 'ft', sec: 'Time', time: 'Time',
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
  editMode = false,
  onTargetChange = null,
  onRemoveSet = null,
}) {
  const [localReps, setLocalReps] = useState(loggedSet?.actualReps ?? '');
  const [localWeight, setLocalWeight] = useState(loggedSet?.actualWeight ?? '');
  const [isCompleted, setIsCompleted] = useState(loggedSet?.completed ?? false);

  // Track accumulated local values to avoid stale-prop race condition:
  // if the user types reps then immediately types weight, both onChange handlers
  // fire before the parent re-renders, so spreading loggedSet would lose the
  // first change. We spread latestRef instead.
  const latestRef = useRef({
    ...(loggedSet || {}),
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
      const newReps = propReps === 0 ? '0' : (propReps || '');
      const newWeight = propWeight === 0 ? '0' : (propWeight || '');
      setLocalReps(newReps);
      setLocalWeight(newWeight);
      if (isTimeReps) setLocalTimeRepsStr(newReps !== '' ? secondsToMmss(Number(newReps)) : '');
      if (isTimeWeight) setLocalTimeWeightStr(newWeight !== '' ? secondsToMmss(Number(newWeight)) : '');
      setIsCompleted(propCompleted);
      latestRef.current = {
        ...(loggedSet || {}),
        actualReps: propReps,
        actualWeight: propWeight,
        completed: propCompleted,
      };
    } else {
      // Sync any non-tracked fields from parent without overwriting user edits
      latestRef.current = {
        ...latestRef.current,
        ...(loggedSet || {}),
        actualReps: latestRef.current.actualReps,
        actualWeight: latestRef.current.actualWeight,
        completed: latestRef.current.completed,
      };
    }
  }, [loggedSet?.actualReps, loggedSet?.actualWeight, loggedSet?.completed]);

  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);

  const isBodyweight = set.unit === 'bw' || set.unit === 'reps';
  const isTimeWeight = set.unit === 'sec' || set.unit === 'time';
  const isTimeReps = set.repsUnit === 'sec' || set.repsUnit === 'time';
  const weightLabel = isTimeWeight ? 'Time' : (UNIT_LABELS[set.unit] || 'Weight');
  const repsLabel = isTimeReps ? 'Time' : (set.repsUnit && set.repsUnit !== 'reps' ? (UNIT_LABELS[set.repsUnit] || set.repsUnit) : 'Reps');

  const [localTimeWeightStr, setLocalTimeWeightStr] = useState(() =>
    isTimeWeight && loggedSet?.actualWeight !== '' && loggedSet?.actualWeight != null
      ? secondsToMmss(Number(loggedSet.actualWeight))
      : ''
  );
  const [localTimeRepsStr, setLocalTimeRepsStr] = useState(() =>
    isTimeReps && loggedSet?.actualReps !== '' && loggedSet?.actualReps != null
      ? secondsToMmss(Number(loggedSet.actualReps))
      : ''
  );

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
      const wDisplay = (prev.unit === 'sec' || prev.unit === 'time')
        ? secondsToMmss(Number(prev.actualWeight))
        : `${prev.actualWeight} ${UNIT_LABELS[prev.unit] || prev.unit || ''}`;
      return `Last: ${prev.actualReps} × ${wDisplay}`.trim();
    }
    if (prev.actualReps !== '' && isBodyweight) {
      return isTimeReps
        ? `Last: ${secondsToMmss(Number(prev.actualReps))}`
        : `Last: ${prev.actualReps} reps`;
    }
    return null;
  })();

  const handleRepsChange = (value, { updateTimeStr = true } = {}) => {
    const numVal = value === '' ? '' : parseInt(value, 10);
    setLocalReps(value);
    if (isTimeReps && updateTimeStr) {
      setLocalTimeRepsStr(value !== '' ? secondsToMmss(Number(value)) : '');
    }
    latestRef.current.actualReps = numVal;
    onUpdate({ ...latestRef.current });
  };

  const handleWeightChange = (value, { updateTimeStr = true } = {}) => {
    const numVal = value === '' ? '' : parseFloat(value);
    setLocalWeight(value);
    if (isTimeWeight && updateTimeStr) {
      setLocalTimeWeightStr(value !== '' ? secondsToMmss(Number(value)) : '');
    }
    latestRef.current.actualWeight = numVal;
    onUpdate({ ...latestRef.current });
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
        if (isTimeReps) setLocalTimeRepsStr(secondsToMmss(set.reps));
      }
      if (!isBodyweight && latestRef.current.actualWeight === '' && set.weight !== null) {
        latestRef.current.actualWeight = set.weight;
        setLocalWeight(String(set.weight));
        if (isTimeWeight) setLocalTimeWeightStr(secondsToMmss(set.weight));
      }
      hapticLight();
    }

    onUpdate({ ...latestRef.current });
  };

  // Edit mode: show editable target reps/weight instead of logging UI
  if (editMode) {
    return (
      <div className="log-set-row log-set-row--edit">
        <div className="log-set-row__meta">
          <span className="log-set-row__set-num">{setIndex + 1}</span>
        </div>
        <div className="log-set-row__inputs">
          <div className="log-set-row__input-group">
            <label className="log-set-row__input-label">{repsLabel}</label>
            <input
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min="0"
              className="log-set-row__input"
              value={set.reps ?? ''}
              onChange={(e) => onTargetChange?.(setIndex, 'reps', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            />
          </div>
          {!isBodyweight && (
            <div className="log-set-row__input-group">
              <label className="log-set-row__input-label">{weightLabel}</label>
              <input
                type="number"
                inputMode="decimal"
                autoComplete="off"
                min="0"
                step="0.5"
                className="log-set-row__input"
                value={set.weight ?? ''}
                onChange={(e) => onTargetChange?.(setIndex, 'weight', e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          className="log-set-row__remove-btn"
          onClick={onRemoveSet}
          aria-label="Remove set"
        >
          <Minus size={18} />
        </button>
      </div>
    );
  }

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
          {isTimeReps ? (
            <input
              ref={repsInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={localTimeRepsStr}
              onChange={(e) => {
                const raw = e.target.value;
                setLocalTimeRepsStr(raw);
                const secs = mmssToSeconds(raw);
                if (secs !== null) handleRepsChange(String(secs), { updateTimeStr: false });
              }}
              onBlur={() => {
                if (localReps !== '') setLocalTimeRepsStr(secondsToMmss(Number(localReps)));
                else setLocalTimeRepsStr('');
              }}
              onFocus={(e) => e.target.select()}
              placeholder={set.reps != null ? secondsToMmss(set.reps) : '00:00'}
              disabled={isCompleted}
              className="log-set-row__input log-set-row__input--time"
            />
          ) : (
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
          )}
        </div>

        {!isBodyweight && (
          <div className="log-set-row__input-group">
            <label className="log-set-row__input-label">{weightLabel}</label>
            <div className="log-set-row__weight-row">
              {isTimeWeight ? (
                <input
                  ref={weightInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={localTimeWeightStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setLocalTimeWeightStr(raw);
                    const secs = mmssToSeconds(raw);
                    if (secs !== null) handleWeightChange(String(secs), { updateTimeStr: false });
                  }}
                  onBlur={() => {
                    if (localWeight !== '') setLocalTimeWeightStr(secondsToMmss(Number(localWeight)));
                    else setLocalTimeWeightStr('');
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder={set.weight != null ? secondsToMmss(set.weight) : '00:00'}
                  disabled={isCompleted}
                  className="log-set-row__input log-set-row__input--time"
                />
              ) : (
                <>
                  <button
                    className="log-set-row__adjust-btn"
                    onClick={() => handleWeightChange(String(parseFloat(localWeight) - 2.5))}
                    disabled={isCompleted || localWeight === ''}
                    aria-label="Decrease weight by 2.5"
                    type="button"
                    style={localWeight === '' ? { visibility: 'hidden' } : undefined}
                  >
                    −2.5
                  </button>
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
                  <button
                    className="log-set-row__adjust-btn"
                    onClick={() => handleWeightChange(String(parseFloat(localWeight) + 2.5))}
                    disabled={isCompleted || localWeight === ''}
                    aria-label="Increase weight by 2.5"
                    type="button"
                    style={localWeight === '' ? { visibility: 'hidden' } : undefined}
                  >
                    +2.5
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Complete toggle */}
      <button
        className={`log-set-row__complete${isCompleted ? ' log-set-row__complete--active' : ''}`}
        onClick={(e) => { e.currentTarget.blur(); handleToggleComplete(); }}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        <Check size={20} strokeWidth={3} />
        {isCompleted && <span className="log-set-row__undo-label">undo</span>}
      </button>
    </div>
  );
}
