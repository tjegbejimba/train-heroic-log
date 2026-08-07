import { useLayoutEffect, useId, useRef } from 'react';
import {
  pushModal,
  popModal,
  isTopModal,
  activeModalCount,
  getFocusableElements,
  registerProtectedNode,
  unregisterProtectedNode,
  getProtectedNodes,
  lockBackground,
  unlockBackground,
} from '../utils/modalStack';

/**
 * Shared accessibility contract for the app's full-screen overlay
 * components (Modal, FeedbackModal, RestTimer). One hook backs all of them
 * so there is only ever a single, coordinated focus trap / Escape handler /
 * background-isolation mechanism, even when overlays are nested or replaced
 * in rapid succession.
 *
 * - Moves focus to `initialFocusRef` (or the first focusable descendant, or
 *   the container itself when nothing is focusable) on mount.
 * - Restores focus to whatever was focused before mount, on unmount.
 * - Traps Tab/Shift+Tab within the container, wrapping at the ends.
 * - Invokes `onEscape` on Escape, but only while this instance is the
 *   topmost registered overlay (so a background dialog under a newer one
 *   never reacts).
 * - Marks every other direct child of <body> `inert` + `aria-hidden` while
 *   any overlay is open, and restores them once none remain. `protectedRef`
 *   (defaulting to `containerRef`) must resolve to the node portaled
 *   directly onto document.body — pass it explicitly when the focus/trap
 *   boundary (e.g. the dialog element) is nested inside a wider portal root
 *   (e.g. a backdrop).
 */
export function useModalA11y({ containerRef, protectedRef, initialFocusRef, onEscape, active = true } = {}) {
  const id = useId();
  const previousActiveElement = useRef(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useLayoutEffect(() => {
    if (!active) return undefined;
    const container = containerRef?.current;
    if (!container) return undefined;
    const protectedNode = protectedRef?.current || container;

    previousActiveElement.current = document.activeElement;

    pushModal(id);
    registerProtectedNode(id, protectedNode);
    lockBackground(getProtectedNodes());

    const target = initialFocusRef?.current || getFocusableElements(container)[0] || container;
    target.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isTopModal(id) && onEscapeRef.current) onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      popModal(id);
      unregisterProtectedNode(id);
      if (activeModalCount() === 0) {
        unlockBackground();
      } else {
        lockBackground(getProtectedNodes());
      }

      const toRestore = previousActiveElement.current;
      if (toRestore && document.contains(toRestore) && typeof toRestore.focus === 'function') {
        toRestore.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
