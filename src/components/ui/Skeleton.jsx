import cx from './cx';

// There was no loading state anywhere in the app: widgets simply rendered
// empty while a week simulated. These give the sim a sense of work happening.

export function Skeleton({ className = '', rounded = 'rounded-chip' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative block overflow-hidden bg-surface-sunken',
        rounded,
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-surface-hover after:to-transparent',
        className,
      )}
    />
  );
}

/** A few stacked lines — for list and paragraph placeholders. */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Row placeholders matching the DataTable rhythm. */
export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={cx('flex flex-col', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
          <Skeleton className="size-7 shrink-0" rounded="rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
