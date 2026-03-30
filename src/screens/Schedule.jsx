import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { motion } from 'framer-motion';

export default function Schedule() {
    const schedule = useGameStore(state => state.schedule);
    const currentWeek = useGameStore(state => state.week);
    const userTeamId = useGameStore(state => state.userTeamId);
    const [viewWeek, setViewWeek] = useState(currentWeek);

    const userTeam = TEAMS.find(t => t.id === userTeamId);
    const theme = userTeam?.theme || {};

    const getContrastColor = (hexColor) => {
        if (!hexColor) return '#ffffff';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    };

    const getTeam = (id) => TEAMS.find(t => t.id === id);

    if (!schedule || schedule.length === 0) {
        return (
            <div
                className="min-h-screen p-8 flex items-center justify-center transition-colors duration-500"
                style={{ backgroundColor: theme.primary || '#f3f4f6' }}
            >
                <div className="retro-card p-12 text-center">
                    <h2 className="text-3xl font-bold text-ink mb-4">No Schedule Generated</h2>
                    <p className="text-gray-600">The season schedule is empty. Please restart the game.</p>
                </div>
            </div>
        );
    }

    const currentGames = schedule[viewWeek - 1] || [];

    return (
        <div
            className="min-h-screen p-8 transition-colors duration-500"
            style={{ backgroundColor: theme.primary || '#f3f4f6' }}
        >
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-5xl font-bold text-ink">Schedule</h1>
                    <div
                        className="flex items-center gap-4 bg-white p-2 rounded-xl border-2 border-ink"
                    >
                        <button
                            className="w-10 h-10 flex items-center justify-center font-bold text-xl hover:opacity-80 rounded-full border-2"
                            onClick={() => setViewWeek(Math.max(1, viewWeek - 1))}
                            disabled={viewWeek === 1}
                            style={{
                                backgroundColor: theme.secondary || '#333',
                                color: getContrastColor(theme.secondary),
                                borderColor: theme.accent || 'transparent'
                            }}
                        >
                            ←
                        </button>
                        <span className="text-xl font-bold font-mono w-24 text-center text-ink">
                            Week {viewWeek}
                        </span>
                        <button
                            className="w-10 h-10 flex items-center justify-center font-bold text-xl hover:opacity-80 rounded-full border-2"
                            onClick={() => setViewWeek(Math.min(18, viewWeek + 1))}
                            disabled={viewWeek === 18}
                            style={{
                                backgroundColor: theme.secondary || '#333',
                                color: getContrastColor(theme.secondary),
                                borderColor: theme.accent || 'transparent'
                            }}
                        >
                            →
                        </button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {currentGames.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 italic">Bye Week / No Games</div>
                    ) : (
                        currentGames.map((game, idx) => {
                            const home = getTeam(game.homeTeamId);
                            const away = getTeam(game.awayTeamId);

                            return (
                                <motion.div
                                    key={idx}
                                    className="retro-card p-4 flex items-center justify-between border-4"
                                    style={{ borderColor: theme.accent || '#000' }}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    {/* Away Team */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <div
                                            className="w-3 h-12 rounded-sm"
                                            style={{ backgroundColor: away.theme.primary }}
                                        />
                                        <div>
                                            <div className="font-bold text-lg text-ink">{away.location}</div>
                                            <div className="text-sm text-gray-500">Away</div>
                                        </div>
                                    </div>

                                    {/* Score / VS */}
                                    <div className="flex flex-col items-center justify-center w-32">
                                        {game.played ? (
                                            <>
                                                <div className="text-3xl font-black font-mono text-ink">
                                                    {game.awayScore} - {game.homeScore}
                                                </div>
                                                <div className="text-xs uppercase font-bold text-gray-500 mt-1">Final</div>
                                            </>
                                        ) : (
                                            <div className="text-xl font-bold text-gray-400">VS</div>
                                        )}
                                    </div>

                                    {/* Home Team */}
                                    <div className="flex items-center gap-4 flex-1 justify-end text-right">
                                        <div>
                                            <div className="font-bold text-lg text-ink">{home.location}</div>
                                            <div className="text-sm text-gray-500">Home</div>
                                        </div>
                                        <div
                                            className="w-3 h-12 rounded-sm"
                                            style={{ backgroundColor: home.theme.primary }}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
