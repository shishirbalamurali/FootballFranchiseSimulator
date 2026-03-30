// Playoff seeding and bracket logic

// Calculate playoff seeds for a conference
export function calculatePlayoffSeeds(standings, conference) {
    const conferenceTeams = standings.filter(t => t.conference === conference);

    // Group by division
    const divisions = ['North', 'South', 'East', 'West'];
    const divisionWinners = [];
    const wildCardPool = [];

    divisions.forEach(div => {
        const divTeams = conferenceTeams
            .filter(t => t.division === div)
            .sort((a, b) => {
                // Sort by wins, then point differential
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.pointDiff - a.pointDiff;
            });

        if (divTeams.length > 0) {
            divisionWinners.push({ ...divTeams[0], isDivWinner: true });
            wildCardPool.push(...divTeams.slice(1));
        }
    });

    // Sort division winners by record
    divisionWinners.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
    });

    // Get 3 wild cards
    wildCardPool.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
    });
    const wildCards = wildCardPool.slice(0, 3).map(t => ({ ...t, isWildCard: true }));

    // Combine and assign seeds
    const seeds = [...divisionWinners, ...wildCards];
    seeds.forEach((team, idx) => {
        team.seed = idx + 1;
    });

    return seeds;
}

// Generate playoff bracket
export function generatePlayoffBracket(standings) {
    const afcSeeds = calculatePlayoffSeeds(standings, 'AFC');
    const nfcSeeds = calculatePlayoffSeeds(standings, 'NFC');

    const bracket = {
        afc: {
            wildCard: [
                { home: afcSeeds[1], away: afcSeeds[6], winner: null },
                { home: afcSeeds[2], away: afcSeeds[5], winner: null },
                { home: afcSeeds[3], away: afcSeeds[4], winner: null }
            ],
            divisional: [
                { home: null, away: null, winner: null }, // Seed 1 vs lowest remaining
                { home: null, away: null, winner: null }  // Other two wild card winners
            ],
            championship: { home: null, away: null, winner: null },
            bye: afcSeeds[0]
        },
        nfc: {
            wildCard: [
                { home: nfcSeeds[1], away: nfcSeeds[6], winner: null },
                { home: nfcSeeds[2], away: nfcSeeds[5], winner: null },
                { home: nfcSeeds[3], away: nfcSeeds[4], winner: null }
            ],
            divisional: [
                { home: null, away: null, winner: null },
                { home: null, away: null, winner: null }
            ],
            championship: { home: null, away: null, winner: null },
            bye: nfcSeeds[0]
        },
        superBowl: { afc: null, nfc: null, winner: null }
    };

    return bracket;
}

// Simulate wild card round and update bracket
export function simulateWildCardRound(bracket, teamRosters, simulateGame) {
    const updated = JSON.parse(JSON.stringify(bracket));

    // AFC Wild Card
    updated.afc.wildCard.forEach(game => {
        const result = simulateGame(
            game.home.id,
            game.away.id,
            teamRosters[game.home.id],
            teamRosters[game.away.id]
        );
        game.result = result;
        game.winner = result.homeScore > result.awayScore ? game.home : game.away;
    });

    // NFC Wild Card
    updated.nfc.wildCard.forEach(game => {
        const result = simulateGame(
            game.home.id,
            game.away.id,
            teamRosters[game.home.id],
            teamRosters[game.away.id]
        );
        game.result = result;
        game.winner = result.homeScore > result.awayScore ? game.home : game.away;
    });

    // Set up divisional round
    setupDivisionalRound(updated.afc);
    setupDivisionalRound(updated.nfc);

    return updated;
}

// Set up divisional round matchups
function setupDivisionalRound(conferenceBracket) {
    const wcWinners = conferenceBracket.wildCard.map(g => g.winner).sort((a, b) => a.seed - b.seed);
    const bye = conferenceBracket.bye;

    // Seed 1 plays lowest remaining seed
    conferenceBracket.divisional[0] = {
        home: bye,
        away: wcWinners[2], // Lowest seed
        winner: null
    };

    // Other two winners play each other
    conferenceBracket.divisional[1] = {
        home: wcWinners[0], // Higher seed gets home field
        away: wcWinners[1],
        winner: null
    };
}

// Simulate divisional round
export function simulateDivisionalRound(bracket, teamRosters, simulateGame) {
    const updated = JSON.parse(JSON.stringify(bracket));

    // AFC Divisional
    updated.afc.divisional.forEach(game => {
        const result = simulateGame(
            game.home.id,
            game.away.id,
            teamRosters[game.home.id],
            teamRosters[game.away.id]
        );
        game.result = result;
        game.winner = result.homeScore > result.awayScore ? game.home : game.away;
    });

    // NFC Divisional
    updated.nfc.divisional.forEach(game => {
        const result = simulateGame(
            game.home.id,
            game.away.id,
            teamRosters[game.home.id],
            teamRosters[game.away.id]
        );
        game.result = result;
        game.winner = result.homeScore > result.awayScore ? game.home : game.away;
    });

    // Set up championship games
    setupChampionshipGames(updated.afc);
    setupChampionshipGames(updated.nfc);

    return updated;
}

// Set up championship games
function setupChampionshipGames(conferenceBracket) {
    const divWinners = conferenceBracket.divisional.map(g => g.winner).sort((a, b) => a.seed - b.seed);

    conferenceBracket.championship = {
        home: divWinners[0], // Higher seed
        away: divWinners[1],
        winner: null
    };
}

// Simulate championship round
export function simulateChampionshipRound(bracket, teamRosters, simulateGame) {
    const updated = JSON.parse(JSON.stringify(bracket));

    // AFC Championship
    const afcResult = simulateGame(
        updated.afc.championship.home.id,
        updated.afc.championship.away.id,
        teamRosters[updated.afc.championship.home.id],
        teamRosters[updated.afc.championship.away.id]
    );
    updated.afc.championship.result = afcResult;
    updated.afc.championship.winner = afcResult.homeScore > afcResult.awayScore
        ? updated.afc.championship.home
        : updated.afc.championship.away;

    // NFC Championship
    const nfcResult = simulateGame(
        updated.nfc.championship.home.id,
        updated.nfc.championship.away.id,
        teamRosters[updated.nfc.championship.home.id],
        teamRosters[updated.nfc.championship.away.id]
    );
    updated.nfc.championship.result = nfcResult;
    updated.nfc.championship.winner = nfcResult.homeScore > nfcResult.awayScore
        ? updated.nfc.championship.home
        : updated.nfc.championship.away;

    // Set up Super Bowl
    updated.superBowl = {
        afc: updated.afc.championship.winner,
        nfc: updated.nfc.championship.winner,
        winner: null
    };

    return updated;
}

// Simulate Super Bowl
export function simulateSuperBowl(bracket, teamRosters, simulateGame) {
    const updated = JSON.parse(JSON.stringify(bracket));

    // Super Bowl (higher seed gets "home" field)
    const afcTeam = updated.superBowl.afc;
    const nfcTeam = updated.superBowl.nfc;

    const result = simulateGame(
        afcTeam.id,
        nfcTeam.id,
        teamRosters[afcTeam.id],
        teamRosters[nfcTeam.id]
    );

    updated.superBowl.result = result;
    updated.superBowl.winner = result.homeScore > result.awayScore ? afcTeam : nfcTeam;

    return updated;
}
