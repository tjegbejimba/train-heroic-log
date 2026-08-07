// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedbackModal from './FeedbackModal';

describe('FeedbackModal — dialog semantics and interaction contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });
    }
  });

  it('renders role="dialog" aria-modal labelled by its heading', () => {
    render(<FeedbackModal onClose={() => {}} showToast={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId).textContent).toBe('Send Feedback');
  });

  it('focuses the title input on mount', () => {
    render(<FeedbackModal onClose={() => {}} showToast={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
  });

  it('traps Tab within the dialog', () => {
    render(<FeedbackModal onClose={() => {}} showToast={() => {}} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Title' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Description' } });

    const sendBtn = screen.getByRole('button', { name: 'Send Feedback' });
    sendBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // Wraps back to the first focusable control (a category pill button).
    expect(document.activeElement.textContent).toBe('Bug');
  });

  it('calls onClose on Escape when not submitting', () => {
    const onClose = vi.fn();
    render(<FeedbackModal onClose={onClose} showToast={() => {}} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the invoking control on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Send Feedback trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<FeedbackModal onClose={() => {}} showToast={() => {}} />);
    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('marks the rest of the app inert while open', () => {
    const appRoot = document.createElement('div');
    document.body.appendChild(appRoot);
    render(<FeedbackModal onClose={() => {}} showToast={() => {}} />);
    expect(appRoot.hasAttribute('inert')).toBe(true);
  });

  it('still submits feedback and calls onClose + showToast on success', async () => {
    const onClose = vi.fn();
    const showToast = vi.fn();
    render(<FeedbackModal onClose={onClose} showToast={showToast} currentView="training" />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bug title' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'It broke' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(showToast).toHaveBeenCalledWith('Feedback sent - thank you!');
  });
});
