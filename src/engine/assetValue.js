// One value model for players and picks (Claude-owned). Pure functions.
//
// Every trade, draft-day deal and CPU valuation reads from here, so a pick is
// worth the same thing on the draft desk as in the Trade Machine. Units match
// getPlayerValue (a late first ≈ a solid 84-OVR starter ≈ 1,150).
import { getPlayerValue } from '../screens/tradeLogic.js';
import { gmFor } from './people.js';
import { teamFit } from './schemes.js';
import { askingSalary } from './progression.js';

const ROUND1 = [2200, 2100, 2020, 1950, 1880, 1820, 1770, 1730, 1690, 1650,
    1620, 1590, 1560, 1540, 1520, 1500, 1480, 1460, 1440, 1420,
    1400, 1380, 1360, 1340, 1320, 1300, 1280, 1260, 1240, 1210, 1180, 1150];
const ROUND_BASE = { 2: 900, 3: 460, 4: 230, 5: 125, 6: 65, 7: 35 };

/** Value of an overall pick number (1-224+). Strictly decreasing. */
export function pickNumberValue(n) {
    n = Math.max(1, Math.round(n));
    if (n <= 32) return ROUND1[n - 1];
    const round = Math.min(7, Math.ceil(n / 32));
    const within = ((n - 1) % 32) / 31; // 0 at the top of the round, 1 at the end
    const base = ROUND_BASE[round] || 25;
    return Math.max(10, Math.round(base * (1.15 - 0.3 * within) * 10) / 10);
}

/** Where a team is projected to pick in a round, from its strength. */
export function projectedSlot(teamId, teamRatings = {}) {
    const ids = Object.keys(teamRatings);
    if (!ids.length || !teamRatings[teamId]) return 16;
    const sorted = ids.sort((a, b) => (teamRatings[a]?.overall || 70) - (teamRatings[b]?.overall || 70));
    return sorted.indexOf(teamId) + 1; // weakest team picks first
}

/**
 * Value of a pick object { year, round, originalTeamId }.
 * ctx: { currentDraftYear, draftOrder?, teamRatings }
 * Picks in the live draft use their real slot; future picks use the projected
 * slot, discounted 15% per year out.
 */
export function pickAssetValue(pick, ctx = {}) {
    const live = (ctx.draftOrder || []).find(o => o.round === pick.round && o.originalTeamId === pick.originalTeamId && (o.year ?? ctx.currentDraftYear) === (pick.year ?? ctx.currentDraftYear));
    if (live?.pickNumber) return pickNumberValue(live.pickNumber);
    const slot = pick.comp ? 32 : projectedSlot(pick.originalTeamId, ctx.teamRatings);
    const yearsOut = Math.max(0, (pick.year ?? ctx.currentDraftYear ?? 0) - (ctx.currentDraftYear ?? pick.year ?? 0));
    // A far-future pick regresses toward the middle of the round.
    const blended = yearsOut >= 1 ? Math.round(slot * 0.6 + 16.5 * 0.4) : slot;
    return Math.round(pickNumberValue((pick.round - 1) * 32 + blended) * Math.pow(0.85, yearsOut));
}

// ── Team mode ─────────────────────────────────────────────────────────────────
export const MODES = {
    contend: { id: 'contend', label: 'Contending', icon: '🏆', blurb: 'Buying: wants proven starters now.' },
    retool: { id: 'retool', label: 'Retooling', icon: '🔧', blurb: 'Balanced: fair value either way.' },
    rebuild: { id: 'rebuild', label: 'Rebuilding', icon: '🌱', blurb: 'Selling: wants picks and young players.' },
};

/** contend | retool | rebuild, from rating, record, age and QB. */
export function teamMode(teamId, { rosters = {}, teamRatings = {}, standings = {} } = {}) {
    const roster = rosters[teamId] || [];
    const overall = teamRatings[teamId]?.overall || 72;
    const s = standings[teamId] || {};
    const games = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
    const winPct = games ? ((s.wins || 0) + (s.ties || 0) / 2) / games : 0.5;
    const starters = [...roster].sort((a, b) => b.ovr - a.ovr).slice(0, 22);
    const age = starters.length ? starters.reduce((n, p) => n + (p.age || 26), 0) / starters.length : 26;
    const qb = roster.filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
    let score = (overall - 74) * 0.6 + (winPct - 0.5) * (games >= 6 ? 14 : 4) + (qb ? (qb.ovr - 76) * 0.25 : -3) + (age > 28.5 ? 1.5 : age < 25.5 ? -1.5 : 0);
    if (score >= 2.5) return 'contend';
    if (score <= -2.5) return 'rebuild';
    return 'retool';
}

// ── Player value to a specific team ──────────────────────────────────────────
/** On-field value minus what he costs over the deal, in value units. */
export function surplusValue(player) {
    const base = getPlayerValue(player);
    const salary = player.contract?.salary ?? 2;
    const fair = askingSalary(player);
    const years = player.contract?.yearsLeft ?? 1;
    return Math.round(base + (fair - salary) * 14 * Math.min(3, years));
}

const XF_PREMIUM = 1.3;

/**
 * What `forTeamId` believes the player is worth. ctx: { rosters, teamRatings,
 * standings, identities?, era? }. Needs, mode, scheme fit, youth and the GM's
 * archetype all move it; X-Factors carry a premium.
 */
export function perceivedPlayerValue(player, forTeamId, ctx = {}) {
    if (!player) return 0;
    let v = Math.max(20, surplusValue(player));
    const mode = teamMode(forTeamId, ctx);
    const gm = gmFor(forTeamId, ctx.eras?.[forTeamId] || 0).archetype;
    const young = (player.age || 26) <= 25;
    if (mode === 'contend') v *= player.ovr >= 80 ? 1.2 : 0.9;
    if (mode === 'rebuild') v *= young ? 1.25 : (player.age || 26) >= 30 ? 0.7 : 0.95;
    if (young) v *= gm.youth;
    const roster = ctx.rosters?.[forTeamId] || [];
    const atPos = roster.filter(p => p.position === player.position && p.id !== player.id).sort((a, b) => b.ovr - a.ovr);
    const starterSlots = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 3, S: 2, K: 1, P: 1 }[player.position] || 1;
    const worstStarter = atPos[starterSlots - 1]?.ovr ?? 50;
    if (player.ovr > worstStarter + 2) v *= 1.12; // fills a need
    else if (player.ovr < worstStarter - 4) v *= 0.8; // would be depth
    if (ctx.identities?.[forTeamId]) {
        const fit = teamFit(player, ctx.identities[forTeamId]);
        v *= 0.9 + fit / 500; // 0.9 .. 1.1
    }
    if (player.xFactor && !player.xFactor.dormant) v *= XF_PREMIUM;
    return Math.round(v);
}

/** Total value of a package from one team's perspective. */
export function packageValue({ players = [], picks = [] }, forTeamId, ctx = {}) {
    return players.reduce((n, p) => n + perceivedPlayerValue(p, forTeamId, ctx), 0)
        + picks.reduce((n, p) => n + pickAssetValue(p, ctx), 0);
}
