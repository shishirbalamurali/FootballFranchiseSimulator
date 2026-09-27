import assert from 'node:assert/strict';
import { generatePlayer, calculateOVR, POSITIONS } from '../src/engine/player.js';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260927);
const mean = (players, attribute) => players.reduce((sum, p) => sum + (attribute ? p.attributes.universal[attribute] : p.ovr), 0) / players.length;
const samples = Object.fromEntries(Object.keys(POSITIONS).map(pos => [pos, Array.from({ length: 1500 }, () => generatePlayer(pos, 75, 23))]));
assert.ok(mean(samples.WR, 'speed') - mean(samples.OL, 'speed') > 25, 'receivers have clearly different speed tools than linemen');
assert.ok(mean(samples.OL, 'strength') - mean(samples.WR, 'strength') > 20, 'linemen have clearly different strength tools than receivers');
assert.ok(mean(samples.CB, 'speed') > 87, 'coverage athletes retain speed even at ordinary overall ratings');
for (const players of Object.values(samples)) {
    assert.ok(mean(players) > 73 && mean(players) < 79, 'athletic position differences must not distort overall talent tiers');
    for (const p of players) {
        assert.equal(calculateOVR(p.position, p.attributes.universal, p.attributes.position), p.ovr);
        for (const attrs of Object.values(p.attributes)) for (const value of Object.values(attrs)) assert.ok(Number.isInteger(value) && value >= 40 && value <= 99);
    }
}
const archetypes = (pos, type) => samples[pos].filter(p => p.archetype === type);
assert.ok(mean(archetypes('QB', 'Scrambly Pocket Escape'), 'speed') - mean(archetypes('QB', 'Game Manager'), 'speed') > 17);
assert.ok(mean(archetypes('RB', 'Speed Back'), 'speed') - mean(archetypes('RB', 'Power Back'), 'speed') > 8);
assert.ok(mean(archetypes('RB', 'Power Back'), 'strength') - mean(archetypes('RB', 'Speed Back'), 'strength') > 11);
assert.ok(mean(archetypes('DL', 'Speed Rusher'), 'speed') - mean(archetypes('DL', 'Run Stopper'), 'speed') > 11);
for (const p of samples.RB) {
    const a = p.attributes.position;
    assert.equal(a.carrying, a.sec);
    assert.equal(a.vision, a.eff);
    assert.equal(a.breakTackle, a.vol);
    assert.equal(a.elusiveness, a.exp);
}
const projects = Array.from({ length: 500 }, () => generatePlayer('WR', 55, 21));
const elite = Array.from({ length: 500 }, () => generatePlayer('WR', 95, 25));
assert.ok(mean(projects, 'speed') > 82, 'low skill does not automatically mean a slow athlete');
assert.ok(mean(elite, 'speed') - mean(projects, 'speed') < 12, 'athletic tools depend only moderately on overall skill');
assert.ok(projects.some(p => p.attributes.universal.speed > 90), 'fast developmental receivers exist');
for (const ovr of [40, 99]) for (const pos of Object.keys(POSITIONS)) {
    for (let i = 0; i < 100; i++) {
        const p = generatePlayer(pos, ovr, 22);
        assert.ok(Number.isFinite(p.ovr) && p.ovr >= 40 && p.ovr <= 99);
        for (const attrs of Object.values(p.attributes)) for (const value of Object.values(attrs)) assert.ok(Number.isInteger(value) && value >= 40 && value <= 99);
    }
}
console.log('PASS: position/archetype athletic profiles, developmental athletes, overall bands, bounded attributes and RB aliases.');
