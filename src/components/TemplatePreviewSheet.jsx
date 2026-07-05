import { useEffect } from 'react';
import { X, Play, CalendarPlus } from 'lucide-react';

export default function TemplatePreviewSheet({
  template,
  onStartNow,
  onSchedule,
  onClose,
  startDisabledReason = '',
}) {
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!template) return null;

  const exerciseCount = template.blocks.reduce(
    (sum, b) => sum + b.exercises.length,
    0
  );
  const setCount = template.blocks.reduce(
    (sum, block) => sum + block.exercises.reduce(
      (exerciseSum, exercise) => exerciseSum + exercise.sets.length,
      0
    ),
    0
  );

  return (
    <div className="tpl-preview-overlay" onClick={onClose}>
      <div
        className="tpl-preview-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-preview-title"
      >
        <div className="tpl-preview__grabber" aria-hidden="true" />
        <div className="tpl-preview__header">
          <div>
            <span className="tpl-preview__kicker">Template preview</span>
            <h2 id="tpl-preview-title" className="tpl-preview__title">{template.name}</h2>
          </div>
          <button className="tpl-preview__close" onClick={onClose} aria-label="Close template preview">
            <X size={20} />
          </button>
        </div>

        <div className="tpl-preview__meta" aria-label="Template summary">
          <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
          <span>{setCount} set{setCount !== 1 ? 's' : ''}</span>
          <span>{template.blocks.length} part{template.blocks.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="tpl-preview__exercises">
          {template.blocks.map((block, bIdx) => {
            const isSuperset = block.exercises.length > 1;
            return (
              <div
                key={bIdx}
                className={`tpl-preview__block ${isSuperset ? 'tpl-preview__block--superset' : ''}`}
              >
                <div className="tpl-preview__block-heading">
                  <span className="tpl-preview__block-letter">
                    {block.value || String.fromCharCode(65 + bIdx)}
                  </span>
                  {isSuperset && (
                    <span className="tpl-preview__superset-label">Superset</span>
                  )}
                </div>
                <div className="tpl-preview__block-list">
                  {block.exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="tpl-preview__exercise-row">
                      <span className="tpl-preview__exercise-name">{ex.title}</span>
                      <span className="tpl-preview__exercise-sets">
                        {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="tpl-preview__actions">
          <button
            className="tpl-preview__start-btn"
            onClick={onStartNow}
            disabled={!!startDisabledReason}
          >
            <Play size={18} />
            Start Now
          </button>
          {startDisabledReason && (
            <p className="tpl-preview__start-note">{startDisabledReason}</p>
          )}
          <button className="tpl-preview__schedule-btn" onClick={onSchedule}>
            <CalendarPlus size={18} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
