// Draft Weekend (Claude-owned): the war room.
//
// Three nights (R1 · R2-3 · R4-7). Your Big Board is live in the middle; the
// ticker on the left calls reaches, steals and runs as they happen; the
// on-the-clock panel on the right shows who's picking, their GM, and the
// phones (trade up / trade down). Your pick gets a Draft Card ceremony.
// After the last pick: the undrafted scramble and a media grade, then camp.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { projectClass } from '../../engine/projection';
import { userView, scoutOpinions, roundLabel, projectedRound, medicalOf } from '../../engine/scouting';
import { gmFor } from '../../engine/people';
import { calculatePositionNeeds } from '../../engine/draft';
import { pickKey } from '../../engine/draftExperience';
import { pickAssetValue } from '../../engine/assetValue';
import { evaluateProposal, whatWouldItTake, valueCtx, pickLabel, rumorFor } from '../../engine/tradeTalks';
import { hasXFPotential } from '../../engine/xFactor';
import { eventText, storyLabel } from '../../engine/collegeSeason';
import { seededRng } from '../../engine/seededRandom';
import { Button, Badge, TeamCrest, PositionTag, SegmentedControl, EmptyState, cx, useToast } from '../../components/ui';
import { RangeBar } from '../../components/player/PlayerBits';
import PlayerFace from '../../components/PlayerFace';

const team = id => TEAMS.find(t => t.id === id);
const nightOf = round => (round <= 1 ? 1 : round <= 3 ? 2 : 3);
const NIGHT_LABEL = { 1: 'Night one · Round 1', 2: 'Night two · Rounds 2–3', 3: 'Night three · Rounds 4–7' };
const CLOCK = 90;
const field = 'h-9 rounded-card border-2 border-line bg-surface-raised px-3 text-label text-fg';

const ANALYSTS = [
    { name: 'Walt Kessler', lean: 'traits', up: ['Love the upside here.', 'Rare athlete. Bet on the traits.', 'Coaching will unlock this.'], down: ['A projection pick. Risky.', 'All tools, no toolbox yet.', 'They fell for the workout.'] },
    { name: 'Dana Okoro', lean: 'tape', up: ['The tape doesn\'t lie. Great value.', 'Plug-and-play starter.', 'Exactly what they needed.'], down: ['I had him two rounds later.', 'Reach. The board said wait.', 'Need over value, and it shows.'] },
];

/** One-line analyst reaction to a pick, from the league consensus. */
function reaction(pick, cons) {
    const c = cons.get(pick.player.id);
    const delta = c ? pick.pickNumber - c.rank : 0; // positive = steal (went later than projected)
    const r = seededRng(`react:${pick.player.id}:${pick.pickNumber}`);
    const a = ANALYSTS[Math.floor(r() * ANALYSTS.length)];
    const lines = delta >= -3 ? a.up : a.down;
    return { analyst: a.name, text: lines[Math.floor(r() * lines.length)], delta, kind: delta >= 15 ? 'steal' : delta <= -15 ? 'reach' : null };
}

function Clock({ onExpire }) {
    const [left, setLeft] = useState(CLOCK);
    const fired = useRef(false);
    useEffect(() => {
        const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        if (left === 0 && !fired.current) { fired.current = true; onExpire(); }
    }, [left, onExpire]);
    const urgent = left <= 15;
    return (
        <div className={cx('rounded-card border-2 border-ink px-3 py-1 text-center font-display text-h1 tabular-nums', urgent ? 'bg-negative-solid text-n-0 animate-wobble' : 'bg-surface-raised text-fg')} role="timer" aria-live="off">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </div>
    );
}

function DraftCard({ pick, onDone }) {
    const s = useGameStore();
    const p = pick.player;
    const t = team(pick.teamId);
    const snap = (s.rosters[s.userTeamId] || []).find(x => x.id === p.id)?.scoutedAs;
    const ops = scoutOpinions(p, s.scouting, s.userTeamId);
    const best = [...ops].sort((a, b) => b.grade - a.grade)[0];
    useEffect(() => { const x = setTimeout(onDone, 6500); return () => clearTimeout(x); }, [onDone]);
    return (
        <div className="toon-backdrop fixed inset-0 z-[120] grid place-items-center p-4" onClick={onDone} role="dialog" aria-label={`You drafted ${p.name}`}>
            <div className="paper-scope w-full max-w-md -rotate-1 overflow-hidden rounded-panel bg-surface-raised shadow-3 animate-bounce-in">
                <div className="toon-banner banner-scope flex items-center gap-3 border-b-[3px] border-ink px-5 py-3">
                    {t && <TeamCrest team={t} size={44} decorative />}
                    <div><p className="text-micro uppercase text-fg-muted">With pick #{pick.pickNumber}, the {t?.name} select</p><p className="font-display text-h1 uppercase leading-none text-banner-title">{p.name}</p></div>
                </div>
                <div className="flex gap-4 p-5">
                    <PlayerFace player={p} teamId={pick.teamId} size={110} variant="portrait" lazy={false} />
                    <div className="min-w-0 flex-1 space-y-2">
                        <p className="flex items-center gap-2"><PositionTag position={p.position} /> <span className="text-label text-fg-muted">{p.college}</span></p>
                        {snap && <><p className="text-micro uppercase text-fg-faint">We graded him</p><RangeBar lo={snap.lo} hi={snap.hi} mark={snap.est} /><p className="text-label">{snap.lo}–{snap.hi} today · ceiling ~{snap.potEst}</p></>}
                        {best && <p className="text-label italic text-fg-secondary">“{best.quote}” — {best.scout.name}</p>}
                        {hasXFPotential(p) && <Badge tone="solid">⚡ X-Factor potential</Badge>}
                    </div>
                </div>
                <p className="border-t-2 border-line px-5 py-2 text-center text-micro uppercase text-fg-faint">Tap to continue</p>
            </div>
        </div>
    );
}

function Ticker({ history, cons, userBoard, userTeamId }) {
    const recent = history.slice(-10).reverse();
    const run = (() => {
        const last = history.slice(-5).map(h => h.player.position);
        const counts = {};
        last.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
        const hot = Object.entries(counts).find(([, n]) => n >= 3);
        return hot ? `Run on ${hot[0]}s: ${hot[1]} of the last 5 picks` : null;
    })();
    return (
        <div className="space-y-2">
            {run && <div className="rounded-card border-2 border-ink bg-warning-bg px-3 py-2 text-label font-bold text-warning-fg">🔥 {run}</div>}
            {!recent.length && <p className="text-label text-fg-muted">The commissioner is at the podium…</p>}
            {recent.map(h => {
                const rx = reaction(h, cons);
                const boardRank = userBoard.indexOf(h.player.id);
                const mine = h.teamId === userTeamId;
                return (
                    <div key={h.pickNumber} className={cx('rounded-card border-2 px-3 py-2 animate-fade-up', mine ? 'border-ink bg-team-16' : 'border-line bg-surface-raised')}>
                        <div className="flex items-center gap-2">
                            <span className="w-8 text-micro tabular-nums text-fg-faint">#{h.pickNumber}</span>
                            {team(h.teamId) && <TeamCrest team={team(h.teamId)} size={22} decorative />}
                            <PositionTag position={h.player.position} />
                            <span className="min-w-0 flex-1 truncate text-label font-semibold">{h.player.name}</span>
                            {rx.kind === 'steal' && <Badge tone="positive">Steal</Badge>}
                            {rx.kind === 'reach' && <Badge tone="negative">Reach</Badge>}
                        </div>
                        <p className="mt-0.5 text-micro text-fg-muted">{rx.analyst}: “{rx.text}”{boardRank >= 0 && !mine ? ` · #${boardRank + 1} on your board 😤` : ''}{hasXFPotential(h.player) ? ' · ⚡ X-Factor potential' : ''}</p>
                    </div>
                );
            })}
        </div>
    );
}

function TradePanel({ s, currentPick, isUserPick }) {
    const { success, error } = useToast();
    const ctx = valueCtx(s);
    const upcoming = s.draftOrder.slice(s.currentPickIndex, s.currentPickIndex + 12);
    // Trade down: clubs a few picks later call when you're on the clock.
    const downOffers = (() => {
        if (!isUserPick || !currentPick) return [];
        const mine = pickAssetValue(currentPick, ctx);
        const later = upcoming.slice(1).filter(p => p.teamId !== s.userTeamId);
        const seen = new Set();
        const offers = [];
        for (const p of later) {
            if (seen.has(p.teamId) || offers.length >= 3) continue;
            seen.add(p.teamId);
            const theirs = (s.draftPickOwners?.[p.teamId] || []).filter(x => pickKey(x) !== pickKey(p)).sort((a, b) => pickAssetValue(b, ctx) - pickAssetValue(a, ctx));
            const sweetener = theirs.find(x => pickAssetValue(p, ctx) + pickAssetValue(x, ctx) >= mine * 1.02 && pickAssetValue(p, ctx) + pickAssetValue(x, ctx) <= mine * 1.5);
            if (!sweetener) continue;
            if (seededRng(`call:${pickKey(currentPick)}:${p.teamId}`)() < 0.35) continue;
            offers.push({ partner: p.teamId, give: { players: [], picks: [currentPick] }, get: { players: [], picks: [p, sweetener] } });
        }
        return offers;
    })();
    const [target, setTarget] = useState('');
    const targetPick = upcoming.find(p => pickKey(p) === target);
    const upAsk = targetPick ? whatWouldItTake(s, targetPick.teamId, [], [targetPick]) : null;
    const accept = proposal => {
        const r = s.foProposeTrade(proposal);
        if (r.ok) { success({ title: 'Trade done', body: `${proposal.get.picks.map(pickLabel).join(' + ')} are yours.` }); setTarget(''); }
        else error({ title: 'They backed out', body: r.evaluation?.problems?.[0] || 'Their board changed.' });
    };
    return (
        <div className="space-y-3">
            {isUserPick && (
                <div>
                    <p className="mb-1 text-micro uppercase text-fg-faint">📞 Calls for your pick</p>
                    {downOffers.length ? downOffers.map((o, i) => (
                        <div key={i} className="mb-1.5 flex items-center gap-2 rounded-card bg-surface-sunken px-2.5 py-2">
                            <TeamCrest team={team(o.partner)} size={24} decorative />
                            <span className="min-w-0 flex-1 text-label">{team(o.partner)?.abbreviation}: {o.get.picks.map(pickLabel).join(' + ')}</span>
                            <Button size="sm" onClick={() => accept(o)} disabled={!evaluateProposal(s, o).ok}>Trade down</Button>
                        </div>
                    )) : <p className="text-label text-fg-muted">The phones are quiet.</p>}
                </div>
            )}
            <div>
                <p className="mb-1 text-micro uppercase text-fg-faint">Trade up</p>
                <select className={cx(field, 'w-full')} value={target} onChange={e => setTarget(e.target.value)} aria-label="Pick to trade up to">
                    <option value="">Choose a pick…</option>
                    {upcoming.filter(p => p.teamId !== s.userTeamId).map(p => <option key={pickKey(p)} value={pickKey(p)}>#{p.pickNumber} · {team(p.teamId)?.abbreviation}</option>)}
                </select>
                {targetPick && (upAsk ? (
                    <div className="mt-2 rounded-card bg-surface-sunken px-2.5 py-2 text-label">
                        <p>{team(targetPick.teamId)?.abbreviation} want: <strong>{[...upAsk.give.picks.map(pickLabel), ...upAsk.give.players.map(id => (s.rosters[s.userTeamId] || []).find(p => p.id === id)?.name)].join(' + ')}</strong></p>
                        <Button className="mt-1.5" size="sm" variant="primary" onClick={() => accept(upAsk)}>Move up to #{targetPick.pickNumber}</Button>
                    </div>
                ) : <p className="mt-2 text-label text-fg-muted">You don't have enough to get there.</p>)}
            </div>
        </div>
    );
}

function Board({ s, cons, onSelect, selected, isUserPick }) {
    const [pos, setPos] = useState('ALL');
    const [mode, setMode] = useState('board');
    const needs = useMemo(() => calculatePositionNeeds(s.rosters[s.userTeamId] || []), [s.rosters, s.userTeamId]);
    const board = useMemo(() => s.scouting?.board?.order || [], [s.scouting]);
    const tiers = s.scouting?.board?.tiers || {};
    const rows = useMemo(() => {
        const list = (s.draftClass || []).filter(p => pos === 'ALL' || p.position === pos).map(p => ({ p, v: userView(p, s.scouting, s.userTeamId), rank: board.indexOf(p.id), c: cons.get(p.id) }));
        if (mode === 'board') return list.sort((a, b) => (a.rank >= 0 ? a.rank : 999) - (b.rank >= 0 ? b.rank : 999) || b.v.grade - a.v.grade);
        return list.sort((a, b) => (b.v.grade + (needs[b.p.position] || 50) / 5) - (a.v.grade + (needs[a.p.position] || 50) / 5));
    }, [s.draftClass, s.scouting, s.userTeamId, board, cons, pos, mode, needs]);
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <SegmentedControl size="sm" value={mode} onChange={setMode} items={[{ id: 'board', label: 'My board' }, { id: 'need', label: 'Best by need' }]} />
                <select className={field} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position">{['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].map(x => <option key={x}>{x}</option>)}</select>
            </div>
            <div className="max-h-[62vh] space-y-1 overflow-y-auto pr-1">
                {rows.slice(0, 80).map(({ p, v, rank, c }) => (
                    <button key={p.id} type="button" onClick={() => onSelect(p)} className={cx('grid w-full grid-cols-[28px_auto_minmax(0,1fr)_120px_44px] items-center gap-2 rounded-card border-2 px-2 py-1.5 text-left', selected?.id === p.id ? 'border-ink bg-team-16' : 'border-transparent hover:bg-surface-hover', tiers[p.id] === 'dnd' && 'opacity-50')}>
                        <span className="text-micro tabular-nums text-fg-faint">{rank >= 0 ? `★${rank + 1}` : ''}</span>
                        <PositionTag position={p.position} />
                        <span className="min-w-0"><span className="block truncate text-label font-semibold">{p.name}</span><span className="block truncate text-micro text-fg-faint">{p.college} · proj. #{c?.lo}–{c?.hi}</span></span>
                        <RangeBar lo={v.lo} hi={v.hi} mark={v.ovr} />
                        <span className="text-right font-bold tabular-nums">{v.grade}</span>
                    </button>
                ))}
                {!rows.length && <EmptyState size="sm" icon="🫥" title="Nobody left" body="Clear the position filter." />}
            </div>
            {isUserPick && <p className="text-micro text-fg-faint">When the clock hits zero, your top available board player is the pick.</p>}
        </div>
    );
}

function ProspectPanel({ p, s, isUserPick, onPick }) {
    if (!p) return <p className="text-label text-fg-muted">Select a prospect to see your scouts' notes.</p>;
    const v = userView(p, s.scouting, s.userTeamId);
    const ops = scoutOpinions(p, s.scouting, s.userTeamId);
    const pipe = (s.collegePipeline || []).find(x => x.id === p.id) || (s.collegeAlumni || []).find(x => x.id === p.id);
    const med = s.scouting?.combineYear === s.year ? medicalOf(p) : null;
    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-3">
                <PlayerFace player={p} teamId="FA" size="md" lazy={false} />
                <div className="min-w-0"><p className="truncate font-display text-h2 uppercase leading-none">{p.name}</p><p className="text-label text-fg-muted">{p.position} · {p.college}{storyLabel(pipe || p) ? ` · ${storyLabel(pipe || p)}` : ''}</p></div>
            </div>
            <RangeBar lo={v.lo} hi={v.hi} mark={v.ovr} />
            <p className="text-label">{v.lo}–{v.hi} now · ceiling {v.potLo}–{v.potHi} · {roundLabel(projectedRound(v.grade))}-round grade · {v.k}% known</p>
            <div className="flex flex-wrap gap-1.5">{med && <Badge tone={med.tone}>🩺 {med.label}</Badge>}{hasXFPotential(p) && v.k >= 50 && <Badge tone="solid">⚡ X-Factor potential</Badge>}{s.scouting?.visits?.includes(p.id) && <Badge>Worked him out</Badge>}</div>
            {ops.map(o => <p key={o.scout.id} className="text-label"><strong>{o.scout.name}:</strong> {roundLabel(o.round)} — <em>“{o.quote}”</em></p>)}
            {pipe?.events?.length > 0 && <p className="text-label text-fg-muted">{eventText(pipe, pipe.events.at(-1))}</p>}
            {isUserPick && <Button variant="accent" size="lg" fullWidth onClick={() => onPick(p)}>Draft {p.name.split(' ').slice(-1)[0]}</Button>}
        </div>
    );
}

function Complete({ s, onNavigate, cons }) {
    const { success } = useToast();
    const userPicks = s.draftHistory.filter(h => h.teamId === s.userTeamId);
    const room = Math.max(0, 53 - (s.rosters[s.userTeamId] || []).length);
    const pool = useMemo(() => [...(s.draftClass || [])].map(p => ({ p, v: userView(p, s.scouting, s.userTeamId) })).sort((a, b) => b.v.grade - a.v.grade).slice(0, 40), [s.draftClass, s.scouting, s.userTeamId]);
    const [chosen, setChosen] = useState({});
    const udfa = s.frontOffice?.udfa?.year === s.year ? s.frontOffice.udfa : null;
    // Media grade: did you beat the consensus?
    const value = userPicks.reduce((n, h) => n + (h.pickNumber - (cons.get(h.player.id)?.rank || h.pickNumber)), 0) / Math.max(1, userPicks.length);
    const grade = value >= 12 ? 'A' : value >= 5 ? 'B+' : value >= -2 ? 'B' : value >= -10 ? 'C+' : 'C';
    const ids = Object.keys(chosen).filter(k => chosen[k]);
    return (
        <div className="mx-auto max-w-5xl space-y-5 p-6">
            <div className="toon-banner banner-scope rounded-panel border-[3px] border-ink p-6 text-center">
                <p className="toon-sticker mb-3 inline-block text-h3 uppercase">Draft complete</p>
                <p className="font-display text-[80px] leading-none text-banner-title">{grade}</p>
                <p className="text-label text-fg-secondary">Media grade · {ANALYSTS[1].name}: “{value >= 5 ? 'They let the board come to them.' : value >= -2 ? 'Solid, if unspectacular.' : 'A lot of reaches. We\'ll see.'}” The real grade comes in three seasons.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
                {userPicks.map(h => (
                    <div key={h.pickNumber} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface-raised px-3 py-2">
                        <span className="w-14 shrink-0 font-display text-h2 tabular-nums">#{h.pickNumber}</span>
                        <PositionTag position={h.player.position} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{h.player.name}</span>
                        <span className="text-micro text-fg-muted">proj. #{cons.get(h.player.id)?.rank}</span>
                    </div>
                ))}
            </div>
            <div className="rounded-panel border-2 border-ink bg-surface-raised p-4">
                <h2 className="font-display text-h1 uppercase">Undrafted scramble</h2>
                {udfa ? (
                    <div className="mt-2 space-y-1 text-label">
                        {udfa.signed.map(x => <p key={x.id}>✍️ Signed <strong>{x.name}</strong> ({x.position})</p>)}
                        {udfa.lost.map(x => <p key={x.id} className="text-fg-muted">✗ {x.name} signed with {team(x.to)?.name}</p>)}
                        {!udfa.signed.length && !udfa.lost.length && <p className="text-fg-muted">You stood pat.</p>}
                    </div>
                ) : (
                    <>
                        <p className="mb-2 text-label text-fg-muted">Pick up to {room} (roster room). A signing bonus helps you beat rival offers.</p>
                        <div className="grid max-h-80 gap-1 overflow-y-auto md:grid-cols-2">
                            {pool.map(({ p, v }) => (
                                <label key={p.id} className={cx('flex items-center gap-2 rounded-card px-2 py-1 text-label', chosen[p.id] != null && chosen[p.id] !== false ? 'bg-team-16' : 'hover:bg-surface-hover')}>
                                    <input type="checkbox" checked={chosen[p.id] != null && chosen[p.id] !== false} disabled={!(chosen[p.id] != null && chosen[p.id] !== false) && ids.length >= room} onChange={e => setChosen(c => ({ ...c, [p.id]: e.target.checked ? 0.1 : false }))} />
                                    <PositionTag position={p.position} /><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="tabular-nums text-fg-muted">{v.lo}–{v.hi}</span>
                                    {chosen[p.id] !== false && chosen[p.id] != null && <select className="h-7 rounded-chip border border-line bg-surface-raised text-micro" value={chosen[p.id]} onChange={e => setChosen(c => ({ ...c, [p.id]: Number(e.target.value) }))} aria-label="Bonus">{[0, 0.1, 0.25, 0.5].map(b => <option key={b} value={b}>${b}M bonus</option>)}</select>}
                                </label>
                            ))}
                        </div>
                        <Button className="mt-3" variant="primary" onClick={() => { const bonus = Object.fromEntries(ids.map(id => [id, chosen[id]])); const r = s.foResolveUdfa(ids, bonus); success({ title: `${r?.signed?.length || 0} undrafted signings` }); }}>Make offers</Button>
                    </>
                )}
            </div>
            <Button variant="primary" size="xl" fullWidth onClick={() => { if (!udfa) s.foResolveUdfa([]); s.finalizeDraft(); s.foAfterDraft(); onNavigate('command'); }}>Head to training camp →</Button>
        </div>
    );
}

export default function DraftRoom({ onNavigate }) {
    const s = useGameStore();
    const [entered, setEntered] = useState(false);
    const [selected, setSelected] = useState(null);
    const [ceremony, setCeremony] = useState(null);
    const [simming, setSimming] = useState(false);
    const simRef = useRef(false);
    useEffect(() => () => { simRef.current = false; }, []);
    // League consensus over the whole class, computed once per visit.
    const [cons] = useState(() => {
        const st = useGameStore.getState();
        const full = [...(st.draftHistory || []).map(h => h.player), ...(st.draftClass || [])];
        return projectClass(st, full);
    });
    if (s.phase !== 'draft') return <div className="grid min-h-screen place-items-center p-6"><EmptyState icon="🎙️" title="The draft isn't on" body="Draft weekend comes after free agency." action="Command Center" onAction={() => onNavigate('command')} /></div>;
    const currentPick = s.draftOrder[s.currentPickIndex];
    if (!currentPick) return <Complete s={s} onNavigate={onNavigate} cons={cons} />;
    const isUserPick = currentPick.teamId === s.userTeamId;
    const onClock = team(currentPick.teamId);
    const gm = gmFor(currentPick.teamId, s.frontOffice?.gmEras?.[currentPick.teamId] || 0);
    const night = nightOf(currentPick.round);
    const myPicks = s.draftOrder.slice(s.currentPickIndex).filter(p => p.teamId === s.userTeamId);
    const board = s.scouting?.board?.order || [];

    const pick = p => {
        s.foUserPick(p.id);
        const h = useGameStore.getState().draftHistory.at(-1);
        setSelected(null);
        if (h?.teamId === s.userTeamId) setCeremony(h);
    };
    const simUntil = async (stop) => {
        if (simRef.current) { simRef.current = false; return; }
        simRef.current = true; setSimming(true);
        while (simRef.current) {
            const st = useGameStore.getState();
            const next = st.draftOrder[st.currentPickIndex];
            if (!next || next.teamId === st.userTeamId || stop(next)) break;
            st.simOneCpuPick();
            await new Promise(r => setTimeout(r, next.round === 1 ? 260 : 60));
        }
        simRef.current = false; setSimming(false);
    };
    const autoPick = () => { const id = s.foBestAvailable(); const p = (s.draftClass || []).find(x => x.id === id); if (p) pick(p); };

    if (!entered && s.currentPickIndex === 0) {
        return (
            <div className="toon-banner banner-scope relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
                <div aria-hidden="true" className="toon-rays pointer-events-none absolute left-1/2 top-1/2 size-[160vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_90s_linear_infinite]" />
                <div className="relative z-10">
                    <p className="toon-sticker mb-5 inline-block text-h2 uppercase">Draft weekend · three nights</p>
                    <div className="mb-3 flex justify-center"><TeamCrest team={team(s.userTeamId)} size={110} /></div>
                    <h1 className="toon-title font-display text-[clamp(72px,11vw,150px)] uppercase leading-[0.85] text-banner-title">War room</h1>
                    <p className="mt-3 text-label text-fg-secondary">{myPicks.length} picks · {board.length} players on your board · {s.scouting?.visits?.length || 0} private workouts</p>
                    <p className="mt-1 text-label text-fg-secondary">Your first pick: #{myPicks[0]?.pickNumber ?? '—'}</p>
                    <div className="paper-scope mt-8 flex flex-wrap justify-center gap-3">
                        <Button variant="accent" size="xl" onClick={() => setEntered(true)}>Open the war room →</Button>
                        {board.length < 10 && <Button size="xl" onClick={() => onNavigate('bigBoard')}>Finish my board first</Button>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-surface-base">
            <header className="toon-banner banner-scope sticky top-0 z-20 border-b-[3px] border-ink">
                <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
                    <Button size="sm" onClick={() => onNavigate('command')} aria-label="Leave the war room">←</Button>
                    <div className="min-w-0 flex-1">
                        <p className="text-micro uppercase text-fg-muted">{NIGHT_LABEL[night]}</p>
                        <p className="font-display text-h1 uppercase leading-none text-banner-title">Pick {currentPick.pickNumber} · Round {currentPick.round}{currentPick.comp ? ' (comp)' : ''}</p>
                    </div>
                    <div className="paper-scope flex items-center gap-2 rounded-card bg-surface-raised px-3 py-1.5 shadow-1">
                        {onClock && <TeamCrest team={onClock} size={34} decorative />}
                        <div className="leading-tight"><p className="text-micro uppercase text-fg-faint">On the clock</p><p className="font-bold">{isUserPick ? 'YOU' : onClock?.name}</p></div>
                    </div>
                    {isUserPick ? <div className="paper-scope"><Clock key={currentPick.pickNumber} onExpire={autoPick} /></div> : (
                        <div className="paper-scope flex gap-2">
                            <Button variant="primary" onClick={() => simUntil(() => false)}>{simming ? 'Stop' : 'Sim to my pick'}</Button>
                            <Button onClick={() => simUntil(n => nightOf(n.round) !== night)}>{simming ? '…' : 'Sim the night'}</Button>
                        </div>
                    )}
                    <div className="paper-scope"><Button variant="ghost" onClick={() => s.foSimDraft()}>Auto-draft rest</Button></div>
                </div>
            </header>
            <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
                <section aria-label="Ticker" className="order-3 min-w-0 lg:order-1"><h2 className="mb-2 text-micro uppercase text-fg-faint">The ticker</h2><Ticker history={s.draftHistory} cons={cons} userBoard={board} userTeamId={s.userTeamId} /></section>
                <section aria-label="Your board" className="order-1 min-w-0 rounded-panel border-2 border-ink bg-surface-raised p-3 lg:order-2"><h2 className="mb-2 font-display text-h2 uppercase">Your board</h2><Board s={s} cons={cons} onSelect={setSelected} selected={selected} isUserPick={isUserPick} /></section>
                <aside className="order-2 min-w-0 space-y-4 lg:order-3">
                    <div className="rounded-panel border-2 border-ink bg-surface-raised p-3">
                        {isUserPick ? <ProspectPanel p={selected || (s.draftClass || []).find(x => x.id === s.foBestAvailable())} s={s} isUserPick onPick={pick} /> : (
                            <div className="space-y-1.5">
                                <p className="text-micro uppercase text-fg-faint">GM {gm.name} · {gm.archetype.icon} {gm.archetype.label}</p>
                                <p className="text-label">Needs: {Object.entries(calculatePositionNeeds(s.rosters[currentPick.teamId] || [])).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p).join(', ')}</p>
                                <p className="text-label italic text-fg-muted">“{rumorFor(s, currentPick.teamId, currentPick.pickNumber)}”</p>
                                {selected && <div className="border-t-2 border-line pt-2"><ProspectPanel p={selected} s={s} /></div>}
                            </div>
                        )}
                    </div>
                    <div className="rounded-panel border-2 border-line bg-surface-raised p-3"><TradePanel s={s} currentPick={currentPick} isUserPick={isUserPick} /></div>
                    <div className="rounded-panel border-2 border-line bg-surface-raised p-3">
                        <p className="mb-1 text-micro uppercase text-fg-faint">Your remaining picks</p>
                        <div className="flex flex-wrap gap-1">{myPicks.slice(0, 12).map(p => <Badge key={pickKey(p)} tone={p === currentPick ? 'team' : 'neutral'}>#{p.pickNumber}</Badge>)}{!myPicks.length && <span className="text-label text-fg-muted">None left.</span>}</div>
                    </div>
                </aside>
            </div>
            {ceremony && <DraftCard pick={ceremony} onDone={() => setCeremony(null)} />}
        </div>
    );
}
