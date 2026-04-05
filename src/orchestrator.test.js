import { describe, it, expect } from 'vitest';
import { applyTemplateChange, applyScheduleChange, applyNoteChange, applyImport } from './orchestrator';

// ─── applyTemplateChange: delete ────────────────────────

describe('applyTemplateChange — delete', () => {
  const baseSnap = {
    templates: {
      tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] },
    },
    workouts: {
      'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] },
    },
    schedule: { '2026-03-01': 'Upper A', '2026-03-08': 'Upper A' },
    logs: {},
  };

  it('deletes orphan workout when no logs reference it', () => {
    const result = applyTemplateChange(baseSnap, { type: 'delete', templateId: 'tpl_1' });
    expect(result.templates.tpl_1).toBeUndefined();
    expect(result.workouts['Upper A']).toBeUndefined();
    expect(result.schedule['2026-03-01']).toBeUndefined();
    expect(result.schedule['2026-03-08']).toBeUndefined();
  });

  it('preserves workout when logs reference it', () => {
    const snap = {
      ...baseSnap,
      logs: { '2026-03-01::Upper A': { date: '2026-03-01' } },
    };
    const result = applyTemplateChange(snap, { type: 'delete', templateId: 'tpl_1' });
    expect(result.templates.tpl_1).toBeUndefined();
    expect(result.workouts).toBeUndefined();
    expect(result.schedule['2026-03-01']).toBeUndefined();
  });

  it('returns error for missing template', () => {
    const result = applyTemplateChange(baseSnap, { type: 'delete', templateId: 'nonexistent' });
    expect(result.error).toBeDefined();
  });
});

// ─── applyTemplateChange: save/rename ───────────────────

describe('applyTemplateChange — save/rename', () => {
  const baseSnap = {
    templates: {
      tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] },
      tpl_2: { id: 'tpl_2', name: 'Lower A', blocks: [] },
    },
    workouts: {
      'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] },
    },
    schedule: { '2026-03-01': 'Upper A', '2026-03-08': 'Upper A' },
    logs: {},
  };

  it('renames template and cascades to schedule + workouts', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'save',
      template: { ...baseSnap.templates.tpl_1, name: 'Upper B' },
      previousName: 'Upper A',
    });
    expect(result.templates.tpl_1.name).toBe('Upper B');
    expect(result.schedule['2026-03-01']).toBe('Upper B');
    expect(result.schedule['2026-03-08']).toBe('Upper B');
    expect(result.workouts['Upper A']).toBeUndefined();
    expect(result.workouts['Upper B']).toBeDefined();
    expect(result.workouts['Upper B'].title).toBe('Upper B');
  });

  it('saves template without rename when name unchanged', () => {
    const updated = { ...baseSnap.templates.tpl_1, blocks: [{ exercises: [{ title: 'Incline Bench' }] }] };
    const result = applyTemplateChange(baseSnap, {
      type: 'save',
      template: updated,
    });
    expect(result.templates.tpl_1.blocks[0].exercises[0].title).toBe('Incline Bench');
    expect(result.schedule).toBeUndefined();
  });

  it('returns error on name collision (case-insensitive)', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'save',
      template: { ...baseSnap.templates.tpl_1, name: 'lower a' },
      previousName: 'Upper A',
    });
    expect(result.error).toMatch(/already exists/i);
  });

  it('allows saving with same name (no collision with self)', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'save',
      template: { ...baseSnap.templates.tpl_1, name: 'Upper A' },
      previousName: 'Upper A',
    });
    expect(result.error).toBeUndefined();
    expect(result.templates.tpl_1.name).toBe('Upper A');
  });
});

// ─── applyTemplateChange: create ────────────────────────

describe('applyTemplateChange — create', () => {
  const baseSnap = {
    templates: {},
    workouts: { 'My Workout': { title: 'My Workout', blocks: [{ exercises: [{ title: 'Squat' }] }] } },
    schedule: {},
    logs: {},
  };

  it('creates template from workout', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'create',
      workout: baseSnap.workouts['My Workout'],
      makeId: () => 'tpl_test',
    });
    expect(result.templates.tpl_test).toBeDefined();
    expect(result.templates.tpl_test.name).toBe('My Workout');
    expect(result.templates.tpl_test.blocks[0].exercises[0].title).toBe('Squat');
  });

  it('returns error if template name already exists', () => {
    const snap = {
      ...baseSnap,
      templates: { tpl_1: { id: 'tpl_1', name: 'My Workout', blocks: [] } },
    };
    const result = applyTemplateChange(snap, {
      type: 'create',
      workout: baseSnap.workouts['My Workout'],
    });
    expect(result.error).toMatch(/already exists/i);
  });
});

// ─── applyTemplateChange: syncBlocks ────────────────────

describe('applyTemplateChange — syncBlocks', () => {
  it('syncs workout blocks back to template and workout', () => {
    const snap = {
      templates: { tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] } },
      workouts: { 'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }] } },
      schedule: {},
      logs: {},
    };
    const newBlocks = [{ exercises: [{ title: 'Incline Bench' }, { title: 'Fly' }] }];
    const result = applyTemplateChange(snap, {
      type: 'syncBlocks',
      workoutTitle: 'Upper A',
      blocks: newBlocks,
    });
    expect(result.workouts['Upper A'].blocks).toEqual(newBlocks);
    expect(result.templates.tpl_1.blocks).toEqual(newBlocks);
  });
});

// ─── applyScheduleChange ────────────────────────────────

describe('applyScheduleChange', () => {
  const baseSnap = {
    templates: {
      tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }], notes: 'Focus on chest' },
    },
    workouts: {},
    schedule: {},
    logs: {},
  };

  it('assigns date and creates workout from template', () => {
    const result = applyScheduleChange(baseSnap, { '2026-03-01': 'Upper A' });
    expect(result.schedule['2026-03-01']).toBe('Upper A');
    expect(result.workouts['Upper A']).toBeDefined();
    expect(result.workouts['Upper A'].title).toBe('Upper A');
    expect(result.workouts['Upper A'].notes).toBe('Focus on chest');
  });

  it('does not recreate workout if it already exists', () => {
    const snap = {
      ...baseSnap,
      workouts: { 'Upper A': { title: 'Upper A', blocks: [], notes: '' } },
    };
    const result = applyScheduleChange(snap, { '2026-03-01': 'Upper A' });
    expect(result.schedule['2026-03-01']).toBe('Upper A');
    expect(result.workouts).toBeUndefined();
  });

  it('clears date and removes orphan workout', () => {
    const snap = {
      ...baseSnap,
      workouts: { 'Upper A': { title: 'Upper A', blocks: [] } },
      schedule: { '2026-03-01': 'Upper A' },
    };
    const result = applyScheduleChange(snap, { '2026-03-01': null });
    expect(result.schedule['2026-03-01']).toBeUndefined();
    expect(result.workouts['Upper A']).toBeUndefined();
  });

  it('preserves workout if still used on another date', () => {
    const snap = {
      ...baseSnap,
      workouts: { 'Upper A': { title: 'Upper A', blocks: [] } },
      schedule: { '2026-03-01': 'Upper A', '2026-03-08': 'Upper A' },
    };
    const result = applyScheduleChange(snap, { '2026-03-01': null });
    expect(result.schedule['2026-03-01']).toBeUndefined();
    expect(result.schedule['2026-03-08']).toBe('Upper A');
    expect(result.workouts).toBeUndefined();
  });

  it('handles batch plan with creates and orphan removals', () => {
    const snap = {
      templates: {
        tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [] }], notes: '' },
        tpl_2: { id: 'tpl_2', name: 'Lower A', blocks: [{ exercises: [] }], notes: '' },
      },
      workouts: { 'Upper A': { title: 'Upper A', blocks: [] } },
      schedule: { '2026-03-01': 'Upper A' },
      logs: {},
    };
    const result = applyScheduleChange(snap, {
      '2026-03-01': null,
      '2026-03-02': 'Lower A',
    });
    expect(result.schedule['2026-03-01']).toBeUndefined();
    expect(result.schedule['2026-03-02']).toBe('Lower A');
    expect(result.workouts['Upper A']).toBeUndefined();
    expect(result.workouts['Lower A']).toBeDefined();
  });
});

// ─── applyNoteChange ────────────────────────────────────

describe('applyNoteChange', () => {
  const baseSnap = {
    templates: {
      tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench', notes: '' }] }] },
    },
    workouts: {
      'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench', notes: '' }] }] },
      'Upper B': { title: 'Upper B', blocks: [{ exercises: [{ title: 'Bench', notes: '' }] }] },
    },
    schedule: {},
    logs: {},
  };

  it('updates notes for one workout + matching template (scoped)', () => {
    const result = applyNoteChange(baseSnap, 'Bench', 'Keep elbows tight', { workoutTitle: 'Upper A' });
    expect(result.workouts['Upper A'].blocks[0].exercises[0].notes).toBe('Keep elbows tight');
    expect(result.templates.tpl_1.blocks[0].exercises[0].notes).toBe('Keep elbows tight');
    expect(result.workouts['Upper B'].blocks[0].exercises[0].notes).toBe('');
  });

  it('updates notes across ALL workouts and templates (global)', () => {
    const result = applyNoteChange(baseSnap, 'Bench', 'Keep elbows tight');
    expect(result.workouts['Upper A'].blocks[0].exercises[0].notes).toBe('Keep elbows tight');
    expect(result.workouts['Upper B'].blocks[0].exercises[0].notes).toBe('Keep elbows tight');
    expect(result.templates.tpl_1.blocks[0].exercises[0].notes).toBe('Keep elbows tight');
  });
});

// ─── applyImport ────────────────────────────────────────

describe('applyImport', () => {
  it('creates templates from imported workouts', () => {
    const snap = { templates: {}, workouts: {}, schedule: {}, logs: {} };
    const workoutMap = {
      'New Workout': { title: 'New Workout', blocks: [{ exercises: [{ title: 'Squat' }] }], notes: '' },
    };
    const scheduleMap = { '2026-03-01': 'New Workout' };
    const result = applyImport(snap, workoutMap, scheduleMap, { makeId: (i) => `tpl_${i}` });
    expect(result.workouts['New Workout']).toBeDefined();
    expect(result.schedule['2026-03-01']).toBe('New Workout');
    expect(Object.keys(result.templates).length).toBe(1);
    const tpl = Object.values(result.templates)[0];
    expect(tpl.name).toBe('New Workout');
  });

  it('preserves workoutNotes from existing templates on re-import', () => {
    const snap = {
      templates: {
        tpl_1: {
          id: 'tpl_1', name: 'Upper A',
          blocks: [{ exercises: [{ title: 'Bench', workoutNotes: '8 reps each side' }] }],
        },
      },
      workouts: {},
      schedule: {},
      logs: {},
    };
    const workoutMap = {
      'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench' }] }], notes: '' },
    };
    const result = applyImport(snap, workoutMap, {});
    const tpl = Object.values(result.templates).find((t) => t.name === 'Upper A');
    expect(tpl.blocks[0].exercises[0].workoutNotes).toBe('8 reps each side');
  });
});
