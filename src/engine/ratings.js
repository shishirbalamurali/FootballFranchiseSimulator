// Team rating calculations from roster

import { POSITIONS } from './player.js';

// Calculate team ratings by unit
export function calculateTeamRatings(roster) {
    const ratings = {
        offense: {
            qb: 0,
            ol: 0,
            skill: 0,
            overall: 0
        },
        defense: {
            front7: 0,
            secondary: 0,
            overall: 0
        },
        specialTeams: 0,
        overall: 0
    };

    // QB rating (top QB)
    const qbs = roster.filter(p => p.position === 'QB').sort((a, b) => Number(!!b.weeklyStarter) - Number(!!a.weeklyStarter) || b.ovr - a.ovr);
    ratings.offense.qb = qbs[0]?.ovr || 60;

    // OL rating (top 5 OL weighted)
    const ols = roster.filter(p => p.position === 'OL').sort((a, b) => b.ovr - a.ovr).slice(0, 5);
    ratings.offense.ol = calculateWeightedAverage(pad(ols, 5));

    // Skill rating (RB, WR, TE weighted)
    const rbs = roster.filter(p => p.position === 'RB').sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    const wrs = roster.filter(p => p.position === 'WR').sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const tes = roster.filter(p => p.position === 'TE').sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    ratings.offense.skill = calculateWeightedAverage([...pad(rbs, 2), ...pad(wrs, 3), ...pad(tes, 2)]);

    // Front 7 (DL + LB)
    const dls = roster.filter(p => p.position === 'DL').sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    const lbs = roster.filter(p => p.position === 'LB').sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    ratings.defense.front7 = calculateWeightedAverage([...pad(dls, 4), ...pad(lbs, 3)]);

    // Secondary (CB + S)
    const cbs = roster.filter(p => p.position === 'CB').sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const safeties = roster.filter(p => p.position === 'S').sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    ratings.defense.secondary = calculateWeightedAverage([...pad(cbs, 3), ...pad(safeties, 2)]);

    // Technique relative to OVR preserves the rating scale while allowing two
    // equally rated units to have different matchup strengths. Each starting
    // lineman contributes equally; a single star cannot hide four weak links.
    const technique = (players, slots, base, keys) => {
        const deltas = players.map(p => {
            const attrs = p.attributes?.position || {};
            const values = keys.map(k => attrs[k]).filter(Number.isFinite);
            return values.length ? values.reduce((a,b)=>a+b,0) / values.length - p.ovr : 0;
        });
        return Math.max(40, Math.min(99, base + deltas.reduce((a,b)=>a+b,0) / slots));
    };
    ratings.offense.passBlock = technique(ols, 5, ratings.offense.ol, ['passBlock']);
    ratings.offense.runBlock = technique(ols, 5, ratings.offense.ol, ['runBlock']);
    ratings.defense.passRush = technique(dls, 4, ratings.defense.front7, ['finesseMoves','powerMoves']);
    ratings.defense.runDefense = technique([...dls,...lbs], 7, ratings.defense.front7, ['tackle','blockShedding','pursuit']);

    // Special teams (K)
    const kicker = roster.find(p => p.position === 'K');
    ratings.specialTeams = kicker?.ovr || 60;

    // Overall ratings
    ratings.offense.overall = Math.round(
        (ratings.offense.qb * 0.4 + ratings.offense.ol * 0.35 + ratings.offense.skill * 0.25)
    );

    ratings.defense.overall = Math.round(
        (ratings.defense.front7 * 0.5 + ratings.defense.secondary * 0.5)
    );

    ratings.overall = Math.round(
        (ratings.offense.overall * 0.45 + ratings.defense.overall * 0.45 + ratings.specialTeams * 0.1)
    );

    return ratings;
}

// A starting slot nobody fills is played by a replacement-level body. Without
// this, one 99 OVR lineman rated the same as five of them, so shedding depth
// cost nothing.
const REPLACEMENT_OVR = 45;
const pad = (players, slots) => {
    const ovrs = players.map(p => p.ovr);
    while (ovrs.length < slots) ovrs.push(REPLACEMENT_OVR);
    return ovrs;
};

// Calculate weighted average (higher weight for top players)
function calculateWeightedAverage(values) {
    if (values.length === 0) return 60;

    let sum = 0;
    let weights = 0;

    values.forEach((val, idx) => {
        const weight = 1.0 / (idx + 1); // First player gets weight 1, second 0.5, third 0.33, etc.
        sum += val * weight;
        weights += weight;
    });

    return Math.round(sum / weights);
}

// Get best players by position for display
export function getBestPlayersByPosition(roster) {
    const best = {};

    Object.values(POSITIONS).forEach(pos => {
        const players = roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr);
        best[pos] = players.slice(0, 3); // Top 3
    });

    return best;
}

// Get starters
export function getStarters(roster) {
    const starters = [];

    const positionNeeds = {
        QB: 1,
        RB: 2,
        WR: 3,
        TE: 1,
        OL: 5,
        DL: 4,
        LB: 3,
        CB: 2,
        S: 2,
        K: 1
    };

    Object.entries(positionNeeds).forEach(([pos, count]) => {
        const players = roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr);
        starters.push(...players.slice(0, count));
    });

    return starters;
}
