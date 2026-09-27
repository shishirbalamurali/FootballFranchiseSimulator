// Coaching plans: how a staff wants to play this week, as the game engine
// reads it (see gameEngine.js normalizePlan).
//
//   passTilt      shifts the run/pass mix (+0.05 ≈ three more dropbacks)
//   aggression    scales fourth-down and two-point appetite (1 = league norm)
//   deepShots     trades completion rate for explosive plays
//   clockControl  how hard a lead gets milked
//
// Every team has an identity from its scheme; the user's weekly strategy
// choice layers on top. The same plan objects are what the broadcast shows
// ("Push the offense: going for it on 4th & 2").

import { PLAYBOOK_MAP, TEAM_PLAYBOOK_MAP } from '../data/playbooks.js';
import { weeklyStrategy } from './weeklyExperience.js';
import { OFFENSE_SCHEMES } from './schemes.js'; // CLAUDE: coordinator schemes
import { gameContext, engineContext, compactContext } from './gameContext.js';

// League-average (passingBoost − rushingBoost) across the 32 schemes, so the
// tilt moves teams relative to each other without moving league volume.
const SCHEME_TILT_MEAN = 2.2;

const STRATEGY_PLAN = {
    aggressive:   { passTilt: 0.05,  aggression: 2.0,  deepShots: 0.05,  clockControl: 0 },
    balanced:     { passTilt: 0,     aggression: 1.0,  deepShots: 0,     clockControl: 0.3 },
    conservative: { passTilt: -0.06, aggression: 0.6,  deepShots: -0.03, clockControl: 0.9 },
};

function schemeTilt(playbookId) {
    const b = PLAYBOOK_MAP[playbookId]?.bonuses;
    if (!b) return 0;
    return Math.max(-0.09, Math.min(0.09, (((b.passingBoost || 0) - (b.rushingBoost || 0)) - SCHEME_TILT_MEAN) / 180));
}

/** The plan a team brings into this week's game. */
// A coordinator's scheme leans the play-calling (see schemes.js, staffCareers.js).
function identityLean(state, teamId) {
    const o = OFFENSE_SCHEMES[state?.frontOffice?.identities?.[teamId]?.offense];
    return o ? { passTilt: o.passTilt * 0.6, deepShots: o.deepShots || 0 } : { passTilt: 0, deepShots: 0 };
}

const schemeForId = state => {
    const sf = state?.frontOffice?.schemeFor;
    return sf && sf.year === state.year && sf.week === state.week ? sf.playerId : null;
};

export function gamePlanFor(state, teamId) {
    if (!teamId) return null;
    const lean = identityLean(state, teamId);
    if (teamId !== state?.userTeamId) {
        const tilt = schemeTilt(TEAM_PLAYBOOK_MAP[teamId]) + lean.passTilt;
        return tilt || lean.deepShots ? { passTilt: tilt, aggression: 1, deepShots: lean.deepShots, clockControl: 0.3, label: null } : null;
    }
    const strategy = weeklyStrategy(state.weekStrategy);
    const base = STRATEGY_PLAN[strategy.id] || STRATEGY_PLAN.balanced;
    return {
        ...base,
        passTilt: base.passTilt + schemeTilt(state.userPlaybookId || TEAM_PLAYBOOK_MAP[teamId]) + lean.passTilt,
        deepShots: base.deepShots + lean.deepShots,
        label: strategy.label,
        strategyId: strategy.id,
        // Weekly prep: scheme for an opposing X-Factor (see xFactor.js).
        focusId: schemeForId(state),
    };
}

/**
 * Both sides' plans, in the shape simulateGame's options take — plus the game
 * context (division, rivalry, stage, prime time, stakes; see gameContext.js),
 * which rides along so the store's sim actions need no changes to use it.
 */
export function gamePlans(state, homeId, awayId) {
    let context = null;
    try {
        const ctx = gameContext(state, homeId, awayId);
        if (ctx) context = { ...ctx, engine: engineContext(ctx) };
    } catch { context = null; }
    return { homePlan: gamePlanFor(state, homeId), awayPlan: gamePlanFor(state, awayId), context };
}

/**
 * What a schedule row keeps from a simulated game. Every game keeps its score
 * by quarter and its scoring plays (a few dozen bytes) so the scoreboard can
 * replay it truthfully; the user's own game also keeps the full play-by-play
 * for the broadcast and the post-game recap.
 */
export function gameDetailFields(result, isUserGame) {
    if (!result?.quarters) return {};
    const out = { quarters: result.quarters, scoringLog: result.scoringLog || [] };
    // ~30 bytes on every game: spread, division, rivalry, slot, stage — so any
    // screen can call an upset after the fact.
    const ctx = compactContext(result.context);
    if (ctx) out.ctx = ctx;
    if (isUserGame && result.pbp) {
        // The user's broadcast also gets the full storyline (records, stakes, tags).
        const { engine: _engine, ...story } = result.context || {};
        out.pbp = result.context ? { ...result.pbp, ctx: story } : result.pbp;
    }
    // X-Factor moments: who got in the zone (tiny; every game keeps it).
    if (result.xfactor?.length) out.xf = result.xfactor.filter(x => x.activations > 0).map(x => [x.id, x.side, x.activations, x.zoneTds]);
    return out;
}
