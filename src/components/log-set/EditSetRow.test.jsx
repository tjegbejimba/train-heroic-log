// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditSetRow from './EditSetRow';

describe('EditSetRow', () => {
  const defaultSet = { reps: 10, weight: 135, unit: 'lb', repsUnit: 'reps' };

  it('renders set number', () => {
    render(<EditSetRow setIndex={0} set={defaultSet} onTargetChange={() => {}} onRemoveSet={() => {}} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders reps and weight inputs with target values', () => {
    const { container } = render(
      <EditSetRow setIndex={0} set={defaultSet} onTargetChange={() => {}} onRemoveSet={() => {}} />
    );
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(2);
    expect(inputs[0].value).toBe('10');
    expect(inputs[1].value).toBe('135');
  });

  it('hides weight input for bodyweight sets', () => {
    const bwSet = { reps: 15, weight: null, unit: 'bw', repsUnit: 'reps' };
    const { container } = render(
      <EditSetRow setIndex={0} set={bwSet} onTargetChange={() => {}} onRemoveSet={() => {}} />
    );
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(1);
  });

  it('fires onTargetChange with reps field on reps input change', () => {
    const onTargetChange = vi.fn();
    const { container } = render(
      <EditSetRow setIndex={2} set={defaultSet} onTargetChange={onTargetChange} onRemoveSet={() => {}} />
    );
    const repsInput = container.querySelectorAll('input')[0];
    fireEvent.change(repsInput, { target: { value: '12' } });
    expect(onTargetChange).toHaveBeenCalledWith(2, 'reps', 12);
  });

  it('fires onTargetChange with weight field on weight input change', () => {
    const onTargetChange = vi.fn();
    const { container } = render(
      <EditSetRow setIndex={1} set={defaultSet} onTargetChange={onTargetChange} onRemoveSet={() => {}} />
    );
    const weightInput = container.querySelectorAll('input')[1];
    fireEvent.change(weightInput, { target: { value: '140' } });
    expect(onTargetChange).toHaveBeenCalledWith(1, 'weight', 140);
  });

  it('fires onTargetChange with null for empty reps input', () => {
    const onTargetChange = vi.fn();
    const { container } = render(
      <EditSetRow setIndex={0} set={defaultSet} onTargetChange={onTargetChange} onRemoveSet={() => {}} />
    );
    const repsInput = container.querySelectorAll('input')[0];
    fireEvent.change(repsInput, { target: { value: '' } });
    expect(onTargetChange).toHaveBeenCalledWith(0, 'reps', null);
  });

  it('fires onRemoveSet when remove button clicked', () => {
    const onRemoveSet = vi.fn();
    render(<EditSetRow setIndex={0} set={defaultSet} onTargetChange={() => {}} onRemoveSet={onRemoveSet} />);
    fireEvent.click(screen.getByLabelText('Remove set'));
    expect(onRemoveSet).toHaveBeenCalledOnce();
  });

  it('shows Time label for timed weight sets', () => {
    const timedSet = { reps: 3, weight: 60, unit: 'sec', repsUnit: 'reps' };
    render(<EditSetRow setIndex={0} set={timedSet} onTargetChange={() => {}} onRemoveSet={() => {}} />);
    expect(screen.getByText('Time')).toBeTruthy();
  });
});
