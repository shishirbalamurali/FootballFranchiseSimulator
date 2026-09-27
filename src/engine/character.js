// Player character: who a player is, not how good he is.
//
// Everything static here is DERIVED from the player's id through a seeded RNG,
// so it costs zero bytes in the save, is identical on every load, works on old
// saves without a migration, and follows a college prospect into the pros
// (the draft keeps the prospect's id). Only things that change over a career
// (mood reasons, rapport, earned nicknames, incidents) will ever be stored.
//
// The legacy `player.personality` label nudges the axes, so an existing
// "Hothead" or "Leader" keeps reading as one.

import { hashSeed, seededRng } from './seededRandom.js';
import { askingSalary } from './progression.js';

export const AXES = [
  { id: 'leadership', label: 'Leadership',   low: 'Follower',         high: 'Captain' },
  { id: 'workEthic',  label: 'Work ethic',   low: 'Coasts',           high: 'First in, last out' },
  { id: 'composure',  label: 'Composure',    low: 'Volatile',         high: 'Ice cold' },
  { id: 'ego',        label: 'Ego',          low: 'Team-first',       high: 'Me-first' },
  { id: 'loyalty',    label: 'Loyalty',      low: 'Mercenary',        high: 'Franchise lifer' },
  { id: 'greed',      label: 'Money motive', low: 'Plays for love',   high: 'Chases the bag' },
];

// `public` traits are reputation: everyone in the league knows. The rest only
// show on other teams' players once they have been scouted.
export const TRAITS = {
  captain:  { label: 'Captain',          icon: '🎖️', tone: 'good',  public: true,
              effect: 'Lifts the locker room. Trading him away hurts team morale.' },
  mentor:   { label: 'Mentor',           icon: '🧑‍🏫', tone: 'good',  public: true,
              effect: 'Young players at his position develop faster.' },
  gymRat:   { label: 'Gym rat',          icon: '🏋️', tone: 'good',  public: false,
              effect: 'Progresses faster and ages more gracefully.' },
  film:     { label: 'Film junkie',      icon: '🎞️', tone: 'good',  public: false,
              effect: 'Gets extra value out of weekly opponent preparation.' },
  clutch:   { label: 'Ice in his veins', icon: '🧊', tone: 'good',  public: true,
              effect: 'Plays up in the fourth quarter and the playoffs.' },
  hothead:  { label: 'Hothead',          icon: '🌋', tone: 'bad',   public: true,
              effect: 'Plays with fire — and draws penalties, fines and ejections.' },
  diva:     { label: 'Diva',             icon: '💅', tone: 'bad',   public: true,
              effect: 'Wants the ball and the spotlight. Sulks, then talks, when he doesn\'t get them.' },
  showman:  { label: 'Showman',          icon: '🎤', tone: 'mixed', public: true,
              effect: 'Loves the big stage. Fans and media love him back.' },
  mercenary:{ label: 'Mercenary',        icon: '💰', tone: 'bad',   public: false,
              effect: 'Goes to the highest bidder. No hometown discounts.' },
  loyal:    { label: 'Franchise guy',    icon: '🤝', tone: 'good',  public: false,
              effect: 'Takes less to stay — and hates being shopped.' },
  party:    { label: 'Party animal',     icon: '🎉', tone: 'bad',   public: false,
              effect: 'Misses curfews and meetings. Talent can go to waste.' },
  quietPro: { label: 'Quiet pro',        icon: '🤫', tone: 'good',  public: false,
              effect: 'No drama, no noise. Just shows up.' },
};

// Each rule returns how strongly a player shows the trait (> 0 = has it).
const TRAIT_RULES = {
  captain:   (a) => a.leadership - 88,
  mentor:    (a, p) => (p.age >= 30 ? Math.min(a.leadership - 72, 48 - a.ego) : -1),
  gymRat:    (a) => a.workEthic - 85,
  film:      (a, p) => (['QB', 'LB', 'S', 'CB'].includes(p.position) ? Math.min(a.workEthic - 66, a.composure - 60) : -1),
  clutch:    (a) => a.composure - 87,
  hothead:   (a) => 17 - a.composure,
  diva:      (a) => Math.min(a.ego - 78, 55 - a.composure),
  showman:   (a) => Math.min(a.ego - 72, a.composure - 55),
  mercenary: (a) => Math.min(a.greed - 75, 40 - a.loyalty),
  loyal:     (a) => a.loyalty - 80,
  party:     (a) => 25 - a.workEthic,
  quietPro:  (a) => Math.min(22 - a.ego, a.workEthic - 55),
};

// The old single-word personalities, expressed as axis nudges.
const LEGACY_BIAS = {
  Leader:     { leadership: 18, composure: 6 },
  Clutch:     { composure: 16 },
  BoomBust:   { composure: -14, ego: 10 },
  Workhorse:  { workEthic: 20 },
  Playmaker:  { ego: 12 },
  Reliable:   { workEthic: 10, composure: 10, ego: -10 },
  Hothead:    { composure: -24, ego: 8 },
  IceInVeins: { composure: 20 },
};

const HOMETOWNS = [
  'Miami, FL', 'Tampa, FL', 'Jacksonville, FL', 'Belle Glade, FL', 'Fort Lauderdale, FL', 'Orlando, FL',
  'Houston, TX', 'Dallas, TX', 'Austin, TX', 'San Antonio, TX', 'Odessa, TX', 'Beaumont, TX', 'Tyler, TX',
  'Atlanta, GA', 'Valdosta, GA', 'Savannah, GA', 'Macon, GA',
  'New Orleans, LA', 'Baton Rouge, LA', 'Shreveport, LA', 'Monroe, LA',
  'Birmingham, AL', 'Mobile, AL', 'Montgomery, AL', 'Jackson, MS', 'Hattiesburg, MS',
  'Memphis, TN', 'Nashville, TN', 'Knoxville, TN', 'Charlotte, NC', 'Raleigh, NC', 'Columbia, SC', 'Greenville, SC',
  'Richmond, VA', 'Norfolk, VA', 'Baltimore, MD', 'Washington, DC', 'Philadelphia, PA', 'Pittsburgh, PA', 'Aliquippa, PA',
  'Newark, NJ', 'Paterson, NJ', 'Brooklyn, NY', 'Buffalo, NY', 'Boston, MA',
  'Cleveland, OH', 'Columbus, OH', 'Cincinnati, OH', 'Youngstown, OH', 'Massillon, OH', 'Detroit, MI', 'Flint, MI',
  'Chicago, IL', 'East St. Louis, IL', 'Indianapolis, IN', 'Gary, IN', 'Milwaukee, WI', 'Minneapolis, MN',
  'St. Louis, MO', 'Kansas City, MO', 'Omaha, NE', 'Des Moines, IA', 'Tulsa, OK', 'Oklahoma City, OK', 'Wichita, KS',
  'Denver, CO', 'Phoenix, AZ', 'Tucson, AZ', 'Las Vegas, NV', 'Salt Lake City, UT', 'Boise, ID',
  'Los Angeles, CA', 'Long Beach, CA', 'Compton, CA', 'Oakland, CA', 'Sacramento, CA', 'San Diego, CA', 'Fresno, CA',
  'Seattle, WA', 'Tacoma, WA', 'Portland, OR', 'Honolulu, HI', 'Anchorage, AK', 'Pago Pago, AS',
];
const INTERNATIONAL = ['Toronto, Canada', 'London, England', 'Lagos, Nigeria', 'Sydney, Australia', 'Auckland, New Zealand', 'Berlin, Germany', 'Mexico City, Mexico', 'Kingston, Jamaica'];

const COLLEGES = [
  'Alabama', 'Georgia', 'Ohio State', 'Michigan', 'LSU', 'Texas', 'Oklahoma', 'Oregon', 'USC', 'Clemson', 'Florida',
  'Florida State', 'Miami', 'Penn State', 'Notre Dame', 'Tennessee', 'Auburn', 'Texas A&M', 'Wisconsin', 'Iowa',
  'Utah', 'Washington', 'Ole Miss', 'Mississippi State', 'Arkansas', 'Kentucky', 'South Carolina', 'Missouri',
  'TCU', 'Baylor', 'Oklahoma State', 'Kansas State', 'Minnesota', 'Pittsburgh', 'Louisville', 'Virginia Tech',
  'North Carolina', 'NC State', 'Stanford', 'UCLA', 'Arizona State', 'Colorado', 'Boise State', 'Tulane', 'Memphis',
  'Cincinnati', 'Houston', 'Toledo', 'Western Michigan', 'Appalachian State', 'North Dakota State', 'Jackson State',
  'South Dakota State', 'Montana', 'Delaware', 'Villanova', 'Grambling State', 'Howard',
];

// Real NFL number ranges, so a QB never wears 74.
const NUMBER_RANGES = {
  QB: [[1, 19]], K: [[1, 19]], P: [[1, 19]],
  RB: [[20, 39], [0, 9]], WR: [[10, 19], [80, 89], [0, 9]], TE: [[80, 89], [40, 49]],
  OL: [[60, 79], [50, 59]], DL: [[90, 99], [50, 79]], LB: [[40, 59], [90, 99]],
  CB: [[20, 39], [0, 9]], S: [[20, 49], [0, 9]],
};

// [height inches, weight lb] centres by position.
const BUILD = {
  QB: [75, 222], RB: [70, 214], WR: [72, 199], TE: [77, 250], OL: [77, 312], DL: [76, 290],
  LB: [74, 238], CB: [71, 193], S: [72, 206], K: [73, 195], P: [74, 212],
};

const QUOTES = {
  captain:  ['"We don\'t flinch. Not this group."', '"Everybody eats when everybody works."'],
  mentor:   ['"Somebody showed me the way. Now it\'s my turn."', '"The young guys ask me everything. I love it."'],
  gymRat:   ['"Film at five, lift at six. Every day."', '"I don\'t take days off. Days take me off."'],
  film:     ['"I knew the check before they snapped it."', '"Tuesdays are the best day of my week."'],
  clutch:   ['"Fourth quarter is where I live."', '"Pressure is a privilege."'],
  hothead:  ['"I play angry. That\'s who I am."', '"I\'m not apologizing for caring."'],
  diva:     ['"Get me the ball and we win. Simple."', '"I just want to be used right."'],
  showman:  ['"Prime time? That\'s my time."', '"You paid for a ticket. I\'m giving you a show."'],
  mercenary:['"It\'s a business. I respect the business."', '"My agent handles the feelings."'],
  loyal:    ['"I bleed these colors."', '"This town took a chance on me."'],
  party:    ['"Work hard, play harder. Mostly the second one."', '"Curfew is a suggestion, right?"'],
  quietPro: ['"Just doing my job."', '"Next play."'],
  none:     ['"One week at a time."', '"Control what you can control."', '"We\'ve got a lot to clean up."'],
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
// Average of three uniforms: a soft bell centred on 50, so extremes are rare.
const bell = rng => ((rng() + rng() + rng()) / 3) * 98 + 1;

function deriveAxes(player, rng) {
  const bias = LEGACY_BIAS[player.personality] || {};
  const age = player.age ?? 25;
  const axes = {};
  for (const { id } of AXES) axes[id] = bell(rng) + (bias[id] || 0);
  // Veterans lead more and posture less; quarterbacks are asked to lead.
  axes.leadership += Math.max(0, age - 24) * 1.1 + (player.position === 'QB' ? 6 : 0);
  axes.ego -= Math.max(0, age - 28) * 1.2;
  for (const k of Object.keys(axes)) axes[k] = Math.round(clamp(axes[k], 1, 99));
  return axes;
}

function deriveTraits(axes, player) {
  return Object.entries(TRAIT_RULES)
    .map(([id, rule]) => ({ id, strength: rule(axes, player) }))
    .filter(t => t.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map(t => t.id);
}

function jerseyNumber(position, rng) {
  const ranges = NUMBER_RANGES[position] || [[1, 99]];
  // Most players wear the position's primary range.
  const [lo, hi] = rng() < 0.8 ? ranges[0] : pick(ranges, rng);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function build(position, rng) {
  const [h, w] = BUILD[position] || [73, 220];
  const inches = Math.round(h + (rng() - 0.5) * 4);
  const pounds = Math.round(w + (rng() - 0.5) * 36 + (inches - h) * 5);
  return { heightIn: inches, weightLb: pounds, height: `${Math.floor(inches / 12)}'${inches % 12}"` };
}

const cache = new Map();

/**
 * Who this player is. Pure and memoised by id + the few inputs that shape it.
 * @returns {{ axes, traits: string[], hometown, college, number, height, heightIn, weightLb, quote }}
 */
export function characterFor(player) {
  if (!player?.id) return null;
  const key = `${player.id}|${player.personality ?? ''}|${player.age ?? ''}|${player.position}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Separate streams so adding a field later never reshuffles the others.
  const axes = deriveAxes(player, seededRng(`${player.id}|axes`));
  const traits = deriveTraits(axes, player);
  const bio = seededRng(`${player.id}|bio`);
  const hometown = bio() < 0.04 ? pick(INTERNATIONAL, bio) : pick(HOMETOWNS, bio);
  const college = player.college || player.school || pick(COLLEGES, bio);
  const number = jerseyNumber(player.position, seededRng(`${player.id}|number`));
  const body = build(player.position, seededRng(`${player.id}|build`));
  const quotes = QUOTES[traits[0] ?? 'none'];
  const quote = quotes[hashSeed(`${player.id}|quote`) % quotes.length];

  const character = { axes, traits, hometown, college, number, quote, ...body };
  if (cache.size > 6000) cache.clear();
  cache.set(key, character);
  return character;
}

/**
 * Fog of personality. Your own players are an open book; everyone else shows
 * only their reputation (public traits) until scouted.
 * @param {object} player
 * @param {{ own?: boolean, scouted?: boolean }} ctx
 */
export function personalityView(player, { own = false, scouted = false } = {}) {
  const c = characterFor(player);
  if (!c) return null;
  const full = own || scouted;
  const traits = c.traits.filter(id => full || TRAITS[id].public);
  return {
    full,
    traits: traits.map(id => ({ id, ...TRAITS[id] })),
    hiddenTraits: c.traits.length - traits.length,
    axes: full ? AXES.map(a => ({ ...a, value: c.axes[a.id] })) : null,
  };
}

// ── Step 2: personality in the front office ─────────────────────────────────
// Mood is DERIVED from a player's real situation — pay against his market,
// his role, the team's record — read through his personality. Nothing is
// stored, so it is always current and costs nothing in the save.

const STARTER_SLOTS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 };

/** Where he sits at his position on this roster. */
export function roleOf(player, roster = []) {
  const same = roster.filter(p => p.position === player.position).sort((a, b) => b.ovr - a.ovr);
  const rank = same.findIndex(p => p.id === player.id);
  const slots = STARTER_SLOTS[player.position] || 1;
  const starter = rank >= 0 && rank < slots;
  const gapToStarter = !starter && same.length >= slots ? same[slots - 1].ovr - player.ovr : 0;
  return { rank, slots, starter, gapToStarter };
}

/** The slice of game state mood needs, for one team. */
export function teamContext(state, teamId) {
  const st = state?.standings?.[teamId];
  const games = st ? (st.wins || 0) + (st.losses || 0) + (st.ties || 0) : 0;
  return {
    roster: state?.rosters?.[teamId] || [],
    games,
    winPct: games ? ((st.wins || 0) + 0.5 * (st.ties || 0)) / games : 0.5,
  };
}

const MOOD_BASE = 74;
const MOOD_LEVELS = [
  [85, 'Thrilled', '😄', 'good'],
  [66, 'Content', '🙂', 'good'],
  [48, 'Restless', '😐', 'mixed'],
  [30, 'Frustrated', '😠', 'bad'],
  [0, 'Wants out', '🧳', 'bad'],
];

/**
 * How he feels and why. With no context (e.g. a free agent) he is simply
 * "Content"; with a team context the reasons are real.
 * @returns {{ score, label, icon, tone, reasons: Array<{ delta, text }> }}
 */
export function moodFor(player, ctx = null) {
  const c = characterFor(player);
  if (!c) return null;
  const a = c.axes, has = id => c.traits.includes(id);
  const raw = [];
  const add = (delta, text) => { if (Math.abs(delta) >= 1) raw.push({ delta, text }); };

  if (ctx) {
    if (ctx.games >= 2) {
      const swing = ctx.winPct - 0.5;
      const cares = 0.6 + a.leadership / 200 + a.ego / 400 - (has('mercenary') ? 0.4 : 0);
      add(swing * (swing > 0 ? 40 : 58) * cares, swing > 0 ? 'The team is winning' : 'The team is losing');
    }
    // Pay only stings a real contributor. Depth players and rookies on their
    // first deal accept the scale — except a young star outplaying it.
    const ask = askingSalary(player);
    const salary = player.contract?.salary ?? 2;
    const ratio = salary / Math.max(1, ask);
    const rookieDeal = (player.experience ?? 0) < 3;
    const contributor = player.ovr >= 72;
    if (contributor && ratio < 0.8) {
      if (!rookieDeal) add(-(0.8 - ratio) * 45 * (0.4 + a.greed / 100), `Underpaid: $${salary}M against a $${ask}M market`);
      else if (player.ovr >= 85 && a.greed >= 65) add(-8, 'Outplaying his rookie deal');
    } else if (ratio > 1.25) add(Math.min(8, (ratio - 1.25) * 20), 'Paid well');
    if (contributor && !rookieDeal && (player.contract?.yearsLeft ?? 2) <= 1 && ratio < 1.05) {
      add(-(a.greed / 100) * 10, 'Playing for his next contract');
    }

    // Backing up is the job for most of a roster; it only grates on a player
    // good enough to start, and more so the bigger his ego.
    const role = roleOf(player, ctx.roster);
    if (role.rank >= 0 && !role.starter && player.ovr >= 70 && role.gapToStarter <= 4) {
      add(-12 * (0.3 + a.ego / 100), 'Believes he should be starting');
    } else if (role.starter && player.ovr >= 80) {
      add(4, 'Featured starter');
    }
    if (has('loyal')) add(6, 'Loves playing here');
  }

  // Temperament scales everything: volatile players and divas swing harder,
  // quiet pros barely move.
  const temper = (0.8 + (100 - a.composure) / 250) * (has('diva') ? 1.3 : 1) * (has('quietPro') ? 0.6 : 1);
  const reasons = raw.map(r => ({ delta: Math.round(r.delta * temper), text: r.text }))
    .filter(r => r.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const score = Math.round(clamp(MOOD_BASE + reasons.reduce((s, r) => s + r.delta, 0), 3, 98));
  const [, label, icon, tone] = MOOD_LEVELS.find(([min]) => score >= min);
  return { score, label, icon, tone, reasons };
}

/**
 * What he wants to stay. Greed and loyalty move the price, so does his mood;
 * a player who wants out will not talk extension at all.
 * @returns {{ askMultiplier, ask, willing, refusal, notes: string[], mood }}
 */
export function contractStance(player, ctx = null) {
  const c = characterFor(player);
  const a = c.axes, has = id => c.traits.includes(id);
  const mood = moodFor(player, ctx);
  const notes = [];
  let mult = 1 + (a.greed - 50) / 220 - (a.loyalty - 50) / 260 - (mood.score - 66) / 350;
  if (a.greed >= 70) notes.push('Money matters to him');
  if (a.loyalty >= 70) notes.push('Wants to stay');
  if (has('loyal')) { mult *= 0.92; notes.push('Franchise guy: hometown discount'); }
  if (has('mercenary')) { mult *= 1.1; notes.push('Mercenary: no discounts, it\'s business'); }
  if (mood.score < 48) notes.push(`${mood.label}: it will cost more to keep him`);
  if (mood.score >= 85) notes.push('Happy here: open to a fair deal');
  mult = clamp(mult, 0.82, 1.38);
  const willing = mood.score >= 30;
  return {
    askMultiplier: Math.round(mult * 100) / 100,
    ask: Math.max(1, Math.round(askingSalary(player) * mult)),
    willing,
    refusal: willing ? null
      : `${player.name} wants out and won't discuss an extension. ${mood.reasons[0] ? `(${mood.reasons[0].text}.)` : ''} Fix his situation or trade him.`,
    notes,
    mood,
  };
}

// Reputation moves trade value. Only public traits count: that is what the
// other 31 front offices know about him.
const REPUTATION_VALUE = { captain: 1.08, clutch: 1.05, mentor: 1.03, showman: 1.02, hothead: 0.9, diva: 0.9 };

export function reputationMultiplier(player) {
  const c = characterFor(player);
  if (!c) return 1;
  const m = c.traits.filter(t => TRAITS[t].public).reduce((acc, t) => acc * (REPUTATION_VALUE[t] ?? 1), 1);
  return clamp(m, 0.85, 1.15);
}

/**
 * What trading these players away does to the locker room you keep.
 * @returns {{ moraleDelta, notes: Array<{ delta, text }> }}
 */
export function tradeFallout(outgoing = []) {
  const notes = [];
  for (const p of outgoing) {
    const t = characterFor(p)?.traits ?? [];
    if (t.includes('captain')) notes.push({ delta: -6, text: `Trading away captain ${p.name} shakes the locker room` });
    if (t.includes('mentor')) notes.push({ delta: -3, text: `The young players lose their mentor, ${p.name}` });
    if (t.includes('loyal')) notes.push({ delta: -3, text: `${p.name} wanted to finish his career here` });
    if (t.some(x => ['diva', 'hothead', 'party'].includes(x))) notes.push({ delta: 2, text: `The room exhales with ${p.name} gone` });
  }
  const moraleDelta = clamp(notes.reduce((s, n) => s + n.delta, 0), -15, 6);
  return { moraleDelta, notes };
}

/** A player unhappy enough to go public. */
export function wantsOut(player, ctx) {
  const mood = moodFor(player, ctx);
  return mood.score < 30 ? { yes: true, reason: mood.reasons[0]?.text ?? 'Unhappy with his situation', mood } : { yes: false, mood };
}

/**
 * How he weighs free-agent offers. Mercenaries follow the money, ring-chasing
 * leaders want a winner, egos want to start, franchise guys want to come home.
 */
export function faPreferences(player) {
  const c = characterFor(player);
  const a = c.axes, has = id => c.traits.includes(id);
  const prefs = { moneyPower: 1, winWeight: 0.12, loyalWeight: 0.06, starterWeight: 0.05, notes: [] };
  if (has('mercenary') || a.greed >= 80) {
    prefs.moneyPower = 1.4; prefs.winWeight = 0.04; prefs.loyalWeight = 0;
    prefs.notes.push('follows the money');
  }
  if ((player.age ?? 25) >= 29 && a.leadership >= 65) { prefs.winWeight = 0.25; prefs.notes.push('wants a ring — your record matters'); }
  if (a.ego >= 70 || has('diva')) { prefs.starterWeight = 0.15; prefs.notes.push('wants to start'); }
  if (has('loyal')) { prefs.loyalWeight = 0.18; prefs.notes.push('would love to come home'); }
  return prefs;
}
