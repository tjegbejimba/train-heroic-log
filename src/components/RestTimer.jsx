import { useState, useEffect } from 'react';

export default function RestTimer({ initialSeconds, onDone, onSkip }) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      navigator.vibrate?.([100, 50, 100]);
      onDone();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const adjust = (delta) => setRemaining((r) => Math.max(5, r + delta));

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = Math.min(100, ((initialSeconds - remaining) / initialSeconds) * 100);

  return (
    <div className="rest-timer">
      <div className="rest-timer__top">
        <span className="rest-timer__label">REST</span>
        <span className="rest-timer__countdown">
          {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
        </span>
        <button className="btn btn-secondary btn-small rest-timer__skip" onClick={onSkip}>
          Skip
        </button>
      </div>
      <div className="rest-timer__bar">
        <div className="rest-timer__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rest-timer__adjust">
        <button className="btn btn-secondary btn-small" onClick={() => adjust(-15)}>−15s</button>
        <button className="btn btn-secondary btn-small" onClick={() => adjust(+15)}>+15s</button>
      </div>
    </div>
  );
}
