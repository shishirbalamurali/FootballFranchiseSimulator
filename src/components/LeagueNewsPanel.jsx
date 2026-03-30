import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AnimatePresence } from 'framer-motion';

export default function LeagueNewsPanel({ onNavigate }) {
    const weeklyNews = useGameStore(state => state.weeklyNews) || [];
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // Fallback if no news (Start of game)
    const newsItems = weeklyNews.length > 0 ? weeklyNews : [
        {
            title: 'Season Kickoff',
            headline: 'The Road to Glory Begins',
            subtext: 'Who will rise to the top this season?',
            type: 'GENERIC'
        }
    ];

    return (
        <div className="flex flex-col h-full relative">
            {/* News Feed - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                {newsItems.map((item, idx) => (
                    <div
                        key={idx}
                        className="p-4 border-b border-white/10 last:border-0 hover:bg-white/5 transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded
                                ${item.type === 'GAME_OF_WEEK' ? 'bg-blue-500/20 text-blue-300' :
                                        item.type === 'PLAYER_WEEK' ? 'bg-amber-500/20 text-amber-300' :
                                            'bg-white/10 text-gray-400'}`}
                            >
                                {item.title}
                            </span>
                        </div>
                        <h3 className="font-bold text-white text-sm leading-snug mb-1 group-hover:text-glow transition-all">{item.headline}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed max-w-[90%]">
                            {item.subtext}
                        </p>
                    </div>
                ))}
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-white/5 border-t border-white/10 shrink-0">
                <button
                    onClick={() => onNavigate('awards')}
                    className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-widest transition-all"
                >
                    View Season Awards
                </button>
            </div>

        </div>
    );
}
