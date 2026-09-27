import { createContext, useContext } from 'react';

// Kept out of Toast.jsx so that file exports components only — otherwise Vite
// fast-refresh bails on the whole module every time a toast is edited.
export const ToastContext = createContext(null);

/** Returns { toast, success, error, warn, info, dismiss }. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
