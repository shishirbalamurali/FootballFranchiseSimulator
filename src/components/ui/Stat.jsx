import cx from './cx';

// Replaces the dozens of hand-built `<div><div className="text-2xl font-black">
// {v}</div><div className="text-[10px] uppercase">{label}</div></div>` blocks.

const SIZES = {
  sm: { value: 'text-h3',      label: 'text-micro' },
  md: { value: 'text-h1 font-display',      label: 'text-micro' },
  lg: { value: 'text-display font-display', label: 'text-label' },
};

/**
 * @param {string|number} value
 * @param {string} label
 * @param {number} [delta]  signed change; rendered with direction + color
 * @param {'sm'|'md'|'lg'} [size]
 */
export function Stat({
  value,
  label,
  delta,
  size = 'md',
  align = 'left',
  tone,
  className = '',
  ...props
}) {
  const s = SIZES[size] ?? SIZES.md;
  const hasDelta = typeof delta === 'number' && delta !== 0;
  return (
    <div
      className={cx(
        'flex flex-col gap-0.5 min-w-0',
        align === 'center' && 'items-center text-center',
        align === 'right' && 'items-end text-right',
        className,
      )}
      {...props}
    >
      <div className="flex items-baseline gap-1.5">
        <span
          className={cx(s.value, 'tabular-nums leading-none truncate')}
          style={tone ? { color: tone } : undefined}
        >
          {value}
        </span>
        {hasDelta && (
          <span
            className={cx(
              'text-micro tabular-nums',
              delta > 0 ? 'text-positive-fg' : 'text-negative-fg',
            )}
          >
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
      </div>
      <span className={cx(s.label, 'uppercase text-fg-faint truncate')}>{label}</span>
    </div>
  );
}

/** A row of stats sharing one baseline — the OVR/OFF/DEF cluster, etc. */
export function StatRow({ children, className = '' }) {
  return (
    <div className={cx('flex items-end gap-6', className)}>{children}</div>
  );
}

export default Stat;
