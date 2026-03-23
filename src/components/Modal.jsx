export default function Modal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        <p className="modal__message">{message}</p>
        <div className="modal__actions flex gap-md">
          <button className="btn btn-secondary flex-1" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="btn btn-primary flex-1" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
