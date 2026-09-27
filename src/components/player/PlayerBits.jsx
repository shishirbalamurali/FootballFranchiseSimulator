// Small building blocks for every player surface (Claude-owned).
import { abilityFor, describeAbility, LEVELS, isActiveXF } from '../../engine/xFactor';
import { getRarity, cx, Badge } from '../ui';
import { TONE_VAR, TONE_BADGE } from './playerUi';

/** OVR in a rarity-coloured ring. X-Factors get a ⚡ corner; stars get ★. */
export function OvrRing({ ovr, player, size = 'md', delta = 0, label = 'OVR' }) {
    const r = getRarity(ovr);
    const xf = isActiveXF(player);
    const dev = player?.devTrait;
    const big = size === 'lg';
    return (
        <div className="relative flex shrink-0 flex-col items-center">
            <div
                className={cx('grid place-items-center rounded-full border-[3px] bg-surface-raised font-display leading-none tabular-nums', big ? 'size-20 text-display' : size === 'sm' ? 'size-10 text-h3' : 'size-14 text-h1', xf && 'animate-zone-pulse')}
                style={{ borderColor: xf ? 'var(--xfactor)' : r.color, color: r.color }}
                title={`${r.label} · OVR ${ovr}`}
            >
                {ovr ?? '—'}
            </div>
            {xf ? (
                <span className="xf-chip absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border-2 border-ink text-micro" title="X-Factor">⚡</span>
            ) : dev === 'Superstar' || dev === 'Star' ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-team-accent px-1 text-micro text-team-on-accent" title={`${dev} development`}>{dev === 'Superstar' ? '★★' : '★'}</span>
            ) : null}
            {big && (
                <span className="mt-1 flex items-center gap-1 text-micro uppercase text-fg-faint">
                    {label}
                    {delta !== 0 && <span className={delta > 0 ? 'text-positive-fg' : 'text-negative-fg'}>{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}</span>}
                </span>
            )}
        </div>
    );
}

/** The primary status: icon + label + headline on a toned pill. */
export function StatusPill({ status, compact = false, className }) {
    if (!status) return null;
    if (status.tone === 'xfactor') {
        return <span className={cx('xf-chip inline-flex h-[22px] items-center gap-1 rounded-full border-2 border-ink px-2 text-micro uppercase', className)}>⚡ {compact ? status.label : status.headline}</span>;
    }
    return (
        <Badge tone={TONE_BADGE[status.tone] || 'neutral'} className={className} title={status.headline}>
            <span aria-hidden="true">{status.icon}</span> {compact ? status.label : status.headline}
        </Badge>
    );
}

/** A coloured dot for tables. */
export function StatusDot({ status, className }) {
    if (!status) return null;
    return <span className={cx('inline-block size-2.5 shrink-0 rounded-full border border-ink', className)} style={{ background: TONE_VAR[status.tone] }} title={`${status.label}: ${status.headline}`} aria-label={status.label} role="img" />;
}

/** Knowledge range: a band from lo to hi on a 40-99 scale, with an optional marker. */
export function RangeBar({ lo, hi, mark = null, min = 40, max = 99, className, label }) {
    const pct = v => `${Math.max(0, Math.min(100, (v - min) / (max - min) * 100))}%`;
    return (
        <div className={cx('min-w-0', className)} title={label || `${lo}–${hi}`}>
            <div className="range-track">
                <div className="range-band" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
                {mark != null && <div className="range-mark" style={{ left: pct(mark) }} />}
            </div>
        </div>
    );
}

/** A tiny sparkline of recent values. */
export function Sparkline({ values = [], className }) {
    if (values.length < 2) return <span className="text-label text-fg-faint">—</span>;
    const w = 72, h = 22, max = Math.max(...values, 1), min = Math.min(...values, 0);
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cx('overflow-visible text-team', className)} aria-hidden="true">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

/** The X-Factor ability, readable in one glance. */
export function AbilityPanel({ player, compact = false, rival = false }) {
    const a = abilityFor(player);
    if (!a || !isActiveXF(player)) return null;
    return (
        <section className="xf-frame rounded-panel p-4">
            <div className="flex items-start gap-3">
                <span className="xf-chip grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink text-h2" aria-hidden="true">⚡</span>
                <div className="min-w-0 flex-1">
                    <p className="text-micro uppercase text-fg-faint">X-Factor ability · {LEVELS[a.level]}</p>
                    <h3 className="xf-text font-display text-h1 uppercase leading-none">{a.name}</h3>
                    <p className="mt-2 text-body text-fg">{describeAbility(a)}</p>
                </div>
                <div className="flex shrink-0 gap-1" aria-label={`Level ${a.level} of 3`}>
                    {[1, 2, 3].map(i => <span key={i} className={cx('size-2.5 rounded-full border border-ink', i <= a.level ? 'xf-chip' : 'bg-surface-sunken')} />)}
                </div>
            </div>
            {!compact && (
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                        ['Gets in the zone', a.activation.text],
                        ['Strongest', a.triggerShort + (a.secondTrigger ? ' + more' : '')],
                        ['Switched off', a.counter.text.replace(/^until /, '')],
                        ['Signature', a.twist.label],
                    ].map(([k, v]) => (
                        <div key={k} className="rounded-card bg-surface-sunken px-2.5 py-2">
                            <dt className="text-micro uppercase text-fg-faint">{k}</dt>
                            <dd className="text-label text-fg">{v}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {!compact && <p className="mt-2 text-label text-fg-muted">{a.twist.text}{rival ? ' Scheme for him in weekly prep to slow his start.' : ''}{player.xFactor?.zoneTds ? ` · ${player.xFactor.zoneTds} touchdowns in the zone.` : ''}</p>}
        </section>
    );
}
