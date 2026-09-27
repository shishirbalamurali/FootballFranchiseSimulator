// ── Owner & job security ────────────────────────────────────────────────────
// Every club has an owner with a personality. Each season the owner sets goals
// sized to the roster's expectations. At season end the owner grades you,
// and trust moves. Run out of trust and you're fired, then take one of the jobs
// nobody else wants.
//
// Pure functions only: the store wraps these and the UI renders the results.

export const CAP_TOTAL = 200;
export const START_TRUST = 60;
export const REHIRE_TRUST = 55;
export const FIRE_THRESHOLD = 15;
export const YOUNG_CORE_OVR = 80;

export const OWNER_ARCHETYPES = {
    mogul: {
        id: 'mogul', title: 'The Win-Now Mogul', icon: '💰',
        blurb: 'Bought the team to hoist trophies, not to wait. Losing seasons cost you fast.',
        patience: 1.3, signature: 'division',
    },
    builder: {
        id: 'builder', title: 'The Patient Builder', icon: '🌱',
        blurb: 'Believes in drafting and developing. Forgives a rough year if the kids get better.',
        patience: 0.7, signature: 'youth',
    },
    accountant: {
        id: 'accountant', title: 'The Bottom-Line Owner', icon: '📊',
        blurb: 'Reads the cap sheet before the box score. Wants wins without bad contracts.',
        patience: 1.0, signature: 'cap',
    },
    showman: {
        id: 'showman', title: 'The Showman', icon: '🎆',
        blurb: 'Sells tickets on fireworks. Put up points and win the games that matter to the fans.',
        patience: 1.0, signature: 'points',
    },
};

const FIRST = ['Victor', 'Margaret', 'Harlan', 'Delphine', 'Cyrus', 'Loretta', 'Bennett', 'Imogen', 'Rex', 'Theodora', 'Augustus', 'Winifred'];
const LAST = ['Castellane', 'Whitmore', 'Pryce', 'Okonkwo', 'Vandermeer', 'Halloway', 'Sterling', 'Marchetti', 'Ashford', 'Blackwood', 'Kingsley', 'Duvall'];

function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** Each club's owner is fixed, so the same team always has the same owner. */
export function ownerForTeam(teamId) {
    const h = hash(String(teamId));
    const ids = Object.keys(OWNER_ARCHETYPES);
    return {
        teamId,
        archetypeId: ids[h % ids.length],
        name: `${FIRST[(h >>> 3) % FIRST.length]} ${LAST[(h >>> 7) % LAST.length]}`,
    };
}

export function createOwnerState(teamId, trust = START_TRUST) {
    return { ...ownerForTeam(teamId), trust, goals: [], goalsYear: null, reviews: [], lastReviewYear: null, fired: false, offers: [], pendingReview: null };
}

/** Rank 1 = best roster by overall rating. */
export function teamRank(teamRatings, teamId) {
    const sorted = Object.entries(teamRatings || {}).sort((a, b) => (b[1]?.overall || 0) - (a[1]?.overall || 0));
    const idx = sorted.findIndex(([id]) => id === teamId);
    return idx < 0 ? 16 : idx + 1;
}

export function expectationTier(rank) {
    if (rank <= 8) return { id: 'contender', label: 'Contender', wins: 11 };
    if (rank <= 20) return { id: 'bubble', label: 'Playoff bubble', wins: 9 };
    return { id: 'rebuild', label: 'Rebuilding', wins: 6 };
}

/** The owner's three goals for the season, weighted by importance. */
/** `baseline.youngCore` is the current count, so the youth goal asks for growth. */
export function generateSeasonGoals(archetypeId, rank, baseline = {}) {
    const tier = expectationTier(rank);
    const goals = [{ id: 'wins', kind: 'wins', target: tier.wins, weight: 3, label: `Win ${tier.wins}+ games` }];

    if (tier.id === 'contender') goals.push({ id: 'post', kind: 'playoffWins', target: 1, weight: 3, label: 'Win a playoff game' });
    else if (tier.id === 'bubble') goals.push({ id: 'post', kind: 'playoffs', target: 1, weight: 3, label: 'Make the playoffs' });
    else goals.push({ id: 'post', kind: 'divWins', target: 2, weight: 2, label: 'Win 2+ division games' });

    const sig = OWNER_ARCHETYPES[archetypeId]?.signature;
    if (sig === 'division') goals.push({ id: 'sig', kind: 'divisionRank', target: tier.id === 'rebuild' ? 2 : 1, weight: 2, label: tier.id === 'rebuild' ? 'Finish top 2 in the division' : 'Win the division' });
    else if (sig === 'youth') {
        const target = Math.max(3, (baseline.youngCore || 0) + 1);
        goals.push({ id: 'sig', kind: 'youngCore', target, weight: 2, label: `Develop ${target} players aged 25 or under into 80+ OVR` });
    }
    else if (sig === 'cap') goals.push({ id: 'sig', kind: 'capSpace', target: 10, weight: 2, label: 'Keep $10M+ in cap space' });
    else goals.push({ id: 'sig', kind: 'points', target: tier.id === 'rebuild' ? 340 : 400, weight: 2, label: `Score ${tier.id === 'rebuild' ? 340 : 400}+ points` });

    return goals;
}

function forEachBracketGame(bracket, fn) {
    if (!bracket) return;
    for (const conf of ['afc', 'nfc']) for (const round of ['wc', 'div', 'conf']) (bracket[conf]?.[round] || []).forEach(fn);
    if (bracket.sb) fn(bracket.sb);
}

/** Everything the goals are measured against, gathered from store state. */
export function buildOwnerContext(state) {
    const { userTeamId: uid, standings = {}, teams = [], playoffBracket, rosters = {}, schedule = [] } = state;
    const standing = standings[uid] || { wins: 0, losses: 0, ties: 0, pf: 0 };
    const me = teams.find(t => t.id === uid);
    const divTeams = teams.filter(t => t.conference === me?.conference && t.division === me?.division);
    const pct = s => { const g = (s?.wins || 0) + (s?.losses || 0) + (s?.ties || 0); return g ? ((s.wins || 0) + 0.5 * (s.ties || 0)) / g : 0; };
    const divisionRank = 1 + divTeams.filter(t => t.id !== uid && pct(standings[t.id]) > pct(standing)).length;

    // Head-to-head wins against division rivals, from played games.
    const divIds = new Set(divTeams.map(t => t.id).filter(id => id !== uid));
    let divWins = 0;
    const games = Array.isArray(schedule) ? schedule.flatMap(w => (Array.isArray(w) ? w : w?.games || [])) : [];
    for (const g of games) {
        if (!g?.played) continue;
        const home = g.homeTeamId === uid, away = g.awayTeamId === uid;
        if (!home && !away) continue;
        if (!divIds.has(home ? g.awayTeamId : g.homeTeamId)) continue;
        const mine = home ? g.homeScore : g.awayScore, theirs = home ? g.awayScore : g.homeScore;
        if (mine > theirs) divWins++;
    }

    let playoffWins = 0;
    forEachBracketGame(playoffBracket, g => { if (g?.played && g.winnerId === uid) playoffWins++; });
    const madePlayoffs = !!playoffBracket && [...(playoffBracket.afc?.seeds || []), ...(playoffBracket.nfc?.seeds || [])].includes(uid);

    const roster = rosters[uid] || [];
    const capUsed = roster.reduce((s, p) => s + (p.contract?.salary || p.salary || 2), 0);
    // The review runs after offseason progression has aged everyone a year,
    // so a 25-year-old at goal time still counts at 26.
    const ageCap = ['offseason', 'freeAgency', 'draft'].includes(state.phase) ? 26 : 25;
    const youngCore = roster.filter(p => (p.age || 30) <= ageCap && (p.ovr || 0) >= YOUNG_CORE_OVR).length;

    return {
        wins: standing.wins || 0, losses: standing.losses || 0, pf: standing.pf || 0,
        gamesPlayed: (standing.wins || 0) + (standing.losses || 0) + (standing.ties || 0),
        divisionRank, divWins, playoffWins, madePlayoffs,
        champion: playoffBracket?.sb?.played && playoffBracket.sb.winnerId === uid,
        capSpace: Math.round(CAP_TOTAL - capUsed), youngCore,
        seasonOver: state.phase !== 'regular',
    };
}

/**
 * Status of each goal. `final` means the season is over, so unmet goals fail.
 * Mid-season, counting goals are projected over a 17-game pace.
 */
export function evaluateGoals(goals, ctx, final = ctx.seasonOver) {
    const pace = ctx.gamesPlayed ? 17 / ctx.gamesPlayed : 0;
    return (goals || []).map(g => {
        let value, met, progress, detail, onTrack;
        switch (g.kind) {
            case 'wins':
                value = ctx.wins; met = value >= g.target; progress = value / g.target;
                onTrack = value * pace >= g.target; detail = `${value}/${g.target} wins`; break;
            case 'points':
                value = ctx.pf; met = value >= g.target; progress = value / g.target;
                onTrack = value * pace >= g.target; detail = `${value}/${g.target} pts`; break;
            case 'divWins':
                value = ctx.divWins; met = value >= g.target; progress = value / g.target;
                onTrack = met || ctx.gamesPlayed < 12; detail = `${value}/${g.target} division wins`; break;
            case 'divisionRank':
                value = ctx.divisionRank; met = value <= g.target; progress = met ? 1 : g.target / value;
                onTrack = met; detail = `Currently ${ordinal(value)} in division`; break;
            case 'playoffs':
                met = ctx.madePlayoffs; progress = met ? 1 : Math.min(0.95, ctx.wins / 10);
                onTrack = met || ctx.wins * pace >= 10; detail = met ? 'Clinched a berth' : `${ctx.wins} wins so far`; break;
            case 'playoffWins':
                value = ctx.playoffWins; met = value >= g.target; progress = met ? 1 : Math.min(0.9, ctx.wins / 12);
                onTrack = met || (!ctx.seasonOver && ctx.wins * pace >= 11); detail = ctx.madePlayoffs ? `${value} playoff win${value === 1 ? '' : 's'}` : 'Need a postseason berth first'; break;
            case 'youngCore':
                value = ctx.youngCore; met = value >= g.target; progress = value / g.target;
                onTrack = met; detail = `${value}/${g.target} young standouts`; break;
            case 'capSpace':
                value = ctx.capSpace; met = value >= g.target; progress = value <= 0 ? 0 : value / g.target;
                onTrack = met; detail = value < 0 ? `$${-value}M over the cap` : `$${value}M in space`; break;
            default:
                met = false; progress = 0; onTrack = false; detail = '';
        }
        const status = met ? 'met' : final ? 'failed' : onTrack ? 'on-track' : 'behind';
        return { ...g, status, progress: Math.max(0, Math.min(1, progress || 0)), detail };
    });
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const GRADES = [[0.9, 'A'], [0.72, 'B'], [0.5, 'C'], [0.3, 'D'], [0, 'F']];

/** Weighted goal score (0–1) → trust change. On-track goals count half. */
export function scoreGoals(evaluated) {
    const total = evaluated.reduce((s, g) => s + g.weight, 0) || 1;
    const earned = evaluated.reduce((s, g) => s + g.weight * (g.status === 'met' ? 1 : g.status === 'on-track' ? 0.5 : g.progress * 0.3), 0);
    return earned / total;
}

export function trustDelta(score, archetypeId, champion = false) {
    const patience = OWNER_ARCHETYPES[archetypeId]?.patience ?? 1;
    const raw = (score - 0.5) * 40;
    return Math.round(raw < 0 ? raw * patience : raw / patience) + (champion ? 15 : 0);
}

export function securityLevel(trust) {
    if (trust >= 70) return { id: 'secure', label: 'Secure', tone: 'positive' };
    if (trust >= 45) return { id: 'stable', label: 'Stable', tone: 'info' };
    if (trust >= 25) return { id: 'warm', label: 'Seat warming', tone: 'warning' };
    return { id: 'hot', label: 'Hot seat', tone: 'negative' };
}

/** Where trust would land if the season ended with the current pace. */
export function projectTrust(owner, ctx) {
    if (!owner?.goals?.length) return { trust: owner?.trust ?? START_TRUST, delta: 0, goals: [] };
    const goals = evaluateGoals(owner.goals, ctx, false);
    const delta = trustDelta(scoreGoals(goals), owner.archetypeId, ctx.champion);
    return { trust: clamp(owner.trust + delta), delta, goals };
}

const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

const VERDICTS = {
    A: ["An outstanding year. The owner is already talking about an extension.", "You exceeded every expectation. The building believes in you."],
    B: ["A good season. The owner is pleased with the direction.", "Solid work. A few boxes left unchecked, but trust is growing."],
    C: ["A mixed year. The owner expects more next season.", "Some progress, some disappointment. The patience isn't unlimited."],
    D: ["A disappointing season. The owner made the frustration clear.", "Too many missed targets. Next year needs to look very different."],
    F: ["A failed season. The owner is questioning the whole plan.", "Nothing went right. You're coaching for your job now."],
};

/** Final season review. Returns the updated owner state. */
export function reviewSeason(owner, ctx, year) {
    const goals = evaluateGoals(owner.goals, ctx, true);
    const score = scoreGoals(goals);
    const grade = GRADES.find(([min]) => score >= min)[1];
    const delta = trustDelta(score, owner.archetypeId, ctx.champion);
    const trust = clamp(owner.trust + delta);
    const fired = trust < FIRE_THRESHOLD;
    const pool = VERDICTS[grade];
    const verdict = ctx.champion ? 'Champions! The owner is having the trophy engraved with your name.' : pool[year % pool.length];
    const review = { year, grade, score: Math.round(score * 100), delta, trustBefore: owner.trust, trustAfter: trust, goals, verdict, fired, record: `${ctx.wins}-${ctx.losses}` };
    return {
        ...owner, trust, fired, lastReviewYear: year,
        reviews: [...(owner.reviews || []), { year, grade, delta, trustAfter: trust, record: review.record }].slice(-20),
        pendingReview: review,
    };
}

/** Clubs willing to hire a fired coach: the weakest rosters, excluding your old team. */
export function jobOffers(teamRatings, excludeTeamId, count = 3) {
    return Object.entries(teamRatings || {})
        .filter(([id]) => id !== excludeTeamId)
        .sort((a, b) => (a[1]?.overall || 0) - (b[1]?.overall || 0))
        .slice(0, count)
        .map(([id]) => id);
}
