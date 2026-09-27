// The Phones (Claude-owned): trade negotiation. Pure functions.
//
// A CPU GM's answer depends only on the package, his team's needs and mode,
// his archetype, his trust in you, and a threshold seeded by (GM, year, week).
// Same offer, same week, same answer: re-clicking Propose can't win a trade.
// A rejection comes with the smallest counter that works, and a counter
// proposed as-is is always accepted.
import { hashSeed, seededRng } from './seededRandom.js';
import { gmFor } from './people.js';
import { perceivedPlayerValue, pickAssetValue, teamMode } from './assetValue.js';
import { pickKey } from './draftExperience.js';
import { tradeDeadMoney, SALARY_CAP } from './contracts.js';
import { rosterSalary } from './cpuRosterManagement.js';

export const ROSTER_MAX = 53;
export const MAX_PACKAGE = 5;
export const BANDS = [
    { id: 'accept', min: 1, label: 'Accept', tone: 'positive' },
    { id: 'close', min: 0.9, label: 'Close', tone: 'info' },
    { id: 'work', min: 0.7, label: 'Needs work', tone: 'warning' },
    { id: 'insulting', min: 0, label: 'Insulting', tone: 'negative' },
];
export const bandFor = ratio => BANDS.find(b => ratio >= b.min) || BANDS.at(-1);

/** Context bag the value model reads. */
export function valueCtx(state) {
    return {
        rosters: state.rosters, teamRatings: state.teamRatings, standings: state.standings,
        draftOrder: state.phase === 'draft' ? state.draftOrder : [], currentDraftYear: (state.year || 2024) + 1,
        identities: state.frontOffice?.identities || {}, eras: state.frontOffice?.gmEras || {},
    };
}

export const trustOf = (state, teamId) => state.frontOffice?.gmTrust?.[teamId] ?? 50;

/** The GM's bar for this week (hidden from the user; stable within the week). */
export function thresholdFor(state, teamId) {
    const gm = gmFor(teamId, state.frontOffice?.gmEras?.[teamId] || 0);
    const r = seededRng(`gmbar:${gm.id}:${state.year}:${state.phase}:${state.week}`)();
    const trust = trustOf(state, teamId);
    return gm.archetype.threshold * (0.97 + r * 0.06) * (1 + (50 - trust) / 250);
}

const findPlayer = (state, teamId, id) => (state.rosters?.[teamId] || []).find(p => p.id === id);
const ownsPick = (state, teamId, pick) => (state.draftPickOwners?.[teamId] || []).some(p => pickKey(p) === pickKey(pick));

/**
 * Evaluate a proposal from the CPU team's side.
 * proposal: { partner, give: { players: [ids], picks: [pick] }, get: { players: [ids], picks: [pick] } }
 * (give = what the user sends; get = what the user receives)
 */
export function evaluateProposal(state, proposal) {
    const { partner } = proposal;
    const user = state.userTeamId;
    const ctx = valueCtx(state);
    const giveP = (proposal.give?.players || []).map(id => findPlayer(state, user, id)).filter(Boolean);
    const getP = (proposal.get?.players || []).map(id => findPlayer(state, partner, id)).filter(Boolean);
    const givePicks = proposal.give?.picks || [], getPicks = proposal.get?.picks || [];
    const problems = [];
    if (giveP.length !== (proposal.give?.players || []).length || getP.length !== (proposal.get?.players || []).length) problems.push('A player in this deal is no longer on that roster.');
    if (givePicks.some(p => !ownsPick(state, user, p)) || getPicks.some(p => !ownsPick(state, partner, p))) problems.push('A pick in this deal has already moved.');
    if (!giveP.length && !givePicks.length) problems.push('Add something to send.');
    if (!getP.length && !getPicks.length) problems.push('Add something to ask for.');

    // Value from the partner's chair.
    const incoming = giveP.reduce((n, p) => n + perceivedPlayerValue(p, partner, ctx), 0) + givePicks.reduce((n, p) => n + pickAssetValue(p, ctx), 0);
    let outgoing = getP.reduce((n, p) => n + perceivedPlayerValue(p, partner, ctx), 0) + getPicks.reduce((n, p) => n + pickAssetValue(p, ctx), 0);
    const reasons = [];
    const mode = teamMode(partner, ctx);
    if (mode === 'rebuild' && givePicks.length) { reasons.push('They are rebuilding and love draft picks.'); }
    if (mode === 'contend' && getPicks.length && !getP.length) reasons.push('Contenders part with picks easily.');
    // Starting QBs almost never move.
    const theirQB = (state.rosters?.[partner] || []).filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
    if (theirQB && getP.some(p => p.id === theirQB.id)) { outgoing *= 1.35; reasons.push('Asking for their starting quarterback: they want a haul.'); }
    if (getP.some(p => p.xFactor && !p.xFactor.dormant)) reasons.push('X-Factors carry a premium.');
    outgoing *= 1.04; // sellers' premium
    const bar = thresholdFor(state, partner);
    const ratio = outgoing > 0 ? incoming / (outgoing * bar) : incoming > 0 ? 2 : 0;
    const cap = capCheck(state, partner, giveP, getP);
    problems.push(...cap.problems);
    const band = problems.length ? BANDS.at(-1) : bandFor(ratio);
    return { ok: !problems.length && ratio >= 1, ratio, band, incoming: Math.round(incoming), outgoing: Math.round(outgoing), reasons, problems, cap, mode };
}

/** Cap and roster legality for both clubs after the swap. */
export function capCheck(state, partner, giveP, getP) {
    const user = state.userTeamId;
    const mine = state.rosters?.[user] || [], theirs = state.rosters?.[partner] || [];
    const giveIds = new Set(giveP.map(p => p.id)), getIds = new Set(getP.map(p => p.id));
    const myAfter = [...mine.filter(p => !giveIds.has(p.id)), ...getP];
    const theirAfter = [...theirs.filter(p => !getIds.has(p.id)), ...giveP];
    const deadNow = state.frontOffice?.deadCap?.[state.year] || 0;
    const dead = giveP.reduce((n, p) => n + tradeDeadMoney(p), 0);
    const myBefore = rosterSalary(mine) + deadNow, myCap = rosterSalary(myAfter) + deadNow + dead;
    const theirBefore = rosterSalary(theirs), theirCap = rosterSalary(theirAfter);
    const problems = [];
    if (myCap > SALARY_CAP && myCap > myBefore) problems.push(`You'd be $${Math.round(myCap - SALARY_CAP)}M over the cap.`);
    if (theirCap > SALARY_CAP && theirCap > theirBefore) problems.push(`They'd be $${Math.round(theirCap - SALARY_CAP)}M over the cap.`);
    if (state.phase === 'regular' && myAfter.length > ROSTER_MAX) problems.push(`Your roster would be ${myAfter.length}; release someone first.`);
    return { myBefore: Math.round(myBefore * 10) / 10, myAfter: Math.round(myCap * 10) / 10, theirAfter: Math.round(theirCap * 10) / 10, dead: Math.round(dead * 10) / 10, rosterAfter: myAfter.length, problems };
}

/** The user's tradeable assets, least painful first. */
export function userAssets(state, { exclude = [] } = {}) {
    const user = state.userTeamId;
    const roster = state.rosters?.[user] || [];
    const starters = new Set();
    const need = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 };
    for (const [pos, n] of Object.entries(need)) roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr).slice(0, n).forEach(p => starters.add(p.id));
    const players = roster.filter(p => !exclude.includes(p.id) && !starters.has(p.id)).map(p => ({ kind: 'player', id: p.id, player: p }));
    const picks = (state.draftPickOwners?.[user] || []).filter(p => !exclude.includes(pickKey(p))).map(p => ({ kind: 'pick', id: pickKey(p), pick: p }));
    return [...picks, ...players];
}

const withAsset = (proposal, asset) => asset.kind === 'pick'
    ? { ...proposal, give: { ...proposal.give, picks: [...(proposal.give.picks || []), asset.pick] } }
    : { ...proposal, give: { ...proposal.give, players: [...(proposal.give.players || []), asset.id] } };

/**
 * Smallest change that makes the partner say yes: add one asset, or two, or
 * drop the least valuable piece you asked for. Returns { proposal, text } or null.
 */
export function counterOffer(state, proposal) {
    const first = evaluateProposal(state, proposal);
    if (first.ok) return null;
    if (first.problems.length) return null;
    const used = [...(proposal.give?.players || []), ...(proposal.give?.picks || []).map(pickKey)];
    const assets = userAssets(state, { exclude: used });
    const ctx = valueCtx(state);
    const valueOf = a => a.kind === 'pick' ? pickAssetValue(a.pick, ctx) : perceivedPlayerValue(a.player, proposal.partner, ctx);
    const scored = assets.map(a => ({ a, v: valueOf(a) })).sort((x, y) => x.v - y.v);
    // 1. One asset: the cheapest that closes the gap.
    for (const { a } of scored) {
        const next = withAsset(proposal, a);
        if (evaluateProposal(state, next).ok) return { proposal: next, text: `Add ${describeAsset(a, state)} and it's a deal.` };
    }
    // 2. Two assets.
    const top = scored.slice(-12);
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
        const next = withAsset(withAsset(proposal, top[i].a), top[j].a);
        if (evaluateProposal(state, next).ok) return { proposal: next, text: `Add ${describeAsset(top[i].a, state)} and ${describeAsset(top[j].a, state)}.` };
    }
    // 3. Take something off your ask.
    for (const pick of proposal.get?.picks || []) {
        const next = { ...proposal, get: { ...proposal.get, picks: proposal.get.picks.filter(p => pickKey(p) !== pickKey(pick)) } };
        if ((next.get.players?.length || next.get.picks?.length) && evaluateProposal(state, next).ok) return { proposal: next, text: `Keep asking for the rest, but they keep the ${pickLabel(pick)}.` };
    }
    for (const id of proposal.get?.players || []) {
        const next = { ...proposal, get: { ...proposal.get, players: proposal.get.players.filter(x => x !== id) } };
        const p = findPlayer(state, proposal.partner, id);
        if ((next.get.players?.length || next.get.picks?.length) && evaluateProposal(state, next).ok) return { proposal: next, text: `They'll do it without ${p?.name || 'that player'}.` };
    }
    return null;
}

/** Their asking price for the players you want: a package they'd accept. */
export function whatWouldItTake(state, partner, playerIds = [], pickAsk = []) {
    const base = { partner, give: { players: [], picks: [] }, get: { players: playerIds, picks: pickAsk } };
    const ctx = valueCtx(state);
    const mode = teamMode(partner, ctx);
    const target = evaluateProposal(state, base).outgoing * thresholdFor(state, partner) * 1.01;
    const valued = a => ({ a, v: a.kind === 'pick' ? pickAssetValue(a.pick, ctx) : perceivedPlayerValue(a.player, partner, ctx) });
    // Spare parts and picks first; starters only if that isn't enough.
    const spare = userAssets(state).map(valued);
    const spareIds = new Set(spare.map(x => x.a.id));
    const starters = (state.rosters?.[state.userTeamId] || []).filter(p => !spareIds.has(p.id)).map(p => valued({ kind: 'player', id: p.id, player: p }));
    const order = list => [...list].sort((x, y) => (mode === 'rebuild' ? (x.a.kind === 'pick' ? -1 : 1) - (y.a.kind === 'pick' ? -1 : 1) : 0) || y.v - x.v);
    for (const pool of [order(spare), [...order(spare), ...order(starters)]]) {
        const chosen = [];
        let have = 0;
        for (const x of pool) { if (have >= target) break; chosen.push(x); have += x.v; }
        if (have < target) continue;
        // Trim: drop the smallest pieces the deal doesn't need.
        for (const x of [...chosen].sort((p, q) => p.v - q.v)) if (have - x.v >= target) { chosen.splice(chosen.indexOf(x), 1); have -= x.v; }
        // No GM takes a truckload of spare parts: five pieces at most.
        if (chosen.length > MAX_PACKAGE) continue;
        let proposal = chosen.reduce((acc, x) => withAsset(acc, x.a), base);
        // In season the roster must stay at 53: send back the cheapest depth players.
        const depth = order(spare).filter(x => x.a.kind === 'player' && !chosen.includes(x)).reverse();
        for (let i = 0; i < depth.length && evaluateProposal(state, proposal).cap.rosterAfter > ROSTER_MAX && state.phase === 'regular'; i++) proposal = withAsset(proposal, depth[i].a);
        if (evaluateProposal(state, proposal).ok) return proposal;
    }
    return null;
}

export const pickLabel = p => `${p.year ? `${p.year} ` : ''}R${p.round}${p.originalTeamId ? ` (${String(p.originalTeamId).toUpperCase().slice(0, 3)})` : ''}${p.comp ? ' comp' : ''}`;
export function describeAsset(a, state) {
    if (a.kind === 'pick') return `your ${pickLabel(a.pick)}`;
    const p = a.player || findPlayer(state, state.userTeamId, a.id);
    return p ? `${p.name} (${p.position} ${p.ovr})` : 'a player';
}

/** Trust change after a completed trade, from the partner's value ratio. */
export function trustDelta(ratio) {
    if (ratio >= 1.35) return 5;
    if (ratio >= 1.12) return 2;
    if (ratio >= 1.02) return 0;
    return -4; // you squeezed every drop out of them
}

/**
 * Apply an accepted proposal. Returns a patch { rosters, draftPickOwners,
 * frontOffice } — the store adds ratings and news.
 */
export function applyProposal(state, proposal, evaluation) {
    const user = state.userTeamId, partner = proposal.partner;
    const rosters = { ...state.rosters };
    const giveIds = new Set(proposal.give?.players || []), getIds = new Set(proposal.get?.players || []);
    const outgoing = (rosters[user] || []).filter(p => giveIds.has(p.id));
    const incoming = (rosters[partner] || []).filter(p => getIds.has(p.id));
    rosters[user] = [...rosters[user].filter(p => !giveIds.has(p.id)), ...incoming.map(p => ({ ...p, teamId: user, acquired: { year: state.year, via: 'trade', from: partner } }))];
    rosters[partner] = [...rosters[partner].filter(p => !getIds.has(p.id)), ...outgoing.map(p => ({ ...p, teamId: partner, formerTeamId: user }))];
    // CPU keeps a legal roster by releasing its lowest-rated surplus player.
    while (rosters[partner].length > ROSTER_MAX) {
        const counts = {};
        rosters[partner].forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1; });
        const cut = [...rosters[partner]].filter(p => counts[p.position] > 2).sort((a, b) => a.ovr - b.ovr)[0];
        if (!cut) break;
        rosters[partner] = rosters[partner].filter(p => p.id !== cut.id);
    }
    const owners = { ...state.draftPickOwners };
    const move = (from, to, picks) => {
        const keys = new Set(picks.map(pickKey));
        owners[from] = (owners[from] || []).filter(p => !keys.has(pickKey(p)));
        owners[to] = [...(owners[to] || []), ...picks];
    };
    move(user, partner, proposal.give?.picks || []);
    move(partner, user, proposal.get?.picks || []);
    const fo = state.frontOffice || {};
    const dead = (proposal.give?.players || []).map(id => outgoing.find(p => p.id === id)).filter(Boolean).reduce((n, p) => n + tradeDeadMoney(p), 0);
    const deadCap = dead > 0 ? { ...(fo.deadCap || {}), [state.year]: Math.round(((fo.deadCap?.[state.year] || 0) + dead) * 10) / 10 } : fo.deadCap;
    const gmTrust = { ...(fo.gmTrust || {}), [partner]: Math.max(0, Math.min(100, trustOf(state, partner) + trustDelta(evaluation?.ratio || 1))) };
    // During the draft, the order follows pick ownership.
    let draftOrder = state.draftOrder;
    if (state.phase === 'draft' && Array.isArray(draftOrder)) {
        const toUser = new Set((proposal.get?.picks || []).map(pickKey)), toThem = new Set((proposal.give?.picks || []).map(pickKey));
        draftOrder = draftOrder.map((o, i) => i < state.currentPickIndex ? o : toUser.has(pickKey(o)) ? { ...o, teamId: user } : toThem.has(pickKey(o)) ? { ...o, teamId: partner } : o);
    }
    return { rosters, draftPickOwners: owners, draftOrder, frontOffice: { ...fo, deadCap, gmTrust }, outgoing, incoming };
}

// ── Trade block: CPU interest ────────────────────────────────────────────────
/**
 * Offers CPU clubs make for players on the user's block. Deterministic per week.
 * Returns up to `max` proposals (from the user's perspective: give = block player).
 */
export function blockOffers(state, blockIds = [], max = 3) {
    const ctx = valueCtx(state);
    const user = state.userTeamId;
    const offers = [];
    for (const id of blockIds) {
        const player = findPlayer(state, user, id);
        if (!player) continue;
        const teams = Object.keys(state.rosters).filter(t => t !== user)
            .map(t => ({ t, v: perceivedPlayerValue(player, t, ctx), r: seededRng(`block:${id}:${t}:${state.year}:${state.week}`)() }))
            .sort((a, b) => (b.v * (0.85 + b.r * 0.3)) - (a.v * (0.85 + a.r * 0.3)))
            .slice(0, 2);
        for (const { t, v } of teams) {
            const pkg = cpuPackage(state, t, v * 0.92, { avoid: player.position });
            if (!pkg) continue;
            const proposal = { partner: t, give: { players: [id], picks: [] }, get: pkg };
            if (evaluateProposal(state, proposal).ok) offers.push({ proposal, from: t, for: id });
        }
    }
    return offers.slice(0, max);
}

/** A CPU club assembles about `value` of its own assets (picks first when rebuilding). */
export function cpuPackage(state, teamId, value, { avoid } = {}) {
    const ctx = valueCtx(state);
    const mode = teamMode(teamId, ctx);
    const roster = state.rosters?.[teamId] || [];
    const starters = new Set();
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K']) roster.filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr).slice(0, pos === 'OL' ? 5 : pos === 'WR' || pos === 'DL' ? 3 : 1).forEach(p => starters.add(p.id));
    const picks = (state.draftPickOwners?.[teamId] || []).map(p => ({ kind: 'pick', pick: p, v: pickAssetValue(p, ctx) }));
    const players = roster.filter(p => !starters.has(p.id) && p.position !== avoid && p.ovr >= 66).map(p => ({ kind: 'player', p, v: perceivedPlayerValue(p, teamId, ctx) }));
    const pool = mode === 'contend' ? [...picks, ...players] : [...players, ...picks];
    pool.sort((a, b) => b.v - a.v);
    const out = { players: [], picks: [] };
    let have = 0;
    for (const a of pool) {
        if (have >= value) break;
        if (a.v > value * 1.3 - have && pool.some(x => x !== a && x.v <= value - have + 50)) continue;
        if (a.kind === 'pick') out.picks.push(a.pick); else out.players.push(a.p.id);
        have += a.v;
        if (out.players.length + out.picks.length >= 3) break;
    }
    return have >= value * 0.85 ? out : null;
}

// ── League (CPU↔CPU) trades ──────────────────────────────────────────────────
/**
 * Mode-driven deals: contenders buy proven veterans from rebuilders with picks.
 * Returns [{ buyer, seller, player, picks }] (at most `max`).
 */
export function leagueDeals(state, max = 2) {
    const ctx = valueCtx(state);
    const user = state.userTeamId;
    const teams = Object.keys(state.rosters).filter(t => t !== user);
    const sellers = teams.filter(t => teamMode(t, ctx) === 'rebuild');
    const buyers = teams.filter(t => teamMode(t, ctx) === 'contend');
    const r = seededRng(`league:${state.year}:${state.week}`);
    const deals = [];
    const usedTeams = new Set(), usedPicks = new Set();
    for (const seller of sellers.sort(() => r() - 0.5)) {
        if (deals.length >= max) break;
        const vets = (state.rosters[seller] || []).filter(p => (p.age || 26) >= 27 && p.ovr >= 78).sort((a, b) => b.ovr - a.ovr);
        for (const player of vets) {
            const buyer = buyers.filter(b => !usedTeams.has(b)).find(b => {
                const atPos = (state.rosters[b] || []).filter(p => p.position === player.position).sort((a, c) => c.ovr - a.ovr);
                const room = SALARY_CAP - rosterSalary(state.rosters[b] || []);
                return player.ovr > (atPos[0]?.ovr ?? 0) + 2 && room >= (player.contract?.salary || 2);
            });
            if (!buyer) continue;
            const need = perceivedPlayerValue(player, seller, ctx);
            const picks = (state.draftPickOwners?.[buyer] || []).filter(p => !usedPicks.has(pickKey(p)))
                .sort((a, b) => pickAssetValue(a, ctx) - pickAssetValue(b, ctx));
            let have = 0; const pay = [];
            for (const p of picks) { if (have >= need) break; if (pickAssetValue(p, ctx) + have > need * 1.5 && have > 0) continue; pay.push(p); have += pickAssetValue(p, ctx); }
            if (have < need * 0.9 || pay.length > 3) continue;
            pay.forEach(p => usedPicks.add(pickKey(p)));
            usedTeams.add(buyer); usedTeams.add(seller);
            deals.push({ buyer, seller, player, picks: pay });
            break;
        }
    }
    return deals;
}

export function applyLeagueDeal(state, deal) {
    const rosters = { ...state.rosters };
    rosters[deal.seller] = rosters[deal.seller].filter(p => p.id !== deal.player.id);
    rosters[deal.buyer] = [...rosters[deal.buyer], { ...deal.player, teamId: deal.buyer }];
    const owners = { ...state.draftPickOwners };
    const keys = new Set(deal.picks.map(pickKey));
    owners[deal.buyer] = (owners[deal.buyer] || []).filter(p => !keys.has(pickKey(p)));
    owners[deal.seller] = [...(owners[deal.seller] || []), ...deal.picks];
    return { rosters, draftPickOwners: owners };
}

/** Rumor text for the deadline ticker (deterministic flavor). */
export function rumorFor(state, teamId, seedKey) {
    const gm = gmFor(teamId, state.frontOffice?.gmEras?.[teamId] || 0);
    const lines = [
        `${gm.name} has been working the phones all morning.`,
        'Hearing they want a veteran corner before the deadline.',
        'They are listening on anyone over 28.',
        'Word is they want to move up in next year\'s draft.',
        'Sources say they are shopping a starter who wants out.',
    ];
    return lines[hashSeed(`rumor:${teamId}:${seedKey}`) % lines.length];
}
