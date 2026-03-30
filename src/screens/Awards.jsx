import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { getAwardRaces, getStatLeaders } from '../engine/awards';
import PlayerModal from '../components/PlayerModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function Awards({ onBack }) {
    const rosters = useGameStore(state => state.rosters);
    const activityLog = useGameStore(state => state.activityLog); // Force re-render on updates
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [activeTab, setActiveTab] = useState('awards'); // 'awards' or 'stats'

    const awards = getAwardRaces(rosters, TEAMS);
    const leaders = getStatLeaders(rosters, TEAMS);

    const AwardCard = ({ title, players, icon }) => (
        <div className="retro-card p-6 bg-paper border-4 border-ink mb-6 relative overflow-hidden">
            {/* Decorative stripe */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full transform translate-x-16 -translate-y-16 z-0"></div>

            <div className="flex items-center gap-3 relative z-10 mb-4">
                <span className="text-3xl">{icon}</span>
                <h2 className="text-2xl font-black text-ink uppercase tracking-wider">{title}</h2>
            </div>

            <div className="space-y-3 relative z-10">
                {players.map((p, i) => (
                    <div
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded border-2 cursor-pointer transition-all hover:translate-x-1 ${i === 0 ? 'bg-theme-primary text-paper border-ink' : 'bg-white border-gray-200 hover:border-primary'}`}
                        onClick={() => setSelectedPlayer(p)}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`font-black font-mono w-6 text-center ${i === 0 ? 'text-paper' : 'text-gray-400'}`}>#{i + 1}</span>
                            <div>
                                <div className="font-bold text-sm leading-tight">{p.name}</div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'text-paper/80' : 'text-gray-500'}`}>
                                    {p.teamLocation} • {p.position}
                                </div>
                            </div>
                        </div>

                        {/* Stat Snapshot */}
                        <div className="text-right">
                            {title === 'MVP Race' && (
                                <div className="text-xs font-mono font-bold">
                                    {p.position === 'QB' ? `${p.stats.season.tds} TD / ${p.stats.season.yards} Yds` : `${p.stats.season.yards} Yds / ${p.stats.season.tds} TD`}
                                </div>
                            )}
                            {title === 'OPOY Race' && (
                                <div className="text-xs font-mono font-bold">
                                    {p.stats.season.yards} Yds
                                </div>
                            )}
                            {title === 'DPOY Race' && (
                                <div className="text-xs font-mono font-bold">
                                    {p.stats.season.sacks} Sacks / {p.stats.season.ints} INT
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const StatTable = ({ title, players, statKey, label }) => (
        <div className="retro-card p-4 bg-white border-4 border-gray-200 mb-6">
            <h3 className="text-lg font-black text-gray-400 uppercase tracking-widest mb-3 border-b-2 border-dashed border-gray-200 pb-2">{title}</h3>
            {players.map((p, i) => (
                <div key={p.id} onClick={() => setSelectedPlayer(p)} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer px-2 rounded">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-300 font-bold w-4 text-xs">{i + 1}</span>
                        <div>
                            <span className="font-bold text-ink text-sm block">{p.name.split(' ').pop()}</span>
                            <span className="text-[10px] text-gray-500 uppercase">{p.teamLocation}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="font-mono font-black text-primary text-lg">{p.stats.season[statKey]}</span>
                        <span className="text-[10px] text-gray-400 uppercase ml-1">{label}</span>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <button
                className="retro-btn fixed top-6 left-6 z-50 bg-white shadow-xl hover:shadow-2xl"
                onClick={onBack}
            >
                ← Back to Dashboard
            </button>

            <div className="max-w-5xl mx-auto mt-12">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-6xl font-black text-ink mb-2 uppercase tracking-tighter">League Awards</h1>
                        <p className="text-xl text-gray-500 font-medium">Season Leaders & Trophy Races</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('awards')}
                            className={`px-6 py-2 font-bold uppercase tracking-widest border-b-4 transition-colors ${activeTab === 'awards' ? 'border-primary text-ink' : 'border-transparent text-gray-400 hover:text-ink'}`}
                        >
                            Trophy Races
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`px-6 py-2 font-bold uppercase tracking-widest border-b-4 transition-colors ${activeTab === 'stats' ? 'border-primary text-ink' : 'border-transparent text-gray-400 hover:text-ink'}`}
                        >
                            Stat Leaders
                        </button>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'awards' ? (
                        <motion.div
                            key="awards-tab"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            <AwardCard title="MVP Race" players={awards.mvp} icon="🏆" />
                            <AwardCard title="OPOY Race" players={awards.opoy} icon="⚡️" />
                            <AwardCard title="DPOY Race" players={awards.dpoy} icon="🛡️" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="stats-tab"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <StatTable title="Passing Yards" players={leaders.passingYards} statKey="yards" label="Yds" />
                            <StatTable title="Rushing Yards" players={leaders.rushingYards} statKey="rushYards" label="Yds" />
                            <StatTable title="Receiving Yards" players={leaders.receivingYards} statKey="recYards" label="Yds" />
                            <StatTable title="Sacks" players={leaders.sacks} statKey="sacks" label="Sacks" />
                            <StatTable title="Interceptions" players={leaders.ints} statKey="ints" label="INTs" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {selectedPlayer && (
                    <PlayerModal
                        player={selectedPlayer}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
