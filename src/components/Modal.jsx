import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../hooks/useModalA11y';

export default function Modal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  children,
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  // Shared contract with FeedbackModal and RestTimer: initial focus, Tab
  // containment, Escape-only-when-topmost, focus restoration on close, and
  // background inert-ing while open. The trap/focus boundary is the dialog
  // element itself; the overlay (the actual node portaled onto <body>) is
  // what gets exempted from the background lock. Cancel is always rendered
  // before Confirm below, so the hook's "first focusable element" fallback
  // already lands on the least-destructive action whenever one is present.
  useModalA11y({ containerRef: dialogRef, protectedRef: overlayRef, onEscape: onCancel || undefined });

  return createPortal(
    <div className="modal-overlay" ref={overlayRef} onClick={onCancel}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        aria-describedby={message ? messageId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 id={titleId} className="modal__title">{title}</h2>}
        {message && <p id={messageId} className="modal__message">{message}</p>}
        {children}
        <div className="modal__actions flex gap-md">
          {onCancel && (
            <button className="btn btn-secondary flex-1" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={onConfirm}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
