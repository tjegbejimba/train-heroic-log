// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal — dialog semantics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders role="dialog" and aria-modal="true" on the dialog element', () => {
    render(<Modal title="Cancel Workout?" message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('labels the dialog via aria-labelledby pointing at the title', () => {
    render(<Modal title="Delete Template?" onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId).textContent).toBe('Delete Template?');
  });

  it('describes the dialog via aria-describedby when a message is present', () => {
    render(<Modal title="Delete Workout Log?" message="This will permanently remove this workout." onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const descId = dialog.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId).textContent).toBe('This will permanently remove this workout.');
  });

  it('omits aria-describedby for a children-only modal with no message', () => {
    render(
      <Modal title="Resume Workout?" onConfirm={() => {}} onCancel={() => {}}>
        <div>Upper A — started 12 min ago</div>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByText('Upper A — started 12 min ago')).toBeTruthy();
  });

  it('falls back to a generic aria-label when no title is given', () => {
    render(<Modal onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBeFalsy();
    expect(dialog.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('Modal — initial focus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the Cancel button by default when both actions are present (least-destructive first)', () => {
    render(<Modal title="Cancel Workout?" onConfirm={() => {}} onCancel={() => {}} confirmText="Cancel Workout" cancelText="Keep Going" />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep Going' }));
  });

  it('focuses the Confirm button when there is no Cancel action (completion summary)', () => {
    render(<Modal title="Workout complete" onConfirm={() => {}} onCancel={null} confirmText="Done" cancelText={null} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
  });

  it('focuses the dialog itself when there is no focusable content at all', () => {
    render(<Modal title="Nothing interactive" />);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
  });
});

describe('Modal — focus trap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps Tab from the last action back to the first', () => {
    render(<Modal title="Clear Week?" onConfirm={() => {}} onCancel={() => {}} confirmText="Clear" cancelText="Keep" />);
    const cancelBtn = screen.getByRole('button', { name: 'Keep' });
    const confirmBtn = screen.getByRole('button', { name: 'Clear' });
    confirmBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('wraps Shift+Tab from the first action back to the last', () => {
    render(<Modal title="Clear Week?" onConfirm={() => {}} onCancel={() => {}} confirmText="Clear" cancelText="Keep" />);
    const cancelBtn = screen.getByRole('button', { name: 'Keep' });
    const confirmBtn = screen.getByRole('button', { name: 'Clear' });
    cancelBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });
});

describe('Modal — Escape and scrim behavior (preserved)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(<Modal title="Cancel Workout?" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not throw on Escape when onCancel is not provided (completion summary)', () => {
    render(<Modal title="Workout complete" onConfirm={() => {}} onCancel={null} confirmText="Done" />);
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
  });

  it('calls onCancel when the scrim (overlay) is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(<Modal title="Cancel Workout?" onConfirm={() => {}} onCancel={onCancel} />);
    void container;
    fireEvent.click(document.querySelector('.modal-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking inside the dialog content', () => {
    const onCancel = vi.fn();
    render(<Modal title="Cancel Workout?" message="Are you sure?" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Are you sure?'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Modal — focus restoration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('restores focus to the invoking control when the modal closes', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Delete Upper A from Jan 8';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(<Modal title="Delete Workout Log?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Modal — background isolation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('marks the rest of the app inert while open and restores it on close', () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'app-root';
    document.body.appendChild(appRoot);

    const { unmount } = render(<Modal title="Restore from backup?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(appRoot.hasAttribute('inert')).toBe(true);

    unmount();
    expect(appRoot.hasAttribute('inert')).toBe(false);
  });
});

describe('Modal — nested / rapidly replaced modals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('only the topmost modal reacts to Escape when two are mounted at once', () => {
    const onCancelBack = vi.fn();
    const onCancelFront = vi.fn();
    render(
      <>
        <Modal title="Back dialog" onConfirm={() => {}} onCancel={onCancelBack} />
        <Modal title="Front dialog" onConfirm={() => {}} onCancel={onCancelFront} />
      </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelFront).toHaveBeenCalledTimes(1);
    expect(onCancelBack).not.toHaveBeenCalled();
  });

  it('supports a modal closing and a new one opening immediately after (rapid replace)', () => {
    // Mirrors the real app pattern (ActiveWorkoutView): each modal lives
    // behind its own boolean flag at a distinct JSX position, so closing one
    // and opening the next is a genuine unmount + mount, not a prop update
    // on a reused instance.
    function Harness() {
      const [showFinishEarly, setShowFinishEarly] = useState(true);
      const [showSummary, setShowSummary] = useState(false);
      return (
        <>
          {showFinishEarly && (
            <Modal
              title="Finish Early?"
              onConfirm={() => { setShowFinishEarly(false); setShowSummary(true); }}
              onCancel={() => setShowFinishEarly(false)}
              confirmText="Finish Anyway"
              cancelText="Keep Going"
            />
          )}
          {showSummary && (
            <Modal title="Workout complete" onConfirm={() => setShowSummary(false)} onCancel={null} confirmText="Done" />
          )}
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish Anyway' }));
    expect(screen.getByRole('heading', { name: 'Workout complete' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
  });
});

describe('Modal — no-focusable-content edge case', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not crash with no title, message, actions, or children, and Tab is a no-op', () => {
    render(<Modal />);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
    expect(document.activeElement).toBe(dialog);
  });
});
