// Contract model v2 (Claude-owned). Pure functions.
//
// A contract is { salary, years, yearsLeft, guaranteed?, bonus?, signedYear?,
// type?, incentive?, option? }. `salary` stays the annual cap hit, so every
// existing cap reader keeps working. What's new:
//   guaranteed — $M still owed if he's released (paid down each season)
//   bonus      — signing bonus, prorated over the deal; unamortized proration
//                accelerates onto the cap when he's cut or traded (dead money)
//   type       — rookie | veteran | tag | tender | minimum
//   incentive  — { stat, threshold, amount } paid if earned, charged next year
//   option     — 5th-year option for first-round rookies
// Old saves have none of these, which means $0 dead money: no economy shock.

export const SALARY_CAP = 200;
export const TAG_TYPES = {
    franchise: { id: 'franchise', label: 'Franchise tag', blurb: 'One year at the average of the top five at his position.' },
    transition: { id: 'transition', label: 'Transition tag', blurb: 'One year at the top-ten average; you may match any offer.' },
};

/** Dead money if the player is released or traded now. */
export function deadMoney(player) {
    const c = player?.contract;
    if (!c) return 0;
    const years = Math.max(1, c.years || 1), left = Math.max(0, c.yearsLeft ?? 1);
    const proration = (c.bonus || 0) / years * left;
    // Guarantees shrink as each season is paid.
    const guaranteed = Math.max(0, (c.guaranteed || 0) * (left / years));
    return Math.round((proration + guaranteed) * 10) / 10;
}

/** Dead money on a trade: only the signing-bonus proration travels to your cap. */
export function tradeDeadMoney(player) {
    const c = player?.contract;
    if (!c) return 0;
    const years = Math.max(1, c.years || 1), left = Math.max(0, c.yearsLeft ?? 1);
    return Math.round((c.bonus || 0) / years * left * 10) / 10;
}

/** Add a charge to a team's dead-cap ledger { [year]: $M }. */
export function chargeDeadCap(ledger = {}, year, amount) {
    if (!(amount > 0)) return ledger;
    return { ...ledger, [year]: Math.round(((ledger[year] || 0) + amount) * 10) / 10 };
}

export const deadCapFor = (ledger = {}, year) => ledger?.[year] || 0;

/** Cap used including dead money. */
export function capUsed(roster = [], ledger = {}, year) {
    return roster.reduce((n, p) => n + (Number.isFinite(p.contract?.salary) && p.contract.salary > 0 ? p.contract.salary : 2), 0) + deadCapFor(ledger, year);
}

/** Top-N average salary at a position across the league. */
function topAverage(rosters, position, n) {
    const salaries = Object.values(rosters || {}).flat().filter(p => p.position === position).map(p => p.contract?.salary || 0).sort((a, b) => b - a).slice(0, n);
    return salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 5;
}

export function tagPrice(rosters, position, type = 'franchise') {
    return Math.max(2, Math.round(topAverage(rosters, position, type === 'franchise' ? 5 : 10) * 10) / 10);
}

export const TENDERS = {
    first: { id: 'first', label: '1st-round tender', round: 1, price: p => Math.max(6, Math.round(p.ovr * 0.1)) },
    second: { id: 'second', label: '2nd-round tender', round: 2, price: p => Math.max(4, Math.round(p.ovr * 0.065)) },
    rofr: { id: 'rofr', label: 'Right of first refusal', round: null, price: p => Math.max(2, Math.round(p.ovr * 0.035)) },
};
/** Restricted free agent: three accrued seasons or fewer. */
export const isRestricted = p => (p.experience ?? Math.max(0, (p.age || 25) - 22)) <= 3 && !p.isUndrafted;

/** Rookie scale by overall pick. Matches the store's makePick formula. */
export function rookieSalary(pickNumber) {
    return Math.round(Math.max(0.8, 10 / Math.pow(1 + (pickNumber - 1) / 8, 0.7)) * 100) / 100;
}

/** The fifth-year option price for a first-rounder. */
export function fifthYearPrice(player, rosters) {
    return Math.round(tagPrice(rosters, player.position, 'transition') * 0.9 * 10) / 10;
}

/**
 * Build a structured contract. `guaranteePct` 0-1 of total value; `bonusPct`
 * 0-0.6 of total value paid as signing bonus (both change what players accept
 * and what a release costs, not the annual cap hit).
 */
export function structuredContract({ salary, years, guaranteePct = 0, bonusPct = 0, type = 'veteran', year, incentive = null }) {
    const total = salary * years;
    return {
        salary, years, yearsLeft: years, type, signedYear: year,
        guaranteed: Math.round(total * Math.max(0, Math.min(1, guaranteePct)) * 10) / 10,
        bonus: Math.round(total * Math.max(0, Math.min(0.6, bonusPct)) * 10) / 10,
        ...(incentive ? { incentive } : {}),
    };
}

/** How much a structure is worth to a player, as a multiplier on salary (1.0 = plain). */
export function structureValue(contract, prefs = {}) {
    const total = (contract.salary || 0) * (contract.years || 1) || 1;
    const g = (contract.guaranteed || 0) / total, b = (contract.bonus || 0) / total;
    const security = prefs.security ?? 0.5; // 0 (gambler) .. 1 (wants it guaranteed)
    return 1 + g * (0.1 + security * 0.2) + b * 0.08 + (contract.incentive ? 0.02 : 0);
}

export const INCENTIVES = {
    QB: { stat: 'passTds', threshold: 30, label: '30 passing TDs' },
    RB: { stat: 'rushYards', threshold: 1200, label: '1,200 rushing yards' },
    WR: { stat: 'recYards', threshold: 1100, label: '1,100 receiving yards' },
    TE: { stat: 'recYards', threshold: 800, label: '800 receiving yards' },
    DL: { stat: 'sacks', threshold: 10, label: '10 sacks' },
    LB: { stat: 'tackles', threshold: 110, label: '110 tackles' },
    CB: { stat: 'ints', threshold: 5, label: '5 interceptions' },
    S: { stat: 'ints', threshold: 4, label: '4 interceptions' },
    OL: { stat: 'games', threshold: 16, label: '16 games started' },
    K: { stat: 'fgm', threshold: 30, label: '30 field goals' },
};
export function incentiveFor(position, salary) {
    const i = INCENTIVES[position];
    return i ? { ...i, amount: Math.max(1, Math.round(salary * 0.15)) } : null;
}
