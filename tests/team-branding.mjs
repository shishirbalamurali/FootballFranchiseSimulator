import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TEAMS } from '../src/data/teams.js';
import { PLAYBOOKS, TEAM_PLAYBOOK_MAP } from '../src/data/playbooks.js';
import { refreshSavedTeamBranding } from '../src/engine/teamBranding.js';
import { contrastRatio } from '../src/components/ui/contrast.js';

const stableIds = 'ravens bengals browns steelers texans colts jaguars titans bills dolphins patriots jets broncos chiefs raiders chargers bears lions packers vikings falcons panthers saints bucs cowboys giants eagles commanders cardinals 49ers seahawks rams'.split(' ');
assert.deepEqual(TEAMS.map(t => t.id), stableIds, 'save/import keys and array ordering remain compatible');
assert.equal(new Set(TEAMS.map(t => t.brandId)).size, 32);
assert.equal(new Set(TEAMS.map(t => t.abbreviation)).size, 32);
assert.equal(TEAMS.find(t => t.name === 'Tridents').location, 'San Jose');
assert.equal(TEAMS.find(t => t.name === 'Bison').location, 'Oklahoma City');
for (const conference of ['AFC', 'NFC']) {
    for (const division of ['North', 'South', 'East', 'West']) {
        assert.equal(TEAMS.filter(t => t.conference === conference && t.division === division).length, 4);
    }
}
for (const team of TEAMS) {
    assert.ok(existsSync(new URL(`../src/assets/team-logos/franchises/${team.brandId}.webp`, import.meta.url)), team.brandId);
    const playbook = PLAYBOOKS.find(p => p.id === TEAM_PLAYBOOK_MAP[team.id]);
    assert.equal(playbook.color, team.theme.primary);
}
const oldTeam = { id: '49ers', location: 'San Francisco', name: 'Prospectors', theme: { primary: '#aa0000' }, wins: 12 };
const saved = { initialized: false, userTeamId: '49ers', teams: [oldTeam], rosters: { '49ers': [{ id: 'player-1' }] },
    standings: { '49ers': { ...oldTeam, losses: 5, pf: 400, pa: 320 }, chiefs: { id: 'chiefs', wins: 10, losses: 7 } },
    schedule: [[{ homeTeamId: '49ers', awayTeamId: 'chiefs', played: true, homeScore: 21, awayScore: 14 }]],
    draftPickOwners: { '49ers': [{ originalTeamId: 'chiefs', round: 1 }] },
    seasonRecap: { year: 2030, champion: oldTeam },
    seasonHistory: [{ year: 2029, seasonRecap: { champion: oldTeam }, champion: oldTeam }],
};
const before = JSON.stringify(saved);
const refreshed = refreshSavedTeamBranding(saved);
assert.equal(refreshed.teams.length, 32);
assert.equal(refreshed.teams.find(t => t.id === '49ers').wins, 12);
assert.equal(refreshed.standings['49ers'].name, 'Tridents');
assert.equal(refreshed.standings['49ers'].pf, 400);
assert.deepEqual(refreshed.standings.chiefs, saved.standings.chiefs, 'normal standings rows remain slim');
assert.equal(refreshed.seasonRecap.champion.name, 'Tridents');
assert.equal(refreshed.seasonHistory[0].seasonRecap.champion.location, 'San Jose');
assert.equal(refreshed.seasonHistory[0].champion.name, 'Tridents');
assert.equal(refreshed.rosters, saved.rosters);
assert.equal(refreshed.schedule, saved.schedule);
assert.equal(refreshed.draftPickOwners, saved.draftPickOwners);
assert.equal(JSON.stringify(saved), before, 'migration must not mutate source saves');
assert.deepEqual(refreshSavedTeamBranding(refreshed), refreshed, 'migration is idempotent');
assert.equal(refreshSavedTeamBranding({}).teams.length, 32);

const storage = new Map([['gridiron_save_slot_0', JSON.stringify(saved)]]);
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const server = await createServer({ optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
    const { buildTeamTheme } = await server.ssrLoadModule('/src/styles/teamStyles.js');
    const { TeamCrest } = await server.ssrLoadModule('/src/components/ui/TeamCrest.jsx');
    for (const team of TEAMS) {
        const { vars } = buildTeamTheme(team);
        for (const key of ['primary', 'secondary', 'accent']) {
            assert.ok(contrastRatio(vars[`--team-${key}`], vars[`--team-on-${key}`]) >= 4.5, `${team.brandId} ${key} fill text contrast`);
        }
        assert.ok(contrastRatio(vars['--text-primary'], vars['--surface-raised']) >= 4.5, team.brandId);
        const html = renderToStaticMarkup(createElement(TeamCrest, { team }));
        assert.ok(html.includes(`/franchises/${team.brandId}.webp`), `${team.brandId} resolves supplied artwork`);
        assert.ok(html.includes(`${team.location} ${team.name} crest`));
        assert.ok(!html.includes('drop-shadow'));
    }
    const oldCrest = renderToStaticMarkup(createElement(TeamCrest, { team: oldTeam }));
    assert.ok(oldCrest.includes('San Jose Tridents crest'));
    assert.ok(oldCrest.includes('/franchises/san-jose-tridents.webp'));
    const { useGameStore } = await server.ssrLoadModule('/src/store/gameStore.js');
    const loaded = useGameStore.getState();
    assert.equal(loaded.teams.find(t => t.id === '49ers').name, 'Tridents');
    assert.equal(loaded.seasonHistory[0].seasonRecap.winner, '49ers');
    assert.deepEqual(loaded.rosters, saved.rosters);
    assert.deepEqual(loaded.schedule, saved.schedule);
    assert.deepEqual(loaded.draftPickOwners, saved.draftPickOwners);
    assert.equal(loaded.userTeamId, '49ers');
    console.log('PASS: 32 franchise identities/assets, all theme contrast pairs, canonical crests, playbooks and actual legacy save hydration');
} finally {
    await server.close();
}
