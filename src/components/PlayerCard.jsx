import { motion } from 'framer-motion';

export default function PlayerCard({ player, onClick, teamColors }) {
    const ovrChange = player.ovrHistory?.length > 1
        ? player.ovr - player.ovrHistory[player.ovrHistory.length - 2]
        : 0;

    // Helper to get top 3 attributes to display
    const getTopAttributes = () => {
        const attrs = player.attributes?.position || {};
        return Object.entries(attrs)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
    };

    const topAttrs = getTopAttributes();

    return (
        <motion.div
            className="player-card"
            onClick={() => onClick(player)}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-ink truncate text-lg leading-tight w-3/4" title={player.name}>
                            {player.name}
                        </h3>
                        {/* OVR Ring */}
                        <div className="relative w-10 h-10 flex-shrink-0">
                            <svg width="100%" height="100%" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                                <circle
                                    cx="20" cy="20" r="18"
                                    fill="none"
                                    stroke={teamColors?.primary || '#000'}
                                    strokeWidth="4"
                                    strokeDasharray={`${2 * Math.PI * 18}`}
                                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - player.ovr / 100)}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 20 20)"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-black text-ink leading-none">{player.ovr}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                        <span className="contrast-tag font-bold">{player.position}</span>
                        <span className="contrast-tag" style={{ opacity: 0.8 }}>{player.archetype}</span>
                    </div>
                </div>
            </div>

            {/* Key Stats Bar - THEMED */}
            <div className="space-y-1 mb-3">
                {topAttrs.map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="flex items-center gap-2 w-1/2">
                            <div className="h-2 flex-1 bg-theme-bg-b rounded-full overflow-hidden">
                                <div
                                    className="h-full"
                                    style={{
                                        width: `${value}%`,
                                        backgroundColor: teamColors?.primary || '#3b82f6' // Default logic
                                    }}
                                />
                            </div>
                            <span className="font-bold w-4 text-right">{value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Badges */}
            <div className="flex flex-wrap gap-1 mt-auto">
                <span className="badge text-xs bg-theme-secondary text-white">Age {player.age}</span>
                {player.devTrait === 'Superstar' && (
                    <span className="badge text-xs bg-yellow-500 text-ink">★ SUPERSTAR</span>
                )}
                {player.devTrait === 'Star' && (
                    <span className="badge text-xs bg-orange-400 text-ink">★ STAR</span>
                )}
            </div>

            {/* OVR Change Indicator (Absolute top right) */}
            {ovrChange !== 0 && (
                <div className={`absolute top-2 right-2 text-xs font-bold ${ovrChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ovrChange > 0 ? '+' : ''}{ovrChange}
                </div>
            )}
        </motion.div>
    );
}
