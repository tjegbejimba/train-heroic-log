// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatsView from './StatsView.jsx';

// Mock logs fixture (completed workouts)
const mockLogs = {
  '2024-01-08::Upper A': {
    date: '2024-01-08',
    completedAt: '2024-01-08T09:00:00',
    exercises: {
      'Bench Press': [
        { setIndex: 0, targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 8, actualWeight: 135, completed: true },
        { setIndex: 1, targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 8, actualWeight: 135, completed: true },
      ],
    },
  },
  '2024-01-10::Lower A': {
    date: '2024-01-10',
    completedAt: '2024-01-10T09:00:00',
    exercises: {
      'Squat': [
        { setIndex: 0, targetReps: 5, targetWeight: 225, unit: 'lb', actualReps: 5, actualWeight: 225, completed: true },
        { setIndex: 1, targetReps: 5, targetWeight: 225, unit: 'lb', actualReps: 5, actualWeight: 225, completed: true },
      ],
    },
  },
  '2024-01-15::Upper A': {
    date: '2024-01-15',
    completedAt: '2024-01-15T09:00:00',
    exercises: {
      'Bench Press': [
        { setIndex: 0, targetReps: 8, targetWeight: 145, unit: 'lb', actualReps: 8, actualWeight: 145, completed: true },
        { setIndex: 1, targetReps: 8, targetWeight: 145, unit: 'lb', actualReps: 8, actualWeight: 145, completed: true },
      ],
    },
  },
};

const mockCompletedDates = new Set(['2024-01-08', '2024-01-10', '2024-01-15']);

describe('StatsView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders empty state when no completed dates', () => {
    render(<StatsView logs={{}} completedDates={new Set()} />);
    expect(screen.getByText('No stats yet')).toBeTruthy();
    expect(screen.getByText(/Complete your first workout/)).toBeTruthy();
  });

  it('renders all three sections with data', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);

    expect(screen.getByText('Getting Stronger')).toBeTruthy();
    expect(screen.getByText('Consistency')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
  });

  it('renders range pills with 4W active by default', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);

    const pills = screen.getAllByRole('button');
    const rangePills = pills.filter(b => ['1W', '4W', '3M', 'All'].includes(b.textContent));
    expect(rangePills).toHaveLength(4);

    const activePill = rangePills.find(b => b.className.includes('--active'));
    expect(activePill.textContent).toBe('4W');
  });

  it('switches range when a pill is clicked', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);

    const allPill = screen.getByText('All');
    fireEvent.click(allPill);
    expect(allPill.className).toContain('--active');
  });

  it('displays PR count badge', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);
    expect(screen.getByText('PRs')).toBeTruthy();
  });

  it('displays streak badges', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);
    expect(screen.getByText('Current Streak')).toBeTruthy();
    expect(screen.getByText('Best Streak')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
  });

  it('displays top exercises when data exists', () => {
    render(<StatsView logs={mockLogs} completedDates={mockCompletedDates} />);
    expect(screen.getByText('Top Exercises')).toBeTruthy();
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Squat').length).toBeGreaterThan(0);
  });

  it('handles empty completedDates set for empty state', () => {
    render(<StatsView logs={mockLogs} completedDates={new Set()} />);
    expect(screen.getByText('No stats yet')).toBeTruthy();
  });
});
