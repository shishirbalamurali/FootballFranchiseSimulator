// X-Factor tier (src/engine/xFactor.js + gameEngine hooks, Claude-owned):
// uniqueness, awards, calibration bands, determinism and counters.
import assert from 'node:assert/strict';
import { installTestRandomness, createSeededRandom } from './helpers/seededRandom.mjs';
installTestRandomness(90210);
import { simulateGame } from '../src/engine/simulation.js';
import { generateRoster } from '../src/engine/player.js';
import { abilityFor, describeAbility, seasonXFactorPass, seedLeagueXFactors, activeXFactors, XF_MAX_ACTIVE, FAMILY, createXFactorGame } from '../src/engine/xFactor.js';

// ── Abilities are deterministic, readable and unique ────────────────────────
const p = { id: 'QB-1', name: 'Jalen Okafor', position: 'QB', xFactor: { level: 1, seedBump: 0 } };
assert.deepEqual(abilityFor(p), abilityFor({ ...p }), 'same id → same ability');
const text = describeAbility(abilityFor(p));
assert.match(text, /^Once he .+, .+ \(\+\d+%\), until .+\.$/, `readable: ${text}`);
for (const pos of Object.keys(FAMILY)) assert.ok(abilityFor({ id: `x-${pos}`, name: 'A B', position: pos }), `${pos} has abilities`);

// 50 leagues: seeding never duplicates an ability key, never exceeds the cap.
for (let league = 0; league < 50; league++) {
    const rosters = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`t${i}`, generateRoster(i % 5 - 1).map((q, j) => ({ ...q, id: `L${league}-t${i}-${j}` }))]));
    const r = seedLeagueXFactors(rosters, 2024, 12);
    const active = activeXFactors(r);
    assert.ok(active.length <= XF_MAX_ACTIVE);
    assert.equal(new Set(active.map(x => abilityFor(x).key)).size, active.length, 'unique ability keys');
    // Season pass: give everyone a big season so awards compete for room.
    for (const roster of Object.values(r)) for (const q of roster) q.stats = { season: { yards: 5200, tds: 45, rushYards: 1600, rushTds: 15, recYards: 1500, recTds: 14, receptions: 110, sacks: 16, tackles: 120, ints: 7, pd: 18, fgm: 36 } };
    const pass = seasonXFactorPass(r, { year: 2025 });
    const after = activeXFactors(pass.rosters);
    assert.ok(after.length <= XF_MAX_ACTIVE, `cap holds (${after.length})`);
    assert.ok(pass.awakened.length <= 4, 'at most four new per season');
    assert.equal(new Set(after.map(x => abilityFor(x).key)).size, after.length, 'unique after awards');
}

// Dormancy: two quiet seasons switch an X-Factor off.
{
    const rosters = { a: [{ id: 'z', name: 'Z Z', position: 'WR', ovr: 90, age: 27, xFactor: { level: 1, seedBump: 0, since: 2023 }, stats: { season: {} } }] };
    const once = seasonXFactorPass(rosters, { year: 2024 });
    assert.ok(!once.rosters.a[0].xFactor.dormant, 'one quiet season is forgiven');
    const twice = seasonXFactorPass(once.rosters, { year: 2025 });
    assert.equal(twice.rosters.a[0].xFactor.dormant, true, 'dormant after two quiet seasons');
    assert.equal(twice.lost.length, 1);
}

// ── In-game state machine: activation and counters ──────────────────────────
{
    const qb = { id: 'qb', name: 'Q B', position: 'QB', ovr: 92, xFactor: { level: 1, seedBump: 0 } };
    const game = createXFactorGame([{ roster: [qb] }, { roster: [] }], {});
    const a = abilityFor(qb);
    const sit = { q: 4, clock: 100, down: 3, togo: 5, yl: 85, offense: 0, lead: [0, 0] };
    assert.equal(game.isActive(0, 'qb'), false);
    for (let i = 0; i < 3; i++) {
        if (a.activation.ev === 'passTd') game.event('td', sit, { side: 0, qb: 'qb' });
        else game.event('completion', sit, { side: 0, qb: 'qb', target: 'wr', yards: 30 });
    }
    assert.equal(game.isActive(0, 'qb'), true, `activates on ${a.activation.text}`);
    game.event('int', sit, { side: 0, qb: 'qb', defender: 'cb' });
    if (a.counter.counter.intThrown) assert.equal(game.isActive(0, 'qb'), false, 'an interception switches him off');
}

// ── Calibration: one X-Factor adds a little, not a lot ─────────────────────
const home = { id: 'chiefs' }, away = { id: 'bills' };
const base = Array.from({ length: 12 }, (_, i) => generateRoster(i % 3 - 1));
function withXF(roster, positions) {
    const out = roster.map(q => ({ ...q }));
    for (const pos of positions) {
        const best = out.filter(q => q.position === pos).sort((a, b) => b.ovr - a.ovr)[0];
        best.xFactor = { level: 1, seedBump: 0, since: 2024 };
    }
    return out;
}
const N = 2500;
// Paired games: control and X-Factor versions of each game start from the same
// random stream, so the difference measures the ability, not the dice.
function margin(xfPositions) {
    let pts = 0, wins = 0, activations = 0, games = 0;
    const saved = Math.random;
    for (let i = 0; i < N; i++) {
        Math.random = createSeededRandom(777 + i);
        const mine = xfPositions ? withXF(base[i % 12], xfPositions) : base[i % 12];
        const r = simulateGame(home, away, mine, base[(i + 5) % 12], null, null, {});
        pts += r.homeScore - r.awayScore;
        wins += r.homeScore > r.awayScore ? 1 : r.homeScore === r.awayScore ? 0.5 : 0;
        activations += (r.xfactor || []).reduce((n, x) => n + x.activations, 0);
        games++;
    }
    Math.random = saved;
    return { ppg: pts / games, win: wins / games, act: activations / games };
}
const control = margin(null);
const results = {};
for (const pos of ['QB', 'RB', 'WR', 'DL', 'CB', 'OL', 'K']) {
    const m = margin([pos]);
    results[pos] = { dPts: +(m.ppg - control.ppg).toFixed(2), dWin: +((m.win - control.win) * 100).toFixed(1), act: +m.act.toFixed(2) };
}
console.log('X-Factor effect vs control (points margin/game, win %, activations/game):', JSON.stringify(results));
const deltas = Object.values(results).map(r => r.dPts);
const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
assert.ok(avg > 0, `on average an X-Factor helps (${avg.toFixed(2)})`);
assert.ok(avg >= 0.25 && avg <= 1.2, `but never dominates (${avg.toFixed(2)} ppg)`);
for (const [pos, r] of Object.entries(results)) assert.ok(r.dPts > -0.3 && r.dPts < 2.5, `${pos} is balanced (${r.dPts})`);
assert.ok(Object.values(results).some(r => r.act > 0.3), 'X-Factors actually get in the zone');

console.log('PASS: X-Factor uniqueness, awards/dormancy, zone state machine, calibration bands');
