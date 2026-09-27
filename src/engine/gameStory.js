// Reading a simulated game back as football: play descriptions, drives,
// running stat lines and the shape of the game (comeback, shootout, rout…).
// Pure functions over what gameEngine.js records, so the broadcast, the
// scoreboard and the post-game recap all tell the same story.

import { KIND, FLAG, decodePlay } from './gameEngine.js';
import { PLAY_STYLES } from './playStyles.js';
import { hashSeed } from './seededRandom.js';

const QUARTER_SECS = 900;

// ── basics ────────────────────────────────────────────────────────────────────

export const shortName = (name = '') => {
    const parts = String(name).trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : parts[0] || 'Player';
};

const ORD = ['', '1st', '2nd', '3rd', '4th'];
export const downText = (down, togo, yl) => (down >= 1 && down <= 4
    ? `${ORD[down]} & ${yl + togo >= 100 ? 'Goal' : togo}` : '');

export const clockText = secs => {
    const s = Math.max(0, Math.round(secs));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const periodLabel = q => (q <= 4 ? `Q${q}` : q === 5 ? 'OT' : `${q - 4}OT`);

/** Seconds of game time elapsed at a play's snap. */
export const elapsedAt = (q, clock, otLength = 600) => (q <= 4
    ? (q - 1) * QUARTER_SECS + (QUARTER_SECS - clock)
    : 4 * QUARTER_SECS + (q - 5) * otLength + (otLength - clock));

/** Field position from the offense's point of view ("KC 25", "midfield", "BUF 12"). */
export function spotText(yl, offAbbr, defAbbr) {
    if (yl === 50) return 'midfield';
    return yl < 50 ? `${offAbbr} ${yl}` : `${defAbbr} ${100 - yl}`;
}

// ── decoding ──────────────────────────────────────────────────────────────────

/**
 * Expand a stored pbp into plays with names resolved.
 * @param pbp  { plays: tuple[], names: [name, pos, side][] }
 */
export function readPbp(pbp) {
    if (!pbp?.plays?.length) return [];
    const names = pbp.names || [];
    // Entries are [name, pos, side, playerId?, styleId?]; older saves have only the first three.
    const who = i => (i >= 0 && names[i] ? {
        id: i, name: names[i][0], short: shortName(names[i][0]), pos: names[i][1], side: names[i][2],
        playerId: names[i][3] ?? null, style: names[i][4] ?? null,
    } : null);
    return pbp.plays.map((t, idx) => {
        const p = decodePlay(t);
        p.idx = idx;
        p.A = who(p.a); p.B = who(p.b); p.X = who(p.x);
        const fumbled = (p.kind === KIND.SACK || p.kind === KIND.RUN || p.kind === KIND.PASS) && (p.flags & FLAG.FUMBLE);
        const blockedSix = (p.kind === KIND.FG_MISS || p.kind === KIND.PUNT) && (p.flags & FLAG.BLOCKED) && (p.flags & FLAG.RETURN_TD);
        p.R = fumbled || blockedSix ? who(p.extra) : null;
        p.has = f => (p.flags & f) !== 0;
        return p;
    });
}

// ── describing a play ─────────────────────────────────────────────────────────

const BIG_PASS = 25, BIG_RUN = 15;

// Stable variety: the same play always gets the same words.
const vary = (p, list) => list[hashSeed(`${p.idx}|${p.kind}|${p.yards}`) % list.length];

/**
 * @param p     a play from readPbp
 * @param abbr  [homeAbbr, awayAbbr]
 * @returns {{ text, tag, tone, key, weight, scoring, clutch, choke, trick, witching }}
 *   tag   short callout ("TOUCHDOWN", "SACK", "INTERCEPTED", "BIG PLAY"…) or null
 *   tone  'score' | 'turnover' | 'defense' | 'big' | 'plain'
 *   key   worth a line in the highlight feed
 *   weight how long the broadcast should dwell on it (1 = a routine snap)
 */
export function describePlay(p, abbr) {
    const off = abbr[p.off] ?? 'OFF', def = abbr[1 - p.off] ?? 'DEF';
    const A = p.A?.short ?? off, B = p.B?.short ?? 'the receiver', X = p.X?.short;
    const y = p.yards;
    const td = p.has(FLAG.TD);
    const go = p.has(FLAG.FOURTH_GO);
    const first = p.has(FLAG.FIRST);
    const trick = p.has(FLAG.TRICK);
    const blocked = p.has(FLAG.BLOCKED);
    const yd = n => `${n} yard${Math.abs(n) === 1 ? '' : 's'}`;
    const by = X ? ` (${X})` : '';
    let text = '', tag = null, tone = 'plain', key = false, weight = 1;

    switch (p.kind) {
        case KIND.RUN:
            if (trick && go) {
                const fg = 100 - p.yl + 17 <= 58;
                text = td ? `FAKE ${fg ? 'FIELD GOAL' : 'PUNT'}! ${A} takes the direct snap and goes ${y} for the TOUCHDOWN!`
                    : first ? `FAKE ${fg ? 'FIELD GOAL' : 'PUNT'}! ${A} takes the direct snap and picks up ${yd(y)} — first down!`
                    : `Fake ${fg ? 'field goal' : 'punt'} — ${A} is stopped short${by}. Didn't fool anybody.`;
                tag = first || td ? (fg ? 'FAKE FG!' : 'FAKE PUNT!') : 'FAKE STOPPED';
                tone = td ? 'score' : first ? 'big' : 'defense';
                break;
            }
            if (td) {
                text = y >= 20 ? vary(p, [`${A} breaks free — ${y}-yard TOUCHDOWN run!`, `${A} is GONE! ${y} yards to the house!`, `${A} hits the hole and nobody touches him — ${y}-yard score!`])
                    : y <= 2 ? vary(p, [`${A} punches it in from ${yd(y)} out. Touchdown.`, `${A} dives over the pile — touchdown!`, `${A} pushes it across the goal line. Six.`])
                    : vary(p, [`${A} runs it in from ${y}. Touchdown!`, `${A} bounces outside and walks in from ${y}!`]);
                tag = 'TOUCHDOWN'; tone = 'score';
            } else if (y >= BIG_RUN) {
                text = vary(p, [`${A} bursts through a hole for ${y}!${by}`, `${A} breaks a tackle and rips off ${y}!${by}`, `Daylight! ${A} for ${y}!${by}`]);
                tag = 'BIG PLAY'; tone = 'big';
            } else if (y < 0) {
                text = `${A} stuffed in the backfield by ${X ?? def}, loss of ${yd(-y)}.`;
                if (go) { tag = '4TH-DOWN STOP'; tone = 'defense'; }
            } else if (y === 0) text = `${A} runs, no gain${by}.`;
            else text = `${A} runs for ${yd(y)}${by}.`;
            if (p.has(FLAG.FUMBLE)) {
                text = `FUMBLE! ${X ?? def} jars it loose from ${A} — ${p.R?.short ?? def} recovers for ${def}.`;
                tag = 'FUMBLE'; tone = 'turnover';
            }
            break;
        case KIND.PASS:
            if (p.has(FLAG.HAIL_MARY) && td) { text = `HAIL MARY! ${A} heaves it and ${B} comes down with it in the end zone!`; tag = 'HAIL MARY'; tone = 'score'; break; }
            if (trick) {
                text = td ? `FLEA FLICKER! The pitch comes back to ${A}, and he hits ${B} for a ${y}-yard TOUCHDOWN!`
                    : `FLEA FLICKER! Handoff, pitch back, and ${A} finds ${B} for ${y}!`;
                tag = 'FLEA FLICKER'; tone = td ? 'score' : 'big';
                break;
            }
            if (td) {
                text = y >= 30 ? vary(p, [`${A} launches it deep — ${B} ${y}-yard TOUCHDOWN!`, `${A} lets it fly... ${B} runs under it — ${y} yards, TOUCHDOWN!`, `Bomb! ${A} to ${B}, ${y} yards to paydirt!`])
                    : vary(p, [`${A} finds ${B} for a ${y}-yard touchdown.`, `${A} fires to ${B} in the end zone — touchdown!`, `${B} gets open and ${A} hits him. Touchdown from ${y}.`]);
                tag = 'TOUCHDOWN'; tone = 'score';
            } else if (y >= BIG_PASS) {
                text = vary(p, [`${A} goes deep to ${B} — ${y} yards!${by}`, `${A} uncorks one to ${B} for ${y}!${by}`, `${B} gets behind the defense — ${A} hits him for ${y}!${by}`]);
                tag = 'BIG PLAY'; tone = 'big';
            } else text = `${A} to ${B} for ${yd(y)}${by}${p.has(FLAG.OOB) ? ', out of bounds' : ''}.`;
            if (p.has(FLAG.FUMBLE)) {
                text = `${A} to ${B} for ${yd(y)} — FUMBLE! ${X ?? def} punches it out, ${p.R?.short ?? def} recovers.`;
                tag = 'FUMBLE'; tone = 'turnover';
            }
            break;
        case KIND.INC:
            if (p.has(FLAG.HAIL_MARY)) text = `${A}'s Hail Mary falls incomplete.`;
            else if (trick) text = `Flea flicker! ${A} looks deep for ${B}... incomplete.`;
            else text = p.has(FLAG.DEFENDED) ? vary(p, [`${A} for ${B} — broken up by ${X}!`, `${X} gets a hand in and knocks it away from ${B}!`]) : `${A} incomplete to ${B}.`;
            if (p.has(FLAG.DEFENDED) && (p.down >= 3 || go)) { tone = 'defense'; tag = go ? '4TH-DOWN STOP' : 'PASS BREAKUP'; }
            else if (go) { tag = '4TH-DOWN STOP'; tone = 'defense'; }
            break;
        case KIND.INT:
            if (p.has(FLAG.RETURN_TD)) { text = `PICK-SIX! ${X ?? def} jumps the route on ${A} and takes it ${yd(p.extra)} to the house!`; tag = 'PICK-SIX'; tone = 'turnover'; }
            else { text = `INTERCEPTED! ${X ?? def} picks off ${A}${p.B ? ` over ${B}` : ''}${p.extra >= 15 ? `, returns it ${p.extra}` : ''}.`; tag = 'INTERCEPTED'; tone = 'turnover'; }
            break;
        case KIND.SACK:
            if (p.has(FLAG.FUMBLE)) { text = `STRIP-SACK! ${X ?? def} takes the ball off ${A} — ${p.R?.short ?? def} recovers!`; tag = 'STRIP-SACK'; tone = 'turnover'; }
            else if (p.has(FLAG.SAFETY)) { text = `${X ?? def} sacks ${A} in the end zone — SAFETY!`; tag = 'SAFETY'; tone = 'defense'; }
            else { text = vary(p, [`${X ?? def} sacks ${A} for a loss of ${yd(-y)}.`, `${X ?? def} gets home! ${A} goes down, ${yd(-y)} lost.`, `${A} has nowhere to go — ${X ?? def} brings him down.`]); tag = 'SACK'; tone = 'defense'; }
            break;
        case KIND.SCRAMBLE:
            if (td) { text = `${A} scrambles and dives in — ${y}-yard touchdown run!`; tag = 'TOUCHDOWN'; tone = 'score'; }
            else if (y >= BIG_RUN) { text = `${A} escapes the pocket and takes off for ${y}!`; tag = 'BIG PLAY'; tone = 'big'; }
            else text = `${A} scrambles for ${yd(y)}${by}.`;
            break;
        case KIND.KNEEL: text = `${A} takes a knee.`; break;
        case KIND.SPIKE: text = `${A} spikes it to stop the clock.`; break;
        case KIND.PUNT: {
            const end = 100 - Math.min(99, p.yl + y);
            if (blocked) {
                text = td ? `PUNT BLOCKED by ${X ?? def}! ${p.R?.short ?? def} scoops it up and scores!` : `PUNT BLOCKED! ${X ?? def} gets a hand on it — ${def} takes over in great field position!`;
                tag = 'BLOCKED!'; tone = td ? 'score' : 'turnover';
            } else if (td) { text = `PUNT RETURN TOUCHDOWN! ${B} takes it all the way back!`; tag = 'RETURN TD'; tone = 'score'; }
            else if (p.has(FLAG.TOUCHBACK)) text = `Punt, ${yd(y)} into the end zone. Touchback.`;
            else if (p.has(FLAG.FAIR_CATCH)) text = `Punt, ${yd(y)}. Fair catch at the ${def} ${end}.`;
            else text = `Punt, ${yd(y)}; ${B} returns it ${p.extra}.`;
            break;
        }
        case KIND.FG:
            text = p.has(FLAG.ICED) ? `They tried to ice him. ${A} drills the ${y}-yarder anyway!`
                : y >= 52 ? `${A} from ${y}... it's got the leg... GOOD!` : vary(p, [`${A} drills a ${y}-yard field goal. It's good!`, `${A} splits the uprights from ${y}.`]);
            tag = 'FIELD GOAL'; tone = 'score';
            break;
        case KIND.FG_MISS:
            if (blocked) {
                text = td ? `BLOCKED! ${X ?? def} gets a paw on the kick and ${p.R?.short ?? def} returns it for a TOUCHDOWN!` : `BLOCKED! ${X ?? def} swats down ${A}'s ${y}-yard try!`;
                tag = 'BLOCKED!'; tone = td ? 'score' : 'turnover';
            } else {
                text = p.has(FLAG.ICED) ? `The timeout worked — ${A}'s ${y}-yard try is NO GOOD!` : vary(p, [`${A}'s ${y}-yard try is NO GOOD.`, `${A} from ${y}... wide! No good.`, `${A} hooks the ${y}-yarder. No good.`]);
                tag = 'NO GOOD'; tone = 'defense';
            }
            break;
        case KIND.XP: text = `${A} adds the extra point.`; break;
        case KIND.XP_MISS: text = `${A} misses the extra point!`; tag = 'PAT MISSED'; tone = 'defense'; break;
        case KIND.TWO: text = `Two-point try is GOOD.`; tag = '2-PT GOOD'; tone = 'score'; break;
        case KIND.TWO_FAIL: text = `Two-point try fails.`; tag = '2-PT FAILS'; tone = 'defense'; break;
        case KIND.KICKOFF:
            if (td) { text = `KICKOFF RETURN TOUCHDOWN! ${A} goes the distance!`; tag = 'RETURN TD'; tone = 'score'; }
            else if (p.has(FLAG.TOUCHBACK)) text = `Kickoff, touchback. ${off} ball at the ${p.yl}.`;
            else text = p.A ? `Kickoff returned ${yd(y)} by ${A} to the ${off} ${p.yl}.` : `Free kick to the ${off} ${p.yl}.`;
            break;
        case KIND.ONSIDE:
            text = p.has(FLAG.RECOVERED) ? `ONSIDE KICK RECOVERED by ${def}!` : `Onside kick — ${off} covers it.`;
            tag = p.has(FLAG.RECOVERED) ? 'ONSIDE!' : 'ONSIDE KICK'; tone = p.has(FLAG.RECOVERED) ? 'turnover' : 'plain';
            break;
        case KIND.DOWNS: text = `Turnover on downs. ${def} takes over.`; tag = '4TH-DOWN STOP'; tone = 'defense'; break;
        default: text = '';
    }

    // Fourth-down gambles that worked
    if (go && (first || td) && !tag) { tag = '4TH-DOWN CONVERSION'; tone = 'big'; }
    else if (go && (first || td) && tag === 'TOUCHDOWN') text += ' On fourth down!';

    if (tag) key = true;
    weight = tone === 'score' ? 4.5 : tone === 'turnover' ? 4 : tag ? 2.6 : p.kind === KIND.XP || p.kind === KIND.KICKOFF ? 0.7 : 1;
    const clutch = p.has(FLAG.CLUTCH), choke = p.has(FLAG.CHOKE), witching = p.has(FLAG.WITCHING);
    if ((clutch || choke) && tag) weight += 1;
    return { text, tag, tone, key, weight, scoring: tone === 'score' && p.kind !== KIND.TWO, clutch, choke, trick, witching };
}

/** The side (0 home / 1 away) that made a described play: scorer, defense, or offense. */
export function creditSide(p, d) {
    if (d.tone === 'score') {
        if (p.flags & FLAG.RETURN_TD) return p.kind === KIND.KICKOFF ? p.off : 1 - p.off;
        return p.off;
    }
    if (d.tone === 'turnover' || d.tone === 'defense') return 1 - p.off;
    return p.off;
}

// ── drives ────────────────────────────────────────────────────────────────────

const SCRIMMAGE = new Set([KIND.RUN, KIND.PASS, KIND.INC, KIND.INT, KIND.SACK, KIND.SCRAMBLE, KIND.KNEEL, KIND.SPIKE, KIND.PUNT, KIND.FG, KIND.FG_MISS, KIND.DOWNS]);

/** Group plays into drives: { off, start, plays, yards, secs, result, startIdx, endIdx }. */
export function drivesOf(plays) {
    const drives = [];
    let cur = null;
    const close = () => { if (cur) drives.push(cur); cur = null; };
    for (const p of plays) {
        if (!SCRIMMAGE.has(p.kind)) { if (p.kind === KIND.KICKOFF || p.kind === KIND.ONSIDE) close(); continue; }
        if (p.kind === KIND.DOWNS) { if (cur) cur.result = 'Downs'; close(); continue; }
        if (!cur || cur.off !== p.off || (cur.q <= 2 && p.q >= 3)) {
            close();
            cur = { off: p.off, q: p.q, start: p.yl, startIdx: p.idx, endIdx: p.idx, plays: 0, yards: 0, t0: elapsedAt(p.q, p.clock), t1: elapsedAt(p.q, p.clock), result: p.q >= 3 ? 'End of game' : 'End of half' };
        }
        cur.endIdx = p.idx;
        cur.t1 = elapsedAt(p.q, p.clock);
        if (p.kind !== KIND.PUNT && p.kind !== KIND.FG && p.kind !== KIND.FG_MISS) { cur.plays++; if (p.kind !== KIND.INT) cur.yards += p.yards; }
        const td = p.has(FLAG.TD);
        if (p.kind === KIND.PUNT) { cur.result = p.has(FLAG.BLOCKED) ? 'Blocked punt' : 'Punt'; close(); }
        else if (p.kind === KIND.FG) { cur.result = 'Field goal'; close(); }
        else if (p.kind === KIND.FG_MISS) { cur.result = p.has(FLAG.BLOCKED) ? 'Blocked FG' : 'Missed FG'; close(); }
        else if (p.kind === KIND.INT) { cur.result = td ? 'Pick-six' : 'Interception'; close(); }
        else if (p.has(FLAG.FUMBLE)) { cur.result = td ? 'Fumble-six' : 'Fumble'; close(); }
        else if (p.has(FLAG.SAFETY)) { cur.result = 'Safety'; close(); }
        else if (td) { cur.result = 'Touchdown'; close(); }
        else if (p.kind === KIND.KNEEL && cur) cur.result = cur.q >= 4 ? 'End of game' : 'End of half';
    }
    close();
    for (const d of drives) d.secs = Math.max(0, d.t1 - d.t0 + 20);
    return drives;
}

// ── running stat lines ────────────────────────────────────────────────────────

/** Box-score leaders through play index `upto` (inclusive). */
export function statsThrough(plays, upto = Infinity) {
    const line = new Map();
    const get = w => {
        if (!w) return null;
        let l = line.get(w.id);
        if (!l) { l = { ...w, cmp: 0, att: 0, passYds: 0, passTd: 0, int: 0, car: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, sacks: 0, picks: 0, tfl: 0, pd: 0, ff: 0, fgm: 0, fga: 0 }; line.set(w.id, l); }
        return l;
    };
    for (const p of plays) {
        if (p.idx > upto) break;
        const td = p.has(FLAG.TD) && !p.has(FLAG.RETURN_TD);
        switch (p.kind) {
            case KIND.PASS: {
                const q = get(p.A), r = get(p.B);
                if (q) { q.att++; q.cmp++; q.passYds += p.yards; if (td) q.passTd++; }
                if (r) { r.rec++; r.recYds += p.yards; if (td) r.recTd++; }
                if (p.has(FLAG.FUMBLE)) { const x = get(p.X); if (x) x.ff++; }
                break;
            }
            case KIND.INC: { const q = get(p.A); if (q) q.att++; if (p.has(FLAG.DEFENDED)) { const x = get(p.X); if (x) x.pd++; } break; }
            case KIND.SPIKE: { const q = get(p.A); if (q) q.att++; break; }
            case KIND.INT: { const q = get(p.A); if (q) { q.att++; q.int++; } const x = get(p.X); if (x) x.picks++; break; }
            case KIND.RUN: case KIND.SCRAMBLE: case KIND.KNEEL: {
                const c = get(p.A); if (c) { c.car++; c.rushYds += p.yards; if (td) c.rushTd++; }
                if (p.has(FLAG.TFL)) { const x = get(p.X); if (x) x.tfl++; }
                if (p.has(FLAG.FUMBLE)) { const x = get(p.X); if (x) x.ff++; }
                break;
            }
            case KIND.SACK: { const x = get(p.X); if (x) { x.sacks++; if (p.has(FLAG.FUMBLE)) x.ff++; } break; }
            case KIND.FG: { const k = get(p.A); if (k) { k.fga++; k.fgm++; } break; }
            case KIND.FG_MISS: { const k = get(p.A); if (k) k.fga++; break; }
            default:
        }
    }
    return [...line.values()];
}

/** The standout line per category for one side, for a live stat rail. */
export function leadersFor(lines, side) {
    const mine = lines.filter(l => l.side === side);
    const top = (score) => mine.reduce((best, l) => (score(l) > (best ? score(best) : 0) ? l : best), null);
    const passer = top(l => l.att);
    const rusher = top(l => l.rushYds + l.rushTd * 20 + (l.pos === 'QB' ? -1000 : 0)) || null;
    const receiver = top(l => l.recYds + l.recTd * 20);
    const defender = top(l => l.sacks * 3 + l.picks * 4 + l.ff * 3 + l.tfl + l.pd * 0.8);
    return { passer, rusher, receiver, defender };
}

export const passLine = l => l ? `${l.cmp}/${l.att}, ${l.passYds} yds${l.passTd ? `, ${l.passTd} TD` : ''}${l.int ? `, ${l.int} INT` : ''}` : '';
export const rushLine = l => l ? `${l.car} car, ${l.rushYds} yds${l.rushTd ? `, ${l.rushTd} TD` : ''}` : '';
export const recLine = l => l ? `${l.rec} rec, ${l.recYds} yds${l.recTd ? `, ${l.recTd} TD` : ''}` : '';
export const defLine = l => {
    if (!l) return '';
    const bits = [];
    if (l.sacks) bits.push(`${l.sacks} sack${l.sacks > 1 ? 's' : ''}`);
    if (l.picks) bits.push(`${l.picks} INT`);
    if (l.ff) bits.push(`${l.ff} FF`);
    if (l.tfl) bits.push(`${l.tfl} TFL`);
    if (l.pd) bits.push(`${l.pd} PD`);
    return bits.join(', ');
};

// ── the shape of a game ───────────────────────────────────────────────────────

/**
 * Score timeline from a stored scoringLog: [{ t (0–1 of game time), side ('home'|'away'),
 * pts, kind, q, clock }]. Returns null when the game predates scoring logs.
 */
export function scoringTimeline(game) {
    const log = game?.scoringLog;
    if (!Array.isArray(log)) return null;
    const total = game.overtime ? 4 * QUARTER_SECS + 600 : 4 * QUARTER_SECS;
    return log.map(([q, clock, side, pts, kind]) => ({
        t: Math.min(0.995, elapsedAt(q, clock) / total),
        side: side === 0 ? 'home' : 'away', pts, kind, q, clock,
    }));
}

/**
 * What kind of game it was. Uses the scoring log when present (for leads and
 * comebacks), otherwise just the final.
 * @returns {{ label, blurb, tags: string[], tone }}
 */
export function classifyGame(game, opts = {}) {
    const h = game?.homeScore ?? 0, a = game?.awayScore ?? 0;
    const margin = Math.abs(h - a), total = h + a;
    const winner = h === a ? null : h > a ? 'home' : 'away';
    const lo = Math.min(h, a), hi = Math.max(h, a);
    let maxDeficit = 0, q4Deficit = 0, lateGoAhead = false, leadChanges = 0, witching = false;
    const tl = scoringTimeline(game);
    if (tl && winner) {
        let hs = 0, as = 0, leader = null;
        for (const e of tl) {
            const before = hs - as;
            if (e.side === 'home') hs += e.pts; else as += e.pts;
            // The Witching Hour: a score in the final five minutes (or OT) of a
            // one-score game that ties it or flips the lead.
            const late = e.q >= 5 || (e.q === 4 && e.clock <= 300);
            if (late && Math.abs(before) <= 8 && hs !== as && Math.sign(hs - as) !== Math.sign(before)) witching = true;
            const wLead = winner === 'home' ? hs - as : as - hs;
            maxDeficit = Math.max(maxDeficit, -wLead);
            if (e.q <= 3) q4Deficit = Math.max(0, -wLead);
            const nowLeader = hs === as ? null : hs > as ? 'home' : 'away';
            if (nowLeader && leader && nowLeader !== leader) leadChanges++;
            if (nowLeader) leader = nowLeader;
            if (wLead > 0 && wLead - e.pts <= 0 && (e.q >= 5 || (e.q === 4 && e.clock <= 60))) lateGoAhead = true;
        }
    }
    const tags = [];
    const add = t => { if (!tags.includes(t)) tags.push(t); };
    const ctx = game?.ctx;
    const favHome = ctx && Number.isFinite(ctx.s) && Math.abs(ctx.s) >= 3 ? ctx.s > 0 : null;
    const upset = opts.upset || (favHome != null && winner && (favHome ? winner === 'away' : winner === 'home'));
    const playoff = !!ctx?.p;
    if (maxDeficit >= 17) add('Epic comeback');
    if (upset && ctx?.x != null) add('Trap game');
    if (upset && ctx?.d) add('Division upset');
    else if (upset) add('Upset');
    if (playoff && winner && (margin <= 7 || game?.overtime)) add('Playoff classic');
    if (game?.overtime) add('Overtime');
    if (witching && winner) add('Witching Hour');
    if (q4Deficit >= 7) add('4th-quarter comeback');
    else if (maxDeficit >= 10 && maxDeficit < 17) add('Comeback');
    if (lateGoAhead && !game?.overtime) add('Walk-off');
    if (lo === 0 && winner) add('Shutout');
    if (margin >= 24) add('Blowout');
    else if (margin >= 17 && hi >= 35) add('Rout');
    if (total >= 62 || lo >= 31) add('Shootout');
    if (winner && lo <= 7 && hi <= 24 && lo > 0) add('Defensive masterclass');
    else if (total <= 23 && lo > 0) add('Defensive battle');
    if (margin <= 3 && !game?.overtime && winner) add('Nail-biter');
    if (leadChanges >= 4) add('Seesaw');
    if (!winner) add('Tie');

    const label = tags[0] || (margin >= 10 ? 'Decisive' : 'Hard-fought');
    if (!tags.length) tags.push(label);
    const BLURB = {
        'Overtime': 'Needed extra time to settle it.',
        'Epic comeback': `Came back from ${maxDeficit} down.`,
        '4th-quarter comeback': `Trailed by ${q4Deficit} after three.`,
        'Comeback': `Rallied from a ${maxDeficit}-point hole.`,
        'Walk-off': 'Won it in the final minute.',
        'Shutout': 'Kept a zero on the board.',
        'Blowout': `Won by ${margin}.`,
        'Rout': `Won by ${margin}.`,
        'Shootout': `${total} combined points.`,
        'Defensive masterclass': `Held them to ${lo}.`,
        'Defensive battle': `Just ${total} points all day.`,
        'Nail-biter': `Decided by ${margin}.`,
        'Seesaw': `${leadChanges} lead changes.`,
        'Upset': ctx ? `${Math.abs(ctx.s)}-point underdogs won it.` : 'The underdog won.',
        'Division upset': `Division underdogs by ${Math.abs(ctx?.s ?? 0)} — and they won.`,
        'Trap game': 'The favorite looked ahead and paid for it.',
        'Witching Hour': 'Decided in the final five minutes.',
        'Playoff classic': 'A postseason game they will replay for years.',
        'Tie': 'Nobody blinked.',
        'Decisive': `Won by ${margin}.`,
        'Hard-fought': `Decided by ${margin}.`,
    };
    const tone = ['Blowout', 'Rout', 'Shutout'].includes(label) ? 'rout'
        : ['Shootout'].includes(label) ? 'fire'
        : ['Defensive masterclass', 'Defensive battle'].includes(label) ? 'ice'
        : ['Overtime', 'Walk-off', 'Nail-biter', 'Epic comeback', '4th-quarter comeback', 'Comeback', 'Seesaw', 'Witching Hour', 'Playoff classic'].includes(label) ? 'drama'
        : ['Upset', 'Division upset', 'Trap game'].includes(label) ? 'upset' : 'plain';
    return { label, blurb: BLURB[label] || '', tags: tags.slice(0, 3), tone, maxDeficit, leadChanges, upset: !!upset, witching };
}

/** Best individual performance in a box score ({ home, away } playerStats). */
export function playerOfGame(game) {
    return threeStars(game)[0] || null;
}

/** The three best individual performances, best first: [{ player, side, score, line }]. */
export function threeStars(game) {
    const all = [];
    for (const side of ['home', 'away']) {
        const box = game?.playerStats?.[side];
        if (!box) continue;
        for (const e of Object.values(box)) {
            const p = e.player;
            if (!p) continue;
            const n = k => e[k] || 0;
            let score, line;
            if (p.position === 'QB') {
                score = n('yards') * 0.045 + n('tds') * 5 - n('ints') * 4 + n('rushYards') * 0.08;
                line = `${n('completions')}/${n('attempts')}, ${n('yards')} yds, ${n('tds')} TD${n('ints') ? `, ${n('ints')} INT` : ''}`;
            } else if (['RB', 'FB'].includes(p.position)) {
                score = n('rushYards') * 0.08 + n('rushTds') * 6 + n('recYards') * 0.08 + n('recTds') * 6;
                line = `${n('carries')} car, ${n('rushYards')} yds, ${n('rushTds')} TD`;
            } else if (['WR', 'TE'].includes(p.position)) {
                score = n('recYards') * 0.08 + n('recTds') * 6 + n('receptions') * 0.3;
                line = `${n('receptions')} rec, ${n('recYards')} yds, ${n('recTds')} TD`;
            } else if (p.position === 'K') {
                score = n('fgm') * 2.2;
                line = `${n('fgm')}/${n('fga')} FG`;
            } else {
                score = n('sacks') * 6 + n('ints') * 7 + n('defensiveTds') * 8 + n('tfl') * 1.5 + n('pd') + n('tackles') * 0.3;
                const bits = [];
                if (n('sacks')) bits.push(`${n('sacks')} sk`);
                if (n('ints')) bits.push(`${n('ints')} INT`);
                if (n('defensiveTds')) bits.push(`${n('defensiveTds')} TD`);
                bits.push(`${n('tackles')} tkl`);
                line = bits.join(', ');
            }
            // A winning performance counts for a little more
            const won = side === 'home' ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
            if (won) score *= 1.1;
            if (score > 0) all.push({ player: p, side, score, line });
        }
    }
    return all.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ── win probability ───────────────────────────────────────────────────────────
//
// A simple, well-behaved model: the lead plus the value of having the ball
// where it is, plus whatever of the pre-game spread is still "owed" by the
// time left, against a spread of outcomes that narrows as the clock runs.

const normCdf = z => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
};

/** Home win probability at a moment. margin = home − away; poss 0 home / 1 away. */
export function winProbability({ margin, poss = null, yl = 25, q = 1, clock = 900, spread = 0 }) {
    const left = q >= 5 ? Math.max(0, clock) * 0.35 : Math.max(0, (4 - q) * QUARTER_SECS + clock);
    const frac = Math.min(1, left / 3600);
    const ep = poss == null ? 0 : (-0.5 + 0.065 * Math.max(0, Math.min(100, yl))) * (poss === 0 ? 1 : -1);
    if (frac <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
    const mu = margin + ep + (spread || 0) * frac;
    // A small floor keeps the last minutes honest: onside kicks, picks and
    // Hail Marys mean nothing is 99% until it's over.
    const sd = Math.sqrt(182 * frac + 6);
    return Math.min(0.995, Math.max(0.005, normCdf(mu / sd)));
}

/**
 * Home win probability AFTER each play (index-aligned with plays), plus the
 * kickoff value at -1. Uses the next snap's possession and field position.
 */
export function winProbSeries(plays, spread = 0, final = null) {
    const out = [];
    for (let i = 0; i < plays.length; i++) {
        const p = plays[i], n = plays[i + 1];
        const margin = p.hs - p.as;
        if (!n) {
            const f = final ?? margin;
            out.push(f > 0 ? 1 : f < 0 ? 0 : 0.5);
            continue;
        }
        const scrimmage = n.down >= 1 && n.down <= 4;
        out.push(winProbability({ margin, poss: scrimmage ? n.off : null, yl: n.yl, q: n.q, clock: n.clock, spread }));
    }
    return { start: winProbability({ margin: 0, spread }), series: out };
}

/** The snap that swung the game most. { idx, swing (−1..1 for home) } or null. */
export function playOfTheGame(plays, wp) {
    let best = null, prev = wp.start;
    for (let i = 0; i < plays.length; i++) {
        const d = wp.series[i] - prev;
        prev = wp.series[i];
        // Kneels and extra points don't count, even when they end it.
        if (plays[i].kind === KIND.KNEEL || plays[i].kind === KIND.XP) continue;
        if (!best || Math.abs(d) > Math.abs(best.swing)) best = { idx: i, swing: d };
    }
    return best;
}

// ── the booth ─────────────────────────────────────────────────────────────────
//
// A colour analyst for the big moments: milestones, streaks, signature play
// styles, the Witching Hour, and what the scoreboard means. One line per
// play at most, only where it adds something; deterministic per game.

const ORDINAL = n => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/**
 * @param plays  from readPbp
 * @param descs  describePlay per play
 * @param abbr   [homeAbbr, awayAbbr]
 * @param ctx    the stored game context (pbp.ctx) or null
 * @returns { lines: (string|null)[], banners: (string|null)[] }
 *   lines    analyst call per play index
 *   banners  situation that STARTS at this play: 'witching' | 'upset' | 'redzone' | 'twominute' | null
 */
export function boothCalls(plays, descs, abbr, ctx = null) {
    const lines = new Array(plays.length).fill(null);
    const banners = new Array(plays.length).fill(null);
    const tally = new Map(); // `${side}|${nameIdx}` → counters
    const t = w => {
        if (!w) return null;
        const k = w.id;
        let v = tally.get(k);
        if (!v) { v = { sacks: 0, picks: 0, tds: 0, recYds: 0, rushYds: 0, passYds: 0, passTd: 0, fg: 0 }; tally.set(k, v); }
        return v;
    };
    const spread = ctx?.spread ?? 0;
    const dog = ctx?.favorite == null ? null : 1 - ctx.favorite;
    let witchingOn = false, upsetOn = false, twoMinOn = [false, false];
    let run = { side: null, pts: 0 };
    let maxDeficit = [0, 0];

    for (let i = 0; i < plays.length; i++) {
        const p = plays[i], d = descs[i];
        const say = [];
        const pick = list => list[hashSeed(`${i}|booth|${list.length}`) % list.length];

        // Situations
        if (!witchingOn && p.has(FLAG.WITCHING)) {
            witchingOn = true;
            banners[i] = 'witching';
            say.push(p.q >= 5 ? 'Overtime. This is the Witching Hour — anything can happen now.'
                : pick(['Five minutes to go, one score apart. Welcome to the Witching Hour.', 'Under five minutes, one-score game. This is where legends are made — and broken.']));
        }
        const margin = p.hs - p.as;
        if (dog != null && !upsetOn && p.q >= 4 && (dog === 0 ? margin > 0 : margin < 0) && Math.abs(spread) >= 3) {
            upsetOn = true;
            if (!banners[i]) banners[i] = 'upset';
            say.push(`UPSET ALERT: ${abbr[dog]} came in as ${Math.abs(spread)}-point underdogs and they lead in the fourth.`);
        }
        if (p.down >= 1 && p.down <= 4 && (p.q === 2 || p.q === 4) && p.clock <= 120 && !twoMinOn[p.q === 2 ? 0 : 1]) {
            twoMinOn[p.q === 2 ? 0 : 1] = true;
            if (!banners[i]) banners[i] = 'twominute';
        }

        // Individual running tallies and milestones
        const A = t(p.A), B = t(p.B), X = t(p.X);
        const td = p.has(FLAG.TD) && !p.has(FLAG.RETURN_TD);
        if (p.kind === KIND.SACK && X) {
            X.sacks++;
            if (X.sacks >= 2) say.push(`That's ${p.X.short}'s ${ORDINAL(X.sacks)} sack today — he's living in that backfield.`);
        }
        if (p.kind === KIND.INT && X) {
            X.picks++;
            if (X.picks >= 2) say.push(`${p.X.short} has TWO picks now!`);
        }
        if (p.kind === KIND.PASS && A && B) {
            const before = B.recYds;
            A.passYds += p.yards; B.recYds += p.yards;
            if (td) { A.passTd++; B.tds++; }
            if (before < 100 && B.recYds >= 100) say.push(`${p.B.short} crosses 100 receiving yards.`);
            if (A.passYds >= 300 && A.passYds - p.yards < 300) say.push(`${p.A.short} is over 300 through the air.`);
            if (td && A.passTd >= 3) say.push(`${ORDINAL(A.passTd)} touchdown pass of the day for ${p.A.short}.`);
            else if (td && B.tds >= 2) say.push(B.tds >= 3 ? `HAT TRICK for ${p.B.short}!` : `${p.B.short} has two touchdowns now.`);
        }
        if ((p.kind === KIND.RUN || p.kind === KIND.SCRAMBLE) && A) {
            const before = A.rushYds;
            A.rushYds += p.yards;
            if (td) A.tds++;
            if (before < 100 && A.rushYds >= 100) say.push(`${p.A.short} goes over 100 on the ground.`);
            if (td && A.tds >= 2) say.push(A.tds >= 3 ? `THREE rushing scores for ${p.A.short}!` : `${p.A.short}'s second touchdown of the day.`);
        }
        if (p.kind === KIND.FG && A) A.fg++;

        // Drama flags from the engine
        if (d.clutch) {
            const who = p.kind === KIND.INT || p.kind === KIND.SACK ? p.X : p.kind === KIND.PASS ? (p.B ?? p.A) : p.A;
            if (who) say.push(pick([`Ice in his veins. ${who.short} wanted that moment.`, `${who.short} is at his best when it matters most.`, `Clutch. That's ${who.short}.`]));
        }
        if (d.choke && p.A) say.push(pick([`${p.A.short} has been rattled all day, and it showed right there.`, `The moment got too big for ${p.A.short}.`]));

        // Signature play styles, on the plays that show them off
        if (d.tag && say.length < 2) {
            const star = d.tone === 'turnover' || d.tone === 'defense' ? p.X : p.kind === KIND.PASS ? p.B : p.A;
            const style = star?.style ? PLAY_STYLES[star.style] : null;
            if (style?.calls?.length && hashSeed(`${i}|style`) % 3 !== 0) {
                say.push(`${style.label}: ${style.calls[hashSeed(`${i}|call`) % style.calls.length]}.`);
            }
        }

        // Scoreboard: runs and comebacks
        const scored = i > 0 ? [p.hs - plays[i - 1].hs, p.as - plays[i - 1].as] : [p.hs, p.as];
        for (const side of [0, 1]) {
            if (!scored[side]) continue;
            if (run.side === side) run.pts += scored[side]; else run = { side, pts: scored[side] };
            const lead = side === 0 ? margin : -margin;
            if (run.pts >= 14 && d.scoring && run.pts - scored[side] < 14) say.push(`${run.pts} unanswered for ${abbr[side]}.`);
            if (maxDeficit[side] >= 10 && lead >= 0 && lead - scored[side] < 0) say.push(`${abbr[side]} were down ${maxDeficit[side]}. They've come all the way back.`);
        }
        maxDeficit = [Math.max(maxDeficit[0], -margin), Math.max(maxDeficit[1], margin)];

        if (say.length) lines[i] = say.slice(0, 2).join(' ');
        if (!banners[i] && p.down >= 1 && p.down <= 4 && p.yl >= 80 && plays[i - 1] && plays[i - 1].yl < 80 && plays[i - 1].off === p.off) banners[i] = 'redzone';
    }
    return { lines, banners };
}
