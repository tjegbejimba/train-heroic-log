import { X, Play, CalendarPlus } from 'lucide-react';

export default function TemplatePreviewSheet({
  template,
  onStartNow,
  onSchedule,
  onClose,
}) {
  if (!template) return null;

  const exerciseCount = template.blocks.reduce(
    (sum, b) => sum + b.exercises.length,
    0
  );

  return (
    <div className="tpl-preview-overlay" onClick={onClose}>
      <div className="tpl-preview-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-preview__header">
          <h2 className="tpl-preview__title">{template.name}</h2>
          <button className="tpl-preview__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="tpl-preview__meta">
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
        </p>

        <div className="tpl-preview__exercises">
          {template.blocks.map((block, bIdx) => {
            const isSuperset = block.exercises.length > 1;
            return (
              <div key={bIdx}>
                {isSuperset && (
                  <div className="tpl-preview__superset-label">Superset</div>
                )}
                {block.exercises.map((ex, eIdx) => (
                  <div key={eIdx} className="tpl-preview__exercise-row">
                    <span className="tpl-preview__exercise-name">{ex.title}</span>
                    <span className="tpl-preview__exercise-sets">
                      {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="tpl-preview__actions">
          <button className="tpl-preview__start-btn" onClick={onStartNow}>
            <Play size={18} />
            Start Now
          </button>
          <button className="tpl-preview__schedule-btn" onClick={onSchedule}>
            <CalendarPlus size={18} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
