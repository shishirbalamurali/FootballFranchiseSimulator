
// Logic to analyze weekly results and generate news headlines

export const generateWeeklyHeadlines = (weekResults, teams) => {
    const headlines = [];

    if (!weekResults || weekResults.length === 0) return [];

    // 1. GAME OF THE WEEK
    // Criteria: Smallest point differential + High total score
    let bestGame = null;
    let highestExcitementScore = -1;

    weekResults.forEach(game => {
        if (!game.result) return;
        const diff = Math.abs(game.homeScore - game.awayScore);
        const total = game.homeScore + game.awayScore;
        // Formula: closer game is better (inv diff), higher score is better
        // Add 1 to diff to avoid div by zero
        const excitement = (total * 1.5) - (diff * 5);

        if (excitement > highestExcitementScore) {
            highestExcitementScore = excitement;
            bestGame = game;
        }
    });

    if (bestGame) {
        const homeTeam = teams.find(t => t.id === bestGame.homeTeamId);
        const awayTeam = teams.find(t => t.id === bestGame.awayTeamId);
        const winner = bestGame.homeScore > bestGame.awayScore ? homeTeam : awayTeam;
        const loser = bestGame.homeScore > bestGame.awayScore ? awayTeam : homeTeam;
        const wScore = Math.max(bestGame.homeScore, bestGame.awayScore);
        const lScore = Math.min(bestGame.homeScore, bestGame.awayScore);

        headlines.push({
            type: 'GAME_OF_WEEK',
            title: 'Game of the Week',
            headline: `${winner.location} Edges Out ${loser.location}`,
            subtext: `A Thriller! Final score ${wScore}-${lScore} in a matchup for the ages.`
        });
    }

    // 2. BEST PLAYER PERFORMANCE (Skill Position)
    // We need to parse all player stats from the results
    let bestPlayer = null;
    let bestPlayerScore = -1;
    let bestPlayerStatLine = '';

    weekResults.forEach(game => {
        if (!game.result) return;
        const allStats = [
            ...Object.values(game.result.homePlayerStats || {}),
            ...Object.values(game.result.awayPlayerStats || {})
        ];

        allStats.forEach(statEntry => {
            const p = statEntry.player;
            if (!p) return;
            // Simple Fantasy-ish score for news
            // QB: 1pt/25yd, 4pt/TD
            // RB/WR/TE: 1pt/10yd, 6pt/TD
            let score = 0;
            let summary = '';

            if (p.position === 'QB') {
                const yds = statEntry.yards || 0;
                const tds = statEntry.tds || 0;
                score = (yds / 25) + (tds * 4);
                summary = `${yds} yds, ${tds} TDs`;
            } else if (['RB', 'WR', 'TE'].includes(p.position)) {
                const yds = (statEntry.yards || 0); // rush + rec included? usually simulation returns 'yards' as main stat
                // simulation.js usually separates rushYards/recYards but let's assume 'yards' aggregate or check specifics
                // If checking gameStore logic: it merges stats? No, it just stores what simulation returns.
                // Let's assume 'yards' is the primary key for the main stat.
                const tds = (statEntry.tds || 0);
                score = (yds / 10) + (tds * 6);
                summary = `${yds} yds, ${tds} TDs`;
            } else {
                // Defense
                const sacks = statEntry.sacks || 0;
                const ints = statEntry.ints || 0;
                score = (sacks * 5) + (ints * 7);
                summary = `${sacks} sacks, ${ints} INTs`;
            }

            if (score > bestPlayerScore) {
                bestPlayerScore = score;
                bestPlayer = p;
                bestPlayerStatLine = summary;
            }
        });
    });

    if (bestPlayer) {
        headlines.push({
            type: 'PLAYER_WEEK',
            title: 'Player of the Week',
            headline: `${bestPlayer.name} Dominates`,
            subtext: `${bestPlayer.position} puts up ${bestPlayerStatLine} in a massive performance.`
        });
    }

    // 3. BEST QB PERFORMANCE
    // Specifically verify QBs
    let bestQB = null;
    let bestQBScore = -1;
    let bestQBLine = '';

    weekResults.forEach(game => {
        if (!game.result) return;
        const allStats = [
            ...Object.values(game.result.homePlayerStats || {}),
            ...Object.values(game.result.awayPlayerStats || {})
        ];

        allStats.forEach(statEntry => {
            const p = statEntry.player;
            if (p?.position !== 'QB') return;

            const yds = statEntry.yards || 0;
            const tds = statEntry.tds || 0;
            const score = (yds / 20) + (tds * 6); // Slightly different weighting to favor TDs more

            if (score > bestQBScore && p.id !== bestPlayer?.id) { // Don't duplicate if QB was overall player
                bestQBScore = score;
                bestQB = p;
                bestQBLine = `${yds} yds, ${tds} TDs`;
            }
        });
    });

    if (bestQB) {
        headlines.push({
            type: 'QB_WEEK',
            title: 'Air Player of the Week',
            headline: `${bestQB.name} Airs it Out`,
            subtext: `Torched the defense for ${bestQBLine}.`
        });
    }

    // Fallback if we accidentally filtered everyone out
    if (headlines.length === 0) {
        headlines.push({
            type: 'GENERIC',
            title: 'League Update',
            headline: 'Another week in the books',
            subtext: 'Check the standings for the latest playoff picture.'
        });
    }

    return headlines;
};
