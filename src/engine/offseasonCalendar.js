// Offseason calendar (Claude-owned). The existing phases stay the source of
// truth (playoffs → offseason → freeAgency → draft → regular); stages are the
// beats inside them. Each stage says where to go, what's left, and whether
// "Advance" can auto-resolve it.

export const STAGES = [
    { id: 'review', phase: 'offseason', label: 'Season review', short: 'Review', icon: '🏆', screen: 'command', blurb: 'Awards, X-Factor awakenings, Black Monday and early declarations.' },
    { id: 'resign', phase: 'offseason', label: 'Re-sign & tag', short: 'Re-sign', icon: '✍️', screen: 'resign', blurb: 'Keep, tag, tender or let go of your expiring players before the market opens.' },
    { id: 'combine', phase: 'offseason', label: 'Combine', short: 'Combine', icon: '⏱️', screen: 'bigBoard', blurb: 'The class tests. Medicals and interviews.' },
    { id: 'fa', phase: 'freeAgency', label: 'Free agency', short: 'FA', icon: '💼', screen: 'freeAgency', blurb: 'Four days on the open market.' },
    { id: 'prodays', phase: 'freeAgency', label: 'Pro days & visits', short: 'Visits', icon: '🏟️', screen: 'bigBoard', blurb: 'Private workouts and the final board.' },
    { id: 'draft', phase: 'draft', label: 'Draft weekend', short: 'Draft', icon: '🎙️', screen: 'draft', blurb: 'Three nights, seven rounds.' },
    { id: 'udfa', phase: 'draft', label: 'Undrafted scramble', short: 'UDFA', icon: '📋', screen: 'draft', blurb: 'Bid for the best undrafted players.' },
    { id: 'camp', phase: 'regular', label: 'Camp reveal', short: 'Camp', icon: '🔍', screen: 'command', blurb: 'How right were your scouts?' },
];
export const STAGE_BY_ID = Object.fromEntries(STAGES.map(s => [s.id, s]));

const done = (fo, year, id) => !!fo?.stagesDone?.[`${year}:${id}`];

/** The current stage given the phase and what's been completed. */
export function currentStage(state) {
    const fo = state.frontOffice;
    const y = state.year;
    switch (state.phase) {
        case 'offseason': return !done(fo, y, 'review') ? 'review' : !done(fo, y, 'resign') ? 'resign' : 'combine';
        case 'freeAgency': return state.faMarket?.closed ? 'prodays' : 'fa';
        case 'draft': return (state.currentPickIndex || 0) >= (state.draftOrder?.length || 1) ? 'udfa' : 'draft';
        case 'regular': return fo?.camp && !fo.camp.seen && fo.camp.year === y ? 'camp' : null;
        default: return null;
    }
}

export function stageTimeline(state) {
    const cur = currentStage(state);
    const idx = STAGES.findIndex(s => s.id === cur);
    return STAGES.map((s, i) => ({ ...s, status: cur == null ? (state.phase === 'regular' ? 'done' : 'upcoming') : i < idx ? 'done' : i === idx ? 'current' : 'upcoming' }));
}

export const markStage = (fo, year, id) => ({ ...fo, stagesDone: { ...(fo?.stagesDone || {}), [`${year}:${id}`]: true } });
