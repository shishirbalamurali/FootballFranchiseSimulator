// Game context: what makes this game *this* game.
//
// A Week 3 non-conference game and a Week 17 division game with the playoffs
// on the line are not the same football game, and the sim shouldn't pretend
// they are. gameContext() reads the league state for one matchup (division,
// rivalry, stage, prime-time slot, point spread, playoff stakes, trap games)
// and engineContext() turns that into the handful of small, bounded knobs
// gameEngine.js understands. With no context the engine plays exactly as it
// always has, so league calibration never sees any of this.
//
// Pure functions of state; nothing here is persisted except the compact
// summary gamePlan.js#gameDetailFields keeps on each schedule row.

import { TEAMS } from '../data/teams.js';
import { calculateTeamRatings } from './ratings.js';
import { rivalryFor } from './rivalries.js';
import { hashSeed } from './seededRandom.js';

const TEAM = new Map(TEAMS.map(t => [t.id, t]));

// Measured on the engine: each point of team overall is worth about a point of
// margin, and home field about two (tests/gameContext.mjs re-checks it).
const PTS_PER_OVR = 1.0;
const HOME_POINTS = 1.9;

export const STAGE_LABEL = {
    regular: 'Regular season', wildcard: 'Wild Card', divisional: 'Divisional round',
    conference: 'Conference championship', final: 'Championship game',
};
const PLAYOFF_STAGE = [null, 'wildcard', 'divisional', 'conference', 'final'];

export const SLOT_LABEL = { TNF: 'Thursday Night', SNF: 'Sunday Night', MNF: 'Monday Night' };

const ratingsCache = new WeakMap();
function overallOf(roster) {
    if (!Array.isArray(roster) || !roster.length) return 75;
    let hit = ratingsCache.get(roster);
    if (hit == null) {
        const r = calculateTeamRatings(roster);
        // Offense and defense unrounded are finer-grained than the rounded overall.
        hit = Number.isFinite(r?.offense?.overall) && Number.isFinite(r?.defense?.overall)
            ? (r.offense.overall + r.defense.overall) / 2 : (r?.overall ?? 75);
        ratingsCache.set(roster, hit);
    }
    return hit;
}

const record = s => (s ? `${s.wins || 0}-${s.losses || 0}${s.ties ? `-${s.ties}` : ''}` : '0-0');
const played = s => (s ? (s.wins || 0) + (s.losses || 0) + (s.ties || 0) : 0);
const winPct = s => {
    const n = played(s);
    return n ? ((s.wins || 0) + (s.ties || 0) * 0.5) / n : 0.5;
};
const roundHalf = v => Math.round(v * 2) / 2;

/** Point spread from home's side: + means home is favored by that many. */
export function pointSpread(state, homeId, awayId) {
    const h = overallOf(state?.rosters?.[homeId]);
    const a = overallOf(state?.rosters?.[awayId]);
    return roundHalf((h - a) * PTS_PER_OVR + HOME_POINTS);
}

const regularGames = week => (Array.isArray(week) ? week.filter(g => g?.homeTeamId && g?.awayTeamId) : []);
const gameKey = g => `${g.awayTeamId}@${g.homeTeamId}`;

/**
 * Prime-time windows for a regular-season week: a Thursday opener, then Sunday
 * and Monday night go to the best records on the slate. Deterministic, so the
 * schedule, the preview and the broadcast always agree.
 * @returns {Map<string, 'TNF'|'SNF'|'MNF'>} keyed "away@home"
 */
export function weekSlots(state, week) {
    const out = new Map();
    const games = regularGames(state?.schedule?.[week - 1]);
    if (games.length < 3) return out;
    const seed = g => hashSeed(`${state?.year ?? ''}|${week}|${gameKey(g)}`);
    const standings = state?.standings || {};
    const pull = g => (standings[g.homeTeamId]?.wins || 0) + (standings[g.awayTeamId]?.wins || 0)
        + (TEAM.get(g.homeTeamId)?.division === TEAM.get(g.awayTeamId)?.division ? 0.5 : 0);
    const byHash = [...games].sort((a, b) => seed(a) - seed(b));
    const tnf = byHash[0];
    out.set(gameKey(tnf), 'TNF');
    const rest = games.filter(g => g !== tnf).sort((a, b) => pull(b) - pull(a) || seed(a) - seed(b));
    out.set(gameKey(rest[0]), 'SNF');
    if (rest[1] && week < 18) out.set(gameKey(rest[1]), 'MNF');
    return out;
}

function nextOpponent(state, teamId, week) {
    const next = regularGames(state?.schedule?.[week]);
    const g = next.find(x => x.homeTeamId === teamId || x.awayTeamId === teamId);
    return g ? (g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId) : null;
}

// Late-season stakes for one team. Only meaningful from Week 12 on.
function stakesFor(state, teamId, week) {
    const s = state?.standings?.[teamId];
    if (!s || week < 12) return null;
    const left = Math.max(0, 17 - played(s));
    const pct = winPct(s);
    if (week >= 18 && (s.wins || 0) >= 13) return 'resting';
    if ((s.wins || 0) + left < 8 || (pct < 0.3 && week >= 14)) return 'eliminated';
    if (pct >= 0.4 && pct <= 0.65) return 'bubble';
    return null;
}

/**
 * Everything about a matchup beyond the two rosters.
 * @returns {{ stage, week, division, conference, rivalry, rivalryLabel, slot, spread, favorite,
 *             records: string[], streaks: number[], stakes: (string|null)[], trap: boolean[],
 *             tags: {id,label,tone}[] }}
 *   Index 0 is home, 1 is away throughout (the engine's convention).
 */
export function gameContext(state, homeId, awayId) {
    const home = TEAM.get(homeId), away = TEAM.get(awayId);
    if (!home || !away) return null;
    const week = Number(state?.week) || 1;
    const stage = state?.phase === 'playoffs' ? (PLAYOFF_STAGE[state?.playoffBracket?.round] || 'wildcard') : 'regular';
    const division = home.conference === away.conference && home.division === away.division;
    const conference = home.conference === away.conference;
    let riv = { level: division ? 1 : 0, label: division ? 'Rivalry' : 'Matchup' };
    try { riv = rivalryFor(homeId, awayId, state || {}); } catch { /* keep the division default */ }
    const slot = stage === 'regular' ? (weekSlots(state, week).get(`${awayId}@${homeId}`) || null) : null;
    const spread = pointSpread(state, homeId, awayId);
    const favorite = spread > 0 ? 0 : spread < 0 ? 1 : null;
    const st = [state?.standings?.[homeId], state?.standings?.[awayId]];
    const stakes = stage === 'regular' ? [stakesFor(state, homeId, week), stakesFor(state, awayId, week)] : [null, null];

    // Trap game: a heavy favorite against a losing team, with a big one next week.
    const trap = [false, false];
    if (stage === 'regular' && favorite != null && Math.abs(spread) >= 6.5) {
        const dog = st[1 - favorite];
        if (played(dog) >= 4 && winPct(dog) < 0.4) {
            const favId = favorite === 0 ? homeId : awayId;
            const nextId = nextOpponent(state, favId, week);
            const nextTeam = TEAM.get(nextId);
            const favTeam = TEAM.get(favId);
            const bigNext = nextId && (winPct(state?.standings?.[nextId]) >= 0.6
                || (nextTeam && favTeam && nextTeam.division === favTeam.division && nextTeam.conference === favTeam.conference));
            if (bigNext) trap[favorite] = true;
        }
    }

    const tags = [];
    if (stage !== 'regular') tags.push({ id: 'playoff', label: STAGE_LABEL[stage], tone: 'gold' });
    if (slot) tags.push({ id: 'slot', label: SLOT_LABEL[slot], tone: 'night' });
    if (riv.level >= 2) tags.push({ id: 'rivalry', label: riv.label, tone: 'fire' });
    else if (division) tags.push({ id: 'division', label: 'Division clash', tone: 'fire' });
    if (favorite != null && Math.abs(spread) >= 7) tags.push({ id: 'upsetWatch', label: 'Upset watch', tone: 'alert' });
    else if (Math.abs(spread) <= 2.5) tags.push({ id: 'tossup', label: 'Toss-up', tone: 'plain' });
    stakes.forEach((s, i) => {
        const abbr = (i === 0 ? home : away).abbreviation;
        if (s === 'bubble') tags.push({ id: `stakes${i}`, label: `${abbr} on the bubble`, tone: 'alert' });
        else if (s === 'eliminated') tags.push({ id: `stakes${i}`, label: `${abbr} playing out the string`, tone: 'plain' });
        else if (s === 'resting') tags.push({ id: `stakes${i}`, label: `${abbr} resting starters`, tone: 'plain' });
    });
    trap.forEach((t, i) => { if (t) tags.push({ id: `trap${i}`, label: `Trap game for ${(i === 0 ? home : away).abbreviation}`, tone: 'alert' }); });

    return {
        stage, week, division, conference,
        rivalry: riv.level || 0, rivalryLabel: riv.label,
        slot, spread, favorite,
        records: [record(st[0]), record(st[1])],
        streaks: [st[0]?.streak || 0, st[1]?.streak || 0],
        stakes, trap, tags,
    };
}

/**
 * The knobs the engine reads. Every effect is bounded and centred so that a
 * neutral context changes nothing.
 *   underdog     0 | 1 | null — who gets the "any given Sunday" lift
 *   dogLift      rating points of form for the underdog (offense; defense gets 60%)
 *   formSpread   multiplier on game-day form variance (big stages are wilder)
 *   homeEdge     extra home crowd, rating points
 *   sloppy       0-1: short-week football (more turnovers, fewer points)
 *   formShift    [home, away] { off, def } flat form adjustments (stakes, traps, resting)
 *   pressure     0-1: how much composure decides the Witching Hour
 */
export function engineContext(ctx) {
    if (!ctx) return null;
    const playoff = ctx.stage !== 'regular';
    // Familiarity compresses the talent gap: division foes see each other twice
    // a year, rivals know every call, and in January everyone is good.
    const familiarity = (ctx.division ? 0.55 : ctx.conference ? 0.12 : 0)
        + Math.max(0, (ctx.rivalry || 0) - (ctx.division ? 1 : 0)) * 0.12
        + (playoff ? 0.3 : 0);
    const gap = Math.min(14, Math.abs(ctx.spread || 0));
    // Form moves the margin only ~0.3 points per point of lift, so this is
    // sized in form units: an 8.5-point division dog gets ~9, worth roughly
    // six or seven points of upset probability (tests/gameContext.mjs).
    const dogLift = ctx.favorite == null ? 0 : Math.min(10, gap * familiarity * 1.9);
    const formSpread = 1 + (ctx.slot ? 0.08 : 0) + Math.min(0.12, (ctx.rivalry || 0) * 0.04) + (playoff ? 0.06 : 0);
    const homeEdge = (ctx.slot === 'SNF' || ctx.slot === 'MNF' ? 0.6 : 0) + Math.min(1.2, (ctx.rivalry || 0) * 0.4) + (playoff ? 0.8 : 0);
    const shift = i => {
        const s = ctx.stakes?.[i];
        const f = { off: 0, def: 0 };
        if (s === 'eliminated') { f.def -= 1.6; f.off -= 0.6; }
        else if (s === 'bubble') { f.off += 0.8; f.def += 0.8; }
        else if (s === 'resting') { f.off -= 4.5; f.def -= 3; }
        if (ctx.trap?.[i]) { f.off -= 2.6; f.def -= 1.4; }
        return f;
    };
    return {
        underdog: ctx.favorite == null ? null : 1 - ctx.favorite,
        dogLift,
        formSpread,
        homeEdge,
        sloppy: ctx.slot === 'TNF' ? 1 : 0,
        formShift: [shift(0), shift(1)],
        pressure: playoff ? 1 : ctx.slot || ctx.rivalry >= 2 ? 0.7 : 0.5,
    };
}

/**
 * The ~30-byte summary kept on every schedule row, so any screen can tell an
 * upset or a division game after the fact. Keys are short on purpose.
 */
export function compactContext(ctx) {
    if (!ctx) return null;
    const out = { s: ctx.spread };
    if (ctx.division) out.d = 1;
    if (ctx.rivalry >= 2) out.r = ctx.rivalry;
    if (ctx.slot) out.t = ctx.slot;
    if (ctx.stage !== 'regular') out.p = ctx.stage;
    if (ctx.trap?.[0]) out.x = 0; else if (ctx.trap?.[1]) out.x = 1;
    return out;
}

/**
 * Read a stored summary back: who was favored, and did they lose?
 * Accepts a schedule row (with `ctx`) and returns null for older rows.
 */
export function upsetInfo(game) {
    const c = game?.ctx;
    if (!c || !Number.isFinite(c.s) || !Number.isFinite(game.homeScore) || !Number.isFinite(game.awayScore)) return null;
    if (game.homeScore === game.awayScore || Math.abs(c.s) < 3) return { upset: false, spread: c.s, division: !!c.d };
    const favHome = c.s > 0;
    const upset = favHome ? game.homeScore < game.awayScore : game.awayScore < game.homeScore;
    return {
        upset, spread: c.s, division: !!c.d, big: upset && Math.abs(c.s) >= 7,
        underdogId: favHome ? game.awayTeamId : game.homeTeamId,
        trap: c.x != null && upset,
    };
}
