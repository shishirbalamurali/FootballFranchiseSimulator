// NFL-Style Schedule Generator
import { DIVISIONS, CONFERENCES, getTeamsByDivision, getTeamsByConference } from '../data/teams';

// Rotation cycles (simplified based on year)
const CONFERENCE_DIV_ROTATION = {
    AFC: [
        [['North', 'South'], ['East', 'West']], // Year 1 pairs
        [['North', 'East'], ['South', 'West']], // Year 2 pairs
        [['North', 'West'], ['South', 'East']]  // Year 3 pairs
    ],
    NFC: [
        [['North', 'South'], ['East', 'West']],
        [['North', 'East'], ['South', 'West']],
        [['North', 'West'], ['South', 'East']]
    ]
};

// Helper to shuffle array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function generateSeasonSchedule(teams, year) {
    // We'll organize specific games first, then slot them into weeks
    const matchups = [];

    // Track games per team to ensure we hit 17
    const teamGames = {};
    teams.forEach(t => teamGames[t.id] = 0);

    // 1. Division Games (6 games: H/A vs 3 opponents)
    teams.forEach(team => {
        const divOpponents = getTeamsByDivision(team.conference, team.division).filter(t => t.id !== team.id);
        divOpponents.forEach(opp => {
            // Add if this match (in this direction) doesn't exist yet
            // Actually, let's just add one-way and double it? 
            // No, safer to check unique pairs
            const pairId = [team.id, opp.id].sort().join('-');
            // We need TWO games (H and A). So we can check if we've added H vs A specifically
            const h_vs_a = matchups.find(m => m.home.id === team.id && m.away.id === opp.id);
            if (!h_vs_a) {
                matchups.push({ home: team, away: opp, type: 'div', id: `div-${team.id}-${opp.id}` });
                teamGames[team.id]++;
                teamGames[opp.id]++;
            }
        });
    });

    // 2. Intra-conference Division (4 games)
    // Determine opponent division based on year rotation
    ['AFC', 'NFC'].forEach(conf => {
        const pairs = CONFERENCE_DIV_ROTATION[conf][year % 3] || CONFERENCE_DIV_ROTATION[conf][0];
        pairs.forEach(([divA, divB]) => {
            const teamsA = getTeamsByDivision(conf, divA);
            const teamsB = getTeamsByDivision(conf, divB);

            teamsA.forEach((tA, idx) => {
                teamsB.forEach((tB, bIdx) => {
                    // Everyone in A plays everyone in B once
                    // H/A heuristic: balanced split
                    const homeTeam = (idx + bIdx) % 2 === 0 ? tA : tB;
                    const awayTeam = homeTeam === tA ? tB : tA;

                    matchups.push({ home: homeTeam, away: awayTeam, type: 'intra' });
                    teamGames[homeTeam.id]++;
                    teamGames[awayTeam.id]++;
                });
            });
        });
    });

    // 3. Inter-conference Division (4 games)
    const divOrder = ['North', 'South', 'East', 'West'];
    const interRotOffset = year % 4;

    divOrder.forEach((afcDiv, idx) => {
        const nfcDivIdx = (idx + interRotOffset) % 4;
        const nfcDiv = divOrder[nfcDivIdx];

        const afcTeams = getTeamsByDivision('AFC', afcDiv);
        const nfcTeams = getTeamsByDivision('NFC', nfcDiv);

        afcTeams.forEach((tA, i) => {
            nfcTeams.forEach((tB, j) => {
                const homeTeam = (i + j) % 2 === 0 ? tA : tB;
                const awayTeam = homeTeam === tA ? tB : tA;

                matchups.push({ home: homeTeam, away: awayTeam, type: 'inter' });
                teamGames[homeTeam.id]++;
                teamGames[awayTeam.id]++;
            });
        });
    });

    // 4. Placement Games (Remaining games to reach 17)
    // Usually 2 intra, 1 inter (17th game)
    // But our previous logic added 6+4+4 = 14 games. Perfect.
    // We need 3 more games per team.

    // A. Intra-conference Placement (2 games)
    // Play teams of same rank in the 2 divisions NOT played in step 2
    teams.forEach(team => {
        // Find my virtual rank (0-3)
        const myDivTeams = getTeamsByDivision(team.conference, team.division);
        const myRank = myDivTeams.findIndex(t => t.id === team.id);

        // Determine which divisions I ALREADY played in Step 2 (Intra)
        const pairs = CONFERENCE_DIV_ROTATION[team.conference][year % 3] || CONFERENCE_DIV_ROTATION[team.conference][0];
        const myPair = pairs.find(p => p.includes(team.division));
        const intraOppDiv = myPair.find(d => d !== team.division);

        // The other 2 divisions are placement opponents
        const otherDivs = ['North', 'South', 'East', 'West'].filter(d => d !== team.division && d !== intraOppDiv);

        otherDivs.forEach(div => {
            const oppTeams = getTeamsByDivision(team.conference, div);
            const opponent = oppTeams[myRank]; // Same rank

            // Check if match already exists (to avoid duplicates since we iterate all teams)
            const exists = matchups.some(m =>
                (m.home.id === team.id && m.away.id === opponent.id) ||
                (m.home.id === opponent.id && m.away.id === team.id)
            );

            if (!exists) {
                matchups.push({ home: team, away: opponent, type: 'place-intra' });
                teamGames[team.id]++;
                teamGames[opponent.id]++;
            }
        });
    });

    // B. 17th Game (Inter-conference Placement) (1 game)
    // Simplified: Same rank in a rotating division from opposite conference
    // Offset + 2 from the Inter-conference rotation
    teams.forEach(team => {
        const myDivTeams = getTeamsByDivision(team.conference, team.division);
        const myRank = myDivTeams.findIndex(t => t.id === team.id);

        const oppConf = team.conference === 'AFC' ? 'NFC' : 'AFC';

        // Determine opponent division
        const myDivIdx = divOrder.indexOf(team.division);
        // Logic: Inter-conf rotation is offset. We add 2 to avoid the current inter-conf opponent.
        const oppDivIdx = (myDivIdx + (year % 4) + 2) % 4;
        const oppDiv = divOrder[oppDivIdx];

        const oppTeams = getTeamsByDivision(oppConf, oppDiv);
        const opponent = oppTeams[myRank];

        const exists = matchups.some(m =>
            (m.home.id === team.id && m.away.id === opponent.id) ||
            (m.home.id === opponent.id && m.away.id === team.id)
        );

        if (!exists) {
            // AFC Home in odd years? simple heuristic
            const homeTeam = year % 2 === 0 ? team : opponent;
            const awayTeam = homeTeam === team ? opponent : team;

            matchups.push({ home: homeTeam, away: awayTeam, type: '17th' });
            teamGames[homeTeam.id]++;
            teamGames[awayTeam.id]++;
        }
    });

    // Scheduling: Slot into 18 weeks (17 games + 1 bye)
    // Robust "Most Constrained First" Scheduler
    const MAX_RETRIES = 500;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const weeks = Array(18).fill().map(() => []);
        const teamWeeks = {}; // teamId -> Set(weekIndices)
        teams.forEach(t => teamWeeks[t.id] = new Set());

        let unplaced = [...matchups];
        // Shuffle initially to randomize the "equal" choices
        shuffle(unplaced);

        let valid = true;

        while (unplaced.length > 0) {
            // Sort unplaced by "number of valid weeks available" (Most Constrained First)
            const scored = unplaced.map(game => {
                let validSlots = 0;
                let validWeekIdx = -1;

                for (let w = 0; w < 18; w++) {
                    if (!teamWeeks[game.home.id].has(w) &&
                        !teamWeeks[game.away.id].has(w) &&
                        weeks[w].length < 16) {
                        validSlots++;
                        validWeekIdx = w;
                    }
                }
                return { game, validSlots, validWeekIdx };
            });

            // Sort ascending: Items with FEWEST options go FIRST
            scored.sort((a, b) => a.validSlots - b.validSlots);

            const best = scored[0];

            if (best.validSlots === 0) {
                valid = false;
                break; // Dead end, retry
            }

            // Place the most constrained game
            const game = best.game;
            let chosenWeek = -1;

            if (best.validSlots === 1) {
                chosenWeek = best.validWeekIdx;
            } else {
                // If multiple options, pick random valid one
                const options = [];
                for (let w = 0; w < 18; w++) {
                    if (!teamWeeks[game.home.id].has(w) &&
                        !teamWeeks[game.away.id].has(w) &&
                        weeks[w].length < 16) {
                        options.push(w);
                    }
                }
                chosenWeek = options[Math.floor(Math.random() * options.length)];
            }

            // Commit placement
            weeks[chosenWeek].push({
                id: `w${chosenWeek + 1}-${game.home.id}-${game.away.id}`,
                homeTeamId: game.home.id,
                awayTeamId: game.away.id,
                week: chosenWeek + 1,
                played: false,
                homeScore: 0,
                awayScore: 0
            });
            teamWeeks[game.home.id].add(chosenWeek);
            teamWeeks[game.away.id].add(chosenWeek);

            // Remove from unplaced
            const idx = unplaced.indexOf(game);
            unplaced.splice(idx, 1);
        }

        if (valid) {
            console.log(`Schedule generated successfully with MCF on attempt ${attempt + 1}`);
            return weeks;
        }
    }

    console.warn("Failed to generate valid schedule after retries. Returning empty.");
    return [];
}
