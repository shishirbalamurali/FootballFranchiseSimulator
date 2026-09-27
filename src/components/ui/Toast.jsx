import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import cx from './cx';
import { ToastContext } from './toast-context';

// One notification system. TradeCenter, FreeAgency and Development each had
// their own bespoke result banner with different markup and timing.

const TONES = {
  neutral:  'border-l-team',
  positive: 'border-l-positive-solid',
  negative: 'border-l-negative-solid',
  warning:  'border-l-warning-solid',
  info:     'border-l-info-solid',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts) => {
    const id = ++idRef.current;
    const entry = typeof opts === 'string' ? { title: opts } : opts;
    const duration = entry.duration ?? 4000;
    setToasts(list => [...list.slice(-3), { id, tone: 'neutral', ...entry }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    toast,
    dismiss,
    success: (o) => toast({ tone: 'positive', ...(typeof o === 'string' ? { title: o } : o) }),
    error:   (o) => toast({ tone: 'negative', ...(typeof o === 'string' ? { title: o } : o) }),
    warn:    (o) => toast({ tone: 'warning',  ...(typeof o === 'string' ? { title: o } : o) }),
    info:    (o) => toast({ tone: 'info',     ...(typeof o === 'string' ? { title: o } : o) }),
  }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-80 flex-col gap-2"
          role="region"
          aria-live="polite"
          aria-label="Notifications"
        >
          <AnimatePresence initial={false}>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={cx(
                  'pointer-events-auto flex items-start gap-3 rounded-card border-l-[10px] bg-surface-raised text-fg px-4 py-3 shadow-2',
                  TONES[t.tone] ?? TONES.neutral,
                )}
              >
                {t.icon && <span className="mt-0.5 shrink-0">{t.icon}</span>}
                <div className="min-w-0 flex-1">
                  <p className="text-label font-semibold">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-label text-fg-secondary">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 text-fg-faint transition-colors hover:text-fg"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
