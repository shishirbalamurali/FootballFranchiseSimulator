import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEAMS } from '../data/teams';

export default function PlayerModal({ player, teamId, teamColors, onClose }) {
    const [activeTab, setActiveTab] = useState('attributes'); // attributes, stats

    if (!player) return null;

    const { universal, position: positionSpecific } = player.attributes;
    const primaryColor = teamColors?.primary || '#3b82f6';

    // Use passed teamId or fall back to player.teamId or 'FA'
    const displayTeamId = teamId || player.teamId || 'FA';

    // Attribute Groups
    const attributeGroups = {
        'Physical': {
            'SPD': universal.speed,
            'ACC': universal.acceleration,
            'STR': universal.strength,
            'AGI': universal.agility,
        },
        'Specific': positionSpecific
    };

    // Calculate details
    const ovrChange = player.ovrHistory && player.ovrHistory.length > 1
        ? player.ovr - player.ovrHistory[player.ovrHistory.length - 2]
        : 0;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-paper w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border-4 border-ink shadow-2xl relative"
                    onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b-4 border-ink bg-white relative overflow-hidden">
                        {/* Pattern Background */}
                        <div className="absolute inset-0 opacity-10"
                            style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }}
                        />

                        <div className="relative z-10 flex justify-between items-start">
                            <div className="flex-1 pr-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black uppercase tracking-widest text-sm" style={{ color: primaryColor }}>
                                        {TEAMS.find(t => t.id === displayTeamId)?.location} {TEAMS.find(t => t.id === displayTeamId)?.name || 'Free Agent'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="contrast-tag text-lg">{player.position}</span>
                                    <span className="text-gray-500 font-bold uppercase tracking-wider">{player.archetype}</span>
                                </div>
                                <h2 className="text-4xl font-black text-ink mb-1">{player.name}</h2>
                                <div className="text-sm font-bold text-gray-500">
                                    Age: {player.age} • Exp: {player.experience} • Dev: {player.devTrait}
                                </div>
                            </div>

                            {/* OVR Metric */}
                            <div className="relative flex-shrink-0">
                                <svg width="100" height="100" viewBox="0 0 100 100">
                                    {/* Background Ring */}
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                    {/* Progress Ring */}
                                    <circle
                                        cx="50" cy="50" r="45"
                                        fill="none"
                                        stroke={primaryColor}
                                        strokeWidth="8"
                                        strokeDasharray={`${2 * Math.PI * 45}`}
                                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - player.ovr / 100)}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-ink leading-none">{player.ovr}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">OVR</span>
                                </div>

                                {ovrChange !== 0 && (
                                    <div className={`absolute -right-4 top-0 text-sm font-bold ${ovrChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {ovrChange > 0 ? '+' : ''}{ovrChange}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b-4 border-ink bg-gray-100">
                        <button
                            className={`flex-1 py-3 font-bold uppercase tracking-widest ${activeTab === 'attributes' ? 'bg-paper text-ink border-b-4 border-transparent -mb-1' : 'text-gray-500 hover:bg-gray-200'}`}
                            style={activeTab === 'attributes' ? { borderBottomColor: primaryColor } : {}}
                            onClick={() => setActiveTab('attributes')}
                        >
                            Attributes
                        </button>
                        <button
                            className={`flex-1 py-3 font-bold uppercase tracking-widest ${activeTab === 'stats' ? 'bg-paper text-ink border-b-4 border-transparent -mb-1' : 'text-gray-500 hover:bg-gray-200'}`}
                            style={activeTab === 'stats' ? { borderBottomColor: primaryColor } : {}}
                            onClick={() => setActiveTab('stats')}
                        >
                            Career Stats
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'attributes' ? (
                            <div className="space-y-6">
                                {Object.entries(attributeGroups).map(([groupName, attrs]) => (
                                    <div key={groupName}>
                                        <h3 className="text-xl font-bold text-ink mb-3 uppercase border-b-2 border-ink inline-block">{groupName}</h3>
                                        <div className="space-y-3">
                                            {Object.entries(attrs).map(([key, value]) => (
                                                <div key={key} className="flex items-center gap-4">
                                                    <span className="w-24 font-bold text-gray-600 uppercase text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <div className="flex-1 h-4 bg-gray-200 rounded-full border border-ink overflow-hidden">
                                                        <motion.div
                                                            className="h-full"
                                                            style={{ backgroundColor: primaryColor }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${value}%` }}
                                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                                        />
                                                    </div>
                                                    <span className="w-8 text-right font-black text-ink">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-left">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-ink bg-gray-100">
                                            <th className="p-2 font-black uppercase text-gray-600">Year</th>
                                            <th className="p-2 font-black uppercase text-gray-600">Team</th>
                                            <th className="p-2 font-black uppercase text-gray-600 text-right">Stats</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Current Season */}
                                        <tr className="border-b border-gray-300">
                                            <td className="p-2 font-bold">2024</td>
                                            <td className="p-2 font-bold">{displayTeamId}</td>
                                            <td className="p-2 text-right">
                                                {player.stats?.season && Object.keys(player.stats.season).length > 0 ? (
                                                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 justify-end">
                                                        {Object.entries(player.stats.season).map(([k, v]) => (
                                                            <div key={k} className="flex justify-between gap-2">
                                                                <span className="text-gray-500 uppercase text-xs self-center">{k.substring(0, 4)}</span>
                                                                <span className="font-bold">{v}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">No stats</span>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Career History (Previous years would go here) */}
                                        {player.stats?.career && Object.keys(player.stats.career).length > 0 && (
                                            <tr className="bg-gray-50 font-bold border-t-2 border-ink">
                                                <td className="p-2">Career</td>
                                                <td className="p-2">-</td>
                                                <td className="p-2 text-right">
                                                    {Object.entries(player.stats.career).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <button
                        className="absolute -top-4 -right-4 w-10 h-10 bg-ink text-white rounded-full font-bold flex items-center justify-center border-2 border-white hover:bg-gray-800 shadow-lg z-50 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                    >
                        ✕
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
