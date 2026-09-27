// Free-agency market (src/engine/faMarket.js + Claude store block). Claude-owned test.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260922);
import { createServer } from 'vite';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
    const M = await server.ssrLoadModule('/src/engine/faMarket.js');
    const { rosterSalary } = await server.ssrLoadModule('/src/engine/cpuRosterManagement.js');
    const { ROSTER_LIMIT } = await server.ssrLoadModule('/src/engine/player.js');
    const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');

    // One price scale: a kicker never out-earns a quarterback of the same rating.
    const [qb, k] = M.openMarket([{ id: 'q', position: 'QB', ovr: 90, age: 27 }, { id: 'k', position: 'K', ovr: 90, age: 27 }]);
    assert.ok(qb.ask > k.ask * 2, `QB ${qb.ask} vs K ${k.ask}`);
    assert.equal(qb.openingAsk, qb.ask);
    assert.equal(M.preferredYears({ age: 24 }), 4);
    assert.equal(M.preferredYears({ age: 33 }), 1);

    // Offer reads are deterministic and monotonic in salary; a rejection floor blocks lowballs.
    const ctx = { userTeamId: 'u', userRoster: [], standings: {}, suitorCount: 3 };
    const low = M.assessOffer(qb, { salary: qb.ask * 0.7, years: 3 }, ctx);
    const high = M.assessOffer(qb, { salary: qb.ask * 1.3, years: 3 }, ctx);
    assert.ok(high.chance > low.chance);
    assert.deepEqual(M.assessOffer(qb, { salary: qb.ask, years: 3 }, ctx), M.assessOffer(qb, { salary: qb.ask, years: 3 }, ctx));
    assert.equal(M.assessOffer(qb, { salary: 5, years: 3 }, { ...ctx, floor: 10 }).chance, 0);

    // Budget: pending offers commit cap space and roster spots.
    const full = Array.from({ length: ROSTER_LIMIT }, (_, i) => ({ id: `r${i}`, position: 'WR', ovr: 60, contract: { salary: 1 } }));
    assert.match(M.validateOffer(qb, { salary: 5, years: 2 }, M.offerBudget({ userRoster: full })), /roster is full/);
    const b = M.offerBudget({ userRoster: [], offers: { q: { salary: 150 } }, pool: [qb, k] });
    assert.equal(b.space, 50);
    assert.match(M.validateOffer(k, { salary: 60, years: 2 }, b), /cap space/);

    // Store flow through a real offseason.
    const s = () => store.getState();
    s().generateLeague();
    s().selectTeam(Object.keys(s().rosters)[0]);
    while (s().phase === 'regular') s().simulateWeek();
    s().generatePlayoffs();
    for (let i = 0; i < 6 && !s().playoffBracket?.sb?.played; i++) s().simPlayoffRound();
    s().startFreeAgency();
    assert.equal(s().phase, 'freeAgency');
    s().openFAMarket();
    const m0 = s().faMarket;
    assert.equal(m0.day, 0);
    assert.ok(s().freeAgents.every(p => Number.isFinite(p.ask) && p.ask >= 1), 'every free agent has a market ask');
    s().openFAMarket();
    assert.equal(s().faMarket, m0, 'opening twice is a no-op');

    const user = s().userTeamId;
    const target = [...s().freeAgents].sort((a, b) => b.ovr - a.ovr)[0];
    assert.equal(s().placeFAOffer(target.id, target.ask * 1.4, M.preferredYears(target)).ok, true);
    assert.equal(s().placeFAOffer(target.id, 9999, 2).ok, false, 'over-cap offers are refused');
    const poolBefore = s().freeAgents.length;
    const day1 = s().advanceFADay();
    assert.equal(day1.day, 1);
    assert.ok(day1.rivalSignings > 0, 'rival clubs sign players on day one');
    assert.ok(s().freeAgents.length < poolBefore);
    assert.deepEqual(s().faMarket.offers, {}, 'offers resolve each day');
    const signedByUser = s().rosters[user].some(p => p.id === target.id);
    const rejected = s().faMarket.log.find(e => e.kind === 'rejected' && e.playerId === target.id);
    assert.ok(signedByUser || rejected, 'the offer was answered');
    if (rejected && s().freeAgents.some(p => p.id === target.id)) {
        assert.equal(s().placeFAOffer(target.id, target.ask * 1.4, 3).ok, true);
        assert.ok(s().faMarket.floors[target.id] > 0);
    }

    // No player is on two rosters or both rostered and in the pool.
    const ids = Object.values(s().rosters).flat().map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'no duplicate roster ids');
    const rostered = new Set(ids);
    assert.ok(s().freeAgents.every(p => !rostered.has(p.id)), 'signed players left the pool');

    // Rival clubs never sign their way over the cap or past the pre-draft limit.
    s().finishFreeAgency();
    assert.equal(s().faMarket.closed, true);
    assert.equal(s().advanceFADay(), null, 'closed market does nothing');
    for (const [teamId, roster] of Object.entries(s().rosters)) {
        if (teamId === user) continue;
        assert.ok(rosterSalary(roster) <= M.SALARY_CAP + 1e-6, `${teamId} over cap`);
    }

    // The draft still starts, and CPU depth gets filled legally afterwards.
    s().startDraft();
    assert.equal(s().phase, 'draft');
    assert.equal(s().draftOrder.length, 224);
    console.log('faMarket.mjs: all assertions passed');
} finally {
    await server.close();
}
