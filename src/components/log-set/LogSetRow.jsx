import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { formatSet, secondsToMmss, mmssToSeconds } from '../../csv/exerciseData';
import { getSetMeta } from '../../utils/setMeta';
import { hapticLight } from '../../utils/haptics';

/**
 * Logging-mode set row. 6 props — handles input state, time conversion,
 * auto-fill, haptics, and latestRef race prevention internally.
 */
export default function LogSetRow({
  setIndex,
  set,
  loggedSet,
  onUpdate,
  isNext = false,
  lastHint = null,
}) {
  const { isBodyweight, isTimeWeight, isTimeReps, weightLabel, repsLabel } = getSetMeta(set);

  const [localReps, setLocalReps] = useState(loggedSet?.actualReps ?? '');
  const [localWeight, setLocalWeight] = useState(loggedSet?.actualWeight ?? '');
  const [isCompleted, setIsCompleted] = useState(loggedSet?.completed ?? false);

  const latestRef = useRef({
    ...(loggedSet || {}),
    actualReps: loggedSet?.actualReps ?? '',
    actualWeight: loggedSet?.actualWeight ?? '',
    completed: loggedSet?.completed ?? false,
  });

  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);

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

  // Sync local state from prop on undo or crash recovery
  useEffect(() => {
    const propReps = loggedSet?.actualReps ?? '';
    const propWeight = loggedSet?.actualWeight ?? '';
    const propCompleted = loggedSet?.completed ?? false;

    const wasCompleted = latestRef.current.completed;
    const isUndo = wasCompleted && !propCompleted;
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
      latestRef.current = {
        ...latestRef.current,
        ...(loggedSet || {}),
        actualReps: latestRef.current.actualReps,
        actualWeight: latestRef.current.actualWeight,
        completed: latestRef.current.completed,
      };
    }
  }, [loggedSet?.actualReps, loggedSet?.actualWeight, loggedSet?.completed]);

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

  const classNames = [
    'log-set-row',
    isCompleted ? 'log-set-row--completed' : '',
    isNext && !isCompleted ? 'log-set-row--next' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="log-set-row__meta">
        <span className="log-set-row__set-num">{setIndex + 1}</span>
        <div className="log-set-row__target-wrap">
          <span className="log-set-row__target">{formatSet(set)}</span>
          {lastHint && (
            <span className="log-set-row__last-hint">{lastHint}</span>
          )}
        </div>
      </div>

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
