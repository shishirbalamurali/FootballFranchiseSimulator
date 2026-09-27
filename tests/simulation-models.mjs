import assert from 'node:assert/strict';
import { generateRoster } from '../src/engine/player.js';
import { simulateGame, calculateTeamRatings } from '../src/engine/simulation.js';
import { createSeededRandom } from './helpers/seededRandom.mjs';
Math.random = createSeededRandom(77031);
const home = { id: 'colts' }, away = { id: 'lions' };
const roster = generateRoster(), opponent = generateRoster();
for (let i = 0; i < 300; i++) {
    const result = simulateGame(home, away, roster, opponent);
    for (const side of ['home', 'away']) {
        const lines = Object.values(result[`${side}PlayerStats`]);
        const qb = lines.find(s => s.player.position === 'QB');
        const receivers = lines.filter(s => ['WR','TE','RB'].includes(s.player.position));
        const sum = (rows, key) => rows.reduce((n,s) => n + (s[key] || 0), 0);
        assert.equal(sum(receivers, 'receptions'), qb.completions || 0);
        assert.equal(sum(receivers, 'recYards'), qb.yards || 0);
        assert.equal(sum(receivers, 'recTds'), (qb.tds || 0) - (qb.rushTds || 0));
        assert.equal(sum(receivers, 'targets'), qb.attempts || 0, 'target opportunities conserve attempts');
        for (const s of receivers) assert.ok((s.recTds || 0) <= (s.receptions || 0), 'TD catch requires a reception');
        const team = result[`${side}Stats`];
        assert.equal(team.rushYards, sum(lines, 'rushYards'));
        assert.equal(team.rushAttempts, sum(lines, 'carries'));
        assert.equal(team.plays, (qb.attempts || 0) + (qb.sacks || 0) + team.rushAttempts);
    }
}
const testRoster = structuredClone(roster);
const starter = testRoster.filter(p=>p.position==='QB').sort((a,b)=>b.ovr-a.ovr)[0];
simulateGame(home, away, testRoster, opponent); // populate any profile cache
starter.injured = true;
assert.ok(!simulateGame(home, away, testRoster, opponent).homePlayerStats[starter.id], 'in-place injury excludes starter');
const makeBlocking = rating => roster.map(p => p.position === 'OL' ? {...p, attributes: {...p.attributes, position: {...p.attributes.position, passBlock: rating}}} : p);
const weak = makeBlocking(40), strong = makeBlocking(99);
assert.ok(calculateTeamRatings(strong).offense.passBlock > calculateTeamRatings(weak).offense.passBlock);
const totals = team => {
    Math.random = createSeededRandom(89012);
    let sacks=0, yards=0;
    for(let i=0;i<600;i++) { const r=simulateGame(home,away,team,opponent); sacks+=r.homeStats.sacks; yards+=r.homeStats.passYards; }
    return {sacks,yards};
};
const low=totals(weak),high=totals(strong);
assert.ok(high.sacks < low.sacks * .8, 'pass protection has material impact at equal OVR');
console.log('PASS: target/reception/TD conservation, play counts, injuries, pass-protection matchup.');
