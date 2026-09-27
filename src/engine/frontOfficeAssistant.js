import { askingSalary } from './progression';
import { POSITION_MINIMUMS } from './player';
export const ASSISTANT_DEFAULTS = { contracts: false, cap: false, reserve: 10, maxSalary: 20, maxYears: 3, protectedIds: [] };
export function assistantPlan(roster = [], settings = ASSISTANT_DEFAULTS) {
    const policy = { ...ASSISTANT_DEFAULTS, ...settings };
    let projected = roster.map(p => ({ ...p, contract: { ...p.contract } }));
    const actions = [], notices = [];
    const total = () => projected.reduce((s, p) => s + (p.contract?.salary || 2), 0);
    const protectedIds = new Set(policy.protectedIds);
    if (policy.cap) {
        // Preserve positional starters, explicit protections and a 46-player floor.
        const starters = new Set();
        for (const pos of new Set(roster.map(p => p.position))) projected.filter(p => p.position === pos).sort((a,b) => b.ovr-a.ovr).slice(0, POSITION_MINIMUMS[pos] || 1).forEach(p => starters.add(p.id));
        const candidates = [...projected].filter(p => !protectedIds.has(p.id) && !starters.has(p.id)).sort((a,b) => (b.contract?.salary || 2) - (a.contract?.salary || 2));
        for (const p of candidates) {
            if (total() <= 200 - policy.reserve || projected.length <= 46) break;
            projected = projected.filter(x => x.id !== p.id);
            actions.push({ type: 'release', playerId: p.id, name: p.name, salary: p.contract?.salary || 2, reason: 'Release depth to restore your cap reserve; positional starters are protected.' });
        }
        if (total() > 200 - policy.reserve) notices.push('Reserve cannot be met safely. Review protected players and starter contracts manually.');
    }
    if (policy.contracts) for (const p of [...projected].sort((a,b) => b.ovr-a.ovr)) {
        if ((p.contract?.yearsLeft ?? 1) > 1 || p.ovr < 65 || protectedIds.has(p.id)) continue;
        const years = Math.min(policy.maxYears, p.age >= 30 ? 2 : 3);
        const salary = Math.max(1, Math.round(askingSalary(p) * (years <= 2 ? 0.9 : 1) * 10) / 10);
        if (salary > policy.maxSalary || total() - (p.contract?.salary || 2) + salary > 200 - policy.reserve) { notices.push(`${p.name}: renewal exceeds your salary limit or reserve; left for you.`); continue; }
        p.contract = { salary, years, yearsLeft: years };
        actions.push({ type: 'extend', playerId: p.id, name: p.name, salary, years, reason: 'Expiring contributor, market-rate offer within your limits.' });
    }
    return { actions, notices, capBefore: roster.reduce((s,p) => s+(p.contract?.salary || 2),0), capAfter: total() };
}
