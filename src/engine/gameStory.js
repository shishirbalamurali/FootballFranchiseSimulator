// Reading a simulated game back as football: play descriptions, drives,
// running stat lines and the shape of the game (comeback, shootout, rout…).
// Pure functions over what gameEngine.js records, so the broadcast, the
// scoreboard and the post-game recap all tell the same story.

import { KIND, FLAG, decodePlay } from './gameEngine.js';

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
    const who = i => (i >= 0 && names[i] ? { id: i, name: names[i][0], short: shortName(names[i][0]), pos: names[i][1], side: names[i][2] } : null);
    return pbp.plays.map((t, idx) => {
        const p = decodePlay(t);
        p.idx = idx;
        p.A = who(p.a); p.B = who(p.b); p.X = who(p.x);
        p.R = (p.kind === KIND.SACK || p.kind === KIND.RUN || p.kind === KIND.PASS) && (p.flags & FLAG.FUMBLE) ? who(p.extra) : null;
        p.has = f => (p.flags & f) !== 0;
        return p;
    });
}

// ── describing a play ─────────────────────────────────────────────────────────

const BIG_PASS = 25, BIG_RUN = 15;

/**
 * @param p     a play from readPbp
 * @param abbr  [homeAbbr, awayAbbr]
 * @returns {{ text, tag, tone, key, weight, scoring }}
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
    const yd = n => `${n} yard${Math.abs(n) === 1 ? '' : 's'}`;
    const by = X ? ` (${X})` : '';
    let text = '', tag = null, tone = 'plain', key = false, weight = 1;

    switch (p.kind) {
        case KIND.RUN:
            if (td) {
                text = y >= 20 ? `${A} breaks free — ${y}-yard TOUCHDOWN run!` : y <= 2 ? `${A} punches it in from ${yd(y)} out. Touchdown.` : `${A} runs it in from ${y}. Touchdown!`;
                tag = 'TOUCHDOWN'; tone = 'score';
            } else if (y >= BIG_RUN) {
                text = `${A} bursts through a hole for ${y}!${by}`;
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
            if (td) {
                text = y >= 30 ? `${A} launches it deep — ${B} ${y}-yard TOUCHDOWN!` : `${A} finds ${B} for a ${y}-yard touchdown.`;
                tag = 'TOUCHDOWN'; tone = 'score';
            } else if (y >= BIG_PASS) {
                text = `${A} goes deep to ${B} — ${y} yards!${by}`;
                tag = 'BIG PLAY'; tone = 'big';
            } else text = `${A} to ${B} for ${yd(y)}${by}${p.has(FLAG.OOB) ? ', out of bounds' : ''}.`;
            if (p.has(FLAG.FUMBLE)) {
                text = `${A} to ${B} for ${yd(y)} — FUMBLE! ${X ?? def} punches it out, ${p.R?.short ?? def} recovers.`;
                tag = 'FUMBLE'; tone = 'turnover';
            }
            break;
        case KIND.INC:
            if (p.has(FLAG.HAIL_MARY)) text = `${A}'s Hail Mary falls incomplete.`;
            else text = p.has(FLAG.DEFENDED) ? `${A} for ${B} — broken up by ${X}!` : `${A} incomplete to ${B}.`;
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
            else { text = `${X ?? def} sacks ${A} for a loss of ${yd(-y)}.`; tag = 'SACK'; tone = 'defense'; }
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
            if (td) { text = `PUNT RETURN TOUCHDOWN! ${B} takes it all the way back!`; tag = 'RETURN TD'; tone = 'score'; }
            else if (p.has(FLAG.TOUCHBACK)) text = `Punt, ${yd(y)} into the end zone. Touchback.`;
            else if (p.has(FLAG.FAIR_CATCH)) text = `Punt, ${yd(y)}. Fair catch at the ${def} ${end}.`;
            else text = `Punt, ${yd(y)}; ${B} returns it ${p.extra}.`;
            break;
        }
        case KIND.FG:
            text = `${A} drills a ${y}-yard field goal. It's good!`;
            tag = 'FIELD GOAL'; tone = 'score';
            break;
        case KIND.FG_MISS:
            text = `${A}'s ${y}-yard try is NO GOOD.`;
            tag = 'NO GOOD'; tone = 'defense';
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
    return { text, tag, tone, key, weight, scoring: tone === 'score' && p.kind !== KIND.TWO };
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
        if (p.kind === KIND.PUNT) { cur.result = 'Punt'; close(); }
        else if (p.kind === KIND.FG) { cur.result = 'Field goal'; close(); }
        else if (p.kind === KIND.FG_MISS) { cur.result = 'Missed FG'; close(); }
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
    let maxDeficit = 0, q4Deficit = 0, lateGoAhead = false, leadChanges = 0;
    const tl = scoringTimeline(game);
    if (tl && winner) {
        let hs = 0, as = 0, leader = null;
        for (const e of tl) {
            if (e.side === 'home') hs += e.pts; else as += e.pts;
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
    if (game?.overtime) add('Overtime');
    if (maxDeficit >= 17) add('Epic comeback');
    else if (q4Deficit >= 7) add('4th-quarter comeback');
    else if (maxDeficit >= 10) add('Comeback');
    if (lateGoAhead && !game?.overtime) add('Walk-off');
    if (lo === 0 && winner) add('Shutout');
    if (margin >= 24) add('Blowout');
    else if (margin >= 17 && hi >= 35) add('Rout');
    if (total >= 62 || lo >= 31) add('Shootout');
    if (winner && lo <= 7 && hi <= 24 && lo > 0) add('Defensive masterclass');
    else if (total <= 23 && lo > 0) add('Defensive battle');
    if (margin <= 3 && !game?.overtime && winner) add('Nail-biter');
    if (leadChanges >= 4) add('Seesaw');
    if (opts.upset) add('Upset');
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
        'Upset': 'The underdog won.',
        'Tie': 'Nobody blinked.',
        'Decisive': `Won by ${margin}.`,
        'Hard-fought': `Decided by ${margin}.`,
    };
    const tone = ['Blowout', 'Rout', 'Shutout'].includes(label) ? 'rout'
        : ['Shootout'].includes(label) ? 'fire'
        : ['Defensive masterclass', 'Defensive battle'].includes(label) ? 'ice'
        : ['Overtime', 'Walk-off', 'Nail-biter', 'Epic comeback', '4th-quarter comeback', 'Comeback', 'Seesaw'].includes(label) ? 'drama' : 'plain';
    return { label, blurb: BLURB[label] || '', tags: tags.slice(0, 3), tone, maxDeficit, leadChanges };
}

/** Best individual performance in a box score ({ home, away } playerStats). */
export function playerOfGame(game) {
    let best = null;
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
            if (!best || score > best.score) best = { player: p, side, score, line };
        }
    }
    return best;
}
