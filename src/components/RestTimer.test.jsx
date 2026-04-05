// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock dependencies before importing component
vi.mock('../utils/haptics', () => ({ hapticHeavy: vi.fn() }));
vi.mock('../storage/push', () => ({
  showLocalNotification: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));

// Mock AudioContext so playBeep() is a no-op
const mockOscillator = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: {} };
const mockGain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
globalThis.AudioContext = vi.fn(() => ({
  createOscillator: () => mockOscillator,
  createGain: () => mockGain,
  destination: {},
  currentTime: 0,
}));
globalThis.Notification = { permission: 'denied' };

import RestTimer from './RestTimer';

// Advance timer by N seconds, flushing React effects after each tick
function tickSeconds(n) {
  for (let i = 0; i < n; i++) {
    act(() => { vi.advanceTimersByTime(1000); });
  }
}

describe('RestTimer', () => {
  let onDone;
  let onSkip;

  beforeEach(() => {
    vi.useFakeTimers();
    onDone = vi.fn();
    onSkip = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from initialSeconds', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    expect(screen.getByText('30s')).toBeTruthy();

    tickSeconds(1);
    expect(screen.getByText('29s')).toBeTruthy();

    tickSeconds(5);
    expect(screen.getByText('24s')).toBeTruthy();
  });

  it('calls onDone when reaching 0', () => {
    render(<RestTimer initialSeconds={3} onDone={onDone} onSkip={onSkip} />);

    tickSeconds(3);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('pauses when timer face is tapped', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);

    tickSeconds(2);
    expect(screen.getByText('28s')).toBeTruthy();

    // Tap to pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));

    // Advance time — should NOT count down
    tickSeconds(5);
    expect(screen.getByText('28s')).toBeTruthy();
  });

  it('resumes when tapped again after pausing', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);

    tickSeconds(2);
    expect(screen.getByText('28s')).toBeTruthy();

    // Pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));
    tickSeconds(5);
    expect(screen.getByText('28s')).toBeTruthy();

    // Resume
    fireEvent.click(screen.getByRole('button', { name: /resume timer/i }));
    tickSeconds(3);
    expect(screen.getByText('25s')).toBeTruthy();
  });

  it('±15s buttons work while paused', () => {
    render(<RestTimer initialSeconds={60} onDone={onDone} onSkip={onSkip} />);

    // Pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));

    // Add 15s
    fireEvent.click(screen.getByLabelText('Add 15 seconds'));
    expect(screen.getByText('1:15')).toBeTruthy();

    // Subtract 15s
    fireEvent.click(screen.getByLabelText('Subtract 15 seconds'));
    expect(screen.getByText('1:00')).toBeTruthy();

    // Should still be paused — no countdown
    tickSeconds(3);
    expect(screen.getByText('1:00')).toBeTruthy();
  });

  it('skip button works while paused', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);

    // Pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));

    // Skip
    fireEvent.click(screen.getByLabelText('Skip rest'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows PAUSED indicator when paused', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);

    // Not paused — no indicator
    expect(screen.queryByText('PAUSED')).toBeNull();

    // Pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));
    expect(screen.getByText('PAUSED')).toBeTruthy();

    // Resume — indicator gone
    fireEvent.click(screen.getByRole('button', { name: /resume timer/i }));
    expect(screen.queryByText('PAUSED')).toBeNull();
  });

  it('does NOT call onDone while paused even after enough time', () => {
    render(<RestTimer initialSeconds={5} onDone={onDone} onSkip={onSkip} />);

    tickSeconds(2);
    // 3s remaining — pause
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));

    // Advance well past when it would have finished
    tickSeconds(30);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('3s')).toBeTruthy();
  });
});
