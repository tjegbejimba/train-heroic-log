import { useState, useEffect } from 'react';
import { X, Timer, Pencil } from 'lucide-react';

// Calculate elapsed time string from startedAt timestamp
function calculateElapsed(startedAt) {
  if (!startedAt || isNaN(new Date(startedAt).getTime())) {
    return '0:00';
  }
  const now = new Date();
  const start = new Date(startedAt);
  const diff = Math.floor((now - start) / 1000); // seconds

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

export default function SessionHeader({
  workoutTitle,
  startedAt,
  onCancel,
  onTimerOpen,
  isEditMode = false,
  onToggleEdit = null,
}) {
  // Initialize elapsed synchronously from startedAt
  const [elapsed, setElapsed] = useState(() => calculateElapsed(startedAt));

  useEffect(() => {
    // Update immediately in case startedAt changed
    setElapsed(calculateElapsed(startedAt));

    // Then update every second
    const interval = setInterval(() => {
      setElapsed(calculateElapsed(startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="session-header">
      <button className="session-header__cancel" onClick={onCancel} aria-label="Cancel workout" type="button">
        <X size={20} />
      </button>

      <div className="session-header__center">
        <span className="session-header__title">{workoutTitle}</span>
        <div className="session-header__elapsed">
          <Timer size={12} />
          <span>{elapsed}</span>
        </div>
      </div>

      <div className="session-header__right-actions">
        {onToggleEdit && (
          <button
            className={`session-header__edit-btn${isEditMode ? ' session-header__edit-btn--active' : ''}`}
            onClick={onToggleEdit}
            aria-label={isEditMode ? 'Save edits' : 'Edit workout'}
            aria-pressed={isEditMode}
            type="button"
          >
            <Pencil size={16} />
          </button>
        )}
        <button className="session-header__timer-btn" onClick={onTimerOpen} aria-label="Open rest timer" type="button">
          <Timer size={20} />
        </button>
      </div>
    </div>
  );
}
