import { describe, it, expect } from 'vitest';
import { generateICS } from './ics.js';

describe('generateICS', () => {
  it('formats the set summary with the canonical spaced "×" glyph, not a bare "x"', () => {
    const schedule = { '2026-01-08': 'Upper A' };
    const workouts = {
      'Upper A': {
        blocks: [
          { exercises: [{ title: 'Bench Press', sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }] }] },
        ],
      },
    };
    const ics = generateICS(schedule, workouts, '2026-01-01', '2026-01-31');
    const descriptionLine = ics.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'));
    expect(descriptionLine).toBe('DESCRIPTION:Bench Press (4 × 8)');
    // Must not regress to the inconsistent bare-"x" shorthand.
    expect(descriptionLine).not.toContain('4x8');
  });

  it('falls back to a spelled-out count when reps are missing', () => {
    const schedule = { '2026-01-08': 'Upper A' };
    const workouts = {
      'Upper A': {
        blocks: [
          { exercises: [{ title: 'Plank', sets: [{ reps: null }, { reps: null }] }] },
        ],
      },
    };
    const ics = generateICS(schedule, workouts, '2026-01-01', '2026-01-31');
    const descriptionLine = ics.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'));
    expect(descriptionLine).toBe('DESCRIPTION:Plank (2 sets)');
  });
});
