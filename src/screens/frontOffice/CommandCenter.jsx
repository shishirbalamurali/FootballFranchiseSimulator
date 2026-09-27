// Command Center (Claude-owned): the front office's home. In the offseason it
// runs the calendar one stage at a time; in season it's the weekly desk:
// deadline clock, scouting department, college Saturday, roster alerts.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { currentStage, STAGE_BY_ID } from '../../engine/offseasonCalendar';
import { playerStatus } from '../../engine/playerStatus';
import { teamMode, MODES } from '../../engine/assetValue';
import { valueCtx } from '../../engine/tradeTalks';
import { scoutOf, ASSIGNMENTS } from '../../engine/scouting';
import { biasInfo } from '../../engine/people';
import { pollFor, SCHOOLS } from '../../engine/collegeSeason';
import { abilityFor, activeXFactors } from '../../engine/xFactor';
import { treePrestige } from '../../engine/staffCareers';
import { TRADE_DEADLINE_WEEK } from '../../engine/leagueRules';
import { Card, CardHeader, CardBody, Button, Badge, Stat, EmptyState, TeamCrest, cx, useToast } from '../../components/ui';
import { FOShell, StageStepper, CapStrip, IdentityChips } from '../../components/frontOffice/FOBits';
import { InboxList } from '../../components/frontOffice/Phone';
import PlayerCardCompact from '../../components/player/PlayerCardCompact';

const team = id => TEAMS.find(t => t.id === id);

function CampReveal({ camp, onDone }) {
    const [shown, setShown] = useState(0);
    const reveals = camp.reveals || [];
    const hits = reveals.filter(r => r.hit).length;
    return (
        <Card elevation={2}>
            <CardHeader eyebrow="Camp reveal" title="How right were your scouts?" action={<Badge tone={hits >= reveals.length / 2 ? 'positive' : 'warning'}>{hits}/{reveals.length} within 3</Badge>} />
            <CardBody>
                <p className="mb-3 text-body text-fg-secondary">Camp is where the fog lifts. Here's each rookie's true rating next to the range you drafted him on.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {reveals.map((r, i) => (
                        <div key={r.id} className="rounded-card border-2 border-line bg-surface-raised p-3" style={{ perspective: 600 }}>
                            <p className="truncate font-semibold">{r.name} <span className="text-label text-fg-muted">{r.position}{r.draftPick ? ` · #${r.draftPick}` : ' · UDFA'}</span></p>
                            {i < shown ? (
                                <div className="animate-reveal-flip">
                                    <div className="mt-2 flex items-end justify-between">
                                        <Stat size="sm" value={`${r.lo}–${r.hi}`} label="We graded" />
                                        <Stat size="md" value={r.actual} label="Actual" align="right" />
                                    </div>
                                    <p className={cx('mt-1 text-label font-bold', r.hit ? 'text-positive-fg' : r.diff > 0 ? 'text-info-fg' : 'text-negative-fg')}>{r.label}</p>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setShown(i + 1)} className="mt-2 grid h-[74px] w-full place-items-center rounded-card border-2 border-dashed border-line text-label font-bold text-fg-muted hover:bg-surface-hover">Reveal</button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-2">
                    {shown < reveals.length && <Button onClick={() => setShown(reveals.length)}>Reveal all</Button>}
                    <Button variant="primary" onClick={onDone}>Into the season</Button>
                </div>
            </CardBody>
        </Card>
    );
}

function SeasonReview({ s }) {
    const recap = s.seasonRecap;
    const xf = (s.frontOffice?.xfHistory || []).filter(x => x.year === s.year);
    const coaching = (s.franchiseStories || []).filter(x => x.year === s.year && x.kind === 'Coaching').slice(0, 6);
    const college = s.frontOffice?.collegeHistory?.[0];
    const rec = s.standings?.[s.userTeamId];
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader eyebrow={`${s.year} season`} title="The year that was" />
                <CardBody className="space-y-3">
                    <div className="flex flex-wrap gap-6">
                        {rec && <Stat value={`${rec.wins}-${rec.losses}${rec.ties ? `-${rec.ties}` : ''}`} label="Your record" />}
                        {recap?.winner && <div className="flex items-center gap-2"><TeamCrest team={team(recap.winner)} size="md" decorative /><Stat value={team(recap.winner)?.abbreviation} label="Champion" /></div>}
                    </div>
                    {recap?.awards?.mvp && <p className="text-label">MVP: <strong>{recap.awards.mvp.name}</strong> ({recap.awards.mvp.position})</p>}
                    {college && <p className="text-label">College: <strong>{college.champion || '—'}</strong> won the national title{college.heisman ? `; ${college.heisman.name} (${college.heisman.position}, ${college.heisman.school}) won the Heisman` : ''}.</p>}
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="X-Factors" title="Awakenings" />
                <CardBody className="space-y-2">
                    {xf.length ? xf.map(x => (
                        <p key={`${x.id}-${x.event}`} className="text-label">{x.event === 'awakened' ? '⚡' : '💤'} <strong>{x.name}</strong> ({team(x.teamId)?.abbreviation}) {x.event === 'awakened' ? 'is now an X-Factor' : 'went dormant'}</p>
                    )) : <p className="text-label text-fg-muted">No new X-Factors this year.</p>}
                    {(s.frontOffice?.xfCandidates || []).length > 0 && <p className="text-label text-fg-muted">Knocking on the door: {s.frontOffice.xfCandidates.slice(0, 4).map(c => c.name).join(', ')}.</p>}
                </CardBody>
            </Card>
            <Card className="lg:col-span-2">
                <CardHeader eyebrow="Black Monday" title="The coaching carousel" />
                <CardBody>
                    {coaching.length ? <ul className="grid gap-1.5 sm:grid-cols-2">{coaching.map((c, i) => <li key={i} className="text-label">📋 {c.text}</li>)}</ul> : <p className="text-label text-fg-muted">A quiet carousel.</p>}
                </CardBody>
            </Card>
        </div>
    );
}

function StagePanel({ stage, s, onNavigate }) {
    const combine = useGameStore(st => st.foRunCombine);
    if (stage === 'review') return <SeasonReview s={s} />;
    if (stage === 'camp') return <CampReveal camp={s.frontOffice.camp} onDone={() => s.foSeeCamp()} />;
    const info = STAGE_BY_ID[stage];
    const body = {
        resign: { text: `${s.foExpiring().length} of your players have expiring deals. Re-sign, tag, tender or let them test the market before it opens.`, go: 'contracts', cta: 'Open contracts' },
        combine: { text: 'The class tests this week. Measurables and medicals become public; your 15 interviews reveal personalities.', go: 'bigBoard', cta: 'Open the Big Board', extra: !(s.draftClass || []).length ? <Button onClick={() => combine()}>Run the combine</Button> : null },
        fa: { text: 'Four days on the open market. Host up to three visits on opening day and pitch your club honestly.', go: 'freeAgency', cta: 'Open free agency' },
        prodays: { text: `Private workouts: ${Math.max(0, 10 - (s.scouting?.visits?.length || 0))} left. Lock in your board before draft weekend.`, go: 'bigBoard', cta: 'Finalize the board' },
        draft: { text: 'Three nights, seven rounds. Your board is live in the war room.', go: 'draft', cta: 'Enter the draft room' },
        udfa: { text: 'The picks are in. Sign the best undrafted players before rivals do.', go: 'draft', cta: 'Undrafted scramble' },
    }[stage];
    if (!body) return null;
    return (
        <Card elevation={2}>
            <CardHeader eyebrow="Now" title={`${info?.icon || ''} ${info?.label || stage}`} />
            <CardBody className="space-y-3">
                <p className="text-body text-fg-secondary">{body.text}</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => onNavigate(body.go)}>{body.cta}</Button>
                    {body.extra}
                </div>
            </CardBody>
        </Card>
    );
}

function WeeklyDesk({ s, onNavigate }) {
    const roster = s.rosters[s.userTeamId];
    const alerts = useMemo(() => (roster || []).map(p => ({ p, st: playerStatus(p, { own: true, roster, injuries: s.injuries, week: s.week, year: s.year, phase: s.phase, block: s.frontOffice?.block, tradeRequests: s.frontOffice?.tradeRequests, holdouts: s.frontOffice?.holdouts }) }))
        .filter(x => x.st.primary.rank <= 6).sort((a, b) => a.st.primary.rank - b.st.primary.rank || b.p.ovr - a.p.ovr).slice(0, 6), [roster, s.injuries, s.week, s.year, s.phase, s.frontOffice]);
    const scouts = (s.scouting?.scouts || []).map(scoutOf);
    const poll = s.college ? pollFor(s.college, s.collegePipeline || [], s.year).slice(0, 5) : [];
    const weeksToDeadline = TRADE_DEADLINE_WEEK - s.week + 1;
    const xfs = activeXFactors(s.rosters).filter(p => p.teamId === s.userTeamId);
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader eyebrow="Roster" title="Needs your attention" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('roster')}>Roster</Button>} />
                <CardBody className="space-y-2">
                    {alerts.length ? alerts.map(({ p }) => <PlayerCardCompact key={p.id} player={p} teamId={s.userTeamId} />) : <p className="text-label text-fg-muted">Nothing urgent: everyone's healthy and happy.</p>}
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="Trade market" title={s.phase === 'regular' && weeksToDeadline > 0 ? `Deadline in ${weeksToDeadline} week${weeksToDeadline === 1 ? '' : 's'}` : 'Trade window'} action={<Button size="sm" variant="ghost" onClick={() => onNavigate('trade')}>Trade Machine</Button>} />
                <CardBody className="space-y-2">
                    <p className="text-label">You're <strong>{MODES[teamMode(s.userTeamId, valueCtx(s))].label.toLowerCase()}</strong>. {(s.frontOffice?.block || []).length ? `${s.frontOffice.block.length} player(s) on your block.` : 'Nobody on your block.'}</p>
                    {s.frontOffice?.deadline?.year === s.year && s.frontOffice.deadline.deals.length > 0 && (
                        <div className="rounded-card bg-surface-sunken p-2.5">
                            <p className="mb-1 text-micro uppercase text-fg-faint">Deadline day</p>
                            <ul className="space-y-0.5">{s.frontOffice.deadline.deals.map((d, i) => <li key={i} className="text-label">🔄 {d}</li>)}</ul>
                        </div>
                    )}
                    {(s.tradeHistory || []).slice(0, 3).map(t => <p key={t.id} className="text-label text-fg-secondary">🔄 {t.text}</p>)}
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="Scouting department" title="This week's assignments" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('bigBoard')}>Big Board</Button>} />
                <CardBody className="space-y-1.5">
                    {scouts.map(sc => {
                        const a = s.scouting.assignments?.[sc.id];
                        return <p key={sc.id} className="text-label"><strong>{sc.name}</strong> <span className="text-fg-muted">({sc.role === 'area' ? `${sc.region} area` : sc.role}, {biasInfo(sc.bias).label.toLowerCase()})</span> — {a ? `${ASSIGNMENTS[a.type]?.label}` : 'auto-assigned from your board'}</p>;
                    })}
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="Saturdays" title="College Top 5" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('college')}>Saturdays</Button>} />
                <CardBody className="space-y-1">
                    {poll.length ? poll.map(r => <p key={r.idx} className="text-label"><strong className="tabular-nums">#{r.rank}</strong> {SCHOOLS[r.idx].name} {SCHOOLS[r.idx].mascot} <span className="text-fg-muted">{r.w}-{r.l}</span></p>) : <p className="text-label text-fg-muted">The college season kicks off with week 1.</p>}
                </CardBody>
            </Card>
            {xfs.length > 0 && (
                <Card className="lg:col-span-2">
                    <CardHeader eyebrow="⚡ X-Factors" title="Your difference-makers" />
                    <CardBody className="grid gap-2 sm:grid-cols-2">
                        {xfs.map(p => <PlayerCardCompact key={p.id} player={p} teamId={s.userTeamId} sub={`⚡ ${abilityFor(p).name} · ${abilityFor(p).triggerShort}`} />)}
                    </CardBody>
                </Card>
            )}
        </div>
    );
}

export default function CommandCenter({ onNavigate }) {
    const s = useGameStore();
    const stage = currentStage(s);
    const advance = useGameStore(st => st.foAdvance);
    const { success } = useToast();
    const hcId = (s.coachingStaff || []).find(c => c.teamId === s.userTeamId && c.role === 'HC')?.id;
    const offseason = ['offseason', 'freeAgency', 'draft'].includes(s.phase);
    const doAdvance = () => {
        const next = advance();
        if (next === 'fa' && s.phase === 'offseason') onNavigate('freeAgency');
        else if (next === 'draft' && s.phase !== 'draft') onNavigate('draft');
        else if (next === 'camp' || next === null) success({ title: 'On to the season', body: 'The front office wrapped up the offseason.' });
    };
    const advanceLabel = { review: 'Done reviewing', resign: 'Apply recommendations & continue', combine: 'Run combine & open free agency', fa: 'Finish free agency', prodays: 'Start the draft', draft: 'Auto-draft from my board', udfa: 'Sign UDFAs & start the season', camp: 'Into the season' }[stage];
    return (
        <FOShell title="Command Center" eyebrow={offseason ? `${s.year} offseason · ${STAGE_BY_ID[stage]?.label || ''}` : `${s.year} · Week ${s.week}`}
            actions={stage && stage !== 'camp' ? <Button variant="primary" onClick={doAdvance}>{advanceLabel}</Button> : null}>
            <StageStepper onNavigate={onNavigate} />
            <CapStrip />
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
                <div className="min-w-0 space-y-5">
                    {stage ? <StagePanel stage={stage} s={s} onNavigate={onNavigate} /> : s.phase === 'playoffs' ? (
                        <Card><CardBody><EmptyState icon="🏆" title="Playoff football" body="The front office is quiet until the season ends. Your scouts keep working." action="Go to the playoffs" onAction={() => onNavigate('playoffs')} /></CardBody></Card>
                    ) : <WeeklyDesk s={s} onNavigate={onNavigate} />}
                </div>
                <aside className="space-y-5">
                    <Card>
                        <CardHeader eyebrow="The phone" title="Decisions waiting" />
                        <CardBody><InboxList limit={12} /></CardBody>
                    </Card>
                    <Card>
                        <CardHeader eyebrow="Identity" title="Your program" />
                        <CardBody className="space-y-2">
                            <IdentityChips teamId={s.userTeamId} />
                            <p className="text-label text-fg-muted">Coaching tree prestige <strong className="text-fg">{hcId ? treePrestige(s.coachingStaff, hcId) : 0}</strong> · Scouts {(s.scouting?.scouts || []).length} · Hit rate {Object.values(s.scouting?.hitRates || {}).reduce((n, r) => n + r.hits, 0)}/{Object.values(s.scouting?.hitRates || {}).reduce((n, r) => n + r.hits + r.misses, 0)}</p>
                            <Button size="sm" variant="ghost" onClick={() => onNavigate('staff')}>Staff & tree</Button>
                        </CardBody>
                    </Card>
                </aside>
            </div>
        </FOShell>
    );
}

