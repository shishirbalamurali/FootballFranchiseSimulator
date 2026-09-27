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

// League-average (passingBoost − rushingBoost) across the 32 schemes, so the
// tilt moves teams relative to each other without moving league volume.
const SCHEME_TILT_MEAN = 2.2;

const STRATEGY_PLAN = {
    aggressive:   { passTilt: 0.05,  aggression: 1.75, deepShots: 0.05,  clockControl: 0 },
    balanced:     { passTilt: 0,     aggression: 1.0,  deepShots: 0,     clockControl: 0.3 },
    conservative: { passTilt: -0.06, aggression: 0.6,  deepShots: -0.03, clockControl: 0.9 },
};

function schemeTilt(playbookId) {
    const b = PLAYBOOK_MAP[playbookId]?.bonuses;
    if (!b) return 0;
    return Math.max(-0.09, Math.min(0.09, (((b.passingBoost || 0) - (b.rushingBoost || 0)) - SCHEME_TILT_MEAN) / 180));
}

/** The plan a team brings into this week's game. */
export function gamePlanFor(state, teamId) {
    if (!teamId) return null;
    if (teamId !== state?.userTeamId) {
        const tilt = schemeTilt(TEAM_PLAYBOOK_MAP[teamId]);
        return tilt ? { passTilt: tilt, aggression: 1, deepShots: 0, clockControl: 0.3, label: null } : null;
    }
    const strategy = weeklyStrategy(state.weekStrategy);
    const base = STRATEGY_PLAN[strategy.id] || STRATEGY_PLAN.balanced;
    return {
        ...base,
        passTilt: base.passTilt + schemeTilt(state.userPlaybookId || TEAM_PLAYBOOK_MAP[teamId]),
        label: strategy.label,
        strategyId: strategy.id,
    };
}

/** Both sides' plans, in the shape simulateGame's options take. */
export function gamePlans(state, homeId, awayId) {
    return { homePlan: gamePlanFor(state, homeId), awayPlan: gamePlanFor(state, awayId) };
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
    if (isUserGame && result.pbp) out.pbp = result.pbp;
    // X-Factor moments: who got in the zone (tiny; every game keeps it).
    if (result.xfactor?.length) out.xf = result.xfactor.filter(x => x.activations > 0).map(x => [x.id, x.side, x.activations, x.zoneTds]);
    return out;
}
