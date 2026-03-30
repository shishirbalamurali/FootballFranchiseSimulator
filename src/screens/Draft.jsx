import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { motion, AnimatePresence } from 'framer-motion';
import { calculatePositionNeeds } from '../engine/draft';

// --- ISOLATED TIMER COMPONENT ---
const DraftTimer = () => {
    const draftTimer = useGameStore(state => state.draftTimer);
    const draftTimerActive = useGameStore(state => state.draftTimerActive);
    const toggleDraftTimer = useGameStore(state => state.toggleDraftTimer);
    const decrementDraftTimer = useGameStore(state => state.decrementDraftTimer);

    useEffect(() => {
        let interval;
        if (draftTimerActive) {
            interval = setInterval(decrementDraftTimer, 1000);
        }
        return () => clearInterval(interval);
    }, [draftTimerActive, decrementDraftTimer]);

    const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
    const isCritical = draftTimer < 15 && draftTimerActive;

    return (
        <div className={`relative flex flex-col items-center justify-center w-32 h-16 bg-black border-2 rounded transition-colors duration-500 overflow-hidden group ${isCritical ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'border-slate-600'}`}>
            <div className={`absolute inset-0 opacity-10 ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <div className={`text-3xl font-black tracking-widest leading-none z-10 font-mono ${isCritical ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatTime(draftTimer)}
            </div>
            <button
                onClick={() => toggleDraftTimer(!draftTimerActive)}
                className="absolute bottom-1 text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors z-20"
            >
                {draftTimerActive ? 'HALT' : 'RESUME'}
            </button>
        </div>
    );
};

// --- NEED METER COMPONENT ---
const NeedMeter = ({ needs }) => {
    // Sort needs by intensity
    const sortedNeeds = Object.entries(needs).sort(([, a], [, b]) => b - a).slice(0, 5);

    return (
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Top Team Needs
            </h3>
            <div className="space-y-3">
                {sortedNeeds.map(([pos, score]) => (
                    <div key={pos} className="flex items-center gap-3">
                        <div className="w-8 text-xs font-bold text-slate-300">{pos}</div>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (score / 100) * 100)}%` }}
                                className={`h-full ${score > 80 ? 'bg-red-500' : score > 60 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- DRAFT COMPONENT ---
export default function Draft() {
    // Selective State Subscriptions
    const phase = useGameStore(state => state.phase);
    const draftClass = useGameStore(state => state.draftClass);
    const draftOrder = useGameStore(state => state.draftOrder);
    const currentPickIndex = useGameStore(state => state.currentPickIndex);
    const onClockTeamId = useGameStore(state => state.onClockTeamId);
    const makePick = useGameStore(state => state.makePick);
    const simToNextUserPick = useGameStore(state => state.simToNextUserPick);
    const draftHistory = useGameStore(state => state.draftHistory);
    const userTeamId = useGameStore(state => state.userTeamId);
    const rosters = useGameStore(state => state.rosters);

    const [hasEntered, setHasEntered] = useState(false);
    const [selectedProspect, setSelectedProspect] = useState(null);
    const [positionFilter, setPositionFilter] = useState('ALL');
    const [lastPickOverlay, setLastPickOverlay] = useState(null); // { player, team }

    // Detect new picks for overlay
    useEffect(() => {
        if (draftHistory.length > 0) {
            const lastPick = draftHistory[draftHistory.length - 1];
            // Only show overlay for user picks OR top 5 picks for drama? 
            // Let's show for USER picks to confirm success.
            if (lastPick.teamId === userTeamId) {
                setLastPickOverlay(lastPick);
                const t = setTimeout(() => setLastPickOverlay(null), 2500);
                return () => clearTimeout(t);
            }
        }
    }, [draftHistory.length, userTeamId]);

    // Derived Data
    const currentPick = draftOrder[currentPickIndex];
    const isDraftComplete = !currentPick;

    // Safety check
    if (isDraftComplete) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
            <div className="text-center">
                <h1 className="text-6xl font-black mb-4">DRAFT COMPLETE</h1>
                <p className="text-xl opacity-50">Review your roster for the new rookies.</p>
            </div>
        </div>
    );

    const onClockTeam = TEAMS.find(t => t.id === onClockTeamId) || {};
    const isUserPick = onClockTeamId === userTeamId;

    // Calculate Needs & Fits
    const userRoster = rosters[userTeamId] || [];
    const teamNeeds = useMemo(() => calculatePositionNeeds(userRoster), [userRoster]);

    // Enhanced Prospects List with "Fit Score"
    const enrichedProspects = useMemo(() => {
        return draftClass.map(p => {
            const needScore = teamNeeds[p.position] || 0;
            // Simple fit calculation for UI sorting
            // 60% Talent (OVR), 40% Need
            const fitScore = (p.ovr * 0.6) + (needScore * 0.4);
            return { ...p, fitScore, needScore };
        });
    }, [draftClass, teamNeeds]);

    const filteredProspects = enrichedProspects.filter(p => {
        if (positionFilter === 'ALL') return true;
        if (positionFilter === 'NEEDS') return p.needScore > 60; // Show high needs
        return p.position === positionFilter;
    }).sort((a, b) => {
        if (positionFilter === 'NEEDS') return b.fitScore - a.fitScore;
        return b.ovr - a.ovr;
    });

    // Landing Page
    if (!hasEntered && currentPickIndex === 0) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans">
                {/* Grid Background */}
                <div className="absolute inset-0"
                    style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                ></div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="z-10 text-center"
                >
                    <div className="inline-block px-4 py-1 border border-green-500/50 rounded-full bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md">
                        Authorized Personnel Only
                    </div>
                    <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 mb-2">WAR ROOM</h1>
                    <p className="text-2xl text-slate-400 font-light tracking-wide mb-12">NFL ROOKIE DRAFT 2025</p>

                    <button
                        onClick={() => setHasEntered(true)}
                        className="group relative px-12 py-4 bg-white text-black font-black text-xl uppercase tracking-widest overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                    >
                        <span className="relative z-10">Initialize Draft</span>
                        <div className="absolute inset-0 bg-green-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-green-500 selection:text-black">

            {/* --- PICK SUCCESS OVERLAY --- */}
            <AnimatePresence>
                {lastPickOverlay && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none"
                    >
                        <div className="text-center">
                            <motion.div
                                initial={{ y: -50 }} animate={{ y: 0 }}
                                className="text-green-500 font-bold uppercase tracking-[0.5em] mb-4 text-xl"
                            >
                                selection confirmed
                            </motion.div>
                            <h1 className="text-7xl font-black text-white italic outline-text mb-2">
                                {lastPickOverlay.player.name.toUpperCase()}
                            </h1>
                            <div className="text-3xl text-slate-400 font-bold">
                                {lastPickOverlay.player.position} • {lastPickOverlay.player.college}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- TOP BAR --- */}
            <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-6 z-20 shrink-0">
                {/* Current Pick Info */}
                <div className="flex items-center gap-4 w-64">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Current Pick</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{currentPick.pickNumber}</span>
                            <span className="text-sm font-bold text-slate-500">Round {currentPick.round}</span>
                        </div>
                    </div>
                </div>

                {/* Center Stage: On The Clock */}
                <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-6 bg-slate-800/50 px-8 py-2 rounded-full border border-slate-700 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded shadow-sm flex items-center justify-center p-1 bg-white">
                            <div className="w-full h-full" style={{ backgroundColor: onClockTeam.theme?.primary }}></div>
                        </div>
                        <div className="text-center">
                            <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">On The Clock</div>
                            <div className="text-xl font-black text-white uppercase tracking-tight">{onClockTeam.location}</div>
                        </div>
                        <DraftTimer />
                    </div>
                </div>

                {/* Actions */}
                <div className="w-64 flex justify-end">
                    {!isUserPick && (
                        <button
                            onClick={simToNextUserPick}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-bold uppercase tracking-wider transition-all hover:border-white"
                        >
                            Sim to Next Pick ⏩
                        </button>
                    )}
                    {isUserPick && (
                        <div className="px-4 py-2 bg-green-500/10 border border-green-500 text-green-400 rounded text-xs font-bold uppercase tracking-wider animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                            YOUR TURN
                        </div>
                    )}
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex overflow-hidden">

                {/* LEFT: PROSPECT POOL */}
                <section className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/50">
                    {/* Filters */}
                    <div className="p-4 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'ALL', label: 'All Players' },
                            { id: 'NEEDS', label: 'Best Fits', icon: '🎯' }, // The "Useful" Feature
                            { id: 'QB', label: 'QB' },
                            { id: 'RB', label: 'RB' },
                            { id: 'WR', label: 'WR' },
                            { id: 'TE', label: 'TE' },
                            { id: 'OL', label: 'OL' },
                            { id: 'DL', label: 'DL' },
                            { id: 'LB', label: 'LB' },
                            { id: 'CB', label: 'CB' },
                            { id: 'S', label: 'S' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setPositionFilter(tab.id)}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded transition-all whitespace-nowrap ${positionFilter === tab.id ? 'bg-white text-black shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-slate-950 text-[10px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-800">
                        <div className="col-span-1">Rnk</div>
                        <div className="col-span-4">Prospect</div>
                        <div className="col-span-2">Position</div>
                        <div className="col-span-3">College</div>
                        <div className="col-span-2 text-right">Grade</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredProspects.slice(0, 100).map((p, i) => (
                            <motion.div
                                layoutId={p.id} // Fluid reordering
                                key={p.id}
                                onClick={() => setSelectedProspect(p)}
                                className={`grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800/50 items-center cursor-pointer group transition-colors ${selectedProspect?.id === p.id ? 'bg-white/5 border-l-4 border-l-green-500' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                            >
                                <div className="col-span-1 font-mono text-slate-500 text-xs">#{i + 1}</div>
                                <div className="col-span-4">
                                    <div className="font-bold text-slate-200 group-hover:text-white transition-colors text-sm">{p.name}</div>
                                    {p.needScore > 60 && <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider">Top Fit</span>}
                                </div>
                                <div className="col-span-2">
                                    <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{p.position}</span>
                                </div>
                                <div className="col-span-3 text-xs text-slate-400">{p.college}</div>
                                <div className="col-span-2 text-right">
                                    <div className={`font-black font-mono text-sm ${p.grade >= 80 ? 'text-green-400' : p.grade >= 70 ? 'text-blue-400' : 'text-slate-500'}`}>
                                        {isUserPick ? p.ovr : '??'}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* RIGHT: INTEL & DETAIL */}
                <section className="w-[450px] bg-slate-950 border-l border-slate-800 flex flex-col">

                    {/* 1. SELECTED PROSPECT CARD */}
                    <div className="flex-1 p-6 flex flex-col relative overflow-hidden">
                        {selectedProspect ? (
                            <>
                                {/* Dynamic Background for Prospect */}
                                <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-slate-800/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                                <div className="relative z-10 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-4xl font-black text-white italic leading-none mb-2">{selectedProspect.name}</h2>
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-bold text-slate-400">{selectedProspect.position}</span>
                                                <span className="h-4 w-px bg-slate-700"></span>
                                                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedProspect.archetype}</span>
                                            </div>
                                        </div>
                                        <div className="text-center bg-slate-900 border border-slate-700 p-2 rounded-lg">
                                            <div className="text-[10px] uppercase font-bold text-slate-500">Talent</div>
                                            <div className={`text-3xl font-black ${selectedProspect.grade >= 80 ? 'text-green-400' : 'text-white'}`}>
                                                {isUserPick ? selectedProspect.ovr : 'B+'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                            <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">Physical</div>
                                            <div className="text-sm font-mono text-slate-300">
                                                Height: 6'2"<br />Weight: 225 lbs<br />Age: {selectedProspect.age}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                            <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">Draft Profile</div>
                                            <div className="text-sm font-mono text-slate-300">
                                                Rank: #{selectedProspect.draftRank}<br />
                                                Projected: Rd {Math.ceil(selectedProspect.draftRank / 32)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attribute Bars */}
                                    <div className="space-y-4 mb-auto">
                                        {Object.entries(selectedProspect.attributes?.position || {}).slice(0, 5).map(([key, val]) => (
                                            <div key={key}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-bold text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                    <span className="font-mono text-white">{val}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${val}%` }}
                                                        className="h-full bg-slate-200"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Make Pick Button */}
                                    <button
                                        disabled={!isUserPick}
                                        onClick={() => {
                                            makePick(selectedProspect.id);
                                            setSelectedProspect(null);
                                        }}
                                        className={`w-full py-5 text-xl font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group ${isUserPick
                                            ? 'bg-white text-black hover:bg-green-400'
                                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                    >
                                        <span className="relative z-10">{isUserPick ? 'Submit Card' : 'Wait...'}</span>
                                        {isUserPick && <div className="absolute inset-0 bg-green-400 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-50">
                                <div className="text-6xl mb-4">🔍</div>
                                <div className="text-sm font-bold uppercase tracking-widest">Select Prospect</div>
                            </div>
                        )}
                    </div>

                    {/* 2. TEAM NEEDS (Bottom Right) */}
                    <div className="h-1/3 border-t border-slate-800 p-6 bg-slate-900 overflow-y-auto">
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">War Room Intel</h3>
                        <NeedMeter needs={teamNeeds} />
                    </div>
                </section>
            </main>

            {/* --- BOTTOM TICKER --- */}
            <footer className="h-10 bg-black border-t border-slate-800 flex items-center shadow-2xl relative z-30">
                <div className="bg-green-600 text-black px-4 h-full flex items-center font-bold text-[10px] uppercase tracking-widest">
                    Recent
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <div className="animate-marquee whitespace-nowrap flex items-center gap-12 pl-4">
                        {[...draftHistory].reverse().map((pick, i) => (
                            <div key={i} className="flex items-center gap-3 opacity-80">
                                <span className="font-mono text-slate-500 text-xs">#{pick.pickNumber}</span>
                                <b className="text-white text-xs">{TEAMS.find(t => t.id === pick.teamId)?.abbreviation}</b>
                                <span className="text-xs text-slate-400">selected</span>
                                <b className="text-green-400 text-xs uppercase">{pick.player.position} {pick.player.name}</b>
                            </div>
                        ))}
                        {draftHistory.length === 0 && <span className="text-xs text-slate-600 italic">Draft is strictly confidential until picks are made...</span>}
                    </div>
                </div>
            </footer>
        </div>
    );
}
