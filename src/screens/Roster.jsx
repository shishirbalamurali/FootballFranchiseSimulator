import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { POSITIONS } from '../engine/player';
import { TEAMS } from '../data/teams';
import PlayerCard from '../components/PlayerCard';
import PlayerModal from '../components/PlayerModal';
import { motion } from 'framer-motion';

export default function Roster() {
    const userTeamId = useGameStore(state => state.userTeamId);
    const rosters = useGameStore(state => state.rosters);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [positionFilter, setPositionFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('ovr');

    const roster = rosters[userTeamId] || [];
    const teamData = TEAMS.find(t => t.id === userTeamId);

    // Filter and sort
    let filteredRoster = roster;
    if (positionFilter !== 'ALL') {
        filteredRoster = roster.filter(p => p.position === positionFilter);
    }

    filteredRoster = [...filteredRoster].sort((a, b) => {
        if (sortBy === 'ovr') return b.ovr - a.ovr;
        if (sortBy === 'pot') return b.pot - a.pot;
        if (sortBy === 'age') return a.age - b.age;
        return 0;
    });

    const positionGroups = ['ALL', ...Object.values(POSITIONS)];

    return (
        <div
            className="min-h-screen p-8 transition-colors duration-500"
            style={{ backgroundColor: teamData?.theme?.primary || '#f3f4f6' }}
        >
            <div className="max-w-7xl mx-auto">
                <h1 className="text-5xl font-bold text-ink mb-8">Team Roster</h1>

                {/* Filters */}
                <div
                    className="retro-card p-6 mb-6 border-4"
                    style={{ borderColor: teamData?.theme?.accent || '#000' }}
                >
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="font-bold text-ink self-center mr-2">Position:</span>
                        {positionGroups.map(pos => (
                            <button
                                key={pos}
                                className={`badge cursor-pointer border-2 ${positionFilter === pos ? 'text-white' : 'hover:bg-gray-200'}`}
                                onClick={() => setPositionFilter(pos)}
                                style={
                                    positionFilter === pos
                                        ? { backgroundColor: teamData?.theme?.secondary, borderColor: teamData?.theme?.accent }
                                        : { borderColor: 'transparent' }
                                }
                            >
                                {pos}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <span className="font-bold text-ink self-center mr-2">Sort:</span>
                        <button
                            className={`badge cursor-pointer border-2 ${sortBy === 'ovr' ? 'text-white' : 'hover:bg-gray-200'}`}
                            onClick={() => setSortBy('ovr')}
                            style={sortBy === 'ovr' ? { backgroundColor: teamData?.theme?.secondary, borderColor: teamData?.theme?.accent } : { borderColor: 'transparent' }}
                        >
                            OVR
                        </button>
                        <button
                            className={`badge cursor-pointer border-2 ${sortBy === 'pot' ? 'text-white' : 'hover:bg-gray-200'}`}
                            onClick={() => setSortBy('pot')}
                            style={sortBy === 'pot' ? { backgroundColor: teamData?.theme?.secondary, borderColor: teamData?.theme?.accent } : { borderColor: 'transparent' }}
                        >
                            POT
                        </button>
                        <button
                            className={`badge cursor-pointer border-2 ${sortBy === 'age' ? 'text-white' : 'hover:bg-gray-200'}`}
                            onClick={() => setSortBy('age')}
                            style={sortBy === 'age' ? { backgroundColor: teamData?.theme?.secondary, borderColor: teamData?.theme?.accent } : { borderColor: 'transparent' }}
                        >
                            Age
                        </button>
                    </div>
                </div>

                {/* Player Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRoster.map((player, idx) => (
                        <motion.div
                            key={player.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.02 }}
                        >
                            <PlayerCard player={player} onClick={setSelectedPlayer} teamColors={teamData?.theme} />
                        </motion.div>
                    ))}
                </div>

                {/* Player Modal */}
                {selectedPlayer && (
                    <PlayerModal
                        player={selectedPlayer}
                        teamId={userTeamId}
                        teamColors={teamData?.theme}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </div>
        </div>
    );
}
