// Owner & job security (src/engine/owner.js + Claude store block). Claude-owned test.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260921);
import { createServer } from 'vite';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
    const O = await server.ssrLoadModule('/src/engine/owner.js');
    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.js');
    const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');

    // Owners are stable per team and cover every archetype somewhere in the league.
    assert.deepEqual(O.ownerForTeam(TEAMS[3].id), O.ownerForTeam(TEAMS[3].id));
    assert.equal(new Set(TEAMS.map(t => O.ownerForTeam(t.id).archetypeId)).size, 4);

    // Goal sizing follows expectations.
    assert.equal(O.generateSeasonGoals('mogul', 1)[0].target, 11);
    assert.equal(O.generateSeasonGoals('mogul', 30)[0].target, 6);
    for (const a of Object.keys(O.OWNER_ARCHETYPES)) assert.equal(O.generateSeasonGoals(a, 12).length, 3);

    // Scoring: all met beats all failed; the impatient owner punishes harder.
    const goals = O.generateSeasonGoals('mogul', 12);
    const ctx = { wins: 13, losses: 4, pf: 450, gamesPlayed: 17, divisionRank: 1, divWins: 5, playoffWins: 1, madePlayoffs: true, champion: false, capSpace: 20, youngCore: 4, seasonOver: true };
    const bad = { ...ctx, wins: 2, losses: 15, pf: 200, divisionRank: 4, divWins: 0, playoffWins: 0, madePlayoffs: false, capSpace: -10, youngCore: 0 };
    assert.ok(O.evaluateGoals(goals, ctx).every(g => g.status === 'met'));
    assert.ok(O.evaluateGoals(goals, bad).every(g => g.status === 'failed'));
    assert.ok(O.trustDelta(0, 'mogul') < O.trustDelta(0, 'builder'));
    assert.ok(O.trustDelta(1, 'mogul') > 0);

    // Two disastrous seasons get you fired; one does not.
    let owner = { ...O.createOwnerState(TEAMS[0].id), archetypeId: 'mogul', goals, goalsYear: 2024 };
    owner = O.reviewSeason(owner, bad, 2024);
    assert.equal(owner.fired, false, 'one bad year is survivable');
    owner = O.reviewSeason({ ...owner, goalsYear: 2025 }, bad, 2025);
    assert.equal(owner.fired, true, 'two bad years are not, for the Mogul');
    assert.equal(owner.reviews.length, 2);

    // Full store flow: goals are set, the season ends, and the review runs once.
    const user = TEAMS[0].id;
    store.getState().generateLeague();
    store.getState().selectTeam(user, { name: 'Test Coach' });
    store.getState().ensureOwner();
    assert.equal(store.getState().owner.goals.length, 3);
    assert.equal(store.getState().owner.goalsYear, 2024);
    for (let i = 0; i < 18; i++) store.getState().simulateWeek();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(store.getState().phase, 'playoffs');
    for (let i = 0; i < 6 && !store.getState().playoffBracket?.sb?.played; i++) store.getState().simPlayoffRound();
    assert.ok(store.getState().playoffBracket.sb.played);
    store.getState().concludeSeason();
    store.getState().ensureOwner(); // offseason: must not regenerate goals
    store.getState().runOwnerReview();
    const reviewed = store.getState().owner;
    assert.equal(reviewed.lastReviewYear, 2024);
    assert.ok(reviewed.pendingReview && ['A', 'B', 'C', 'D', 'F'].includes(reviewed.pendingReview.grade));
    store.getState().runOwnerReview();
    assert.equal(store.getState().owner.reviews.length, 1, 'review is idempotent');
    store.getState().dismissOwnerReview();
    assert.equal(store.getState().owner.pendingReview, null);

    // Getting fired → offers → a new job on a different club.
    store.setState({ owner: { ...store.getState().owner, fired: true, offers: O.jobOffers(store.getState().teamRatings, user) } });
    const offer = store.getState().owner.offers[0];
    assert.notEqual(offer, user);
    store.getState().acceptJobOffer('not-an-offer');
    assert.equal(store.getState().userTeamId, user, 'only real offers are accepted');
    store.getState().acceptJobOffer(offer);
    const s = store.getState();
    assert.equal(s.userTeamId, offer);
    assert.equal(s.owner.teamId, offer);
    assert.equal(s.owner.fired, false);
    assert.equal(s.owner.trust, O.REHIRE_TRUST);
    assert.equal(s.owner.reviews.length, 1, 'résumé carries over');
    assert.equal(s.coachingStaff.filter(c => c.teamId === offer && c.role === 'HC').length, 1);

    // Achievements: a completed season unlocks something, unlocks are sticky,
    // tenure maps seasons to the club you coached, and a new franchise resets them.
    const L = await server.ssrLoadModule('/src/engine/legacy.js');
    assert.equal(new Set(L.ACHIEVEMENTS.map(a => a.id)).size, L.ACHIEVEMENTS.length, 'unique ids');
    const unlockedNow = store.getState().checkAchievements();
    assert.ok(unlockedNow.includes('survivor'), 'job change counts as a second club');
    assert.ok(unlockedNow.includes('first-win'));
    assert.deepEqual(store.getState().checkAchievements(), [], 'unlocks happen once');
    assert.equal(store.getState().legacyMeta.tenure.at(-1).from, 2025);
    const lctx = L.buildLegacyContext(store.getState());
    assert.equal(lctx.history.length, 1);
    assert.equal(lctx.history[0].wins, store.getState().seasonHistory[0].record.wins);
    store.getState().generateLeague();
    store.getState().selectTeam(TEAMS[5].id, { name: 'Fresh Coach' });
    assert.deepEqual(store.getState().achievements, {});
    assert.equal(store.getState().owner, null);

    console.log('PASS: achievements unlock once and reset per franchise.');
    console.log('PASS: owner archetypes, goal sizing, trust scoring, firing, review idempotence, job offers.');
} finally {
    await server.close();
}
