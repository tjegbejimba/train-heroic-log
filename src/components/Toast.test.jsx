// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('announces routine feedback politely and errors urgently, then removes expired messages', () => {
  vi.useFakeTimers();
  function Actions() {
    const showToast = useToast();
    return <>
      <button onClick={() => showToast('Saved locally')}>Save</button>
      <button onClick={() => showToast('Could not export', 'error')}>Export</button>
    </>;
  }
  render(<ToastProvider><Actions /></ToastProvider>);
  expect(screen.getByRole('status').textContent).toBe('');
  expect(screen.getByRole('alert').textContent).toBe('');
  fireEvent.click(screen.getByText('Save'));
  fireEvent.click(screen.getByText('Export'));
  expect(screen.getByRole('status').textContent).toBe('Saved locally');
  expect(screen.getByRole('alert').textContent).toBe('Could not export');
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.getByRole('status').textContent).toBe('');
  expect(screen.getByRole('alert').textContent).toBe('');
});
