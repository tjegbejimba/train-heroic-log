// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TemplateEditorView from './TemplateEditorView.jsx';
import { ToastProvider } from '../components/Toast';

// Issue #88 regressions: committing a free-text exercise title must not
// overwrite edits made immediately afterward.

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

describe('TemplateEditorView exercise entry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects an existing exercise with ArrowDown and Enter without losing input focus', () => {
    const { onSave } = renderEditor();
    const input = screen.getByPlaceholderText('Search exercises...');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'Back' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('Back Squat');
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByText('Save Template'));
    expect(onSave.mock.calls[0][0].blocks[0].exercises[0].title).toBe('Back Squat');
  });

  it('names target sets and unit selectors in their exercise context', () => {
    renderEditor();
    expect(screen.getByLabelText('Part A, exercise 1, set 1, target reps')).toBeTruthy();
    expect(screen.getByLabelText('Part A, exercise 1, set 1, target value (lb)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Part A, exercise 1, value unit'), { target: { value: 'sec' } });
    expect(screen.getByLabelText('Part A, exercise 1, set 1, target value (sec)')).toBeTruthy();
    expect(screen.getByLabelText('Part A, exercise 1, reps unit')).toBeTruthy();
  });

  it('preserves a reps value entered immediately after typing a free-text title', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Barbell Bench Press' } });
    fireEvent.blur(titleInput);

    // Enter reps immediately after committing the title.
    const repsInput = screen.getAllByPlaceholderText('-')[0];
    fireEvent.change(repsInput, { target: { value: '8' } });

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

    fireEvent.click(screen.getByText('Add Exercise to Part'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByPlaceholderText('Search exercises...')).toHaveLength(2);
    expect(screen.getByDisplayValue('Overhead Press')).toBeTruthy();
  });

  it('keeps a newly added set (and the typed title) after clicking + Set', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Lateral Raise' } });
    fireEvent.blur(titleInput);

    const setsBefore = screen.getAllByPlaceholderText('-').length;
    fireEvent.click(screen.getByText('+ Set'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByPlaceholderText('-').length).toBeGreaterThan(setsBefore);
    expect(screen.getByDisplayValue('Lateral Raise')).toBeTruthy();
  });

  it('keeps a newly added part (and the typed title) after clicking Add Part', () => {
    renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Front Squat' } });
    fireEvent.blur(titleInput);

    const titlesBefore = screen.getAllByPlaceholderText('Search exercises...').length;
    fireEvent.click(screen.getByText('Add Part'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByPlaceholderText('Search exercises...').length).toBeGreaterThan(titlesBefore);
    expect(screen.getByDisplayValue('Front Squat')).toBeTruthy();
  });

  it('saves a free-text title when Save is clicked immediately after blur', () => {
    const { onSave } = renderEditor();

    const titleInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.focus(titleInput);
    fireEvent.change(titleInput, { target: { value: 'Zercher Squat' } });
    fireEvent.blur(titleInput);

    // Click Save immediately after blur.
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

    fireEvent.click(screen.getByRole('option', { name: 'Back Squat' }));

    // No timer advance needed — dropdown selection commits synchronously.
    expect(screen.getByDisplayValue('Back Squat')).toBeTruthy();
  });
});
