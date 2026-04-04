import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { showLocalNotification, requestNotificationPermission } from '../storage/push';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silently ignore */ }
}

export default function RestTimer({ initialSeconds, onDone, onSkip }) {
  const safeInitial = initialSeconds > 0 ? initialSeconds : 60;
  const [remaining, setRemaining] = useState(safeInitial);
  const hasFiredRef = useRef(false);
  const mountedRef = useRef(true);

  // Track mounted state for safe callback execution
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset hasFired when timer is restarted with new duration
  useEffect(() => {
    hasFiredRef.current = false;
  }, [initialSeconds]);

  // Request notification permission on first rest timer — contextual and non-intrusive
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      if (!hasFiredRef.current && mountedRef.current) {
        hasFiredRef.current = true;
        playBeep();
        navigator.vibrate?.([100, 50, 100]);
        showLocalNotification('Rest complete', {
          body: 'Time for your next set',
          tag: 'rest-timer',
          renotify: true,
          silent: false,
        });
        onDone();
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const adjust = (delta) => setRemaining((r) => Math.max(5, r + delta));

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = Math.min(100, ((safeInitial - remaining) / safeInitial) * 100);

  const isUrgent = remaining <= 10;

  return (
    <div className={`rest-timer${isUrgent ? ' rest-timer--urgent' : ''}`}>
      <div className="rest-timer__progress-ring-wrap">
        <svg className="rest-timer__ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            className="rest-timer__ring-track"
            cx="50" cy="50" r="44"
            fill="none"
            strokeWidth="6"
          />
          <circle
            className="rest-timer__ring-fill"
            cx="50" cy="50" r="44"
            fill="none"
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (pct / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="rest-timer__inner">
          <span className="rest-timer__label">REST</span>
          <span className="rest-timer__countdown">
            {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
          </span>
        </div>
      </div>

      <div className="rest-timer__controls">
        <button
          className="rest-timer__adjust-btn"
          onClick={() => adjust(-15)}
          aria-label="Subtract 15 seconds"
        >
          −15s
        </button>
        <button
          className="rest-timer__skip-btn"
          onClick={onSkip}
          aria-label="Skip rest"
        >
          <X size={16} />
          Skip
        </button>
        <button
          className="rest-timer__adjust-btn"
          onClick={() => adjust(+15)}
          aria-label="Add 15 seconds"
        >
          +15s
        </button>
      </div>
    </div>
  );
}
