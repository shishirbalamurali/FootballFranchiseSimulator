// Statistical calibration regression test.
//
// Locks the sim engine to real NFL production. Every rate in simulation.js is
// expressed as a deviation from a league baseline, so a change to the OVR curve
// or to any attribute formula moves league scoring — this catches that.
//
// Targets are 2022-24 NFL league averages, per team per game. Tolerances are
// wide enough to absorb Monte Carlo noise at this sample size and tight enough
// to fail on a real calibration regression.

import assert from 'node:assert/strict';
import { installTestRandomness, shuffled } from './helpers/seededRandom.mjs';
installTestRandomness(20260921);
import { simulateGame } from '../src/engine/simulation.js';
import { generateRoster, injectLeagueSuperstars } from '../src/engine/player.js';
import { generateDraftClass } from '../src/engine/draft.js';

const SEASONS = 4;
const failures = [];

function check(label, actual, target, tol) {
    const ok = Math.abs(actual - target) <= tol;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(18)} ${actual.toFixed(2).padStart(7)}  (target ${target} ±${tol})`;
    console.log(line);
    if (!ok) failures.push(line);
}

function between(label, actual, lo, hi) {
    const ok = actual >= lo && actual <= hi;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(18)} ${String(actual).padStart(7)}  (expected ${lo}-${hi})`;
    console.log(line);
    if (!ok) failures.push(line);
}

const teams = Array.from({ length: 32 }, (_, i) => ({ id: `t${i}` }));
const sum = { g: 0, pts: 0, passY: 0, rushY: 0, att: 0, cmp: 0, sacks: 0, ints: 0, passTd: 0, rushTd: 0, fgm: 0, fga: 0 };
const ovrs = [];
const leaders = { passYards: [], rushYards: [], recYards: [], receptions: [], sacks: [], tackles: [], ints: [] };

for (let s = 0; s < SEASONS; s++) {
    const rosters = {};
    teams.forEach((t, i) => { rosters[t.id] = generateRoster(Math.floor((i % 7) - 3)); });
    injectLeagueSuperstars(rosters);
    Object.values(rosters).flat().forEach(p => ovrs.push(p.ovr));

    const season = {};
    // Box-score lines omit zero-valued counters (see slimPlayerStats), so every
    // read defaults to 0 exactly as the app's own readers do.
    const n = (st, k) => st[k] || 0;

    const bump = (id, pos, st) => {
        const r = season[id] ||= { pos, passYards: 0, rushYards: 0, recYards: 0, receptions: 0, sacks: 0, tackles: 0, ints: 0 };
        if (pos === 'QB') r.passYards += n(st, 'yards'); else r.sacks += n(st, 'sacks');
        r.rushYards += n(st, 'rushYards'); r.recYards += n(st, 'recYards');
        r.receptions += n(st, 'receptions'); r.tackles += n(st, 'tackles');
        if (pos !== 'QB') r.ints += n(st, 'ints');
    };

    for (let week = 0; week < 17; week++) {
        const order = shuffled(teams);
        for (let i = 0; i < 32; i += 2) {
            const [h, a] = [order[i], order[i + 1]];
            const res = simulateGame(h, a, rosters[h.id], rosters[a.id]);
            sum.g += 2;
            sum.pts += res.homeScore + res.awayScore;
            sum.passY += res.homeStats.passYards + res.awayStats.passYards;
            sum.rushY += res.homeStats.rushYards + res.awayStats.rushYards;
            for (const bag of [res.homePlayerStats, res.awayPlayerStats]) {
                for (const st of Object.values(bag)) {
                    const pos = st.player.position;
                    sum.att += n(st, 'attempts'); sum.cmp += n(st, 'completions');
                    sum.ints += pos === 'QB' ? n(st, 'ints') : 0;
                    sum.sacks += pos === 'QB' ? n(st, 'sacks') : 0;
                    sum.passTd += pos === 'QB' ? n(st, 'tds') - n(st, 'rushTds') : 0;
                    sum.rushTd += n(st, 'rushTds');
                    sum.fgm += n(st, 'fgm'); sum.fga += n(st, 'fga');
                    bump(st.player.id, pos, st);
                }
            }
        }
    }
    for (const key of Object.keys(leaders)) {
        leaders[key].push(Math.max(...Object.values(season).map(r => r[key])));
    }
}

const per = v => v / sum.g;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

console.log(`\n── Per team per game (${sum.g} team-games) ──`);
check('points',        per(sum.pts),                22.5, 1.2);
check('net pass yards', per(sum.passY),             219,  10);
check('rush yards',    per(sum.rushY),              118,  8);
check('pass attempts', per(sum.att),                33.6, 1.5);
check('completion %',  sum.cmp / sum.att * 100,     65.5, 2.0);
check('sacks',         per(sum.sacks),              2.30, 0.30);
check('interceptions', per(sum.ints),               0.74, 0.15);
check('pass TD',       per(sum.passTd),             1.55, 0.20);
check('rush TD',       per(sum.rushTd),             0.90, 0.15);
check('FG %',          sum.fgm / sum.fga * 100,     84.0, 3.0);

console.log('\n── Season leaders (mean of season maxima) ──');
check('pass yards',    avg(leaders.passYards),      5000, 500);
check('rush yards',    avg(leaders.rushYards),      1700, 350);
check('rec yards',     avg(leaders.recYards),       1700, 350);
check('receptions',    avg(leaders.receptions),     123,  22);
check('sacks',         avg(leaders.sacks),          19,   5);
check('tackles',       avg(leaders.tackles),        165,  30);
// Real NFL INT leaders span 6-11 year to year, so this band is wide on purpose.
check('interceptions', avg(leaders.ints),           8.0,  3.0);

console.log('\n── League OVR distribution ──');
const o = ovrs.sort((a, b) => a - b);
const q = p => o[Math.floor(o.length * p)];
between('median OVR',   q(0.50),                              69, 74);
between('p90 OVR',      q(0.90),                              80, 86);
between('90+ per league', Math.round(o.filter(x => x >= 90).length / SEASONS), 18, 45);
between('95+ per league', Math.round(o.filter(x => x >= 95).length / SEASONS), 2, 12);

console.log('\n── Rookie draft class ──');
const cls = generateDraftClass(2030);
const band = (a, b) => cls.slice(a, b);
const mean = (g, k) => g.reduce((s, p) => s + p[k], 0) / g.length;
between('Rd1 mean OVR',  Math.round(mean(band(0, 32), 'ovr')),  71, 78);
between('Rd1 mean POT',  Math.round(mean(band(0, 32), 'pot')),  85, 93);
between('Rd4-5 mean OVR', Math.round(mean(band(96, 192), 'ovr')), 60, 67);
between('UDFA mean OVR', Math.round(mean(band(224, 350), 'ovr')), 49, 58);
between('best rookie OVR', Math.max(...cls.map(p => p.ovr)),     78, 86);

if (failures.length) {
    console.error(`\n${failures.length} calibration check(s) failed:`);
    failures.forEach(f => console.error('  ' + f));
    process.exit(1);
}
assert.ok(true);
console.log('\nPASS: all calibration targets within tolerance');
