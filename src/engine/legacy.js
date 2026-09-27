// ── Franchise legacy: achievements ──────────────────────────────────────────
// Unlockable milestones that reward how you play, not only whether you win.
// Each check reads a context assembled from store state. Unlocks are permanent
// and follow the coach, not the club, so a firing never erases them.
//
// Pure functions only. The store keeps `achievements: { [id]: { year, week, teamId } }`
// and `legacyMeta: { tenure: [{ teamId, from }] }`.

export const ACHIEVEMENT_TIERS = {
    bronze: { label: 'Bronze', points: 10 },
    silver: { label: 'Silver', points: 25 },
    gold:   { label: 'Gold',   points: 50 },
    legend: { label: 'Legend', points: 100 },
};

const titles = ctx => ctx.history.filter(h => h.champion).length;

export const ACHIEVEMENTS = [
    // In-season moments
    { id: 'first-win',      icon: '🏈', tier: 'bronze', title: 'Off the Schneid',    desc: 'Win your first game.',                          check: c => c.games.some(g => g.won) },
    { id: 'shutout',        icon: '🧱', tier: 'silver', title: 'Brick Wall',         desc: 'Hold an opponent scoreless.',                   check: c => c.games.some(g => g.won && g.theirs === 0) },
    { id: 'fifty-burger',   icon: '🔥', tier: 'silver', title: 'Fifty Burger',       desc: 'Score 50 or more points in a game.',            check: c => c.games.some(g => g.mine >= 50) },
    { id: 'blowout',        icon: '💥', tier: 'bronze', title: 'Statement Game',     desc: 'Win by 28 or more.',                            check: c => c.games.some(g => g.mine - g.theirs >= 28) },
    { id: 'nail-biter',     icon: '😅', tier: 'bronze', title: 'Heart Attack Kids',  desc: 'Win a game by a single point.',                 check: c => c.games.some(g => g.mine - g.theirs === 1) },
    { id: 'streak-5',       icon: '📈', tier: 'silver', title: 'Heating Up',         desc: 'Win 5 games in a row.',                         check: c => c.bestStreak >= 5 },
    { id: 'streak-10',      icon: '🚀', tier: 'gold',   title: 'Unstoppable',        desc: 'Win 10 games in a row.',                        check: c => c.bestStreak >= 10 },

    // Season results
    { id: 'winning-season', icon: '✅', tier: 'bronze', title: 'Above Water',        desc: 'Finish a regular season with a winning record.', check: c => c.history.some(h => h.wins > h.losses) },
    { id: 'twelve-wins',    icon: '💪', tier: 'silver', title: 'Juggernaut',         desc: 'Win 12+ regular-season games.',                 check: c => c.history.some(h => h.wins >= 12) },
    { id: 'perfect',        icon: '💎', tier: 'legend', title: 'Perfection',         desc: 'Go undefeated in the regular season.',          check: c => c.history.some(h => h.wins >= 17 && h.losses === 0) },
    { id: 'playoffs',       icon: '🎟️', tier: 'bronze', title: 'Dancing in January', desc: 'Make the playoffs.',                            check: c => c.madePlayoffs || c.history.some(h => h.playoffs) },
    { id: 'playoff-win',    icon: '⚔️', tier: 'silver', title: 'Survive and Advance', desc: 'Win a playoff game.',                          check: c => c.playoffWins >= 1 || c.history.some(h => h.finalist || h.champion) },
    { id: 'finalist',       icon: '🏟️', tier: 'gold',   title: 'Title Game',         desc: 'Reach the championship game.',                  check: c => c.history.some(h => h.finalist || h.champion) },
    { id: 'champion',       icon: '🏆', tier: 'gold',   title: 'World Champions',    desc: 'Win the championship.',                         check: c => titles(c) >= 1 },
    { id: 'back-to-back',   icon: '👑', tier: 'legend', title: 'Back-to-Back',       desc: 'Win consecutive championships.',                check: c => c.history.some((h, i) => h.champion && c.history[i + 1]?.champion) },
    { id: 'dynasty',        icon: '🏛️', tier: 'legend', title: 'Dynasty',            desc: 'Win 3 championships.',                          check: c => titles(c) >= 3 },
    { id: 'turnaround',     icon: '🔄', tier: 'gold',   title: 'Worst to First',     desc: 'Win 11+ games the season after winning 5 or fewer.', check: c => c.history.some((h, i) => i > 0 && h.wins >= 11 && c.history[i - 1].wins <= 5) },

    // Front office and career
    { id: 'owner-a',        icon: '🤝', tier: 'silver', title: "Owner's Favorite",   desc: 'Earn an A in an owner review.',                 check: c => c.reviews.some(r => r.grade === 'A') },
    { id: 'survivor',       icon: '🧳', tier: 'silver', title: 'Second Chances',     desc: 'Get fired, then take a new job.',               check: c => c.teamsCoached >= 2 },
    { id: 'five-seasons',   icon: '📅', tier: 'silver', title: 'Lifer',              desc: 'Complete 5 seasons.',                           check: c => c.history.length >= 5 },
    { id: 'ten-seasons',    icon: '🗿', tier: 'legend', title: 'Institution',        desc: 'Complete 10 seasons.',                          check: c => c.history.length >= 10 },
    { id: 'draft-hit',      icon: '🎯', tier: 'gold',   title: 'Draft Whisperer',    desc: 'Develop a player you drafted into 85+ OVR.',    check: c => c.roster.some(p => p.draftedByUser && (p.ovr || 0) >= 85) },
    { id: 'superstar',      icon: '⭐', tier: 'gold',   title: 'Superstar',          desc: 'Have a 95+ OVR player on your roster.',         check: c => c.roster.some(p => (p.ovr || 0) >= 95) },
];

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
export const achievementById = id => BY_ID.get(id);

function forEachBracketGame(bracket, fn) {
    if (!bracket) return;
    for (const conf of ['afc', 'nfc']) for (const round of ['wc', 'div', 'conf']) (bracket[conf]?.[round] || []).forEach(fn);
    if (bracket.sb) fn(bracket.sb);
}

/** Everything the checks read, gathered from store state. */
export function buildLegacyContext(state) {
    const uid = state.userTeamId;
    const games = [];
    const weeks = Array.isArray(state.schedule) ? state.schedule : [];
    for (const week of weeks) for (const g of (Array.isArray(week) ? week : [])) {
        if (!g?.played || (g.homeTeamId !== uid && g.awayTeamId !== uid)) continue;
        const home = g.homeTeamId === uid;
        const mine = (home ? g.homeScore : g.awayScore) ?? 0, theirs = (home ? g.awayScore : g.homeScore) ?? 0;
        games.push({ mine, theirs, won: mine > theirs });
    }
    let playoffWins = 0;
    forEachBracketGame(state.playoffBracket, g => {
        if (!g?.played || (g.homeTeamId !== uid && g.awayTeamId !== uid)) return;
        const home = g.homeTeamId === uid;
        const mine = (home ? g.homeScore : g.awayScore) ?? 0, theirs = (home ? g.awayScore : g.homeScore) ?? 0;
        games.push({ mine, theirs, won: g.winnerId === uid });
        if (g.winnerId === uid) playoffWins++;
    });

    let run = 0, bestStreak = 0;
    for (const g of games) { run = g.won ? run + 1 : 0; bestStreak = Math.max(bestStreak, run); }

    // History entries don't name the club, so `tenure` ([{ teamId, from }], kept by
    // the store) maps each season to the team you coached that year.
    const tenure = state.legacyMeta?.tenure?.length ? state.legacyMeta.tenure : [{ teamId: uid, from: 0 }];
    const teamFor = year => [...tenure].reverse().find(t => year >= t.from)?.teamId || uid;
    const history = (state.seasonHistory || []).map(h => {
        const team = teamFor(h.year);
        const r = h.seasonRecap || {};
        return {
            year: h.year, wins: h.record?.wins || 0, losses: h.record?.losses || 0,
            playoffs: (r.playoffTeams || []).includes(team),
            champion: r.winner === team,
            finalist: r.finalist === team,
        };
    });

    const madePlayoffs = !!state.playoffBracket && [...(state.playoffBracket.afc?.seeds || []), ...(state.playoffBracket.nfc?.seeds || [])].includes(uid);
    const coached = new Set(tenure.map(t => t.teamId));
    const picks = [...(state.draftArchive || []).flatMap(d => d.picks || []), ...(state.draftHistory || [])];
    const draftedIds = new Set(picks.filter(p => coached.has(p.teamId)).map(p => p.player?.id).filter(Boolean));
    const roster = (state.rosters?.[uid] || []).map(p => ({ ...p, draftedByUser: draftedIds.has(p.id) }));

    return {
        games, bestStreak, playoffWins, madePlayoffs, history, roster,
        reviews: state.owner?.reviews || [],
        teamsCoached: coached.size,
    };
}

/** Ids that pass their check and aren't unlocked yet. */
export function newlyUnlocked(state, unlocked = {}) {
    const ctx = buildLegacyContext(state);
    return ACHIEVEMENTS.filter(a => !unlocked[a.id] && safeCheck(a, ctx)).map(a => a.id);
}

function safeCheck(a, ctx) {
    try { return !!a.check(ctx); } catch { return false; }
}

export function legacyScore(unlocked = {}) {
    return Object.keys(unlocked).reduce((s, id) => s + (ACHIEVEMENT_TIERS[BY_ID.get(id)?.tier]?.points || 0), 0);
}
