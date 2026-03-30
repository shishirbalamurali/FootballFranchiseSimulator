import { create } from 'zustand';
import { TEAMS } from '../data/teams';
import { calculateSeasonAwards } from '../engine/awards';
import { generateRoster, injectLeagueSuperstars } from '../engine/player';
import { calculateTeamRatings } from '../engine/ratings';
import { simulateGame } from '../engine/simulation';
import { generateDraftClass, cpuMakePick } from '../engine/draft';
import { generateSeasonSchedule } from '../engine/schedule';
import { generateWeeklyHeadlines } from '../engine/news';

// Helper for local storage persistence
const persist = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Save failed', e);
    }
};

const load = (key) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    } catch (e) {
        return null;
    }
};

// Initial State Defaults
const defaultState = {
    initialized: false,
    userTeamId: null,
    year: 2024,
    week: 1,
    phase: 'regular', // preseason, regular, playoffs, offseason, draft

    // Data
    teams: TEAMS,
    rosters: {}, // teamId -> [players]
    schedule: [], // [week][games]
    standings: {}, // teamId -> { wins, losses, ties, pf, pa, divWins, ... }
    teamRatings: {}, // teamId -> { off, def, st }

    // Draft State
    draftClass: [],
    draftOrder: [], // [{ teamId, pickNum }]
    currentPickIndex: 0,
    onClockTeamId: null,
    draftHistory: [],
    draftTimer: 120, // 2 minutes in seconds
    draftTimerActive: false,

    // Activity Log
    activityLog: [],
    weeklyNews: [],
    lastDismissedGameId: null, // Track viewed summaries

    // Playoffs State
    playoffBracket: null,
    seasonRecap: null
};

// Hydrate state
const savedState = load('gridiron_save_v3');
const initialState = savedState ? { ...defaultState, ...savedState } : defaultState;

export const useGameStore = create((set, get) => ({
    ...initialState,

    // Actions
    dismissGameSummary: (gameId) => {
        set({ lastDismissedGameId: gameId });
        persist('gridiron_save_v3', { ...get(), lastDismissedGameId: gameId });
    },

    generateLeague: () => {
        const rosters = {};
        const ratings = {};
        const standings = {};

        // 1. Assign Team Tiers (Variance)
        const shuffled = [...TEAMS].sort(() => 0.5 - Math.random());

        // Distribution: 3 Elite, 6 Good, 14 Avg, 6 Bad, 3 Tanking
        const tiers = [
            { count: 3, mod: 4 },   // Dynasties
            { count: 6, mod: 2 },   // Contenders
            { count: 14, mod: 0 },  // Average
            { count: 6, mod: -2 },  // Struggling
            { count: 3, mod: -5 }   // Rebuild
        ];

        let teamIdx = 0;
        const tierMap = {};

        tiers.forEach(tier => {
            for (let i = 0; i < tier.count; i++) {
                if (shuffled[teamIdx]) {
                    tierMap[shuffled[teamIdx].id] = tier.mod;
                    teamIdx++;
                }
            }
        });



        // 2. Generate Rosters
        TEAMS.forEach(team => {
            const mod = tierMap[team.id] || 0;
            rosters[team.id] = generateRoster(mod);
            standings[team.id] = {
                id: team.id,
                wins: 0, losses: 0, ties: 0,
                pf: 0, pa: 0,
                confWins: 0, divWins: 0,
                streak: 0
            };
        });

        // 3. Inject League-Wide Superstars
        injectLeagueSuperstars(rosters);

        // 4. Calc Ratings (After superstars injected!)
        TEAMS.forEach(team => {
            ratings[team.id] = calculateTeamRatings(rosters[team.id]);
        });

        const schedule = generateSeasonSchedule(TEAMS, 2024);

        set({
            rosters,
            teamRatings: ratings,
            standings,
            schedule,
            initialized: false
        });
    },

    selectTeam: (userTeamId) => {
        const { rosters, schedule, teamRatings, standings } = get();

        if (!rosters || Object.keys(rosters).length === 0) {
            console.error("League not generated! Calling generateLeague first.");
            get().generateLeague();
            // Recursion note: get() inside set might be stale if synchronous? 
            // safest to just do the logic here or ensure caller does ordering.
        }

        // Re-get state if we just generated
        const state = get();

        const finalState = {
            ...state,
            initialized: true,
            userTeamId,
            year: 2024,
            week: 1,
            phase: 'regular',
            draftClass: [],
            draftHistory: [],
            draftTimer: 120,
            draftTimerActive: false,
            activityLog: [`Franchise started with ${userTeamId}`]
        };

        persist('gridiron_save_v3', finalState);
        set(finalState);
    },

    // Deprecated but kept for compatibility if needed (mapped to selectTeam)
    initializeGame: (userTeamId) => {
        get().generateLeague();
        get().selectTeam(userTeamId);
    },

    resetGame: () => {
        localStorage.removeItem('gridiron_save_v3');
        window.location.reload();
    },

    simulateWeek: () => {
        const { week, schedule, rosters, teamRatings, standings, userTeamId } = get();

        // Safety check
        if (week > 18) {
            console.log("Sim skipped: Week > 18");
            return;
        }

        // Deep clone schedule to avoid direct mutation of state
        // We only really need to clone the current week's games or the whole thing?
        // Let's copy the whole array first, then the specific week array.
        const newSchedule = [...schedule];

        // Safety for specific week
        if (!newSchedule[week - 1]) {
            console.error("Critical Error: Schedule missing for week", week);
            return;
        }

        // Clone the inner array so we don't mutate the old state's array ref
        const weeksGames = newSchedule[week - 1].map(g => ({ ...g }));
        newSchedule[week - 1] = weeksGames;

        if (weeksGames.length === 0) {
            console.log(`Sim skipped: No games found for Week ${week}. Attempting to advance...`);
            // But we need to increment week still? 
            // Yes, let's just proceed to logic below which increments week.
        } else {
            console.log(`Simulating Week ${week}, ${weeksGames.length} games.`);
        }

        const newStandings = { ...standings };
        // Deep clone rosters for simulation to avoid mutating state directly during sim
        // Using JSON for safety, though structuredClone is better if available.
        const newRosters = JSON.parse(JSON.stringify(rosters));
        const weekResults = [];

        weeksGames.forEach(game => {
            // already played?
            if (game.played) {
                weekResults.push(game); // Keep it in results for headlines/logging
                return;
            }

            const homeTeam = TEAMS.find(t => t.id === game.homeTeamId);
            const awayTeam = TEAMS.find(t => t.id === game.awayTeamId);

            if (!homeTeam || !awayTeam) return;

            try {
                // Ensure rosters exist
                if (!newRosters[homeTeam.id] || !newRosters[awayTeam.id]) {
                    console.error('Missing roster for game', game);
                    return;
                }

                const result = simulateGame(
                    homeTeam,
                    awayTeam,
                    newRosters[homeTeam.id],
                    newRosters[awayTeam.id]
                );

                // Update game object (in our local weeksGames copy)
                game.played = true;
                game.homeScore = result.homeScore;
                game.awayScore = result.awayScore;
                game.winnerId = result.homeScore > result.awayScore ? homeTeam.id : (result.awayScore > result.homeScore ? awayTeam.id : null);

                game.stats = {
                    home: result.homeStats,
                    away: result.awayStats
                };
                game.playerStats = {
                    home: result.homePlayerStats,
                    away: result.awayPlayerStats
                };

                // Update Standings (Immutable pattern)
                const homeStats = { ...newStandings[homeTeam.id] };
                const awayStats = { ...newStandings[awayTeam.id] };
                newStandings[homeTeam.id] = homeStats;
                newStandings[awayTeam.id] = awayStats;

                homeStats.pf += result.homeScore;
                homeStats.pa += result.awayScore;
                awayStats.pf += result.awayScore;
                awayStats.pa += result.homeScore;

                if (result.homeScore > result.awayScore) {
                    homeStats.wins++;
                    awayStats.losses++;
                    homeStats.streak = homeStats.streak > 0 ? homeStats.streak + 1 : 1;
                    awayStats.streak = awayStats.streak < 0 ? awayStats.streak - 1 : -1;
                    if (homeTeam.conference === awayTeam.conference) {
                        homeStats.confWins++;
                        if (homeTeam.division === awayTeam.division) homeStats.divWins++;
                    }
                } else if (result.awayScore > result.homeScore) {
                    awayStats.wins++;
                    homeStats.losses++;
                    awayStats.streak = awayStats.streak > 0 ? awayStats.streak + 1 : 1;
                    homeStats.streak = homeStats.streak < 0 ? homeStats.streak - 1 : -1;
                    if (homeTeam.conference === awayTeam.conference) {
                        awayStats.confWins++;
                        if (homeTeam.division === awayTeam.division) awayStats.divWins++;
                    }
                } else {
                    homeStats.ties++;
                    awayStats.ties++;
                }

                // Update Player Stats
                [
                    { stats: result.homePlayerStats, teamId: homeTeam.id },
                    { stats: result.awayPlayerStats, teamId: awayTeam.id }
                ].forEach(({ stats: statGroup, teamId }) => {
                    if (!statGroup) return;

                    // Ensure we are working with the correct roster array from our clone
                    const teamRoster = newRosters[teamId];
                    if (!teamRoster) return;

                    Object.values(statGroup).forEach(statEntry => {
                        const { player: refPlayer, ...gameStats } = statEntry;
                        if (!refPlayer) return;

                        // Find mutable player object in the newRosters
                        const player = teamRoster.find(p => p.id === refPlayer.id);

                        if (player) {
                            if (!player.stats) player.stats = { season: {}, career: {} };
                            if (!player.stats.season) player.stats.season = {};

                            Object.entries(gameStats).forEach(([statKey, statValue]) => {
                                if (statKey === 'rating' || statKey === 'player') return;

                                const current = player.stats.season[statKey] || 0;
                                player.stats.season[statKey] = current + statValue;
                            });
                        }
                    });
                });

                weekResults.push({ ...game, result });
            } catch (error) {
                console.error(`Simulation failed for ${homeTeam.id} vs ${awayTeam.id}`, error);
            }
        });

        // --- MEAN SCORES CALCULATION ---
        // Need to flatten the NEW schedule to check stats logic if we want to include just-simulated games
        const allPlayedGames = newSchedule.flat().filter(g => g.played);
        const totalPoints = allPlayedGames.reduce((sum, g) => sum + g.homeScore + g.awayScore, 0);
        const meanPPG = allPlayedGames.length > 0 ? (totalPoints / allPlayedGames.length).toFixed(1) : 0;
        console.log(`League Stats: ${allPlayedGames.length} games played. Mean PPG: ${meanPPG} (Target: ~42)`);

        set(state => {
            // Check if we should advance to next week
            let nextWeek = state.week;
            let nextPhase = state.phase;

            if (nextWeek <= 18) {
                nextWeek += 1;
            }

            if (nextWeek > 18 && nextPhase === 'regular') {
                nextPhase = 'playoffs';
                nextWeek = 1; // Playoff week 1
                setTimeout(() => get().generatePlayoffs(), 0);
            }

            // Generate Headlines for the week
            const headlines = generateWeeklyHeadlines(weekResults || [], TEAMS);

            // Generate Activity Log Message
            let logMsg = `Week ${state.week} simulation complete`;

            // Find user game in the NEW weeksGames array
            const userGame = weeksGames.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);

            if (userGame && userGame.played) {
                const userIsHome = userGame.homeTeamId === userTeamId;
                const userScore = userIsHome ? userGame.homeScore : userGame.awayScore;
                const oppScore = userIsHome ? userGame.awayScore : userGame.homeScore;
                const oppId = userIsHome ? userGame.awayTeamId : userGame.homeTeamId;
                const oppCity = TEAMS.find(t => t.id === oppId)?.location || oppId;

                const result = userScore > oppScore ? 'Win' : (userScore < oppScore ? 'Loss' : 'Tie');
                logMsg = `${result} ${userScore}-${oppScore} vs ${oppCity}`;
            } else if (!userGame) {
                logMsg = `Week ${state.week} - Bye Week`;
            }

            const newState = {
                ...state,
                standings: newStandings,
                schedule: newSchedule, // Uses the fresh immutable copy
                rosters: newRosters,   // Uses the fresh immutable copy with updated stats
                weeklyNews: headlines,
                activityLog: [logMsg, ...state.activityLog].slice(0, 50),
                week: nextWeek,
                phase: nextPhase
            };
            persist('gridiron_save_v3', newState);
            return newState;
        });
    },

    advanceWeek: () => {
        set(state => {
            let nextWeek = state.week + 1;
            let nextPhase = state.phase;

            if (state.phase === 'regular' && nextWeek > 18) {
                nextPhase = 'playoffs';
                nextWeek = 1;
                // Trigger playoff generation here or in component
            }

            const newState = {
                ...state,
                week: nextWeek,
                phase: nextPhase
            };
            persist('gridiron_save_v3', newState);
            return newState;
        });
    },

    advancePhase: (newPhase) => {
        set(state => {
            const newState = { phase: newPhase, week: 1 };
            persist('gridiron_save_v3', { ...state, ...newState });
            return newState;
        })
    },

    // Playoff Actions
    generatePlayoffs: () => {
        const { standings, teams } = get();

        // Helper to sort teams
        const sortTeams = (teamIds) => {
            return teamIds.sort((a, b) => {
                const statA = standings[a];
                const statB = standings[b];
                if (statA.wins !== statB.wins) return statB.wins - statA.wins;
                return (statB.pf - statB.pa) - (statA.pf - statA.pa); // PD tiebreaker
            });
        };

        // Separate AFC and NFC
        const afcTeams = teams.filter(t => t.conference === 'AFC').map(t => t.id);
        const nfcTeams = teams.filter(t => t.conference === 'NFC').map(t => t.id);

        const afcSeeds = sortTeams(afcTeams).slice(0, 7);
        const nfcSeeds = sortTeams(nfcTeams).slice(0, 7);

        const createMatchup = (id, home, away) => ({
            id,
            homeTeamId: home,
            awayTeamId: away,
            homeScore: null,
            awayScore: null,
            winnerId: null,
            played: false
        });

        const bracket = {
            round: 1, // 1=WC, 2=DIV, 3=CONF, 4=SB
            afc: {
                seeds: afcSeeds,
                wc: [
                    createMatchup('afc-wc-1', afcSeeds[1], afcSeeds[6]), // 2 vs 7
                    createMatchup('afc-wc-2', afcSeeds[2], afcSeeds[5]), // 3 vs 6
                    createMatchup('afc-wc-3', afcSeeds[3], afcSeeds[4]), // 4 vs 5
                ],
                div: [],
                conf: [],
            },
            nfc: {
                seeds: nfcSeeds,
                wc: [
                    createMatchup('nfc-wc-1', nfcSeeds[1], nfcSeeds[6]),
                    createMatchup('nfc-wc-2', nfcSeeds[2], nfcSeeds[5]),
                    createMatchup('nfc-wc-3', nfcSeeds[3], nfcSeeds[4]),
                ],
                div: [],
                conf: [],
            },
            sb: null
        };

        set({ playoffBracket: bracket, phase: 'playoffs', week: 1 });
        persist('gridiron_save_v3', { ...get(), playoffBracket: bracket, phase: 'playoffs', week: 1 });
    },

    simulateNextPlayoffGame: () => {
        const { playoffBracket, teams, rosters } = get();
        if (!playoffBracket) return null;

        const round = playoffBracket.round;
        const newBracket = JSON.parse(JSON.stringify(playoffBracket));
        let matchToPlay = null;

        // Helper to find next unplayed
        const findUnplayed = (matches) => matches.find(m => !m.played);

        if (round === 1) { // WC
            matchToPlay = findUnplayed(newBracket.afc.wc) || findUnplayed(newBracket.nfc.wc);
        } else if (round === 2) { // Div
            matchToPlay = findUnplayed(newBracket.afc.div) || findUnplayed(newBracket.nfc.div);
        } else if (round === 3) { // Conf
            matchToPlay = findUnplayed(newBracket.afc.conf) || findUnplayed(newBracket.nfc.conf);
        } else if (round === 4) { // SB
            if (newBracket.sb && !newBracket.sb.played) matchToPlay = newBracket.sb;
        }

        if (!matchToPlay) {
            // No games left in this round, advance round logic check
            return get().advancePlayoffRound(newBracket); // We'll refactor advance logic into a helper or call it here
        }

        // Simulate THIS game
        const homeTeam = teams.find(t => t.id === matchToPlay.homeTeamId);
        const awayTeam = teams.find(t => t.id === matchToPlay.awayTeamId);
        const result = simulateGame(
            homeTeam,
            awayTeam,
            rosters[homeTeam.id] || [],
            rosters[awayTeam.id] || []
        );

        matchToPlay.homeScore = result.homeScore;
        matchToPlay.awayScore = result.awayScore;
        matchToPlay.winnerId = result.homeScore > result.awayScore ? matchToPlay.homeTeamId : matchToPlay.awayTeamId;
        matchToPlay.played = true;

        // If Super Bowl just finished
        let seasonOver = false;
        if (round === 4 && matchToPlay.id === 'sb') {
            seasonOver = true;
        }

        set({ playoffBracket: newBracket });
        persist('gridiron_save_v3', { ...get(), playoffBracket: newBracket });

        return {
            playedGame: matchToPlay,
            seasonOver
        };
    },

    advancePlayoffRound: (currentBracket) => {
        const round = currentBracket.round;
        let newBracket = currentBracket;

        // This is extracted from the old logic to be reusable
        // Logic to setup next round based on current results
        // ... (reuse existing logic from lines 424-488 but adapted)

        // Actually, let's keep it simple. If we call simulateNextPlayoffGame and return null, 
        // the UI can check if round is complete.
        // But we need a state update to "next round" if all are played.

        // Check if round complete
        let roundComplete = false;
        if (round === 1) roundComplete = [...newBracket.afc.wc, ...newBracket.nfc.wc].every(m => m.played);
        else if (round === 2) roundComplete = [...newBracket.afc.div, ...newBracket.nfc.div].every(m => m.played);
        else if (round === 3) roundComplete = [...newBracket.afc.conf, ...newBracket.nfc.conf].every(m => m.played);

        if (roundComplete) {
            // Logic to setup next round structures (WC -> Div, Div -> Conf, etc)
            // We can copy/paste the logic from the old simulatePlayoffRound here
            // ...
            // For brevity in this edit, I will call the old function if round complete lol. 
            // Wait, the old function simulates everything. 
            // I'll rewrite the setup logic here.

            if (round === 1) { // WC Done -> Setup Div
                const processConf = (confData) => {
                    const winners = confData.wc.map(m => ({ id: m.winnerId, seedIdx: confData.seeds.indexOf(m.winnerId) }));
                    winners.sort((a, b) => a.seedIdx - b.seedIdx);
                    const seed1 = confData.seeds[0];
                    const worstWinner = winners.pop();
                    const bestWinner = winners[0];
                    const midWinner = winners[1];
                    confData.div = [
                        { id: 'div-1', homeTeamId: seed1, awayTeamId: worstWinner.id, played: false, winnerId: null },
                        { id: 'div-2', homeTeamId: bestWinner.id, awayTeamId: midWinner.id, played: false, winnerId: null }
                    ];
                };
                processConf(newBracket.afc);
                processConf(newBracket.nfc);
                newBracket.round = 2;
            } else if (round === 2) { // Div Done -> Setup Conf
                const processConf = (confData) => {
                    const w1 = confData.div[0].winnerId;
                    const w2 = confData.div[1].winnerId;
                    const idx1 = confData.seeds.indexOf(w1);
                    const idx2 = confData.seeds.indexOf(w2);
                    const home = idx1 < idx2 ? w1 : w2;
                    const away = idx1 < idx2 ? w2 : w1;
                    confData.conf = [{ id: 'conf-1', homeTeamId: home, awayTeamId: away, played: false, winnerId: null }];
                };
                processConf(newBracket.afc);
                processConf(newBracket.nfc);
                newBracket.round = 3;
            } else if (round === 3) { // Conf Done -> Setup SB
                const afcChamp = newBracket.afc.conf[0].winnerId;
                const nfcChamp = newBracket.nfc.conf[0].winnerId;
                newBracket.sb = { id: 'sb', homeTeamId: afcChamp, awayTeamId: nfcChamp, homeScore: null, awayScore: null, winnerId: null, played: false };
                newBracket.round = 4;
            }

            set({ playoffBracket: newBracket });
            return { roundAdvanced: true };
        }
        return null;
    },

    concludeSeason: () => {
        const { rosters, teams, playoffBracket, year } = get();

        const awards = calculateSeasonAwards(rosters, teams);
        const sbWinnerId = playoffBracket.sb.winnerId;
        const winner = teams.find(t => t.id === sbWinnerId);

        const recap = {
            year,
            champion: winner,
            awards
        };

        // Save history (if we had a history array, we'd push to it. For now, just current recap)
        set({ seasonRecap: recap });
        persist('gridiron_save_v3', { ...get(), seasonRecap: recap });
        return recap;
    },

    // Keeping old function for compatibility or bulk sim if needed, but updated to use new logic is better.
    // For now, let's just REPLACE simulatePlayoffRound with the new logic completely if possible, 
    // OR just leave it and add new ones. 
    // I will replace lines 371-492 with `simulateNextPlayoffGame` and helpers.


    debugForcePlayoffs: () => {
        const { teams } = get();
        // Randomize some wins for seeding consistency
        const teamsWithWins = teams.map(t => ({
            ...t,
            wins: Math.floor(Math.random() * 10) + 5,
            losses: Math.floor(Math.random() * 5),
            pf: Math.floor(Math.random() * 500),
            pa: Math.floor(Math.random() * 400)
        }));

        // Update standings state
        const newStandings = {};
        teamsWithWins.forEach(t => {
            newStandings[t.id] = { ...t };
        });

        set({ teams: teamsWithWins, standings: newStandings, week: 18, phase: 'regular' });
        // Defer generate to next tick to ensure state update
        setTimeout(() => get().generatePlayoffs(), 50);
    },

    // Draft Actions
    startDraft: () => {
        // Generate class
        const draftClass = generateDraftClass(2025); // Next year

        // Generate order (reverse standings)
        // Flatten standings to array
        const teamsSorted = Object.values(get().standings).sort((a, b) => {
            // Sort by wins asc (ignoring playoffs logic for MVP simplicity)
            if (a.wins !== b.wins) return a.wins - b.wins;
            return (a.pf - a.pa) - (b.pf - b.pa);
        }).map(s => s.id);

        // 7 rounds
        const draftOrder = [];
        for (let r = 1; r <= 7; r++) {
            teamsSorted.forEach(tid => draftOrder.push({ teamId: tid, round: r, pickInRound: 0 })); // We'll fix pickInRound later
        }

        // Correct picks
        let pickCounter = 1;
        draftOrder.forEach(p => p.pickNumber = pickCounter++);

        set({
            phase: 'draft',
            draftClass,
            draftOrder,
            currentPickIndex: 0,
            onClockTeamId: draftOrder[0].teamId,
            draftHistory: [],
            draftTimer: 120,
            draftTimerActive: true
        });
    },

    makePick: (playerId) => {
        const { draftClass, draftOrder, currentPickIndex, rosters, draftHistory } = get();
        const pick = draftOrder[currentPickIndex];
        const player = draftClass.find(p => p.id === playerId);

        // Update roster
        const newRosters = { ...rosters };
        newRosters[pick.teamId].push({ ...player, teamId: pick.teamId });

        // Remove from pool
        const newClass = draftClass.filter(p => p.id !== playerId);

        const newHistory = [...draftHistory, { ...pick, player }];
        const nextIndex = currentPickIndex + 1;

        const newState = {
            draftClass: newClass,
            rosters: newRosters,
            currentPickIndex: nextIndex,
            draftHistory: newHistory,
            onClockTeamId: draftOrder[nextIndex] ? draftOrder[nextIndex].teamId : null,
            draftTimer: 120 // Reset timer
        };

        set(newState);
        persist('gridiron_save_v3', { ...get(), ...newState });

        return nextIndex < draftOrder.length;
    },

    simToNextUserPick: () => {
        const { draftOrder, currentPickIndex, userTeamId, draftClass, teamRatings, rosters } = get();
        let idx = currentPickIndex;
        let currentClass = [...draftClass];
        let currentRosters = { ...rosters };
        let history = [...get().draftHistory];

        // Sim until user pick or end
        while (idx < draftOrder.length && draftOrder[idx].teamId !== userTeamId) {
            const pick = draftOrder[idx];
            const pickingTeam = TEAMS.find(t => t.id === pick.teamId);

            // CPU Logic
            // Corrected Args: cpuMakePick(roster, availableProspects)
            const pickedPlayer = cpuMakePick(currentRosters[pick.teamId], currentClass);

            // Update local loops
            currentRosters[pick.teamId].push({ ...pickedPlayer, teamId: pick.teamId });
            currentClass = currentClass.filter(p => p.id !== pickedPlayer.id);
            history.push({ ...pick, player: pickedPlayer });

            idx++;
        }

        set({
            currentPickIndex: idx,
            draftClass: currentClass,
            rosters: currentRosters,
            draftHistory: history,
            onClockTeamId: draftOrder[idx] ? draftOrder[idx].teamId : null
        });
    },

    // Timer Actions
    setDraftTimer: (seconds) => set({ draftTimer: seconds }),
    toggleDraftTimer: (isActive) => set({ draftTimerActive: isActive }),
    decrementDraftTimer: () => {
        const { draftTimer, draftTimerActive, currentPickIndex, draftOrder, userTeamId } = get();
        if (!draftTimerActive) return;

        if (draftTimer > 0) {
            set({ draftTimer: draftTimer - 1 });
        } else {
            // Time expired! Auto-pick for user if it's their turn
            if (draftOrder[currentPickIndex]?.teamId === userTeamId) {
                // Auto pick best available
                const { draftClass } = get();
                // Simple: pick highest OVR
                const bestAvailable = draftClass.sort((a, b) => b.ovr - a.ovr)[0];
                get().makePick(bestAvailable.id);
            }
        }
    }

}));
