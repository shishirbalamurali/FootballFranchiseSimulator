import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import cx from './cx';
import Button from './Button';

// Replaces the ad-hoc `fixed inset-0` overlays in PlayerModal,
// WaiverWireModal, StoryEventModal, the TradeCenter roster pickers and the
// SlotPicker delete confirm — none of which trapped focus, closed on Escape,
// locked scroll, or announced themselves to assistive tech.

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className = '',
  bare = false,        // children own their padding (full-bleed heroes)
  ariaLabel,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // Focus trap + Escape + scroll lock.
  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog. Done synchronously — the panel is already
    // committed by the time this effect runs, and deferring to rAF meant focus
    // silently never moved whenever rAF was throttled.
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const onBackdrop = useCallback(
    (e) => {
      if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
    },
    [closeOnBackdrop, onClose],
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="toon-backdrop fixed inset-0 z-[100] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onBackdrop}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.9, rotate: -1.5, y: 14 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={cx(
              'flex w-full flex-col max-h-[88vh] overflow-hidden outline-none',
              'rounded-panel bg-surface-overlay shadow-3',
              WIDTHS[size] ?? WIDTHS.md,
              className,
            )}
          >
            {(title || eyebrow) && (
              <header className="toon-banner banner-scope flex items-center gap-3 px-6 py-4 border-b-[3px] border-ink shrink-0">
                <div className="min-w-0 flex-1">
                  {eyebrow && <p className="text-micro uppercase text-fg-muted mb-1">{eyebrow}</p>}
                  {title && <h2 className="toon-title-sm text-h1 font-display leading-none text-fg">{title}</h2>}
                </div>
                {/* A modal without onClose is a forced decision: no close button. */}
                {onClose && <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close dialog" className="paper-scope w-8 px-0">✕</Button>}
              </header>
            )}

            <div className={cx('min-h-0 flex-1 overflow-y-auto', !bare && 'px-6 py-5')}>{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-line bg-surface-sunken shrink-0">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirm dialog — replaces `window.confirm` for franchise reset etc. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => { onConfirm?.(); onClose?.(); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeof body === 'string' ? <p className="text-body text-fg-secondary">{body}</p> : body}
    </Modal>
  );
}

export default Modal;
