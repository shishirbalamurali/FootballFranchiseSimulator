// Logic to calculate season awards

// Logic to calculate season awards

// Helper: Score Calculations
const calculateMVPScore = (p) => {
    if (!p.stats || !p.stats.season) return 0;
    const s = p.stats.season;
    let score = 0;

    if (p.position === 'QB') {
        score += (s.yards || 0) / 20; // Combined yards
        score += (s.tds || 0) * 6; // Combined TDs
        score -= (s.ints || 0) * 4;
        score += ((s.wins || 0) * 10); // QB Wins matter
    } else if (p.position === 'RB') {
        score += (s.yards || 0) / 10;
        score += (s.tds || 0) * 6;
    } else if (p.position === 'WR' || p.position === 'TE') {
        score += (s.yards || 0) / 10;
        score += (s.tds || 0) * 6;
    } else {
        score += (s.sacks || 0) * 4;
        score += (s.ints || 0) * 6;
        score += (s.tackles || 0);
    }
    return score;
};

const calculateOPOYScore = (p) => {
    if (!p.stats || !p.stats.season) return 0;
    const s = p.stats.season;
    let score = 0;
    score += (s.yards || 0) / 25;
    score += (s.tds || 0) * 4;
    return score;
};

const calculateDPOYScore = (p) => {
    if (['QB', 'RB', 'WR', 'TE', 'OL', 'K', 'P'].includes(p.position)) return 0;
    if (!p.stats || !p.stats.season) return 0;
    const s = p.stats.season;
    let score = 0;
    score += (s.sacks || 0) * 5;
    score += (s.ints || 0) * 6;
    score += (s.tackles || 0) * 1;
    return score;
};

export const getAwardRaces = (rosters, teams) => {
    // Flatten all players
    let allPlayers = [];
    Object.keys(rosters).forEach(teamId => {
        const teamRoster = rosters[teamId];
        const team = teams.find(t => t.id === teamId);
        teamRoster.forEach(p => {
            allPlayers.push({ ...p, teamId, teamLocation: team?.location || teamId, teamTheme: team?.theme });
        });
    });

    const mvp = [...allPlayers].sort((a, b) => calculateMVPScore(b) - calculateMVPScore(a)).slice(0, 5);
    const opoy = allPlayers.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position))
        .sort((a, b) => calculateOPOYScore(b) - calculateOPOYScore(a)).slice(0, 5);
    const dpoy = allPlayers.filter(p => !['QB', 'RB', 'WR', 'TE', 'OL', 'K', 'P'].includes(p.position))
        .sort((a, b) => calculateDPOYScore(b) - calculateDPOYScore(a)).slice(0, 5);

    return { mvp, opoy, dpoy };
};

export const getTopPlayers = (rosters, teams) => {
    let allPlayers = [];
    Object.keys(rosters).forEach(teamId => {
        const teamRoster = rosters[teamId];
        const team = teams.find(t => t.id === teamId);
        teamRoster.forEach(p => {
            allPlayers.push({ ...p, teamId, teamLocation: team?.location || teamId, teamTheme: team?.theme });
        });
    });
    return allPlayers.sort((a, b) => b.ovr - a.ovr).slice(0, 10);
};

export const getStatLeaders = (rosters, teams) => {
    let allPlayers = [];
    Object.keys(rosters).forEach(teamId => {
        const teamRoster = rosters[teamId];
        const team = teams.find(t => t.id === teamId);
        teamRoster.forEach(p => {
            // Ensure stats exist
            if (p.stats && p.stats.season) {
                allPlayers.push({ ...p, teamId, teamLocation: team?.location || teamId });
            }
        });
    });

    // Sorts
    const passingYards = allPlayers.filter(p => p.position === 'QB').sort((a, b) => b.stats.season.yards - a.stats.season.yards).slice(0, 5);
    const rushingYards = allPlayers.sort((a, b) => b.stats.season.rushYards - a.stats.season.rushYards).slice(0, 5);
    const receivingYards = allPlayers.sort((a, b) => b.stats.season.recYards - a.stats.season.recYards).slice(0, 5);
    const sacks = allPlayers.sort((a, b) => b.stats.season.sacks - a.stats.season.sacks).slice(0, 5);
    const ints = allPlayers.sort((a, b) => b.stats.season.ints - a.stats.season.ints).slice(0, 5);

    return { passingYards, rushingYards, receivingYards, sacks, ints };
}

export const calculateSeasonAwards = (rosters, teams) => {
    const races = getAwardRaces(rosters, teams);
    return {
        mvp: races.mvp[0],
        opoy: races.opoy[0],
        dpoy: races.dpoy[0]
    };
};
