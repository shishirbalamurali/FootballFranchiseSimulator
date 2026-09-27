import assert from 'node:assert/strict';
import { installTestRandomness } from './helpers/seededRandom.mjs';

installTestRandomness(20260926);
import { generatePlayer } from '../src/engine/player.js';
import {
  characterFor, personalityView, moodFor, TRAITS, AXES,
  contractStance, reputationMultiplier, tradeFallout, faPreferences, roleOf,
} from '../src/engine/character.js';
import { askingSalary } from '../src/engine/progression.js';

const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'OL', 'DL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
const players = Array.from({ length: 1700 }, (_, i) => generatePlayer(POS[i % POS.length], null, 21 + (i % 14)));

// Derived, not stored: a fresh module instance (as after a reload) gives the same person.
{
  const fresh = await import('../src/engine/character.js?reload=1');
  for (const p of players.slice(0, 200)) {
    assert.deepEqual(fresh.characterFor({ ...p }), characterFor(p), `character for ${p.id} is stable`);
  }
}

// Every player has a complete, sane identity.
const NUMBERS = {
  QB: [1, 19], K: [1, 19], P: [1, 19], OL: [50, 79], DL: [50, 99], LB: [40, 99],
  RB: [0, 49], CB: [0, 49], S: [0, 49], WR: [0, 89], TE: [40, 89],
};
for (const p of players) {
  const c = characterFor(p);
  for (const { id } of AXES) assert.ok(c.axes[id] >= 1 && c.axes[id] <= 99, `${id} in range`);
  assert.ok(c.traits.length <= 2);
  c.traits.forEach(t => assert.ok(TRAITS[t], `known trait ${t}`));
  const [lo, hi] = NUMBERS[p.position];
  assert.ok(c.number >= lo && c.number <= hi, `${p.position} wears #${c.number}`);
  assert.ok(c.hometown && c.college && c.quote);
  assert.ok(c.heightIn >= 64 && c.heightIn <= 83 && c.weightLb >= 150 && c.weightLb <= 380, `${p.position} build ${c.height} ${c.weightLb}`);
}

// Traits are distinctive: none is on more than ~4 players per 53, and most
// rosters still carry a real mix of characters.
{
  const counts = {};
  let withTrait = 0;
  for (const p of players) {
    const t = characterFor(p).traits;
    if (t.length) withTrait++;
    t.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  }
  for (const [id, n] of Object.entries(counts)) {
    assert.ok(n / players.length < 0.08, `${id} too common: ${(n / players.length * 100).toFixed(1)}%`);
  }
  assert.ok(Object.keys(counts).length === Object.keys(TRAITS).length, 'every trait appears in a league');
  const share = withTrait / players.length;
  assert.ok(share > 0.3 && share < 0.6, `share with a trait ${share}`);
}

// Legacy labels still read true: most old "Hothead"s are volatile.
{
  const hot = players.filter(p => p.personality === 'Hothead');
  const volatile = hot.filter(p => characterFor(p).axes.composure < 40).length;
  assert.ok(volatile / hot.length > 0.6, `legacy Hothead composure ${volatile}/${hot.length}`);
}

// Fog: your own players are an open book; others show only public reputation.
{
  const secretive = players.find(p => characterFor(p).traits.some(t => !TRAITS[t].public));
  const own = personalityView(secretive, { own: true });
  const theirs = personalityView(secretive, { own: false });
  const scouted = personalityView(secretive, { scouted: true });
  assert.ok(own.axes && scouted.axes && theirs.axes === null);
  assert.equal(theirs.traits.every(t => t.public), true);
  assert.equal(theirs.traits.length + theirs.hiddenTraits, own.traits.length);
  assert.ok(theirs.hiddenTraits >= 1);
}

// College prospects become the same person in the pros (the draft keeps the id).
{
  const prospect = { id: 'college-2027-14', position: 'WR', age: 21, school: 'Tulane' };
  const pro = { id: 'college-2027-14', position: 'WR', age: 21, college: 'Tulane', ovr: 72 };
  const a = characterFor(prospect), b = characterFor(pro);
  assert.deepEqual([a.traits, a.hometown, a.number, a.college], [b.traits, b.hometown, b.number, b.college]);
}

// ── Step 2: mood, contracts, trades, free agency ────────────────────────────
const withTrait = id => players.find(p => characterFor(p).traits.includes(id));
const ctxFor = (roster, wins, losses) => ({ roster, games: wins + losses, winPct: wins / Math.max(1, wins + losses) });

// Mood reacts to the record, and every reason is stated.
{
  const vet = players.find(p => p.ovr >= 75 && (p.experience ?? 0) >= 3);
  const winning = moodFor(vet, ctxFor([vet], 9, 1));
  const losing = moodFor(vet, ctxFor([vet], 1, 9));
  assert.ok(winning.score > losing.score, 'losing hurts mood');
  assert.ok(losing.reasons.some(r => r.text.includes('losing') && r.delta < 0));
  assert.ok(moodFor(vet) && moodFor(vet).reasons.length === 0, 'no context, no invented reasons');
}

// A veteran contributor paid well under market feels it; a rookie deal does not.
{
  const vet = players.find(p => p.ovr >= 76 && p.ovr < 85 && (p.experience ?? 0) >= 3);
  const cheapVet = { ...vet, contract: { salary: 1, years: 3, yearsLeft: 2 } };
  assert.ok(moodFor(cheapVet, ctxFor([cheapVet], 1, 1)).reasons.some(r => r.text.startsWith('Underpaid')));
  const rookie = { ...cheapVet, experience: 0 };
  assert.ok(!moodFor(rookie, ctxFor([rookie], 1, 1)).reasons.some(r => r.text.startsWith('Underpaid')));
}

// A starter-calibre backup wants the job; depth players don't gripe.
{
  const a = { ...players.find(p => p.position === 'QB'), ovr: 84 };
  const b = { ...players.filter(p => p.position === 'QB')[1], ovr: 82 };
  const deep = { ...players.filter(p => p.position === 'QB')[2], ovr: 60 };
  const roster = [a, b, deep];
  assert.equal(roleOf(a, roster).starter, true);
  assert.ok(moodFor(b, ctxFor(roster, 1, 1)).reasons.some(r => r.text.includes('starting')));
  assert.ok(!moodFor(deep, ctxFor(roster, 1, 1)).reasons.some(r => r.text.includes('starting')));
}

// Contracts: franchise guys discount, mercenaries charge, and the store's ask
// is market × multiplier.
{
  const loyal = withTrait('loyal'), merc = withTrait('mercenary');
  const neutral = ctxFor([], 0, 0);
  assert.ok(contractStance(loyal, neutral).askMultiplier < contractStance(merc, neutral).askMultiplier);
  const st = contractStance(merc, neutral);
  assert.equal(st.ask, Math.max(1, Math.round(askingSalary(merc) * st.askMultiplier)));
  assert.ok(st.askMultiplier >= 0.82 && st.askMultiplier <= 1.38);
}

// A player who wants out will not talk extension.
{
  const diva = withTrait('diva') ?? players[0];
  const miserable = { ...diva, ovr: 80, experience: 5, contract: { salary: 1, years: 1, yearsLeft: 1 } };
  const starter = { ...miserable, id: 'blocker', ovr: 83 };
  const slots = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 }[miserable.position];
  const ahead = Array.from({ length: slots }, (_, i) => ({ ...starter, id: `blocker-${i}` }));
  const stance = contractStance(miserable, ctxFor([...ahead, miserable], 0, 10));
  assert.equal(stance.willing, false, `mood ${stance.mood.score}`);
  assert.match(stance.refusal, /wants out/);
}

// Reputation moves trade value; private traits do not.
{
  assert.ok(reputationMultiplier(withTrait('captain')) > 1);
  assert.ok(reputationMultiplier(withTrait('hothead')) < 1);
  const quiet = players.find(p => { const t = characterFor(p).traits; return t.length && t.every(x => !TRAITS[x].public); });
  assert.equal(reputationMultiplier(quiet), 1);
}

// Trading away a captain hurts; moving a diva is a relief.
{
  assert.ok(tradeFallout([withTrait('captain')]).moraleDelta < 0);
  assert.ok(tradeFallout([withTrait('diva')]).moraleDelta > 0);
  assert.equal(tradeFallout([]).moraleDelta, 0);
}

// Free agents: mercenaries follow the money.
assert.ok(faPreferences(withTrait('mercenary')).moneyPower > 1);

console.log('PASS: character identity, fog, college-to-pro continuity; mood reasons, contract stance, reputation value, trade fallout, FA preferences.');
