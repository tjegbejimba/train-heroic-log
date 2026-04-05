// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PlateDisplay from './PlateDisplay';

afterEach(cleanup);

describe('PlateDisplay', () => {
  it('renders plate icon for lb exercises', () => {
    const { container } = render(
      <PlateDisplay weight="135" barWeight={45} unit="lb" />
    );
    expect(container.querySelector('.plate-display__trigger')).not.toBeNull();
  });

  it('renders plate icon for kg exercises', () => {
    const { container } = render(
      <PlateDisplay weight="60" barWeight={20} unit="kg" />
    );
    expect(container.querySelector('.plate-display__trigger')).not.toBeNull();
  });

  it('does NOT render for bw unit', () => {
    const { container } = render(
      <PlateDisplay weight="10" barWeight={null} unit="bw" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('does NOT render for RPE unit', () => {
    const { container } = render(
      <PlateDisplay weight="7" barWeight={null} unit="RPE" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('does NOT render for % unit', () => {
    const { container } = render(
      <PlateDisplay weight="80" barWeight={null} unit="%" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('does not render when weight is empty', () => {
    const { container } = render(
      <PlateDisplay weight="" barWeight={45} unit="lb" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('does not render when weight is 0', () => {
    const { container } = render(
      <PlateDisplay weight="0" barWeight={45} unit="lb" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('clicking icon shows plate breakdown text', () => {
    render(<PlateDisplay weight="135" barWeight={45} unit="lb" />);
    const trigger = screen.getByRole('button', { name: /plate/i });
    fireEvent.click(trigger);
    expect(screen.getByText('45 /side')).toBeTruthy();
  });

  it('shows "2×45 + 5 /side" for 235 lb with 45 lb bar', () => {
    render(<PlateDisplay weight="235" barWeight={45} unit="lb" />);
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    // (235 - 45) / 2 = 95 per side → 2×45 + 5
    expect(screen.getByText('2×45 + 5 /side')).toBeTruthy();
  });

  it('shows "Bar only" for weight equal to bar weight', () => {
    render(<PlateDisplay weight="45" barWeight={45} unit="lb" />);
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    expect(screen.getByText('Bar only')).toBeTruthy();
  });

  it('clicking icon again hides the popover', () => {
    render(<PlateDisplay weight="135" barWeight={45} unit="lb" />);
    const trigger = screen.getByRole('button', { name: /plate/i });
    fireEvent.click(trigger);
    expect(screen.getByText('45 /side')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByText('45 /side')).toBeNull();
  });

  it('shows "(closest)" for inexact weights', () => {
    render(<PlateDisplay weight="137" barWeight={45} unit="lb" />);
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    expect(screen.getByText('45 /side (closest)')).toBeTruthy();
  });

  it('uses custom barWeight when provided (e.g., 55 lb trap bar)', () => {
    render(<PlateDisplay weight="145" barWeight={55} unit="lb" />);
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    expect(screen.getByText('45 /side')).toBeTruthy();
  });

  it('uses default bar (45 lb) when barWeight is null', () => {
    render(<PlateDisplay weight="135" barWeight={null} unit="lb" />);
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    expect(screen.getByText('45 /side')).toBeTruthy();
  });

  it('does not render when weight is below bar weight', () => {
    const { container } = render(
      <PlateDisplay weight="30" barWeight={45} unit="lb" />
    );
    expect(container.querySelector('.plate-display')).toBeNull();
  });

  it('popover dismisses when clicking outside', () => {
    render(
      <div>
        <PlateDisplay weight="135" barWeight={45} unit="lb" />
        <span data-testid="outside">outside</span>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /plate/i }));
    expect(screen.getByText('45 /side')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('45 /side')).toBeNull();
  });
});
