import cx from './cx';
import { getRarity } from './rarity';

// Replaces `.contrast-tag`, `.badge`, `.pill-badge` and the dozens of inline
// <span className="text-[10px] font-black px-2 py-0.5 rounded..."> spans.

const TONES = {
  neutral:  'bg-surface-overlay text-fg-secondary border-line-subtle',
  positive: 'bg-positive-bg text-positive-fg border-positive-border',
  negative: 'bg-negative-bg text-negative-fg border-negative-border',
  warning:  'bg-warning-bg  text-warning-fg  border-warning-border',
  info:     'bg-info-bg     text-info-fg     border-info-border',
  team:     'bg-team        text-team-on     border-ink',
  solid:    'bg-fg          text-fg-inverse  border-ink',
};

export function Badge({ children, tone = 'neutral', className = '', icon = null, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 h-[22px] px-2 rounded-full border-2',
        'text-micro uppercase whitespace-nowrap',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Position tag — the small square token in front of a player name. */
export function PositionTag({ position, className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center min-w-9 h-[22px] px-1.5 rounded-chip',
        'bg-team text-team-on toon-outline text-micro uppercase tabular-nums',
        className,
      )}
    >
      {position}
    </span>
  );
}

/** Rarity chip — Bronze → Legend, derived from OVR. */
export function RarityChip({ ovr, showOvr = true, className = '' }) {
  const r = getRarity(ovr);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-chip border-2 text-micro uppercase',
        r.id === 'legend' && 'animate-foil',
        className,
      )}
      style={{
        color: r.color,
        borderColor: r.color,
        background: r.wash,
        backgroundSize: r.id === 'legend' ? '200% 200%' : undefined,
      }}
      title={`${r.label}${showOvr ? ` · OVR ${ovr}` : ''}`}
    >
      {showOvr && <b className="tabular-nums text-fg">{ovr}</b>}
      {r.label}
    </span>
  );
}

export default Badge;
