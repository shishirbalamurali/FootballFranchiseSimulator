// Season awards & stat leaders
//
// Defensive positions only count defensive stats — QB sacks taken and QB
// interceptions THROWN share stat keys with defensive sacks/INTs, so every
// leaderboard here filters by position before sorting.

const DEFENSIVE_POSITIONS = new Set(['DL', 'DE', 'DT', 'LB', 'OLB', 'MLB', 'CB', 'S', 'FS', 'SS', 'DB']);
const isDefender = (p) => DEFENSIVE_POSITIONS.has(p.position);

// Flatten rosters once into [{...player, teamId, teamLocation, teamTheme}]
function flattenRosters(rosters, teams) {
    const teamById = new Map(teams.map(t => [t.id, t]));
    const all = [];
    Object.keys(rosters).forEach(teamId => {
        const team = teamById.get(teamId);
        (rosters[teamId] || []).forEach(p => {
            all.push({ ...p, teamId, teamLocation: team?.location || teamId, teamTheme: team?.theme });
        });
    });
    return all;
}

const season = (p) => p.stats?.season || {};

// ── Award score formulas ──────────────────────────────────────────────────────

// MVP — heavily QB-driven like the real award, but a 2,000-yard rusher or a
// 25-sack edge can crash the race. Team wins matter for QBs.
const calculateMVPScore = (p, standings = null) => {
    const s = season(p);
    let score = 0;

    if (p.position === 'QB') {
        const att = s.attempts || 0;
        if (att < 100) return 0; // backups don't win MVP
        const cmpPct = att > 0 ? (s.completions || 0) / att : 0;
        score += (s.yards || 0) / 18;            // passing volume
        score += (s.tds || 0) * 5.5;             // total TDs (pass + rush)
        score -= (s.ints || 0) * 5;
        score += (s.rushYards || 0) / 14;        // dual-threat bonus
        score += Math.max(0, cmpPct - 0.60) * 250; // efficiency above 60%
        const wins = standings?.[p.teamId]?.wins || 0;
        score += wins * 7;                       // QB wins drive the narrative
    } else if (p.position === 'RB') {
        score += ((s.rushYards || 0) + (s.recYards || 0)) / 11;
        score += ((s.rushTds || 0) + (s.recTds || 0)) * 6;
        score -= (s.fumbles || 0) * 4;
    } else if (p.position === 'WR' || p.position === 'TE') {
        score += (s.recYards || 0) / 11;
        score += (s.recTds || 0) * 6;
        score += (s.receptions || 0) * 0.3;
    } else if (isDefender(p)) {
        // Defensive MVPs are rare — require a monster season
        score += (s.sacks || 0) * 4.5;
        score += (s.ints || 0) * 5;
        score += (s.defensiveTds || 0) * 8;
        score += (s.tackles || 0) * 0.25;
        score *= 0.8;
    }
    return score;
};

const calculateOPOYScore = (p) => {
    const s = season(p);
    let score = 0;
    score += ((s.rushYards || 0) + (s.recYards || 0)) / 10;
    score += ((s.rushTds || 0) + (s.recTds || 0)) * 6;
    score += (s.receptions || 0) * 0.35;
    score -= (s.fumbles || 0) * 4;
    return score;
};

const calculateDPOYScore = (p) => {
    if (!isDefender(p)) return 0;
    const s = season(p);
    let score = 0;
    score += (s.sacks || 0) * 7;
    score += (s.ints || 0) * 8;
    score += (s.tfl || 0) * 2;
    score += (s.pd || 0) * 1.5;
    score += (s.tackles || 0) * 0.6;
    score += (s.defensiveTds || 0) * 10;
    return score;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const getAwardRaces = (rosters, teams, standings = null) => {
    const allPlayers = flattenRosters(rosters, teams);

    const mvp = allPlayers
        .map(p => ({ p, score: calculateMVPScore(p, standings) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5).map(x => x.p);

    const opoy = allPlayers
        .filter(p => ['RB', 'WR', 'TE'].includes(p.position))
        .map(p => ({ p, score: calculateOPOYScore(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5).map(x => x.p);

    const dpoy = allPlayers
        .filter(isDefender)
        .map(p => ({ p, score: calculateDPOYScore(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5).map(x => x.p);

    return { mvp, opoy, dpoy };
};

export const getTopPlayers = (rosters, teams) => {
    return flattenRosters(rosters, teams)
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, 10);
};

export const getStatLeaders = (rosters, teams) => {
    const allPlayers = flattenRosters(rosters, teams).filter(p => p.stats?.season);

    const top5 = (pool, key) =>
        [...pool].sort((a, b) => (season(b)[key] || 0) - (season(a)[key] || 0)).slice(0, 5);

    const qbs       = allPlayers.filter(p => p.position === 'QB');
    const defenders = allPlayers.filter(isDefender);

    return {
        passingYards:   top5(qbs, 'yards'),
        passingTds:     top5(qbs, 'tds'),
        rushingYards:   top5(allPlayers, 'rushYards'),
        receivingYards: top5(allPlayers, 'recYards'),
        receptions:     top5(allPlayers, 'receptions'),
        sacks:          top5(defenders, 'sacks'),
        ints:           top5(defenders, 'ints'),
        tackles:        top5(defenders, 'tackles'),
    };
};

export const calculateSeasonAwards = (rosters, teams, standings = null) => {
    const races = getAwardRaces(rosters, teams, standings);
    return {
        mvp: races.mvp[0],
        opoy: races.opoy[0],
        dpoy: races.dpoy[0],
    };
};
