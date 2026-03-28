import { useState, useEffect } from 'react';
import { X, Timer } from 'lucide-react';

export default function SessionHeader({
  workoutTitle,
  startedAt,
  onCancel,
  onTimerOpen,
}) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(startedAt);
      const diff = Math.floor((now - start) / 1000); // seconds

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setElapsed(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      } else {
        setElapsed(
          `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="session-header">
      <div className="session-header__left">
        <button className="btn btn-secondary" onClick={onCancel}>
          <X size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cancel
        </button>
      </div>

      <div className="session-header__center">
        <h2 className="session-header__title">{workoutTitle}</h2>
        <div className="session-header__timer" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Timer size={14} />{elapsed}</div>
      </div>

      <div className="session-header__right">
        <button className="btn btn-secondary" onClick={onTimerOpen}>
          <Timer size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Timer
        </button>
      </div>
    </div>
  );
}
