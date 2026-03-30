// Draft system - prospect generation and CPU drafting

import { generatePlayer, POSITIONS } from './player.js';

// Generate a draft class (7 rounds x 32 picks = 224 players)
export function generateDraftClass() {
    const prospects = [];
    const totalPicks = 224;

    // Position distribution (realistic)
    const positionDistribution = {
        QB: 0.08,  // ~18 QBs
        RB: 0.10,  // ~22 RBs
        WR: 0.15,  // ~34 WRs
        TE: 0.08,  // ~18 TEs
        OL: 0.18,  // ~40 OL
        DL: 0.15,  // ~34 DL
        LB: 0.12,  // ~27 LBs
        CB: 0.10,  // ~22 CBs
        S: 0.10,   // ~22 Ss
        K: 0.04    // ~9 Ks
    };

    // OVR distribution
    // Rounds 1-2: Higher OVR
    // Rounds 3-5: Mid OVR
    // Rounds 6-7: Lower OVR
    const roundRanges = [
        { min: 75, max: 90, count: 64 },  // Rounds 1-2
        { min: 68, max: 80, count: 96 },  // Rounds 3-5
        { min: 55, max: 72, count: 64 }   // Rounds 6-7
    ];

    roundRanges.forEach(range => {
        const positions = Object.keys(positionDistribution);

        for (let i = 0; i < range.count; i++) {
            // Select position based on distribution
            const roll = Math.random();
            let cumulative = 0;
            let selectedPos = positions[0];

            for (const [pos, prob] of Object.entries(positionDistribution)) {
                cumulative += prob;
                if (roll < cumulative) {
                    selectedPos = pos;
                    break;
                }
            }

            // Generate prospect
            const targetOvr = Math.floor(range.min + Math.random() * (range.max - range.min));
            const prospect = generatePlayer(selectedPos, targetOvr, 22); // All prospects are 22 years old
            prospect.draftStatus = 'available';
            prospect.grade = calculateDraftGrade(prospect);

            prospects.push(prospect);
        }
    });

    // Sort by grade
    prospects.sort((a, b) => b.grade - a.grade);

    // Assign draft rankings
    prospects.forEach((p, idx) => {
        p.draftRank = idx + 1;
    });

    return prospects;
}

// Calculate draft grade (different from OVR - includes potential)
function calculateDraftGrade(player) {
    return Math.round(player.ovr * 0.75 + player.pot * 0.25);
}

// CPU draft decision
export function cpuMakePick(roster, availableProspects, teamNeeds) {
    // Calculate need scores for each position
    const needScores = calculatePositionNeeds(roster);

    // Score each available prospect
    const scoredProspects = availableProspects.map(prospect => {
        const valueScore = prospect.grade;
        const needScore = needScores[prospect.position] || 0;
        const scarcityScore = calculateScarcity(prospect.position, availableProspects);

        // Overall score
        const totalScore = valueScore * 0.5 + needScore * 0.3 + scarcityScore * 0.2;

        // Add randomness (10-15% variance)
        const variance = totalScore * (Math.random() * 0.15);

        return {
            prospect,
            score: totalScore + variance
        };
    });

    // Sort by score
    scoredProspects.sort((a, b) => b.score - a.score);

    // Occasional reach (10% chance to pick from top 5 instead of #1)
    if (Math.random() < 0.1 && scoredProspects.length > 5) {
        const topFive = scoredProspects.slice(0, 5);
        return topFive[Math.floor(Math.random() * topFive.length)].prospect;
    }

    return scoredProspects[0].prospect;
}

// Calculate position needs based on roster
export function calculatePositionNeeds(roster) {
    const needs = {};

    const idealCounts = {
        QB: { starters: 1, depth: 3, starterOvr: 75 },
        RB: { starters: 2, depth: 4, starterOvr: 72 },
        WR: { starters: 3, depth: 6, starterOvr: 73 },
        TE: { starters: 1, depth: 3, starterOvr: 70 },
        OL: { starters: 5, depth: 8, starterOvr: 72 },
        DL: { starters: 4, depth: 6, starterOvr: 72 },
        LB: { starters: 3, depth: 6, starterOvr: 71 },
        CB: { starters: 2, depth: 5, starterOvr: 73 },
        S: { starters: 2, depth: 4, starterOvr: 71 },
        K: { starters: 1, depth: 1, starterOvr: 68 }
    };

    Object.entries(idealCounts).forEach(([pos, ideal]) => {
        const positionPlayers = roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr);
        const starters = positionPlayers.slice(0, ideal.starters);

        let needScore = 50; // Base need

        // Count deficit
        if (positionPlayers.length < ideal.depth) {
            needScore += (ideal.depth - positionPlayers.length) * 10;
        }

        // Starter quality deficit
        const avgStarterOvr = starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length;
        if (avgStarterOvr < ideal.starterOvr) {
            needScore += (ideal.starterOvr - avgStarterOvr) * 2;
        }

        // Age concern (old starters increase need)
        const oldStarters = starters.filter(p => p.age > 30).length;
        needScore += oldStarters * 15;

        needs[pos] = Math.min(100, needScore);
    });

    return needs;
}

// Calculate scarcity (fewer players at position = higher scarcity)
function calculateScarcity(position, availableProspects) {
    const positionProspects = availableProspects.filter(p => p.position === position);
    const highGradeProspects = positionProspects.filter(p => p.grade >= 75);

    if (highGradeProspects.length === 0) return 100; // Very scarce
    if (highGradeProspects.length === 1) return 80;
    if (highGradeProspects.length === 2) return 60;
    if (highGradeProspects.length <= 4) return 40;
    return 20; // Plentiful
}

// Get best fits for user (combines value + need)
export function getBestFits(roster, availableProspects, count = 5) {
    const needScores = calculatePositionNeeds(roster);

    const scored = availableProspects.map(prospect => {
        const valueScore = prospect.grade;
        const needScore = needScores[prospect.position] || 0;
        const fitScore = valueScore * 0.6 + needScore * 0.4;

        return { prospect, fitScore };
    });

    scored.sort((a, b) => b.fitScore - a.fitScore);
    return scored.slice(0, count).map(s => s.prospect);
}
