// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryView from './HistoryView.jsx';
import { applyTemplateChange } from '../orchestrator.js';

// A completed session (Log) for a workout that came from a Template.
const loggedSession = {
  key: '2026-01-08::Upper A',
  date: '2026-01-08',
  workoutTitle: 'Upper A',
  completedAt: '2026-01-08T09:30:00',
  startedAt: '2026-01-08T09:00:00',
  exercises: {
    'Bench Press': [
      { targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 8, actualWeight: 135, completed: true },
      { targetReps: 8, targetWeight: 135, unit: 'lb', actualReps: 7, actualWeight: 135, completed: true },
    ],
    'Row': [
      { targetReps: 10, targetWeight: 95, unit: 'lb', actualReps: 10, actualWeight: 95, completed: true },
    ],
  },
};

describe('HistoryView — renders completed sessions after a Template is deleted', () => {
  it('still shows the Workout title, Exercises, and Sets once the Template is gone', () => {
    // Snapshot with a Template + materialized Workout referenced by the completed Log.
    const snap = {
      templates: {
        tpl_1: { id: 'tpl_1', name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench Press' }] }] },
      },
      workouts: {
        'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench Press' }] }] },
      },
      schedule: {},
      logs: { '2026-01-08::Upper A': loggedSession },
    };

    // Delete the Template — the log-referenced Workout must be preserved.
    const result = applyTemplateChange(snap, {
      type: 'delete',
      templateId: 'tpl_1',
      today: '2026-03-15',
    });
    expect(result.templates.tpl_1).toBeUndefined();
    // Workout preserved: result carries no workouts change (deletion skipped).
    const survivingWorkouts = result.workouts ?? snap.workouts;
    expect(survivingWorkouts['Upper A']).toBeDefined();

    render(
      <HistoryView
        allLogs={[loggedSession]}
        deleteLog={vi.fn()}
        workouts={survivingWorkouts}
        completedDates={new Set(['2026-01-08'])}
      />
    );

    // Workout title renders.
    expect(screen.getByText('Upper A')).toBeTruthy();

    // Expand the entry to reveal exercises and sets.
    fireEvent.click(screen.getByText('Upper A'));

    // Exercises render.
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('Row')).toBeTruthy();

    // Sets render (actual load values).
    expect(screen.getAllByText('8 × 135').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10 × 95').length).toBeGreaterThan(0);
  });
});

describe('HistoryView — delete confirm (destructive Modal consumer)', () => {
  function renderWithLog() {
    const deleteLog = vi.fn();
    render(
      <HistoryView
        allLogs={[loggedSession]}
        deleteLog={deleteLog}
        workouts={{ 'Upper A': { title: 'Upper A', blocks: [{ exercises: [{ title: 'Bench Press' }] }] } }}
        completedDates={new Set(['2026-01-08'])}
      />
    );
    return { deleteLog };
  }

  it('opens a labelled destructive dialog and restores focus to the delete trigger on cancel', () => {
    const { deleteLog } = renderWithLog();
    const deleteTrigger = screen.getByLabelText(/Delete Upper A from/i);
    deleteTrigger.focus();
    fireEvent.click(deleteTrigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).not.toBe(deleteTrigger);

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(deleteTrigger);
    expect(deleteLog).not.toHaveBeenCalled();
  });

  it('deletes on confirm', () => {
    const { deleteLog } = renderWithLog();
    fireEvent.click(screen.getByLabelText(/Delete Upper A from/i));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteLog).toHaveBeenCalledWith(loggedSession.key);
  });
});
