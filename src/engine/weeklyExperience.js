import { TEAMS } from '../data/teams.js';

const teamMap = new Map(TEAMS.map(t => [t.id, t]));
const finite = value => Number.isFinite(value) ? value : 0;
export const WEEKLY_STRATEGIES = [
    { id: 'aggressive', label: 'Push the offense', description: 'More passing and rushing strength; weaker defense.', effects: '+3 pass · +2 rush · −2 defense · +2 morale rating', bonuses: { passingBoost: 3, rushingBoost: 2, defenseBoost: -2, moraleBoost: 2 } },
    { id: 'balanced', label: 'Trust the system', description: 'Keep your usual strengths without a weekly rating adjustment.', effects: 'No weekly rating adjustments', bonuses: { passingBoost: 0, rushingBoost: 0, defenseBoost: 0, moraleBoost: 0 } },
    { id: 'conservative', label: 'Lean on defense', description: 'Strengthen the defense at the cost of offensive production.', effects: '−2 pass · −1 rush · +4 defense', bonuses: { passingBoost: -2, rushingBoost: -1, defenseBoost: 4, moraleBoost: 0 } },
];
export const weeklyStrategy = id => WEEKLY_STRATEGIES.find(s => s.id === id) || WEEKLY_STRATEGIES[1];
export const weeklyDefaults = () => ({ positionBattle: null, weeklyDecisionHistory: [] });
const upcomingGame = state => state.phase === 'regular'
    ? state.schedule?.[state.week - 1]?.find(g => !g.played && [g.homeTeamId, g.awayTeamId].includes(state.userTeamId)) : null;
const teamName = id => {
    const t = teamMap.get(id);
    return t ? `${t.location} ${t.name}` : id;
};

export function weeklyPreparation(state) {
    const game = upcomingGame(state);
    if (!game) return null;
    const opponentId = game.homeTeamId === state.userTeamId ? game.awayTeamId : game.homeTeamId;
    const opponent = state.teamRatings?.[opponentId];
    const own = state.teamRatings?.[state.userTeamId];
    const attack = opponent?.offense?.overall;
    const defense = opponent?.defense?.overall;
    const facts = [];
    if (Number.isFinite(attack) && Number.isFinite(defense)) {
        facts.push(`${teamName(opponentId)}: offense ${Math.round(attack)}, defense ${Math.round(defense)}.`);
        facts.push(attack > defense + 3
            ? 'Their offense is their stronger unit. Leaning on defense costs you offensive strength; pushing the offense accepts more defensive exposure.'
            : defense > attack + 3
                ? 'Their defense is their stronger unit. Extra offensive strength may help, but you give up some defensive strength to get it.'
                : 'Their units are closely matched. Your roster and appetite for risk should guide the choice.');
    } else facts.push('Opponent ratings are unavailable. Choose the balance that suits your roster.');
    if (Number.isFinite(own?.offense?.ol) && Number.isFinite(opponent?.defense?.passRush)) {
        facts.push(`Your line: ${Math.round(own.offense.ol)} · Their pass rush: ${Math.round(opponent.defense.passRush)}.`);
    }
    return { opponentId, opponentName: teamName(opponentId), gameId: game.id, week: state.week, facts, strategy: weeklyStrategy(state.weekStrategy) };
}

function unavailable(state) {
    return new Set([
        ...(state.injuries || []).filter(i => i.teamId === state.userTeamId && i.weeksRemaining > 0).map(i => i.playerId),
        ...(state.activeBoosts || []).filter(b => b.type === 'rest' && b.weeksLeft > 0).map(b => b.playerId),
    ]);
}
const snapshot = p => ({ id: p.id, name: p.name, position: p.position, age: p.age, ovr: p.ovr });

// One deliberate evaluation per team/season; no manufactured prospect if the roster has no fit.
export function positionBattleCandidate(state) {
    if (!upcomingGame(state) || state.week > 16) return null;
    if (state.positionBattle?.status === 'active' && state.positionBattle.teamId === state.userTeamId && state.positionBattle.year === state.year) return null;
    if ((state.weeklyDecisionHistory || []).some(b => b.teamId === state.userTeamId && b.year === state.year)) return null;
    const out = unavailable(state);
    const roster = (state.rosters?.[state.userTeamId] || []).filter(p => !out.has(p.id));
    for (const position of ['QB', 'RB']) {
        const players = roster.filter(p => p.position === position && Number.isFinite(p.ovr)).sort((a, b) => b.ovr - a.ovr);
        const veteran = players[0];
        if (!veteran || veteran.age < 27) continue;
        const rookie = players.find(p => p.id !== veteran.id && p.age <= 25 && (p.experience ?? 0) <= 2 && veteran.ovr - p.ovr <= 15);
        if (rookie) return { id: `${state.year}:${state.userTeamId}:${position}:${rookie.id}`, teamId: state.userTeamId, year: state.year, position, rookie: snapshot(rookie), veteran: snapshot(veteran) };
    }
    return null;
}

export function choosePositionBattle(state, choice) {
    if (!['rookie', 'veteran'].includes(choice)) return null;
    const candidate = positionBattleCandidate(state);
    if (!candidate) return null;
    const battle = { ...candidate, choice, selectedPlayerId: candidate[choice].id, startedWeek: state.week, status: 'active', games: [], summary: null };
    return { positionBattle: battle, weeklyDecisionHistory: [battle, ...(state.weeklyDecisionHistory || [])].slice(0, 24) };
}

export function positionBattleInterruption(state, battle = state.positionBattle) {
    if (!battle || !['active', 'settled'].includes(battle.status)) return null;
    if (battle.teamId !== state.userTeamId || battle.year !== state.year || state.phase !== 'regular') return 'The evaluation ended when the team or season changed.';
    const roster = state.rosters?.[state.userTeamId] || [];
    const requiredPlayers = battle.status === 'settled' ? [battle.selectedPlayerId] : [battle.rookie.id, battle.veteran.id];
    if (!requiredPlayers.every(id => roster.some(p => p.id === id))) return 'The evaluation ended after a roster move. Normal depth order resumes.';
    if (unavailable(state).has(battle.selectedPlayerId)) return battle.status === 'settled'
        ? 'Your chosen starter is unavailable. Normal depth order is in use until he returns.'
        : 'The selected player is unavailable. The evaluation ended; available players return to normal depth order.';
    return null;
}

export function battleGameRoster(roster, teamId, state) {
    const battle = state.positionBattle;
    if (!battle || !['active', 'settled'].includes(battle.status) || teamId !== state.userTeamId || positionBattleInterruption(state, battle)) return roster;
    if (!roster.some(p => p.id === battle.selectedPlayerId)) return roster;
    // Only the transient game-day roster carries this flag. Ratings and depth agree on the starter.
    return roster.map(p => p.id === battle.selectedPlayerId ? { ...p, weeklyStarter: true } : p);
}

export function battleStatLine(position, stats = {}) {
    if (position === 'QB') return `${finite(stats.completions)}/${finite(stats.attempts)}, ${finite(stats.yards)} pass yards, ${finite(stats.tds)} TD, ${finite(stats.ints)} INT`;
    return `${finite(stats.carries ?? stats.rushAttempts)} carries, ${finite(stats.rushYards)} rush yards, ${finite(stats.rushTds)} TD`;
}

export function weeklyGameReview(state, game) {
    if (!game?.played || ![game.homeTeamId, game.awayTeamId].includes(state.userTeamId)) return null;
    const home = game.homeTeamId === state.userTeamId;
    const own = game.stats?.[home ? 'home' : 'away'] || {};
    const theirs = game.stats?.[home ? 'away' : 'home'] || {};
    const strategy = weeklyStrategy(state.weekStrategy);
    const battle = state.positionBattle;
    const hasRole = ['active', 'settled'].includes(battle?.status);
    const reason = hasRole ? positionBattleInterruption(state, battle) : null;
    const role = hasRole && !reason ? battle[battle.choice] : null;
    return {
        teamId: state.userTeamId, year: state.year, week: state.week,
        strategyId: strategy.id, strategyLabel: strategy.label,
        opponentName: teamName(home ? game.awayTeamId : game.homeTeamId),
        evidence: [`${finite(own.passYards)} passing yards · ${finite(own.rushYards)} rushing yards`, `${finite(own.turnovers)} turnovers · ${home ? game.awayScore : game.homeScore} points allowed`, `Opponent: ${finite(theirs.totalYards ?? theirs.yards)} total yards`],
        note: 'These are observed results, not proof that the plan caused the outcome.',
        battle: role ? { id: battle.id, playerName: role.name, choice: battle.choice, position: battle.position, gameNumber: battle.status === 'active' ? battle.games.length + 1 : null, statLine: battleStatLine(battle.position, game.playerStats?.[home ? 'home' : 'away']?.[role.id]) } : null,
        interruption: reason,
    };
}

export function settlePositionBattle(state, game) {
    const battle = state.positionBattle;
    if (!battle || battle.status !== 'active') return {};
    const reason = positionBattleInterruption(state, battle);
    let next;
    if (reason) next = { ...battle, status: 'interrupted', summary: reason };
    else {
        if (!game?.played || ![game.homeTeamId, game.awayTeamId].includes(state.userTeamId)) return {};
        const key = `${state.year}:${state.week}:${game.id}`;
        if (battle.games.some(g => g.key === key)) return {};
        const home = game.homeTeamId === state.userTeamId;
        const stats = game.playerStats?.[home ? 'home' : 'away']?.[battle.selectedPlayerId] || {};
        const games = [...battle.games, { key, playerName: battle[battle.choice].name, week: state.week, opponentName: teamName(home ? game.awayTeamId : game.homeTeamId), statLine: battleStatLine(battle.position, stats) }];
        const complete = games.length >= 2 || state.week >= 18;
        next = { ...battle, games, status: complete ? 'complete' : 'active', summary: complete
            ? `${battle[battle.choice].name}'s evaluation is complete. Choose who leads this position next. Until you decide, normal depth order resumes. No automatic rating reward.`
            : `${battle[battle.choice].name} has one game left in the evaluation. Bye weeks do not count.` };
    }
    return { positionBattle: next, weeklyDecisionHistory: [next, ...(state.weeklyDecisionHistory || []).filter(b => b.id !== next.id)].slice(0, 24) };
}

// The evaluation pays off in a roster decision; it does not hand out an OVR prize.
export function resolvePositionBattle(state, choice) {
    const battle = state.positionBattle;
    if (!battle || !['complete', 'settled'].includes(battle.status) || !['rookie', 'veteran', 'auto'].includes(choice) || !upcomingGame(state)) return null;
    if (battle.teamId !== state.userTeamId || battle.year !== state.year) return null;
    const player = choice === 'auto' ? null : battle[choice];
    if (player && !(state.rosters?.[state.userTeamId] || []).some(p => p.id === player.id)) return null;
    if (player && unavailable(state).has(player.id)) return null;
    const next = { ...battle, status: choice === 'auto' ? 'complete' : 'settled',
        ...(player ? { choice, selectedPlayerId: player.id } : {}),
        summary: player ? `${player.name} will lead the ${battle.position} depth chart while available for the rest of this regular season. You can change this decision.` : 'Normal depth order is in use. You can still choose a starter for this regular season.' };
    return { positionBattle: next, weeklyDecisionHistory: [next, ...(state.weeklyDecisionHistory || []).filter(b => b.id !== next.id)].slice(0, 24) };
}
