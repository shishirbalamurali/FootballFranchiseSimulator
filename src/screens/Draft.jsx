import DraftTradeDesk from '../components/DraftTradeDesk';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import {
    TeamCrest, Button, Meter, FilterChips, SegmentedControl, PositionTag, cx,
    gradeColor as getGradeColor,
} from '../components/ui';
import { calculatePositionNeeds, getDraftGradeLetter } from '../engine/draft';
import DraftPickPopup from '../components/DraftPickPopup';
import PlayerFace from '../components/PlayerFace';
import { PlayerNameLine, ReputationBadges } from '../components/PlayerIdentity';
import { rosterSalary } from '../engine/cpuRosterManagement';
import { ROSTER_LIMIT } from '../engine/player';
import { SALARY_CAP } from '../engine/faMarket';

// Draft night. Everything is printed in the user's franchise theme — the
// on-the-clock bar is team banner stock, prospects are trading-card rows.

// Map OVR to visible range string (stable per prospect using seed)
function getOvrRange(prospect) {
    // Use prospect id as seed for stable fuzzy range
    const seed = prospect.id.charCodeAt(0) + (prospect.id.charCodeAt(2) || 0);
    const low  = Math.max(40, prospect.ovr - 4 - (seed % 5));
    const high = Math.min(99, prospect.ovr + 3 + ((seed >> 2) % 4));
    return `${low}–${high}`;
}

const ROW_GRID = '28px 28px 1fr 64px 60px 44px 40px';

// --- DRAFT TIMER ---
// The clock only runs while the user is on it; CPU picks are instant. When it
// hits zero the war room takes the best fit on the board. Remount per pick.
const PICK_CLOCK = 90;
const DraftTimer = ({ isUserPick, onExpire }) => {
    const active = useGameStore(s => s.draftTimerActive);
    const toggleDraftTimer = useGameStore(s => s.toggleDraftTimer);
    const [left, setLeft] = useState(PICK_CLOCK);
    const expireRef = useRef(onExpire);
    useEffect(() => { expireRef.current = onExpire; });

    useEffect(() => {
        if (!isUserPick || !active) return undefined;
        const id = setInterval(() => setLeft(v => Math.max(0, v - 1)), 1000);
        return () => clearInterval(id);
    }, [isUserPick, active]);
    useEffect(() => { if (isUserPick && active && left === 0) expireRef.current?.(); }, [left, isUserPick, active]);

    if (!isUserPick) {
        return <span className="rounded-card bg-ink px-2.5 py-0.5 font-display text-h3 uppercase leading-tight text-nav-fg">Picking…</span>;
    }
    const m = Math.floor(left / 60);
    const sec = (left % 60).toString().padStart(2, '0');
    const isCritical = left < 20 && active;
    return (
        <div className="flex items-center gap-2">
            <span className={cx(
                'rounded-card bg-ink px-2.5 py-0.5 font-display text-h1 tabular-nums leading-tight',
                isCritical ? 'animate-pulse text-negative-fg' : 'text-team-accent',
            )}>
                {active ? `${m}:${sec}` : 'No clock'}
            </span>
            <button onClick={() => toggleDraftTimer(!active)}
                title={active ? 'Turn off the pick clock' : 'Turn on the pick clock'}
                className="text-micro uppercase text-fg-muted underline-offset-2 hover:text-fg hover:underline">
                {active ? 'Stop clock' : 'Use clock'}
            </button>
        </div>
    );
};

// --- NEED METER ---
const NeedMeter = ({ needs }) => {
    const sorted = Object.entries(needs).sort(([, a], [, b]) => b - a).slice(0, 6);
    return (
        <div>
            <h3 className="mb-2 font-display text-h3 uppercase text-fg">Team needs</h3>
            <div className="space-y-2">
                {sorted.map(([pos, score]) => (
                    <div key={pos} className="flex items-center gap-2">
                        <span className="w-8 shrink-0 text-right text-micro text-fg-muted">{pos}</span>
                        <Meter
                            className="flex-1"
                            size="sm"
                            value={Math.min(100, score)}
                            color={score > 80 ? 'var(--negative-solid)' : score > 60 ? 'var(--warning-solid)' : 'var(--team-primary)'}
                        />
                        <span className="w-6 shrink-0 text-right text-micro"
                            style={{ color: score > 80 ? 'var(--negative-fg)' : score > 60 ? 'var(--warning-fg)' : 'var(--text-faint)' }}>
                            {score > 80 ? '!!!' : score > 60 ? '!!' : score > 40 ? '!' : ''}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- FULL DRAFT BOARD MODAL ---
const DraftBoardModal = ({ draftOrder, draftHistory, currentPickIndex, userTeamId, onClose }) => {
    const [viewRound, setViewRound] = useState(draftOrder[currentPickIndex]?.round || 1);
    const pickedMap = useMemo(() => {
        const m = {};
        draftHistory.forEach(h => { m[h.pickNumber] = h; });
        return m;
    }, [draftHistory]);

    const roundPicks = draftOrder.filter(p => p.round === viewRound);
    const roundsMade = draftOrder.filter(p => p.round === viewRound && pickedMap[p.pickNumber]).length;

    return (
        <motion.div className="toon-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-panel bg-surface-raised shadow-3"
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.9, y: 20, rotate: -1 }} animate={{ scale: 1, y: 0, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}>

                <div className="toon-banner banner-scope flex items-center justify-between gap-4 border-b-[3px] border-ink px-6 py-4">
                    <h2 className="toon-title-sm font-display text-h1 uppercase text-fg">Full draft board</h2>
                    <div className="paper-scope flex items-center gap-2">
                        <SegmentedControl
                            size="sm"
                            label="Round"
                            value={viewRound}
                            onChange={setViewRound}
                            items={[1, 2, 3, 4, 5, 6, 7].map(r => ({ id: r, label: `R${r}` }))}
                        />
                        <Button variant="secondary" size="sm" className="w-8 px-0" onClick={onClose} aria-label="Close board">✕</Button>
                    </div>
                </div>

                <div className="flex items-center justify-between border-b-2 border-line bg-surface-sunken px-6 py-2">
                    <span className="text-micro uppercase text-fg-muted">Round {viewRound} · {roundPicks.length} picks</span>
                    <span className="text-micro uppercase text-fg-muted">{roundsMade}/{roundPicks.length} made</span>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {roundPicks.map(pick => {
                            const team = TEAMS.find(t => t.id === pick.teamId) || {};
                            const made = pickedMap[pick.pickNumber];
                            const isCurrent = pick.pickNumber === draftOrder[currentPickIndex]?.pickNumber;
                            const isUser = pick.teamId === userTeamId;
                            const isPast = pick.pickNumber < draftOrder[currentPickIndex]?.pickNumber;

                            return (
                                <div key={pick.pickNumber}
                                    className={cx(
                                        'relative flex flex-col gap-1 rounded-card p-2.5',
                                        isCurrent ? 'bg-team-16 shadow-2 -rotate-1'
                                            : isUser && !made ? 'bg-warning-bg shadow-1'
                                            : 'bg-surface-raised toon-outline',
                                        isPast && !made && 'opacity-40',
                                    )}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-micro tabular-nums text-fg-faint">#{pick.pickNumber}</span>
                                        {isCurrent && <span className="animate-pulse rounded-full bg-team px-1.5 text-micro uppercase text-team-on">Live</span>}
                                        {isUser && !made && !isCurrent && <span className="rounded-full bg-team-accent px-1.5 text-micro uppercase text-team-on-accent">You</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <TeamCrest team={team} size="xs" decorative />
                                        <span className="truncate font-display text-h3 uppercase text-fg">{team.abbreviation || '???'}</span>
                                    </div>
                                    {made ? (
                                        <div>
                                            <p className="truncate text-label font-bold text-fg">{made.player.name}</p>
                                            <p className="text-micro text-fg-muted">{made.player.position} · {made.player.ovr} OVR</p>
                                        </div>
                                    ) : isCurrent ? (
                                        <p className="py-1 text-center font-display text-h3 uppercase text-team-ink">On the clock</p>
                                    ) : (
                                        <p className="text-label italic text-fg-faint">Pending</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// --- PICK ORDER STRIP ---
const PickOrderStrip = ({ draftOrder, currentPickIndex, draftHistory, userTeamId }) => {
    const stripRef = useRef(null);
    const pickedMap = useMemo(() => {
        const m = {};
        draftHistory.forEach(h => { m[h.pickNumber] = h; });
        return m;
    }, [draftHistory]);

    const currentPick = draftOrder[currentPickIndex];
    const currentRound = currentPick?.round || 1;
    const roundPicks = draftOrder.filter(p => p.round === currentRound);

    useEffect(() => {
        if (stripRef.current) {
            const activeEl = stripRef.current.querySelector('[data-active="true"]');
            if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [currentPickIndex]);

    return (
        <div className="shrink-0 border-b-2 border-line bg-surface-sunken px-4 py-2.5">
            <div ref={stripRef} className="no-scrollbar flex gap-2.5 overflow-x-auto px-1 pb-2 pt-1">
                {roundPicks.map(pick => {
                    const team = TEAMS.find(t => t.id === pick.teamId) || {};
                    const made = pickedMap[pick.pickNumber];
                    const isCurrent = pick.pickNumber === currentPick?.pickNumber;
                    const isUser = pick.teamId === userTeamId;
                    const isPast = pick.pickNumber < currentPick?.pickNumber;

                    return (
                        <div key={pick.pickNumber}
                            data-active={isCurrent ? 'true' : 'false'}
                            className={cx(
                                'flex min-w-[62px] shrink-0 flex-col items-center gap-1 rounded-card px-2 py-1.5',
                                isCurrent ? 'bg-team text-team-on shadow-1 -rotate-2'
                                    : isUser && !made && !isPast ? 'bg-team-accent text-team-on-accent toon-outline'
                                    : 'bg-surface-raised text-fg-muted toon-outline',
                                isPast && 'opacity-40',
                            )}>
                            <span className="text-micro tabular-nums">{pick.pickNumber}</span>
                            <TeamCrest team={team} size={22} decorative />
                            <span className="max-w-[56px] truncate text-center text-micro uppercase">
                                {made ? made.player.position : isCurrent ? 'On now' : team.abbreviation}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- PROSPECT ROW ---
function ProspectRow({ prospect, isSelected, isWatched, isScouted, needScore, rank, onClick, onWatchToggle, onScout, scoutingPoints }) {
    const letter = getDraftGradeLetter(prospect.grade || 60);
    const color = getGradeColor(letter);

    return (
        <div onClick={onClick}
            className={cx(
                'relative grid cursor-pointer items-center border-b-2 border-line-subtle px-4 py-2.5 transition-colors',
                isSelected ? 'bg-team-16 shadow-[inset_5px_0_0_var(--team-primary)]'
                    : isWatched ? 'shadow-[inset_5px_0_0_var(--warning-solid)] hover:bg-surface-hover'
                    : 'hover:bg-surface-hover',
            )}
            style={{ gridTemplateColumns: ROW_GRID }}>

            <div className="text-center text-micro tabular-nums text-fg-faint">{rank}</div>

            <button onClick={e => { e.stopPropagation(); onWatchToggle(); }}
                aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                className={cx('text-center text-h3 transition-transform hover:scale-125', isWatched ? 'text-warning-fg' : 'text-fg-faint')}>
                {isWatched ? '★' : '☆'}
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <PlayerFace player={prospect} teamId={null} size="xs" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <PlayerNameLine player={prospect} scouted={isScouted} className="text-label" />
                    {needScore > 70 && (
                        <span className="shrink-0 rounded-full bg-team px-1.5 text-micro uppercase text-team-on">Need</span>
                    )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                    <PositionTag position={prospect.position} />
                    <span className="truncate text-micro text-fg-faint">{prospect.archetype}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
                {isScouted ? (
                    <span className="font-display text-h2 tabular-nums text-fg">{prospect.ovr}</span>
                ) : (
                    <div>
                        <span className="text-label font-bold tabular-nums text-fg-muted">{getOvrRange(prospect)}</span>
                        {scoutingPoints > 0 && (
                            <button onClick={e => { e.stopPropagation(); onScout(); }}
                                className="mt-0.5 block w-full text-right text-micro uppercase text-info-fg hover:underline">
                                Scout
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="text-center text-label tabular-nums text-fg-muted">{prospect.combineSpeed}s</div>

            <div className="text-right font-display text-h2" style={{ color }}>{letter}</div>

            <div className="text-center text-micro">
                {prospect.devTrait === 'Superstar' && <span className="text-rarity-elite">SS</span>}
                {prospect.devTrait === 'Star' && <span className="text-warning-fg">★</span>}
            </div>
        </div>
    );
}

// --- PROSPECT DETAIL PANEL ---
function ProspectDetail({ prospect, isUserPick, isScouted, scoutingPoints, onPick, onScout, onWatchToggle, isWatched }) {
    const letter = getDraftGradeLetter(prospect.grade || 60);
    const color = getGradeColor(letter);
    const projRound = Math.ceil(prospect.draftRank / 32);

    return (
        <div>
            {/* Prospect header — a trading card top */}
            <div className="toon-banner banner-scope relative overflow-hidden border-b-[3px] border-ink p-5">
                <div aria-hidden="true" className="absolute -bottom-4 right-2 select-none font-display text-[96px] leading-none opacity-15">
                    {prospect.position}
                </div>
                <div className="relative">
                    <div className="mb-2 flex items-start justify-between gap-3">
                        <PlayerFace player={prospect} teamId={null} size={84} variant="portrait" lazy={false}
                                    className="paper-scope -rotate-2" />
                        <div className="min-w-0 flex-1">
                            <h2 className="toon-title-sm truncate font-display text-h1 uppercase leading-none text-fg">{prospect.name}</h2>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="rounded-full bg-ink px-2 py-0.5 text-micro text-nav-fg">{prospect.position}</span>
                                <span className="text-label text-fg-secondary">{prospect.archetype}</span>
                                <span className="text-label text-fg-muted">Age {prospect.age}</span>
                            </div>
                            {/* Scouting a prospect reveals his full personality, not just his rating. */}
                            <ReputationBadges player={prospect} scouted={isScouted} className="paper-scope mt-2" />
                        </div>
                        <div className="paper-scope grid size-16 shrink-0 rotate-3 place-items-center rounded-full bg-surface-raised shadow-1">
                            <span className="font-display text-h1 leading-none" style={{ color }}>{letter}</span>
                        </div>
                    </div>

                    <div className="mt-3 flex items-end gap-5">
                        <div>
                            <p className="text-micro uppercase text-fg-muted">{isScouted ? 'Overall' : 'Scout range'}</p>
                            <p className="font-display text-h1 leading-none tabular-nums text-fg">
                                {isScouted ? prospect.ovr : getOvrRange(prospect)}
                            </p>
                        </div>
                        {isScouted && prospect.pot && (
                            <div>
                                <p className="text-micro uppercase text-fg-muted">Ceiling</p>
                                <p className="font-display text-h1 leading-none tabular-nums text-fg">{prospect.pot}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-micro uppercase text-fg-muted">Proj. round</p>
                            <p className="font-display text-h1 leading-none text-fg">{projRound > 7 ? 'UDFA' : `R${projRound}`}</p>
                        </div>
                        <button onClick={onWatchToggle}
                            className={cx('ml-auto text-display leading-none transition-transform hover:scale-110', isWatched ? 'text-team-accent' : 'text-fg-faint')}
                            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                            aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}>
                            {isWatched ? '★' : '☆'}
                        </button>
                    </div>
                    {!isScouted && scoutingPoints > 0 && (
                        <Button variant="accent" size="sm" className="paper-scope mt-3" onClick={onScout}>
                            🔭 Scout ({scoutingPoints} pts left)
                        </Button>
                    )}
                </div>
            </div>

            {prospect.collegeProfile && <div className="college-resume">
                <span className="eyebrow">College résumé · generated prospect</span>
                <h3>{prospect.collegeProfile.school}</h3>
                <p className="text-label text-fg-muted">{prospect.collegeProfile.competition}</p>
                <strong className="mt-3 block text-label text-fg">{prospect.collegeProfile.headline}</strong>
                <p className="mt-1 text-label text-fg-secondary">{prospect.collegeProfile.story}</p>
                <div className="mt-3 overflow-x-auto rounded-card bg-surface-raised toon-outline">
                    <table className="w-full text-label">
                        <thead><tr className="border-b-2 border-ink">{Object.keys(prospect.collegeProfile.seasons[0]).map(k => <th className="p-1.5 text-left text-micro uppercase text-fg-muted" key={k}>{k}</th>)}</tr></thead>
                        <tbody>{prospect.collegeProfile.seasons.map(row => <tr key={row.year} className="border-t border-line-subtle">{Object.values(row).map((v, i) => <td className="p-1.5 tabular-nums text-fg-secondary" key={i}>{v}</td>)}</tr>)}</tbody>
                    </table>
                </div>
                <p className="mt-3 text-micro text-fg-faint">Production is context, not a guarantee of pro ability. Scout to verify the projection.</p>
            </div>}

            {/* Combine */}
            <div className="border-b-2 border-line bg-surface-sunken px-4 py-3">
                <p className="mb-2 font-display text-h3 uppercase text-fg">Pro combine</p>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        ['40 yard', prospect.combineSpeed, 's', v => v <= 4.4 ? 'var(--positive-fg)' : v <= 4.6 ? 'var(--warning-fg)' : 'var(--negative-fg)'],
                        ['Vertical', prospect.combineVert, '"', v => v >= 38 ? 'var(--positive-fg)' : v >= 32 ? 'var(--warning-fg)' : 'var(--negative-fg)'],
                        ['Bench', prospect.combineStrength, 'x', v => v >= 30 ? 'var(--positive-fg)' : v >= 22 ? 'var(--warning-fg)' : 'var(--negative-fg)'],
                    ].map(([label, val, unit, colorFn]) => val ? (
                        <div key={label} className="rounded-card bg-surface-raised p-2 text-center shadow-1">
                            <p className="text-micro uppercase text-fg-faint">{label}</p>
                            <p className="font-display text-h2 tabular-nums" style={{ color: colorFn(parseFloat(val)) }}>{val}{unit}</p>
                        </div>
                    ) : null)}
                </div>
            </div>

            {/* Attribute bars */}
            {isScouted && Object.entries(prospect.attributes?.position || {}).length > 0 && (
                <div className="space-y-2 border-b-2 border-line px-4 py-3">
                    <p className="font-display text-h3 uppercase text-fg">Key attributes</p>
                    {Object.entries(prospect.attributes?.position || {}).slice(0, 4).map(([key, val]) => (
                        <Meter key={key} size="sm" value={val}
                            label={key.replace(/([A-Z])/g, ' $1').trim()} caption={val} />
                    ))}
                </div>
            )}

            {/* Scout report */}
            {prospect.scoutReport && (
                <div className="border-b-2 border-line px-4 py-3">
                    <p className="mb-2 font-display text-h3 uppercase text-fg">Scout report</p>
                    {[['strengths', 'bg-positive-solid'], ['weaknesses', 'bg-negative-solid']].map(([k, dot]) =>
                        prospect.scoutReport[k]?.length > 0 && (
                            <ul key={k} className="mb-2 space-y-1.5">
                                {prospect.scoutReport[k].map(([name, desc]) => (
                                    <li key={name} className="flex items-start gap-2 text-label leading-snug">
                                        <span className={cx('mt-1.5 size-2 shrink-0 rounded-full toon-outline', dot)} />
                                        <span><b className="text-fg">{name}:</b> <span className="text-fg-muted">{desc}</span></span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                    {prospect.scoutReport.background && (
                        <p className="mt-2 rounded-card bg-surface-sunken p-2.5 text-label italic leading-relaxed text-fg-secondary">
                            {prospect.scoutReport.background}
                        </p>
                    )}
                </div>
            )}

            <div className="sticky bottom-0 z-10 border-t-2 border-line bg-surface-raised px-4 py-3">
                <Button variant="primary" size="xl" fullWidth disabled={!isUserPick} onClick={onPick}>
                    {isUserPick ? `Draft ${prospect.name.split(' ').pop()} →` : 'Not your pick'}
                </Button>
            </div>
        </div>
    );
}

// --- POST-DRAFT ROSTER CHECK ---
// Rival clubs are trimmed to legal rosters automatically; the user's club is not.
function RosterCheck({ roster, onReview }) {
    const size = roster.length;
    const payroll = rosterSalary(roster);
    const over = size - ROSTER_LIMIT;
    const capLeft = SALARY_CAP - payroll;
    const ok = over <= 0 && capLeft >= 0;
    return (
        <div className={cx('mb-6 flex items-center gap-6 rounded-panel p-4 shadow-1', ok ? 'bg-surface-raised' : 'bg-negative-bg')}>
            <div>
                <p className="font-display text-h1 leading-none tabular-nums text-fg">{size}/{ROSTER_LIMIT}</p>
                <p className="text-micro uppercase text-fg-faint">Roster</p>
            </div>
            <div>
                <p className={cx('font-display text-h1 leading-none tabular-nums', capLeft < 0 ? 'text-negative-fg' : 'text-fg')}>${Math.round(capLeft)}M</p>
                <p className="text-micro uppercase text-fg-faint">Cap space</p>
            </div>
            <p className="flex-1 text-label text-fg-secondary">
                {ok ? 'Roster and cap are in order for the new season.'
                    : [over > 0 && `${over} player${over === 1 ? '' : 's'} over the ${ROSTER_LIMIT}-man limit`, capLeft < 0 && `$${Math.round(-capLeft)}M over the cap`].filter(Boolean).join(' and ') + '. Release players from the roster screen, then come back here.'}
            </p>
            {!ok && <Button variant="secondary" onClick={onReview}>Review roster</Button>}
        </div>
    );
}

// --- MAIN DRAFT SCREEN ---
export default function Draft({ onNavigate }) {
    const draftClass = useGameStore(s => s.draftClass);
    const draftOrder = useGameStore(s => s.draftOrder);
    const currentPickIndex = useGameStore(s => s.currentPickIndex);
    const onClockTeamId = useGameStore(s => s.onClockTeamId);
    const makePick = useGameStore(s => s.makePick);
    const simToNextUserPick = useGameStore(s => s.simToNextUserPick);
    const simOneCpuPick = useGameStore(s => s.simOneCpuPick);
    const finalizeDraft = useGameStore(s => s.finalizeDraft);
    const draftHistory = useGameStore(s => s.draftHistory);
    const userTeamId = useGameStore(s => s.userTeamId);
    const rosters = useGameStore(s => s.rosters);
    const scoutingPoints = useGameStore(s => s.scoutingPoints);
    const scoutedProspects = useGameStore(s => s.scoutedProspects);
    const draftWatchlist = useGameStore(s => s.draftWatchlist);
    const scoutProspect = useGameStore(s => s.scoutProspect);
    const toggleWatchlist = useGameStore(s => s.toggleWatchlist);

    const [hasEntered, setHasEntered] = useState(false);
    const [selectedProspect, setSelectedProspect] = useState(null);
    const [search, setSearch] = useState('');
    const [posFilter, setPosFilter] = useState('ALL');
    const [sortMode, setSortMode] = useState('grade'); // 'grade' | 'fit' | 'speed' | 'watchlist'
    const [dismissedPick, setDismissedPick] = useState(null);
    const [showBoard, setShowBoard] = useState(false);
    const [simming, setSimming] = useState(false);
    const simRef = useRef(false);
    useEffect(() => () => { simRef.current = false; }, []);
    const [scoutedFlash, setScoutedFlash] = useState(null); // prospect id

    const userTeam = TEAMS.find(t => t.id === userTeamId) || {};
    const theme = userTeam.theme || {};

    // The most recent pick drives both the celebration overlay and the CPU
    // ticker. Both are derived from draftHistory and dismissed by a timer —
    // setting them synchronously inside an effect caused cascading renders.
    const lastPick = draftHistory.length ? draftHistory[draftHistory.length - 1] : null;
    const lastPickNumber = lastPick?.pickNumber ?? null;
    const isUserPickJustMade = lastPick?.teamId === userTeamId;

    useEffect(() => {
        if (lastPickNumber == null) return undefined;
        const delay = isUserPickJustMade ? 2500 : 1800;
        const t = setTimeout(() => setDismissedPick(lastPickNumber), delay);
        return () => clearTimeout(t);
    }, [lastPickNumber, isUserPickJustMade]);

    const pickIsFresh = lastPickNumber != null && lastPickNumber !== dismissedPick;
    const lastPickOverlay = pickIsFresh && isUserPickJustMade ? lastPick : null;
    const cpuPickBanner = pickIsFresh && !isUserPickJustMade ? lastPick : null;

    // Picks fall one at a time so the board visibly moves; Skip jumps ahead.
    const handleSimToMyPick = async () => {
        if (simRef.current) { simRef.current = false; simToNextUserPick(); return; }
        simRef.current = true;
        setSimming(true);
        while (simRef.current) {
            const st = useGameStore.getState();
            const next = st.draftOrder[st.currentPickIndex];
            if (!next || next.teamId === st.userTeamId) break;
            simOneCpuPick();
            await new Promise(r => setTimeout(r, 200));
        }
        simRef.current = false;
        setSimming(false);
    };

    const handleScout = (prospectId) => {
        const ok = scoutProspect(prospectId);
        if (ok) {
            setScoutedFlash(prospectId);
            setTimeout(() => setScoutedFlash(null), 1500);
        }
    };

    const currentPick = draftOrder[currentPickIndex];
    const isDraftComplete = !currentPick;

    const userRoster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
    const teamNeeds = useMemo(() => calculatePositionNeeds(userRoster), [userRoster]);

    const enrichedProspects = useMemo(() => draftClass.map(p => ({
        ...p,
        needScore: teamNeeds[p.position] || 0,
        fitScore: (p.grade || 60) * 0.6 + (teamNeeds[p.position] || 0) * 0.4,
        isWatched: draftWatchlist.includes(p.id),
        isScouted: !!scoutedProspects[p.id],
    })), [draftClass, teamNeeds, draftWatchlist, scoutedProspects]);

    const filteredProspects = useMemo(() => {
        let list = enrichedProspects.filter(p => `${p.name} ${p.college || ''}`.toLowerCase().includes(search.toLowerCase()));
        if (posFilter === 'FITS') list = list.filter(p => p.needScore > 55);
        else if (posFilter === 'WATCHLIST') list = list.filter(p => p.isWatched);
        else if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);

        if (sortMode === 'grade') return [...list].sort((a, b) => (b.grade || 0) - (a.grade || 0));
        if (sortMode === 'fit') return [...list].sort((a, b) => b.fitScore - a.fitScore);
        if (sortMode === 'speed') return [...list].sort((a, b) => parseFloat(a.combineSpeed) - parseFloat(b.combineSpeed));
        if (sortMode === 'potential') return [...list].sort((a, b) => (b.isScouted ? b.pot : b.grade) - (a.isScouted ? a.pot : a.grade));
        return list;
    }, [enrichedProspects, posFilter, sortMode, search]);

    // Draft complete screen
    if (isDraftComplete) {
        const userPicks = draftHistory.filter(h => h.teamId === userTeamId);
        const avgGrade = userPicks.length > 0
            ? userPicks.reduce((sum, h) => sum + (h.player.grade || 60), 0) / userPicks.length
            : 60;
        const classLetter = getDraftGradeLetter(avgGrade);
        const classColor = getGradeColor(classLetter);
        const superstars = userPicks.filter(h => h.player.devTrait === 'Superstar');
        const stars = userPicks.filter(h => h.player.devTrait === 'Star');
        const bestPick = userPicks.reduce((best, h) => (!best || (h.player.grade || 0) > (best.player.grade || 0)) ? h : best, null);
        const classComment = classLetter === 'A+' ? 'Franchise-altering haul. Generational.'
            : classLetter === 'A' ? 'Outstanding class. Future contributors incoming.'
            : classLetter === 'B+' ? 'Strong class with serious upside.'
            : classLetter === 'B' ? 'Solid draft. Multiple starters likely.'
            : classLetter === 'C+' ? 'Decent class. A few diamonds in the rough.'
            : 'Development year. Low immediate expectations.';

        return (
            <div className="flex min-h-screen flex-col">
                <div className="toon-banner banner-scope relative shrink-0 overflow-hidden border-b-[3px] border-ink px-8 py-10 text-center">
                    <div aria-hidden="true" className="toon-rays pointer-events-none absolute left-1/2 top-1/2 size-[1400px] -translate-x-1/2 -translate-y-1/2 animate-[spin_80s_linear_infinite]" />
                    <motion.div initial={{ opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 14 }} className="relative">
                        <p className="toon-sticker mb-4 text-h3 uppercase">Draft complete</p>
                        <div className="paper-scope mx-auto grid size-40 place-items-center rounded-full bg-surface-raised shadow-3">
                            <span className="font-display text-[88px] leading-none" style={{ color: classColor }}>{classLetter}</span>
                        </div>
                        <p className="toon-title mt-4 font-display text-display uppercase text-banner-title">Class grade</p>
                        <p className="mt-1 text-body italic text-fg-secondary">{classComment}</p>
                        <div className="paper-scope mt-6 inline-flex gap-8 rounded-panel bg-surface-raised px-6 py-3 shadow-1">
                            {[
                                [userPicks.length, 'Picks', true],
                                [superstars.length, 'Superstar', superstars.length > 0],
                                [stars.length, 'Star dev', stars.length > 0],
                                [bestPick?.player.ovr, 'Top OVR', !!bestPick],
                            ].filter(([, , show]) => show).map(([v, l]) => (
                                <div key={l} className="text-center">
                                    <p className="font-display text-h1 tabular-nums leading-none text-fg">{v}</p>
                                    <p className="text-micro uppercase text-fg-faint">{l}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-6">
                    <h2 className="mb-4 font-display text-h1 uppercase text-fg">
                        {userTeam.location} {userTeam.name} rookies
                    </h2>
                    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {userPicks.map((pick, i) => {
                            const letter = getDraftGradeLetter(pick.player.grade || 60);
                            const color = getGradeColor(letter);
                            const isBest = bestPick && pick.pickNumber === bestPick.pickNumber;
                            return (
                                <div key={pick.pickNumber}
                                    className={cx(
                                        'flex items-center gap-3 rounded-panel p-3.5 animate-fade-up',
                                        isBest ? 'bg-team-16 shadow-2 -rotate-1' : 'bg-surface-raised shadow-1',
                                    )}
                                    style={{ animationDelay: `${i * 40}ms` }}>
                                    <span className="w-10 shrink-0 text-center font-display text-h1" style={{ color }}>{letter}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-label font-bold text-fg">{pick.player.name}</p>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            <PositionTag position={pick.player.position} />
                                            <span className="text-micro text-fg-faint">Rd {pick.round} · #{pick.pickNumber}</span>
                                            {pick.player.devTrait === 'Superstar' && <span className="text-micro text-rarity-elite">SS</span>}
                                            {pick.player.devTrait === 'Star' && <span className="text-micro text-warning-fg">★</span>}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="font-display text-h1 leading-none tabular-nums text-fg">{pick.player.ovr}</p>
                                        <p className="text-micro text-fg-faint">OVR</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <RosterCheck roster={userRoster} onReview={() => onNavigate('roster')} />
                    <Button variant="primary" size="xl" fullWidth onClick={() => { finalizeDraft(); onNavigate('home'); }}>
                        Head to training camp →
                    </Button>
                </div>
            </div>
        );
    }

    const onClockTeam = TEAMS.find(t => t.id === onClockTeamId) || {};
    const isUserPick = onClockTeamId === userTeamId;
    const currentRound = currentPick?.round || 1;
    const userPicksLeft = draftOrder.slice(currentPickIndex).filter(p => p.teamId === userTeamId).length;
    const autoPick = () => {
        // Specialists only after round four, however empty the depth chart is.
        const eligible = enrichedProspects.filter(p => currentRound >= 5 || !['K', 'P'].includes(p.position));
        const best = [...(eligible.length ? eligible : enrichedProspects)].sort((a, b) => b.fitScore - a.fitScore)[0];
        if (best) { makePick(best.id); setSelectedProspect(null); }
    };
    // Count picks already done in this round to get position within round
    const picksInThisRound = draftOrder.filter(p => p.round === currentRound);
    const pickPositionInRound = picksInThisRound.findIndex(p => p.pickNumber === currentPick?.pickNumber) + 1;

    // Entrance screen
    if (!hasEntered && currentPickIndex === 0) {
        return (
            <div className="toon-banner banner-scope relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
                <div aria-hidden="true" className="toon-rays pointer-events-none absolute left-1/2 top-1/2 size-[160vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_90s_linear_infinite]" />
                <motion.div initial={{ opacity: 0, scale: 0.7, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="relative z-10 px-8 text-center">
                    <p className="toon-sticker mb-6 text-h2 uppercase">Rookie draft · 7 rounds</p>
                    <div className="mb-4 flex justify-center"><div className="-rotate-6"><TeamCrest team={userTeam} size={120} /></div></div>
                    <h1 className="toon-title font-display text-[clamp(88px,12vw,160px)] uppercase leading-[0.85] text-banner-title">
                        War<br />Room
                    </h1>
                    <p className="mt-4 font-display text-h2 uppercase text-fg">{userTeam.location} {userTeam.name}</p>
                    <p className="mb-10 mt-1 text-label text-fg-secondary">
                        {scoutingPoints} scouting points · {draftWatchlist.length} watched prospects
                    </p>
                    <div className="paper-scope flex justify-center gap-4">
                        <Button variant="accent" size="xl" onClick={() => setHasEntered(true)}>Open war room →</Button>
                        <Button variant="secondary" size="xl" onClick={() => { setHasEntered(true); setShowBoard(true); }}>Full board</Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    const posFilters = ['ALL', 'FITS', 'WATCHLIST', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            <AnimatePresence>
                {lastPickOverlay && (
                    <DraftPickPopup player={lastPickOverlay.player} pickNumber={lastPickOverlay.pickNumber}
                        teamId={lastPickOverlay.teamId} teamTheme={theme}
                        positionNeed={teamNeeds[lastPickOverlay.player.position] > 60}
                        onComplete={() => setDismissedPick(lastPickNumber)} />
                )}
            </AnimatePresence>

            {/* CPU pick announcement — a sticker in the picking team's colours */}
            <AnimatePresence>
                {cpuPickBanner && (() => {
                    const cpuTeam = TEAMS.find(t => t.id === cpuPickBanner.teamId) || {};
                    const letter = getDraftGradeLetter(cpuPickBanner.player.grade || 60);
                    return (
                        <motion.div
                            className="fixed left-1/2 top-20 z-40 flex -translate-x-1/2 items-center gap-3 rounded-panel bg-surface-raised py-2 pl-2 pr-4 shadow-2"
                            initial={{ opacity: 0, y: -30, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -1 }} exit={{ opacity: 0, y: -10 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 20 }}>
                            <span className="grid size-11 place-items-center rounded-card toon-outline" style={{ backgroundColor: cpuTeam.theme?.primary }}>
                                <TeamCrest team={cpuTeam} size={34} decorative />
                            </span>
                            <div>
                                <p className="text-micro uppercase text-fg-faint">{cpuTeam.abbreviation} selects</p>
                                <p className="text-label font-bold text-fg">{cpuPickBanner.player.position} {cpuPickBanner.player.name}</p>
                            </div>
                            <span className="font-display text-h1" style={{ color: getGradeColor(letter) }}>{letter}</span>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

            <AnimatePresence>
                {scoutedFlash && (() => {
                    const p = draftClass.find(x => x.id === scoutedFlash);
                    return p ? (
                        <motion.div
                            className="fixed bottom-16 right-6 z-40 flex items-center gap-3 rounded-panel border-l-[10px] border-l-info-solid bg-surface-raised px-4 py-3 shadow-2"
                            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <span className="text-h1" aria-hidden="true">🔭</span>
                            <div>
                                <p className="text-micro uppercase text-info-fg">Scout report complete</p>
                                <p className="text-label font-bold text-fg">{p.name}: {p.ovr} OVR</p>
                            </div>
                        </motion.div>
                    ) : null;
                })()}
            </AnimatePresence>

            <AnimatePresence>
                {showBoard && (
                    <DraftBoardModal draftOrder={draftOrder} draftHistory={draftHistory}
                        currentPickIndex={currentPickIndex} userTeamId={userTeamId}
                        onClose={() => setShowBoard(false)} />
                )}
            </AnimatePresence>

            {/* Top bar — team banner stock */}
            <header className="toon-banner banner-scope flex h-[72px] shrink-0 items-center gap-4 border-b-[3px] border-ink px-4">
                <div className="min-w-[110px]">
                    <p className="text-micro uppercase text-fg-muted">Round {currentRound} of 7</p>
                    <p className="flex items-baseline gap-1">
                        <span className="toon-title-sm font-display text-h1 tabular-nums text-banner-title">#{currentPick.pickNumber}</span>
                        <span className="text-label text-fg-muted">({pickPositionInRound}/{picksInThisRound.length})</span>
                    </p>
                </div>

                <div className="flex flex-1 justify-center">
                    <div className="paper-scope flex items-center gap-4 rounded-panel bg-surface-raised px-4 py-1.5 shadow-1">
                        <TeamCrest team={onClockTeam} size={36} decorative />
                        <div>
                            <p className="text-micro uppercase text-fg-faint">On the clock</p>
                            <p className="font-display text-h3 uppercase leading-tight text-fg">
                                {onClockTeam.location} {onClockTeam.name}
                            </p>
                        </div>
                        <DraftTimer key={currentPick.pickNumber} isUserPick={isUserPick} onExpire={autoPick} />
                    </div>
                </div>

                <div className="paper-scope flex shrink-0 items-center gap-1.5 rounded-panel bg-surface-raised px-3 py-1.5 shadow-1">
                    <span aria-hidden="true">🔭</span>
                    <div>
                        <p className="text-micro uppercase text-fg-faint">Scout pts</p>
                        <p className="font-display text-h3 leading-none tabular-nums text-fg">{scoutingPoints}</p>
                    </div>
                </div>

                <div className="paper-scope flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowBoard(true)}>Full board</Button>
                    {!isUserPick ? (
                        <>
                            <Button variant="secondary" size="sm" onClick={simOneCpuPick} disabled={simming}>+1 pick</Button>
                            <Button variant="accent" size="sm" onClick={handleSimToMyPick}>
                                {simming ? 'Skip ahead ⏭' : userPicksLeft ? 'Sim to my pick ⏩' : 'Sim the rest ⏩'}
                            </Button>
                        </>
                    ) : (
                        <span className="toon-sticker animate-pulse text-h3 uppercase">Your turn →</span>
                    )}
                </div>
            </header>

            <PickOrderStrip draftOrder={draftOrder} currentPickIndex={currentPickIndex}
                draftHistory={draftHistory} userTeamId={userTeamId} />

            <main className="draft-main flex flex-1 overflow-hidden">

                {/* LEFT: prospect pool */}
                <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-r-[3px] border-ink bg-surface-raised">
                    <div className="no-scrollbar flex shrink-0 items-center gap-3 overflow-x-auto border-b-2 border-line px-3 py-2.5">
                        <FilterChips
                            className="flex-nowrap"
                            items={posFilters.map(f => ({
                                id: f,
                                label: f === 'FITS' ? '🎯 Fits' : f === 'WATCHLIST' ? `★ Watch (${draftWatchlist.length})` : f,
                            }))}
                            value={posFilter}
                            onChange={setPosFilter}
                        />
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <span className="text-micro uppercase text-fg-faint">Sort</span>
                            <SegmentedControl
                                size="sm"
                                label="Sort prospects"
                                value={sortMode}
                                onChange={setSortMode}
                                items={[['grade', 'Grade'], ['fit', 'Fit'], ['potential', 'Pot'], ['speed', '40T']].map(([id, label]) => ({ id, label }))}
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 border-b-2 border-line px-3 py-2">
                        <input type="search" aria-label="Search prospects by name or college"
                            className="h-9 flex-1 px-3 text-label outline-none"
                            placeholder="Search player or college…" value={search} onChange={e => setSearch(e.target.value)} />
                        <p className="shrink-0 text-micro text-fg-faint">{filteredProspects.length} available · college stats are fictional</p>
                    </div>

                    <div className="grid shrink-0 border-b-2 border-ink bg-surface-sunken px-4 py-1.5"
                        style={{ gridTemplateColumns: ROW_GRID }}>
                        {[['', '#'], ['', ''], ['', 'Prospect'], ['text-right', 'OVR'], ['text-center', '40 yd'], ['text-right', 'Grd'], ['text-center', 'Dev']].map(([cls, label], i) => (
                            <div key={i} className={cx(cls, 'text-micro uppercase text-fg-muted')}>{label}</div>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredProspects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <p className="text-display" aria-hidden="true">🔍</p>
                                <p className="font-display text-h2 uppercase text-fg-muted">No prospects here</p>
                                <p className="text-label text-fg-faint">Try a different filter</p>
                            </div>
                        ) : filteredProspects.map((p, i) => (
                            <ProspectRow key={p.id} prospect={p} rank={i + 1}
                                isSelected={selectedProspect?.id === p.id}
                                isWatched={p.isWatched}
                                isScouted={p.isScouted}
                                needScore={p.needScore}
                                scoutingPoints={scoutingPoints}
                                onClick={() => setSelectedProspect(p)}
                                onWatchToggle={() => toggleWatchlist(p.id)}
                                onScout={() => handleScout(p.id)}
                            />
                        ))}
                    </div>
                </section>

                {/* RIGHT: detail + needs */}
                <section className="flex w-[340px] shrink-0 flex-col overflow-hidden bg-surface-raised xl:w-[400px]">
                    {selectedProspect ? (
                        <div className="flex-1 overflow-y-auto">
                            <ProspectDetail
                                prospect={selectedProspect}
                                isUserPick={isUserPick}
                                isScouted={!!scoutedProspects[selectedProspect.id]}
                                scoutingPoints={scoutingPoints}
                                onPick={() => { makePick(selectedProspect.id); setSelectedProspect(null); }}
                                onScout={() => handleScout(selectedProspect.id)}
                                onWatchToggle={() => toggleWatchlist(selectedProspect.id)}
                                isWatched={draftWatchlist.includes(selectedProspect.id)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                            <p className="animate-wobble text-[64px]" aria-hidden="true">🏈</p>
                            <div>
                                <p className="font-display text-h1 uppercase text-fg">Select a prospect</p>
                                <p className="mt-1 text-label text-fg-muted">Click any row to see the scouting file</p>
                            </div>
                            {isUserPick && (
                                <span className="toon-sticker animate-pulse text-h3 uppercase">
                                    You're on the clock · pick #{currentPick.pickNumber}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="shrink-0 border-t-2 border-line bg-surface-sunken p-4">
                        <NeedMeter needs={teamNeeds} />
                    </div>
                </section>
            </main>

            <DraftTradeDesk />

            {/* Bottom ticker */}
            <footer className="nav-scope flex h-10 shrink-0 items-center overflow-hidden border-t-[3px] border-ink bg-nav">
                <div className="flex h-full shrink-0 items-center bg-team-accent px-3 font-display text-h3 uppercase text-team-on-accent">
                    Picks
                </div>
                <div className="flex-1 overflow-hidden">
                    {draftHistory.length === 0 ? (
                        <p className="pl-4 text-label italic text-fg-faint">Draft underway…</p>
                    ) : (
                        <motion.div
                            key={draftHistory.length}
                            className="flex items-center gap-8 whitespace-nowrap pl-4"
                            animate={{ x: [0, -(draftHistory.length * 200)] }}
                            transition={{ duration: Math.max(8, draftHistory.length * 3), ease: 'linear', repeat: Infinity, repeatType: 'loop' }}>
                            {[...draftHistory, ...draftHistory].map((pick, i) => (
                                <div key={i} className="flex shrink-0 items-center gap-2">
                                    <span className="text-micro tabular-nums text-fg-faint">#{pick.pickNumber}</span>
                                    <span className="font-display text-h3 text-fg">{TEAMS.find(t => t.id === pick.teamId)?.abbreviation}</span>
                                    <span className="text-label text-fg-secondary">{pick.player.position} {pick.player.name}</span>
                                    <span className="font-display text-h3" style={{ color: getGradeColor(getDraftGradeLetter(pick.player.grade || 60)) }}>
                                        {getDraftGradeLetter(pick.player.grade || 60)}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </footer>
        </div>
    );
}
