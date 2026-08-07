// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock dependencies before importing component
vi.mock('../utils/haptics', () => ({ hapticHeavy: vi.fn(), hapticLight: vi.fn() }));
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

describe('RestTimer — dialog semantics & focus', () => {
  let onDone;
  let onSkip;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    onDone = vi.fn();
    onSkip = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders as a labelled dialog', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toMatch(/rest timer/i);
  });

  it('focuses the pause/resume control on mount', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /pause timer/i }));
  });

  it('restores focus to the invoking control on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open rest timer';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('marks the rest of the app inert while active', () => {
    const appRoot = document.createElement('div');
    document.body.appendChild(appRoot);
    const { unmount } = render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    expect(appRoot.hasAttribute('inert')).toBe(true);
    unmount();
    expect(appRoot.hasAttribute('inert')).toBe(false);
  });

  it('wraps Tab from the last control back to the first', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    const closeBtn = screen.getByLabelText('Close rest timer');
    const plus15Btn = screen.getByLabelText('Add 15 seconds');
    plus15Btn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('wraps Shift+Tab from the first control back to the last', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    const closeBtn = screen.getByLabelText('Close rest timer');
    const plus15Btn = screen.getByLabelText('Add 15 seconds');
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(plus15Btn);
  });

  it('calls onSkip on Escape (keyboard parity with the Skip button)', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('RestTimer — trust: no silent blocked taps', () => {
  let onDone;
  let onSkip;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    onDone = vi.fn();
    onSkip = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an assertive cue when tapping the overlay background (not a control)', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.click(document.querySelector('.rest-timer'));

    const cue = screen.getByRole('status');
    expect(cue.textContent).toMatch(/rest is active/i);
    expect(cue.textContent).toMatch(/skip/i);
  });

  it('does not show the cue when clicking the pause/resume ring', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not show the cue when clicking Skip, Close, or the +/-15s buttons', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.click(screen.getByLabelText('Add 15 seconds'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('auto-hides the cue after a couple seconds', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.click(document.querySelector('.rest-timer'));
    expect(screen.getByRole('status')).toBeTruthy();

    tickSeconds(3);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not toggle pause or fire Skip when the blocked background tap fires', () => {
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    fireEvent.click(document.querySelector('.rest-timer'));
    expect(screen.queryByText('PAUSED')).toBeNull();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('gives Skip a salient, non-glow pulse cue on a blocked tap, clearing once the cue times out', () => {
    // DESIGN.md reserves box-shadow glow for the primary CTA and the live
    // rest-timer ring — the Skip button (a secondary control) must draw
    // attention some other way (the --pulse class here backs a scale +
    // color-state animation in CSS, not a shadow/glow).
    render(<RestTimer initialSeconds={30} onDone={onDone} onSkip={onSkip} />);
    const skipButton = screen.getByLabelText('Skip rest');
    expect(skipButton.className).not.toMatch(/--pulse/);

    fireEvent.click(document.querySelector('.rest-timer'));
    expect(skipButton.className).toMatch(/--pulse/);

    tickSeconds(3);
    expect(skipButton.className).not.toMatch(/--pulse/);
  });
});
