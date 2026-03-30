import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { motion } from 'framer-motion';
import PlayerModal from '../components/PlayerModal';

export default function Stats() {
    const userTeamId = useGameStore(state => state.userTeamId);
    const rosters = useGameStore(state => state.rosters);
    const schedule = useGameStore(state => state.schedule);
    const [filterPos, setFilterPos] = useState('QB'); // Default to QB
    const [sortBy, setSortBy] = useState('yards');
    const [selectedWeek, setSelectedWeek] = useState('season');
    const [viewMode, setViewMode] = useState('TEAM');
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    const teamData = TEAMS.find(t => t.id === userTeamId);
    const theme = teamData?.theme || {};

    // Helper for text contrast
    const getContrastColor = (hexColor) => {
        if (!hexColor) return '#ffffff';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    };

    const roster = rosters[userTeamId] || [];

    // Flatten logic (View Logic)
    let allPlayers = [];
    if (viewMode === 'LEAGUE') {
        Object.keys(rosters).forEach(tid => {
            (rosters[tid] || []).forEach(p => {
                allPlayers.push({ ...p, teamId: tid });
            });
        });
    }

    // Filter Logic
    let displayPlayers = viewMode === 'LEAGUE' ? allPlayers : roster;

    // Position Groups Mapping
    const POS_GROUPS = {
        'QB': ['QB'],
        'RB': ['RB', 'FB'],
        'WR': ['WR'],
        'TE': ['TE'],
        'OL': ['OL', 'C', 'OG', 'OT', 'G', 'T'],
        'DL': ['DL', 'DE', 'DT'],
        'LB': ['LB', 'MLB', 'OLB'],
        'DB': ['DB', 'CB', 'S', 'FS', 'SS'],
        'K': ['K', 'P']
    };

    displayPlayers = displayPlayers.filter(p => {
        const allowed = POS_GROUPS[filterPos] || [filterPos];
        return allowed.includes(p.position);
    });

    // Helper: Calculate Passer Rating
    const calculatePasserRating = (att, comp, yds, tds, ints) => {
        if (!att || att === 0) return 0.0;
        const a = Math.max(0, Math.min(2.375, ((comp / att) - 0.3) * 5));
        const b = Math.max(0, Math.min(2.375, ((yds / att) - 3) * 0.25));
        const c = Math.max(0, Math.min(2.375, (tds / att) * 20));
        const d = Math.max(0, Math.min(2.375, 2.375 - ((ints / att) * 25)));
        return parseFloat((((a + b + c + d) / 6) * 100).toFixed(1));
    };

    // Helpers
    const getStat = (player, key, week) => {
        if (key === 'ovr') return player.ovr;
        let sourceStats = {};
        if (week === 'season') {
            sourceStats = player.stats?.season || {};
        } else {
            const weekIdx = parseInt(week) - 1;
            const weekGames = schedule[weekIdx] || [];
            const userGame = weekGames.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId || (viewMode === 'LEAGUE' && (g.homeTeamId === player.teamId || g.awayTeamId === player.teamId)));

            if (userGame && userGame.playerStats) {
                const pId = player.id;
                // Try both sides to find stats
                const homeStats = userGame.playerStats.home;
                const awayStats = userGame.playerStats.away;
                const pStat = (homeStats && homeStats[pId]) || (awayStats && awayStats[pId]);
                if (pStat) sourceStats = pStat;
            }
        }

        // Calculate Derived Stats
        if (key === 'rating') {
            if (week === 'season' || !sourceStats.rating) {
                // Calculate from totals
                const att = sourceStats.attempts || 0;
                const comp = sourceStats.completions || 0;
                const yds = sourceStats.yards || 0;
                const tds = sourceStats.tds || 0;
                const ints = sourceStats.ints || 0;
                return calculatePasserRating(att, comp, yds, tds, ints);
            }
            return sourceStats.rating;
        }

        return sourceStats[key] || 0;
    };

    // Sort Logic
    displayPlayers.sort((a, b) => {
        const valA = getStat(a, sortBy, selectedWeek);
        const valB = getStat(b, sortBy, selectedWeek);
        return valB - valA;
    });

    if (viewMode === 'LEAGUE') displayPlayers = displayPlayers.slice(0, 50); // Limit to top 50

    // CATEGORY & COLUMN CONFIG
    const categories = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'];

    // Config for dynamic columns
    const COLUMNS = {
        QB: [
            { label: 'Yds', key: 'yards' },
            { label: 'TDs', key: 'tds' },
            { label: 'INTs', key: 'ints' },
            { label: 'Cmp', key: 'completions' },
            { label: 'Att', key: 'attempts' },
            { label: 'QBR', key: 'rating' },
            { label: 'Rush Yds', key: 'rushYards' },
            { label: 'Rush TD', key: 'rushTds' },
            { label: 'Car', key: 'carries' }
        ],
        RB: [
            { label: 'Yds', key: 'yards' },
            { label: 'TDs', key: 'tds' },
            { label: 'Car', key: 'carries' },
            { label: 'Fum', key: 'fumbles' }
        ],
        WR: [
            { label: 'Rec', key: 'receptions' },
            { label: 'Yds', key: 'yards' },
            { label: 'TDs', key: 'tds' },
            { label: 'Trg', key: 'targets' }
        ],
        TE: [
            { label: 'Rec', key: 'receptions' },
            { label: 'Yds', key: 'yards' },
            { label: 'TDs', key: 'tds' },
            { label: 'Trg', key: 'targets' }
        ],
        OL: [
            { label: 'Pan', key: 'pancakes' },
            { label: 'SckA', key: 'sacksAllowed' }
        ],
        DL: [
            { label: 'Tck', key: 'tackles' },
            { label: 'Sck', key: 'sacks' },
            { label: 'TFL', key: 'tfl' }
        ],
        LB: [
            { label: 'Tck', key: 'tackles' },
            { label: 'Sck', key: 'sacks' },
            { label: 'Int', key: 'ints' },
            { label: 'TFL', key: 'tfl' },
            { label: 'PD', key: 'pd' }
        ],
        DB: [
            { label: 'Tck', key: 'tackles' },
            { label: 'Int', key: 'ints' },
            { label: 'PD', key: 'pd' },
            { label: 'TFL', key: 'tfl' }
        ],
        K: [
            { label: 'FGM', key: 'fgm' },
            { label: 'FGA', key: 'fga' },
            { label: 'XPM', key: 'xpm' },
            { label: 'XPA', key: 'xpa' }
        ]
    };

    const currentCols = COLUMNS[filterPos] || COLUMNS.QB;

    // Generate week options
    const currentWeek = useGameStore(state => state.week);
    const weekOptions = ['Season'];
    for (let i = 1; i < currentWeek && i <= 18; i++) {
        weekOptions.push(`Week ${i} `);
    }

    return (
        <div
            className="min-h-screen p-8 pt-24 transition-colors duration-500"
            style={{ backgroundColor: theme.primary || '#f3f4f6' }}
        >
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <h1 className="text-5xl font-bold text-ink">
                        {selectedWeek === 'season' ? 'Season Stats' : `Week ${selectedWeek} Stats`}
                    </h1>

                    <div className="flex gap-4">
                        {/* Scope Selector */}
                        <div className="flex bg-white border-2 border-ink rounded p-1">
                            <select
                                className="text-lg font-bold text-ink bg-transparent outline-none cursor-pointer uppercase"
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value)}
                            >
                                <option value="TEAM">My Team</option>
                                <option value="LEAGUE">League</option>
                            </select>
                        </div>

                        {/* Week Selector */}
                        <div className="flex bg-white border-2 border-ink rounded p-1">
                            <select
                                className="text-lg font-bold text-ink bg-transparent outline-none cursor-pointer"
                                value={selectedWeek === 'season' ? 'Season' : `Week ${selectedWeek} `}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedWeek(val === 'Season' ? 'season' : val.replace('Week ', ''));
                                }}
                            >
                                <option value="Season">Season</option>
                                {weekOptions.filter(o => o !== 'Season').map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Scope & Position Controls */}
                <div
                    className="retro-card p-6 mb-6 flex flex-wrap gap-4 items-center justify-between border-4"
                    style={{ borderColor: theme.accent || '#000' }}
                >
                    <div className="flex flex-wrap gap-2">
                        <span className="font-bold self-center mr-2">Position:</span>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => {
                                    setFilterPos(cat);
                                    setSortBy(COLUMNS[cat][0].key);
                                }}
                                className={`badge cursor-pointer border-2 ${filterPos === cat ? '' : 'hover:bg-gray-200'}`}
                                style={
                                    filterPos === cat
                                        ? {
                                            backgroundColor: theme.secondary,
                                            borderColor: theme.accent,
                                            color: getContrastColor(theme.secondary)
                                        }
                                        : { borderColor: 'transparent' }
                                }
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Table */}
                <div className="retro-card p-0 overflow-hidden">
                    <table className="w-full text-left">
                        <thead
                            className="border-b-4 border-ink"
                            style={{
                                backgroundColor: theme.secondary,
                                color: getContrastColor(theme.secondary)
                            }}
                        >
                            <tr>
                                {/* Fixed Columns */}
                                <th className="p-4 font-black uppercase">Player</th>
                                <th className="p-4 font-black uppercase">Pos</th>
                                {viewMode === 'LEAGUE' && <th className="p-4 font-black uppercase">Team</th>}

                                {/* Dynamic Columns */}
                                {currentCols.map(col => (
                                    <th
                                        key={col.key}
                                        className="p-4 font-black uppercase text-right cursor-pointer hover:opacity-80"
                                        onClick={() => setSortBy(col.key)}
                                    >
                                        {col.label} {sortBy === col.key && '▼'}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayPlayers.map((player, idx) => {
                                return (
                                    <motion.tr
                                        key={player.id}
                                        className="border-b border-gray-200 hover:bg-yellow-50 cursor-pointer"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.01 }}
                                        onClick={() => setSelectedPlayer(player)}
                                    >
                                        <td className="p-4 font-bold text-ink">{player.name}</td>
                                        <td className="p-4">
                                            <span className="contrast-tag text-xs">{player.position}</span>
                                        </td>
                                        {viewMode === 'LEAGUE' && (
                                            <td className="p-4 text-sm font-bold text-gray-500">
                                                {TEAMS.find(t => t.id === player.teamId)?.abbreviation || player.teamId}
                                            </td>
                                        )}

                                        {/* Dynamic Stats Cells */}
                                        {currentCols.map(col => {
                                            const val = getStat(player, col.key, selectedWeek);
                                            return (
                                                <td key={col.key} className="p-4 text-right font-bold text-gray-700">
                                                    {val !== undefined ? val : '-'}
                                                </td>
                                            );
                                        })}
                                    </motion.tr>
                                );
                            })}
                            {displayPlayers.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-gray-500 font-bold italic">
                                        No stats available.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Player Modal */}
                {selectedPlayer && (
                    <PlayerModal
                        player={selectedPlayer}
                        teamTheme={selectedPlayer.teamId === userTeamId ? theme : (TEAMS.find(t => t.id === selectedPlayer.teamId)?.theme || {})}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </div>
        </div>
    );
}
