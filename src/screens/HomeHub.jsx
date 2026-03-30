import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import PlayerModal from '../components/PlayerModal';
import { motion, AnimatePresence } from 'framer-motion';
import LeagueNewsPanel from '../components/LeagueNewsPanel';

export default function HomeHub({ onNavigate }) {
    const year = useGameStore(state => state.year);
    const week = useGameStore(state => state.week);
    const phase = useGameStore(state => state.phase);
    const userTeamId = useGameStore(state => state.userTeamId);
    const standings = useGameStore(state => state.standings);
    const schedule = useGameStore(state => state.schedule);
    const lastDismissedGameId = useGameStore(state => state.lastDismissedGameId);
    const simulateWeek = useGameStore(state => state.simulateWeek);
    const simulatePlayoffRound = useGameStore(state => state.simulatePlayoffRound);
    const teamRatings = useGameStore(state => state.teamRatings);

    const userTeam = standings[userTeamId];
    const teamData = TEAMS.find(t => t.id === userTeamId);

    const [gameResult, setGameResult] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    useEffect(() => {
        const prevWeekIndex = week - 2;
        if (prevWeekIndex < 0) return;
        const prevWeekGames = schedule[prevWeekIndex];
        const userGame = prevWeekGames?.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);
        if (userGame && userGame.played && userGame.id !== lastDismissedGameId) {
            setGameResult(userGame);
        }
    }, [week, schedule, userTeamId, lastDismissedGameId]);

    const closeSummary = () => {
        if (gameResult) useGameStore.getState().dismissGameSummary(gameResult.id);
        setGameResult(null);
    };

    const handlePrimaryAction = () => {
        if (phase === 'regular') simulateWeek();
        else if (phase === 'playoffs') simulatePlayoffRound();
        else if (phase === 'draft') onNavigate('draft');
    };

    const getPrimaryActionText = () => {
        if (phase === 'regular') return `Advance to Week ${week}`;
        if (phase === 'playoffs') return 'Sim Playoff Round';
        if (phase === 'draft') return 'Enter Draft Room';
        return 'Continue';
    };

    const navItems = [
        { id: 'standings', label: 'League', icon: '🏆' },
        { id: 'schedule', label: 'Schedule', icon: '📅' },
        { id: 'roster', label: 'Roster', icon: '👥' },
        { id: 'stats', label: 'Stats', icon: '📊' },
        { id: 'draft', label: 'Draft', icon: '🔭' },
        { id: 'awards', label: 'Awards', icon: '🎖️' },
    ];

    if (!teamData) return <div>Loading...</div>;

    return (
        <div
            className="min-h-screen p-8 transition-colors duration-500"
            style={{ backgroundColor: teamData.theme.primary }}
        >
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-center mb-8"
                >
                    <div>
                        <h1 className="text-5xl font-bold text-ink">Franchise Hub</h1>
                        <p className="text-ink/60 text-lg font-bold uppercase tracking-wider mt-1">
                            {phase} • Season {year} • Week {week}
                        </p>
                    </div>
                    <button
                        className="btn-retro bg-red-600 border-red-800 text-white text-xs"
                        onClick={() => { if (window.confirm('Reset Game?')) useGameStore.getState().resetGame(); }}
                    >
                        Reset Career
                    </button>
                </motion.div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Team Card (2 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-2"
                    >
                        <div
                            className="retro-card p-8 border-4"
                            style={{ borderColor: teamData.theme.accent || teamData.theme.secondary }}
                        >
                            <h2 className="text-4xl font-black text-ink mb-2">
                                {teamData.location} {teamData.name}
                            </h2>

                            {/* Ratings */}
                            <div className="flex gap-4 mb-6 mt-4">
                                <div className="badge text-lg px-4 py-2" style={{ backgroundColor: teamData.theme.secondary, color: '#fff' }}>
                                    OVR {teamRatings?.[userTeamId]?.overall || 0}
                                </div>
                                <div className="badge text-lg px-4 py-2">
                                    OFF {teamRatings?.[userTeamId]?.offense?.overall || 0}
                                </div>
                                <div className="badge text-lg px-4 py-2">
                                    DEF {teamRatings?.[userTeamId]?.defense?.overall || 0}
                                </div>
                                <div className="badge text-2xl font-black px-6 py-2 ml-auto" style={{ backgroundColor: teamData.theme.accent, color: '#fff' }}>
                                    {userTeam?.wins}-{userTeam?.losses}
                                </div>
                            </div>

                            {/* Primary Action */}
                            <button
                                onClick={() => phase === 'playoffs' ? onNavigate('playoffs') : handlePrimaryAction()}
                                className="btn-retro w-full text-xl py-4 flex items-center justify-between"
                                style={{ backgroundColor: teamData.theme.secondary, borderColor: teamData.theme.accent }}
                            >
                                <span>{getPrimaryActionText()}</span>
                                <span className="text-2xl">➔</span>
                            </button>
                        </div>
                    </motion.div>

                    {/* News Sidebar (1 col) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="retro-card p-6 h-full overflow-hidden flex flex-col">
                            <h3 className="font-bold text-ink text-sm uppercase tracking-wider border-b-2 border-ink pb-2 mb-4">
                                League News
                            </h3>
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                <LeagueNewsPanel onNavigate={onNavigate} />
                            </div>
                        </div>
                    </motion.div>

                    {/* Navigation Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="lg:col-span-3"
                    >
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                            {navItems.map((nav, idx) => (
                                <motion.button
                                    key={nav.id}
                                    onClick={() => onNavigate(nav.id)}
                                    className="retro-card p-6 text-center hover:-translate-y-1 transition-all cursor-pointer group"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 + idx * 0.05 }}
                                >
                                    <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform">{nav.icon}</span>
                                    <span className="text-sm font-bold uppercase tracking-wider text-ink">{nav.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
                {gameResult && <GameSummaryModal game={gameResult} userTeamId={userTeamId} onClose={closeSummary} teamData={teamData} />}
            </AnimatePresence>
        </div>
    );
}

function GameSummaryModal({ game, userTeamId, onClose, teamData }) {
    const isWin = game.winnerId === userTeamId;
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl retro-card p-12 text-center border-4"
                style={{ borderColor: teamData?.theme?.accent || '#000' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-6xl font-black uppercase mb-6"
                    style={{ color: isWin ? '#16a34a' : '#dc2626' }}>
                    {isWin ? 'VICTORY!' : 'DEFEAT'}
                </h2>

                <div className="flex justify-center items-center gap-8 mb-8">
                    <div className="text-center">
                        <div className="text-5xl font-black">{game.homeScore}</div>
                        <div className="text-sm font-bold text-gray-500 mt-1">{game.homeTeamId}</div>
                    </div>
                    <div className="text-2xl font-bold text-gray-400">VS</div>
                    <div className="text-center">
                        <div className="text-5xl font-black">{game.awayScore}</div>
                        <div className="text-sm font-bold text-gray-500 mt-1">{game.awayTeamId}</div>
                    </div>
                </div>

                <button onClick={onClose} className="btn-retro w-full text-center justify-center">
                    Continue Season
                </button>
            </motion.div>
        </motion.div>
    );
}
