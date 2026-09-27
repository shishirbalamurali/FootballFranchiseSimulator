// Trade valuation and CPU GM logic, lifted out of TradeCenter.jsx.
// This is calibrated game balance — the UI rewrite must not touch it.

import { TEAMS } from '../data/teams.js';
import { pickNumberValue } from '../engine/assetValue.js'; // CLAUDE

// ── Draft pick trade values: one chart, in engine/assetValue.js ─────
export function getPickValue(round, pickNum) {
    // CLAUDE: delegates to the single pick chart in assetValue.js.
    return pickNumberValue((Math.max(1, round) - 1) * 32 + Math.max(1, Math.min(32, pickNum || 16)));
}

// ── NFL-calibrated player trade values ───────────────────────────
// Position multipliers reflect real NFL scarcity/demand
const POS_MULT = {
    QB: 2.2, LT: 1.8, EDGE: 1.6, DE: 1.55, DL: 1.4,
    WR: 1.45, CB: 1.45, LB: 1.2, TE: 1.3, RG: 1.5, LG: 1.45,
    RB: 0.85, OL: 1.35, S: 1.1, K: 0.3, P: 0.25,
};

// OVR → base value (exponential — elite players are MUCH more valuable)
export function ovrToBase(ovr) {
    if (ovr >= 97) return 3200;
    if (ovr >= 94) return 2400;
    if (ovr >= 91) return 1700;
    if (ovr >= 88) return 1200;
    if (ovr >= 85) return 850;
    if (ovr >= 82) return 580;
    if (ovr >= 79) return 380;
    if (ovr >= 76) return 230;
    if (ovr >= 73) return 140;
    if (ovr >= 70) return 80;
    return 40;
}

export function getPlayerValue(player) {
    if (!player) return 0;
    const base    = ovrToBase(player.ovr || 70);
    const posMult = POS_MULT[player.position] || 1.0;
    const age     = player.age || 26;
    // Young + elite = massive premium (like Mahomes trade)
    const ageMult = age <= 22 ? 1.5 : age <= 24 ? 1.35 : age <= 26 ? 1.15
                  : age <= 28 ? 1.0 : age <= 30 ? 0.85 : age <= 32 ? 0.65 : 0.45;
    const devMult = player.devTrait === 'Superstar X-Factor' ? 1.25
                  : player.devTrait === 'Superstar' ? 1.15
                  : player.devTrait === 'Star' ? 1.07 : 1.0;
    // Contract years remaining bonus
    const yearsLeft = player.contract?.yearsLeft ?? 2;
    const contractMult = yearsLeft >= 4 ? 1.1 : yearsLeft >= 3 ? 1.0 : yearsLeft >= 2 ? 0.92 : 0.78;
    return Math.round(base * posMult * ageMult * devMult * contractMult);
}

// Cap hit display ($M)
export function capHitStr(player) {
    const sal = player.contract?.salary;
    if (!sal) return null;
    return `$${sal}M`;
}

// Salary cap = 200 (units) per team
const CAP_LIMIT = 200;
export function getCapUsed(roster) {
    return (roster || []).reduce((s, p) => s + (p.contract?.salary || 2), 0);
}

// ── Position needs (top 5 like Madden) ──────────────────────────
const ALL_POSITIONS = ['QB','WR','RB','TE','OL','LT','DE','DL','LB','CB','S'];
export function getTopNeeds(roster) {
    const counts = {};
    ALL_POSITIONS.forEach(p => { counts[p] = 0; });
    (roster || []).forEach(p => {
        const pos = p.position;
        counts[pos] = (counts[pos] || 0) + 1;
    });
    // Weight by position importance and scarcity
    const needs = Object.entries(counts).map(([pos, cnt]) => {
        const ideal = pos === 'OL' ? 5 : pos === 'WR' ? 4 : pos === 'CB' ? 3 : pos === 'LB' ? 3 : pos === 'DL' || pos === 'DE' ? 3 : 2;
        const shortage = Math.max(0, ideal - cnt);
        const score = shortage * (POS_MULT[pos] || 1.0);
        return { pos, score, cnt };
    });
    return needs.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ── OVR grade colors (matching the game's existing ovr- classes) ──
export function ovrGrade(ovr) {
    if (ovr >= 90) return { label: 'A+', color: '#7c3aed' };
    if (ovr >= 85) return { label: 'A',  color: '#16a34a' };
    if (ovr >= 80) return { label: 'B+', color: '#2563eb' };
    if (ovr >= 75) return { label: 'B',  color: '#d97706' };
    return { label: 'C', color: '#dc2626' };
}

// ── CPU acceptance logic (realistic NFL GM) ──────────────────────
export function evaluateOffer({ offerValue, receiveValue, cpuTeamId, cpuRoster, theirPlayerIds, myPlayerIds, userRoster, teamRatings }) {
    if (!cpuTeamId || offerValue === 0) return { result: 'rejected', reason: 'No offer made.' };

    const cpuOvr  = teamRatings?.[cpuTeamId]?.overall || 74;
    const isContender   = cpuOvr >= 80;
    const isRebuilding  = cpuOvr <= 70;

    // CPU values its own players slightly higher (seller premium)
    let adjustedReceive = receiveValue * 0.90;

    // Rebuilding teams: picks get 20% premium, current players 10% discount
    if (isRebuilding) {
        // If offer includes picks, treat them as more valuable
        adjustedReceive *= 0.95; // they want LOTS for their players
    }

    // Contenders: quality players get premium, picks discounted (win-now mode)
    if (isContender) {
        const theirHighOvr = theirPlayerIds.reduce((max, id) => {
            const p = cpuRoster.find(x => x.id === id);
            return Math.max(max, p?.ovr || 0);
        }, 0);
        if (theirHighOvr >= 88) adjustedReceive *= 1.1; // star player premium
    }

    // Does the incoming offer fill a top need?
    const cpuNeeds = getTopNeeds(cpuRoster);
    const topNeedPositions = new Set(cpuNeeds.slice(0,3).map(n => n.pos));
    const fillsNeed = myPlayerIds.some(id => {
        const p = userRoster.find(x => x.id === id);
        return p && topNeedPositions.has(p.position);
    });
    if (fillsNeed) adjustedReceive *= 0.92; // easier to accept when it fills a need

    // QB protection: teams rarely trade starting QBs
    const tradingQB = theirPlayerIds.some(id => {
        const p = cpuRoster.find(x => x.id === id);
        return p?.position === 'QB' && (p?.ovr || 0) >= 80;
    });
    if (tradingQB) adjustedReceive *= 1.25; // massive QB premium

    const ratio = offerValue / Math.max(1, adjustedReceive);
    // Add small random variance (GMs make slightly different decisions)
    const variance = 0.88 + Math.random() * 0.18;
    const finalRatio = ratio * variance;

    if (finalRatio >= 0.90) return { result: 'accepted', reason: 'Fair deal.' };
    if (finalRatio >= 0.72) return { result: 'rejected', reason: 'Close, but not enough value. Add a pick or upgrade the player.' };
    if (finalRatio >= 0.50) return { result: 'rejected', reason: 'Not enough value. Try offering more.' };
    return { result: 'rejected', reason: `${TEAMS.find(t=>t.id===cpuTeamId)?.name || 'CPU'} isn't interested in this deal.` };
}

export { TRADE_DEADLINE_WEEK } from '../engine/leagueRules.js';

