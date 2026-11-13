import { useState, useRef, useCallback, createContext, useContext } from 'react';
import { Check, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const showToast = useCallback((message, type = 'success', duration = 2500) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {['status', 'alert'].map(role => (
          <div key={role} role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} aria-relevant="additions" className="toast-region">
            {toasts.filter(toast => (toast.type === 'error') === (role === 'alert')).map((toast) => (
              <div key={toast.id} className={`toast toast--${toast.type}`}>
                {toast.type === 'success' && <Check size={14} style={{ marginRight: '6px', flexShrink: 0 }} />}
                {toast.type === 'error' && <X size={14} style={{ marginRight: '6px', flexShrink: 0 }} />}
                {toast.message}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
