// X-Factor tier (Claude-owned): a handful of players with one-of-a-kind,
// in-game abilities.
//
// An ability is assembled from four parts, all DERIVED from the player's id
// (plus a `seedBump` stored only to break collisions):
//   trigger    — when it can matter (3rd down, red zone, 4th quarter, …)
//   effect     — which snap probability it moves (completion, pressure, …)
//   activation — what he must do in THIS game to get "in the zone"
//   twist      — a signature extra (momentum, ice, spark, …)
// The only stored data is player.xFactor = { since, level, seedBump, dormant,
// zoneTds, awakenedBy }. The league registry keeps (family, trigger, effect)
// unique among active X-Factors, so no two share an ability.
//
// In a game, createXFactorGame() builds a small state machine per X-Factor:
// events from gameEngine arm and activate him; while active AND his trigger
// holds, his effect multiplies the relevant probability term. Counter events
// (sacks, turnovers, touchdowns allowed) or a drive limit switch him off.
import { hashSeed, seededRng } from './seededRandom.js';

export const XF_MAX_ACTIVE = 16;
export const XF_MIN_OVR = 88;
export const LEVELS = ['', 'Awakened', 'Mastered', 'Legendary'];
const MAG = [0, 0.26, 0.32, 0.38];

export const FAMILY = { QB: 'QB', RB: 'RB', WR: 'REC', TE: 'REC', OL: 'OL', DL: 'FRONT', LB: 'FRONT', CB: 'DB', S: 'DB', K: 'K', P: 'K' };
export const DEFENSIVE_FAMILIES = new Set(['FRONT', 'DB']);

// ── Parts ─────────────────────────────────────────────────────────────────────
export const TRIGGERS = {
    thirdDown: { label: 'On third down', short: '3rd down', freq: 0.22, test: s => s.down === 3 },
    redZone: { label: 'In the red zone', short: 'Red zone', freq: 0.15, test: s => s.yl >= 80 },
    fourthQuarter: { label: 'In the fourth quarter', short: '4th quarter', freq: 0.25, test: s => s.q >= 4 },
    twoMinute: { label: 'In the two-minute drill', short: 'Two-minute', freq: 0.08, test: s => (s.q === 2 || s.q >= 4) && s.clock <= 120 },
    trailing: { label: 'When his team trails by 8+', short: 'Trailing', freq: 0.2, test: s => s.lead <= -8 },
    closeGame: { label: 'In a one-score game', short: 'Close game', freq: 0.6, test: s => Math.abs(s.lead) <= 8 },
    firstHalf: { label: 'In the first half', short: 'First half', freq: 0.5, test: s => s.q <= 2 },
    backedUp: { label: 'Backed up inside the 20', short: 'Backed up', freq: 0.12, test: s => (s.defense ? s.yl >= 80 : s.yl <= 20) },
    road: { label: 'On the road', short: 'Road game', freq: 0.5, test: s => s.away },
    bigGame: { label: 'In the playoffs', short: 'Playoffs', freq: 0.1, test: s => s.playoff },
    earlyDowns: { label: 'On first and second down', short: 'Early downs', freq: 0.7, test: s => s.down <= 2 },
    goalToGo: { label: 'Inside the 10', short: 'Goal to go', freq: 0.07, test: s => s.yl >= 90 },
    shortYardage: { label: 'On 3rd or 4th and short', short: 'Short yardage', freq: 0.08, test: s => s.down >= 3 && s.togo <= 3 },
    leading: { label: 'When protecting a lead', short: 'Protecting a lead', freq: 0.45, test: s => s.lead > 0 },
};

// Effects: `stat` is the probability term the engine asks about; `side` is
// whose snaps it touches (own offense, or the opponent's offense for
// defenders); `self` means only when he's the passer/carrier/target/kicker.
// `scale` equalizes impact: a sack-rate change must be larger in relative
// terms than a completion-rate change to matter as much on the scoreboard.
export const EFFECTS = {
    QB: {
        accuracy: { stat: 'pCmp', dir: 1, scale: 1, self: true, text: 'his completion rate jumps' },
        pocket: { stat: 'pSack', dir: -1, scale: 3.2, self: true, text: 'he slips pressure and takes far fewer sacks' },
        poise: { stat: 'pInt', dir: -1, scale: 3.2, self: true, text: 'he stops making mistakes: far fewer interceptions' },
        deepBall: { stat: 'passYds', dir: 1, scale: 1.8, self: true, text: 'his completions travel further downfield' },
    },
    RB: {
        breakaway: { stat: 'burst', dir: 1, scale: 4, self: true, text: 'every carry is a threat to go the distance' },
        brokenTackle: { stat: 'runYds', dir: 1, scale: 2.4, self: true, text: 'he breaks tackles for extra yards' },
        ballSecurity: { stat: 'fumble', dir: -1, scale: 6, self: true, text: 'the ball is glued to him', bonus: { stat: 'runYds', mult: 0.6 } },
    },
    REC: {
        hands: { stat: 'catch', dir: 1, scale: 1.3, self: true, text: 'he catches everything thrown his way' },
        yac: { stat: 'recYds', dir: 1, scale: 1.8, self: true, text: 'he turns catches into chunk gains' },
        magnet: { stat: 'catch', dir: 1, scale: 1.0, self: true, text: 'he wins every contested ball', bonus: { stat: 'recYds', mult: 0.8 } },
    },
    OL: {
        passPro: { stat: 'pSack', dir: -1, scale: 2.2, self: false, text: 'the pocket becomes a fortress' },
        runLane: { stat: 'runYds', dir: 1, scale: 1.2, self: false, text: 'the run game follows him for big lanes' },
    },
    FRONT: {
        pressure: { stat: 'pSack', dir: 1, scale: 3.2, self: false, text: 'the quarterback has no time' },
        strip: { stat: 'strip', dir: 1, scale: 8, self: false, text: 'sacks become strip-sacks', bonus: { stat: 'pSack', mult: 1.2 } },
        runStuff: { stat: 'runYds', dir: -1, scale: 1.8, self: false, text: 'runs die at the line' },
    },
    DB: {
        ballhawk: { stat: 'pInt', dir: 1, scale: 3.2, self: false, text: 'passes his way end up intercepted' },
        lockdown: { stat: 'pCmp', dir: -1, scale: 1, self: false, text: 'the passing game dries up' },
        pickSix: { stat: 'pickSix', dir: 1, scale: 10, self: false, text: 'interceptions go back the other way', bonus: { stat: 'pInt', mult: 1.2 } },
    },
    K: {
        automatic: { stat: 'fgAcc', dir: 1, scale: 1.6, self: true, text: 'he doesn\'t miss' },
        bigLeg: { stat: 'fgRange', dir: 1, scale: 3, self: true, text: 'his range stretches past 60 yards' },
    },
};

export const ACTIVATIONS = {
    QB: [
        { id: 'twoBig', ev: 'bigCompletion', n: 2, streak: true, text: 'completes two 15+ yard passes in a row' },
        { id: 'threeStraight', ev: 'completion', n: 3, streak: true, text: 'completes three straight passes' },
        { id: 'tdPass', ev: 'passTd', n: 1, text: 'throws a touchdown pass' },
    ],
    RB: [
        { id: 'bigRun', ev: 'bigRun', n: 1, text: 'breaks a 20+ yard run' },
        { id: 'chainMover', ev: 'firstDownRun', n: 2, drive: true, text: 'moves the chains twice on one drive' },
        { id: 'rushTd', ev: 'rushTd', n: 1, text: 'scores a rushing touchdown' },
    ],
    REC: [
        { id: 'driveCatches', ev: 'catch', n: 2, drive: true, text: 'makes two catches on one drive' },
        { id: 'bigCatch', ev: 'bigCatch', n: 1, text: 'hauls in a 25+ yard catch' },
        { id: 'recTd', ev: 'recTd', n: 1, text: 'catches a touchdown' },
    ],
    OL: [
        { id: 'cleanDrive', ev: 'cleanDrive', n: 1, text: 'keeps an 8+ play drive sack-free' },
        { id: 'goodRuns', ev: 'goodRun', n: 3, streak: true, text: 'opens three straight 5+ yard runs' },
    ],
    FRONT: [
        { id: 'sack', ev: 'sack', n: 1, text: 'records a sack' },
        { id: 'tfl', ev: 'tfl', n: 1, text: 'makes a tackle for loss' },
        { id: 'threeOut', ev: 'threeOut', n: 1, text: 'forces a three-and-out' },
    ],
    DB: [
        { id: 'breakup', ev: 'pd', n: 1, text: 'breaks up a pass' },
        { id: 'pick', ev: 'int', n: 1, text: 'intercepts a pass' },
        { id: 'threeOut', ev: 'threeOut', n: 1, text: 'forces a three-and-out' },
    ],
    K: [
        { id: 'longFg', ev: 'longFg', n: 1, text: 'makes a 40+ yard field goal' },
        { id: 'twoKicks', ev: 'kickMade', n: 2, text: 'makes two kicks' },
    ],
};
// What switches him off (any one): event → count.
export const COUNTERS = {
    QB: { counter: { sacked: 2, intThrown: 1 }, text: 'until he\'s sacked twice or throws a pick' },
    RB: { counter: { stuffed: 2, fumble: 1 }, text: 'until he\'s stuffed twice or fumbles' },
    REC: { counter: { missedTarget: 2 }, text: 'until two passes his way fall incomplete' },
    OL: { counter: { sackAllowed: 1 }, text: 'until the line gives up a sack' },
    FRONT: { counter: { oppTd: 1 }, text: 'until the opponent scores a touchdown' },
    DB: { counter: { oppTd: 1 }, text: 'until the opponent scores a touchdown' },
    K: { counter: { fgMiss: 1 }, text: 'until he misses' },
};
export const TWISTS = {
    momentum: { id: 'momentum', label: 'Momentum', text: 'A touchdown while he\'s in the zone fires up the whole offense for the next drive.' },
    ice: { id: 'ice', label: 'Ice', text: 'His effect doubles in the final two minutes.' },
    spark: { id: 'spark', label: 'Spark', text: 'Teammates catch half of his effect while he\'s in the zone.' },
    aura: { id: 'aura', label: 'Aura', text: 'While he\'s in the zone, the opponent\'s play-caller gets conservative.' },
    clutchGene: { id: 'clutchGene', label: 'Clutch gene', text: 'In the playoffs, one event less gets him in the zone.' },
    showman: { id: 'showman', label: 'Showman', text: 'Bigger crowd, owner and media reactions when he takes over.' },
};
const BONUS_SCALE = { pSack: 3.2, pInt: 3.2, runYds: 1.8, recYds: 1.8, passYds: 1.8 };
const TRIGGER_IDS = Object.keys(TRIGGERS);
const TWIST_IDS = Object.keys(TWISTS);
const K_TRIGGERS = ['fourthQuarter', 'twoMinute', 'trailing', 'closeGame', 'firstHalf', 'road', 'bigGame', 'leading'];
const DEF_TRIGGERS = ['thirdDown', 'redZone', 'fourthQuarter', 'twoMinute', 'closeGame', 'firstHalf', 'road', 'bigGame', 'earlyDowns', 'goalToGo', 'shortYardage', 'leading'];

// ── Ability generation ───────────────────────────────────────────────────────
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

const NAME_FORMS = {
    accuracy: ['{L} Precision', 'Surgeon {L}', 'The {L} Needle'], pocket: ['{L} Escape Act', 'The {L} Houdini'], poise: ['Cool {L}', 'The {L} Vault'],
    deepBall: ['{L} Overdrive', 'The {L} Launch'], breakaway: ['{L} Afterburner', 'Gone {L}'], brokenTackle: ['The {L} Hammer', '{L} Bulldozer'],
    ballSecurity: ['{L} Lockbox', 'The {L} Grip'], hands: ['{L} Glue', 'Velcro {L}'], yac: ['{L} After Dark', 'The {L} Slipstream'],
    magnet: ['{L} Magnet', 'Mister {L} Contested'], passPro: ['{L} Wall', 'Fort {L}'], runLane: ['{L} Highway', 'The {L} Plow'],
    pressure: ['{L} Blitzkrieg', 'The {L} Storm'], strip: ['{L} Pickpocket', 'The {L} Strip Club'], runStuff: ['{L} Roadblock', 'Dead End {L}'],
    ballhawk: ['{L} Ballhawk', 'The {L} Heist'], lockdown: ['{L} Island', 'Lockdown {L}'], pickSix: ['{L} House Call', 'Six {L}'],
    automatic: ['Automatic {L}', 'The {L} Metronome'], bigLeg: ['{L} Cannon', 'The {L} Moonshot'],
};
const lastName = name => String(name || 'Player').split(' ').slice(-1)[0];

/** The player's ability. Pure: same id + seedBump → same ability, forever. */
export function abilityFor(player) {
    const family = FAMILY[player?.position];
    if (!family) return null;
    const bump = player.xFactor?.seedBump || 0;
    // Each part draws from its own stream so the parts vary independently.
    const part = name => seededRng(`xf:${player.id}:${bump}:${name}`);
    const r = part('name');
    const defensive = DEFENSIVE_FAMILIES.has(family);
    const triggerPool = family === 'K' ? K_TRIGGERS : defensive ? DEF_TRIGGERS : TRIGGER_IDS;
    const triggerId = pick(part('trigger'), triggerPool);
    const effectId = pick(part('effect'), Object.keys(EFFECTS[family]));
    const activation = pick(part('activation'), ACTIVATIONS[family]);
    const twistId = pick(part('twist'), TWIST_IDS);
    const level = Math.max(1, Math.min(3, player.xFactor?.level || 1));
    const effect = EFFECTS[family][effectId];
    const name = pick(r, NAME_FORMS[effectId] || ['{L} Effect']).replace('{L}', lastName(player.name));
    // Rare triggers hit harder so every ability is worth about the same.
    const magnitude = MAG[level] * Math.max(0.8, Math.min(2, Math.sqrt(0.3 / TRIGGERS[triggerId].freq)));
    const pct = Math.round(magnitude * effect.scale * 100);
    return {
        key: `${family}:${triggerId}:${effectId}`, family, name, level, levelLabel: LEVELS[level],
        trigger: triggerId, triggerLabel: TRIGGERS[triggerId].label, triggerShort: TRIGGERS[triggerId].short,
        effect: effectId, effectText: effect.text, stat: effect.stat, magnitude, pct,
        activation, counter: COUNTERS[family], twist: TWISTS[twistId],
        drives: level >= 3 ? 7 : 6,
        secondTrigger: level >= 3 ? pick(part('trigger2'), triggerPool.filter(t => t !== triggerId)) : null,
    };
}

/** One readable sentence. */
export function describeAbility(a) {
    if (!a) return '';
    const trig = a.secondTrigger ? `${a.triggerLabel.toLowerCase()} or ${TRIGGERS[a.secondTrigger].label.toLowerCase()}` : a.triggerLabel.toLowerCase();
    return `Once he ${a.activation.text}, ${a.effectText} ${trig} (+${a.pct}%), ${a.counter.text}.`;
}

// ── League registry & awards ─────────────────────────────────────────────────
export const isActiveXF = p => !!p?.xFactor && !p.xFactor.dormant;

export function activeXFactors(rosters) {
    const out = [];
    for (const [teamId, roster] of Object.entries(rosters || {})) for (const p of roster || []) if (isActiveXF(p)) out.push({ ...p, teamId });
    return out;
}

/** Season impact 0-100ish from this season's box score, relative to position. */
export function seasonImpact(p) {
    const s = p.stats?.season || {};
    switch (p.position) {
        case 'QB': return (s.yards || 0) / 55 + (s.tds || 0) * 1.1 - (s.ints || 0) * 1.2;
        case 'RB': return ((s.rushYards || 0) + (s.recYards || 0)) / 22 + ((s.rushTds || 0) + (s.recTds || 0)) * 2;
        case 'WR': case 'TE': return (s.recYards || 0) / 20 + (s.recTds || 0) * 2.2 + (s.receptions || 0) * 0.1;
        case 'OL': return (p.ovr - 70) * 1.4 - (s.sacksAllowed || 0) * 1.5 + (s.gamesPlayed || s.games || 14) * 0.5;
        case 'DL': case 'LB': return (s.sacks || 0) * 4 + (s.tackles || 0) * 0.25 + (s.tfl || 0) * 1.2 + (s.forcedFumbles || 0) * 3;
        case 'CB': case 'S': return (s.ints || 0) * 7 + (s.pd || 0) * 1.3 + (s.tackles || 0) * 0.15 + (s.defensiveTds || 0) * 6;
        case 'K': return (s.fgm || 0) * 1.2 + (p.ovr - 80);
        default: return 0;
    }
}

/** Minimum impact to qualify, by position family (about a top-3 season). */
const QUALIFY = { QB: 90, RB: 70, WR: 70, TE: 50, OL: 34, DL: 55, LB: 50, CB: 40, S: 38, K: 44 };

/**
 * Season-end X-Factor pass over the league. Returns { rosters, awakened,
 * lost, candidates } — pure. Existing X-Factors keep their ability; new ones
 * are bumped until their ability key is unique among the active set.
 */
export function seasonXFactorPass(rosters, { year, awards = {} } = {}) {
    const next = {};
    const all = [];
    for (const [teamId, roster] of Object.entries(rosters || {})) {
        next[teamId] = (roster || []).map(p => ({ ...p }));
        for (const p of next[teamId]) all.push({ p, teamId });
    }
    const awarded = new Set(Object.values(awards || {}).map(a => a?.id).filter(Boolean));
    const lost = [], awakened = [];
    // 1. Keep, level up, or make dormant.
    for (const { p, teamId } of all) {
        if (!p.xFactor) continue;
        const qualifies = seasonImpact(p) >= (QUALIFY[p.position] || 60) * 0.8 || awarded.has(p.id);
        const xf = { ...p.xFactor };
        if (p.ovr < 85 || (p.age || 26) >= 35) { xf.misses = 2; }
        else xf.misses = qualifies ? 0 : (xf.misses || 0) + 1;
        if (!xf.dormant && xf.misses >= 2) { xf.dormant = true; lost.push({ id: p.id, name: p.name, teamId }); }
        else if (!xf.dormant && qualifies && (xf.zoneTds || 0) >= (xf.level || 1) * 6 && (xf.level || 1) < 3) xf.level = (xf.level || 1) + 1;
        p.xFactor = xf;
    }
    // 2. Candidates.
    const activeKeys = new Set(all.filter(x => isActiveXF(x.p)).map(x => abilityFor(x.p)?.key));
    const activeCount = all.filter(x => isActiveXF(x.p)).length;
    const candidates = all
        .filter(({ p }) => !p.xFactor && p.ovr >= XF_MIN_OVR && FAMILY[p.position] && (p.age || 26) <= 33)
        .map(x => ({ ...x, impact: seasonImpact(x.p), need: QUALIFY[x.p.position] || 60 }))
        .filter(x => x.impact >= x.need || awarded.has(x.p.id))
        .sort((a, b) => (b.p.ovr + b.impact / b.need * 10) - (a.p.ovr + a.impact / a.need * 10));
    let room = Math.max(0, XF_MAX_ACTIVE - activeCount);
    // At most four new X-Factors per season keeps the tier special.
    for (const c of candidates.slice(0, Math.min(4, room))) {
        let seedBump = 0;
        c.p.xFactor = { since: year, level: 1, seedBump, dormant: false, zoneTds: 0, misses: 0 };
        while (activeKeys.has(abilityFor(c.p).key) && seedBump < 50) c.p.xFactor = { ...c.p.xFactor, seedBump: ++seedBump };
        activeKeys.add(abilityFor(c.p).key);
        awakened.push({ id: c.p.id, name: c.p.name, teamId: c.teamId, position: c.p.position });
        room--;
    }
    const waiting = candidates.slice(awakened.length, awakened.length + 6).map(x => ({ id: x.p.id, name: x.p.name, teamId: x.teamId }));
    return { rosters: next, awakened, lost, candidates: waiting };
}

/** Seed a new league with a few X-Factors so the tier exists from day one. */
export function seedLeagueXFactors(rosters, year, count = 10) {
    const all = [];
    for (const [teamId, roster] of Object.entries(rosters || {})) for (const p of roster || []) if (FAMILY[p.position] && p.ovr >= XF_MIN_OVR && (p.age || 26) <= 32) all.push({ p, teamId });
    if (all.some(x => x.p.xFactor)) return rosters;
    const r = seededRng(`xfseed:${year}:${all.length}`);
    const chosen = all.sort((a, b) => (b.p.ovr + r() * 3) - (a.p.ovr + r() * 3)).slice(0, count);
    const ids = new Map(chosen.map(x => [x.p.id, x]));
    const keys = new Set();
    const next = {};
    for (const [teamId, roster] of Object.entries(rosters)) {
        next[teamId] = roster.map(p => {
            if (!ids.has(p.id)) return p;
            let q = { ...p, xFactor: { since: year - 1, level: 1, seedBump: 0, dormant: false, zoneTds: 0, misses: 0 } };
            while (keys.has(abilityFor(q).key) && q.xFactor.seedBump < 50) q = { ...q, xFactor: { ...q.xFactor, seedBump: q.xFactor.seedBump + 1 } };
            keys.add(abilityFor(q).key);
            return q;
        });
    }
    return next;
}

/** A Generational prospect may carry X-Factor potential: a hint, never a promise. */
export const hasXFPotential = p => (p?.pot || 0) >= 93 && hashSeed(`xfpot:${p.id}`) % 3 === 0;

// ── In-game state machine ────────────────────────────────────────────────────
/**
 * teams: [homeState, awayState] from simulation.js (each has .roster).
 * opts: { playoff }. Returns an object the engine calls into.
 */
export function createXFactorGame(teams, opts = {}) {
    const units = [[], []];
    teams.forEach((t, side) => {
        const roster = t.roster || t.players || [];
        for (const p of roster) {
            if (!isActiveXF(p) || p.injured) continue;
            const a = abilityFor(p);
            if (!a) continue;
            units[side].push({ p, a, side, armed: 0, active: false, drivesLeft: 0, driveCount: 0, counters: {}, activations: 0, fired: 0, zoneTds: 0 });
        }
    });
    const log = [];
    const boost = [0, 0]; // momentum drives remaining
    const any = units[0].length + units[1].length > 0;

    const holds = (u, s) => TRIGGERS[u.a.trigger].test(s) || (u.a.secondTrigger && TRIGGERS[u.a.secondTrigger].test(s));
    const ctxFor = (u, sit) => ({ ...sit, defense: u.side !== sit.offense, lead: sit.lead[u.side], away: u.side === 1, playoff: !!opts.playoff });

    const activate = (u, sit) => {
        u.active = true; u.armed = 0; u.counters = {}; u.drivesLeft = u.a.drives; u.activations++;
        log.push([sit.q, sit.clock, u.side, u.p.id, 'zone']);
    };
    const deactivate = (u, sit, why) => { if (!u.active) return; u.active = false; log.push([sit.q, sit.clock, u.side, u.p.id, why || 'off']); };

    /** Multiplier on `stat` for a snap where `offense` has the ball. actors: ids involved. */
    function mult(stat, sit, actors = {}) {
        if (!any) return 1;
        let m = 1;
        for (const side of [0, 1]) {
            for (const u of units[side]) {
                if (!u.active) continue;
                const eff = EFFECTS[u.a.family][u.a.effect];
                const onOffense = side === sit.offense;
                const defensiveUnit = DEFENSIVE_FAMILIES.has(u.a.family);
                if (defensiveUnit === onOffense) continue; // defenders act on the other team's snaps
                const c = ctxFor(u, sit);
                // In the zone he's better everywhere, and at full power in his moment.
                const power = holds(u, c) ? 1 : 0.45;
                let amount = 0;
                const selfHit = !eff.self || actors.qb === u.p.id || actors.carrier === u.p.id || actors.target === u.p.id || actors.kicker === u.p.id;
                if (eff.stat === stat && selfHit) amount += u.a.magnitude * eff.scale;
                else if (eff.bonus?.stat === stat && selfHit) amount += u.a.magnitude * (eff.bonus.mult || 1) * (BONUS_SCALE[stat] || 1);
                else if (u.a.twist.id === 'spark' && eff.stat === stat && !selfHit) amount += u.a.magnitude * eff.scale * 0.5;
                if (!amount) continue;
                amount *= power;
                if (u.a.twist.id === 'ice' && (sit.q >= 4) && sit.clock <= 120) amount *= 2;
                m *= Math.max(0.3, Math.min(2.2, 1 + eff.dir * amount));
                u.fired++;
            }
        }
        // Momentum: the offense rides a teammate's zone touchdown for a drive.
        if (boost[sit.offense] > 0 && (stat === 'pCmp' || stat === 'runYds')) m *= 1.03;
        // Aura: the opponent's offense tightens up.
        for (const u of units[1 - sit.offense]) if (u.active && u.a.twist.id === 'aura' && stat === 'pCmp') m *= 0.985;
        return m;
    }

    /** Engine events. ev: { type, side, ids: {qb, target, carrier, defender, kicker}, yards, ... } */
    function event(type, sit, info = {}) {
        if (!any) return;
        for (const side of [0, 1]) {
            for (const u of units[side]) {
                const id = u.p.id;
                const mine = info.player === id || info.qb === id || info.target === id || info.carrier === id || info.defender === id || info.kicker === id;
                const teamEvent = info.side === side;
                const act = u.a.activation;
                // Counter events switch him off.
                if (u.active) {
                    let counter = null;
                    if (u.a.family === 'QB' && info.qb === id && type === 'sack') counter = 'sacked';
                    if (u.a.family === 'QB' && info.qb === id && type === 'int') counter = 'intThrown';
                    if (u.a.family === 'RB' && info.carrier === id && type === 'run' && (info.yards ?? 1) <= 0) counter = 'stuffed';
                    if (u.a.family === 'RB' && info.carrier === id && type === 'fumble') counter = 'fumble';
                    if (u.a.family === 'REC' && info.target === id && type === 'incomplete') counter = 'missedTarget';
                    if (u.a.family === 'OL' && teamEvent && type === 'sack') counter = 'sackAllowed';
                    if (DEFENSIVE_FAMILIES.has(u.a.family) && type === 'td' && info.side !== side) counter = 'oppTd';
                    if (u.a.family === 'K' && info.kicker === id && type === 'fgMiss') counter = 'fgMiss';
                    if (counter) {
                        u.counters[counter] = (u.counters[counter] || 0) + 1;
                        if (u.counters[counter] >= (u.a.counter.counter[counter] || 1)) deactivate(u, sit, 'countered');
                    }
                    if (type === 'td' && info.side === side && (mine || !['QB', 'RB', 'REC', 'K'].includes(u.a.family) || info.byXf === id)) {
                        u.zoneTds++;
                        if (u.a.twist.id === 'momentum') boost[side] = 2;
                    }
                    if (type === 'driveEnd' && info.side === (DEFENSIVE_FAMILIES.has(u.a.family) ? 1 - side : side)) {
                        u.drivesLeft--; if (u.drivesLeft <= 0) deactivate(u, sit, 'off');
                    }
                    continue;
                }
                // Arming.
                let counts = false;
                const streakBreak = (act.streak && ((u.a.family === 'QB' && info.qb === id && (type === 'incomplete' || type === 'sack' || (type === 'completion' && act.ev === 'bigCompletion' && (info.yards || 0) < 15)))
                    || (u.a.family === 'OL' && teamEvent && type === 'run' && (info.yards || 0) < 5)));
                if (streakBreak) { u.armed = 0; continue; }
                switch (act.ev) {
                    case 'bigCompletion': counts = type === 'completion' && info.qb === id && (info.yards || 0) >= 15; break;
                    case 'completion': counts = type === 'completion' && info.qb === id; break;
                    case 'passTd': counts = type === 'td' && info.qb === id; break;
                    case 'bigRun': counts = type === 'run' && info.carrier === id && (info.yards || 0) >= 20; break;
                    case 'firstDownRun': counts = type === 'run' && info.carrier === id && info.firstDown; break;
                    case 'rushTd': counts = type === 'td' && info.carrier === id; break;
                    case 'catch': counts = type === 'completion' && info.target === id; break;
                    case 'bigCatch': counts = type === 'completion' && info.target === id && (info.yards || 0) >= 25; break;
                    case 'recTd': counts = type === 'td' && info.target === id; break;
                    case 'cleanDrive': counts = type === 'driveEnd' && teamEvent && (info.plays || 0) >= 8 && !info.sacked; break;
                    case 'goodRun': counts = type === 'run' && teamEvent && (info.yards || 0) >= 5; break;
                    case 'sack': counts = type === 'sack' && info.defender === id; break;
                    case 'tfl': counts = type === 'tfl' && info.defender === id; break;
                    case 'threeOut': counts = type === 'driveEnd' && info.side !== side && (info.plays || 0) <= 3 && !info.scored; break;
                    case 'pd': counts = type === 'pd' && info.defender === id; break;
                    case 'int': counts = type === 'int' && info.defender === id; break;
                    case 'longFg': counts = type === 'fgMade' && info.kicker === id && (info.yards || 0) >= 40; break;
                    case 'kickMade': counts = (type === 'fgMade' || type === 'xpMade') && info.kicker === id; break;
                    default: break;
                }
                if (act.drive && type === 'driveEnd' && info.side === side) u.armed = 0;
                if (!counts) continue;
                u.armed++;
                const need = Math.max(1, act.n - (u.a.twist.id === 'clutchGene' && opts.playoff ? 1 : 0));
                if (u.armed >= need) activate(u, sit);
                else if (u.armed === need - 1) log.push([sit.q, sit.clock, u.side, u.p.id, 'armed']);
            }
        }
        if (type === 'driveEnd' && boost[info.side] > 0) boost[info.side]--;
    }

    function summary() {
        return units.flat().map(u => ({ id: u.p.id, name: u.p.name, side: u.side, ability: u.a.name, activations: u.activations, fired: u.fired, zoneTds: u.zoneTds }));
    }
    const isActive = (side, id) => units[side].some(u => u.p.id === id && u.active);
    const anyActive = side => units[side].some(u => u.active);
    return { any, mult, event, summary, log, isActive, anyActive, units };
}
