import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ovrToGrade } from './ui';


// Filling a position of need is worth roughly half a grade.
function getGrade(ovr, positionNeed) {
    return ovrToGrade(ovr + (positionNeed ? 5 : 0));
}

export default function DraftPickPopup({ player, pickNumber, teamTheme, positionNeed, onComplete }) {
    const [progress, setProgress] = useState(0);
    const completed = useRef(false);

    useEffect(() => {
        completed.current = false;
        const interval = setInterval(() => {
            setProgress(p => {
                const next = p + (100 / 18); // 1.8 seconds
                if (next >= 100) {
                    clearInterval(interval);
                    if (!completed.current) {
                        completed.current = true;
                        setTimeout(() => { if (onComplete) onComplete(); }, 0);
                    }
                    return 100;
                }
                return next;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [onComplete]);

    const grade = getGrade(player.ovr, positionNeed);
    const primary = teamTheme?.primary || 'var(--team-primary)';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 40, rotate: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: -1.5 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className="fixed bottom-6 right-6 z-40 w-80"
        >
            <div className="overflow-hidden rounded-panel bg-surface-raised shadow-3">
                {/* Header — printed in the drafting team's colours */}
                <div
                    style={{ backgroundColor: primary }}
                    className="relative border-b-[3px] border-ink p-4"
                >
                    <div aria-hidden="true" className="toon-halftone absolute inset-0 text-ink opacity-50" />
                    <div className="relative mb-2 flex items-center justify-between">
                        <span className="toon-sticker text-h3 uppercase">Pick #{pickNumber}</span>
                        <span className="rounded-full bg-ink px-2 py-0.5 text-micro text-nav-fg">{player.position}</span>
                    </div>
                    <h3 className="toon-title relative truncate py-1 font-display text-[34px] uppercase leading-none text-chalk">{player.name}</h3>
                </div>

                <div className="space-y-3 p-4">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-micro uppercase text-fg-faint">Overall</p>
                            <p className="font-display text-hero leading-none tabular-nums text-fg">{player.ovr}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-micro uppercase text-fg-faint">Grade</p>
                            <p className="font-display text-display leading-none" style={{ color: grade.color }}>
                                {grade.letter}
                            </p>
                        </div>
                    </div>

                    {positionNeed && (
                        <p className="rounded-card border-2 border-positive-border bg-positive-bg px-3 py-2 text-micro uppercase text-positive-fg">
                            ✓ Fills a position of need
                        </p>
                    )}

                    <div className="h-3 overflow-hidden rounded-full bg-surface-sunken toon-outline">
                        <div
                            className="toon-stripes h-full border-r-2 border-ink"
                            style={{ width: `${progress}%`, backgroundColor: primary }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
