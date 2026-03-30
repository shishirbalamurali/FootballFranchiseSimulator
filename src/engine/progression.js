// Player progression and regression system

import { PEAK_AGES, calculateOVR } from './player.js';

// Weekly progression (small changes)
export function applyWeeklyProgression(player) {
    const peakAge = PEAK_AGES[player.position];
    const clone = { ...player, attributes: { ...player.attributes } };

    // Calculate progression direction
    let progressionRate = 0;

    if (player.age < peakAge) {
        // Young player - progress toward POT
        const gap = player.pot - player.ovr;
        progressionRate = gap * 0.02; // 2% of gap per week

        // Dev trait modifier
        if (player.devTrait === 'Superstar') progressionRate *= 2.0;
        else if (player.devTrait === 'Star') progressionRate *= 1.5;
        else if (player.devTrait === 'Slow') progressionRate *= 0.5;
    } else if (player.age > peakAge + 2) {
        // Veteran - slight decline
        const yearsOverPeak = player.age - peakAge;
        progressionRate = -0.1 * yearsOverPeak; // Accelerating decline
    }

    // Personality trait effects
    if (player.personality === 'BoomBust') {
        // Larger swings
        progressionRate *= (Math.random() < 0.5 ? 1.5 : 0.5);
    }

    // Apply small random variance
    const variance = (Math.random() - 0.5) * 0.3;
    progressionRate += variance;

    // Update OVR (very small weekly changes)
    clone.ovr = Math.max(40, Math.min(99, Math.round(player.ovr + progressionRate)));
    clone.ovrHistory.push(clone.ovr);

    // Keep only last 10 weeks of history
    if (clone.ovrHistory.length > 10) {
        clone.ovrHistory = clone.ovrHistory.slice(-10);
    }

    return clone;
}

// Offseason progression (bigger changes)
export function applyOffseasonProgression(player) {
    const peakAge = PEAK_AGES[player.position];
    const clone = { ...player };

    clone.age += 1;
    clone.experience += 1;

    // Calculate progression
    let progressionChange = 0;

    if (clone.age < peakAge) {
        // Young player - bigger gains
        const gap = player.pot - player.ovr;
        progressionChange = gap * 0.15; // 15% of gap

        // Dev trait modifier
        if (player.devTrait === 'Superstar') progressionChange *= 1.8;
        else if (player.devTrait === 'Star') progressionChange *= 1.4;
        else if (player.devTrait === 'Slow') progressionChange *= 0.6;

        // Training camp bump for rookies
        if (player.experience === 0) {
            progressionChange += Math.random() * 3;
        }
    } else if (clone.age > peakAge) {
        // Decline phase
        const yearsOverPeak = clone.age - peakAge;
        progressionChange = -0.5 - (yearsOverPeak * 0.3);

        // Some positions decline faster
        if (['RB', 'CB'].includes(player.position)) {
            progressionChange *= 1.3;
        }
    }

    clone.ovr = Math.max(40, Math.min(99, Math.round(player.ovr + progressionChange)));
    clone.ovrHistory.push(clone.ovr);

    // Adjust POT for older players
    if (clone.age > peakAge + 3) {
        clone.pot = Math.min(clone.pot, clone.ovr);
    }

    return clone;
}

// Injury system
export function checkInjury(player) {
    const injuryRoll = Math.random() * 100;
    const injuryThreshold = 100 - player.attributes.universal.durability;

    if (injuryRoll < injuryThreshold) {
        return {
            injured: true,
            weeksOut: Math.floor(Math.random() * 4) + 1 // 1-4 weeks
        };
    }

    return { injured: false, weeksOut: 0 };
}

// Morale system (simplified)
export function updateMorale(player, teamRecord, personalPerformance = 0) {
    let morale = player.morale || 75;

    // Team success affects morale
    const winPct = teamRecord.wins / (teamRecord.wins + teamRecord.losses);
    if (winPct > 0.7) morale += 2;
    else if (winPct < 0.3) morale -= 2;

    // Personal performance
    morale += personalPerformance; // -5 to +5

    // Personality effects
    if (player.personality === 'Leader') morale += 1;
    else if (player.personality === 'Hothead' && winPct < 0.5) morale -= 2;

    return Math.max(30, Math.min(100, morale));
}
