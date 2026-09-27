// X-Factors (Claude-owned): the league's one-of-a-kind players, the race to
// join them, and the ones who faded.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { activeXFactors, abilityFor, describeAbility, seasonImpact, XF_MAX_ACTIVE, XF_MIN_OVR, FAMILY, LEVELS, QUALIFY } from '../../engine/xFactor';
import { Card, CardHeader, CardBody, Badge, SegmentedControl, TeamCrest, EmptyState, cx } from '../../components/ui';
import { FOShell } from '../../components/frontOffice/FOBits';
import PlayerFace from '../../components/PlayerFace';
import { openPlayerCard } from '../../components/player/cardStore';

const team = id => TEAMS.find(t => t.id === id);

function XFCard({ p, highlight }) {
    const a = abilityFor(p);
    return (
        <button type="button" onClick={() => openPlayerCard(p, p.teamId)} className={cx('xf-frame flex flex-col gap-2 rounded-panel p-3 text-left transition-transform hover:-rotate-1', highlight && 'shadow-2')}>
            <div className="flex items-center gap-3">
                <PlayerFace player={p} teamId={p.teamId} size="md" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-h2 uppercase leading-none">{p.name}</p>
                    <p className="flex items-center gap-1.5 text-label text-fg-muted">{team(p.teamId) && <TeamCrest team={team(p.teamId)} size={18} decorative />}{team(p.teamId)?.abbreviation} · {p.position} · {p.ovr} OVR</p>
                </div>
                <span className="xf-chip grid size-8 place-items-center rounded-full border-2 border-ink" aria-hidden="true">⚡</span>
            </div>
            <p className="xf-text font-display text-h2 uppercase leading-none">{a.name}</p>
            <p className="text-label text-fg-secondary">{describeAbility(a)}</p>
            <div className="flex flex-wrap gap-1.5"><Badge>{LEVELS[a.level]}</Badge><Badge>{a.twist.label}</Badge>{p.xFactor?.since && <Badge>Since {p.xFactor.since}</Badge>}</div>
        </button>
    );
}

export default function XFactors() {
    const s = useGameStore();
    const [filter, setFilter] = useState('all');
    const active = useMemo(() => activeXFactors(s.rosters).sort((a, b) => b.ovr - a.ovr), [s.rosters]);
    const shown = active.filter(p => filter === 'all' || (filter === 'mine' ? p.teamId === s.userTeamId : filter === 'offense' ? ['QB', 'RB', 'WR', 'TE', 'OL'].includes(p.position) : ['DL', 'LB', 'CB', 'S'].includes(p.position)));
    const race = useMemo(() => Object.entries(s.rosters).flatMap(([teamId, r]) => r.map(p => ({ ...p, teamId })))
        .filter(p => !p.xFactor && p.ovr >= XF_MIN_OVR && FAMILY[p.position])
        .map(p => ({ p, pct: Math.min(100, Math.round(seasonImpact(p) / (QUALIFY[p.position] || 60) * 100)) }))
        .sort((a, b) => b.pct - a.pct).slice(0, 10), [s.rosters]);
    const history = s.frontOffice?.xfHistory || [];
    return (
        <FOShell title="X-Factors" eyebrow={`${active.length} of ${XF_MAX_ACTIVE} slots filled · one ability each, no two alike`}>
            <Card>
                <CardBody className="space-y-1 text-label text-fg-secondary">
                    <p>X-Factors earn their tier with an elite rating and a standout season. In a game, each has to <strong>get in the zone</strong> first; then his ability kicks in, strongest in his moment. Counter events switch him off. Two quiet seasons and it goes dormant.</p>
                </CardBody>
            </Card>
            <SegmentedControl value={filter} onChange={setFilter} items={[{ id: 'all', label: 'League' }, { id: 'mine', label: 'Mine' }, { id: 'offense', label: 'Offense' }, { id: 'defense', label: 'Defense' }]} />
            {shown.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map(p => <XFCard key={p.id} p={p} highlight={p.teamId === s.userTeamId} />)}</div> : <EmptyState icon="⚡" title="None here yet" body="Build a star, and give him a season to remember." />}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader eyebrow="The race" title="Knocking on the door" />
                    <CardBody className="space-y-2">
                        {race.map(({ p, pct }) => (
                            <button key={p.id} type="button" onClick={() => openPlayerCard(p, p.teamId)} className="flex w-full items-center gap-3 text-left">
                                <span className="w-40 shrink-0 truncate text-label font-semibold">{p.name} <span className="font-normal text-fg-muted">{team(p.teamId)?.abbreviation} {p.position}</span></span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken"><div className="xf-chip h-full" style={{ width: `${pct}%` }} /></div>
                                <span className="w-10 text-right text-label tabular-nums">{pct}%</span>
                            </button>
                        ))}
                        {!race.length && <p className="text-label text-fg-muted">Nobody is on pace this season.</p>}
                        <p className="text-micro text-fg-faint">Progress toward a qualifying season. At most four new X-Factors awaken each year.</p>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader eyebrow="History" title="Awakenings & fades" />
                    <CardBody className="space-y-1">
                        {history.length ? history.slice(0, 16).map((h, i) => <p key={i} className="text-label">{h.event === 'awakened' ? '⚡' : '💤'} <strong>{h.year}</strong> · {h.name} ({team(h.teamId)?.abbreviation}) {h.event === 'awakened' ? 'awakened' : 'went dormant'}</p>) : <p className="text-label text-fg-muted">The first awakenings come at season's end.</p>}
                    </CardBody>
                </Card>
            </div>
        </FOShell>
    );
}
