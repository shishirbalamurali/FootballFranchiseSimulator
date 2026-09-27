// Front-office soak (Claude-owned, not in npm test: ~2-3 min). Plays several
// full franchise years through the store with every stage auto-resolved and
// checks the invariants that only show up over time.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(Number(process.env.SOAK_SEED || 777));
import { createServer } from 'vite';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const YEARS = Number(process.env.SOAK_YEARS || 4);
try {
    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.js');
    const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');
    const { activeXFactors, abilityFor, XF_MAX_ACTIVE } = await server.ssrLoadModule('/src/engine/xFactor.js');
    const { rosterSalary } = await server.ssrLoadModule('/src/engine/cpuRosterManagement.js');
    const { packCollege } = await server.ssrLoadModule('/src/engine/franchiseSave.js');
    const s = () => store.getState();
    s().generateLeague();
    s().selectTeam(TEAMS[7].id, { name: 'Soak Coach' });
    s().ensureFranchiseSystems();
    for (let y = 0; y < YEARS; y++) {
        const year = s().year;
        for (let w = 0; w < 19 && s().phase === 'regular'; w++) s().simulateWeek();
        if (!s().playoffBracket) s().generatePlayoffs();
        for (let i = 0; i < 12 && !s().playoffBracket?.sb?.played; i++) s().simPlayoffRound();
        s().concludeSeason();
        assert.equal(s().phase, 'offseason', `year ${year}: offseason`);
        let guard = 0;
        while (s().phase !== 'regular' && guard++ < 20) s().foAdvance();
        s().foAdvance(); // camp
        assert.equal(s().phase, 'regular', `year ${year}: back to the regular season`);
        assert.equal(s().year, year + 1);
        // Invariants.
        const xfs = activeXFactors(s().rosters);
        assert.ok(xfs.length <= XF_MAX_ACTIVE, `X-Factor cap (${xfs.length})`);
        assert.equal(new Set(xfs.map(p => abilityFor(p).key)).size, xfs.length, 'unique abilities');
        const picks = Object.values(s().draftPickOwners).flat();
        assert.ok(picks.every(p => p.year === s().year + 1 || p.year === s().year + 2), 'picks cover the next two drafts');
        assert.ok(picks.filter(p => !p.comp).length === 448, `448 regular picks (${picks.filter(p => !p.comp).length})`);
        for (const t of TEAMS) {
            if (t.id === s().userTeamId) continue;
            const r = s().rosters[t.id];
            assert.ok(r.length >= 46 && r.length <= 53, `${t.id} roster ${r.length}`);
            assert.ok(rosterSalary(r) <= 200 + 1e-6, `${t.id} cap ${rosterSalary(r)}`);
        }
        const ids = Object.values(s().rosters).flat().map(p => p.id);
        assert.equal(new Set(ids).size, ids.length, 'no player on two rosters');
        assert.ok(s().collegePipeline.length >= 1250 && s().collegePipeline.length <= 1450, `pipeline ${s().collegePipeline.length}`);
        const hc = s().coachingStaff.filter(c => c.teamId && c.role === 'HC');
        assert.equal(new Set(hc.map(c => c.teamId)).size, 32, 'every club has a head coach');
        const fo = s().frontOffice, sc = s().scouting;
        const sizes = { frontOffice: JSON.stringify(fo).length, scouting: JSON.stringify(sc).length, college: JSON.stringify(s().college).length, pipeline: JSON.stringify(packCollege(s().collegePipeline)).length };
        console.log(`year ${year} done: ${xfs.length} X-Factors, ${Object.keys(sc.knowledge).length} scouted, inbox ${fo.inbox.length}, retired coaches ${s().coachingStaff.filter(c => c.retired).length}, sizes KB ${JSON.stringify(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.round(v / 1024)])))}`);
        assert.ok(sizes.frontOffice < 60000 && sizes.scouting < 60000 && sizes.college < 30000, 'front-office save budget');
    }
    console.log(`PASS: ${YEARS} franchise years with every stage auto-resolved; caps, rosters, picks, X-Factors, staff and save budget hold`);
} finally { await server.close(); }
