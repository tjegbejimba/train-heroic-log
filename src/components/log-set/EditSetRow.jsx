import { Minus } from 'lucide-react';
import { getSetMeta } from '../../utils/setMeta';

export default function EditSetRow({ setIndex, set, onTargetChange, onRemoveSet }) {
  const { isBodyweight, weightLabel, repsLabel } = getSetMeta(set);

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
            onChange={(e) =>
              onTargetChange(setIndex, 'reps', e.target.value === '' ? null : parseInt(e.target.value, 10))
            }
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
              onChange={(e) =>
                onTargetChange(setIndex, 'weight', e.target.value === '' ? null : parseFloat(e.target.value))
              }
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
