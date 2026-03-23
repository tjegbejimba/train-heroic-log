import { useState } from 'react';
import { formatSet } from '../csv/exerciseData';

export default function LogSetRow({
  setIndex,
  set,
  loggedSet,
  onUpdate,
}) {
  const [localReps, setLocalReps] = useState(loggedSet?.actualReps ?? '');
  const [localWeight, setLocalWeight] = useState(loggedSet?.actualWeight ?? '');
  const [isCompleted, setIsCompleted] = useState(loggedSet?.completed ?? false);

  const handleRepsChange = (value) => {
    const numVal = value === '' ? '' : parseInt(value);
    setLocalReps(value);
    onUpdate({
      ...loggedSet,
      actualReps: numVal,
    });
  };

  const handleWeightChange = (value) => {
    const numVal = value === '' ? '' : parseFloat(value);
    setLocalWeight(value);
    onUpdate({
      ...loggedSet,
      actualWeight: numVal,
    });
  };

  const handleToggleComplete = () => {
    const newCompleted = !isCompleted;
    setIsCompleted(newCompleted);
    onUpdate({
      ...loggedSet,
      completed: newCompleted,
    });
  };

  return (
    <div className={`log-set-row ${isCompleted ? 'log-set-row--completed' : ''}`}>
      <div className="log-set-row__set-num">Set {setIndex + 1}</div>

      <div className="log-set-row__target">
        <div className="log-set-row__label">Target</div>
        <div className="log-set-row__value">{formatSet(set)}</div>
      </div>

      <div className="log-set-row__inputs">
        <div className="log-set-row__input-group">
          <label className="log-set-row__input-label">Reps</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={localReps}
            onChange={(e) => handleRepsChange(e.target.value)}
            placeholder="0"
            disabled={isCompleted}
            className="log-set-row__input"
          />
        </div>

        <div className="log-set-row__input-group">
          <label className="log-set-row__input-label">Weight</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={localWeight}
            onChange={(e) => handleWeightChange(e.target.value)}
            placeholder="0"
            disabled={isCompleted}
            className="log-set-row__input"
          />
        </div>
      </div>

      <button
        className={`log-set-row__complete ${isCompleted ? 'log-set-row__complete--active' : ''}`}
        onClick={handleToggleComplete}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted ? '✓' : '○'}
      </button>
    </div>
  );
}
