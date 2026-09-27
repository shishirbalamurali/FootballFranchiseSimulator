// Franchise culture/history + decision scenes (src/engine/franchiseLore.js). Claude-owned test.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260926);
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
    const L = await server.ssrLoadModule('/src/engine/franchiseLore.js');
    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.js');
    const { generateWeeklyEvent } = await server.ssrLoadModule('/src/engine/progression.js');

    // Every franchise has complete lore with a real culture, and titles precede the save.
    assert.equal(Object.keys(L.LORE).length, TEAMS.length);
    for (const t of TEAMS) {
        const lore = L.loreFor(t.id);
        assert.ok(lore, `missing lore for ${t.id}`);
        assert.ok(L.CULTURES[lore.culture], `bad culture for ${t.id}`);
        assert.ok(lore.origin.length > 40 && lore.legends.length === 2 && lore.eras.length === 3, t.id);
        assert.ok(lore.titles.every(y => y >= lore.founded && y < L.LEAGUE_START_YEAR), t.id);
    }
    // Every culture is used somewhere.
    assert.equal(new Set(TEAMS.map(t => L.loreFor(t.id).culture)).size, Object.keys(L.CULTURES).length);

    // Titles won in the save are merged on top of the static history.
    const h = L.franchiseHistory('lions', [
        { year: 2024, seasonRecap: { year: 2024, winner: 'lions', playoffTeams: ['lions'] } },
        { year: 2025, seasonRecap: { year: 2025, winner: 'rams', finalist: 'lions', playoffTeams: ['lions', 'rams'] } },
    ]);
    assert.deepEqual(h.saveTitles, [2024]);
    assert.deepEqual(h.saveFinals, [2025]);
    assert.equal(h.lastTitle, 2024);
    assert.equal(h.playoffs, 2);
    assert.ok(L.franchiseHistory('falcons', []).neverWon);

    // Every event the engine can generate gets stances, a quote and effect chips.
    const roster = Array.from({ length: 40 }, (_, i) => ({
        id: `p${i}`, name: `Test Player${i}`, position: 'WR', ovr: 60 + (i % 35), age: 21 + (i % 14),
        experience: i % 12, contract: { yearsLeft: i % 3, salary: 5 },
    }));
    const seen = new Set();
    for (let i = 0; i < 400 && seen.size < 10; i++) {
        const ev = generateWeeklyEvent(roster, 3);
        if (!ev || seen.has(ev.type)) continue;
        seen.add(ev.type);
        const scene = L.decisionScene(ev, { teamId: 'bears', roster });
        assert.ok(scene.quote && scene.category && scene.stakes, ev.type);
        scene.choices.forEach((c, idx) => {
            assert.ok(L.choiceStances(ev.type, idx).length > 0, `${ev.type}[${idx}] has no stance`);
            assert.ok(c.chips.length > 0 && [-1, 0, 1].includes(c.fit) && c.reaction, ev.type);
        });
    }
    assert.equal(seen.size, 10);

    // Culture actually discriminates: blue-collar Chicago loves playing through it, the players' club does not.
    assert.equal(L.cultureReaction('bears', 'INJURY_SCARE', 1).fit, 1);
    assert.equal(L.cultureReaction('saints', 'INJURY_SCARE', 1).fit, 0);
    assert.equal(L.cultureReaction('saints', 'INJURY_SCARE', 0).fit, 1);
    assert.equal(L.cultureReaction('bears', 'INJURY_SCARE', 0).fit, -1);
    console.log('franchiseLore: ok');
} finally {
    await server.close();
}
