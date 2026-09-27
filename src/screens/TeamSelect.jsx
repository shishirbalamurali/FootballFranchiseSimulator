import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemePreview } from '../styles/themePreview';
import { getTeamStyle } from '../styles/teamStyles';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';
import {
    TeamCrest, Button, Card, Meter, PositionTag, RarityChip, FilterChips, cx,
    IconArrowRight,
} from '../components/ui';
import { FranchiseLoreSummary } from '../components/FranchiseLore';

// ── Coaching Styles ──────────────────────────────────────────────────────────
const COACH_STYLES = [
    {
        id: 'offensive',
        name: 'Offensive Mastermind',
        icon: '🎯',
        color: 'var(--info-fg)',
        desc: 'Elite QB development and precision passing',
        bonusLabel: '+4 Passing',
        bonus: { passingBoost: 4 },
    },
    {
        id: 'defensive',
        name: 'Defensive Genius',
        icon: '🛡',
        color: 'var(--positive-fg)',
        desc: 'Smothering coverage wins championships',
        bonusLabel: '+5 Defense',
        bonus: { defenseBoost: 5 },
    },
    {
        id: 'power',
        name: 'Ground & Pound',
        icon: '💪',
        color: 'var(--warning-solid)',
        desc: 'Dominate at the LOS, control the clock',
        bonusLabel: '+5 Rushing',
        bonus: { rushingBoost: 5 },
    },
    {
        id: 'balanced',
        name: 'Balanced Attack',
        icon: '⚖️',
        color: 'var(--rarity-elite)',
        desc: 'No weaknesses — adapts to any opponent',
        bonusLabel: '+2 All Phases',
        bonus: { passingBoost: 2, rushingBoost: 2, defenseBoost: 2 },
    },
    {
        id: 'innovator',
        name: 'West Coast Innovator',
        icon: '⚡',
        color: 'var(--info-fg)',
        desc: 'Modern RPO schemes and gadget plays',
        bonusLabel: '+3 Pass  +2 Rush',
        bonus: { passingBoost: 3, rushingBoost: 2 },
    },
    {
        id: 'motivator',
        name: 'Master Motivator',
        icon: '🔥',
        color: 'var(--negative-fg)',
        desc: 'Unlock the full potential of every player',
        bonusLabel: '+2 Pass  +3 Def',
        bonus: { passingBoost: 2, rushingBoost: 1, defenseBoost: 3 },
    },
];

// ── Difficulties ─────────────────────────────────────────────────────────────
const DIFFICULTIES = [
    {
        id: 'rookie',
        name: 'Rookie',
        stars: '★',
        sub: '+3 rating edge every game',
        color: 'var(--positive-fg)',
        difficultyBonus: 3,
    },
    {
        id: 'pro',
        name: 'Pro',
        stars: '★★',
        sub: 'Fair competition',
        color: 'var(--warning-solid)',
        difficultyBonus: 0,
    },
    {
        id: 'allMadden',
        name: 'Legend',
        stars: '★★★',
        sub: 'CPU gets +3 edge',
        color: 'var(--negative-fg)',
        difficultyBonus: -3,
    },
];

// ── Team Tier from OVR ───────────────────────────────────────────────────────
function getTeamTier(ovr) {
    if (ovr >= 88) return { label: 'Dynasty',       color: 'var(--rarity-elite)', icon: '👑', goalLabel: 'Win the Super Bowl' };
    if (ovr >= 83) return { label: 'Contender',     color: 'var(--positive-fg)', icon: '⭐', goalLabel: 'Make the Playoffs' };
    if (ovr >= 78) return { label: 'Playoff Bubble', color: 'var(--warning-solid)', icon: '🔶', goalLabel: 'Reach .500 or better' };
    if (ovr >= 72) return { label: 'Rebuilding',    color: 'var(--negative-fg)', icon: '🔨', goalLabel: 'Win at least 6 games' };
    return             { label: 'Tanking',          color: 'var(--text-faint)', icon: '📉', goalLabel: 'Develop your young core' };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TeamSelect({ onTeamSelected }) {
    const selectTeam     = useGameStore(state => state.selectTeam);
    const teamRatings    = useGameStore(state => state.teamRatings);
    const rosters        = useGameStore(state => state.rosters);

    const [step, setStep] = useState('coach'); // 'coach' | 'team'

    // Coach fields
    const [coachName, setCoachName]   = useState('');
    const [coachStyle, setCoachStyle] = useState(null);
    const [difficulty, setDifficulty] = useState('pro');
    const [nameError, setNameError]   = useState('');

    // Team fields
    const [selectedId, setSelectedId]   = useState(null);
    const [confFilter, setConfFilter]   = useState('ALL');
    const [tierFilter, setTierFilter]   = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Generate once on mount if no league exists; read state directly so the
    // effect doesn't re-run when ratings arrive.
    useEffect(() => {
        const { teamRatings: tr, generateLeague: gen } = useGameStore.getState();
        if (!tr || Object.keys(tr).length === 0) gen();
    }, []);

    // Dress the whole screen in the highlighted franchise's identity.
    const setPreviewTeamId = useThemePreview(state => state.setPreviewTeamId);
    useEffect(() => {
        setPreviewTeamId(step === 'team' ? selectedId : null);
    }, [selectedId, step, setPreviewTeamId]);
    useEffect(() => () => setPreviewTeamId(null), [setPreviewTeamId]);

    const selectedTeam   = TEAMS.find(t => t.id === selectedId);
    const selectedRating = teamRatings?.[selectedId] || {};
    const topPlayers     = useMemo(() =>
        [...(rosters?.[selectedId] || [])].sort((a, b) => b.ovr - a.ovr).slice(0, 6),
    [rosters, selectedId]);

    const selectedTier = selectedTeam
        ? getTeamTier(Math.round(selectedRating?.overall || 70))
        : null;

    const canProceed = coachName.trim().length >= 2 && coachStyle !== null;

    const filteredTeams = useMemo(() => {
        let list = TEAMS;
        if (confFilter !== 'ALL') list = list.filter(t => t.conference === confFilter);
        if (tierFilter !== 'All') {
            list = list.filter(t => {
                const ovr = Math.round(teamRatings?.[t.id]?.overall || 70);
                return getTeamTier(ovr).label === tierFilter;
            });
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.location.toLowerCase().includes(q) ||
                t.abbreviation.toLowerCase().includes(q)
            );
        }
        return list;
    }, [confFilter, tierFilter, searchQuery, teamRatings]);

    const grouped = useMemo(() => {
        if (confFilter !== 'ALL' || tierFilter !== 'All' || searchQuery.trim()) return null;
        const out = {};
        for (const conf of ['AFC', 'NFC']) {
            out[conf] = {};
            for (const div of ['North', 'South', 'East', 'West']) {
                out[conf][div] = TEAMS.filter(t => t.conference === conf && t.division === div);
            }
        }
        return out;
    }, [confFilter, tierFilter, searchQuery]);

    const handleGoToTeam = () => {
        if (!coachName.trim()) { setNameError('Enter your coach name'); return; }
        if (coachName.trim().length < 2) { setNameError('Name too short'); return; }
        if (!coachStyle) return;
        setNameError('');
        setStep('team');
    };

    const handleConfirm = () => {
        if (!selectedId || !coachStyle) return;
        const style = COACH_STYLES.find(s => s.id === coachStyle);
        const diff  = DIFFICULTIES.find(d => d.id === difficulty);
        const ovr   = Math.round(teamRatings?.[selectedId]?.overall || 70);
        const tier  = getTeamTier(ovr);

        selectTeam(selectedId, {
            name:             coachName.trim() || 'Head Coach',
            style:            coachStyle,
            styleName:        style?.name || '',
            styleIcon:        style?.icon || '',
            bonus:            style?.bonus || {},
            difficulty:       difficulty,
            difficultyBonus:  diff?.difficultyBonus ?? 0,
            seasonGoal:       tier.goalLabel,
        });
        onTeamSelected();
    };

    const styleObj = COACH_STYLES.find(s => s.id === coachStyle);
    const diffObj  = DIFFICULTIES.find(d => d.id === difficulty);
    const TIER_FILTERS = ['All', 'Dynasty', 'Contender', 'Playoff Bubble', 'Rebuilding', 'Tanking'];

    // ── STEP: COACH ──────────────────────────────────────────────────────────
    if (step === 'coach') {
        return (
            <div className="flex h-screen overflow-hidden">
                {/* Left: title card */}
                <aside className="toon-banner banner-scope relative hidden w-96 shrink-0 flex-col justify-between overflow-hidden border-r-[3px] border-ink p-8 lg:flex">
                    <div aria-hidden="true" className="toon-rays pointer-events-none absolute -left-1/2 top-1/3 size-[900px] animate-[spin_90s_linear_infinite]" />
                    <div className="relative">
                        <p className="toon-sticker mb-5 text-h3 uppercase">Step 1 of 2</p>
                        <h2 className="toon-title font-display text-[64px] uppercase leading-[0.95] text-banner-title">
                            Your legacy starts here
                        </h2>
                        <p className="mt-5 max-w-xs text-body text-fg-secondary">
                            Define your coaching identity. Every decision shapes the franchise you build.
                        </p>
                    </div>

                    {/* Running summary of the choices so far */}
                    <div className="paper-scope relative space-y-3">
                        {coachName.trim() && (
                            <div className="rounded-card bg-surface-raised p-3 shadow-1 animate-bounce-in">
                                <p className="text-micro uppercase text-fg-faint">Coach</p>
                                <p className="font-display text-h2 uppercase text-fg">Coach {coachName.trim()}</p>
                            </div>
                        )}
                        {styleObj && (
                            <div className="rounded-card bg-surface-raised p-3 shadow-1 animate-bounce-in">
                                <p className="text-micro uppercase text-fg-faint">Philosophy</p>
                                <p className="flex items-center gap-2 font-display text-h2 uppercase text-fg">
                                    <span aria-hidden="true">{styleObj.icon}</span>{styleObj.name}
                                </p>
                                <span className="mt-1 inline-block rounded-chip px-1.5 text-micro uppercase" style={{ color: styleObj.color }}>
                                    {styleObj.bonusLabel}
                                </span>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Right: form */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
                        <header>
                            <p className="text-micro uppercase text-team-ink lg:hidden">Step 1 of 2</p>
                            <h1 className="font-display text-display uppercase leading-none text-fg">Create your coach</h1>
                        </header>

                        {/* Coach name */}
                        <Card className="p-5 animate-fade-up">
                            <label htmlFor="coach-name" className="text-micro uppercase text-fg-faint">Your name</label>
                            <div className="mt-2 flex items-baseline gap-3 border-b-[3px] border-ink pb-1">
                                <span className="font-display text-h1 uppercase text-fg-faint">Coach</span>
                                <input
                                    id="coach-name"
                                    type="text"
                                    placeholder="Williams"
                                    value={coachName}
                                    onChange={e => { setCoachName(e.target.value); setNameError(''); }}
                                    maxLength={20}
                                    className="min-w-0 flex-1 !border-0 !bg-transparent font-display text-h1 uppercase text-fg outline-none"
                                    autoFocus
                                />
                            </div>
                            {nameError && <p className="mt-2 text-label font-bold text-negative-fg">{nameError}</p>}
                        </Card>

                        {/* Coaching Style */}
                        <section className="animate-fade-up [animation-delay:60ms]">
                            <h2 className="mb-3 font-display text-h2 uppercase text-fg">Coaching philosophy</h2>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                {COACH_STYLES.map(s => {
                                    const active = coachStyle === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setCoachStyle(s.id)}
                                            className={cx(
                                                'toon-lift relative flex flex-col items-start gap-1 rounded-panel p-4 text-left',
                                                active ? 'bg-team text-team-on shadow-2 -rotate-1' : 'bg-surface-raised text-fg shadow-1',
                                            )}
                                        >
                                            {active && (
                                                <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-team-accent text-label font-bold text-team-on-accent shadow-1">✓</span>
                                            )}
                                            <span className="text-h1" aria-hidden="true">{s.icon}</span>
                                            <span className="font-display text-h3 uppercase leading-tight">{s.name}</span>
                                            <span className={cx('text-label leading-snug', active ? 'opacity-85' : 'text-fg-muted')}>{s.desc}</span>
                                            <span className={cx(
                                                'mt-1 rounded-full border-2 px-2 text-micro uppercase',
                                                active ? 'border-current' : 'border-line',
                                            )} style={active ? undefined : { color: s.color }}>
                                                {s.bonusLabel}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Difficulty */}
                        <section className="animate-fade-up [animation-delay:120ms]">
                            <h2 className="mb-3 font-display text-h2 uppercase text-fg">Difficulty</h2>
                            <div className="grid grid-cols-3 gap-4">
                                {DIFFICULTIES.map(d => {
                                    const active = difficulty === d.id;
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setDifficulty(d.id)}
                                            className={cx(
                                                'toon-lift rounded-panel px-4 py-4 text-center',
                                                active ? 'bg-team text-team-on shadow-2 rotate-1' : 'bg-surface-raised text-fg shadow-1',
                                            )}
                                        >
                                            <p className="font-display text-h2 uppercase">{d.name}</p>
                                            <p className="text-h3" style={active ? undefined : { color: d.color }}>{d.stars}</p>
                                            <p className={cx('text-label', active ? 'opacity-85' : 'text-fg-muted')}>{d.sub}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <Button
                            variant="primary"
                            size="xl"
                            fullWidth
                            disabled={!canProceed}
                            onClick={handleGoToTeam}
                            iconRight={canProceed ? <IconArrowRight size={20} /> : null}
                        >
                            {canProceed
                                ? 'Choose your team'
                                : !coachName.trim() ? 'Enter your name to continue'
                                : !coachStyle ? 'Pick a coaching style'
                                : 'Continue'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── STEP: TEAM ───────────────────────────────────────────────────────────
    const TIER_ICONS = { Dynasty: 90, Contender: 85, 'Playoff Bubble': 80, Rebuilding: 74, Tanking: 65 };
    const selectedStyle = selectedTeam ? getTeamStyle(selectedTeam.id) : null;

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Header */}
            <header className="nav-scope shrink-0 bg-nav">
                <div className="flex items-center gap-4 px-5 py-3">
                    <Button variant="ghost" size="sm" onClick={() => setStep('coach')}>← Back</Button>
                    <div className="flex-1 text-center">
                        <p className="text-micro uppercase text-fg-faint">Step 2 of 2</p>
                        <h1 className="font-display text-h1 uppercase leading-none text-team-accent">Choose your franchise</h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full border-2 border-line px-3 py-1">
                        <span aria-hidden="true">{styleObj?.icon}</span>
                        <span className="text-label font-bold">Coach {coachName}</span>
                    </div>
                </div>
            </header>
            <div aria-hidden="true" className="h-2 shrink-0 border-y-[2.5px] border-ink bg-team" />

            {/* Filters */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b-2 border-line bg-surface-sunken px-5 py-2.5">
                <FilterChips
                    items={['ALL', 'AFC', 'NFC'].map(c => ({ id: c, label: c }))}
                    value={confFilter}
                    onChange={setConfFilter}
                />
                <span className="h-5 w-0.5 rounded-full bg-line" aria-hidden="true" />
                <FilterChips
                    items={TIER_FILTERS.map(t => ({
                        id: t,
                        label: t === 'All' ? 'All tiers' : `${getTeamTier(TIER_ICONS[t]).icon} ${t}`,
                    }))}
                    value={tierFilter}
                    onChange={setTierFilter}
                />
                <input
                    type="search"
                    placeholder="Search teams…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="ml-auto h-8 w-44 px-3 text-label outline-none"
                    aria-label="Search teams"
                />
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* Team grid */}
                <div className="flex-1 overflow-y-auto p-5">
                    {filteredTeams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <p className="text-display" aria-hidden="true">🔍</p>
                            <p className="font-display text-h2 uppercase text-fg-muted">No teams found</p>
                        </div>
                    ) : grouped ? (
                        <div className="space-y-8">
                            {['AFC', 'NFC'].map(conf => (
                                <section key={conf}>
                                    <h2 className="toon-sticker mb-4 text-h2 uppercase">{conf}</h2>
                                    <div className="space-y-5">
                                        {['North', 'South', 'East', 'West'].map(div => (
                                            <div key={div}>
                                                <p className="mb-2 px-1 text-micro uppercase text-fg-faint">{conf} {div}</p>
                                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                                                    {grouped[conf][div].map(team => (
                                                        <TeamCard key={team.id} team={team} teamRatings={teamRatings}
                                                            active={selectedId === team.id} onClick={() => setSelectedId(team.id)} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                            {filteredTeams.map(team => (
                                <TeamCard key={team.id} team={team} teamRatings={teamRatings}
                                    active={selectedId === team.id} onClick={() => setSelectedId(team.id)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                <aside className="flex w-[22rem] shrink-0 flex-col overflow-hidden border-l-[3px] border-ink bg-surface-raised">
                    <AnimatePresence mode="wait">
                        {selectedTeam ? (
                            <motion.div key={selectedId}
                                initial={{ opacity: 0, x: 24 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12 }}
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                className="flex flex-1 flex-col overflow-hidden">

                                {/* Team hero — rendered in the previewed team theme */}
                                <div className="toon-banner banner-scope relative shrink-0 overflow-hidden border-b-[3px] border-ink">
                                    <div aria-hidden="true" className="toon-rays pointer-events-none absolute -right-40 -top-40 size-[480px] animate-[spin_60s_linear_infinite]" />
                                    <div className="relative p-5">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <span className="rounded-full bg-ink px-2 py-0.5 text-micro uppercase text-nav-fg">
                                                {selectedTeam.conference} {selectedTeam.division}
                                            </span>
                                            {selectedTier && (
                                                <span className="toon-sticker text-label uppercase">{selectedTier.icon} {selectedTier.label}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="-rotate-6 animate-bounce-in">
                                                <TeamCrest team={selectedTeam} size={96} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-label font-bold text-fg-secondary">{selectedTeam.location}</p>
                                                <p className="toon-title truncate py-0.5 text-[40px] uppercase leading-none text-banner-title">{selectedTeam.name}</p>
                                                {selectedStyle?.tagline && (
                                                    <p className="mt-1 truncate text-label italic text-fg-muted">“{selectedStyle.tagline}”</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ratings */}
                                <div className="shrink-0 space-y-3 border-b-2 border-line px-5 py-4">
                                    <div className="flex items-end gap-6">
                                        {[
                                            ['OVR', Math.round(selectedRating?.overall || 0)],
                                            ['OFF', Math.round(selectedRating?.offense?.overall || 0)],
                                            ['DEF', Math.round(selectedRating?.defense?.overall || 0)],
                                        ].map(([lbl, val], i) => (
                                            <div key={lbl}>
                                                <p className={cx('font-display leading-none tabular-nums text-fg', i === 0 ? 'text-display' : 'text-h1')}>{val || '–'}</p>
                                                <p className="text-micro uppercase text-fg-faint">{lbl}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <Meter label="Offense" caption={Math.round(selectedRating?.offense?.overall || 0)}
                                        value={Math.max(0, (selectedRating?.offense?.overall || 55) - 55)} max={45} />
                                    <Meter label="Defense" caption={Math.round(selectedRating?.defense?.overall || 0)}
                                        value={Math.max(0, (selectedRating?.defense?.overall || 55) - 55)} max={45}
                                        color="var(--team-accent)" />
                                    {selectedTier && (
                                        <p className="flex items-center gap-2 rounded-card bg-surface-sunken px-3 py-2 text-label">
                                            <span aria-hidden="true">{selectedTier.icon}</span>
                                            <span className="text-fg-muted">Season goal:</span>
                                            <b className="text-fg">{selectedTier.goalLabel}</b>
                                        </p>
                                    )}
                                </div>

                                {/* Culture, history + key personnel share the scroll well */}
                                <div className="flex-1 overflow-y-auto px-5 py-4">
                                    <div className="mb-4 border-b-2 border-line-subtle pb-4">
                                        <FranchiseLoreSummary teamId={selectedTeam.id} />
                                    </div>
                                    <p className="mb-2 text-micro uppercase text-fg-faint">Key personnel</p>
                                    {topPlayers.length === 0 && (
                                        <p className="py-4 text-center text-label text-fg-faint">Loading…</p>
                                    )}
                                    <ul className="space-y-2">
                                        {topPlayers.map(p => (
                                            <li key={p.id} className="flex items-center gap-2.5 rounded-card bg-surface-sunken px-2.5 py-2">
                                                <PositionTag position={p.position} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-label font-bold text-fg">{p.name}</p>
                                                    <p className="truncate text-micro uppercase text-fg-faint">
                                                        {p.archetype}
                                                        {p.devTrait === 'Superstar' && ' · ★ Superstar'}
                                                        {p.devTrait === 'Star' && ' · ★ Star'}
                                                    </p>
                                                </div>
                                                <RarityChip ovr={p.ovr} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Confirm */}
                                <div className="shrink-0 border-t-2 border-line bg-surface-sunken p-4">
                                    <p className="mb-2 flex items-center justify-between px-1 text-micro uppercase text-fg-faint">
                                        <span>{styleObj?.icon} {styleObj?.name}</span>
                                        <span style={{ color: diffObj?.color }}>{diffObj?.name}</span>
                                    </p>
                                    <Button variant="primary" size="xl" fullWidth onClick={handleConfirm}
                                        iconRight={<IconArrowRight size={20} />}>
                                        Start franchise
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="empty"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                                <p className="animate-wobble text-[64px]" aria-hidden="true">🏈</p>
                                <div>
                                    <p className="font-display text-h1 uppercase text-fg">Pick a team</p>
                                    <p className="mt-1 text-label text-fg-muted">
                                        Every franchise has its own look. Select one to preview it.
                                    </p>
                                </div>
                                <div className="w-full rounded-card bg-surface-sunken p-4 text-left">
                                    <p className="mb-1 text-micro uppercase text-fg-faint">Your coach</p>
                                    <p className="flex items-center gap-2">
                                        <span className="text-h1" aria-hidden="true">{styleObj?.icon}</span>
                                        <span>
                                            <span className="block font-display text-h2 uppercase text-fg">Coach {coachName}</span>
                                            <span className="text-label text-fg-muted">{styleObj?.name} · {diffObj?.name}</span>
                                        </span>
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </aside>
            </div>
        </div>
    );
}

// ── Team Card sub-component ──────────────────────────────────────────────────
// Each card is a mini trading card printed in the franchise's own colours.
function TeamCard({ team, teamRatings, active, onClick }) {
    const ovr  = Math.round(teamRatings?.[team.id]?.overall || 70);
    const tier = getTeamTier(ovr);

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cx(
                'toon-lift group relative w-full overflow-hidden rounded-panel bg-surface-raised text-left',
                active ? 'shadow-3 -rotate-1' : 'shadow-1',
            )}
        >
            <div
                className="relative flex h-16 items-center border-b-[2.5px] border-ink px-3"
                style={{ backgroundColor: team.theme.primary }}
            >
                <div aria-hidden="true" className="toon-halftone absolute inset-0 text-ink opacity-50" />
                <span className="relative rounded-full bg-ink px-2 py-0.5 text-micro text-nav-fg">{team.abbreviation}</span>
                <div className="absolute -bottom-5 right-2 transition-transform duration-base ease-bounce group-hover:-rotate-12 group-hover:scale-110">
                    <TeamCrest team={team} size={64} />
                </div>
            </div>
            <div className="px-3 pb-3 pt-2">
                <p className="truncate pr-14 text-micro uppercase text-fg-faint">{team.location}</p>
                <p className="truncate font-display text-h2 uppercase leading-tight text-fg">{team.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-micro uppercase" style={{ color: tier.color }}>{tier.icon} {tier.label}</span>
                    <span className="rounded-chip bg-surface-sunken px-1.5 font-display text-h3 tabular-nums text-fg">{ovr}</span>
                </div>
            </div>
            {active && (
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-team-accent text-label font-bold text-team-on-accent shadow-1">✓</span>
            )}
        </button>
    );
}
