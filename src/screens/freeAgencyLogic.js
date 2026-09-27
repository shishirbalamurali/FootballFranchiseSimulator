// Free-agency negotiation logic, lifted out of FreeAgency.jsx.
// Calibrated game balance — the UI rewrite must not change these odds.

export function evaluateOffer(fa, offerAmount) {
    const asking = fa.contract?.salary || 5;
    const ratio = offerAmount / asking;
    const teamCount = parseInt(fa.interest) || 3;
    const competition = Math.min(1, teamCount / 8);
    let baseProb = ratio >= 1.30 ? 0.97 : ratio >= 1.15 ? 0.92 : ratio >= 1.0 ? 0.82
        : ratio >= 0.92 ? 0.62 : ratio >= 0.82 ? 0.35 : ratio >= 0.72 ? 0.15 : 0.03;
    return Math.random() < baseProb * (1 - competition * 0.35);
}

export function getRejectReason(fa, offerAmount) {
    const ratio = offerAmount / (fa.contract?.salary || 5);
    const teamCount = parseInt(fa.interest) || 3;
    if (ratio < 0.80) return 'The offer was too far below market value.';
    if (teamCount >= 5) return `${fa.name} had multiple competitive offers and signed elsewhere.`;
    return `${fa.name} chose a better fit elsewhere.`;
}

export function getOvrRange(prospect) {
    const seed = prospect.id.charCodeAt(0) + (prospect.id.charCodeAt(2) || 0);
    return `${Math.max(40, prospect.ovr - 4 - (seed % 5))}–${Math.min(99, prospect.ovr + 3 + ((seed >> 2) % 4))}`;
}

// Compare FA vs user's best at that position
export function getRosterBadge(fa, userRoster) {
    const posPlayers = userRoster.filter(p => p.position === fa.position).sort((a, b) => b.ovr - a.ovr);
    if (posPlayers.length === 0) return { label: 'Roster need', tone: 'negative' };
    const best = posPlayers[0].ovr;
    const diff = fa.ovr - best;
    if (diff >= 5) return { label: `Upgrade +${diff}`, tone: 'positive' };
    if (diff >= 2) return { label: `+${diff} OVR`, tone: 'positive' };
    if (diff >= -2) return { label: 'Similar', tone: 'info' };
    if (posPlayers.length < 2) return { label: 'Depth', tone: 'warning' };
    return { label: 'Backup', tone: 'neutral' };
}

