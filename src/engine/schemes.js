// Scheme identity (Claude-owned). Pure functions, zero save bytes.
//
// A team's offensive and defensive scheme comes from its coordinators (see
// staffCareers.js). schemeFit(player, scheme) says how well a player's
// attributes suit that scheme, 0-100. It drives the prospect Fit column, the
// trade and FA "fits our system" readouts, and a small in-game tilt.

export const OFFENSE_SCHEMES = {
    airRaid:     { id: 'airRaid', side: 'offense', name: 'Air Raid', icon: '✈️', blurb: 'Four wide, spread the field, throw early and often.', passTilt: 0.06, deepShots: 0.02 },
    westCoast:   { id: 'westCoast', side: 'offense', name: 'West Coast', icon: '🎯', blurb: 'Timing throws, yards after catch, a QB who processes fast.', passTilt: 0.03, deepShots: -0.01 },
    powerRun:    { id: 'powerRun', side: 'offense', name: 'Power Run', icon: '🦬', blurb: 'Big line, downhill backs, play-action off the run.', passTilt: -0.07, deepShots: 0.01 },
    spreadOption:{ id: 'spreadOption', side: 'offense', name: 'Spread Option', icon: '🌀', blurb: 'Mobile QB, speed in space, make the defense choose.', passTilt: -0.02, deepShots: 0 },
};
export const DEFENSE_SCHEMES = {
    fourThreeOver: { id: 'fourThreeOver', side: 'defense', name: '4-3 Over', icon: '🧱', blurb: 'Four linemen win up front; linebackers run and hit.' },
    threeFour:     { id: 'threeFour', side: 'defense', name: '3-4 Two-Gap', icon: '🪨', blurb: 'Stout nose, edge rushers standing up, disguised pressure.' },
    nickelPress:   { id: 'nickelPress', side: 'defense', name: 'Nickel Press', icon: '🔒', blurb: 'Five DBs in man coverage, jam at the line.' },
    cover2:        { id: 'cover2', side: 'defense', name: 'Cover-2 Zone', icon: '🕸️', blurb: 'Keep it in front, rally and tackle, rangy safeties.' },
};
export const SCHEMES = { ...OFFENSE_SCHEMES, ...DEFENSE_SCHEMES };
export const OFFENSE_IDS = Object.keys(OFFENSE_SCHEMES);
export const DEFENSE_IDS = Object.keys(DEFENSE_SCHEMES);

// Attribute weights per scheme and position. Keys name either universal
// (speed, acceleration, agility, strength, awareness) or position attributes.
const W = {
    airRaid: {
        QB: { accuracy: 3, processing: 2, arm: 2 },
        WR: { speed: 2, routeRun: 2, release: 1, deepThreat: 2 },
        TE: { catching: 3, routeRun: 2, speed: 1 },
        RB: { catching: 3, agility: 1, speed: 1 },
        OL: { passBlock: 3, agility: 1 },
    },
    westCoast: {
        QB: { accuracy: 3, processing: 3, pocket: 1 },
        WR: { routeRun: 3, catching: 2, agility: 2 },
        TE: { catching: 2, routeRun: 2, runBlock: 1 },
        RB: { catching: 2, eff: 2, agility: 1 },
        OL: { passBlock: 2, agility: 2 },
    },
    powerRun: {
        QB: { processing: 2, pocket: 1, arm: 1 },
        WR: { catchInTraffic: 2, strength: 2, catching: 1 },
        TE: { runBlock: 3, passBlock: 1, strength: 1 },
        RB: { vol: 3, gl: 2, strength: 2 },
        OL: { runBlock: 3, impactBlock: 2, strength: 2 },
    },
    spreadOption: {
        QB: { speed: 3, agility: 2, pocket: 1 },
        WR: { speed: 3, agility: 2 },
        TE: { speed: 2, catching: 2 },
        RB: { exp: 3, speed: 2, eff: 1 },
        OL: { runBlock: 2, agility: 2, speed: 1 },
    },
    fourThreeOver: {
        DL: { blockShedding: 2, finesseMoves: 2, speed: 1 },
        LB: { pursuit: 3, tackle: 2, speed: 1 },
        CB: { zoneCoverage: 2, manCoverage: 1, speed: 1 },
        S: { range: 2, tackle: 1, coverage: 1 },
    },
    threeFour: {
        DL: { powerMoves: 3, strength: 2, blockShedding: 1 },
        LB: { blitz: 3, strength: 1, pursuit: 1 },
        CB: { manCoverage: 2, press: 1 },
        S: { tackle: 2, coverage: 1 },
    },
    nickelPress: {
        DL: { finesseMoves: 3, speed: 2 },
        LB: { coverage: 3, speed: 2 },
        CB: { manCoverage: 3, press: 3, speed: 1 },
        S: { coverage: 2, ballSkills: 2, speed: 1 },
    },
    cover2: {
        DL: { blockShedding: 2, tackle: 1 },
        LB: { coverage: 2, tackle: 2, pursuit: 1 },
        CB: { zoneCoverage: 3, tackle: 1, ballSkills: 1 },
        S: { range: 3, ballSkills: 2 },
    },
};

const attr = (p, key) => p?.attributes?.position?.[key] ?? p?.attributes?.universal?.[key];

/** 0-100 fit of a player to a scheme. Positions a scheme doesn't weigh score 70. */
export function schemeFit(player, schemeId) {
    const weights = W[schemeId]?.[player?.position];
    if (!weights) return 70;
    let sum = 0, total = 0;
    for (const [k, w] of Object.entries(weights)) {
        const v = attr(player, k);
        if (v == null) continue;
        sum += v * w; total += w;
    }
    if (!total) return 70;
    // Relative to the player's own OVR: fit is about shape, not quality.
    const shape = sum / total - (player.ovr || 70);
    return Math.max(0, Math.min(100, Math.round(70 + shape * 2.2)));
}

export const fitLabel = f => f >= 85 ? 'Ideal fit' : f >= 72 ? 'Good fit' : f >= 58 ? 'Workable' : 'Poor fit';

/** The side of the ball a position plays. */
export const sideOf = pos => (['QB', 'RB', 'WR', 'TE', 'OL'].includes(pos) ? 'offense' : ['DL', 'LB', 'CB', 'S'].includes(pos) ? 'defense' : null);

/** Fit of a player to a team identity { offense, defense }. */
export function teamFit(player, identity) {
    const side = sideOf(player?.position);
    if (!side || !identity) return 70;
    return schemeFit(player, identity[side]);
}

/** Share of a roster's likely starters who fit a scheme at 72+. */
export function rosterFitShare(roster = [], schemeId) {
    const side = SCHEMES[schemeId]?.side;
    const starters = { offense: { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5 }, defense: { DL: 4, LB: 3, CB: 2, S: 2 } }[side] || {};
    let fits = 0, n = 0;
    for (const [pos, count] of Object.entries(starters)) {
        const top = roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr).slice(0, count);
        for (const p of top) { n++; if (schemeFit(p, schemeId) >= 72) fits++; }
    }
    return n ? fits / n : 0;
}
