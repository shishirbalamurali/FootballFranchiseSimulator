import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { DIVISIONS, CONFERENCES, TEAMS } from '../data/teams';
import { motion } from 'framer-motion';

export default function Standings() {
    const [activeConf, setActiveConf] = useState('AFC');
    const standings = useGameStore(state => state.standings);
    const userTeamId = useGameStore(state => state.userTeamId);

    const userTeam = TEAMS.find(t => t.id === userTeamId);
    const theme = userTeam?.theme || {};

    const allTeams = Object.values(standings).map(s => {
        const teamInfo = TEAMS.find(t => t.id === s.id);
        return {
            ...s,
            ...teamInfo,
            pointDiff: s.pf - s.pa
        };
    });

    const confStandings = allTeams.filter(t => t.conference === activeConf);

    return (
        <div
            className="min-h-screen p-8 transition-colors duration-500"
            style={{ backgroundColor: theme.primary || '#f3f4f6' }}
        >
            <div className="max-w-7xl mx-auto">
                <h1 className="text-5xl font-bold text-ink mb-8">Standings</h1>

                {/* Conference Tabs */}
                <div className="flex gap-2 mb-6">
                    {CONFERENCES.map(conf => (
                        <button
                            key={conf}
                            className={`retro-tab ${activeConf === conf ? 'text-white' : ''}`}
                            onClick={() => setActiveConf(conf)}
                            style={activeConf === conf ? { backgroundColor: theme.secondary } : {}}
                        >
                            {conf}
                        </button>
                    ))}
                </div>

                {/* Divisions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {DIVISIONS.map(div => {
                        const divTeams = confStandings
                            .filter(t => t.division === div)
                            .sort((a, b) => {
                                if (b.wins !== a.wins) return b.wins - a.wins;
                                return b.pointDiff - a.pointDiff;
                            });

                        return (
                            <motion.div
                                key={div}
                                className="retro-card p-6"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <h2 className="text-2xl font-bold text-ink mb-4"
                                    style={{ color: theme.secondary }}>
                                    {activeConf} {div}
                                </h2>
                                <table className="w-full font-mono text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-ink">
                                            <th className="text-left pb-2 text-ink">Team</th>
                                            <th className="text-center pb-2 text-ink">W</th>
                                            <th className="text-center pb-2 text-ink">L</th>
                                            <th className="text-center pb-2 text-ink">PF</th>
                                            <th className="text-center pb-2 text-ink">PA</th>
                                            <th className="text-center pb-2 text-ink">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {divTeams.map((team, idx) => (
                                            <tr key={team.id} className="border-b border-gray-300">
                                                <td className="py-2 font-bold text-ink">
                                                    {idx === 0 && <span style={{ color: theme.accent }} className="mr-1">★</span>}
                                                    {team.location}
                                                </td>
                                                <td className="text-center text-ink">{team.wins}</td>
                                                <td className="text-center text-ink">{team.losses}</td>
                                                <td className="text-center text-ink">{team.pf}</td>
                                                <td className="text-center text-ink">{team.pa}</td>
                                                <td className="text-center">
                                                    <span className={team.pointDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {team.pointDiff > 0 ? '+' : ''}{team.pointDiff}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
