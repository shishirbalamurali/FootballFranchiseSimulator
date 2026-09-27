// Draft-pick ownership across years (Claude-owned). Pure functions.
//
// draftPickOwners: { teamId: [{ year, round, originalTeamId, comp? }] }.
// Clubs hold their picks for the next two drafts. Old saves had no `year`;
// those picks belong to the upcoming draft.
import { pickKey } from './draftExperience.js';

const ROUNDS = [1, 2, 3, 4, 5, 6, 7];

/** Stamp missing years and make sure every club holds `draftYear` and `draftYear + 1`. */
export function ensurePickYears(owners = {}, teamIds = [], draftYear) {
    const next = {};
    const held = new Set();
    for (const id of teamIds) {
        next[id] = (owners[id] || []).map(p => (p.year ? p : { ...p, year: draftYear }));
        next[id].forEach(p => held.add(pickKey(p)));
    }
    for (const year of [draftYear, draftYear + 1]) {
        for (const id of teamIds) {
            for (const round of ROUNDS) {
                const pick = { year, round, originalTeamId: id };
                if (!held.has(pickKey(pick))) { next[id].push(pick); held.add(pickKey(pick)); }
            }
        }
    }
    return next;
}

/** After a draft: drop that year's picks, add the new far year. */
export function rollPicks(owners = {}, teamIds = [], usedYear) {
    const next = {};
    for (const id of teamIds) next[id] = (owners[id] || []).filter(p => (p.year ?? usedYear) > usedYear);
    return ensurePickYears(next, teamIds, usedYear + 1);
}

export const picksForYear = (picks = [], year) => picks.filter(p => (p.year ?? year) === year);

/** Who owns a given original pick: returns teamId or the original team. */
export function ownerOf(owners = {}, originalTeamId, round, year) {
    for (const [teamId, picks] of Object.entries(owners)) {
        if ((picks || []).some(p => p.originalTeamId === originalTeamId && p.round === round && (p.year ?? year) === year && !p.comp)) return teamId;
    }
    return originalTeamId;
}

/**
 * Compensatory picks from the free-agent log: clubs that lost more qualifying
 * free agents than they signed get R3-R7 picks next draft (max 4).
 * log rows: { kind: 'user'|'rival', teamId, from, ovr }
 */
export function compPicks(log = [], draftYear) {
    const lost = {}, gained = {};
    for (const row of log) {
        if (!(row.kind === 'user' || row.kind === 'rival') || !row.from || row.from === row.teamId || (row.ovr || 0) < 70) continue;
        (lost[row.from] ||= []).push(row.ovr);
        gained[row.teamId] = (gained[row.teamId] || 0) + 1;
    }
    const out = {};
    for (const [teamId, ovrs] of Object.entries(lost)) {
        const net = ovrs.length - (gained[teamId] || 0);
        if (net <= 0) continue;
        out[teamId] = ovrs.sort((a, b) => b - a).slice(0, Math.min(4, net)).map((ovr, i) => ({ year: draftYear, round: ovr >= 85 ? 3 : ovr >= 80 ? 4 : ovr >= 75 ? 5 : 6, originalTeamId: teamId, comp: i + 1 }));
    }
    return out;
}

/** Compact on-disk form: [year, round, originalTeamId, comp] rows per team. */
export function packPicks(owners) {
    if (!owners || owners.format) return owners;
    return { format: 'picks-v1', rows: Object.fromEntries(Object.entries(owners).map(([t, picks]) => [t, (picks || []).map(p => [p.year || 0, p.round, p.originalTeamId, p.comp || 0])])) };
}
export function unpackPicks(data) {
    if (!data || data.format !== 'picks-v1') return data || {};
    return Object.fromEntries(Object.entries(data.rows).map(([t, rows]) => [t, rows.map(([year, round, originalTeamId, comp]) => ({ ...(year ? { year } : {}), round, originalTeamId, ...(comp ? { comp } : {}) }))]));
}
