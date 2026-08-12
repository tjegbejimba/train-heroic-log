// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { activeModalCount } from '../utils/modalStack';
import { useModalA11y } from './useModalA11y';

// Every real consumer (Modal, FeedbackModal, RestTimer) portals its dialog
// root directly onto document.body so background-isolation can operate on
// body's direct children. These test harnesses mirror that shape.

function TestDialog({ onEscape, active = true, focusThird, autoFocusFirstButton = true }) {
  const containerRef = useRef(null);
  const initialFocusRef = useRef(null);
  useModalA11y({ containerRef, initialFocusRef: focusThird ? initialFocusRef : undefined, onEscape, active });

  return createPortal(
    <div ref={containerRef} tabIndex={-1}>
      {autoFocusFirstButton && <button type="button">First</button>}
      <button type="button">Second</button>
      <button ref={focusThird ? initialFocusRef : undefined} type="button">
        Third
      </button>
    </div>,
    document.body
  );
}

function NoFocusableDialog({ onContainerRef }) {
  const containerRef = useRef(null);
  useModalA11y({ containerRef });
  onContainerRef(containerRef);

  return createPortal(
    <div ref={containerRef} tabIndex={-1}>
      <p>Nothing interactive here.</p>
    </div>,
    document.body
  );
}

describe('useModalA11y', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the explicit initialFocusRef target on mount', () => {
    render(<TestDialog focusThird />);
    expect(document.activeElement.textContent).toBe('Third');
  });

  it('falls back to the first focusable element when no initialFocusRef target is given', () => {
    render(<TestDialog />);
    expect(document.activeElement.textContent).toBe('First');
  });

  it('focuses the container itself when there is no focusable content', () => {
    let ref;
    render(<NoFocusableDialog onContainerRef={(r) => { ref = r; }} />);
    expect(document.activeElement).toBe(ref.current);
  });

  it('restores focus to the previously-focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(<TestDialog />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab so it wraps from the last to the first focusable element', () => {
    render(<TestDialog />);
    const buttons = document.querySelectorAll('button');
    const third = buttons[buttons.length - 1];
    third.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => { document.activeElement.dispatchEvent(event); });

    expect(document.activeElement.textContent).toBe('First');
  });

  it('traps Shift+Tab so it wraps from the first to the last focusable element', () => {
    render(<TestDialog />);
    const first = document.querySelector('button');
    first.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => { document.activeElement.dispatchEvent(event); });

    expect(document.activeElement.textContent).toBe('Third');
  });

  it('does nothing on Tab when there is no focusable content (stays on the container)', () => {
    let ref;
    render(<NoFocusableDialog onContainerRef={(r) => { ref = r; }} />);
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => { document.activeElement.dispatchEvent(event); });
    expect(document.activeElement).toBe(ref.current);
  });

  it('invokes onEscape when this dialog is the topmost registered modal', () => {
    const onEscape = vi.fn();
    render(<TestDialog onEscape={onEscape} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onEscape for a background dialog when a second dialog is on top', () => {
    const onEscapeBack = vi.fn();
    const onEscapeFront = vi.fn();

    function TwoDialogs() {
      return (
        <>
          <TestDialog onEscape={onEscapeBack} />
          <TestDialog onEscape={onEscapeFront} />
        </>
      );
    }
    render(<TwoDialogs />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onEscapeFront).toHaveBeenCalledTimes(1);
    expect(onEscapeBack).not.toHaveBeenCalled();
  });

  it('registers and unregisters with the shared modal stack across mount/unmount', () => {
    expect(activeModalCount()).toBe(0);
    const { unmount } = render(<TestDialog />);
    expect(activeModalCount()).toBe(1);
    unmount();
    expect(activeModalCount()).toBe(0);
  });

  it('does not register with the stack while inactive', () => {
    render(<TestDialog active={false} />);
    expect(activeModalCount()).toBe(0);
  });

  it('marks background siblings inert while open and restores them on close', () => {
    const sibling = document.createElement('div');
    sibling.id = 'app-sibling';
    document.body.appendChild(sibling);

    const { unmount } = render(<TestDialog />);
    expect(sibling.hasAttribute('inert')).toBe(true);
    expect(sibling.getAttribute('aria-hidden')).toBe('true');

    unmount();
    expect(sibling.hasAttribute('inert')).toBe(false);
    expect(sibling.hasAttribute('aria-hidden')).toBe(false);
  });

  it('marks a covered (non-topmost) dialog inert + aria-hidden while a second dialog is on top', () => {
    const sibling = document.createElement('div');
    sibling.id = 'app-sibling';
    document.body.appendChild(sibling);

    function TwoDialogs() {
      return (
        <>
          <TestDialog />
          <TestDialog focusThird />
        </>
      );
    }
    const { unmount } = render(<TwoDialogs />);

    const dialogs = document.querySelectorAll('[tabindex="-1"]');
    expect(dialogs).toHaveLength(2);
    const [bottomDialog, topDialog] = dialogs;

    // Only the topmost dialog remains exposed; the covered one goes inert,
    // exactly like true background content — it must not stay reachable by
    // pointer, keyboard, or assistive tech while covered.
    expect(bottomDialog.hasAttribute('inert')).toBe(true);
    expect(bottomDialog.getAttribute('aria-hidden')).toBe('true');
    expect(topDialog.hasAttribute('inert')).toBe(false);
    expect(topDialog.hasAttribute('aria-hidden')).toBe(false);
    expect(sibling.hasAttribute('inert')).toBe(true);

    unmount();
    expect(sibling.hasAttribute('inert')).toBe(false);
  });

  it('restores the covered dialog to interactive precisely when the top dialog closes', () => {
    function TwoDialogs({ showSecond }) {
      return (
        <>
          <TestDialog />
          {showSecond && <TestDialog focusThird />}
        </>
      );
    }
    const { rerender } = render(<TwoDialogs showSecond />);
    const [bottomDialog] = document.querySelectorAll('[tabindex="-1"]');
    expect(bottomDialog.hasAttribute('inert')).toBe(true);

    rerender(<TwoDialogs showSecond={false} />);
    expect(bottomDialog.hasAttribute('inert')).toBe(false);
    expect(bottomDialog.hasAttribute('aria-hidden')).toBe(false);
  });

  it('only the topmost dialog traps Tab — a covered dialog never steals focus back', () => {
    function TwoDialogs() {
      return (
        <>
          <TestDialog />
          <TestDialog focusThird />
        </>
      );
    }
    render(<TwoDialogs />);
    const dialogs = document.querySelectorAll('[tabindex="-1"]');
    const topDialog = dialogs[1];
    const topButtons = topDialog.querySelectorAll('button');
    topButtons[topButtons.length - 1].focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => { document.activeElement.dispatchEvent(event); });

    // Tab must wrap within the top dialog only — never redirected into the
    // covered (inert) dialog underneath.
    expect(topDialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement.textContent).toBe('First');
  });
});
