import cx from './cx';

// One bar to replace them all: salary cap, morale, coach XP, win probability,
// roster grades, playbook fit, trade value — each of which had its own markup
// and its own colour thresholds.

/**
 * @param {number} value      current value
 * @param {number} [max]      defaults to 100
 * @param {string} [label]    left-hand caption
 * @param {string} [caption]  right-hand caption (usually the raw numbers)
 * @param {string} [color]    CSS color; defaults to the team color
 * @param {number} [marker]   0–max, draws a target/threshold tick
 */
export function Meter({
  value,
  max = 100,
  label,
  caption,
  color = 'var(--team-primary)',
  marker,
  size = 'md',
  className = '',
}) {
  const pct = Math.max(0, Math.min(100, (Number(value) / (max || 1)) * 100));
  const h = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';

  return (
    <div className={cx('min-w-0', className)}>
      {(label || caption) && (
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          {label && <span className="text-micro uppercase text-fg-faint truncate">{label}</span>}
          {caption && <span className="text-micro tabular-nums text-fg-secondary shrink-0">{caption}</span>}
        </div>
      )}
      <div
        className={cx('relative w-full overflow-hidden rounded-full bg-surface-sunken shadow-[0_0_0_2px_var(--ink)]', h)}
        role="meter"
        aria-valuenow={Number(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'progress'}
      >
        <div
          className="toon-stripes h-full border-r-2 border-ink transition-[width] duration-slow ease-out"
          style={{ width: `${pct}%`, backgroundColor: color, borderRightWidth: pct > 0 && pct < 100 ? 2 : 0 }}
        />
        {marker != null && (
          <span
            className="absolute inset-y-0 w-0.5 bg-ink"
            style={{ left: `${Math.max(0, Math.min(100, (marker / (max || 1)) * 100))}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Head-to-head bar — two teams sharing 100%. Used for win probability and
 * trade value, which both previously hand-rolled this.
 */
export function SplitMeter({ leftPct, leftColor, rightColor, className = '', height = 'h-2.5' }) {
  const p = Math.max(0, Math.min(100, leftPct));
  return (
    <div className={cx('flex w-full overflow-hidden rounded-full bg-surface-sunken shadow-[0_0_0_2px_var(--ink)]', height, className)}>
      <div
        className="toon-stripes h-full border-r-2 border-ink transition-[width] duration-slow ease-out"
        style={{ width: `${p}%`, backgroundColor: leftColor }}
      />
      <div className="h-full flex-1" style={{ backgroundColor: rightColor }} />
    </div>
  );
}

export default Meter;
