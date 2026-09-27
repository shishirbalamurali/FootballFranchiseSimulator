import { TEAMS } from '../data/teams.js';

const teamId = team => typeof team === 'string' ? team : team?.id;
const teamFor = team => TEAMS.find(t => t.id === teamId(team));

// Compact, score-only history; no player stats or box scores are duplicated.
// [home id, away id, home score, away score, stage]
export function rivalryGames(schedule = [], playoffBracket = null) {
    const rows = [];
    const add = (game, stage) => {
        if (!game?.played || !game.homeTeamId || !game.awayTeamId
            || !Number.isFinite(game.homeScore) || !Number.isFinite(game.awayScore)) return;
        rows.push([game.homeTeamId, game.awayTeamId, game.homeScore, game.awayScore, stage]);
    };
    (schedule || []).flat().forEach(game => add(game, 'regular'));
    for (const conf of ['afc', 'nfc']) {
        for (const round of ['wc', 'div', 'conf']) {
            const games = playoffBracket?.[conf]?.[round] || [];
            (Array.isArray(games) ? games : [games]).forEach(game => add(game, round));
        }
    }
    add(playoffBracket?.sb, 'sb');
    return rows;
}

function recordedGames(state) {
    const history = state.seasonHistory || [];
    const rows = [];
    for (const entry of history) {
        if (Array.isArray(entry.rivalryGames)) rows.push(...entry.rivalryGames);
        else {
            // Old saves retain only the championship result. Count that known
            // meeting, without inventing a score or other playoff eliminations.
            const recap = entry.seasonRecap;
            if (recap?.winner && recap?.finalist) rows.push([recap.winner, recap.finalist, 1, 0, 'legacy-sb']);
        }
    }
    const live = rivalryGames(state.schedule, state.playoffBracket);
    const last = history.at(-1);
    // The completed schedule remains live through free agency. Do not count it
    // twice, including when consumers omit year from the supplied context.
    const archivedLive = last?.rivalryGames;
    const alreadyArchived = archivedLive && (state.year == null || state.year === last.year) && live.length > 0 && live.length === archivedLive.length
        && JSON.stringify(live) === JSON.stringify(archivedLive);
    if (!alreadyArchived) {
        for (const row of live) {
            const recap = last?.seasonRecap;
            if (!archivedLive && row[4] === 'sb' && last?.year === state.year
                && [row[0], row[1]].includes(recap?.winner)
                && [row[0], row[1]].includes(recap?.finalist)) continue;
            rows.push(row);
        }
    }
    return rows;
}

export function rivalryFor(teamA, teamB, state = {}) {
    const a = teamFor(teamA), b = teamFor(teamB);
    const h2h = { wins: 0, losses: 0, ties: 0 };
    const reasons = [];
    if (!a || !b || a.id === b.id) return { level: 0, label: 'Matchup', reasons, h2h };
    const division = a.conference === b.conference && a.division === b.division;
    let close = 0, playoff = 0;
    for (const row of recordedGames(state)) {
        if (!Array.isArray(row)) continue;
        const [home, away, hs, as, stage] = row;
        if (!((home === a.id && away === b.id) || (away === a.id && home === b.id))) continue;
        if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
        const difference = home === a.id ? hs - as : as - hs;
        if (difference > 0) h2h.wins++;
        else if (difference < 0) h2h.losses++;
        else h2h.ties++;
        if (stage !== 'legacy-sb' && Math.abs(difference) <= 8) close++;
        if (stage !== 'regular' && difference !== 0) playoff++;
    }
    if (division) reasons.push('Division rivals');
    if (close) reasons.push(`${close} one-score meeting${close === 1 ? '' : 's'}`);
    if (playoff) reasons.push(`${playoff} playoff elimination${playoff === 1 ? '' : 's'}`);
    const heat = Number(division) + Math.min(2, close) + playoff * 2;
    const level = heat >= 5 ? 3 : heat >= 2 ? 2 : heat >= 1 ? 1 : 0;
    return { level, label: ['Matchup', 'Rivalry', 'Heated rivalry', 'Bitter rivalry'][level], reasons, h2h };
}

export function topRivals(team, state = {}, n = 3) {
    const id = teamId(team);
    if (!teamFor(id) || !Number.isFinite(n) || n <= 0) return [];
    return TEAMS.filter(t => t.id !== id)
        .map(opponent => ({ teamId: opponent.id, opponent, ...rivalryFor(id, opponent.id, state) }))
        .filter(rivalry => rivalry.level > 0)
        .sort((a, b) => b.level - a.level
            || (b.h2h.wins + b.h2h.losses + b.h2h.ties) - (a.h2h.wins + a.h2h.losses + a.h2h.ties)
            || a.teamId.localeCompare(b.teamId))
        .slice(0, Math.floor(n));
}
