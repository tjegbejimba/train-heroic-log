import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  filterLogsByRange,
  volumeByWeek,
  sessionsByWeek,
  prCountInRange,
  topExercisesByVolume,
  volumeByExercise,
  workoutDates,
  dateRangeFromPreset,
} from './statsHelpers.js';

// --- Fixtures ---
// 3 weeks of logs across Jan 2024
// Week of Jan 8 (Mon): 2 sessions
// Week of Jan 15 (Mon): 2 sessions
// Week of Jan 22 (Mon): 1 session
const mockLogs = {
  '2024-01-08::Upper A': {
    date: '2024-01-08',
    completedAt: '2024-01-08T09:00:00',
    startedAt: '2024-01-08T08:00:00',
    exercises: {
      'Bench Press': [
        { setIndex: 0, targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 8, actualWeight: 135, completed: true },
        { setIndex: 1, targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 8, actualWeight: 135, completed: true },
        { setIndex: 2, targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 6, actualWeight: 135, completed: true },
      ],
      'Overhead Press': [
        { setIndex: 0, targetReps: 10, targetWeight: 65, unit: 'lb', actualReps: 10, actualWeight: 65, completed: true },
        { setIndex: 1, targetReps: 10, targetWeight: 65, unit: 'lb', actualReps: 10, actualWeight: 65, completed: true },
      ],
    },
  },
  '2024-01-10::Lower A': {
    date: '2024-01-10',
    completedAt: '2024-01-10T09:00:00',
    startedAt: '2024-01-10T08:00:00',
    exercises: {
      'Squat': [
        { setIndex: 0, targetReps: 5, targetWeight: 185, unit: 'lb', actualReps: 5, actualWeight: 185, completed: true },
        { setIndex: 1, targetReps: 5, targetWeight: 185, unit: 'lb', actualReps: 5, actualWeight: 185, completed: true },
        { setIndex: 2, targetReps: 5, targetWeight: 185, unit: 'lb', actualReps: 5, actualWeight: 185, completed: true },
      ],
    },
  },
  '2024-01-15::Upper A': {
    date: '2024-01-15',
    completedAt: '2024-01-15T09:00:00',
    startedAt: '2024-01-15T08:00:00',
    exercises: {
      'Bench Press': [
        { setIndex: 0, targetReps: 8, targetWeight: 140, unit: 'lb', actualReps: 8, actualWeight: 140, completed: true },
        { setIndex: 1, targetReps: 8, targetWeight: 140, unit: 'lb', actualReps: 8, actualWeight: 140, completed: true },
        // Incomplete set — should be skipped in volume
        { setIndex: 2, targetReps: 8, targetWeight: 140, unit: 'lb', actualReps: 0, actualWeight: 0, completed: false },
      ],
      'Overhead Press': [
        { setIndex: 0, targetReps: 10, targetWeight: 70, unit: 'lb', actualReps: 10, actualWeight: 70, completed: true },
      ],
    },
  },
  '2024-01-17::Lower A': {
    date: '2024-01-17',
    completedAt: '2024-01-17T09:00:00',
    startedAt: '2024-01-17T08:00:00',
    exercises: {
      'Squat': [
        { setIndex: 0, targetReps: 5, targetWeight: 190, unit: 'lb', actualReps: 5, actualWeight: 190, completed: true },
        { setIndex: 1, targetReps: 5, targetWeight: 190, unit: 'lb', actualReps: 5, actualWeight: 190, completed: true },
      ],
      'Pull-ups': [
        { setIndex: 0, targetReps: 8, targetWeight: 0, unit: 'bw', actualReps: 8, actualWeight: 0, completed: true },
      ],
    },
  },
  '2024-01-22::Upper A': {
    date: '2024-01-22',
    completedAt: '2024-01-22T09:00:00',
    startedAt: '2024-01-22T08:00:00',
    exercises: {
      'Bench Press': [
        { setIndex: 0, targetReps: 8, targetWeight: 145, unit: 'lb', actualReps: 8, actualWeight: 145, completed: true },
        { setIndex: 1, targetReps: 5, targetWeight: 155, unit: 'lb', actualReps: 5, actualWeight: 155, completed: true },
      ],
    },
  },
};

// ---------- filterLogsByRange ----------
describe('filterLogsByRange', () => {
  it('returns only logs within the given date range', () => {
    const range = { start: '2024-01-10', end: '2024-01-17' };
    const result = filterLogsByRange(mockLogs, range);
    const keys = Object.keys(result);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('2024-01-10::Lower A');
    expect(keys).toContain('2024-01-15::Upper A');
    expect(keys).toContain('2024-01-17::Lower A');
    expect(keys).not.toContain('2024-01-08::Upper A');
    expect(keys).not.toContain('2024-01-22::Upper A');
  });

  it('returns all logs when dateRange is null', () => {
    const result = filterLogsByRange(mockLogs, null);
    expect(Object.keys(result)).toHaveLength(5);
  });

  it('returns empty object when no logs match', () => {
    const range = { start: '2025-01-01', end: '2025-12-31' };
    const result = filterLogsByRange(mockLogs, range);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------- volumeByWeek ----------
describe('volumeByWeek', () => {
  it('computes correct weekly volume totals', () => {
    const result = volumeByWeek(mockLogs, null);
    // Week of Jan 8 (2024-01-08):
    //   Bench: (8*135)+(8*135)+(6*135) = 1080+1080+810 = 2970
    //   OHP: (10*65)+(10*65) = 650+650 = 1300
    //   Squat: (5*185)*3 = 2775
    //   Total = 2970 + 1300 + 2775 = 7045
    const week1 = result.find(w => w.weekStart === '2024-01-08');
    expect(week1).toBeDefined();
    expect(week1.volume).toBe(7045);
    expect(week1.unit).toBe('lb');
  });

  it('skips incomplete sets (completed: false)', () => {
    const result = volumeByWeek(mockLogs, null);
    // Week of Jan 15:
    //   Bench: (8*140)+(8*140) = 1120+1120 = 2240 (3rd set incomplete, skip)
    //   OHP: (10*70) = 700
    //   Squat: (5*190)+(5*190) = 950+950 = 1900
    //   Pull-ups: bw unit, skip
    //   Total = 2240 + 700 + 1900 = 4840
    const week2 = result.find(w => w.weekStart === '2024-01-15');
    expect(week2).toBeDefined();
    expect(week2.volume).toBe(4840);
  });

  it('skips non-summable units (bw, %, RPE)', () => {
    // Pull-ups on 2024-01-17 have unit 'bw' — should not contribute to volume
    const singleLog = {
      '2024-01-17::Lower A': mockLogs['2024-01-17::Lower A'],
    };
    const result = volumeByWeek(singleLog, null);
    const week = result.find(w => w.weekStart === '2024-01-15');
    // Only squat volume: (5*190)*2 = 1900
    expect(week.volume).toBe(1900);
  });

  it('returns results sorted by weekStart', () => {
    const result = volumeByWeek(mockLogs, null);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].weekStart > result[i - 1].weekStart).toBe(true);
    }
  });
});

// ---------- sessionsByWeek ----------
describe('sessionsByWeek', () => {
  it('counts sessions per ISO week', () => {
    const result = sessionsByWeek(mockLogs, null);
    const week1 = result.find(w => w.weekStart === '2024-01-08');
    const week2 = result.find(w => w.weekStart === '2024-01-15');
    const week3 = result.find(w => w.weekStart === '2024-01-22');
    expect(week1.count).toBe(2);
    expect(week2.count).toBe(2);
    expect(week3.count).toBe(1);
  });

  it('respects date range filter', () => {
    const range = { start: '2024-01-15', end: '2024-01-21' };
    const result = sessionsByWeek(mockLogs, range);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });
});

// ---------- prCountInRange ----------
describe('prCountInRange', () => {
  it('counts new PRs in the given range', () => {
    // All-time: bench 8x135 (Jan 8) → 8x140 (Jan 15, PR) → 8x145 (Jan 22, PR)
    //           bench 5x155 (Jan 22, first at 5 reps = PR)
    //           OHP 10x65 (Jan 8) → 10x70 (Jan 15, PR)
    //           Squat 5x185 (Jan 10) → 5x190 (Jan 17, PR)
    //           Pull-ups 8x0 (Jan 17, 0 weight — not a PR)
    // Range Jan 15–22 should capture: 8x140 bench PR, 10x70 OHP PR, 5x190 squat PR,
    //   8x145 bench PR, 5x155 bench PR = 5 PRs
    const range = { start: '2024-01-15', end: '2024-01-22' };
    const count = prCountInRange(mockLogs, range);
    expect(count).toBe(5);
  });

  it('does not count duplicate/same weights as PRs', () => {
    // Repeat the same weight for same reps — not a PR
    const logs = {
      '2024-01-08::Test': {
        date: '2024-01-08',
        exercises: {
          'Bench Press': [
            { actualReps: 8, actualWeight: 135, unit: 'lb', completed: true },
          ],
        },
      },
      '2024-01-15::Test': {
        date: '2024-01-15',
        exercises: {
          'Bench Press': [
            { actualReps: 8, actualWeight: 135, unit: 'lb', completed: true },
          ],
        },
      },
    };
    const range = { start: '2024-01-15', end: '2024-01-15' };
    const count = prCountInRange(logs, range);
    expect(count).toBe(0);
  });

  it('first ever set for exercise+rep is a PR', () => {
    const logs = {
      '2024-01-08::Test': {
        date: '2024-01-08',
        exercises: {
          'Bench Press': [
            { actualReps: 8, actualWeight: 135, unit: 'lb', completed: true },
          ],
        },
      },
    };
    const count = prCountInRange(logs, null);
    expect(count).toBe(1);
  });
});

// ---------- topExercisesByVolume ----------
describe('topExercisesByVolume', () => {
  it('returns top N exercises by volume, sorted descending', () => {
    const result = topExercisesByVolume(mockLogs, null, 3);
    expect(result).toHaveLength(3);
    // Bench total: 2970 (wk1) + 2240 (wk2) + 8*145+5*155 (wk3) = 2970+2240+1160+775 = 7145
    // Squat total: 2775 (wk1) + 1900 (wk2) = 4675
    // OHP total: 1300 (wk1) + 700 (wk2) = 2000
    // Pull-ups: bw, 0 volume
    expect(result[0].exercise).toBe('Bench Press');
    expect(result[1].exercise).toBe('Squat');
    expect(result[2].exercise).toBe('Overhead Press');
    // Verify volumes
    expect(result[0].volume).toBe(7145);
    expect(result[1].volume).toBe(4675);
    expect(result[2].volume).toBe(2000);
  });

  it('returns fewer than N if fewer exercises exist', () => {
    const singleExLog = {
      '2024-01-08::Test': {
        date: '2024-01-08',
        exercises: {
          'Curl': [
            { actualReps: 10, actualWeight: 25, unit: 'lb', completed: true },
          ],
        },
      },
    };
    const result = topExercisesByVolume(singleExLog, null, 3);
    expect(result).toHaveLength(1);
    expect(result[0].exercise).toBe('Curl');
    expect(result[0].volume).toBe(250);
  });
});

// ---------- volumeByExercise ----------
describe('volumeByExercise', () => {
  it('returns all exercises sorted by volume descending', () => {
    const result = volumeByExercise(mockLogs, null);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].exercise).toBe('Bench Press');
    // Should be sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i].volume).toBeLessThanOrEqual(result[i - 1].volume);
    }
  });

  it('excludes exercises with zero volume (bw units)', () => {
    const result = volumeByExercise(mockLogs, null);
    const pullups = result.find(e => e.exercise === 'Pull-ups');
    expect(pullups).toBeUndefined();
  });
});

// ---------- workoutDates ----------
describe('workoutDates', () => {
  it('returns set of date strings for all completed workouts', () => {
    const dates = workoutDates(mockLogs, null);
    expect(dates).toBeInstanceOf(Set);
    expect(dates.size).toBe(5);
    expect(dates.has('2024-01-08')).toBe(true);
    expect(dates.has('2024-01-10')).toBe(true);
    expect(dates.has('2024-01-15')).toBe(true);
    expect(dates.has('2024-01-17')).toBe(true);
    expect(dates.has('2024-01-22')).toBe(true);
  });

  it('respects date range filter', () => {
    const range = { start: '2024-01-10', end: '2024-01-17' };
    const dates = workoutDates(mockLogs, range);
    expect(dates.size).toBe(3);
    expect(dates.has('2024-01-08')).toBe(false);
    expect(dates.has('2024-01-22')).toBe(false);
  });
});

// ---------- dateRangeFromPreset ----------
describe('dateRangeFromPreset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-01T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("'1W' returns last 7 days", () => {
    const range = dateRangeFromPreset('1W');
    expect(range).toEqual({ start: '2024-01-25', end: '2024-02-01' });
  });

  it("'4W' returns last 28 days", () => {
    const range = dateRangeFromPreset('4W');
    expect(range).toEqual({ start: '2024-01-04', end: '2024-02-01' });
  });

  it("'3M' returns last 90 days", () => {
    const range = dateRangeFromPreset('3M');
    expect(range).toEqual({ start: '2023-11-03', end: '2024-02-01' });
  });

  it("'ALL' returns null", () => {
    const range = dateRangeFromPreset('ALL');
    expect(range).toBeNull();
  });
});
