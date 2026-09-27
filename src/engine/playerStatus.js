// Player status (Claude-owned): the one thing that matters about a player
// right now, plus what to do about it. Pure and derived: zero save bytes.
//
// playerStatus(player, ctx) → { primary, secondary[], tone, headline, actions[] }
// Statuses are ranked; the card shows the primary and at most two more.
import { moodFor, roleOf, wantsOut } from './character.js';
import { isActiveXF } from './xFactor.js';
import { contractStance } from './character.js';

export const STATUS = {
    injured: { id: 'injured', label: 'Injured', icon: '🩹', tone: 'danger', rank: 1 },
    wantsOut: { id: 'wantsOut', label: 'Wants out', icon: '🧳', tone: 'danger', rank: 2 },
    holdout: { id: 'holdout', label: 'Holdout', icon: '✋', tone: 'danger', rank: 2 },
    xfactor: { id: 'xfactor', label: 'X-Factor', icon: '⚡', tone: 'xfactor', rank: 3 },
    awakening: { id: 'awakening', label: 'Awakening', icon: '✨', tone: 'xfactor', rank: 4 },
    walkYear: { id: 'walkYear', label: 'Walk year', icon: '⏳', tone: 'warning', rank: 5 },
    hot: { id: 'hot', label: 'Hot streak', icon: '🔥', tone: 'positive', rank: 6 },
    slump: { id: 'slump', label: 'Slumping', icon: '🧊', tone: 'warning', rank: 6 },
    rookie: { id: 'rookie', label: 'Rookie', icon: '🌱', tone: 'info', rank: 7 },
    battle: { id: 'battle', label: 'Position battle', icon: '⚔️', tone: 'info', rank: 8 },
    unhappy: { id: 'unhappy', label: 'Unhappy', icon: '😠', tone: 'warning', rank: 9 },
    onBlock: { id: 'onBlock', label: 'On the block', icon: '📢', tone: 'warning', rank: 9 },
    starter: { id: 'starter', label: 'Starter', icon: '●', tone: 'neutral', rank: 10 },
    rotation: { id: 'rotation', label: 'Rotation', icon: '◐', tone: 'neutral', rank: 10 },
    backup: { id: 'backup', label: 'Backup', icon: '○', tone: 'neutral', rank: 10 },
    freeAgent: { id: 'freeAgent', label: 'Free agent', icon: '✍️', tone: 'info', rank: 10 },
    prospect: { id: 'prospect', label: 'Prospect', icon: '🎓', tone: 'info', rank: 10 },
};

const POS_NAME = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', OL: 'OL', DL: 'DL', LB: 'LB', CB: 'CB', S: 'S', K: 'K', P: 'P' };
const perGame = (s, key) => (s?.[key] || 0) / Math.max(1, s?.gamesPlayed || s?.games || 1);

/** A quick read of recent form from the last few box scores ([] when unknown). */
export function recentForm(player, games = []) {
    const lines = games.map(g => g.line).filter(Boolean);
    if (lines.length < 2) return null;
    const key = { QB: 'yards', RB: 'rushYards', WR: 'recYards', TE: 'recYards' }[player.position]
        || (['DL', 'LB'].includes(player.position) ? 'tackles' : ['CB', 'S'].includes(player.position) ? 'tackles' : null);
    if (!key) return null;
    const vals = lines.map(l => l[key] || 0);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const base = perGame(player.stats?.season, key) || avg;
    return { key, values: vals, avg, base, ratio: base ? avg / base : 1 };
}

/**
 * ctx: { own, teamId, roster, injuries, standings, phase, week, year,
 *        recent: [{ line }], block: [ids], tradeRequests: {id: {...}}, holdouts: {id},
 *        battle: { ids }, context: 'roster'|'fa'|'prospect'|'rival' }
 */
export function playerStatus(player, ctx = {}) {
    if (!player) return null;
    const out = [];
    const add = (id, headline, actions = [], extra = {}) => out.push({ ...STATUS[id], headline, actions, ...extra });
    const own = !!ctx.own;
    const pos = POS_NAME[player.position] || player.position;

    if (ctx.context === 'prospect') {
        add('prospect', ctx.projection || `${pos} prospect`);
    } else if (ctx.context === 'fa') {
        add('freeAgent', ctx.ask ? `Asking $${ctx.ask}M/yr` : 'Unsigned', [{ id: 'offer', label: 'Make offer' }]);
    }

    const injury = (ctx.injuries || []).find(i => i.playerId === player.id && i.weeksRemaining > 0);
    if (injury) {
        const back = ctx.week ? ` (back wk ${ctx.week + injury.weeksRemaining})` : '';
        add('injured', `${injury.type || 'Injury'} · out ${injury.weeksRemaining} wk${injury.weeksRemaining === 1 ? '' : 's'}${back}`, own ? [{ id: 'depth', label: 'Depth chart' }, { id: 'waivers', label: 'Find replacement' }] : []);
    }

    const request = ctx.tradeRequests?.[player.id];
    if (request && (own || request.public)) add('wantsOut', request.public ? `Publicly requested a trade · ${request.reason || ''}`.trim() : `Asked privately to be traded · ${request.reason || ''}`.trim(), own ? [{ id: 'talk', label: 'Talk to him' }, { id: 'shop', label: 'Shop him' }] : []);
    if (ctx.holdouts?.[player.id]) add('holdout', 'Holding out for a new deal', own ? [{ id: 'extend', label: 'Extend' }, { id: 'shop', label: 'Shop him' }] : []);

    if (isActiveXF(player)) add('xfactor', ctx.inZone ? '⚡ In the zone' : 'One of the league\'s X-Factors', [{ id: 'ability', label: 'View ability' }]);
    else if (ctx.awakening?.[player.id]) add('awakening', `X-Factor candidate · ${ctx.awakening[player.id]}`);

    if (ctx.context !== 'prospect' && ctx.context !== 'fa') {
        const roster = ctx.roster || [];
        const left = player.contract?.yearsLeft ?? 2;
        if (own && left <= 1 && player.ovr >= 70) {
            let ask = null;
            try { ask = contractStance(player, { roster, games: 0, winPct: 0.5 }).ask; } catch { /* derived only */ }
            add('walkYear', `Final year${ask ? ` · asks about $${ask}M/yr` : ''}`, [{ id: 'extend', label: 'Extend' }, { id: 'shop', label: 'Shop' }]);
        }
        const form = recentForm(player, ctx.recent || []);
        if (form && form.ratio >= 1.35 && form.avg > 0) add('hot', `Averaging ${Math.round(form.avg)} ${form.key === 'yards' ? 'pass yds' : form.key === 'rushYards' ? 'rush yds' : form.key === 'recYards' ? 'rec yds' : 'tackles'} lately`);
        else if (form && form.ratio <= 0.6 && form.base > 0) add('slump', `Well below his season pace lately`);
        if ((player.experience ?? 1) === 0 || player.draftYear === (ctx.year || 0) + (ctx.phase === 'regular' ? 0 : 1)) {
            const reveal = player.scoutedAs && typeof player.scoutedAs.est === 'number' ? player.ovr - player.scoutedAs.est : null;
            add('rookie', reveal == null ? 'Rookie season' : reveal > 1 ? `Rookie · better than we graded (+${reveal})` : reveal < -1 ? `Rookie · below our grade (${reveal})` : 'Rookie · right where we graded him');
        }
        if (ctx.battle?.includes?.(player.id)) add('battle', 'Competing for a starting job', own ? [{ id: 'battle', label: 'Decide' }] : []);
        if (own && (ctx.block || []).includes(player.id)) add('onBlock', 'On the trade block', [{ id: 'unblock', label: 'Take off block' }]);
        if (own && !request) {
            const mood = moodFor(player, { roster, games: ctx.games || 0, winPct: ctx.winPct ?? 0.5 });
            if (mood && mood.score < 48) add('unhappy', mood.reasons[0]?.text || mood.label, [{ id: 'talk', label: 'Talk to him' }]);
            else if (mood && wantsOut(player, { roster, games: ctx.games || 0, winPct: ctx.winPct ?? 0.5 }).yes) add('unhappy', 'Wants out');
        }
        if (roster.length) {
            const role = roleOf(player, roster);
            if (role.starter) add('starter', `Starting ${pos}${role.slots > 1 ? ` (${pos}${role.rank + 1})` : ''}`);
            else if (role.rank >= 0 && role.rank < role.slots + 1) add('rotation', `Rotation ${pos} · ${pos}${role.rank + 1}`);
            else if (role.rank >= 0) add('backup', `Depth ${pos} · ${pos}${role.rank + 1}`);
        }
    }
    out.sort((a, b) => a.rank - b.rank);
    const [primary, ...rest] = out;
    if (!primary) return { primary: STATUS.backup, secondary: [], tone: 'neutral', headline: pos, actions: [] };
    return { primary, secondary: rest.filter(s => s.rank < 10).slice(0, 2), tone: primary.tone, headline: primary.headline, actions: primary.actions || [], all: out };
}

/** Recent box-score lines for a player from the schedule (last n played). */
export function recentLines(schedule = [], teamId, playerId, n = 5) {
    const out = [];
    for (let w = schedule.length - 1; w >= 0 && out.length < n; w--) {
        for (const g of schedule[w] || []) {
            if (!g.played || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue;
            const side = g.homeTeamId === teamId ? 'home' : 'away';
            const line = g.playerStats?.[side]?.[playerId];
            if (line) out.push({ week: w + 1, line, opp: side === 'home' ? g.awayTeamId : g.homeTeamId });
        }
    }
    return out.reverse();
}
