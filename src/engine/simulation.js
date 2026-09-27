// NFL game simulation — team setup and the public entry point.
//
// The snap-by-snap engine lives in gameEngine.js: it plays each game as a
// real sequence of downs, drives and kicks and credits every play to the
// players involved, so the conservation rules below hold by construction:
//   Σ receiver.receptions = QB completions       (exact)
//   Σ receiver.recYards   = QB gross pass yards   (exact)
//   Σ receiver.recTds     = QB passing TDs        (exact)
//   Each QB sack  → 1 specific DL/LB pass rusher
//   Each QB INT   → 1 specific CB/S/LB defender
//   Team tackles  → credited play by play
//
// NFL per-team-per-game calibration targets (2022-24 league averages):
//   Scoring: 22.5 points, 333 total yards
//   Passing: 36 dropbacks, 2.3 sacks, 33.7 att, 22.1 comp (65.5%), 237 gross
//            yards (7.03 gross Y/A), 222 net, 1.55 pass TD, 0.74 INT
//   Rushing: 26.5 team carries, 4.3 YPC, 0.90 rush TD
//   Defense: ~63 combined tackles, 2.3 sacks, 0.74 INTs
// Season-leader targets the distribution code is tuned against:
//   4,800 pass yds / 40 pass TD / 1,750 rush yds / 17 rush TD / 1,750 rec yds
//   120 rec / 15 rec TD / 19 sacks / 170 tackles / 8 INT

import { calculateTeamRatings } from './ratings.js';
import { playGame, LG } from './gameEngine.js';
export { calculateTeamRatings };

// ── PLAYBOOK BONUSES ──────────────────────────────────────────────────────────

function applyPlaybookBonuses(ratings, bonuses) {
    if (!bonuses) return;
    const clamp = v => Math.max(1, Math.min(99, Math.round(v)));
    if (bonuses.passingBoost) {
        ratings.offense.skill   = clamp(ratings.offense.skill   + bonuses.passingBoost);
        ratings.offense.overall = clamp(ratings.offense.overall + bonuses.passingBoost * 0.5);
    }
    if (bonuses.rushingBoost) {
        ratings.offense.ol      = clamp(ratings.offense.ol      + bonuses.rushingBoost);
        ratings.offense.overall = clamp(ratings.offense.overall + bonuses.rushingBoost * 0.3);
    }
    if (bonuses.defenseBoost) {
        ratings.defense.front7    = clamp(ratings.defense.front7    + bonuses.defenseBoost);
        ratings.defense.secondary = clamp(ratings.defense.secondary + bonuses.defenseBoost * 0.8);
        ratings.defense.overall   = clamp(ratings.defense.overall   + bonuses.defenseBoost * 0.9);
    }
    if (bonuses.moraleBoost) {
        const m = bonuses.moraleBoost;
        ratings.offense.overall = clamp(ratings.offense.overall + m);
        ratings.offense.skill   = clamp(ratings.offense.skill   + m * 0.6);
        ratings.defense.overall = clamp(ratings.defense.overall + m * 0.8);
    }
}

// ── WEATHER ───────────────────────────────────────────────────────────────────

const DOME_TEAMS = new Set([
    'cardinals', 'falcons', 'cowboys', 'lions', 'texans', 'colts', 'raiders', 'vikings', 'saints', 'rams', 'chargers',
]);

function generateWeather(homeTeam) {
    if (DOME_TEAMS.has(homeTeam?.id)) {
        return { type: 'Dome', icon: '🏟️', passMultiplier: 1.0, rushMultiplier: 1.0, scoreMultiplier: 1.0 };
    }
    const roll = Math.random() * 100;
    if (roll < 45) return { type: 'Clear',      icon: '☀️',  passMultiplier: 1.00, rushMultiplier: 1.00, scoreMultiplier: 1.00 };
    if (roll < 62) return { type: 'Cloudy',     icon: '⛅',  passMultiplier: 0.97, rushMultiplier: 1.00, scoreMultiplier: 0.98 };
    if (roll < 76) return { type: 'Rain',       icon: '🌧️', passMultiplier: 0.88, rushMultiplier: 1.05, scoreMultiplier: 0.92 };
    if (roll < 86) return { type: 'Heavy Rain', icon: '⛈️', passMultiplier: 0.78, rushMultiplier: 1.08, scoreMultiplier: 0.85 };
    if (roll < 93) return { type: 'Snow',       icon: '❄️',  passMultiplier: 0.82, rushMultiplier: 1.03, scoreMultiplier: 0.87 };
    if (roll < 97) return { type: 'Blizzard',   icon: '🌨️', passMultiplier: 0.68, rushMultiplier: 1.10, scoreMultiplier: 0.78 };
    return             { type: 'Wind',       icon: '💨',  passMultiplier: 0.84, rushMultiplier: 1.04, scoreMultiplier: 0.90 };
}

// ── MAIN GAME ENTRY ───────────────────────────────────────────────────────────

// options.allowTie: false for postseason games, where overtime must produce a winner.
// options.homePlan / awayPlan: coaching plans (see gamePlan.js) for either side.
export function simulateGame(homeTeam, awayTeam, homeRoster, awayRoster, homeBonuses = null, awayBonuses = null, options = {}) {
    const allowTie = options.allowTie !== false;
    const homeState = initializeTeamState(homeTeam, homeRoster.filter(p => !p.injured));
    const awayState = initializeTeamState(awayTeam, awayRoster.filter(p => !p.injured));

    applyPlaybookBonuses(homeState.ratings, homeBonuses);
    applyPlaybookBonuses(awayState.ratings, awayBonuses);

    const weather = generateWeather(homeTeam);
    const game = playGame(homeState, awayState, {
        weather, allowTie, homePlan: options.homePlan, awayPlan: options.awayPlan,
    });
    const [hScore, aScore] = game.score;

    return {
        homeTeam, awayTeam,
        homeScore: hScore, awayScore: aScore,
        weather,
        overtime:        game.overtime,
        winner:          hScore === aScore ? null : hScore > aScore ? homeTeam : awayTeam,
        homeStats:       game.teamStats[0],
        awayStats:       game.teamStats[1],
        homePlayerStats: slimPlayerStats(homeState.stats),
        awayPlayerStats: slimPlayerStats(awayState.stats),
        // Game flow: score by quarter (a fifth column is overtime), every
        // scoring play in order, and the full play-by-play with its name table.
        quarters:        game.quarters,
        scoringLog:      game.scoringLog,
        pbp:             { plays: game.plays, names: game.names, form: game.form, plans: game.plans, xf: game.xfLog },
        xfactor:         game.xfactor,
    };
}

// Every stat line carried a full copy of its player — attributes, contract,
// OVR history and all. Those box scores are kept on the schedule for the whole
// save, so a season serialized ~29,000 duplicate player objects and pushed the
// save past 40MB, well beyond the localStorage quota: saving failed silently
// from midway through year one. Box scores now keep only the fields their
// readers actually use; everything else is looked up from the live roster.
// Zero-valued counters are dropped too: most of a 53-man roster records
// nothing in a given game, and 24 zeroes per line is the bulk of what is left
// once the player object is gone. Every reader already defaults a missing
// counter to 0.
function slimPlayerStats(stats) {
    const out = {};
    for (const [id, line] of Object.entries(stats)) {
        const p = line.player;
        const slim = { player: p && { id: p.id, name: p.name, position: p.position, ovr: p.ovr, devTrait: p.devTrait } };
        let recorded = false;
        for (const [key, value] of Object.entries(line)) {
            if (key === 'player' || !value) continue;
            slim[key] = value;
            recorded = true;
        }
        // A player who did nothing all game needs no line at all.
        if (recorded) out[id] = slim;
    }
    return out;
}

// ── TEAM STATE INITIALIZATION ─────────────────────────────────────────────────

// Depth chart, built in one pass instead of re-filtering the roster on every
// snap of every game. Defensive leaderboards are driven off the rotation
// players only — in the NFL a team's 6th corner does not accumulate picks, and
// letting the full 53 share the pool flattened every leaderboard.
const ROTATION_DEPTH = { QB: 2, RB: 3, WR: 5, TE: 3, OL: 6, DL: 5, LB: 5, CB: 5, S: 3, K: 1, P: 1 };

// Stand-in for a roster with nobody on it at all. simulateOffense reads
// depth.qb.attributes unconditionally, so an empty roster used to throw a
// TypeError mid-week instead of simulating a replacement-level offense.
const EMERGENCY_QB = {
    id: 'emergency-qb', name: 'Emergency QB', position: 'QB', ovr: 50,
    attributes: { position: {}, universal: {} },
};

function buildDepthChart(roster) {
    const byPos = {};
    for (const p of roster) (byPos[p.position] ||= []).push(p);
    for (const pos of Object.keys(byPos)) {
        byPos[pos].sort((a, b) => Number(!!b.weeklyStarter) - Number(!!a.weeklyStarter) || (b.ovr || 0) - (a.ovr || 0));
        const cap = ROTATION_DEPTH[pos];
        if (cap) byPos[pos] = byPos[pos].slice(0, cap);
    }
    const g = pos => byPos[pos] || [];
    return {
        qb: g('QB')[0] || EMERGENCY_QB,
        rbs: g('RB'),
        wrs: g('WR'),
        tes: g('TE'),
        ol: roster.filter(p => ['OL', 'C', 'OG', 'OT', 'G', 'T'].includes(p.position))
                  .sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).slice(0, 6),
        kicker: g('K')[0] || null,
        rushers: [...g('DL'), ...g('LB')],
        coverage: [...g('CB'), ...g('S'), ...g('LB').slice(0, 3)],
        tacklers: [...g('DL'), ...g('LB'), ...g('CB'), ...g('S')],
        front7: [...g('DL'), ...g('LB')],
    };
}

// A roster is rebuilt as a new array whenever the store changes it, so keying
// on array identity is a safe cache: ratings, depth chart and pass identity are
// derived once per roster version instead of once per game (17x per season).
const teamProfileCache = new WeakMap();

function teamProfile(roster) {
    // Fingerprint guards against a caller editing a roster in place: any change
    // to size or to a player's OVR invalidates the cached derivation.
    let stamp = roster.length;
    for (let i = 0; i < roster.length; i++) stamp = (stamp * 31 + (roster[i].ovr || 0) + (roster[i].weeklyStarter ? 100 : 0)) | 0;

    const cached = teamProfileCache.get(roster);
    if (cached && cached.stamp === stamp) return cached.profile;

    const profile = buildTeamProfile(roster);
    teamProfileCache.set(roster, { stamp, profile });
    return profile;
}

function initializeTeamState(team, roster) {
    const { ratings, depth, passLean } = teamProfile(roster);
    const stats = {};
    // The depth chart can hand back a stand-in who is not on the roster (an
    // empty roster yields EMERGENCY_QB), and the sim writes to that player's
    // stat line unconditionally — so give everyone it might name a line.
    const statted = depth.qb && !roster.includes(depth.qb) ? [...roster, depth.qb] : roster;
    statted.forEach(p => {
        stats[p.id] = {
            player: p,
            // Passing
            attempts: 0, completions: 0, yards: 0, tds: 0, ints: 0, sacks: 0,
            // Rushing
            carries: 0, rushYards: 0, rushTds: 0, fumbles: 0,
            // Receiving
            targets: 0, receptions: 0, recYards: 0, recTds: 0,
            // Defense
            tackles: 0, tfl: 0, pd: 0, sacksAllowed: 0, pancakes: 0,
            // Misc
            fgm: 0, fga: 0, xpm: 0, xpa: 0, defensiveTds: 0,
        };
    });
    // Playbook bonuses mutate ratings per game, so hand out a private copy.
    return {
        id: team.id, roster, stats, depth, passLean,
        ratings: {
            offense: { ...ratings.offense },
            defense: { ...ratings.defense },
            specialTeams: ratings.specialTeams,
            overall: ratings.overall,
        },
    };
}

function buildTeamProfile(roster) {
    const ratings = calculateTeamRatings(roster);
    const depth   = buildDepthChart(roster);

    // Teams are not identical in how much they throw: over a season the NFL
    // spans roughly 28 to 42 attempts per game, and that spread is most of what
    // separates a 4,900-yard passer from a 3,600-yard one. Redrawing volume
    // from the same distribution every game washed it out entirely, so every
    // team finished the year at the league mean. Bias each team off its own
    // roster instead — a strong arm with a thin backfield throws, a heavy OL
    // and a bell-cow back runs — which holds all season.
    const rbTop = depth.rbs[0]?.ovr || 70;
    // Anchored on the league means so the spread moves volume between teams
    // without moving the league's total play count.
    const passLean = Math.max(-5, Math.min(5,
        (  (ratings.offense.qb    - LG.qbOvr) * 0.34
         + (ratings.offense.skill - LG.skill) * 0.10
         - ((ratings.offense.ol + rbTop) / 2 - (LG.ol + LG.rbOvr) / 2) * 0.30) * 1.25));

    return { ratings, depth, passLean };
}

export function simulateWeek(games) {
    return games.map(game =>
        simulateGame(game.homeTeam, game.awayTeam, game.homeRoster, game.awayRoster)
    );
}
