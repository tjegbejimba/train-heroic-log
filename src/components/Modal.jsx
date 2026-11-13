import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../hooks/useModalA11y';

export function ModalSurface({
  children, onClose, labelledBy, describedBy, label,
  className = 'modal', overlayClassName = 'modal-overlay',
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  useModalA11y({ containerRef: dialogRef, protectedRef: overlayRef, onEscape: onClose });

  return createPortal(
    <div className={overlayClassName} ref={overlayRef} onClick={onClose}>
      <div
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label || 'Dialog'}
        aria-describedby={describedBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function Modal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  confirmDisabled = false,
  children,
}) {
  const titleId = useId();
  const messageId = useId();

  return (
    <ModalSurface onClose={onCancel} labelledBy={title ? titleId : undefined} describedBy={message ? messageId : undefined}>
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
            <button className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={onConfirm} disabled={confirmDisabled}>
              {confirmText}
            </button>
          )}
        </div>
    </ModalSurface>
  );
}
