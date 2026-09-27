// League draft projections (Claude-owned): a deterministic mock draft over the
// real (or projected) draft order. Used by the Big Board and the Draft Room.
import { TEAMS } from '../data/teams.js';
import { draftTeamOrder } from './draftExperience.js';
import { mockDraft } from './scouting.js';

export function projectedOrder(state) {
    if (state.phase === 'draft' && state.draftOrder?.length) return state.draftOrder.map(o => o.teamId);
    const base = draftTeamOrder(TEAMS, state.standings || {}, state.schedule || [], state.playoffBracket);
    return Array.from({ length: 7 }, () => base).flat();
}

const STYLES = Object.fromEntries(TEAMS.map(t => [t.id, t.draftStyle]));
export const projectClass = (state, draftClass) => mockDraft(draftClass, projectedOrder(state), state.rosters, STYLES);
