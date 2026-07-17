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

  it('preserves the materialized workout when a future schedule references it', () => {
    const snap = {
      ...baseSnap,
      schedule: { '2026-06-01': 'Upper A' },
      logs: {},
    };
    const result = applyTemplateChange(snap, {
      type: 'delete',
      templateId: 'tpl_1',
      today: '2026-03-15',
    });
    expect(result.templates.tpl_1).toBeUndefined();
    // Workout kept because a future session still needs it.
    expect(result.workouts).toBeUndefined();
    // The future schedule entry survives so the plan stays intact.
    expect(result.schedule['2026-06-01']).toBe('Upper A');
  });

  it('removes a materialized workout with only past schedule references', () => {
    const snap = {
      ...baseSnap,
      schedule: { '2026-01-01': 'Upper A' },
      logs: {},
    };
    const result = applyTemplateChange(snap, {
      type: 'delete',
      templateId: 'tpl_1',
      today: '2026-03-15',
    });
    expect(result.workouts['Upper A']).toBeUndefined();
    expect(result.schedule['2026-01-01']).toBeUndefined();
  });

  it('clears past schedule entries but keeps future ones when preserving via a log', () => {
    const snap = {
      ...baseSnap,
      schedule: { '2026-01-01': 'Upper A', '2026-06-01': 'Upper A' },
      logs: { '2026-01-01::Upper A': { date: '2026-01-01' } },
    };
    const result = applyTemplateChange(snap, {
      type: 'delete',
      templateId: 'tpl_1',
      today: '2026-03-15',
    });
    // Workout kept for history (log reference).
    expect(result.workouts).toBeUndefined();
    expect(result.schedule['2026-01-01']).toBeUndefined();
    expect(result.schedule['2026-06-01']).toBe('Upper A');
  });

  it('does not confuse a log for a differently-named workout ending in the title', () => {
    const snap = {
      templates: {
        tpl_s: { id: 'tpl_s', name: 'Special', blocks: [] },
      },
      workouts: { Special: { title: 'Special', blocks: [] } },
      schedule: {},
      // Log belongs to "Workout::Special", NOT "Special".
      logs: { '2026-01-01::Workout::Special': { date: '2026-01-01', workoutTitle: 'Workout::Special' } },
    };
    const result = applyTemplateChange(snap, {
      type: 'delete',
      templateId: 'tpl_s',
      today: '2026-03-15',
    });
    // "Special" is a genuine orphan and must be removed despite the suffix match.
    expect(result.workouts.Special).toBeUndefined();
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

// ─── applyTemplateChange: duplicate ─────────────────────

describe('applyTemplateChange — duplicate', () => {
  const richTemplate = {
    id: 'tpl_1',
    name: 'Upper A',
    createdDate: '2026-01-01T00:00:00.000Z',
    notes: 'Push day focus',
    blocks: [
      {
        exercises: [
          {
            title: 'Bench',
            notes: 'Keep elbows tight',
            workoutNotes: '8 reps each set',
            sets: [{ reps: 8, weight: 135 }, { reps: 8, weight: 135 }],
          },
        ],
      },
    ],
  };

  const baseSnap = {
    templates: { tpl_1: richTemplate },
    workouts: {},
    schedule: {},
    logs: {},
  };

  it('creates an independent copy named "<name> (Copy)"', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'duplicate',
      templateId: 'tpl_1',
      makeId: () => 'tpl_copy',
    });
    expect(result.error).toBeUndefined();
    const copy = result.templates.tpl_copy;
    expect(copy).toBeDefined();
    expect(copy.id).toBe('tpl_copy');
    expect(copy.name).toBe('Upper A (Copy)');
    // Original is left untouched.
    expect(result.templates.tpl_1).toBe(richTemplate);
    expect(result.meta.createdId).toBe('tpl_copy');
  });

  it('returns an error for a missing template', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'duplicate',
      templateId: 'nope',
    });
    expect(result.error).toBeDefined();
    expect(result.templates).toBeUndefined();
  });

  it('deep-clones parts, exercises, sets, and notes (no shared references)', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'duplicate',
      templateId: 'tpl_1',
      makeId: () => 'tpl_copy',
    });
    const copy = result.templates.tpl_copy;
    // Structural equality of the training content...
    expect(copy.blocks).toEqual(richTemplate.blocks);
    // ...but no shared object references at any depth.
    expect(copy.blocks).not.toBe(richTemplate.blocks);
    expect(copy.blocks[0]).not.toBe(richTemplate.blocks[0]);
    expect(copy.blocks[0].exercises).not.toBe(richTemplate.blocks[0].exercises);
    expect(copy.blocks[0].exercises[0]).not.toBe(richTemplate.blocks[0].exercises[0]);
    expect(copy.blocks[0].exercises[0].sets).not.toBe(richTemplate.blocks[0].exercises[0].sets);
    expect(copy.blocks[0].exercises[0].sets[0]).not.toBe(richTemplate.blocks[0].exercises[0].sets[0]);
  });

  it('keeps the copy independent after editing it (mutating the clone does not affect the original)', () => {
    const result = applyTemplateChange(baseSnap, {
      type: 'duplicate',
      templateId: 'tpl_1',
      makeId: () => 'tpl_copy',
    });
    const copy = result.templates.tpl_copy;
    copy.blocks[0].exercises[0].sets[0].weight = 999;
    copy.blocks[0].exercises[0].notes = 'changed';
    expect(richTemplate.blocks[0].exercises[0].sets[0].weight).toBe(135);
    expect(richTemplate.blocks[0].exercises[0].notes).toBe('Keep elbows tight');
  });

  it('duplicates a copy, producing a valid available nested name', () => {
    const snap = {
      ...baseSnap,
      templates: {
        tpl_1: richTemplate,
        tpl_copy: { ...richTemplate, id: 'tpl_copy', name: 'Upper A (Copy)' },
      },
    };
    const result = applyTemplateChange(snap, {
      type: 'duplicate',
      templateId: 'tpl_copy',
      makeId: () => 'tpl_copy2',
    });
    expect(result.error).toBeUndefined();
    expect(result.templates.tpl_copy2.name).toBe('Upper A (Copy) (Copy)');
  });

  it('rejects on collision with the same outcome as create/rename (case-insensitive)', () => {
    const snap = {
      ...baseSnap,
      templates: {
        tpl_1: richTemplate,
        tpl_existing: { id: 'tpl_existing', name: 'upper a (copy)', blocks: [] },
      },
    };
    const result = applyTemplateChange(snap, {
      type: 'duplicate',
      templateId: 'tpl_1',
      makeId: () => 'tpl_copy',
    });
    expect(result.error).toMatch(/already exists/i);
    expect(result.templates).toBeUndefined();
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

// ─── Template ⇄ Workout target consistency ──────────────
//
// Regression coverage for keeping prescribed-set targets consistent between a
// Template and its materialized Workout in *both* directions, exercised through
// the production lifecycle authority (`applyTemplateChange`).

describe('applyTemplateChange — target consistency (Template ⇄ Workout)', () => {
  const blocksWithTarget = (reps, weight) => [
    { exercises: [{ title: 'Bench', sets: [{ reps, weight, unit: 'lb', repsUnit: 'reps' }] }] },
  ];

  const makeSnap = () => ({
    templates: {
      tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: blocksWithTarget(8, 135) },
    },
    workouts: {
      'Upper A': { title: 'Upper A', blocks: blocksWithTarget(8, 135) },
    },
    schedule: {},
    logs: {},
  });

  it('Template → Workout: saving an edited target updates the materialized workout', () => {
    const snap = makeSnap();
    const editedTemplate = { ...snap.templates.tpl_1, blocks: blocksWithTarget(10, 155) };

    const result = applyTemplateChange(snap, { type: 'save', template: editedTemplate });

    // Template holds the new target...
    expect(result.templates.tpl_1.blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 10, weight: 155 });
    // ...and the materialized workout is kept consistent with it.
    expect(result.workouts).toBeDefined();
    expect(result.workouts['Upper A'].blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 10, weight: 155 });
  });

  it('Template → Workout: rename carries the edited target onto the renamed workout', () => {
    const snap = makeSnap();
    const editedTemplate = { ...snap.templates.tpl_1, name: 'Upper B', blocks: blocksWithTarget(12, 145) };

    const result = applyTemplateChange(snap, {
      type: 'save',
      template: editedTemplate,
      previousName: 'Upper A',
    });

    expect(result.workouts['Upper A']).toBeUndefined();
    expect(result.workouts['Upper B'].title).toBe('Upper B');
    expect(result.workouts['Upper B'].blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 12, weight: 145 });
  });

  it('Template → Workout: save without a materialized workout omits the workouts write', () => {
    const snap = makeSnap();
    delete snap.workouts['Upper A'];
    const editedTemplate = { ...snap.templates.tpl_1, blocks: blocksWithTarget(10, 155) };

    const result = applyTemplateChange(snap, { type: 'save', template: editedTemplate });

    expect(result.workouts).toBeUndefined();
  });

  it('Template → Workout: rename refreshes a stale workout already under the new name', () => {
    // Old key absent, but a stale materialized workout already exists under the
    // new name (e.g. a prior schedule materialized it). Its targets must refresh.
    const snap = makeSnap();
    delete snap.workouts['Upper A'];
    snap.workouts['Upper B'] = { title: 'Upper B', blocks: blocksWithTarget(8, 135) };
    const editedTemplate = { ...snap.templates.tpl_1, name: 'Upper B', blocks: blocksWithTarget(12, 145) };

    const result = applyTemplateChange(snap, {
      type: 'save',
      template: editedTemplate,
      previousName: 'Upper A',
    });

    expect(result.workouts['Upper B'].title).toBe('Upper B');
    expect(result.workouts['Upper B'].blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 12, weight: 145 });
  });

  it('Session → Template: confirming an edited target updates the matching template', () => {
    const snap = makeSnap();
    const confirmedBlocks = blocksWithTarget(6, 185);

    const result = applyTemplateChange(snap, {
      type: 'syncBlocks',
      workoutTitle: 'Upper A',
      blocks: confirmedBlocks,
    });

    expect(result.workouts['Upper A'].blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 6, weight: 185 });
    expect(result.templates.tpl_1.blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 6, weight: 185 });
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
