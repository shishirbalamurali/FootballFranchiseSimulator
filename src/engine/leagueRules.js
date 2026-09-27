// Shared simulation rules. UI and store actions must use the same boundary.
export const TRADE_DEADLINE_WEEK = 11;
export function tradesOpen(phase, week) {
    return ['offseason', 'freeAgency', 'preseason'].includes(phase)
        || (phase === 'regular' && Number.isInteger(week) && week >= 1 && week <= TRADE_DEADLINE_WEEK);
}
export function validContractOffer(salary, years) {
    return Number.isFinite(salary) && salary >= 0.1 && Number.isInteger(years) && years >= 1 && years <= 6;
}
