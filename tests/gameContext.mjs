// K12 (Claude-owned): game context, the Witching Hour, play styles, trick
// plays, win probability and the booth. See plans/K12-SIM-FUN-OVERHAUL.md.
import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(1212);
import { simulateGame } from '../src/engine/simulation.js';
import { generateRoster } from '../src/engine/player.js';
import { KIND, FLAG } from '../src/engine/gameEngine.js';
import { gameContext, engineContext, weekSlots, upsetInfo, pointSpread } from '../src/engine/gameContext.js';
import { gamePlans, gameDetailFields } from '../src/engine/gamePlan.js';
import { PLAY_STYLES, playStyleIdFor, stylesForPosition, clutchBase } from '../src/engine/playStyles.js';
import { readPbp, describePlay, classifyGame, winProbSeries, playOfTheGame, boothCalls, threeStars } from '../src/engine/gameStory.js';

const strong = generateRoster(6), weak = generateRoster(-6), even = generateRoster(0);

// ── Context derivation ───────────────────────────────────────────────────────
const standings = Object.fromEntries(['ravens', 'bengals', 'texans', 'colts', 'chiefs', 'packers'].map((id, i) => [id, { wins: 6 - i, losses: 5 + i, ties: 0, streak: 0 }]));
const schedule = Array.from({ length: 18 }, () => [
    { homeTeamId: 'ravens', awayTeamId: 'bengals' },
    { homeTeamId: 'texans', awayTeamId: 'packers' },
    { homeTeamId: 'colts', awayTeamId: 'chiefs' },
]);
const state = { year: 2026, week: 12, phase: 'regular', standings, schedule, rosters: { ravens: weak, bengals: strong, texans: strong, packers: weak, colts: even, chiefs: even } };

const div = gameContext(state, 'ravens', 'bengals');
assert.equal(div.division, true, 'same-division teams are a division game');
assert.equal(div.stage, 'regular');
assert.ok(div.spread < 0 && div.favorite === 1, `the strong visitor is favored (${div.spread})`);
assert.ok(div.tags.some(t => t.id === 'division' || t.id === 'rivalry'), 'division games are tagged');
assert.equal(div.stakes[0], 'bubble', 'a .500-ish team in Week 12 is on the bubble');
const nonDiv = gameContext(state, 'texans', 'packers');
assert.equal(nonDiv.division, false);
assert.ok(nonDiv.spread > 0, 'strong home team favored');
assert.equal(pointSpread(state, 'colts', 'chiefs'), 2, 'even teams: home field is about two points');

const slots = weekSlots(state, 12);
assert.deepEqual([...slots.values()].sort(), ['MNF', 'SNF', 'TNF'], 'three prime-time windows a week');
assert.deepEqual(weekSlots(state, 12), slots, 'prime-time slots are deterministic');

const po = gameContext({ ...state, phase: 'playoffs', playoffBracket: { round: 3 } }, 'texans', 'packers');
assert.equal(po.stage, 'conference');
assert.equal(po.slot, null, 'no prime-time slots in January');

// Neutral context → the engine sees nothing; division/playoff games lift the underdog.
assert.equal(engineContext(null), null);
assert.ok(engineContext(div).dogLift > engineContext(nonDiv).dogLift, 'familiarity lifts the division underdog');
assert.ok(engineContext(po).formSpread > 1, 'playoff games are wilder');

// gamePlans carries the context; detail fields keep it compact.
const plans = gamePlans(state, 'ravens', 'bengals');
assert.ok(plans.context?.engine, 'gamePlans returns the engine context');
const r = simulateGame({ id: 'ravens' }, { id: 'bengals' }, weak, strong, null, null, plans);
const row = { homeTeamId: 'ravens', awayTeamId: 'bengals', homeScore: r.homeScore, awayScore: r.awayScore, ...gameDetailFields(r, true) };
assert.ok(row.ctx && JSON.stringify(row.ctx).length < 60, `compact context stays tiny (${JSON.stringify(row.ctx)})`);
assert.equal(row.ctx.d, 1);
assert.ok(row.pbp.ctx?.tags?.length, 'the user broadcast gets the full storyline');
assert.equal(row.pbp.ctx.engine, undefined, 'engine knobs are not saved');
const ui = upsetInfo(row);
assert.equal(ui.upset, r.homeScore > r.awayScore, 'upsetInfo reads the stored spread');
assert.equal(gameDetailFields({ quarters: r.quarters, scoringLog: [] }, false).ctx, undefined, 'no context, no ctx field');

// ── Any given Sunday: division underdogs win more ────────────────────────────
function dogWinRate(ctx, n = 2000) {
    let w = 0;
    const opts = ctx ? { context: { ...ctx, engine: engineContext(ctx) } } : {};
    for (let i = 0; i < n; i++) {
        const g = simulateGame({ id: 'a' }, { id: 'b' }, weak, strong, null, null, opts);
        if (g.homeScore > g.awayScore) w++;
    }
    return w / n;
}
const neutralDog = dogWinRate({ ...nonDiv, favorite: 1, spread: div.spread, division: false, conference: false, rivalry: 0, stakes: [null, null], trap: [false, false], slot: null });
const divisionDog = dogWinRate({ ...div, stakes: [null, null] });
console.log('underdog win rate', JSON.stringify({ neutral: neutralDog.toFixed(3), division: divisionDog.toFixed(3), spread: div.spread }));
assert.ok(divisionDog > neutralDog + 0.03, `division underdogs pull more upsets (${divisionDog.toFixed(3)} vs ${neutralDog.toFixed(3)})`);
assert.ok(divisionDog < 0.5, 'but the favorite is still the favorite');

// ── The Witching Hour, drama flags, trick plays, blocked kicks ──────────────
let witchGames = 0, clutch = 0, choke = 0, tricks = 0, blocks = 0, iced = 0, games = 0;
const pool = Array.from({ length: 8 }, (_, i) => generateRoster(i % 5 - 2));
for (let i = 0; i < 500; i++) {
    const g = simulateGame({ id: 'x' }, { id: 'y' }, pool[i % 8], pool[(i * 3 + 1) % 8], null, null, { homePlan: { aggression: 1.8 } });
    games++;
    const plays = readPbp(g.pbp);
    if (g.pbp.witching) witchGames++;
    for (const p of plays) {
        if (p.has(FLAG.WITCHING)) assert.ok(p.q >= 5 || (p.q === 4 && p.clock <= 300), 'witching only in the final five minutes or OT');
        if (p.has(FLAG.CLUTCH)) { clutch++; assert.ok(p.has(FLAG.WITCHING), 'clutch plays happen in the Witching Hour'); }
        if (p.has(FLAG.CHOKE)) choke++;
        if (p.has(FLAG.TRICK)) tricks++;
        if (p.has(FLAG.BLOCKED)) { blocks++; assert.ok([KIND.PUNT, KIND.FG_MISS].includes(p.kind), 'only kicks get blocked'); }
        if (p.has(FLAG.ICED)) iced++;
        const d = describePlay(p, ['HOM', 'AWY']);
        if (p.kind) assert.ok(d.text.length > 0, 'every play is described');
        if (p.has(FLAG.TRICK) && p.kind !== KIND.INC) assert.ok(d.tag, 'trick plays get a callout');
    }
    // Names carry player id + style for the broadcast
    assert.ok(g.pbp.names.every(n => n.length === 5), 'name table carries id and play style');
    // Win probability is well-formed and lands on the result
    const wp = winProbSeries(plays, 0, g.homeScore - g.awayScore);
    assert.ok(wp.series.every(v => v >= 0 && v <= 1), 'WP in [0,1]');
    assert.equal(wp.series.at(-1), g.homeScore > g.awayScore ? 1 : g.homeScore < g.awayScore ? 0 : 0.5, 'WP ends on the result');
    const potg = playOfTheGame(plays, wp);
    assert.ok(potg && potg.idx >= 0 && potg.idx < plays.length, 'there is a play of the game');
    const booth = boothCalls(plays, plays.map(p => describePlay(p, ['HOM', 'AWY'])), ['HOM', 'AWY'], null);
    assert.equal(booth.lines.length, plays.length);
    if (g.pbp.witching) assert.ok(booth.banners.includes('witching'), 'the booth announces the Witching Hour');
}
console.log('drama', JSON.stringify({ witchGames, clutch, choke, tricks, blocks, iced, games }));
assert.ok(witchGames / games > 0.2 && witchGames / games < 0.75, 'the Witching Hour is common but not universal');
assert.ok(clutch > 20, 'clutch players deliver');
assert.ok(choke > 0, 'and some wilt');
assert.ok(tricks > 3, 'trick plays happen');
assert.ok(blocks > 3, 'kicks get blocked');
assert.ok(iced > 5, 'kickers get iced');

// ── Game labels ──────────────────────────────────────────────────────────────
const upsetGame = { homeScore: 24, awayScore: 20, ctx: { s: -7.5, d: 1 }, scoringLog: [[1, 600, 1, 7, 'PASS'], [4, 200, 0, 7, 'PASS'], [4, 100, 0, 17, 'RUSH']] };
assert.ok(classifyGame(upsetGame).tags.includes('Division upset'), 'division upsets are labelled');
const witch = { homeScore: 20, awayScore: 17, scoringLog: [[1, 600, 0, 7, 'PASS'], [2, 500, 1, 17, 'PASS'], [4, 280, 0, 7, 'RUSH'], [4, 30, 0, 6, 'PASS']] };
assert.ok(classifyGame(witch).tags.includes('Witching Hour'), 'late go-ahead scores are Witching Hour games');
assert.equal(threeStars({ homeScore: 1, awayScore: 0, playerStats: { home: { a: { player: { id: 'a', name: 'A', position: 'QB' }, yards: 300, tds: 3 } }, away: {} } }).length, 1);

// ── Play styles ──────────────────────────────────────────────────────────────
const counts = {};
for (let i = 0; i < 16; i++) {
    for (const p of generateRoster(i % 7 - 3)) {
        const id = playStyleIdFor(p);
        if (!id) continue;
        assert.ok(PLAY_STYLES[id], `style ${id} is defined`);
        assert.equal(PLAY_STYLES[id].pos, p.position, `${id} belongs to ${p.position}`);
        counts[id] = (counts[id] || 0) + 1;
    }
}
for (const pos of ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S']) {
    const seen = stylesForPosition(pos).filter(s => counts[s.id]).length;
    assert.ok(seen >= Math.min(3, stylesForPosition(pos).length), `${pos} players spread across styles (${seen})`);
}
assert.ok(Object.keys(PLAY_STYLES).length >= 40, 'forty-plus play styles');
const qb = strong.find(p => p.position === 'QB');
assert.equal(playStyleIdFor(qb), playStyleIdFor({ ...qb }), 'styles are stable');
assert.ok(clutchBase({ ...qb, personality: 'IceInVeins' }) > clutchBase({ ...qb, personality: 'Hothead' }), 'composure follows personality');

console.log('PASS: game context, division upsets, Witching Hour, clutch/choke, trick plays, blocks, WP, booth, play styles', JSON.stringify(counts));
