// Play-by-play engine (src/engine/gameEngine.js, Claude-owned) — game-flow
// invariants, coaching-plan effects and the variety of game scripts.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(4242);
import { simulateGame } from '../src/engine/simulation.js';
import { generateRoster } from '../src/engine/player.js';
import { KIND, FLAG } from '../src/engine/gameEngine.js';
import { readPbp, drivesOf, classifyGame, describePlay, statsThrough } from '../src/engine/gameStory.js';
import { gamePlanFor } from '../src/engine/gamePlan.js';

const home = { id: 'chiefs' }, away = { id: 'bills' };
const rosters = Array.from({ length: 8 }, (_, i) => generateRoster(i % 5 - 2));
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

// ── Invariants over many games ──────────────────────────────────────────────
const labels = {};
let comebacks = 0, games = 0, otGames = 0;
for (let i = 0; i < 400; i++) {
    const r = simulateGame(home, away, rosters[i % 8], rosters[(i + 3) % 8], null, null, { allowTie: i % 4 !== 0 });
    games++;
    // Score = scoring log = quarter totals = final play stamp
    const [hq, aq] = r.quarters;
    assert.equal(sum(hq, x => x), r.homeScore, 'home quarters add up');
    assert.equal(sum(aq, x => x), r.awayScore, 'away quarters add up');
    assert.equal(sum(r.scoringLog.filter(e => e[2] === 0), e => e[3]), r.homeScore, 'home scoring log adds up');
    assert.equal(sum(r.scoringLog.filter(e => e[2] === 1), e => e[3]), r.awayScore, 'away scoring log adds up');
    const last = r.pbp.plays.at(-1);
    assert.deepEqual([last[12], last[13]], [r.homeScore, r.awayScore], 'last play carries the final');
    if (i % 4 === 0) assert.notEqual(r.homeScore, r.awayScore, 'postseason games never tie');
    if (r.overtime) { otGames++; assert.equal(hq.length, 5); }

    // Scores never go down and every change is a legal football unit
    let ph = 0, pa = 0;
    for (const t of r.pbp.plays) {
        const dh = t[12] - ph, da = t[13] - pa;
        assert.ok(dh >= 0 && da >= 0, 'scores never decrease');
        for (const d of [dh, da]) assert.ok([0, 1, 2, 3, 6].includes(d), `legal score step (${d})`);
        ph = t[12]; pa = t[13];
    }

    // The play log agrees with the box score
    const plays = readPbp(r.pbp);
    const lines = statsThrough(plays);
    for (const side of ['home', 'away']) {
        const box = Object.values(r[`${side}PlayerStats`]);
        const qbs = box.filter(s => s.player.position === 'QB');
        const s = side === 'home' ? 0 : 1;
        const logAtt = sum(lines.filter(l => l.side === s), l => l.att);
        assert.equal(logAtt, sum(qbs, q => q.attempts || 0), 'attempts in log = box');
        const logSacks = sum(lines.filter(l => l.side === 1 - s), l => l.sacks);
        assert.equal(logSacks, sum(qbs, q => q.sacks || 0), 'every sack credited to a defender');
        const logInts = sum(lines.filter(l => l.side === 1 - s), l => l.picks);
        assert.equal(logInts, sum(qbs, q => q.ints || 0), 'every INT credited to a defender');
    }
    for (const p of plays) assert.ok(describePlay(p, ['KC', 'BUF']).text.length > 0 || p.kind === 0, 'every play has a description');
    assert.ok(drivesOf(plays).length >= 10, 'a real game has drives');

    const story = classifyGame({ homeScore: r.homeScore, awayScore: r.awayScore, overtime: r.overtime, scoringLog: r.scoringLog });
    for (const t of story.tags) labels[t] = (labels[t] || 0) + 1;
    if (story.maxDeficit >= 10) comebacks++;
}
// Variety: every kind of game shows up
for (const t of ['Blowout', 'Shootout', 'Nail-biter', 'Overtime']) assert.ok(labels[t] > 0, `${t} games happen`);
assert.ok(labels['Defensive battle'] || labels['Defensive masterclass'], 'defensive games happen');
assert.ok(comebacks / games > 0.04, 'double-digit comebacks happen');
assert.ok(otGames / games < 0.12, 'overtime stays rare');

// ── Coaching plans change how a team plays ─────────────────────────────────
function profile(plan) {
    let fourthGo = 0, dropbacks = 0, snaps = 0, twoPt = 0, tds = 0;
    for (let i = 0; i < 300; i++) {
        const r = simulateGame(home, away, rosters[1], rosters[2], null, null, { homePlan: plan });
        for (const p of readPbp(r.pbp)) {
            if (p.off !== 0) continue;
            // Discretionary calls only: late-game "must go" situations are the same for every staff.
            if (p.has(FLAG.FOURTH_GO) && p.q <= 3) fourthGo++;
            if ([KIND.PASS, KIND.INC, KIND.INT, KIND.SACK, KIND.SCRAMBLE].includes(p.kind)) dropbacks++;
            if ([KIND.PASS, KIND.INC, KIND.INT, KIND.SACK, KIND.SCRAMBLE, KIND.RUN].includes(p.kind)) snaps++;
            if (p.kind === KIND.TWO || p.kind === KIND.TWO_FAIL) twoPt++;
            if (p.has(FLAG.TD) && !p.has(FLAG.RETURN_TD)) tds++;
        }
    }
    return { fourthGo, passRate: dropbacks / snaps, twoPt };
}
const aggressive = profile(gamePlanFor({ userTeamId: 'chiefs', weekStrategy: 'aggressive', userPlaybookId: 'chiefs-scheme' }, 'chiefs'));
const conservative = profile(gamePlanFor({ userTeamId: 'chiefs', weekStrategy: 'conservative', userPlaybookId: 'chiefs-scheme' }, 'chiefs'));
console.log("plans", JSON.stringify({ aggressive, conservative }));
assert.ok(aggressive.fourthGo > conservative.fourthGo * 1.5, `aggressive plan goes for it more (${aggressive.fourthGo} vs ${conservative.fourthGo})`);
assert.ok(aggressive.passRate > conservative.passRate + 0.05, `aggressive plan throws more (${aggressive.passRate.toFixed(3)} vs ${conservative.passRate.toFixed(3)})`);
// CPU teams carry their scheme's identity
const runScheme = gamePlanFor({ userTeamId: 'x' }, 'titans'), passScheme = gamePlanFor({ userTeamId: 'x' }, 'bills');
assert.ok((passScheme?.passTilt ?? 0) > (runScheme?.passTilt ?? 0), 'pass-first schemes throw more than run-first ones');

console.log('PASS: game-flow invariants, box/log agreement, game variety, coaching plans change play-calling', JSON.stringify(labels));
