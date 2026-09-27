// Play-by-play game engine.
//
// Every game is played snap by snap: a coin toss, kickoffs, downs and
// distance, a running game clock with the two-minute warning and timeouts,
// fourth-down decisions, field goals by distance, punts, turnovers, safeties,
// two-point tries and overtime. Each snap is credited to the players who were
// actually involved — the passer, the target, the ball carrier, the pass
// rusher, the man in coverage, the tackler — so the box score is simply the
// sum of the plays, and every conservation rule holds by construction:
//   Σ receiver receptions / yards / TDs = QB completions / gross yards / pass TDs
//   Σ receiver targets = QB attempts
//   each sack, INT, forced fumble and defensive TD belongs to one defender
//
// Game flow is what makes games different from each other. Teams arrive with
// a game-day form (a hot or cold offense, a defense that travels or doesn't),
// play-calling reacts to the scoreboard and the clock (trailing teams throw,
// leaders run the clock out, the two-minute drill hurries), and coaching plans
// change fourth-down and two-point appetite. Blowouts, shootouts, defensive
// struggles and comebacks all fall out of that, instead of being picked.
//
// Rates are written as deviations from measured league means (LG), exactly as
// the previous box-score model was, so a player of league-average attributes
// produces NFL-average results and tests/calibration.mjs keeps the league in
// line with 2022-24 production.

import { createXFactorGame } from './xFactor.js';
import { playStyleIdFor, styleMods, clutchBase } from './playStyles.js';
import { characterFor } from './character.js';

// ── RANDOM HELPERS ────────────────────────────────────────────────────────────

export function gaussian(mean, stdev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev + mean;
}

export function binomial(n, p) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    let s = 0;
    for (let i = 0; i < n; i++) if (Math.random() < p) s++;
    return s;
}

export function weightedPick(candidates) {
    let total = 0;
    for (const c of candidates) total += c.weight;
    if (total <= 0 || candidates.length === 0) return candidates[0] ?? null;
    let r = Math.random() * total;
    for (const c of candidates) { r -= c.weight; if (r <= 0) return c; }
    return candidates[candidates.length - 1];
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const chance = p => Math.random() < p;
// Lognormal with mean 1: most outcomes cluster a bit under the mean and a long
// right tail produces the occasional chunk play.
const lognormal1 = sigma => Math.exp(gaussian(-sigma * sigma / 2, sigma));
const expo = mean => -Math.log(1 - Math.random()) * mean;

// ── LEAGUE BASELINES ──────────────────────────────────────────────────────────
//
// generatePlayer centres a player's attributes on his OVR, not on a neutral
// 50-99 scale, so a starting QB's accuracy averages ~85 and a starting OL unit
// rates ~79. Every rate modifier below is a deviation from these measured
// league means, so each term averages to zero across the league and the base
// rate in each formula IS the NFL rate.
export const LG = {
    qbAcc: 86, qbAgg: 85, qbProc: 87, qbPock: 87, qbArm: 86, qbSpeed: 84, qbOvr: 86,
    ol: 79, olRunBlock: 75, skill: 79, offOverall: 82,
    defOverall: 79, defFront7: 79, defSec: 79, defCoverage: 74, defRush: 75,
    rbOvr: 83, rbVol: 80, rbEff: 85, rbExp: 85, rbGl: 83, rbSec: 82,
    kickAcc: 84, kickPow: 84,
};

// Real NFL target pies split roughly WR 57% / TE 21% / RB 22%, and usage falls
// off along each position's depth chart.
const GROUP_TARGET_SHARE = { WR: 0.57, TE: 0.21, RB: 0.22 };
const DEPTH_TARGET_SHARE = {
    WR: [0.42, 0.27, 0.17, 0.09, 0.05],
    TE: [0.70, 0.22, 0.08],
    RB: [0.60, 0.28, 0.12],
};
const CATCH_RATE = { WR: 0.615, TE: 0.685, RB: 0.755 };
const LEAGUE_CATCH_RATE = 0.66;

// Game-day form, in rating points. A standard deviation this size is what
// turns identical matchups into a 38-10 one week and a 13-10 the next.
const FORM_SD_OFF = 5.0;
const FORM_SD_DEF = 3.4;
const HOME_EDGE = 2.2;

// ── PLAY ENCODING ─────────────────────────────────────────────────────────────
//
// The user's game keeps its full play-by-play on the schedule row, so plays are
// stored as short tuples with player references into a per-game name table.

export const KIND = {
    RUN: 1, PASS: 2, INC: 3, INT: 4, SACK: 5, SCRAMBLE: 6, KNEEL: 7,
    PUNT: 8, FG: 9, FG_MISS: 10, XP: 11, XP_MISS: 12, TWO: 13, TWO_FAIL: 14,
    KICKOFF: 15, ONSIDE: 16, SPIKE: 17, DOWNS: 18,
};
export const FLAG = {
    TD: 1, FIRST: 2, TURNOVER: 4, FUMBLE: 8, SAFETY: 16, RETURN_TD: 32,
    FOURTH_GO: 64, OOB: 128, TFL: 256, DEFENDED: 512, TWO_MIN: 1024,
    TOUCHBACK: 2048, FAIR_CATCH: 4096, RECOVERED: 8192, HAIL_MARY: 16384,
    // Drama: the Witching Hour (final 5:00 of a one-score game, and overtime),
    // a clutch player delivering in it, one wilting in it, trick plays,
    // blocked kicks and an iced kicker.
    WITCHING: 1 << 15, CLUTCH: 1 << 16, TRICK: 1 << 17, BLOCKED: 1 << 18, CHOKE: 1 << 19, ICED: 1 << 20,
};

// Composure under pressure, [-1, 1]; see playStyles.js clutchBase.
const clutchCache = new Map();
export function clutchOf(p) {
    if (!p?.id) return 0;
    const key = `${p.id}|${p.personality ?? ''}|${p.ovr ?? ''}`;
    let c = clutchCache.get(key);
    if (c === undefined) {
        let composure = null;
        try { composure = characterFor(p)?.axes?.composure ?? null; } catch { composure = null; }
        c = clutchBase(p, composure);
        if (clutchCache.size > 8000) clutchCache.clear();
        clutchCache.set(key, c);
    }
    return c;
}
const CLUTCH_STAR = 0.35;
const CHOKE_LINE = -0.25;
// [q, clock, offense(0 home/1 away), yardline, down, toGo, kind, yards, a, b, x, flags, homeScore, awayScore, extra]
export const PLAY_FIELDS = ['q', 'clock', 'off', 'yl', 'down', 'togo', 'kind', 'yards', 'a', 'b', 'x', 'flags', 'hs', 'as', 'extra'];

export function decodePlay(t) {
    const o = {};
    PLAY_FIELDS.forEach((k, i) => { o[k] = t[i]; });
    return o;
}

// ── COACHING PLANS ────────────────────────────────────────────────────────────
//
// A plan is how a staff wants to play this week. passTilt shifts the run/pass
// mix, aggression scales fourth-down and two-point appetite, deepShots trades
// completion rate for explosive plays, clockControl makes a lead get milked.
const NEUTRAL_PLAN = { passTilt: 0, aggression: 1, deepShots: 0, clockControl: 0, label: null };

function normalizePlan(plan) {
    if (!plan) return NEUTRAL_PLAN;
    return {
        passTilt: clamp(Number(plan.passTilt) || 0, -0.15, 0.15),
        aggression: clamp(Number(plan.aggression) || 1, 0.3, 2.2),
        deepShots: clamp(Number(plan.deepShots) || 0, -0.1, 0.12),
        clockControl: clamp(Number(plan.clockControl) || 0, 0, 1),
        label: plan.label || null,
        focusId: plan.focusId || null,
    };
}

// ── UNIT PROFILES ─────────────────────────────────────────────────────────────

function lineFor(team, player) {
    return player && team.stats[player.id];
}

// Everything an offense needs to call and resolve a snap against one defense.
function buildOffense(off, def, homeFieldMod, weather, plan, formEdge, sloppy = 0) {
    const passMult  = weather?.passMultiplier  ?? 1.0;
    const rushMult  = weather?.rushMultiplier  ?? 1.0;
    const scoreMult = weather?.scoreMultiplier ?? 1.0;

    const qb = off.depth.qb;
    const defRat = def.ratings.defense;
    const offRat = off.ratings.offense;

    const tr   = qb.attributes?.position || {};
    const ACC  = tr.accuracy   || 75;
    const AGG  = tr.aggression || 55;
    const PROC = tr.processing || 70;
    const POCK = tr.pocket     || 65;
    const ARM  = tr.arm        || 70;
    const qs   = styleMods(playStyleIdFor(qb));

    // Form moves every matchup term the same way a ratings edge would.
    const f = formEdge;
    const DEF_SEC   = defRat.secondary - homeFieldMod - f * 0.5;
    const DEF_FRONT = defRat.front7    - homeFieldMod - f * 0.5;
    const passProtection = offRat.ol + (offRat.passBlock - offRat.ol) * 0.8 + f * 0.5;
    const passRush   = DEF_FRONT + (defRat.passRush   - defRat.front7) * 0.8;
    const runDefense = DEF_FRONT + (defRat.runDefense - defRat.front7) * 0.8;
    const olRun      = offRat.ol + (offRat.runBlock - offRat.ol) * 0.8 + f * 0.5;

    // Sack rate per dropback — NFL ~6.5%
    let pSack = 0.0620;
    pSack -= 0.0010 * (passProtection - LG.ol);
    pSack -= 0.0006 * (POCK - LG.qbPock);
    pSack -= 0.0003 * (PROC - LG.qbProc);
    pSack += 0.0008 * (passRush - LG.defFront7);

    // Completion rate — NFL ~65.5%
    let pCmp = 0.712;
    pCmp += 0.0030 * (ACC - LG.qbAcc);
    pCmp += 0.0012 * (PROC - LG.qbProc);
    pCmp -= 0.0010 * (AGG - LG.qbAgg);
    pCmp -= 0.0025 * (DEF_SEC - LG.defSec);
    pCmp += 0.0015 * (offRat.skill - LG.skill);

    // Interception rate, applied to incompletions
    let pInt = 0.0345;
    pInt -= 0.0007 * (PROC - LG.qbProc);
    pInt -= 0.0005 * (ACC - LG.qbAcc);
    pInt += 0.0004 * (AGG - LG.qbAgg);
    pInt += 0.0003 * (DEF_SEC - LG.defSec);
    pInt -= Math.max(0, (qb.ovr || 70) - LG.qbOvr) * 0.00025;

    // Gross yards per attempt — NFL ~7.2
    let ypa = 7.85;
    ypa += 0.020 * (ARM - LG.qbArm);
    ypa += 0.012 * (AGG - LG.qbAgg);
    ypa -= 0.018 * (DEF_SEC - LG.defSec);
    ypa += 0.004 * (offRat.skill - LG.skill);
    if (ARM  > LG.qbArm  + 8) ypa += Math.pow(ARM - (LG.qbArm + 8), 1.5) * 0.030;
    if (ARM  < LG.qbArm  - 8) ypa -= Math.pow((LG.qbArm  - 8) - ARM,  1.4) * 0.018;
    if (ACC  < LG.qbAcc  - 8) ypa -= Math.pow((LG.qbAcc  - 8) - ACC,  1.4) * 0.020;
    if (PROC < LG.qbProc - 8) ypa -= Math.pow((LG.qbProc - 8) - PROC, 1.3) * 0.015;

    // Home crowd: quieter cadence, cleaner pockets, fewer mistakes
    pInt -= 0.0004 * homeFieldMod;
    ypa  += 0.05   * homeFieldMod;

    // Coaching plan: deep shots trade completions for chunk plays
    pCmp -= plan.deepShots * 0.35;
    pInt += plan.deepShots * 0.020;
    ypa  += plan.deepShots * 6;

    // Play style: how this quarterback plays (playStyles.js)
    pCmp  += qs.cmp  || 0;
    pInt  += qs.int  || 0;
    ypa   += qs.ypa  || 0;
    pSack += qs.sack || 0;

    // Short week (Thursday night): sloppier football
    if (sloppy) { pInt *= 1 + 0.12 * sloppy; pCmp -= 0.008 * sloppy; ypa -= 0.15 * sloppy; }

    pCmp *= passMult;
    ypa  *= passMult;
    if (passMult < 1.0) {
        pSack += (1.0 - passMult) * 0.05;
        pInt  += (1.0 - passMult) * 0.012;
    }
    pSack = clamp(pSack, 0.025, 0.16);
    pCmp  = clamp(pCmp, 0.48, 0.74);
    pInt  = clamp(pInt, 0.010, 0.06);
    ypa   = clamp(ypa, 4.8, 11.0);

    // QB legs
    const qbSpeed  = qb.attributes?.universal?.speed || 60;
    const isMobile = qbSpeed > LG.qbSpeed + 8;
    const scramRate = Math.min(0.14, 0.015 + (qbSpeed > LG.qbSpeed ? (qbSpeed - LG.qbSpeed) * 0.003 : 0) + (isMobile ? 0.035 : 0) + (qs.scram || 0));
    const qbDesigned = (qbSpeed > LG.qbSpeed + 9 ? 0.09 : 0) + (qs.designed || 0);
    const qbYpc = Math.max(2.0, 4.3 + (qbSpeed - LG.qbSpeed) * 0.12);

    // Backfield: bell-cow to committee, shares from the old usage model
    const rbs = off.depth.rbs.map((rb, idx) => {
        const a = rb.attributes?.position || {};
        const VOL = a.vol || 70, EFF = a.eff || 70, EXP = a.exp || 70, GL = a.gl || 70, SEC = a.sec || 70;
        const rbOvr = rb.ovr || 70;
        const rs = styleMods(playStyleIdFor(rb));
        const share = (idx === 0 ? clamp(0.57 + 0.007 * (rbOvr - LG.rbOvr) + 0.006 * (VOL - LG.rbVol), 0.38, 0.80)
                    : idx === 1 ? clamp(0.28 + 0.003 * (rbOvr - (LG.rbOvr - 8)), 0.12, 0.40)
                    : 0.10) * (1 + (rs.share || 0) * 2);
        let ypc = 4.75 + 0.014 * (EFF - LG.rbEff) + 0.010 * (EXP - LG.rbExp)
                       + 0.018 * (olRun - LG.ol) - 0.014 * (runDefense - LG.defFront7);
        if (EFF > LG.rbEff + 6) ypc += Math.pow(EFF - (LG.rbEff + 6), 1.4) * 0.010;
        ypc = clamp(ypc * rushMult, 2.5, 6.2);
        return {
            p: rb, weight: share, ypc,
            burst: clamp(0.042 + 0.0012 * (EXP - LG.rbExp) + 0.0006 * (olRun - LG.ol) + (rs.burst || 0), 0.015, 0.09),
            goalLine: (GL - LG.rbGl) * 0.03 + (rs.gl || 0),
            fumble: Math.max(0.002, 0.0075 - 0.00005 * (SEC - LG.rbSec)) * (rs.fumble || 1) * (1 + 0.2 * sloppy),
        };
    });

    // Targets: group share × depth-chart slot × talent, with game-day variance
    const groups = { WR: off.depth.wrs, TE: off.depth.tes, RB: off.depth.rbs };
    const targets = [];
    for (const [pos, players] of Object.entries(groups)) {
        if (!players.length) continue;
        const curve = DEPTH_TARGET_SHARE[pos];
        const skill = players.map(p => {
            const a = p.attributes?.position  || {};
            const u = p.attributes?.universal || {};
            const attr = pos === 'WR' ? (a.routeRun || a.catching || u.speed || p.ovr)
                       : pos === 'TE' ? (a.catching || a.routeRun || p.ovr)
                       :                (a.catching || u.speed    || p.ovr);
            return (attr + (p.ovr || 70)) / 2;
        });
        const avg = skill.reduce((s, x) => s + x, 0) / skill.length;
        const slots = players.map((p, i) => {
            const base = i < curve.length ? curve[i] : curve[curve.length - 1] * 0.5;
            return base * clamp(1 + (skill[i] - avg) * 0.023, 0.5, 1.85);
        });
        const slotSum = slots.reduce((s, x) => s + x, 0) || 1;
        players.forEach((p, i) => {
            const a = p.attributes?.position  || {};
            const u = p.attributes?.universal || {};
            let natYpc;
            if (pos === 'WR')      natYpc = 11.0 + ((a.deepThreat || a.routeRun || u.speed || 75) - 50) / 50 * 4.0;
            else if (pos === 'TE') natYpc = 8.5 + ((a.catching || a.routeRun || 75) - 50) / 50 * 3.5;
            else                   natYpc = 5.5 + ((u.speed || a.catching || 70) - 50) / 50 * 3.0;
            const ts = styleMods(playStyleIdFor(p));
            targets.push({
                p, pos,
                weight: GROUP_TARGET_SHARE[pos] * slots[i] / slotSum * (0.72 + Math.random() * 0.56) * (ts.tgt || 1),
                catchMult: (CATCH_RATE[pos] || LEAGUE_CATCH_RATE) / LEAGUE_CATCH_RATE * (ts.catch || 1),
                natYpc: Math.max(3, natYpc * (ts.ypc || 1)),
                rz: (pos === 'TE' ? 1.35 : pos === 'WR' ? 1.0 : 0.7) * (ts.rz || 1),
            });
        });
    }
    // Scale each receiver's yards per catch so the offense lands on its YPA.
    let wCatch = 0, wYds = 0;
    for (const t of targets) { wCatch += t.weight * t.catchMult; wYds += t.weight * t.catchMult * t.natYpc; }
    const perCatch = ypa / Math.max(0.3, pCmp);
    const scale = wYds > 0 ? perCatch / (wYds / wCatch) : 1;
    for (const t of targets) t.ypc = t.natYpc * scale;

    const kicker = off.depth.kicker;
    const kAttr = kicker?.attributes?.position || {};
    const kAcc = kAttr.kickAccuracy || LG.kickAcc;
    const kPow = kAttr.kickPower || kAttr.kickAccuracy || LG.kickPow;
    const weatherKick = 1 - (1 - scoreMult) * 0.5;
    const ks = styleMods(playStyleIdFor(kicker));
    const punter = (off.roster || []).filter(p => p.position === 'P').sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0] || null;
    const ps = styleMods(playStyleIdFor(punter));

    return {
        team: off, qb, plan,
        pSack, pCmp, pInt, ypa,
        sigma: 0.80 + plan.deepShots * 1.2 + (qs.sigma || 0),
        scramRate, qbDesigned, qbYpc, isMobile,
        rbs, targets,
        lean: off.passLean || 0,
        passMult,
        kicker, kAcc, kPow, weatherKick, kClutch: ks.clutch || 0,
        fgRange: clamp(54 + (kPow - LG.kickPow) * 0.30 + (ks.range || 0), 47, 63) * (scoreMult < 1 ? 0.93 : 1),
        punter, puntMult: ps.punt || 1, pinMult: ps.pin || 1,
        sloppy,
    };
}

// Who makes the plays on defense. Weights follow the old leaderboard tuning.
function buildDefense(def) {
    const d = def.depth;
    // Play styles tilt who makes the plays (an Edge Bender gets home, a
    // Ballhawk gets his hands on the ball) without changing how often.
    const mods = new Map();
    const m = p => {
        let v = mods.get(p.id);
        if (!v) { v = styleMods(playStyleIdFor(p)); mods.set(p.id, v); }
        return v;
    };
    const rushers = d.rushers.map(p => {
        const pos = p.attributes?.position || {};
        const pr = Math.max(pos.finesseMoves || 0, pos.powerMoves || 0, pos.passRush || 0, pos.blitz || 0, pos.blockShedding || 0) || 70;
        return { p, weight: (p.position === 'DL' ? 1.0 : 0.55) * Math.pow(pr / 100, 4.6) * Math.pow(Math.max(40, p.ovr) / 100, 2.0) * (m(p).rush || 1) };
    });
    const ballhawks = d.coverage.map(p => {
        const pos = p.attributes?.position || {};
        const cov = pos.zoneCoverage || pos.manCoverage || pos.coverage || 70;
        const hawk = ((pos.ballSkills || cov) * 0.65 + cov * 0.35) / 100;
        const posWt = p.position === 'CB' ? 1.0 : p.position === 'S' ? 0.80 : 0.20;
        return { p, weight: posWt * Math.pow(hawk, 5.2) * Math.pow(Math.max(40, p.ovr) / 100, 2.5) * (m(p).hawk || 1) };
    });
    const cover = d.coverage.filter(p => p.position === 'CB' || p.position === 'S').map(p => {
        const pos = p.attributes?.position || {};
        const cov = pos.zoneCoverage || pos.manCoverage || pos.coverage || 70;
        return { p, weight: (p.position === 'CB' ? 1.0 : 0.6) * Math.pow(cov / 100, 3) * (m(p).cover || 1) };
    });
    const tackleWt = (p, table) => {
        const pa = p.attributes?.position || {};
        const tkl = pa.tackle || pa.pursuit || pa.zoneCoverage || pa.manCoverage || pa.coverage || 70;
        return (table[p.position] || 1.0) * Math.pow(tkl / 100, 1.8) * Math.pow((p.ovr || 70) / 100, 1.2) * (m(p).tackle || 1);
    };
    const RUN_TKL  = { DL: 1.55, LB: 2.90, CB: 0.95, S: 1.70 };
    const PASS_TKL = { DL: 0.35, LB: 1.90, CB: 2.35, S: 2.30 };
    const runTacklers  = d.tacklers.map(p => ({ p, weight: tackleWt(p, RUN_TKL) }));
    const passTacklers = d.tacklers.map(p => ({ p, weight: tackleWt(p, PASS_TKL) }));
    const stuffers = d.front7.map(p => {
        const pa = p.attributes?.position || {};
        const pr = pa.blitz || pa.blockShedding || pa.powerMoves || pa.pursuit || 70;
        return { p, weight: (p.position === 'DL' ? 1.3 : 1.0) * Math.pow(pr / 100, 3) * (m(p).stuff || 1) };
    });
    return { team: def, rushers, ballhawks, cover, runTacklers, passTacklers, stuffers, mod: p => (p ? m(p) : {}) };
}

// ── THE GAME ──────────────────────────────────────────────────────────────────

/**
 * Plays a full game between two team states (see simulation.js
 * initializeTeamState). Player stat lines on each state are filled in place.
 * @returns {{ score:[number,number], overtime:boolean, teamStats:object[], quarters:number[][],
 *             scoringLog:Array, plays:Array, names:Array, form:object[] }}
 */
export function playGame(home, away, opts = {}) {
    const { weather = null, allowTie = true } = opts;
    const teams = [home, away];
    const plans = [normalizePlan(opts.homePlan), normalizePlan(opts.awayPlan)];
    // Game context (gameContext.js engineContext): who's the underdog in a
    // division game, how big the stage is, what's at stake. Null = neutral.
    const ec = opts.context || null;
    const fs = ec?.formSpread || 1;
    const form = teams.map((_, i) => {
        const shift = ec?.formShift?.[i] || { off: 0, def: 0 };
        const lift = ec && ec.underdog === i ? (ec.dogLift || 0) : 0;
        return {
            off: gaussian(0, FORM_SD_OFF * fs) + (shift.off || 0) + lift,
            def: gaussian(0, FORM_SD_DEF * fs) + (shift.def || 0) + lift * 0.6,
        };
    });
    const homeEdge = HOME_EDGE + (ec?.homeEdge || 0);
    // How much composure decides the Witching Hour: more on a bigger stage.
    const pressure = 0.6 + 0.8 * (ec?.pressure ?? 0.5);
    // Home teams get a crowd edge on top of the -3 their visitors' defense plays at.
    const offense = [0, 1].map(i => buildOffense(teams[i], teams[1 - i], i === 0 ? 3 : 0, weather, plans[i], form[i].off - form[1 - i].def + (i === 0 ? homeEdge : 0), ec?.sloppy || 0));
    const defense = [0, 1].map(i => buildDefense(teams[i]));
    // X-Factors: one-of-a-kind abilities that switch on during the game.
    const xf = createXFactorGame(teams, { playoff: !allowTie, focus: [plans[0].focusId, plans[1].focusId] });
    let tdInfo = {};
    const drive = { side: -1, plays: 0, sacked: false, scored: false };

    // Name table for the play log: player id → index; entries are
    // [name, position, side, playerId, playStyleId] (the last two let the
    // broadcast show the face and signature of whoever made the play).
    const names = [];
    const nameIdx = new Map();
    const ref = (side, p) => {
        if (!p) return -1;
        let i = nameIdx.get(p.id);
        if (i === undefined) {
            i = names.length;
            names.push([p.name || 'Player', p.position || '', side, p.id ?? null, playStyleIdFor(p)]);
            nameIdx.set(p.id, i);
        }
        return i;
    };

    const team = [
        { passYds: 0, sackYds: 0, rushYds: 0, rushAtt: 0, att: 0, sacks: 0, turnovers: 0, firstDowns: 0, thirdAtt: 0, thirdConv: 0, penalties: 0, top: 0 },
        { passYds: 0, sackYds: 0, rushYds: 0, rushAtt: 0, att: 0, sacks: 0, turnovers: 0, firstDowns: 0, thirdAtt: 0, thirdConv: 0, penalties: 0, top: 0 },
    ];
    const g = {
        q: 1, clock: 900, poss: 0, yl: 25, down: 1, togo: 10,
        score: [0, 0], quarters: [[0, 0, 0, 0], [0, 0, 0, 0]],
        to: [3, 3], ot: false, otDone: [0, 0], ended: false,
        warned: false, plays: [], scoring: [], lastSpike: false,
        // momentum edge per side (rating-ish points, decays every snap),
        // Witching Hour start [q, clock], and a pending trick-play flag
        mo: [0, 0], witch: null, trick: 0,
    };
    const receiveFirst = chance(0.5) ? 0 : 1;

    // ── bookkeeping ───────────────────────────────────────────────────────────
    const S = (side, p) => lineFor(teams[side], p);
    const qIdx = () => Math.min(g.q, 5) - 1;
    const addPoints = (side, pts, kind) => {
        g.score[side] += pts;
        const qi = qIdx();
        while (g.quarters[side].length <= qi) { g.quarters[0].push(0); g.quarters[1].push(0); }
        g.quarters[side][qi] += pts;
        if (kind) g.scoring.push([g.q, Math.max(0, Math.round(g.clock)), side, pts, kind]);
    };
    // The Witching Hour: the last five minutes of a one-score game, and all
    // of overtime. Composure decides it; chaos rises.
    const inWitching = () => g.ot || (g.q === 4 && g.clock <= 300 && Math.abs(g.score[0] - g.score[1]) <= 8);
    const record = (fields) => {
        const p = {
            q: g.q, clock: Math.max(0, Math.round(g.clock)), off: g.poss, yl: g.yl, down: g.down, togo: g.togo,
            kind: 0, yards: 0, a: -1, b: -1, x: -1, flags: 0, extra: 0, ...fields,
        };
        if (inWitching()) {
            p.flags |= FLAG.WITCHING;
            if (!g.witch) g.witch = [p.q, p.clock];
        }
        if (g.trick) { p.flags |= g.trick; g.trick = 0; }
        g.plays.push([p.q, p.clock, p.off, p.yl, p.down, p.togo, p.kind, p.yards, p.a, p.b, p.x, p.flags, g.score[0], g.score[1], p.extra]);
        return g.plays[g.plays.length - 1];
    };
    // Scores are appended after the play is recorded, so refresh the tuple.
    const restamp = tuple => { tuple[12] = g.score[0]; tuple[13] = g.score[1]; };

    const lead = side => g.score[side] - g.score[1 - side];
    const sit = side => ({ q: g.q, clock: g.clock, down: g.down, togo: g.togo, yl: g.yl, offense: side, lead: [lead(0), lead(1)] });
    const xm = (stat, side, actors) => (xf.any ? xf.mult(stat, sit(side), actors) : 1);

    // Momentum: turnovers, stops, scores and chunk plays swing it; the home
    // crowd amplifies it; it fades a little every snap.
    const bump = (side, amt) => { g.mo[side] = Math.min(6, g.mo[side] + amt * (side === 0 ? 1.2 : 1)); };
    const moEdge = side => clamp(g.mo[side] - g.mo[1 - side], -6, 6);
    // Witching-Hour composure for one player, scaled by the stage.
    const clutchNow = p => (inWitching() ? clutchOf(p) * pressure : 0);
    const gameLeft = () => (g.q >= 5 ? g.clock : g.clock + 900 * (4 - g.q));
    const isLateHalf = secs => (g.q === 2 || g.q === 4 || g.q >= 5) && g.clock <= secs;

    // ── clock ────────────────────────────────────────────────────────────────
    // Two-minute drill: trailing or tied late in either half
    const hurry = side => (g.q === 2 && g.clock <= 120)
        || (g.q === 4 && lead(side) <= 0 && g.clock <= 150)
        || (g.q === 4 && lead(side) < -8 && g.clock <= 420)
        || (g.q >= 5 && g.clock <= 120);
    const milk = side => (g.q === 4 && lead(side) > 0 && g.clock <= 480 + plans[side].clockControl * 300)
        || (g.q >= 3 && lead(side) >= 17 - plans[side].clockControl * 4);

    function tick(playSecs, clockStops, side) {
        let run = playSecs;
        if (!clockStops) {
            let between = milk(side) ? 39 : hurry(side) ? 14 : 30 + Math.random() * 8;
            const def = 1 - side;
            // A trailing defense stops the clock late
            const defWantsStop = (g.q === 4 && lead(def) < 0 && g.clock <= 240) || (g.q >= 5 && g.clock <= 120 && lead(def) <= 0);
            const offWantsStop = hurry(side) && (g.q === 2 ? g.clock <= 60 : g.clock <= 120) && lead(side) <= 0;
            if (defWantsStop && g.to[def] > 0 && g.clock - run > 5) { g.to[def]--; between = 0; }
            else if (offWantsStop && g.to[side] > 0 && g.clock - run > 5) { g.to[side]--; between = 0; }
            run += between;
        }
        team[side].top += Math.min(run, g.clock);
        const before = g.clock;
        g.clock -= run;
        if ((g.q === 2 || g.q === 4) && !g.warned && before > 120 && g.clock < 120) {
            g.clock = 120;
            g.warned = true;
        }
    }

    // ── possession changes ───────────────────────────────────────────────────
    function endPossession() {
        if (g.ot) g.otDone[g.poss]++;
    }
    function newSeries(side, yl) {
        g.poss = side; g.yl = clamp(Math.round(yl), 1, 99); g.down = 1; g.togo = Math.min(10, 100 - g.yl);
    }
    function turnover(yardlineForNewOffense) {
        endPossession();
        newSeries(1 - g.poss, yardlineForNewOffense);
    }

    // ── kicks ────────────────────────────────────────────────────────────────
    function kickoff(kicking) {
        const recv = 1 - kicking;
        const late = g.q === 4 && g.clock <= 150 && lead(kicking) < 0 && lead(kicking) >= -16;
        if (late) {
            const got = chance(0.12);
            record({ off: recv, kind: KIND.ONSIDE, yl: 0, down: 0, togo: 0, flags: got ? FLAG.RECOVERED : 0 });
            tick(4, true, recv);
            newSeries(got ? kicking : recv, got ? 45 : 55);
            return;
        }
        let start, flags = 0, returner = -1, ret = 0;
        if (chance(0.60)) { start = 30; flags |= FLAG.TOUCHBACK; }
        else {
            const r = pickReturner(recv);
            returner = ref(recv, r);
            ret = Math.round(clamp(gaussian(26, 7), 8, 60));
            if (chance(0.004)) { ret = 100; }
            start = ret;
        }
        if (start >= 100) {
            const t = record({ off: recv, kind: KIND.KICKOFF, yl: 0, down: 0, togo: 0, yards: 100, a: returner, flags: FLAG.TD | FLAG.RETURN_TD });
            tick(12, true, recv);
            touchdown(recv, 'KR', t);
            return;
        }
        record({ off: recv, kind: KIND.KICKOFF, yl: start, down: 0, togo: 0, yards: ret, a: returner, flags });
        tick(returner >= 0 ? 6 : 0, true, recv);
        newSeries(recv, start);
    }

    function pickReturner(side) {
        const d = teams[side].depth;
        const pool = [...d.wrs.slice(2), ...d.rbs.slice(1), ...d.coverage.filter(p => p.position === 'CB').slice(2)];
        const list = pool.length ? pool : [...d.wrs, ...d.rbs];
        if (!list.length) return null;
        return list.reduce((best, p) => ((p.attributes?.universal?.speed || 0) > (best.attributes?.universal?.speed || 0) ? p : best), list[0]);
    }

    // A punt that never gets past the line: the defense scoops it, and near
    // the end zone it is often a touchdown.
    function blockedPunt() {
        const side = g.poss, def = 1 - side;
        const blocker = pick(defense[def].rushers);
        const t = record({ kind: KIND.PUNT, yards: 0, x: ref(def, blocker), flags: FLAG.BLOCKED });
        tick(5, true, side);
        endPossession();
        bump(def, 3);
        const ballYl = g.yl - Math.round(4 + Math.random() * 8); // where it lands, punting team's view
        if (ballYl <= 0 || chance(ballYl <= 30 ? 0.35 : 0.12)) {
            const scorer = chance(0.5) ? blocker : pick(defense[def].ballhawks);
            if (scorer) { const l = S(def, scorer); if (l) l.defensiveTds++; }
            t[14] = ref(def, scorer);
            t[11] |= FLAG.RETURN_TD | FLAG.TD;
            touchdown(def, 'DEF', t, true);
            return;
        }
        newSeries(def, clamp(100 - ballYl, 1, 99));
        checkOvertimeEnd();
    }

    function punt() {
        const side = g.poss, recv = 1 - side;
        const room = 100 - g.yl;
        const u = offense[side];
        if (chance(0.005)) { blockedPunt(); return; }
        let gross = Math.round(clamp(gaussian(46 * u.puntMult, 6), 28, 70));
        // Plus territory: aim short instead of into the end zone
        if (room < 55) gross = Math.round(Math.min(gross, room - clamp(gaussian(8, 5), 1, 18) / u.pinMult));
        gross = Math.max(20, gross);
        let flags = 0, ret = 0, returner = -1;
        let spot = g.yl + gross;
        let recvYl;
        if (spot >= 100) { flags |= FLAG.TOUCHBACK; recvYl = 20; gross = room; }
        else if (chance(0.42) || spot > 92) { flags |= FLAG.FAIR_CATCH; recvYl = 100 - spot; }
        else {
            const r = pickReturner(recv);
            returner = ref(recv, r);
            ret = Math.round(Math.min(expo(8.5), 100 - (100 - spot)));
            if (chance(0.006)) ret = spot; // housed
            recvYl = 100 - spot + ret;
        }
        const tuple = record({ kind: KIND.PUNT, yards: gross, b: returner, extra: ret, flags });
        tick(8, true, side);
        endPossession();
        if (recvYl >= 100) {
            tuple[11] |= FLAG.RETURN_TD | FLAG.TD;
            touchdown(recv, 'PR', tuple, true);
            return;
        }
        newSeries(recv, recvYl);
    }

    function fgChance(dist, u) {
        const d = Math.max(0, dist - 22);
        // A shade above the old 0.975 base, so blocked kicks (below) leave the
        // league's FG% where it was.
        let p = 0.990 - Math.pow(d / 37, 2.2) * 0.5;
        p += (u.kAcc - LG.kickAcc) * 0.004;
        p *= u.weatherKick;
        if (xf.any && u.kicker) {
            p *= xm('fgAcc', g.poss, { kicker: u.kicker.id });
            if (dist >= 45) p *= xm('fgRange', g.poss, { kicker: u.kicker.id });
        }
        return clamp(p, 0.05, 0.995);
    }

    function fieldGoal() {
        const side = g.poss, u = offense[side], def = 1 - side;
        const dist = 100 - g.yl + 17;
        const k = u.kicker;
        let flags = 0;
        let p = fgChance(dist, u);
        if (inWitching()) {
            // Icing the kicker: a timeout right before the snap.
            if (dist >= 38 && g.to[def] > 0 && chance(0.5)) { g.to[def]--; flags |= FLAG.ICED; p -= 0.015; }
            p += 0.06 * clutchNow(k) + u.kClutch;
        }
        const blocked = chance(0.010 + Math.max(0, dist - 45) * 0.001);
        const blocker = blocked ? pick(defense[def].rushers) : null;
        const made = !blocked && chance(clamp(p, 0.03, 0.995));
        const c = flags || inWitching() ? clutchOf(k) : 0;
        if (inWitching() && made && c >= CLUTCH_STAR) flags |= FLAG.CLUTCH;
        if (inWitching() && !made && !blocked && c <= CHOKE_LINE) flags |= FLAG.CHOKE;
        if (blocked) flags |= FLAG.BLOCKED;
        const line = S(side, k);
        if (line) { line.fga++; if (made) line.fgm++; }
        const tuple = record({ kind: made ? KIND.FG : KIND.FG_MISS, yards: dist, a: ref(side, k), x: ref(def, blocker), flags });
        if (xf.any && k) xf.event(made ? 'fgMade' : 'fgMiss', sit(side), { side, kicker: k.id, yards: dist });
        if (made) drive.scored = true;
        tick(5, true, side);
        endPossession();
        if (made) {
            addPoints(side, 3, 'FG');
            restamp(tuple);
            if (!walkOff(side, false) && !checkOvertimeEnd()) kickoff(side);
        } else if (blocked) {
            bump(def, 3);
            if (chance(0.1)) {
                const runner = pick(defense[def].ballhawks) || blocker;
                if (runner) { const l = S(def, runner); if (l) l.defensiveTds++; }
                tuple[14] = ref(def, runner);
                tuple[11] |= FLAG.RETURN_TD | FLAG.TD;
                touchdown(def, 'DEF', tuple, true);
                return;
            }
            newSeries(def, clamp(100 - (g.yl - 8) + Math.round(expo(6)), 1, 99));
            checkOvertimeEnd();
        } else {
            bump(def, 1);
            newSeries(1 - side, Math.max(20, 100 - (g.yl - 7)));
            checkOvertimeEnd();
        }
    }

    // ── scoring ──────────────────────────────────────────────────────────────
    // The try after a touchdown: the two-point chart late, a small base rate
    // otherwise (more for an aggressive staff).
    function conversion(side) {
        const u = offense[side];
        const m = lead(side); // already includes the six
        const late = g.q >= 4 && gameLeft() <= 900;
        const chartTwo = (late && [-10, -5, -2, 1, 5, 12].includes(m)) || (g.ot && m === -1 && chance(0.5));
        if (chartTwo || chance(0.045 * plans[side].aggression)) {
            const good = chance(0.48);
            const t = record({ off: side, kind: good ? KIND.TWO : KIND.TWO_FAIL, yl: 98, down: 0, togo: 2 });
            if (good) { addPoints(side, 2, null); restamp(t); }
            return;
        }
        const xpPct = clamp((0.955 + (u.kAcc - LG.kickAcc) * 0.002) * u.weatherKick, 0.85, 0.995);
        const good = chance(xpPct);
        const line = S(side, u.kicker);
        if (line) { line.xpa++; if (good) line.xpm++; }
        const t = record({ off: side, kind: good ? KIND.XP : KIND.XP_MISS, yl: 85, down: 0, togo: 0, a: ref(side, u.kicker) });
        if (good) { addPoints(side, 1, null); restamp(t); if (xf.any && u.kicker) xf.event('xpMade', sit(side), { side, kicker: u.kicker.id }); }
    }

    // In overtime a score that takes the lead ends it once both teams have had
    // the ball — or at once, when the defense or a return team scores it.
    const bothHadIt = () => g.otDone[0] >= 1 && g.otDone[1] >= 1;
    function walkOff(side, byDefense) {
        if (!g.ot || lead(side) <= 0) return false;
        if (byDefense || bothHadIt()) { g.ended = true; return true; }
        return false;
    }

    // defensive: scored by the team without the ball (pick-six, scoop, return).
    // The caller has already closed the offense's possession in that case.
    function touchdown(side, kindTag, tuple, defensive = false) {
        const base = g.score[side];
        bump(side, defensive ? 3 : 1.5);
        addPoints(side, 6, kindTag);
        restamp(tuple);
        if (drive.side === side) drive.scored = true;
        if (xf.any) xf.event('td', sit(side), { side, ...tdInfo });
        tdInfo = {};
        const ev = g.scoring[g.scoring.length - 1];
        if (!defensive) { g.poss = side; endPossession(); }
        g.poss = side;
        if (walkOff(side, defensive)) return;
        conversion(side);
        ev[3] = g.score[side] - base;
        if (!checkOvertimeEnd()) kickoff(side);
    }

    function safety(defSide, tuple) {
        tuple[11] |= FLAG.SAFETY;
        addPoints(defSide, 2, 'SAF');
        restamp(tuple);
        endPossession();
        if (walkOff(defSide, true) || checkOvertimeEnd()) return;
        // Free kick from the 20
        const recv = defSide;
        const start = Math.round(clamp(gaussian(38, 7), 25, 55));
        record({ off: recv, kind: KIND.KICKOFF, yl: start, down: 0, togo: 0, yards: start });
        newSeries(recv, start);
    }

    function checkOvertimeEnd() {
        if (!g.ot) return false;
        if (g.otDone[0] >= 1 && g.otDone[1] >= 1 && g.score[0] !== g.score[1]) { g.ended = true; return true; }
        return false;
    }

    // ── defenders ────────────────────────────────────────────────────────────
    const pick = list => weightedPick(list)?.p || null;
    function creditTackle(defSide, list, primary = null) {
        const tackler = primary || pick(list);
        if (!tackler) return null;
        const line = S(defSide, tackler);
        if (line) line.tackles++;
        if (chance(0.34)) {
            const helper = pick(list);
            if (helper && helper !== tackler) { const h = S(defSide, helper); if (h) h.tackles++; }
        }
        return tackler;
    }

    // ── snaps ────────────────────────────────────────────────────────────────
    function passRate(side) {
        const u = offense[side];
        const m = lead(side);
        let p = 0.583 + u.lean * 0.012 + plans[side].passTilt;
        if (g.down === 1) p -= 0.05;
        else if (g.down === 2) p += g.togo >= 8 ? 0.10 : g.togo <= 3 ? -0.14 : 0;
        else p = g.togo >= 7 ? 0.90 : g.togo >= 4 ? 0.78 : g.togo >= 2 ? 0.55 : 0.35;
        if (100 - g.yl <= 3) p = Math.min(p, 0.42);
        if (hurry(side)) p = Math.max(p, 0.86);
        else if (g.q >= 3) {
            if (m <= -17) p += 0.22;
            else if (m <= -9) p += 0.12;
            else if (m >= 14) p -= 0.18 + plans[side].clockControl * 0.08;
            else if (m >= 7 && g.q === 4) p -= 0.10 + plans[side].clockControl * 0.06;
        }
        p -= (1 - u.passMult) * 0.8;
        return clamp(p, 0.18, 0.95);
    }

    function fourthDownCall(side) {
        const u = offense[side];
        const dist = 100 - g.yl + 17;
        const inRange = dist <= u.fgRange;
        const m = lead(side);
        const left = gameLeft();
        const aggr = plans[side].aggression;
        // Must-score situations late
        if (g.q >= 4 || g.ot) {
            if (m < 0 && left <= 240) {
                if (m >= -3 && inRange && (left <= 40 || g.togo > 4)) return 'fg';
                return 'go';
            }
            if (m < -8 && left <= 600) return inRange && g.togo > 6 && m >= -11 ? 'fg' : 'go';
            if (m > 0 && left <= 120) return inRange ? 'fg' : 'punt';
        }
        if (g.ot && g.otDone[1 - side] >= 1 && m < 0) return 'go';
        if (g.q === 2 && g.clock <= 8 && inRange) return 'fg';
        const noMansLand = g.yl >= 55 && !inRange;
        let pGo = 0;
        if (g.togo <= 1) pGo = g.yl >= 70 ? 0.55 : g.yl >= 45 ? 0.45 : g.yl >= 30 ? 0.12 : 0.03;
        else if (g.togo <= 2) pGo = noMansLand ? 0.40 : g.yl >= 65 ? 0.25 : g.yl >= 50 ? 0.18 : 0.02;
        else if (g.togo <= 4) pGo = noMansLand ? 0.25 : g.yl >= 65 ? 0.08 : 0.01;
        else pGo = noMansLand ? 0.05 : 0;
        if (m <= -14 && g.q >= 3) pGo += 0.25;
        if (chance(clamp(pGo * aggr, 0, 0.95))) return 'go';
        if (inRange) return 'fg';
        return 'punt';
    }

    function canKneel(side) {
        if (lead(side) <= 0) return false;
        if (g.q === 2 && g.clock <= 30 && g.yl < 50 && lead(side) >= 0) return true;
        if (g.q !== 4 && g.q < 5) return false;
        const downsLeft = 4 - g.down + (g.down <= 4 ? 1 : 0) - 1; // keep the 4th for a punt if needed
        const oppTo = g.to[1 - side];
        const burn = Math.max(0, downsLeft) * 41 - Math.min(oppTo, Math.max(0, downsLeft)) * 40;
        return g.clock <= burn + 2;
    }

    function snap() {
        const side = g.poss, def = 1 - side;
        const u = offense[side];
        const dfn = defense[def];
        if (drive.side !== side) {
            if (xf.any && drive.side >= 0) xf.event('driveEnd', sit(drive.side), { side: drive.side, plays: drive.plays, sacked: drive.sacked, scored: drive.scored });
            drive.side = side; drive.plays = 0; drive.sacked = false; drive.scored = false;
        }
        drive.plays++;
        g.mo[0] *= 0.88; g.mo[1] *= 0.88;

        if (canKneel(side)) {
            const t = record({ kind: KIND.KNEEL, yards: -1, a: ref(side, u.qb) });
            const line = S(side, u.qb);
            if (line) { line.carries++; line.rushYards -= 1; }
            team[side].rushAtt++; team[side].rushYds -= 1;
            g.yl = Math.max(1, g.yl - 1);
            advanceDown(-1, t);
            tick(2, false, side);
            return;
        }

        // Desperation at the end of a half
        const lastPlay = (g.q === 2 || g.q === 4 || g.q >= 5) && g.clock <= 6;
        const dist = 100 - g.yl + 17;
        if (lastPlay && dist <= offense[side].fgRange + 2 && (g.q === 2 || (lead(side) >= -3 && lead(side) <= 0))) { fieldGoal(); return; }
        if (lastPlay && (g.q === 4 || g.q >= 5) && lead(side) < 0) { passPlay(side, def, u, dfn, { hail: g.yl >= 40 }); return; }

        if (g.down === 4) {
            let call = fourthDownCall(side);
            // The fake: a gamble aggressive staffs take more often, never
            // when the game is on the line (everyone's expecting it then).
            const lateClose = g.q >= 4 && gameLeft() <= 300;
            if (!lateClose && g.togo <= 5
                && ((call === 'punt' && g.yl >= 25 && g.yl <= 65 && chance(0.010 * plans[side].aggression))
                 || (call === 'fg' && 100 - g.yl <= 30 && chance(0.007 * plans[side].aggression)))) {
                g.trick = FLAG.TRICK;
                call = 'fake';
            }
            if (call === 'fg') { fieldGoal(); return; }
            if (call === 'punt') { punt(); return; }
            g.goingForIt = true;
            if (call === 'fake') { runPlay(side, def, u, dfn, { fake: true }); g.goingForIt = false; return; }
        }

        const third = g.down === 3;
        const at = g.plays.length;
        if (chance(passRate(side))) passPlay(side, def, u, dfn, {});
        else runPlay(side, def, u, dfn);
        if (third && g.plays[at] && g.plays[at][6] !== KIND.SPIKE) {
            team[side].thirdAtt++;
            if (g.plays[at][11] & (FLAG.FIRST | FLAG.TD)) team[side].thirdConv++;
        }
        g.goingForIt = false;
    }

    // After a gain on a live play: update field, downs, flags. Returns true when
    // the play ended the possession (TD, safety, turnover on downs).
    function advanceDown(yards, tuple) {
        const side = g.poss;
        const togo = g.togo;
        if (g.goingForIt) tuple[11] |= FLAG.FOURTH_GO;
        if (yards >= togo) {
            tuple[11] |= FLAG.FIRST;
            team[side].firstDowns++;
            if (g.goingForIt) bump(side, 1.5);
            g.down = 1;
            g.togo = Math.min(10, 100 - g.yl);
            return false;
        }
        g.togo -= yards;
        g.down++;
        if (g.down > 4) {
            // Turnover on downs
            tuple[11] |= FLAG.TURNOVER;
            bump(1 - side, 2.5);
            record({ kind: KIND.DOWNS, yards: 0 });
            turnover(100 - g.yl);
            checkOvertimeEnd();
            return true;
        }
        return false;
    }

    function passPlay(side, def, u, dfn, ctx) {
        const qbLine = S(side, u.qb);
        const qbRef = ref(side, u.qb);
        const obvious = (g.down >= 3 && g.togo >= 6) || hurry(side);
        const garbage = g.q === 4 && lead(def) >= 17; // prevent defense
        const toGoal = 100 - g.yl;
        const mo = moEdge(side);
        const W = inWitching();

        // Spike to stop the clock in a hurry-up with no timeouts
        if (hurry(side) && g.to[side] === 0 && g.clock <= 40 && g.clock > 8 && g.down < 3 && !g.lastSpike && chance(0.5)) {
            const t = record({ kind: KIND.SPIKE, a: qbRef });
            if (qbLine) qbLine.attempts++;
            team[side].att++;
            // a spike is an intentionally incomplete pass: its target is nobody,
            // so credit the nominal target to keep Σ targets = attempts
            const tgt = weightedPick(u.targets);
            if (tgt) { const l = S(side, tgt.p); if (l) l.targets++; }
            g.lastSpike = true;
            advanceDown(0, t);
            tick(3, true, side);
            return;
        }
        g.lastSpike = false;

        // Sack
        if (!ctx.hail && chance(u.pSack * (obvious ? 1.18 : 0.92) * (garbage ? 0.7 : 1) * (1 - 0.03 * mo) * xm('pSack', side, { qb: u.qb?.id }))) {
            const sacker = pick(dfn.rushers);
            drive.sacked = true;
            if (xf.any) xf.event('sack', sit(side), { side, qb: u.qb?.id, defender: sacker?.id });
            const loss = Math.round(clamp(gaussian(6.8, 2.4), 1, 14));
            const allowed = u.team.depth.ol.length ? weightedPick(u.team.depth.ol.map(p => ({ p, weight: Math.pow(Math.max(1, 100 - (p.attributes?.position?.passBlock || 70)), 2) })))?.p : null;
            if (allowed) { const l = S(side, allowed); if (l) l.sacksAllowed++; }
            if (qbLine) qbLine.sacks++;
            if (sacker) { const l = S(def, sacker); if (l) l.sacks++; }
            team[side].sacks++; team[side].sackYds += loss;
            const strip = chance(0.075 * (dfn.mod(sacker).strip || 1) * xm('strip', side, {}));
            const clutchSack = W && clutchOf(sacker) >= CLUTCH_STAR ? FLAG.CLUTCH : 0;
            const t = record({ kind: KIND.SACK, yards: -loss, a: qbRef, x: ref(def, sacker), flags: (strip ? FLAG.FUMBLE | FLAG.TURNOVER : 0) | clutchSack });
            if (!strip) bump(def, 0.6);
            g.yl -= loss;
            if (g.yl <= 0) { tick(6, false, side); safety(def, t); return; }
            if (strip) {
                team[side].turnovers++;
                tick(6, true, side);
                fumbleReturn(def, t, sacker);
                return;
            }
            advanceDown(-loss, t);
            tick(6, false, side);
            return;
        }

        // Scramble
        if (!ctx.hail && chance(u.scramRate * (obvious ? 1.2 : 1))) {
            let yds = Math.round(gaussian(u.qbYpc + 0.8, 3.6));
            if (u.isMobile && chance(0.10)) yds += Math.round(8 + expo(10));
            yds = clamp(yds, -3, toGoal);
            if (qbLine) { qbLine.carries++; qbLine.rushYards += yds; }
            team[side].rushAtt++; team[side].rushYds += yds;
            const tackler = yds >= toGoal ? null : creditTackle(def, dfn.runTacklers);
            const t = record({ kind: KIND.SCRAMBLE, yards: yds, a: qbRef, x: ref(def, tackler) });
            g.yl += yds;
            if (g.yl >= 100) {
                if (qbLine) { qbLine.rushTds++; qbLine.tds++; }
                t[11] |= FLAG.TD;
                tick(5, true, side);
                touchdown(side, 'RUSH', t);
                return;
            }
            advanceDown(yds, t);
            tick(5, chance(0.3), side);
            return;
        }

        // The throw. A flea-flicker is a rare shot play for an aggressive
        // staff: the back takes the handoff, pitches it back, and the
        // quarterback looks deep.
        const flea = !ctx.hail && !hurry(side) && g.down <= 2 && g.yl >= 25 && g.yl <= 70
            && chance(0.0045 * plans[side].aggression);
        if (flea) g.trick = FLAG.TRICK;
        // Hot hand: a receiver who is cooking gets fed.
        const hot = t => {
            const l = S(side, t.p);
            return l ? 1 + Math.min(2, l.recTds) * 0.08 + (l.recYards >= 100 ? 0.05 : 0) : 1;
        };
        const wideouts = ctx.hail || flea ? u.targets.filter(t => t.pos === 'WR') : null;
        const tgt = weightedPick(wideouts?.length ? wideouts
            : u.targets.map(t => ({ ...t, weight: t.weight * (toGoal <= 20 ? t.rz : 1) * hot(t) })));
        if (qbLine) qbLine.attempts++;
        team[side].att++;
        if (!tgt) { advanceDown(0, record({ kind: KIND.INC, a: qbRef })); tick(5, true, side); return; }
        const rLine = S(side, tgt.p);
        if (rLine) rLine.targets++;
        const tRef = ref(side, tgt.p);

        const actors = { qb: u.qb?.id, target: tgt.p.id };
        let pC = u.pCmp * tgt.catchMult * xm('pCmp', side, actors) * xm('catch', side, actors);
        if (toGoal <= 10) pC *= 0.86;
        else if (toGoal <= 20) pC *= 0.93;
        if (garbage) pC += 0.06;
        if (g.down >= 3 && g.togo >= 10) pC -= 0.03;
        // Momentum, and in the Witching Hour, composure: clutch passers and
        // receivers deliver, volatile ones don't.
        const cQ = clutchNow(u.qb), cR = clutchNow(tgt.p);
        pC += 0.004 * mo + 0.045 * cQ + 0.02 * cR;
        if (flea) pC *= 0.85;
        if (ctx.hail) pC = 0.10;
        const complete = chance(clamp(pC, 0.05, 0.92));

        if (complete) {
            let yds;
            if (ctx.hail) yds = toGoal;
            else {
                const base = tgt.ypc * (garbage ? 0.8 : 1) * (g.down >= 3 ? 0.95 + Math.min(0.25, g.togo / 40) : 1);
                yds = Math.round(base * lognormal1(u.sigma * (W ? 1.12 : 1)));
                if (flea) yds = Math.round(Math.max(yds, 14) * (1.3 + Math.random() * 0.7));
                if (tgt.pos === 'RB' && chance(0.12)) yds -= Math.round(1 + Math.random() * 3);
                if (toGoal <= 20 && yds > 0 && yds < toGoal && chance(0.08)) yds = toGoal;
            }
            if (!ctx.hail && xf.any && yds > 0) yds = Math.round(yds * xm('passYds', side, actors) * xm('recYds', side, actors));
            yds = Math.min(yds, toGoal);
            if (ctx.hail && !chance(0.35)) yds = Math.max(1, toGoal - Math.round(2 + Math.random() * 6));
            if (qbLine) { qbLine.completions++; qbLine.yards += yds; }
            if (rLine) { rLine.receptions++; rLine.recYards += yds; }
            team[side].passYds += yds;
            const td = g.yl + yds >= 100;
            const fumble = !td && chance(0.0045);
            const tackler = td ? null : creditTackle(def, dfn.passTacklers);
            const oob = !td && !fumble && chance(hurry(side) ? 0.38 : 0.17);
            const t = record({ kind: KIND.PASS, yards: yds, a: qbRef, b: tRef, x: ref(def, tackler),
                flags: (oob ? FLAG.OOB : 0) | (fumble ? FLAG.FUMBLE | FLAG.TURNOVER : 0) | (ctx.hail ? FLAG.HAIL_MARY : 0) });
            g.yl += yds;
            if (xf.any) xf.event('completion', sit(side), { side, ...actors, yards: yds });
            if (W && (td || yds >= 20 || (g.down === 4 && yds >= g.togo)) && (clutchOf(u.qb) >= CLUTCH_STAR || clutchOf(tgt.p) >= CLUTCH_STAR)) t[11] |= FLAG.CLUTCH;
            if (!td && yds >= 25) bump(side, 1.2);
            if (td) {
                if (qbLine) qbLine.tds++;
                if (rLine) { rLine.recTds++; rLine.tds++; }
                tdInfo = actors;
                t[11] |= FLAG.TD;
                tick(6, true, side);
                touchdown(side, 'PASS', t);
                return;
            }
            if (g.yl <= 0) { tick(6, false, side); safety(def, t); return; }
            if (fumble) {
                team[side].turnovers++;
                tick(6, true, side);
                fumbleReturn(def, t, tackler);
                return;
            }
            const ended = advanceDown(yds, t);
            if (!ended) tick(6, oob && isLateHalf(g.q === 2 ? 120 : 300), side);
            else tick(6, true, side);
            return;
        }

        // Incomplete — or picked off
        // A volatile quarterback who has already thrown two presses.
        const rattled = qbLine && qbLine.ints >= 2 && clutchOf(u.qb) < 0 ? 1.15 : 1;
        const intP = ctx.hail ? 0.22 : u.pInt * 1.75 * (garbage ? 0.9 : 1) * (hurry(side) && lead(side) < 0 ? 1.25 : 1)
            * Math.max(0.4, 1 - 0.35 * cQ) * (1 - 0.03 * mo) * rattled * xm('pInt', side, actors);
        if (chance(intP)) {
            const hawk = pick(dfn.ballhawks);
            if (xf.any) xf.event('int', sit(side), { side, qb: u.qb?.id, defender: hawk?.id });
            if (qbLine) qbLine.ints++;
            if (hawk) { const l = S(def, hawk); if (l) l.ints++; }
            team[side].turnovers++;
            const air = ctx.hail ? toGoal : Math.round(clamp(gaussian(13, 7), 2, toGoal));
            const spotForDef = 100 - Math.min(99, g.yl + air); // defense's yardline at the catch
            const sixP = (0.055 + (spotForDef >= 60 ? 0.07 : 0)) * (dfn.mod(hawk).six || 1) * xm('pickSix', side, {});
            let ret = Math.round(Math.min(expo(11), 99 - spotForDef));
            const six = !ctx.hail && chance(sixP);
            if (six) ret = 100 - spotForDef;
            const drama = !W ? 0 : (clutchOf(hawk) >= CLUTCH_STAR ? FLAG.CLUTCH : 0) | (clutchOf(u.qb) <= CHOKE_LINE ? FLAG.CHOKE : 0);
            const t = record({ kind: KIND.INT, yards: air, a: qbRef, b: tRef, x: ref(def, hawk), extra: ret, flags: FLAG.TURNOVER | (six ? FLAG.RETURN_TD | FLAG.TD : 0) | (ctx.hail ? FLAG.HAIL_MARY : 0) | drama });
            if (!six) bump(def, 3);
            tick(ret > 25 ? 9 : 6, true, side);
            endPossession();
            if (six) {
                if (hawk) { const l = S(def, hawk); if (l) l.defensiveTds++; }
                touchdown(def, 'DEF', t, true);
                return;
            }
            const newYl = Math.max(1, Math.min(99, spotForDef + ret));
            newSeries(def, air >= toGoal ? 20 : newYl);
            checkOvertimeEnd();
            return;
        }
        let x = -1, flags = ctx.hail ? FLAG.HAIL_MARY : 0;
        if (chance(0.46)) {
            const cov = pick(dfn.cover);
            if (cov) { const l = S(def, cov); if (l) l.pd++; x = ref(def, cov); flags |= FLAG.DEFENDED; if (xf.any) xf.event('pd', sit(side), { side, defender: cov.id }); }
        }
        if (xf.any) xf.event('incomplete', sit(side), { side, ...actors });
        const t = record({ kind: KIND.INC, a: qbRef, b: tRef, x, flags });
        advanceDown(0, t);
        tick(5, true, side);
    }

    // Backfield rotation: a smooth weighted round-robin, so a 60/30/10 split
    // is a 60/30/10 split by the final whistle rather than a coin flip per
    // carry. The jitter keeps the order from being mechanical.
    function nextBack(u) {
        if (!u.rbs.length) return null;
        let best = null;
        for (const b of u.rbs) {
            b.credit = (b.credit || 0) + b.weight;
            const score = b.credit + (Math.random() - 0.5) * 0.3;
            if (!best || score > best.score) best = { b, score };
        }
        const total = u.rbs.reduce((s, b) => s + b.weight, 0);
        best.b.credit -= total;
        return best.b;
    }

    function runPlay(side, def, u, dfn, ctx = {}) {
        const toGoal = 100 - g.yl;
        const designed = !ctx.fake && u.qbDesigned > 0 && chance(u.qbDesigned);
        const back = designed ? null : nextBack(u);
        const carrier = designed ? u.qb : back ? back.p : u.qb;
        const line = S(side, carrier);
        const ypc = designed ? u.qbYpc : back ? back.ypc : 3.5;
        const runActors = { carrier: carrier?.id };
        const burst = (designed ? 0.05 : back ? back.burst : 0.03) * xm('burst', side, runActors);
        const shortYardage = g.togo <= 2 && g.down >= 3;

        // Mixture: stuffed-to-steady base, a "good run" band and breakaways
        const good = 0.11;
        const baseMean = (ypc - good * 12 - burst * 30) / (1 - good - burst);
        let yds;
        const r = Math.random();
        if (r < burst) yds = 15 + expo(15);
        else if (r < burst + good) yds = 7 + expo(5);
        else yds = gaussian(baseMean, 2.4);
        if (toGoal <= 4) yds += 0.2 + (back?.goalLine || 0);
        if (shortYardage) yds += 0.35;
        if (xf.any && yds > 0) yds *= xm('runYds', side, runActors);
        yds += 0.1 * moEdge(side);
        if (ctx.fake) yds += 3; // nobody saw it coming
        yds = Math.round(clamp(yds, -6, toGoal));

        const cC = clutchNow(carrier);
        const fumble = yds < toGoal && chance((back ? back.fumble : 0.009) * (1 - 0.45 * cC) * xm('fumble', side, runActors));
        const lost = fumble && chance(0.5);
        if (line) { line.carries++; line.rushYards += yds; if (fumble) line.fumbles++; }
        team[side].rushAtt++; team[side].rushYds += yds;

        const td = g.yl + yds >= 100;
        let tackler = null, flags = 0;
        if (!td) {
            tackler = yds <= 0 ? (pick(dfn.stuffers) || pick(dfn.runTacklers)) : pick(dfn.runTacklers);
            creditTackle(def, dfn.runTacklers, tackler);
            if (yds < 0 && tackler) { const l = S(def, tackler); if (l) l.tfl++; flags |= FLAG.TFL; if (xf.any) xf.event('tfl', sit(side), { side, defender: tackler.id }); }
        }
        if (xf.any) {
            xf.event('run', sit(side), { side, carrier: carrier?.id, yards: yds, firstDown: yds >= g.togo });
            if (lost) xf.event('fumble', sit(side), { side, carrier: carrier?.id });
        }
        if (lost) flags |= FLAG.FUMBLE | FLAG.TURNOVER | (inWitching() && clutchOf(carrier) <= CHOKE_LINE ? FLAG.CHOKE : 0);
        if (inWitching() && (td || (g.goingForIt && yds >= g.togo)) && clutchOf(carrier) >= CLUTCH_STAR) flags |= FLAG.CLUTCH;
        const t = record({ kind: KIND.RUN, yards: yds, a: ref(side, carrier), x: ref(def, tackler), flags });
        if (!td && yds >= 15) bump(side, 1);
        g.yl += yds;
        if (td) {
            if (line) { line.rushTds++; line.tds++; }
            t[11] |= FLAG.TD;
            tdInfo = runActors;
            tick(5, true, side);
            touchdown(side, 'RUSH', t);
            return;
        }
        if (g.yl <= 0) { tick(5, false, side); safety(def, t); return; }
        if (lost) {
            team[side].turnovers++;
            tick(5, true, side);
            fumbleReturn(def, t, tackler);
            return;
        }
        const ended = advanceDown(yds, t);
        tick(5, ended, side);
    }

    // The defense has the ball after a fumble. Some are scooped and scored.
    function fumbleReturn(def, tuple, forcer) {
        endPossession();
        bump(def, 3);
        const d = teams[def].depth;
        const recoverer = forcer && chance(0.35) ? forcer : (d.front7.length ? d.front7[Math.floor(Math.random() * d.front7.length)] : forcer);
        tuple[14] = ref(def, recoverer);
        const spotForDef = 100 - g.yl;
        if (chance(0.085)) {
            if (recoverer) { const l = S(def, recoverer); if (l) l.defensiveTds++; }
            tuple[11] |= FLAG.RETURN_TD | FLAG.TD;
            touchdown(def, 'DEF', tuple, true);
            return;
        }
        const ret = Math.round(Math.min(expo(4), 99 - spotForDef));
        newSeries(def, Math.max(1, spotForDef + ret));
        checkOvertimeEnd();
    }

    // ── play the game ────────────────────────────────────────────────────────
    kickoff(1 - receiveFirst);
    let safetyValve = 0;
    while (!g.ended && safetyValve++ < 600) {
        if (g.clock <= 0) {
            // End of a period
            if (g.q === 1 || g.q === 3) { g.q++; g.clock = 900; continue; }
            if (g.q === 2) {
                g.q = 3; g.clock = 900; g.to = [3, 3]; g.warned = false;
                endPossession();
                kickoff(receiveFirst); // the other team receives the second half
                continue;
            }
            if (g.q === 4 || g.q >= 5) {
                if (g.score[0] !== g.score[1]) break;
                if (g.q >= 5 && allowTie) break;
                // Overtime: 10 minutes; both teams are guaranteed a possession
                g.q = g.q === 4 ? 5 : g.q + 1;
                g.clock = allowTie ? 600 : 900;
                g.ot = true; g.otDone = [0, 0]; g.to = [2, 2]; g.warned = false;
                if (g.quarters[0].length < 5) { g.quarters[0].push(0); g.quarters[1].push(0); }
                kickoff(chance(0.5) ? 0 : 1);
                continue;
            }
        }
        snap();
    }

    const teamStats = [0, 1].map(i => {
        const t = team[i];
        const net = Math.max(0, t.passYds - t.sackYds);
        return {
            passYards: net, rushYards: t.rushYds, yards: net + t.rushYds,
            turnovers: t.turnovers, sacks: t.sacks, rushAttempts: t.rushAtt,
            plays: t.att + t.sacks + t.rushAtt,
            firstDowns: t.firstDowns, thirdDown: [t.thirdConv, t.thirdAtt],
            possession: Math.round(t.top),
        };
    });

    // Pancakes: a season-long OL counting stat, not a per-snap event
    for (const i of [0, 1]) {
        for (const p of teams[i].depth.ol) {
            const rbk = p.attributes?.position?.runBlock || 70;
            const l = S(i, p);
            if (l) l.pancakes += binomial(60, Math.max(0.01, 0.04 + (rbk - LG.olRunBlock) * 0.002));
        }
    }

    return {
        score: g.score,
        overtime: g.quarters[0].length > 4,
        teamStats,
        quarters: g.quarters,
        scoringLog: g.scoring.map(e => [e[0], e[1], e[2], e[3], e[4]]),
        plays: g.plays,
        names,
        form: form.map(f => ({ off: Math.round(f.off * 10) / 10, def: Math.round(f.def * 10) / 10 })),
        plans: plans.map(p => p.label),
        xfactor: xf.any ? xf.summary() : [],
        xfLog: xf.log,
        witching: g.witch,
    };
}
