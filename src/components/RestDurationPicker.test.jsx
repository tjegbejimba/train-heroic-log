// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RestDurationPicker from './RestDurationPicker';

describe('RestDurationPicker', () => {
  const defaultProps = {
    value: null,
    onChange: vi.fn(),
    isOpen: false,
    onToggle: vi.fn(),
  };

  function renderPicker(overrides = {}) {
    const props = { ...defaultProps, onChange: vi.fn(), onToggle: vi.fn(), ...overrides };
    return { ...render(<RestDurationPicker {...props} />), props };
  }

  it('renders trigger button when closed', () => {
    renderPicker({ isOpen: false });
    expect(screen.getByRole('button', { name: /rest/i })).toBeTruthy();
  });

  it('shows pills when open', () => {
    renderPicker({ isOpen: true });
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('30s')).toBeTruthy();
    expect(screen.getByText('60s')).toBeTruthy();
    expect(screen.getByText('90s')).toBeTruthy();
    expect(screen.getByText('2min')).toBeTruthy();
    expect(screen.getByText('3min')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('"Default" pill is highlighted when value is null', () => {
    renderPicker({ isOpen: true, value: null });
    const defaultPill = screen.getByText('Default').closest('button');
    expect(defaultPill.className).toContain('rest-picker__pill--active');
  });

  it('clicking "90s" pill calls onChange(90)', () => {
    const { props } = renderPicker({ isOpen: true });
    fireEvent.click(screen.getByText('90s'));
    expect(props.onChange).toHaveBeenCalledWith(90);
  });

  it('clicking "Default" pill calls onChange(null)', () => {
    const { props } = renderPicker({ isOpen: true, value: 90 });
    fireEvent.click(screen.getByText('Default'));
    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('shows badge with duration when value is set and picker is closed', () => {
    renderPicker({ isOpen: false, value: 90 });
    expect(screen.getByText('90s')).toBeTruthy();
  });

  it('"Other" pill reveals number input', () => {
    renderPicker({ isOpen: true, value: null });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    fireEvent.click(screen.getByText('Other'));
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });

  it('typing in "Other" input and confirming calls onChange with typed value', () => {
    const { props } = renderPicker({ isOpen: true, value: 45 });
    // value=45 is not a preset, so Other is active and input is shown
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onChange).toHaveBeenCalledWith(75);
  });

  it('clicking "2min" pill calls onChange(120)', () => {
    const { props } = renderPicker({ isOpen: true });
    fireEvent.click(screen.getByText('2min'));
    expect(props.onChange).toHaveBeenCalledWith(120);
  });

  it('clicking "3min" pill calls onChange(180)', () => {
    const { props } = renderPicker({ isOpen: true });
    fireEvent.click(screen.getByText('3min'));
    expect(props.onChange).toHaveBeenCalledWith(180);
  });
});
