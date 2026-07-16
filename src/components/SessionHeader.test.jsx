// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SessionHeader from './SessionHeader';

// Advance timer by N seconds, flushing React effects after each tick
function tickSeconds(n) {
  for (let i = 0; i < n; i++) {
    act(() => { vi.advanceTimersByTime(1000); });
  }
}

describe('SessionHeader elapsed time', () => {
  let onCancel;
  let onTimerOpen;

  beforeEach(() => {
    vi.useFakeTimers();
    onCancel = vi.fn();
    onTimerOpen = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes elapsed to 0:00 for new session', () => {
    const now = new Date('2026-07-16T10:00:00Z');
    vi.setSystemTime(now);

    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt={now.toISOString()}
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('initializes elapsed to ~17:00 for resumed session started 17 minutes ago', () => {
    const now = new Date('2026-07-16T10:17:00Z');
    const startedAt = new Date('2026-07-16T10:00:00Z');
    vi.setSystemTime(now);

    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt={startedAt.toISOString()}
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    // Should immediately show ~17 minutes, not 0:00
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('continues ticking after initial render', () => {
    const now = new Date('2026-07-16T10:17:00Z');
    const startedAt = new Date('2026-07-16T10:00:00Z');
    vi.setSystemTime(now);

    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt={startedAt.toISOString()}
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    expect(screen.getByText('17:00')).toBeTruthy();

    tickSeconds(5);
    expect(screen.getByText('17:05')).toBeTruthy();
  });

  it('handles invalid startedAt gracefully', () => {
    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt="invalid"
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('handles missing startedAt gracefully', () => {
    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt={null}
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('formats hours correctly when elapsed exceeds 60 minutes', () => {
    const now = new Date('2026-07-16T12:05:00Z');
    const startedAt = new Date('2026-07-16T10:00:00Z');
    vi.setSystemTime(now);

    render(
      <SessionHeader
        workoutTitle="Upper A"
        startedAt={startedAt.toISOString()}
        onCancel={onCancel}
        onTimerOpen={onTimerOpen}
      />
    );

    expect(screen.getByText('2:05:00')).toBeTruthy();
  });
});
