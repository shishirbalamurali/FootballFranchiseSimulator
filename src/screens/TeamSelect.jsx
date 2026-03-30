import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';

const getTeamIdentity = (roster, ratings) => {
    if (!roster || roster.length === 0) return { title: "Mystery Squad", desc: "Unknown potential." };
    const qb = roster.find(p => p.position === 'QB');
    const topRb = roster.filter(p => p.position === 'RB').sort((a, b) => b.ovr - a.ovr)[0];
    const def = ratings?.defense || 70;
    if (qb && qb.ovr > 90) return { title: "Air Raid Offense", desc: `Led by elite QB ${qb.name}` };
    if (def > 88) return { title: "Iron Curtain", desc: "Elite defensive unit that shuts down opponents." };
    if (topRb && topRb.ovr > 90) return { title: "Ground & Pound", desc: `Built around star RB ${topRb.name}` };
    if (ratings?.overall < 76) return { title: "The Rebuild", desc: "Young core looking to prove themselves." };
    return { title: "Balanced Attack", desc: "Solid fundamental football team." };
};

export default function TeamSelect({ onTeamSelected }) {
    const generateLeague = useGameStore(state => state.generateLeague);
    const selectTeam = useGameStore(state => state.selectTeam);
    const teamRatings = useGameStore(state => state.teamRatings);
    const rosters = useGameStore(state => state.rosters);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        if (!teamRatings || Object.keys(teamRatings).length === 0) {
            generateLeague();
        }
    }, []);

    const nextTeam = () => { setDirection(1); setCurrentIndex((prev) => (prev + 1) % TEAMS.length); };
    const prevTeam = () => { setDirection(-1); setCurrentIndex((prev) => (prev - 1 + TEAMS.length) % TEAMS.length); };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight') nextTeam();
        if (e.key === 'ArrowLeft') prevTeam();
        if (e.key === 'Enter') handleSelect();
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSelect = () => {
        selectTeam(TEAMS[currentIndex].id);
        onTeamSelected();
    };

    const currentTeam = TEAMS[currentIndex];
    const currentRating = teamRatings?.[currentTeam.id] || { overall: 70, offense: { overall: 70 }, defense: { overall: 70 } };
    const currentRoster = rosters ? rosters[currentTeam.id] : [];
    const topPlayers = useMemo(() => {
        if (!currentRoster) return [];
        return [...currentRoster].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    }, [currentRoster]);
    const identity = useMemo(() => getTeamIdentity(currentRoster, currentRating), [currentRoster, currentRating]);

    const variants = {
        enter: (dir) => ({ x: dir > 0 ? 400 : -400, opacity: 0, scale: 0.95 }),
        center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
        exit: (dir) => ({ zIndex: 0, x: dir < 0 ? 400 : -400, opacity: 0, scale: 0.95 })
    };

    return (
        <div
            className="min-h-screen w-screen overflow-hidden relative font-sans transition-colors duration-700"
            style={{ backgroundColor: currentTeam.theme.primary }}
        >
            {/* Content */}
            <div className="relative z-10 h-screen flex flex-col items-center justify-center p-8">

                {/* Header */}
                <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute top-8 left-0 right-0 text-center"
                >
                    <h1 className="text-5xl font-black text-ink uppercase tracking-wider">
                        Choose Your Franchise
                    </h1>
                    <p className="text-ink/60 mt-2 font-bold">← → to browse • Enter to select</p>
                </motion.div>

                {/* Carousel */}
                <div className="relative w-full max-w-5xl h-[65vh] flex items-center justify-between">

                    {/* Left Arrow */}
                    <button
                        onClick={prevTeam}
                        className="btn-retro w-14 h-14 rounded-full flex items-center justify-center text-2xl z-20"
                    >
                        ←
                    </button>

                    {/* Card */}
                    <div className="flex-1 h-full mx-8 relative flex items-center justify-center">
                        <AnimatePresence initial={false} custom={direction} mode="wait">
                            <motion.div
                                key={currentIndex}
                                custom={direction}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="absolute w-full h-full retro-card border-4 flex flex-col md:flex-row overflow-hidden"
                                style={{ borderColor: currentTeam.theme.accent || currentTeam.theme.secondary }}
                            >
                                {/* Left: Team Identity */}
                                <div className="flex-[1.2] p-8 md:p-12 flex flex-col justify-center relative overflow-hidden"
                                    style={{ backgroundColor: currentTeam.theme.secondary }}>
                                    {/* Big Background Abbr */}
                                    <div
                                        className="absolute -right-10 -bottom-10 text-[300px] font-black leading-none opacity-10 select-none pointer-events-none"
                                        style={{ color: currentTeam.theme.primary }}
                                    >
                                        {currentTeam.abbreviation}
                                    </div>

                                    <div className="relative z-10">
                                        <span className="badge mb-4 inline-block">
                                            {currentTeam.conference} {currentTeam.division}
                                        </span>
                                        <h2 className="text-6xl font-black uppercase tracking-tighter leading-none mb-1 text-white drop-shadow-md">
                                            {currentTeam.location}
                                        </h2>
                                        <h2 className="text-5xl font-black uppercase tracking-tighter leading-none mb-4" style={{ color: currentTeam.theme.primary }}>
                                            {currentTeam.name}
                                        </h2>
                                        <p className="text-white/80 text-lg font-medium mt-2">
                                            {identity.title} — <span className="opacity-60">{identity.desc}</span>
                                        </p>
                                    </div>

                                    {/* Ratings bar */}
                                    <div className="mt-auto relative z-10 bg-black/20 rounded-xl p-4 flex items-end gap-6">
                                        <div>
                                            <div className="text-4xl font-black text-white">{currentRating?.overall || 70}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">OVR</div>
                                        </div>
                                        <div className="h-8 w-px bg-white/20" />
                                        <div>
                                            <div className="text-2xl font-bold text-white">{currentRating?.offense?.overall || 70}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">OFF</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-white">{currentRating?.defense?.overall || 70}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">DEF</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Key Players + Select */}
                                <div className="flex-1 bg-white p-8 flex flex-col">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Key Personnel</h3>

                                    <div className="flex-1 space-y-3">
                                        {topPlayers.map((player) => (
                                            <div key={player.id} className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-100 hover:border-gray-300 transition-colors">
                                                <div
                                                    className="w-10 h-10 rounded-full font-black flex items-center justify-center text-xs text-white shadow"
                                                    style={{ backgroundColor: currentTeam.theme.secondary }}
                                                >
                                                    {player.position}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-ink leading-tight">{player.name}</div>
                                                    <div className="text-[10px] uppercase tracking-wider text-gray-400">{player.archetype}</div>
                                                </div>
                                                <div className="text-2xl font-black text-ink">{player.ovr}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleSelect}
                                        className="btn-retro w-full mt-6 text-center text-lg py-4"
                                        style={{ backgroundColor: currentTeam.theme.secondary, borderColor: currentTeam.theme.accent }}
                                    >
                                        Select Franchise
                                    </button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Right Arrow */}
                    <button
                        onClick={nextTeam}
                        className="btn-retro w-14 h-14 rounded-full flex items-center justify-center text-2xl z-20"
                    >
                        →
                    </button>
                </div>

                {/* Footer: team counter */}
                <div className="absolute bottom-8 text-ink/40 font-bold text-sm tracking-widest">
                    {currentIndex + 1} / {TEAMS.length}
                </div>
            </div>
        </div>
    );
}
