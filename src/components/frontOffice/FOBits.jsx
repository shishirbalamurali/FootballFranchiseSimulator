// Shared front-office UI pieces (Claude-owned): page shell, stage stepper,
// cap strip, team identity chip, GM chip.
import { TEAMS } from '../../data/teams';
import { useGameStore } from '../../store/gameStore';
import { stageTimeline } from '../../engine/offseasonCalendar';
import { rosterSalary } from '../../engine/cpuRosterManagement';
import { SCHEMES } from '../../engine/schemes';
import { gmFor } from '../../engine/people';
import { MODES } from '../../engine/assetValue';
import { deadCapNow } from '../../store/frontOfficeSlice';
import { PageHeader, Meter, Badge, TeamCrest, cx } from '../ui';

export function FOShell({ title, eyebrow, actions, tabs, children, wide = false }) {
    const id = useGameStore(s => s.userTeamId);
    return (
        <>
            <PageHeader title={title} eyebrow={eyebrow} team={TEAMS.find(t => t.id === id)} actions={actions} tabs={tabs} />
            <main className={cx('mx-auto space-y-5 p-4 sm:p-6', wide ? 'max-w-[1600px]' : 'max-w-content')}>{children}</main>
        </>
    );
}

export function StageStepper({ onNavigate }) {
    const s = useGameStore();
    const steps = stageTimeline(s);
    if (!['offseason', 'freeAgency', 'draft'].includes(s.phase) && !steps.some(x => x.status === 'current')) return null;
    return (
        <nav aria-label="Offseason calendar" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {steps.map((st, i) => (
                <button key={st.id} type="button" onClick={() => onNavigate?.(st.screen === 'command' ? 'command' : st.screen)}
                    className={cx('flex min-w-[112px] flex-1 items-center gap-2 rounded-card border-2 px-2.5 py-2 text-left transition-colors',
                        st.status === 'current' ? 'border-ink bg-team text-team-on shadow-1' : st.status === 'done' ? 'border-line bg-surface-sunken text-fg-muted' : 'border-dashed border-line bg-surface-raised text-fg-secondary')}
                    aria-current={st.status === 'current' ? 'step' : undefined}>
                    <span className="text-h2 leading-none" aria-hidden="true">{st.status === 'done' ? '✓' : st.icon}</span>
                    <span className="min-w-0">
                        <span className="block text-micro uppercase opacity-80">Step {i + 1}</span>
                        <span className="block truncate text-label font-bold">{st.short}</span>
                    </span>
                </button>
            ))}
        </nav>
    );
}

export function CapStrip({ extraCommitted = 0, className }) {
    const s = useGameStore();
    const roster = s.rosters[s.userTeamId] || [];
    const payroll = rosterSalary(roster);
    const dead = deadCapNow(s);
    const used = payroll + dead + extraCommitted;
    return (
        <div className={cx('flex flex-wrap items-center gap-x-5 gap-y-2', className)}>
            <Meter className="min-w-[220px] flex-1" value={used} max={200} label="Salary cap" caption={`$${used.toFixed(1)}M of $200M`} color={used > 200 ? 'var(--negative-solid)' : 'var(--team-primary)'} />
            <div className="text-label"><span className="text-fg-faint">Room </span><strong className={used > 200 ? 'text-negative-fg' : 'text-fg'}>${(200 - used).toFixed(1)}M</strong></div>
            {dead > 0 && <div className="text-label"><span className="text-fg-faint">Dead money </span><strong className="text-negative-fg">${dead.toFixed(1)}M</strong></div>}
            <div className="text-label"><span className="text-fg-faint">Roster </span><strong>{roster.length}/53</strong></div>
        </div>
    );
}

export function IdentityChips({ teamId, className }) {
    const id = useGameStore(s => s.frontOffice?.identities?.[teamId]);
    if (!id) return null;
    const o = SCHEMES[id.offense], d = SCHEMES[id.defense];
    return (
        <div className={cx('flex flex-wrap gap-1.5', className)}>
            {o && <Badge title={o.blurb}>{o.icon} {o.name}</Badge>}
            {d && <Badge title={d.blurb}>{d.icon} {d.name}</Badge>}
        </div>
    );
}

export function GMChip({ teamId, mode, trust, className }) {
    const eras = useGameStore(s => s.frontOffice?.gmEras);
    const team = TEAMS.find(t => t.id === teamId);
    const gm = gmFor(teamId, eras?.[teamId] || 0);
    const m = mode && MODES[mode];
    return (
        <div className={cx('flex min-w-0 items-center gap-3', className)}>
            {team && <TeamCrest team={team} size="md" decorative />}
            <div className="min-w-0">
                <p className="truncate font-display text-h2 uppercase leading-none">{team ? `${team.location} ${team.name}` : teamId}</p>
                <p className="truncate text-label text-fg-muted">GM {gm.name} · {gm.archetype.icon} {gm.archetype.label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                    {m && <Badge tone={mode === 'contend' ? 'positive' : mode === 'rebuild' ? 'info' : 'neutral'} title={m.blurb}>{m.icon} {m.label}</Badge>}
                    {trust != null && <Badge tone={trust >= 60 ? 'positive' : trust <= 40 ? 'negative' : 'neutral'} title="How much this GM trusts you">🤝 {trust}</Badge>}
                </div>
            </div>
        </div>
    );
}
