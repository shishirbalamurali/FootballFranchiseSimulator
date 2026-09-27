// Free-agency market (Claude-owned). Pure functions; the store wraps them.
//
// Free agency runs as a short market of FA_DAYS days. The user places offers
// (salary + years) and each day resolves at once: players compare the user's
// offer with what their rival suitors would pay, CPU clubs with real cap room
// and positional need sign players, and unsigned asks soften. A rejection sets
// a floor, so the same lowball can't be resubmitted until the dice say yes.
// After the market closes, startDraft's manageCPURosters pass fills CPU depth.
import { askingSalary } from './progression';
import { rosterSalary, rookieReserve } from './cpuRosterManagement';
import { ROSTER_COMPOSITION, ROSTER_LIMIT } from './player';
import { faPreferences } from './character.js';
import { structuredContract, structureValue } from './contracts.js';
import { agentFor } from './people.js';

export const SALARY_CAP = 200;
export const FA_DAYS = 4;
// CPU clubs keep seven spots open for their draft class.
export const PRE_DRAFT_ROSTER = ROSTER_LIMIT - 7;
export const DAY_LABELS = ['Opening day', 'Day 2', 'Day 3', 'Final day'];

const MIN_RIVAL_OVR = 64; // below this, rivals wait for the post-market depth fill
const MAX_RIVAL_SIGNINGS_PER_DAY = 36;

export const preferredYears = p => {
    const age = p.age || 27;
    return age <= 25 ? 4 : age <= 28 ? 3 : age <= 31 ? 2 : 1;
};

export const marketAsk = p => (p.isUndrafted ? 1 : askingSalary(p));

/** Re-price a pool on one shared scale (the same one re-signing uses). */
export function openMarket(freeAgents = []) {
    return freeAgents.map(p => {
        const ask = marketAsk(p);
        return { ...p, ask, openingAsk: ask, contract: { salary: ask, years: preferredYears(p) } };
    });
}

export const askOf = p => p.ask ?? p.contract?.salary ?? 1;

export function capRoom(roster = [], picks = []) {
    return SALARY_CAP - rosterSalary(roster) - rookieReserve(picks);
}

function summarize(roster = [], picks = []) {
    const count = {}, best = {};
    for (const p of roster) {
        count[p.position] = (count[p.position] || 0) + 1;
        best[p.position] = Math.max(best[p.position] || 0, p.ovr || 0);
    }
    return { size: roster.length, room: capRoom(roster, picks), count, best };
}

// How much a club wants a player: 0 = not at all, 2 = need + starter upgrade.
function teamInterest(p, summary) {
    const have = summary.count[p.position] || 0;
    const need = have < (ROSTER_COMPOSITION[p.position] || 1) ? 1 : 0;
    const upgrade = (p.ovr || 0) > (summary.best[p.position] || 0) ? 1 : 0;
    return need + upgrade;
}

const winPct = (standings, teamId) => {
    const s = standings?.[teamId];
    const g = s ? s.wins + s.losses + (s.ties || 0) : 0;
    return g ? (s.wins + (s.ties || 0) / 2) / g : 0.5;
};

function cpuSummaries({ rosters, userTeamId, draftPickOwners }) {
    const out = {};
    for (const [teamId, roster] of Object.entries(rosters || {})) {
        if (teamId !== userTeamId) out[teamId] = summarize(roster, draftPickOwners?.[teamId] || []);
    }
    return out;
}

function suitorsFrom(p, summaries, standings) {
    const ask = askOf(p);
    return Object.entries(summaries)
        .filter(([, s]) => s.size < PRE_DRAFT_ROSTER && s.room >= ask && teamInterest(p, s) > 0)
        .map(([teamId, s]) => ({ teamId, interest: teamInterest(p, s), pct: winPct(standings, teamId) }))
        .sort((a, b) => b.interest - a.interest || b.pct - a.pct);
}

/** CPU clubs that could realistically bid for this player right now. */
export function suitorsFor(p, ctx) {
    return suitorsFrom(p, cpuSummaries(ctx), ctx.standings);
}

/** Suitor lists for a whole pool, summarising each club once. { [id]: teamId[] } */
export function marketSuitors(pool = [], ctx) {
    const summaries = cpuSummaries(ctx);
    return Object.fromEntries(pool.map(p => [p.id, suitorsFrom(p, summaries, ctx.standings).map(s => s.teamId)]));
}

// What rival suitors' offers are worth to the player, relative to his ask.
// A hot market pushes the price up to ~12% over the ask, not further.
export const rivalBar = suitorCount => (suitorCount === 0 ? 0.9 : Math.min(1.12, 0.95 + 0.025 * suitorCount));

/** Would the player start for the user's club? Starters get more playing time. */
export function wouldStart(p, userRoster = []) {
    const slots = Math.max(1, Math.round((ROSTER_COMPOSITION[p.position] || 2) / 2));
    const better = userRoster.filter(x => x.position === p.position && x.ovr >= p.ovr).length;
    return better < slots;
}

/**
 * Deterministic read on an offer, so the UI can show the odds before submitting.
 * ctx: { userTeamId, userRoster, standings, suitorCount, floor }
 */
export function assessOffer(p, offer, ctx) {
    const ask = askOf(p);
    const salary = Number(offer?.salary) || 0;
    const years = Number(offer?.years) || 1;
    const pref = preferredYears(p);
    if (ctx.floor && salary < ctx.floor) {
        return { chance: 0, margin: -1, verdict: 'Won’t consider', reason: `He already turned down $${Math.round(ctx.floor / 1.08)}M. He needs at least $${Math.ceil(ctx.floor)}M now.` };
    }
    const termFit = 1 - 0.05 * Math.abs(years - pref);
    const loyal = p.previousTeamId && p.previousTeamId === ctx.userTeamId;
    const starter = wouldStart(p, ctx.userRoster);
    const appeal = winPct(ctx.standings, ctx.userTeamId);
    // Personality decides what an offer is worth to him: money, a winner,
    // a starting job, or coming home.
    const prefs = faPreferences(p);
    // Structure (guarantees, bonus) is worth real money to security-minded players.
    const struct = structureValue({ salary, years, guaranteed: salary * years * (offer?.guaranteePct || 0), bonus: salary * years * (offer?.bonusPct || 0) }, { security: prefs.security ?? 0.5 });
    const agent = agentFor(p.id);
    const value = Math.pow(salary / ask, prefs.moneyPower) * termFit * struct
        * (1 + prefs.winWeight * (appeal - 0.5) + (loyal ? prefs.loyalWeight : 0) + (starter ? prefs.starterWeight : 0) + (ctx.extra?.bonus || 0));
    const margin = value - rivalBar(ctx.suitorCount || 0) * agent.style.askMult - (ctx.extra?.agentGrudge || 0);
    const chance = Math.max(0.03, Math.min(0.97, 0.55 + margin * 3));
    const verdict = margin >= 0.08 ? 'Very likely' : margin >= 0 ? 'Likely' : margin >= -0.1 ? 'Toss-up' : 'Unlikely';
    const notes = [];
    if (salary < ask) notes.push(`under his $${ask}M ask`);
    if (Math.abs(years - pref) >= 2) notes.push(`he wants ${pref} year${pref === 1 ? '' : 's'}`);
    if (starter) notes.push('he would start for you');
    if (loyal) notes.push('hometown discount');
    if ((ctx.suitorCount || 0) >= 4) notes.push(`${ctx.suitorCount} rival suitors`);
    if (struct > 1.01) notes.push('likes the guarantees');
    if (agent.style.id === 'hardball') notes.push(`${agent.name} plays hardball`);
    notes.push(...prefs.notes, ...(ctx.extra?.notes || []));
    return { chance, margin, verdict, reason: notes.join(' · ') };
}

function rejectionText(p, offer, pref) {
    if (offer.salary < askOf(p) * 0.9) return `${p.name} wanted more money.`;
    if (Math.abs(offer.years - pref) >= 2) return `${p.name} wanted a ${pref}-year deal.`;
    return `${p.name} is holding out for a better offer.`;
}

const pickSuitor = suitors => suitors[0]?.teamId || null;

/**
 * Resolve one market day.
 * state: { pool, offers: {id: {salary, years}}, floors: {id: salary}, day,
 *          rosters, userTeamId, draftPickOwners, standings }
 * Returns { pool, floors, signings: [{ player, teamId, contract, byUser }], rejections: [...] }
 */
export function resolveMarketDay(state, rng = Math.random) {
    const { offers = {}, userTeamId, standings } = state;
    const userRoster = state.rosters?.[userTeamId] || [];
    const summaries = cpuSummaries(state);
    const floors = { ...(state.floors || {}) };
    const signings = [], rejections = [];
    const taken = new Set();

    const cpuSign = (p, teamId) => {
        const years = preferredYears(p);
        const contract = { salary: askOf(p), years, yearsLeft: years };
        const s = summaries[teamId];
        s.size += 1; s.room -= contract.salary;
        s.count[p.position] = (s.count[p.position] || 0) + 1;
        s.best[p.position] = Math.max(s.best[p.position] || 0, p.ovr || 0);
        signings.push({ player: p, teamId, contract, byUser: false });
        taken.add(p.id);
    };

    // 1. The user's offers, best players first.
    const offered = state.pool.filter(p => offers[p.id]).sort((a, b) => b.ovr - a.ovr);
    for (const p of offered) {
        const offer = offers[p.id];
        const suitors = suitorsFrom(p, summaries, standings);
        const read = assessOffer(p, offer, { userTeamId, userRoster, standings, suitorCount: suitors.length, floor: floors[p.id], extra: state.extras?.[p.id] });
        if (read.chance > 0 && rng() < read.chance) {
            const contract = structuredContract({ salary: offer.salary, years: offer.years, guaranteePct: offer.guaranteePct || 0, bonusPct: offer.bonusPct || 0, year: state.year, incentive: offer.incentive || null });
            signings.push({ player: p, teamId: userTeamId, contract, byUser: true });
            taken.add(p.id);
            continue;
        }
        floors[p.id] = Math.max(floors[p.id] || 0, offer.salary * 1.08);
        const rival = rng() < Math.min(0.8, suitors.length * 0.15) ? pickSuitor(suitors) : null;
        if (rival) cpuSign(p, rival);
        rejections.push({ player: p, offer, signedWith: rival, text: rival ? `${p.name} took a better deal elsewhere.` : rejectionText(p, offer, preferredYears(p)) });
    }

    // 2. Rival clubs work the rest of the market. Stars move first.
    let rivalCount = 0;
    const rest = state.pool.filter(p => !taken.has(p.id) && !offers[p.id] && p.ovr >= MIN_RIVAL_OVR).sort((a, b) => b.ovr - a.ovr);
    for (const p of rest) {
        if (rivalCount >= MAX_RIVAL_SIGNINGS_PER_DAY) break;
        const suitors = suitorsFrom(p, summaries, standings);
        if (!suitors.length) continue;
        const chance = Math.min(0.9, 0.1 * suitors.length + (p.ovr >= 80 ? 0.2 : 0));
        if (rng() < chance) { cpuSign(p, pickSuitor(suitors)); rivalCount += 1; }
    }

    // 3. Whoever is left softens their price for tomorrow.
    const pool = state.pool.filter(p => !taken.has(p.id)).map(p => {
        if (offers[p.id]) return p;
        const ask = Math.max(1, Math.round(askOf(p) * 0.9));
        return { ...p, ask, contract: { ...p.contract, salary: ask } };
    });
    return { pool, floors, signings, rejections };
}

/** Cap/roster check for the user's pending offers. */
export function offerBudget({ userRoster = [], offers = {}, pool = [], exceptId = null, deadCap = 0 }) {
    const pending = Object.entries(offers).filter(([id]) => id !== exceptId && pool.some(p => p.id === id));
    const committed = pending.reduce((sum, [, o]) => sum + (o.salary || 0), 0);
    const payroll = rosterSalary(userRoster) + deadCap;
    return {
        payroll,
        committed,
        deadCap,
        space: SALARY_CAP - payroll - committed,
        rosterSize: userRoster.length,
        openSpots: ROSTER_LIMIT - userRoster.length - pending.length,
    };
}

export function validateOffer(p, offer, budget) {
    const salary = Number(offer?.salary), years = Number(offer?.years);
    if (!p) return 'That player is no longer available.';
    if (!Number.isFinite(salary) || salary < 1) return 'Offer at least $1M a year.';
    if (!Number.isInteger(years) || years < 1 || years > 6) return 'Contracts run 1 to 6 years.';
    if (budget.openSpots <= 0) return `Your roster is full (${ROSTER_LIMIT}). Release someone first.`;
    if (salary > budget.space) return `Only $${Math.floor(budget.space)}M of cap space left after your other offers.`;
    return null;
}
