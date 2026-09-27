// Front-office overhaul (Claude-owned): scouting fog, CPU boards, trade talks,
// future and compensatory picks, contracts, college Saturdays, coaching
// careers, and a full season → offseason → draft → camp loop through the store.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(4401);
import { createServer } from 'vite';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
    const S = await server.ssrLoadModule('/src/engine/scouting.js');
    const C = await server.ssrLoadModule('/src/engine/collegeSeason.js');
    const T = await server.ssrLoadModule('/src/engine/tradeTalks.js');
    const A = await server.ssrLoadModule('/src/engine/assetValue.js');
    const K = await server.ssrLoadModule('/src/engine/contracts.js');
    const P = await server.ssrLoadModule('/src/engine/picks.js');
    const SC = await server.ssrLoadModule('/src/engine/staffCareers.js');
    const PS = await server.ssrLoadModule('/src/engine/playerStatus.js');
    const { createCollegePipeline, collegeDraftClass, updateCollege } = await server.ssrLoadModule('/src/engine/collegePipeline.js');
    const { packCollege, unpackCollege } = await server.ssrLoadModule('/src/engine/franchiseSave.js');
    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.js');
    const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');
    const ids = TEAMS.map(t => t.id);

    // ── Scouting: fog is honest and never leaks ──────────────────────────────
    const pipeline = createCollegePipeline(2024);
    const cls = collegeDraftClass(pipeline, 2025);
    let exact = 0, inRange = 0;
    for (const p of cls) {
        const v = S.perceive(p, { teamId: 'u', k: 10 });
        if (v.ovr === p.ovr) exact++;
        if (p.ovr >= v.lo && p.ovr <= v.hi) inRange++;
        const w = [10, 40, 70, 95].map(k => S.perceive(p, { teamId: 'u', k }).width);
        assert.ok(w.every((x, i) => i === 0 || x <= w[i - 1]), 'range narrows as knowledge grows');
    }
    assert.ok(exact < cls.length * 0.2, `unscouted estimates are not the truth (${exact}/${cls.length})`);
    assert.ok(inRange > cls.length * 0.85, `the truth is usually inside the range (${inRange}/${cls.length})`);
    const offsets = new Set(cls.slice(0, 60).map(p => S.perceive(p, { teamId: 'u', k: 10 }).ovr - p.ovr));
    assert.ok(offsets.size > 5, 'offsets vary prospect to prospect (the old id-char leak gave one offset)');
    assert.deepEqual(S.perceive(cls[0], { teamId: 'u', k: 30 }), S.perceive(cls[0], { teamId: 'u', k: 30 }), 'perception is stable');
    // Public grade differs from the old truth formula.
    assert.ok(cls.filter(p => p.grade !== Math.round(p.ovr * 0.45 + p.pot * 0.55)).length > cls.length * 0.5, 'visible grade is not the true grade');
    // CPU boards disagree.
    const rank = teamId => S.boardFor(teamId, cls).sort((a, b) => b.grade - a.grade).map(p => p.id);
    const a = rank(ids[1]).slice(0, 40), b = rank(ids[2]).slice(0, 40);
    assert.ok(a.filter((id, i) => b[i] !== id).length > 20, 'CPU boards differ');
    const cons = S.consensus(cls, ids.slice(1));
    assert.equal(cons.size, cls.length);
    assert.ok([...cons.values()].every(c => c.lo <= c.rank && c.hi >= c.rank));
    // Assignments add knowledge.
    let dept = S.defaultScouting(ids[0], 2024);
    dept = { ...dept, board: { order: [cls[0].id], tiers: {} } };
    const after = S.runAssignments(dept, cls, { week: 1, year: 2024 });
    assert.ok(S.knowledgeOf(after, cls[0].id) > S.knowledgeOf(dept, cls[0].id), 'watching a player teaches you about him');
    assert.equal(S.runAssignments(after, cls, { week: 1, year: 2024 }), after, 'once per week');
    assert.ok(S.scoutOpinions(cls[0], after, ids[0]).length >= 2, 'multiple scout opinions');

    // ── College Saturdays ──────────────────────────────────────────────────
    assert.equal(C.SCHOOLS.length, 96);
    let college = C.playCollegeThrough(null, pipeline, 2024, 17);
    const table = C.standingsFor(college);
    assert.equal(table.reduce((n, r) => n + r.w, 0), table.reduce((n, r) => n + r.l, 0), 'wins = losses');
    assert.ok(table.every(r => r.w + r.l >= 12), 'everyone plays twelve');
    assert.equal(C.pollFor(college, pipeline, 2024).length, 25);
    assert.ok(college.champion != null && college.playoff.seeds.length === 12, 'a national champion');
    assert.deepEqual(C.playCollegeThrough(college, pipeline, 2024, 17), college, 'idempotent');
    // Stories fire once, survive a save round-trip, and render.
    let grown = pipeline;
    for (let w = 1; w <= 18; w++) grown = C.advanceStories(grown, 2024, w);
    const again = C.advanceStories(unpackCollege(packCollege(grown)), 2024, 18);
    assert.deepEqual(again.map(p => p.events.length), grown.map(p => p.events.length), 'story beats fire exactly once across reload');
    const withStory = grown.find(p => p.events.some(e => e.text.startsWith(C.STORY_MARK)));
    assert.ok(withStory && !C.eventText(withStory, withStory.events.find(e => e.text.startsWith(C.STORY_MARK))).startsWith(C.STORY_MARK));
    const moves = C.offseasonMoves(updateCollege(grown, 2024, 18), 2024);
    assert.ok(moves.declared >= 10 && moves.declared <= 40, `declarations ${moves.declared}`);
    assert.equal(moves.pipeline.filter(p => p.draftYear === 2025).length, pipeline.filter(p => p.draftYear === 2025).length + moves.declared);

    // ── Picks, values, contracts ─────────────────────────────────────────────
    const owners = P.ensurePickYears(Object.fromEntries(ids.map(id => [id, [1, 2, 3, 4, 5, 6, 7].map(round => ({ round, originalTeamId: id }))])), ids, 2025);
    assert.equal(Object.values(owners).flat().length, 448);
    const rolled = P.rollPicks(owners, ids, 2025);
    assert.ok(Object.values(rolled).flat().every(p => p.year === 2026 || p.year === 2027));
    assert.deepEqual(P.unpackPicks(P.packPicks(owners)), owners, 'pick packing is lossless');
    for (let n = 2; n <= 224; n++) assert.ok(A.pickNumberValue(n) < A.pickNumberValue(n - 1), `pick chart decreases at ${n}`);
    assert.ok(A.pickAssetValue({ year: 2026, round: 1, originalTeamId: ids[0] }, { currentDraftYear: 2025 }) < A.pickAssetValue({ year: 2025, round: 1, originalTeamId: ids[0] }, { currentDraftYear: 2025 }), 'future picks are discounted');
    const deal = K.structuredContract({ salary: 10, years: 4, guaranteePct: 0.5, bonusPct: 0.2, year: 2025 });
    assert.equal(K.deadMoney({ contract: deal }), 28, 'bonus proration + guarantees accelerate');
    assert.equal(K.deadMoney({ contract: { salary: 10, years: 4, yearsLeft: 2 } }), 0, 'old contracts carry no dead money');
    const comp = P.compPicks([{ kind: 'rival', teamId: ids[1], from: ids[0], ovr: 86 }, { kind: 'rival', teamId: ids[2], from: ids[0], ovr: 78 }], 2025);
    assert.deepEqual(comp[ids[0]].map(p => p.round), [3, 5]);

    // ── Store: a full franchise year ─────────────────────────────────────────
    const user = ids[0];
    store.getState().generateLeague();
    store.getState().selectTeam(user, { name: 'Test Coach' });
    store.getState().ensureFranchiseSystems();
    let s = store.getState();
    assert.ok(s.frontOffice && s.scouting && s.college, 'systems initialise');
    assert.ok(Object.values(s.draftPickOwners).flat().every(p => p.year), 'every pick has a year');
    assert.ok(Object.values(s.rosters).flat().filter(p => p.xFactor).length >= 4, 'the league starts with X-Factors');

    // Trades are deterministic; counters are acceptable as proposed.
    const partner = ids[5];
    const star = [...s.rosters[partner]].sort((x, y) => y.ovr - x.ovr)[0];
    const lowball = { partner, give: { players: [], picks: [s.draftPickOwners[user].find(p => p.round === 7)] }, get: { players: [star.id], picks: [] } };
    const e1 = T.evaluateProposal(s, lowball), e2 = T.evaluateProposal(s, lowball);
    assert.deepEqual(e1, e2, 'same offer, same answer');
    assert.equal(e1.ok, false);
    const ask = T.whatWouldItTake(s, partner, [star.id]);
    if (ask) assert.ok(T.evaluateProposal(s, ask).ok, 'what-would-it-take is acceptable');
    const cheap = [...s.rosters[partner]].filter(p => p.ovr < 70).sort((x, y) => x.ovr - y.ovr)[0];
    const small = { partner, give: { players: [], picks: [s.draftPickOwners[user].find(p => p.round === 6)] }, get: { players: [cheap.id], picks: [] } };
    const c = T.counterOffer(s, small);
    if (c) assert.ok(T.evaluateProposal(s, c.proposal).ok, 'a counter proposed as-is is accepted');
    const r = store.getState().foProposeTrade(c ? c.proposal : small);
    if (r.ok) assert.ok(store.getState().rosters[user].some(p => p.id === cheap.id), 'accepted trade moves the player');

    // Status: the card's primary status reflects an injury first.
    const me = store.getState().rosters[user][0];
    const st = PS.playerStatus(me, { own: true, roster: store.getState().rosters[user], injuries: [{ playerId: me.id, weeksRemaining: 2, type: 'Ankle' }], week: 3 });
    assert.equal(st.primary.id, 'injured');

    // Season: weekly front-office loop runs once per week.
    for (let i = 0; i < 18; i++) store.getState().simulateWeek();
    s = store.getState();
    assert.equal(s.frontOffice.lastWeekRun, `${s.year}-18`);
    assert.ok(Object.keys(s.college.results).length >= 12, 'college season played alongside');
    assert.ok(s.frontOffice.inbox.length <= 40);

    // Dead money on a cut.
    const victim = s.rosters[user].find(p => p.ovr < 70);
    store.setState({ rosters: { ...s.rosters, [user]: s.rosters[user].map(p => p.id === victim.id ? { ...p, contract: K.structuredContract({ salary: 3, years: 3, guaranteePct: 0.5, year: s.year }) } : p) } });
    store.getState().cutPlayer(victim.id);
    assert.ok(store.getState().frontOffice.deadCap[store.getState().year] > 0, 'guaranteed money becomes dead cap');

    // Playoffs → offseason.
    store.getState().generatePlayoffs();
    let guard = 0;
    while (!store.getState().playoffBracket?.sb?.played && guard++ < 20) store.getState().simPlayoffRound();
    store.getState().concludeSeason();
    s = store.getState();
    assert.equal(s.phase, 'offseason');
    assert.equal(s.frontOffice.seasonEndYear, s.year);
    assert.equal(s.frontOffice.offseasonYear, s.year);
    assert.ok(s.frontOffice.collegeHistory[0]?.champion, 'a college champion is recorded');
    // Re-sign window: advice covers every expiring player.
    const expiring = store.getState().foExpiring();
    assert.equal(store.getState().foResignAdvice().length, expiring.length);
    // Stages advance to the draft.
    assert.equal(store.getState().foAdvance(), 'resign');
    assert.equal(store.getState().foAdvance(), 'combine');
    assert.equal(store.getState().foAdvance(), 'fa');
    assert.equal(store.getState().phase, 'freeAgency');
    assert.ok(store.getState().draftClass.length >= 350, 'the combine class carries into free agency');
    store.getState().foFAVisit(store.getState().freeAgents[0].id);
    assert.equal(store.getState().foAdvance(), 'prodays');
    assert.equal(store.getState().foAdvance(), 'draft');
    const order = store.getState().draftOrder;
    assert.ok(order.every(o => o.year === store.getState().year + 1));
    assert.equal(new Set(order.map(o => `${o.originalTeamId}:${o.round}:${o.comp || 0}`)).size, order.length);
    assert.equal(store.getState().foAdvance(), 'udfa');
    const userPicks = store.getState().draftHistory.filter(h => h.teamId === user);
    assert.ok(userPicks.length >= 5);
    assert.ok(userPicks.every(h => store.getState().rosters[user].find(p => p.id === h.player.id)?.scoutedAs), 'rookies remember how we graded them');
    assert.equal(store.getState().foAdvance(), 'camp');
    s = store.getState();
    assert.equal(s.phase, 'regular');
    assert.ok(s.frontOffice.camp.reveals.length >= 5, 'camp reveal');
    assert.ok(s.frontOffice.camp.reveals.every(x => typeof x.actual === 'number' && x.label));
    assert.ok(Object.keys(s.scouting.hitRates).length > 0, 'scout hit rates update');
    assert.equal(store.getState().foAdvance(), null);
    assert.ok(Object.values(s.draftPickOwners).flat().every(p => p.year === s.year + 1 || p.year === s.year + 2), 'picks roll forward');

    // Coaching careers: profile, tree, poach block.
    const coaches = s.coachingStaff;
    const prof = SC.coachProfile(coaches[0], s.year);
    assert.ok(prof.age > 30 && prof.traits.length === 2 && prof.ratings.offense >= 30);
    const hc = coaches.find(x => x.teamId === user && x.role === 'HC');
    assert.ok(SC.treeOf(coaches, hc.id), 'a tree rooted at you');
    const oc = coaches.find(x => x.teamId === user && x.role === 'OC');
    if (oc) {
        const moved = coaches.map(x => x.id === oc.id ? { ...x, teamId: ids[9], role: 'HC', history: [...x.history, { year: s.year, teamId: ids[9], role: 'HC', event: 'Hired' }] } : x.teamId === ids[9] && x.role === 'HC' ? { ...x, teamId: null } : x);
        assert.equal(SC.poachedFromUser(coaches, moved, user).length, 1);
        const blocked = SC.blockPoach(moved, oc.id, user, 'OC', s.year);
        assert.equal(blocked.find(x => x.id === oc.id).teamId, user);
        assert.ok(blocked.some(x => x.teamId === ids[9] && x.role === 'HC'), 'the rival hires someone else');
    }

    // Save round-trip keeps every new system.
    await new Promise(res => setTimeout(res, 350));
    const { useGameStore: reloaded } = await server.ssrLoadModule('/src/store/gameStore.js?fo-reload');
    const rs = reloaded.getState();
    assert.deepEqual(rs.draftPickOwners, store.getState().draftPickOwners, 'picks survive a reload');
    assert.deepEqual(rs.frontOffice.camp, store.getState().frontOffice.camp);
    assert.deepEqual(rs.scouting.hitRates, store.getState().scouting.hitRates);
    console.log('PASS: scouting fog, CPU boards, college Saturdays, picks/values/contracts, trade talks, statuses, full season → offseason stages → draft → camp, coaching careers, save round-trip');
} finally { await server.close(); }
