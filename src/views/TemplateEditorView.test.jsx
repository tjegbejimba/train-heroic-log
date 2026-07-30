// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TemplateEditorView from './TemplateEditorView.jsx';
import { ToastProvider } from '../components/Toast';

// Regression coverage for issue #88: the exercise-title field commits free-typed
// text through a delayed onBlur handler (200ms, to let a dropdown click land
// first). That deferred commit must merge into whatever state is current when
// the timer fires, not overwrite a stale snapshot captured when the blur was
// scheduled.

function emptyTemplate() {
  return { id: 'tpl-1', name: 'Test Template', blocks: [] };
}

function renderEditor(props = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <ToastProvider>
      <TemplateEditorView
        template={emptyTemplate()}
        exerciseNames={['Back Squat', 'Overhead Press']}
        onSave={onSave}
        onCancel={onCancel}
        {...props}
      />
    </ToastProvider>
  );
  return { onSave, onCancel };
}

describe('TemplateEditorView deferred exercise-title commit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves a reps value entered immediately after typing a free-text title', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Barbell Bench Press' } });
    fireEvent.blur(titleInput);

    // Before the deferred blur commit fires, enter a reps value for the
    // (still untitled) exercise's first set.
    const repsInput = screen.getAllByPlaceholderText('-')[0];
    fireEvent.change(repsInput, { target: { value: '8' } });

    // Let the deferred title commit run.
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(repsInput.value).toBe('8');
    expect(screen.getByDisplayValue('Barbell Bench Press')).toBeTruthy();
  });

  it('keeps a newly added exercise (and the typed title) after clicking Add Exercise to Part', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Overhead Press' } });
    fireEvent.blur(titleInput);

    // Before the deferred blur commit fires, add a second exercise to the part.
    fireEvent.click(screen.getByText('Add Exercise to Part'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByPlaceholderText('Search exercises...')).toHaveLength(2);
    expect(screen.getByDisplayValue('Overhead Press')).toBeTruthy();
  });

  it('commits a pending free-text title before saving, even if Save is clicked before the deferred commit fires', () => {
    const { onSave } = renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Zercher Squat' } });
    fireEvent.blur(titleInput);

    // Click Save immediately — before the 200ms deferred title commit fires.
    fireEvent.click(screen.getByText('Save Template'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.blocks[0].exercises[0].title).toBe('Zercher Squat');
  });

  it('still commits immediately when an exercise is selected from the dropdown', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Back' } });

    fireEvent.mouseDown(screen.getByText('Back Squat'));

    // No timer advance needed — dropdown selection commits synchronously.
    expect(screen.getByDisplayValue('Back Squat')).toBeTruthy();
  });
});
