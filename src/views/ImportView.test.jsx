// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ImportView from './ImportView';

const csv = `WorkoutTitle,ScheduledDate,ExerciseTitle,ExerciseData
Upper,2026-08-10,Bench Press,5 rep x 185 pound`;

describe('ImportView', () => {
  it('defaults to safe merge and exposes template conflict remediation', () => {
    const report = {
      imported: [],
      alreadyPresent: [],
      templateConflicts: [{
        id: 'template:Upper',
        existingName: 'Upper',
        importedName: 'Upper',
        importedDates: ['2026-08-10'],
        suggestedName: 'Upper (Imported)',
        existingTemplate: {
          blocks: [{
            exercises: [{
              title: 'Bench Press',
              notes: 'Pause on the chest',
              sets: [{ reps: 3, weight: 205, unit: 'lb' }],
            }],
          }],
        },
        importedWorkout: {
          blocks: [{
            exercises: [{
              title: 'Bench Press',
              notes: 'Keep elbows tucked',
              sets: [{ reps: 5, weight: 185, unit: 'lb' }],
            }],
          }],
        },
      }],
      scheduleConflicts: [],
    };
    const onMergeImport = vi.fn(() => report);
    const onResolveConflict = vi.fn((currentReport) => ({
      ...currentReport,
      imported: [{ name: 'Upper (Imported)', dates: ['2026-08-10'] }],
      templateConflicts: [],
    }));

    render(
      <ImportView
        onMergeImport={onMergeImport}
        onResolveConflict={onResolveConflict}
        onReplaceImport={vi.fn()}
        onDone={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Paste CSV'), { target: { value: csv } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview pasted CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge safely' }));

    expect(onMergeImport).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Import report' })).toBeTruthy();
    expect(screen.getAllByText('Template conflicts')).toHaveLength(2);
    fireEvent.click(screen.getByText('Compare workout definitions'));
    expect(screen.getByText(/5 reps @ 185 lb/i)).toBeTruthy();
    expect(screen.getByText('Keep elbows tucked')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Import with new name' }));
    expect(onResolveConflict).toHaveBeenCalledWith(
      report,
      expect.objectContaining({
        kind: 'template',
        id: 'template:Upper',
        action: 'rename',
        newName: 'Upper (Imported)',
      })
    );
    expect(screen.getByText('All conflicts resolved')).toBeTruthy();
  });

  it('guards full replacement with the current data counts', () => {
    const onReplaceImport = vi.fn();
    render(
      <ImportView
        onMergeImport={vi.fn()}
        onResolveConflict={vi.fn()}
        onReplaceImport={onReplaceImport}
        onDone={vi.fn()}
        existingCounts={{ workouts: 12, scheduledDates: 24 }}
      />
    );

    fireEvent.change(screen.getByLabelText('Paste CSV'), { target: { value: csv } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview pasted CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace all workouts and schedule' }));

    expect(screen.getByText(/replaces 12 workouts and 24 scheduled dates/i)).toBeTruthy();
    expect(onReplaceImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    expect(onReplaceImport).toHaveBeenCalledOnce();
  });
});
