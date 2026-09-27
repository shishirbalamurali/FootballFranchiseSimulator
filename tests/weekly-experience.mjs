import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createSeededRandom } from './helpers/seededRandom.mjs';
import { weeklyPreparation, positionBattleCandidate, choosePositionBattle, resolvePositionBattle, battleGameRoster, settlePositionBattle, weeklyGameReview } from '../src/engine/weeklyExperience.js';
import { calculateTeamRatings } from '../src/engine/ratings.js';
import { generateRoster } from '../src/engine/player.js';
import { simulateGame } from '../src/engine/simulation.js';
import { TEAMS } from '../src/data/teams.js';

Math.random = createSeededRandom(20260925);
const [home, away] = TEAMS;
const roster = generateRoster();
const qbs = roster.filter(p => p.position === 'QB').sort((a,b) => b.ovr-a.ovr);
const veteran = qbs[0], rookie = qbs[1];
Object.assign(veteran, { age: 32, ovr: 80, experience: 10 });
Object.assign(rookie, { age: 22, ovr: 72, experience: 0 });
const opponentRoster = generateRoster();
const fixture = { phase: 'regular', year: 2028, week: 1, userTeamId: home.id,
    rosters: { [home.id]: roster, [away.id]: opponentRoster }, injuries: [], activeBoosts: [],
    schedule: [[{ id: 'g1', homeTeamId: home.id, awayTeamId: away.id }], [], [{ id: 'g3', homeTeamId: away.id, awayTeamId: home.id }]],
    teamRatings: { [home.id]: calculateTeamRatings(roster), [away.id]: calculateTeamRatings(opponentRoster) } };
assert.equal(weeklyPreparation(fixture).opponentId, away.id);
assert.equal(weeklyPreparation({ ...fixture, week: 2 }), null);
assert.equal(weeklyPreparation({ ...fixture, phase: 'playoffs' }), null);
assert.equal(positionBattleCandidate(fixture).rookie.id, rookie.id);
assert.equal(choosePositionBattle(fixture, 'invalid'), null);
const patch = choosePositionBattle(fixture, 'rookie');
let state = { ...fixture, ...JSON.parse(JSON.stringify(patch)) };
assert.equal(choosePositionBattle(state, 'veteran'), null, 'active choice is locked');
const gameRoster = battleGameRoster(roster, home.id, state);
assert.equal(gameRoster.find(p => p.weeklyStarter).id, rookie.id);
assert.ok(!roster.some(p => p.weeklyStarter), 'does not mutate saved roster');
assert.equal(calculateTeamRatings(gameRoster).offense.qb, rookie.ovr);
Math.random = createSeededRandom(37);
const result = simulateGame(home, away, gameRoster, opponentRoster);
assert.ok(result.homePlayerStats[rookie.id].attempts > 0, 'selected QB takes the snaps');
assert.equal((result.homePlayerStats[veteran.id]?.attempts || 0), 0, 'higher-rated veteran sits');
const game = { ...fixture.schedule[0][0], played: true, homeScore: result.homeScore, awayScore: result.awayScore,
    stats: { home: result.homeStats, away: result.awayStats }, playerStats: { home: result.homePlayerStats, away: result.awayPlayerStats } };
const review = weeklyGameReview(state, game);
assert.equal(review.battle.playerName, rookie.name);
assert.ok(review.battle.statLine.includes(`${result.homePlayerStats[rookie.id].attempts}`));
assert.ok(review.evidence.every(s => !/NaN|undefined/.test(s)));
state = { ...state, ...settlePositionBattle(state, game) };
assert.equal(state.positionBattle.games.length, 1);
assert.deepEqual(settlePositionBattle(state, game), {}, 'repeated settlement is idempotent');
assert.deepEqual(settlePositionBattle({ ...state, week: 2 }, null), {}, 'bye preserves evaluation');
const awayGame = { ...game, ...fixture.schedule[2][0], playerStats: { away: result.homePlayerStats }, stats: { away: result.homeStats, home: result.awayStats } };
state = { ...state, ...settlePositionBattle({ ...state, week: 3 }, awayGame) };
assert.equal(state.positionBattle.status, 'complete');
assert.equal(state.weeklyDecisionHistory.length, 1);
assert.equal(state.positionBattle.games.length, 2);
assert.equal(positionBattleCandidate({ ...state, week: 3 }), null, 'no repeat of season arc');
assert.equal(battleGameRoster(roster, home.id, state), roster, 'default depth resumes');
const keepState = { ...state, week: 3 };
const kept = resolvePositionBattle(keepState, 'rookie');
assert.equal(kept.positionBattle.status, 'settled');
assert.equal(battleGameRoster(roster, home.id, { ...keepState, ...kept }).find(p => p.weeklyStarter).id, rookie.id);
assert.deepEqual(settlePositionBattle({ ...keepState, ...kept }, awayGame), {}, 'settled decision grants no repeated resolution');
assert.equal(resolvePositionBattle({ ...keepState, ...kept }, 'auto').positionBattle.status, 'complete');
const keptState = { ...keepState, ...kept };
const missingOther = { ...keptState, rosters: { [home.id]: roster.filter(p => p.id !== veteran.id) } };
assert.equal(battleGameRoster(missingOther.rosters[home.id], home.id, missingOther).find(p => p.weeklyStarter).id, rookie.id, 'a retained starter still plays after the other candidate leaves');
const keptInjured = { ...keptState, injuries: [{ playerId: rookie.id, teamId: home.id, weeksRemaining: 2 }] };
assert.equal(battleGameRoster(roster, home.id, keptInjured), roster, 'retained starter yields to injury availability');
assert.equal(battleGameRoster(roster, home.id, { ...keptInjured, injuries: [] }).find(p => p.weeklyStarter).id, rookie.id, 'retained starter returns after recovery');

const active = { ...fixture, ...patch };
const injured = { ...active, injuries: [{ playerId: rookie.id, teamId: home.id, weeksRemaining: 2 }] };
assert.equal(battleGameRoster(roster, home.id, injured), roster);
assert.equal(settlePositionBattle(injured, game).positionBattle.status, 'interrupted');
assert.equal(settlePositionBattle({ ...active, rosters: { [home.id]: roster.filter(p => p.id !== veteran.id) } }, game).positionBattle.status, 'interrupted');
assert.equal(battleGameRoster(roster, home.id, { ...active, year: 2029 }), roster);
assert.equal(battleGameRoster(roster, home.id, { ...active, phase: 'playoffs' }), roster);
assert.equal(weeklyGameReview({ ...fixture, weekStrategy: 'unknown' }, game).strategyId, 'balanced');

// RB auditions change real carry allocation, including when QB is not eligible.
const rbRoster = structuredClone(roster);
rbRoster.filter(p => p.position === 'QB').forEach(p => { p.age = 26; });
const backs = rbRoster.filter(p => p.position === 'RB').sort((a,b) => b.ovr-a.ovr);
Object.assign(backs[0], { age: 30, ovr: 82 });
Object.assign(backs[1], { age: 22, ovr: 74, experience: 0 });
const rbState = { ...fixture, rosters: { ...fixture.rosters, [home.id]: rbRoster } };
const rbChoice = choosePositionBattle(rbState, 'rookie');
assert.equal(rbChoice.positionBattle.position, 'RB');
Math.random = createSeededRandom(37);
const rbGame = simulateGame(home, away, battleGameRoster(rbRoster, home.id, { ...rbState, ...rbChoice }), opponentRoster);
assert.ok(rbGame.homePlayerStats[backs[1].id].carries > rbGame.homePlayerStats[backs[0].id].carries);

// Integration: store action, simulation hook, review snapshot and persistence.
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
    const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');
    const standings = Object.fromEntries(TEAMS.map(t => [t.id, { wins:0, losses:0, ties:0, pf:0, pa:0, streak:0 }]));
    const rosters = Object.fromEntries(TEAMS.map(t => [t.id, t.id === home.id ? structuredClone(roster) : generateRoster()]));
    store.setState({ ...fixture, rosters, standings, initialized: false, positionBattle: null, weeklyDecisionHistory: [], coachingStaff: [], collegePipeline: [], coach: null, phase:'regular', week:1 });
    assert.equal(store.getState().choosePositionBattle('rookie').ok, true);
    store.getState().setWeekStrategy('conservative');
    store.getState().setWeekStrategy('bogus');
    assert.equal(store.getState().weekStrategy, 'conservative');
    store.getState().simulateWeek();
    const savedGame = store.getState().schedule[0][0];
    assert.equal(savedGame.weeklyReview.strategyId, 'conservative');
    assert.equal(savedGame.weeklyReview.battle.playerName, rookie.name);
    assert.ok(savedGame.playerStats.home[rookie.id].attempts > 0);
    assert.equal(store.getState().positionBattle.games.length, 1);
    const serialized = JSON.parse(JSON.stringify(store.getState()));
    assert.equal(serialized.positionBattle.selectedPlayerId, rookie.id);
    assert.equal(serialized.weeklyDecisionHistory.length, 1);
    assert.ok(!store.getState().rosters[home.id].some(p => p.weeklyStarter));
    store.setState({ initialized: true });
    await new Promise(resolve => setTimeout(resolve, 350));
    const loaded = await server.ssrLoadModule('/src/store/gameStore.js?weekly-reload');
    assert.equal(loaded.useGameStore.getState().positionBattle.games.length, 1);
    assert.equal(loaded.useGameStore.getState().schedule[0][0].weeklyReview.strategyId, 'conservative');
    store.setState({ initialized: false });
    store.getState().simulateWeek(); // bye
    assert.equal(store.getState().positionBattle.games.length, 1);
    store.setState({ injuries: [] });
    store.getState().simulateWeek();
    assert.equal(store.getState().positionBattle.status, 'complete');
    assert.equal(store.getState().weeklyDecisionHistory.length, 1);
} finally { await server.close(); }
console.log('PASS: weekly preparation, real QB/RB roles, two-game arcs, byes, interruptions, save-safe history and store recaps');
