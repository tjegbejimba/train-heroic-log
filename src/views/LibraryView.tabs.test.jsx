// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LibraryView from './LibraryView.jsx';

const workouts = {
  'Upper A': {
    blocks: [
      {
        exercises: [
          { title: 'Bench Press', notes: '', sets: [{ reps: 5, weight: 135, unit: 'lb' }] },
        ],
      },
    ],
  },
};

const templateList = [
  { id: 'tpl_1', name: 'Push Day', blocks: [{ exercises: [{ title: 'Bench Press', sets: [] }] }] },
  { id: 'tpl_2', name: 'Pull Day', blocks: [{ exercises: [{ title: 'Row', sets: [] }] }] },
];

function renderLibrary(overrides = {}) {
  const props = {
    workouts,
    youtubeLinks: {},
    setYouTubeLink: vi.fn(),
    setManyYouTubeLinks: vi.fn(),
    onExerciseTap: vi.fn(),
    onUpdateExerciseNotes: vi.fn(),
    templateList,
    deleteTemplate: vi.fn(),
    navigate: vi.fn(),
    onTabChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<LibraryView {...props} />), props };
}

describe('LibraryView tabs', () => {
  it('renders both Exercises and Templates tabs', () => {
    renderLibrary();
    expect(screen.getByRole('tab', { name: /exercises/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /templates/i })).toBeTruthy();
  });

  it('defaults to the Exercises tab', () => {
    renderLibrary();
    expect(screen.getByRole('tab', { name: /exercises/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Bench Press')).toBeTruthy();
    // Template names should not be visible on the exercises tab
    expect(screen.queryByText('Push Day')).toBeNull();
  });

  it('switches to the Templates tab and shows template names', () => {
    renderLibrary();
    fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
    expect(screen.getByText('Push Day')).toBeTruthy();
    expect(screen.getByText('Pull Day')).toBeTruthy();
  });

  it('honors initialTab="templates"', () => {
    renderLibrary({ initialTab: 'templates' });
    expect(screen.getByRole('tab', { name: /templates/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Push Day')).toBeTruthy();
  });

  it('navigates to edit a template when a template row is tapped', () => {
    const { props } = renderLibrary({ initialTab: 'templates' });
    fireEvent.click(screen.getByText('Push Day'));
    expect(props.navigate).toHaveBeenCalledWith('editTemplate', { templateId: 'tpl_1' });
  });

  it('shows the Templates tab even when there are no workouts/exercises', () => {
    renderLibrary({ workouts: {}, initialTab: 'templates' });
    expect(screen.getByText('Push Day')).toBeTruthy();
  });

  it('notifies onTabChange so the active tab can be persisted to route history', () => {
    const { props } = renderLibrary();
    fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
    expect(props.onTabChange).toHaveBeenCalledWith('templates');
    fireEvent.click(screen.getByRole('tab', { name: /exercises/i }));
    expect(props.onTabChange).toHaveBeenCalledWith('exercises');
  });
});
