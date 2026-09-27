import { TEAMS } from '../data/teams.js';

const identities = new Map(TEAMS.map(team => [team.id, team]));

// Persisted team objects may include standings or awards. Refresh only their
// identity fields; stable IDs and gameplay/history fields must survive intact.
export function refreshTeamIdentity(team) {
    const current = identities.get(team?.id);
    return current ? { ...team, ...current } : team;
}

function refreshRecap(recap) {
    if (!recap?.champion || typeof recap.champion !== 'object') return recap;
    return { ...recap, champion: refreshTeamIdentity(recap.champion) };
}

export function refreshSavedTeamBranding(saved) {
    if (!saved) return saved;
    const previous = new Map((Array.isArray(saved.teams) ? saved.teams : []).map(team => [team?.id, team]));
    return {
        ...saved,
        teams: TEAMS.map(team => refreshTeamIdentity(previous.get(team.id) ?? team)),
        // A few older/debug saves embedded team names inside standings rows.
        ...(saved.standings ? { standings: Object.fromEntries(Object.entries(saved.standings).map(([id, row]) => [
            id, row && (row.name || row.location || row.theme) ? refreshTeamIdentity({ ...row, id }) : row,
        ])) } : {}),
        seasonRecap: refreshRecap(saved.seasonRecap),
        seasonHistory: (saved.seasonHistory || []).map(season => ({
            ...season,
            ...(season.champion && typeof season.champion === 'object'
                ? { champion: refreshTeamIdentity(season.champion) } : {}),
            ...(season.seasonRecap ? { seasonRecap: refreshRecap(season.seasonRecap) } : {}),
        })),
    };
}
