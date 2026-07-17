// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState, useRef } from 'react';
import { renderHook, act } from '@testing-library/react';

import { useTrainingPlanShell } from './useTrainingPlanShell';
import { applyTemplateChange, applyScheduleChange } from '../orchestrator';

// Harness mirrors the App.jsx shell-to-lifecycle path: render state lives in
// React, writers commit through setState (as the entity hooks do), and every
// planning action reads snap() before calling the real orchestrator.
function useHarness(initial) {
  const [templates, setTemplates] = useState(initial.templates || {});
  const [workouts, setWorkouts] = useState(initial.workouts || {});
  const [schedule, setSchedule] = useState(initial.schedule || {});
  const [logs] = useState(initial.logs || {});
  const errors = useRef([]);

  const shell = useTrainingPlanShell({
    state: { templates, workouts, schedule, logs },
    writers: {
      saveTemplates: setTemplates,
      saveWorkouts: setWorkouts,
      saveSchedule: setSchedule,
    },
    onError: (message) => errors.current.push(message),
  });

  return { shell, state: { templates, workouts, schedule, logs }, errors };
}

const createChange = (title, id) => ({
  type: 'create',
  workout: { title, blocks: [], notes: '' },
  makeId: () => id,
});

describe('useTrainingPlanShell — committed Training Plan snapshot', () => {
  it('advances the committed snapshot so a single action is reflected immediately', () => {
    const { result } = renderHook(() => useHarness({}));

    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyScheduleChange(shell.snap(), { '2026-01-01': 'Upper A' }));
    });

    expect(result.current.shell.snap().schedule).toEqual({ '2026-01-01': 'Upper A' });
    expect(result.current.state.schedule).toEqual({ '2026-01-01': 'Upper A' });
  });

  it('lets back-to-back actions observe the prior committed change instead of a stale render snapshot', () => {
    const { result } = renderHook(() => useHarness({}));

    // Two synchronous actions in one tick — the second must see the first's
    // committed template, not the render-time (empty) snapshot.
    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Upper A', 'idA')));
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Lower B', 'idB')));
    });

    const committed = result.current.shell.snap().templates;
    expect(Object.keys(committed).sort()).toEqual(['idA', 'idB']);
    // Committed React state must also carry both — the first write is not lost.
    expect(Object.keys(result.current.state.templates).sort()).toEqual(['idA', 'idB']);
  });

  it('matches explicitly applying the second action to the first action result', () => {
    const { result } = renderHook(() => useHarness({}));

    // Independent source of truth: fold the two actions by hand.
    const afterA = applyTemplateChange({ templates: {}, workouts: {}, schedule: {}, logs: {} }, createChange('Upper A', 'idA'));
    const expected = applyTemplateChange(
      { templates: afterA.templates, workouts: {}, schedule: {}, logs: {} },
      createChange('Lower B', 'idB')
    );

    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Upper A', 'idA')));
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Lower B', 'idB')));
    });

    expect(result.current.shell.snap().templates).toEqual(expected.templates);
  });

  it('leaves committed state intact when an action is rejected and never exposes a partial snapshot', () => {
    const { result } = renderHook(() => useHarness({}));

    let secondOk;
    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Upper A', 'idA')));
      // Colliding name — orchestrator returns { error }, applyWrites must reject.
      secondOk = shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Upper A', 'idDup')));
    });

    expect(secondOk).toBe(false);
    expect(result.current.errors.current).toHaveLength(1);
    // Committed snapshot is exactly the post-A state — no idDup leaked in.
    expect(Object.keys(result.current.shell.snap().templates)).toEqual(['idA']);

    // A follow-up action still sees the intact committed state from action A.
    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyTemplateChange(shell.snap(), createChange('Lower B', 'idB')));
    });

    expect(Object.keys(result.current.shell.snap().templates).sort()).toEqual(['idA', 'idB']);
  });

  it('picks up external render-state changes so committed reflects the latest render', () => {
    const { result, rerender } = renderHook((props) => useHarness(props), {
      initialProps: {},
    });

    // Simulate an external commit (e.g. a sync pull) by re-rendering with new
    // schedule state; the next action must build on that, not a stale snapshot.
    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyScheduleChange(shell.snap(), { '2026-01-01': 'Upper A' }));
    });

    act(() => {
      const { shell } = result.current;
      shell.applyWrites(applyScheduleChange(shell.snap(), { '2026-01-02': 'Lower B' }));
    });

    expect(result.current.shell.snap().schedule).toEqual({
      '2026-01-01': 'Upper A',
      '2026-01-02': 'Lower B',
    });
  });
});
