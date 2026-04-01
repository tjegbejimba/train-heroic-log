import { useEffect } from 'react';

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
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{title}</h2>
        {message && <p className="modal__message">{message}</p>}
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
    </div>
  );
}
