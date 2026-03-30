import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { getAwardRaces, getStatLeaders } from '../engine/awards';

export default function LeagueInfoPanel({ onPlayerClick }) {
    const rosters = useGameStore(state => state.rosters);
    const teams = useGameStore(state => state.teams);

    // Tab State: races | stats
    const [activeTab, setActiveTab] = useState('races');

    // Derived state using useMemo to prevent render loops
    const races = useMemo(() => {
        if (!rosters || !teams || Object.keys(rosters).length === 0) return null;
        return getAwardRaces(rosters, teams);
    }, [rosters, teams]);

    const leaders = useMemo(() => {
        if (!rosters || !teams || Object.keys(rosters).length === 0) return null;
        return getStatLeaders(rosters, teams);
    }, [rosters, teams]);

    if (!races || !leaders) return (
        <div className="flex items-center justify-center p-4 h-full bg-cream">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">Scanning League...</p>
        </div>
    );

    const tabs = [
        { id: 'races', label: 'Awards' },
        { id: 'stats', label: 'League Leaders' }
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 font-mono">
            {/* Minimalist Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all relative
                            ${activeTab === tab.id
                                ? 'text-primary'
                                : 'text-gray-400 hover:text-ink hover:bg-gray-50'}`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-[#f8f9fa]">
                <AnimatePresence mode="wait">
                    {activeTab === 'races' && (
                        <motion.div
                            key="races"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="divide-y divide-gray-100"
                        >
                            <Section title="MVP Race" items={races.mvp} onPlayerClick={onPlayerClick} />
                            <Section title="Offensive POY" items={races.opoy} onPlayerClick={onPlayerClick} />
                            <Section title="Defensive POY" items={races.dpoy} onPlayerClick={onPlayerClick} />
                        </motion.div>
                    )}

                    {activeTab === 'stats' && (
                        <motion.div
                            key="stats"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="divide-y divide-gray-100"
                        >
                            <Section title="Passing Yards" items={leaders.passingYards} stat="yards" label="Yds" onPlayerClick={onPlayerClick} />
                            <Section title="Rushing Yards" items={leaders.rushingYards} stat="rushYards" label="Yds" onPlayerClick={onPlayerClick} />
                            <Section title="Receiving Yards" items={leaders.receivingYards} stat="recYards" label="Yds" onPlayerClick={onPlayerClick} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Section({ title, items, stat, label, onPlayerClick }) {
    return (
        <div className="bg-white mb-2 py-4">
            <div className="px-5 mb-3 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></span>
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
            </div>
            <div className="px-2">
                {items.slice(0, 5).map((p, idx) => (
                    <PlayerRow
                        key={p.id}
                        rank={idx + 1}
                        player={p}
                        stat={stat}
                        label={label}
                        onClick={() => onPlayerClick && onPlayerClick(p)}
                    />
                ))}
            </div>
        </div>
    );
}

function PlayerRow({ rank, player, stat, label, onClick }) {
    let displayVal = stat ? player.stats.season[stat] : null;
    let displayLabel = label;

    if (displayVal === null) {
        if (player.position === 'QB') { displayVal = player.stats.season.yards; displayLabel = 'Yds'; }
        else if (player.position === 'RB') { displayVal = player.stats.season.rushYards; displayLabel = 'Rush'; }
        else if (['WR', 'TE'].includes(player.position)) { displayVal = player.stats.season.recYards; displayLabel = 'Rec'; }
        else { displayVal = player.stats.season.sacks; displayLabel = 'Sacks'; }
    }

    return (
        <div
            onClick={onClick}
            className="flex items-center py-2 px-3 rounded hover:bg-blue-50 cursor-pointer group transition-colors"
        >
            <div className={`w-6 text-center text-xs font-black ${rank === 1 ? 'text-amber-500' : 'text-gray-300 group-hover:text-primary'}`}>
                {rank}
            </div>

            <div className="flex-1 ml-3 overflow-hidden">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-sm truncate">
                        {player.name.split(' ')[0].charAt(0)}. {player.name.split(' ').slice(1).join(' ')}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 px-1.5 bg-gray-100 rounded">{player.position}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium truncate">
                    {player.teamLocation}
                </div>
            </div>

            <div className="text-right pl-4">
                <div className="text-sm font-bold text-ink font-mono">{displayVal?.toLocaleString()}</div>
                <div className="text-[9px] text-gray-300 uppercase tracking-wider">{displayLabel}</div>
            </div>
        </div>
    );
}
