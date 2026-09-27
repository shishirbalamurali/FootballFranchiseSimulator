// Trade Machine (Claude-owned): negotiate with GMs who have goals.
// Same offer + same week = same answer; rejections come with a counter.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { evaluateProposal, whatWouldItTake, pickLabel, BANDS, valueCtx, trustOf } from '../../engine/tradeTalks';
import { teamMode, MODES, pickAssetValue } from '../../engine/assetValue';
import { pickKey } from '../../engine/draftExperience';
import { tradeFallout } from '../../engine/character';
import { calculatePositionNeeds } from '../../engine/draft';
import { TRADE_DEADLINE_WEEK } from '../../engine/leagueRules';
import { Card, CardHeader, CardBody, Button, Badge, Tabs, SegmentedControl, TeamCrest, EmptyState, PositionTag, cx, useToast } from '../../components/ui';
import { FOShell, GMChip, CapStrip } from '../../components/frontOffice/FOBits';
import { InboxList } from '../../components/frontOffice/Phone';
import { OvrRing, StatusDot } from '../../components/player/PlayerBits';
import { openPlayerCard } from '../../components/player/cardStore';
import { playerStatus } from '../../engine/playerStatus';

const EMPTY = { players: [], picks: [] };
const field = 'h-9 rounded-card border-2 border-line bg-surface-raised px-3 text-label text-fg';

function ValueBand({ evaluation }) {
    if (!evaluation) return null;
    const pct = Math.max(2, Math.min(98, evaluation.ratio / 1.3 * 100));
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between"><span className="text-micro uppercase text-fg-faint">How they see it</span><Badge tone={evaluation.band.tone}>{evaluation.band.label}</Badge></div>
            <div className="relative flex h-4 overflow-hidden rounded-full shadow-[0_0_0_2px_var(--ink)]">
                {[...BANDS].reverse().map((b, i, arr) => {
                    const from = b.min, to = arr[i + 1]?.min ?? 1.3;
                    return <div key={b.id} className={cx('h-full', { accept: 'bg-positive-bg', close: 'bg-info-bg', work: 'bg-warning-bg', insulting: 'bg-negative-bg' }[b.id])} style={{ width: `${(to - from) / 1.3 * 100}%` }} />;
                })}
                <span className="absolute top-0 h-full w-1 -translate-x-1/2 bg-ink transition-[left] duration-slow" style={{ left: `${pct}%` }} />
            </div>
        </div>
    );
}

function AssetRow({ p, teamId, selected, onToggle, onBlock, s, showStatus }) {
    const st = showStatus ? playerStatus(p, { own: teamId === s.userTeamId, roster: s.rosters[teamId], injuries: s.injuries, block: s.frontOffice?.block, tradeRequests: s.frontOffice?.tradeRequests }) : null;
    return (
        <div className={cx('flex items-center gap-2 rounded-card px-2 py-1', selected ? 'bg-team-16' : 'hover:bg-surface-hover')}>
            <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Include ${p.name}`} />
            <PositionTag position={p.position} />
            <button type="button" onClick={() => openPlayerCard(p, teamId)} className="min-w-0 flex-1 truncate text-left text-label font-semibold hover:underline">{p.name}</button>
            {st && <StatusDot status={st.primary} />}
            <span className="text-micro text-fg-muted">{p.age}y · ${p.contract?.salary ?? 2}M×{p.contract?.yearsLeft ?? 1}</span>
            <OvrRing ovr={p.ovr} player={p} size="sm" />
            {onBlock && <button type="button" onClick={onBlock} className={cx('rounded-chip px-1.5 text-micro', s.frontOffice?.block?.includes(p.id) ? 'bg-warning-bg text-warning-fg' : 'text-fg-faint hover:bg-surface-hover')} title="Trade block">📢</button>}
        </div>
    );
}

function Side({ title, teamId, proposalSide, setSide, s, mine }) {
    const [view, setView] = useState(mine ? 'block' : 'roster');
    const [pos, setPos] = useState('ALL');
    const roster = [...(s.rosters[teamId] || [])].sort((a, b) => b.ovr - a.ovr);
    const picks = [...(s.draftPickOwners?.[teamId] || [])].sort((a, b) => (a.year - b.year) || (a.round - b.round));
    const block = s.frontOffice?.block || [];
    const list = roster.filter(p => (view !== 'block' || block.includes(p.id)) && (pos === 'ALL' || p.position === pos));
    const togglePlayer = id => setSide({ ...proposalSide, players: proposalSide.players.includes(id) ? proposalSide.players.filter(x => x !== id) : [...proposalSide.players, id] });
    const togglePick = pk => setSide({ ...proposalSide, picks: proposalSide.picks.some(x => pickKey(x) === pickKey(pk)) ? proposalSide.picks.filter(x => pickKey(x) !== pickKey(pk)) : [...proposalSide.picks, pk] });
    const ctx = valueCtx(s);
    return (
        <Card className="min-w-0">
            <CardHeader eyebrow={title} title={`${proposalSide.players.length + proposalSide.picks.length} asset${proposalSide.players.length + proposalSide.picks.length === 1 ? '' : 's'}`} action={<SegmentedControl size="sm" value={view} onChange={setView} items={[...(mine ? [{ id: 'block', label: 'Block' }] : []), { id: 'roster', label: 'Roster' }, { id: 'picks', label: 'Picks' }]} />} />
            <CardBody className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                    {proposalSide.players.map(id => { const p = roster.find(x => x.id === id); return p && <Badge key={id} tone="team" className="cursor-pointer" onClick={() => togglePlayer(id)}>{p.position} {p.name} ✕</Badge>; })}
                    {proposalSide.picks.map(pk => <Badge key={pickKey(pk)} tone="team" className="cursor-pointer" onClick={() => togglePick(pk)}>{pickLabel(pk)} ✕</Badge>)}
                </div>
                {view !== 'picks' && <select className={cx(field, 'w-full')} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position filter">{['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'].map(x => <option key={x}>{x}</option>)}</select>}
                <div className="max-h-[360px] space-y-0.5 overflow-y-auto">
                    {view === 'picks' ? picks.map(pk => (
                        <label key={pickKey(pk)} className={cx('flex items-center gap-2 rounded-card px-2 py-1 text-label', proposalSide.picks.some(x => pickKey(x) === pickKey(pk)) ? 'bg-team-16' : 'hover:bg-surface-hover')}>
                            <input type="checkbox" checked={proposalSide.picks.some(x => pickKey(x) === pickKey(pk))} onChange={() => togglePick(pk)} />
                            <span className="flex-1 font-semibold">{pickLabel(pk)}</span>
                            <span className="text-micro text-fg-muted">value {Math.round(pickAssetValue(pk, ctx))}</span>
                        </label>
                    )) : list.map(p => <AssetRow key={p.id} p={p} teamId={teamId} s={s} showStatus={mine} selected={proposalSide.players.includes(p.id)} onToggle={() => togglePlayer(p.id)} onBlock={mine ? () => s.foToggleBlock(p.id) : null} />)}
                    {view === 'block' && !list.length && <p className="px-2 text-label text-fg-muted">Your block is empty. Use 📢 on the roster view to shop a player; teams call during the week.</p>}
                </div>
            </CardBody>
        </Card>
    );
}

export default function TradeMachine() {
    const s = useGameStore();
    const { success } = useToast();
    const [tab, setTab] = useState('build');
    const [partner, setPartner] = useState(null);
    const [give, setGive] = useState(EMPTY);
    const [get, setGet] = useState(EMPTY);
    const [response, setResponse] = useState(null);
    const [modeFilter, setModeFilter] = useState('all');
    const ctx = valueCtx(s);
    const deadlinePassed = s.phase === 'regular' && s.week > TRADE_DEADLINE_WEEK;
    const closed = deadlinePassed || s.phase === 'playoffs';
    const teams = useMemo(() => TEAMS.filter(t => t.id !== s.userTeamId).map(t => ({ t, mode: teamMode(t.id, ctx) })), [s.userTeamId, ctx]);
    const proposal = partner ? { partner, give, get } : null;
    const hasAny = give.players.length + give.picks.length > 0 && get.players.length + get.picks.length > 0;
    const evaluation = proposal && hasAny ? evaluateProposal(s, proposal) : null;
    const outgoing = give.players.map(id => (s.rosters[s.userTeamId] || []).find(p => p.id === id)).filter(Boolean);
    const fallout = tradeFallout(outgoing);
    const needs = partner ? Object.entries(calculatePositionNeeds(s.rosters[partner] || [])).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    const reset = () => { setGive(EMPTY); setGet(EMPTY); setResponse(null); };
    const pickPartner = id => { setPartner(id); reset(); };
    const propose = (p = proposal) => {
        const r = s.foProposeTrade(p);
        if (r.ok) { success({ title: 'Deal done', body: `${TEAMS.find(t => t.id === partner)?.name} accepted.` }); setResponse({ ok: true }); setGive(EMPTY); setGet(EMPTY); }
        else setResponse({ ok: false, reason: r.reason || r.evaluation?.problems?.[0] || (r.evaluation ? `${r.evaluation.band.label}. ${r.evaluation.reasons[0] || ''}` : ''), counter: r.counter });
    };
    const askPrice = () => {
        const pkg = whatWouldItTake(s, partner, get.players, get.picks);
        if (pkg) { setGive(pkg.give); setResponse({ ok: false, reason: 'Here\'s what they\'d take. Propose it as-is and it\'s done.' }); }
        else setResponse({ ok: false, reason: 'Nothing you have gets this done. They value him too much.' });
    };
    const offerCount = (s.frontOffice?.inbox || []).filter(i => i.kind === 'trade').length;
    return (
        <FOShell title="Trade Machine" eyebrow={closed ? 'The trade deadline has passed' : s.phase === 'regular' ? `Deadline after week ${TRADE_DEADLINE_WEEK}` : 'Offseason trade window'} wide>
            <Tabs value={tab} onChange={setTab} label="Trade sections" items={[{ id: 'build', label: 'Build a deal' }, { id: 'offers', label: 'Offers', count: offerCount }]} />
            {tab === 'offers' && <Card><CardBody><InboxList emptyText="No calls yet. Put players on your block to get teams talking." /></CardBody></Card>}
            {tab === 'build' && (closed ? (
                <Card><CardBody><EmptyState icon="🔒" title="Rosters are frozen" body="Trades reopen when the season ends." /></CardBody></Card>
            ) : (
                <>
                    <Card>
                        <CardBody className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-micro uppercase text-fg-faint">Pick a partner</span>
                                <SegmentedControl size="sm" value={modeFilter} onChange={setModeFilter} items={[{ id: 'all', label: 'All' }, { id: 'contend', label: '🏆 Buyers' }, { id: 'rebuild', label: '🌱 Sellers' }]} />
                            </div>
                            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                                {teams.filter(x => modeFilter === 'all' || x.mode === modeFilter).map(({ t, mode }) => (
                                    <button key={t.id} type="button" onClick={() => pickPartner(t.id)} title={`${t.location} ${t.name} · ${MODES[mode].label}`}
                                        className={cx('relative grid size-14 shrink-0 place-items-center rounded-card border-2', partner === t.id ? 'border-ink bg-team-16 shadow-1' : 'border-line bg-surface-raised hover:bg-surface-hover')}>
                                        <TeamCrest team={t} size={36} decorative />
                                        <span className="absolute -bottom-1 -right-1 text-micro" aria-hidden="true">{MODES[mode].icon}</span>
                                    </button>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                    {!partner ? <EmptyState icon="📞" title="Pick a team to call" body="Buyers want proven starters; sellers want picks and young players. Every GM has a style." /> : (
                        <>
                            <Card><CardBody className="flex flex-wrap items-center justify-between gap-3">
                                <GMChip teamId={partner} mode={teamMode(partner, ctx)} trust={trustOf(s, partner)} />
                                <div className="text-label"><span className="text-micro uppercase text-fg-faint">Their needs </span>{needs.map(([p]) => <Badge key={p} className="ml-1">{p}</Badge>)}</div>
                            </CardBody></Card>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Side title="You send" teamId={s.userTeamId} proposalSide={give} setSide={g => { setGive(g); setResponse(null); }} s={s} mine />
                                <Side title="You get" teamId={partner} proposalSide={get} setSide={g => { setGet(g); setResponse(null); }} s={s} />
                            </div>
                            <Card elevation={2}>
                                <CardBody className="space-y-3">
                                    {evaluation ? <ValueBand evaluation={evaluation} /> : <p className="text-label text-fg-muted">Add something to each side to see how they read it.</p>}
                                    {evaluation && (
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="text-label"><p className="text-micro uppercase text-fg-faint">Your cap</p>${evaluation.cap.myBefore}M → <strong className={evaluation.cap.myAfter > 200 ? 'text-negative-fg' : ''}>${evaluation.cap.myAfter}M</strong>{evaluation.cap.dead ? ` · $${evaluation.cap.dead}M dead` : ''} · roster {evaluation.cap.rosterAfter}</div>
                                            <div className="text-label"><p className="text-micro uppercase text-fg-faint">Locker room</p>{fallout.notes.length ? fallout.notes.map(n => <span key={n.text} className="block">{n.delta > 0 ? '+' : ''}{n.delta} · {n.text}</span>) : 'No reaction.'}</div>
                                            <div className="text-label"><p className="text-micro uppercase text-fg-faint">Why</p>{[...evaluation.problems, ...evaluation.reasons].slice(0, 3).map(r => <span key={r} className="block">{r}</span>)}{!evaluation.problems.length && !evaluation.reasons.length && 'Straight value.'}</div>
                                        </div>
                                    )}
                                    {response && !response.ok && (
                                        <div className="rounded-card border-2 border-ink bg-surface-sunken p-3">
                                            <p className="text-label"><strong>☎️ {TEAMS.find(t => t.id === partner)?.abbreviation}:</strong> {response.reason}</p>
                                            {response.counter && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span className="text-label font-semibold">Counter: {response.counter.text}</span>
                                                    <Button size="sm" variant="primary" onClick={() => { setGive(response.counter.proposal.give); setGet(response.counter.proposal.get); propose(response.counter.proposal); }}>Accept counter</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => { setGive(response.counter.proposal.give); setGet(response.counter.proposal.get); setResponse(null); }}>Load it</Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button variant="primary" disabled={!hasAny} onClick={() => propose()}>Propose</Button>
                                        <Button disabled={!get.players.length && !get.picks.length} onClick={askPrice}>What would it take?</Button>
                                        <Button variant="ghost" onClick={reset}>Clear</Button>
                                    </div>
                                </CardBody>
                            </Card>
                            <CapStrip />
                        </>
                    )}
                </>
            ))}
        </FOShell>
    );
}
