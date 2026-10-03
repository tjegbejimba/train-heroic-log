import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { showLocalNotification, requestNotificationPermission } from '../storage/push';
import { hapticHeavy } from '../utils/haptics';

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

function secondsUntil(endsAt) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export default function RestTimer({ initialSeconds, onDone, onSkip }) {
  const safeInitial = initialSeconds > 0 ? initialSeconds : 60;
  // Count down against a wall-clock deadline rather than per-tick decrements:
  // iOS suspends timers while the PWA is backgrounded, so ticks alone would
  // freeze the rest period until the app is reopened.
  const endsAtRef = useRef(Date.now() + safeInitial * 1000);
  const [remaining, setRemaining] = useState(safeInitial);
  const [isPaused, setIsPaused] = useState(false);
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

  // Resync immediately when the app returns to the foreground.
  useEffect(() => {
    if (isPaused) return;
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') setRemaining(secondsUntil(endsAtRef.current));
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isPaused]);

  useEffect(() => {
    if (isPaused) return;
    if (remaining <= 0) {
      if (!hasFiredRef.current && mountedRef.current) {
        hasFiredRef.current = true;
        playBeep();
        hapticHeavy();
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
    const msToNextSecond = ((endsAtRef.current - Date.now()) % 1000) || 1000;
    const id = setTimeout(() => setRemaining(secondsUntil(endsAtRef.current)), msToNextSecond);
    return () => clearTimeout(id);
  }, [remaining, isPaused]);

  const togglePause = () => {
    if (isPaused) {
      endsAtRef.current = Date.now() + remaining * 1000;
      setIsPaused(false);
    } else {
      setRemaining(secondsUntil(endsAtRef.current));
      setIsPaused(true);
    }
  };

  const adjust = (delta) => {
    if (isPaused) {
      setRemaining((r) => Math.max(5, r + delta));
      return;
    }
    const next = Math.max(5, secondsUntil(endsAtRef.current) + delta);
    endsAtRef.current = Date.now() + next * 1000;
    setRemaining(next);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 10;

  return createPortal(
    <div
      className={`rest-timer${isUrgent ? ' rest-timer--urgent' : ''}${isPaused ? ' rest-timer--paused' : ''}`}
      role="region"
      aria-label="Rest timer"
    >
      <div className="rest-timer__readout">
        <span className="rest-timer__label">{isPaused ? 'Rest paused' : 'Rest'}</span>
        <span className="rest-timer__countdown" role="timer" aria-live="off">
          {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
        </span>
      </div>
      <div className="rest-timer__controls">
        <button
          className="rest-timer__adjust-btn"
          onClick={() => adjust(-15)}
          aria-label="Subtract 15 seconds"
          type="button"
        >
          −15
        </button>
        <button
          className="rest-timer__pause-btn"
          onClick={togglePause}
          aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          type="button"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          className="rest-timer__adjust-btn"
          onClick={() => adjust(+15)}
          aria-label="Add 15 seconds"
          type="button"
        >
          +15
        </button>
        <button
          className="rest-timer__skip-btn"
          onClick={onSkip}
          aria-label="Skip rest"
          type="button"
        >
          Skip
        </button>
      </div>
    </div>,
    document.body
  );
}
