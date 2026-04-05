// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BarWeightPicker from './BarWeightPicker';

describe('BarWeightPicker', () => {
  const defaultProps = {
    value: null,
    onChange: vi.fn(),
    isOpen: false,
    onToggle: vi.fn(),
    unit: 'lb',
  };

  function renderPicker(overrides = {}) {
    const props = { ...defaultProps, onChange: vi.fn(), onToggle: vi.fn(), ...overrides };
    return { ...render(<BarWeightPicker {...props} />), props };
  }

  it('renders trigger button when closed', () => {
    renderPicker({ isOpen: false });
    expect(screen.getByRole('button', { name: /bar weight/i })).toBeTruthy();
  });

  it('shows pills when open (lb)', () => {
    renderPicker({ isOpen: true, unit: 'lb' });
    expect(screen.getByText('Default (45)')).toBeTruthy();
    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('"Default" pill is highlighted when value is null', () => {
    renderPicker({ isOpen: true, value: null, unit: 'lb' });
    const defaultPill = screen.getByText('Default (45)').closest('button');
    expect(defaultPill.className).toContain('bar-weight-picker__pill--active');
  });

  it('clicking "55" calls onChange(55)', () => {
    const { props } = renderPicker({ isOpen: true, unit: 'lb' });
    fireEvent.click(screen.getByText('55'));
    expect(props.onChange).toHaveBeenCalledWith(55);
  });

  it('clicking "Default" calls onChange(null)', () => {
    const { props } = renderPicker({ isOpen: true, value: 55, unit: 'lb' });
    fireEvent.click(screen.getByText('Default (45)'));
    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('shows badge "55 lb" when value is 55 and closed', () => {
    renderPicker({ isOpen: false, value: 55, unit: 'lb' });
    expect(screen.getByText('55 lb')).toBeTruthy();
  });

  it('"Other" reveals number input', () => {
    renderPicker({ isOpen: true, value: null, unit: 'lb' });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    fireEvent.click(screen.getByText('Other'));
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });

  it('typing custom value and confirming calls onChange', () => {
    // value=42 is not a preset, so Other is active and input is shown
    const { props } = renderPicker({ isOpen: true, value: 42, unit: 'lb' });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onChange).toHaveBeenCalledWith(50);
  });

  it('shows correct pills for kg unit', () => {
    renderPicker({ isOpen: true, unit: 'kg' });
    expect(screen.getByText('Default (20)')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    // lb-only options should not be present
    expect(screen.queryByText('Default (45)')).toBeNull();
    expect(screen.queryByText('35')).toBeNull();
  });

  it('clicking "0" calls onChange(0)', () => {
    const { props } = renderPicker({ isOpen: true, unit: 'lb' });
    fireEvent.click(screen.getByText('0'));
    expect(props.onChange).toHaveBeenCalledWith(0);
  });
});
