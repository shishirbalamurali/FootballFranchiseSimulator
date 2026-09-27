// Shared non-component helpers for the player card family (Claude-owned).
export const TONE_VAR = {
    danger: 'var(--status-danger)', warning: 'var(--status-warning)', positive: 'var(--status-positive)',
    info: 'var(--status-info)', neutral: 'var(--status-neutral)', xfactor: 'var(--xfactor)',
};
export const TONE_BADGE = { danger: 'negative', warning: 'warning', positive: 'positive', info: 'info', neutral: 'neutral', xfactor: 'solid' };
export const TONE_TEXT = { danger: 'text-negative-fg', warning: 'text-warning-fg', positive: 'text-positive-fg', info: 'text-info-fg', neutral: 'text-fg-muted', xfactor: 'xf-text' };
export const TONE_BG = { danger: 'bg-negative-bg', warning: 'bg-warning-bg', positive: 'bg-positive-bg', info: 'bg-info-bg', neutral: 'bg-surface-sunken', xfactor: 'bg-xfactor-wash' };

export const prettify = k => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/_/g, ' ').trim();

/** The three stats that matter for a position this season, as [label, value]. */
export function keyStats(player) {
    const s = player?.stats?.season || {};
    const g = s.gamesPlayed || s.games || null;
    switch (player?.position) {
        case 'QB': return [['Pass yds', s.yards || 0], ['TD', s.tds || 0], ['INT', s.ints || 0]];
        case 'RB': return [['Rush yds', s.rushYards || 0], ['TD', (s.rushTds || 0) + (s.recTds || 0)], ['Rec', s.receptions || 0]];
        case 'WR': case 'TE': return [['Rec yds', s.recYards || 0], ['Rec', s.receptions || 0], ['TD', s.recTds || 0]];
        case 'OL': return [['Sacks allowed', s.sacksAllowed || 0], ['Pancakes', s.pancakes || 0], ['Games', g ?? '—']];
        case 'DL': case 'LB': return [['Tackles', s.tackles || 0], ['Sacks', s.sacks || 0], ['TFL', s.tfl || 0]];
        case 'CB': case 'S': return [['INT', s.ints || 0], ['PD', s.pd || 0], ['Tackles', s.tackles || 0]];
        case 'K': case 'P': return [['FG', `${s.fgm || 0}/${s.fga || 0}`], ['XP', `${s.xpm || 0}/${s.xpa || 0}`], ['Games', g ?? '—']];
        default: return [];
    }
}

/** The position's three defining attributes, from the player's attribute sheet. */
export const KEY_ATTRS = {
    QB: ['accuracy', 'arm', 'processing'], RB: ['exp', 'eff', 'vol'], WR: ['routeRun', 'catching', 'deepThreat'],
    TE: ['catching', 'routeRun', 'runBlock'], OL: ['passBlock', 'runBlock', 'awarenessOL'], DL: ['blockShedding', 'powerMoves', 'finesseMoves'],
    LB: ['tackle', 'pursuit', 'coverage'], CB: ['manCoverage', 'zoneCoverage', 'press'], S: ['range', 'coverage', 'tackle'],
    K: ['kickPower', 'kickAccuracy'], P: ['kickPower', 'kickAccuracy'],
};
export const ATTR_LABEL = { exp: 'Explosiveness', eff: 'Vision', vol: 'Workload', gl: 'Goal line', sec: 'Ball security', awarenessOL: 'Awareness' };
export const attrLabel = k => ATTR_LABEL[k] || prettify(k);
