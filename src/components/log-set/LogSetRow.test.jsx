// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock haptics before importing LogSetRow
vi.mock('../../utils/haptics', () => ({
  hapticLight: vi.fn(),
}));

import LogSetRow from './LogSetRow';
import { hapticLight } from '../../utils/haptics';

describe('LogSetRow', () => {
  const defaultSet = { reps: 10, weight: 135, unit: 'lb', repsUnit: 'reps' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders set number and target', () => {
    render(
      <LogSetRow setIndex={0} set={defaultSet} loggedSet={null} onUpdate={() => {}} />
    );
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('displays lastHint when provided', () => {
    render(
      <LogSetRow
        setIndex={0}
        set={defaultSet}
        loggedSet={null}
        onUpdate={() => {}}
        lastHint="Last: 8 × 185 lb"
      />
    );
    expect(screen.getByText('Last: 8 × 185 lb')).toBeTruthy();
  });

  it('does not render lastHint element when null', () => {
    const { container } = render(
      <LogSetRow setIndex={0} set={defaultSet} loggedSet={null} onUpdate={() => {}} />
    );
    expect(container.querySelector('.log-set-row__last-hint')).toBeNull();
  });

  it('calls onUpdate with reps change (latestRef preserves weight)', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <LogSetRow setIndex={0} set={defaultSet} loggedSet={null} onUpdate={onUpdate} />
    );
    const repsInput = container.querySelectorAll('input')[0];
    fireEvent.change(repsInput, { target: { value: '8' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ actualReps: 8, actualWeight: '' })
    );
  });

  it('calls onUpdate with weight change (latestRef preserves reps)', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <LogSetRow
        setIndex={0}
        set={defaultSet}
        loggedSet={{ actualReps: 8, actualWeight: '', completed: false }}
        onUpdate={onUpdate}
      />
    );
    const weightInput = container.querySelectorAll('input')[1];
    fireEvent.change(weightInput, { target: { value: '140' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ actualReps: 8, actualWeight: 140 })
    );
  });

  it('auto-fills from target and fires haptic on complete toggle', () => {
    const onUpdate = vi.fn();
    render(
      <LogSetRow setIndex={0} set={defaultSet} loggedSet={null} onUpdate={onUpdate} />
    );
    fireEvent.click(screen.getByLabelText('Mark complete'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ actualReps: 10, actualWeight: 135, completed: true })
    );
    expect(hapticLight).toHaveBeenCalledOnce();
  });

  it('toggles undo on second click', () => {
    const onUpdate = vi.fn();
    render(
      <LogSetRow
        setIndex={0}
        set={defaultSet}
        loggedSet={{ actualReps: 10, actualWeight: 135, completed: true }}
        onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByLabelText('Mark incomplete'));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ completed: false })
    );
  });

  it('hides weight input for bodyweight sets', () => {
    const bwSet = { reps: 15, weight: null, unit: 'bw', repsUnit: 'reps' };
    const { container } = render(
      <LogSetRow setIndex={0} set={bwSet} loggedSet={null} onUpdate={() => {}} />
    );
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(1);
  });

  it('applies next class when isNext is true', () => {
    const { container } = render(
      <LogSetRow setIndex={0} set={defaultSet} loggedSet={null} onUpdate={() => {}} isNext={true} />
    );
    expect(container.querySelector('.log-set-row--next')).toBeTruthy();
  });

  it('applies completed class when loggedSet is completed', () => {
    const { container } = render(
      <LogSetRow
        setIndex={0}
        set={defaultSet}
        loggedSet={{ actualReps: 10, actualWeight: 135, completed: true }}
        onUpdate={() => {}}
      />
    );
    expect(container.querySelector('.log-set-row--completed')).toBeTruthy();
  });

  it('disables inputs when completed', () => {
    const { container } = render(
      <LogSetRow
        setIndex={0}
        set={defaultSet}
        loggedSet={{ actualReps: 10, actualWeight: 135, completed: true }}
        onUpdate={() => {}}
      />
    );
    const inputs = container.querySelectorAll('input');
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[1].disabled).toBe(true);
  });
});
