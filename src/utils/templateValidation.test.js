import { describe, it, expect } from 'vitest';
import { validateTemplate } from './templateValidation';

describe('validateTemplate', () => {
  const makeExercise = (title = 'Bench Press') => ({
    title,
    notes: '',
    workoutNotes: '',
    sets: [{ reps: 10, weight: 135, unit: 'lb', repsUnit: 'reps' }],
  });

  const makeBlock = (exercises) => ({
    value: '',
    units: '',
    instructions: '',
    notes: '',
    exercises: exercises || [makeExercise()],
  });

  // --- Error cases ---

  it('returns error when name is empty', () => {
    const result = validateTemplate('', [makeBlock()]);
    expect(result.error).toBe('Template name is required');
    expect(result.cleanBlocks).toBeNull();
  });

  it('returns error when name is only whitespace', () => {
    const result = validateTemplate('   ', [makeBlock()]);
    expect(result.error).toBe('Template name is required');
  });

  it('returns error when all exercises have empty titles', () => {
    const block = makeBlock([makeExercise(''), makeExercise('  ')]);
    const result = validateTemplate('My Template', [block]);
    expect(result.error).toBe('Add at least one exercise with a name to save');
    expect(result.cleanBlocks).toBeNull();
    expect(result.discardedCount).toBe(2);
  });

  // --- Success cases ---

  it('returns clean blocks with valid exercises', () => {
    const block = makeBlock([makeExercise('Squat'), makeExercise('Deadlift')]);
    const result = validateTemplate('Leg Day', [block]);
    expect(result.error).toBeNull();
    expect(result.cleanBlocks).toHaveLength(1);
    expect(result.cleanBlocks[0].exercises).toHaveLength(2);
    expect(result.discardedCount).toBe(0);
  });

  it('filters out exercises with empty titles and reports count', () => {
    const block = makeBlock([makeExercise('Squat'), makeExercise(''), makeExercise('Lunge')]);
    const result = validateTemplate('Leg Day', [block]);
    expect(result.error).toBeNull();
    expect(result.cleanBlocks[0].exercises).toHaveLength(2);
    expect(result.discardedCount).toBe(1);
  });

  it('removes blocks that have no valid exercises after filtering', () => {
    const validBlock = makeBlock([makeExercise('Bench Press')]);
    const emptyBlock = makeBlock([makeExercise(''), makeExercise('')]);
    const result = validateTemplate('Push Day', [validBlock, emptyBlock]);
    expect(result.error).toBeNull();
    expect(result.cleanBlocks).toHaveLength(1);
    expect(result.discardedCount).toBe(2);
  });

  it('counts discarded exercises across multiple blocks', () => {
    const block1 = makeBlock([makeExercise('Squat'), makeExercise('')]);
    const block2 = makeBlock([makeExercise(''), makeExercise('Press'), makeExercise('')]);
    const result = validateTemplate('Full Body', [block1, block2]);
    expect(result.error).toBeNull();
    expect(result.cleanBlocks).toHaveLength(2);
    expect(result.discardedCount).toBe(3);
  });
});
