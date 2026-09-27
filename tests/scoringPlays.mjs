import assert from 'node:assert/strict';
import {
  decomposeScore, buildScoringTimeline, scoreAt, periodAt, PLAYS,
} from '../src/components/scoringPlays.js';

const LEGAL = new Set([2, 3, 6, 7, 8]);

// Every reachable final decomposes into legal plays that sum exactly.
for (let score = 0; score <= 80; score++) {
  if (score === 1) continue;
  for (let trial = 0; trial < 20; trial++) {
    const plays = decomposeScore(score);
    assert.equal(plays.reduce((s, p) => s + p.pts, 0), score, `sum for ${score}`);
    for (const p of plays) {
      assert.ok(LEGAL.has(p.pts), `illegal increment ${p.pts} in ${score}`);
      assert.equal(p.pts, PLAYS[p.type].pts);
    }
  }
}

// Common finals read like football: 24 is not eight field goals.
let fgHeavy = 0;
for (let i = 0; i < 400; i++) {
  if (decomposeScore(24).filter(p => p.type === 'FG').length >= 5) fgHeavy++;
}
assert.ok(fgHeavy < 20, `24 decomposed FG-heavy ${fgHeavy}/400 times`);

// Timelines land on the true final and never step by an illegal amount.
const game = { id: 'g1', awayTeamId: 'a', homeTeamId: 'b' };
for (const [away, home] of [[0, 0], [3, 0], [24, 17], [44, 48], [2, 5], [55, 42], [13, 10]]) {
  const tl = buildScoringTimeline(game, away, home);
  assert.deepEqual(scoreAt(tl, 1), [away, home]);
  let prev = [0, 0];
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const now = scoreAt(tl, p);
    for (const k of [0, 1]) {
      const d = now[k] - prev[k];
      assert.ok(d === 0 || LEGAL.has(d) || d >= 4, `step ${d} at ${p} for ${away}-${home}`);
    }
    prev = now;
  }
  assert.ok(tl.plays.every(pl => pl.t > 0 && pl.t < 1));
  assert.ok(tl.plays.every(pl => LEGAL.has(pl.pts)), `illegal play in ${away}-${home}`);
}

// Same game, same replay.
assert.deepEqual(buildScoringTimeline(game, 27, 20), buildScoringTimeline(game, 27, 20));

// Overtime: tied at the end of regulation, winner walks off in OT.
{
  const tl = buildScoringTimeline({ ...game, overtime: true }, 20, 23);
  const [a, h] = scoreAt(tl, tl.regEnd);
  assert.equal(a, h, 'tied after regulation');
  assert.equal(periodAt(tl, (tl.regEnd + 1) / 2).label, 'OT');
  assert.deepEqual(scoreAt(tl, 1), [20, 23]);
  assert.equal(tl.plays.at(-1).type, 'OTFG');
  assert.equal(periodAt(tl, 1).label, 'Final/OT');
}

// An exact breakdown from the sim is replayed as-is.
{
  const scoring = {
    away: { td: 3, xp: 2, twoPt: 1, fg: 1, defTd: 0 },
    home: { td: 1, xp: 1, twoPt: 0, fg: 2, defTd: 1 },
  };
  const tl = buildScoringTimeline({ ...game, scoring }, 7 + 7 + 8 + 3, 7 + 6 + 7);
  const types = side => tl.plays.filter(p => p.side === side).map(p => p.type).sort();
  assert.deepEqual(types('away'), ['FG', 'TD', 'TD', 'TD8']);
  assert.deepEqual(types('home'), ['DTD', 'FG', 'FG', 'TD']);
}

// Quarters progress in order.
{
  const tl = buildScoringTimeline(game, 10, 7);
  assert.equal(periodAt(tl, 0.1).label, 'Q1');
  assert.equal(periodAt(tl, 0.3).label, 'Q2');
  assert.equal(periodAt(tl, 0.6).label, 'Q3');
  assert.equal(periodAt(tl, 0.9).label, 'Q4');
}

console.log('PASS: scoring plays decompose legally, land on the final, handle OT and exact breakdowns.');
