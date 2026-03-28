import { useState, useEffect } from 'react';
import { X, Timer } from 'lucide-react';

export default function SessionHeader({
  workoutTitle,
  startedAt,
  onCancel,
  onTimerOpen,
}) {
  const [elapsed, setElapsed] = useState('0:00');

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
          `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      } else {
        setElapsed(
          `${minutes}:${String(seconds).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="session-header">
      <button className="session-header__cancel" onClick={onCancel} aria-label="Cancel workout">
        <X size={20} />
      </button>

      <div className="session-header__center">
        <span className="session-header__title">{workoutTitle}</span>
        <div className="session-header__elapsed">
          <Timer size={12} />
          <span>{elapsed}</span>
        </div>
      </div>

      <button className="session-header__timer-btn" onClick={onTimerOpen} aria-label="Open rest timer">
        <Timer size={20} />
      </button>
    </div>
  );
}
