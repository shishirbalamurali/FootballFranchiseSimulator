import cx from './cx';
import Button from './Button';

// Replaces 16 different one-off "No X yet" strings, most of which sat inside
// a fixed-height widget and left a large grey void on a fresh save.
//
// Prefer *hiding* a section entirely when it has no data yet. Use EmptyState
// only where the absence itself is meaningful and the player can act on it.

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
  size = 'md',
  className = '',
}) {
  const compact = size === 'sm';
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      {icon && (
        <div
          className={cx(
            'flex items-center justify-center rounded-full bg-surface-sunken text-fg-faint',
            compact ? 'size-10 text-h3' : 'size-14 text-h2',
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className={cx(compact ? 'text-label' : 'text-h3', 'text-fg-secondary')}>{title}</p>
      {body && <p className="max-w-xs text-label text-fg-faint">{body}</p>}
      {action && onAction && (
        <Button size="sm" variant="secondary" onClick={onAction} className="mt-1">
          {action}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
