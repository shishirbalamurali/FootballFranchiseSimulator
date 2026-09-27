// Scouting department (Claude-owned). Pure functions; the store wraps them.
//
// Nobody sees a prospect's true ratings. Each team sees
//     truth + noise(prospect, team) × (1 − k/100) + bias
// where k (0-100) is how much that team knows about him. Noise is derived
// from ids, so it costs no save bytes, never changes on reload, and differs
// team to team: that's why the CPU reaches, slides and steals happen.
//
// The user's department is stored as `scouting` (see defaultScouting). CPU
// knowledge is derived: every club has watched the obvious names.
import { hashSeed, seededRng } from './seededRandom.js';
import { scoutProfile, REGIONS, biasInfo } from './people.js';
import { regionOfSchool } from './collegeSeason.js';
import { calculatePositionNeeds } from './draft.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const OVR_SD = 6, POT_SD = 7;
export const BASE_KNOWLEDGE = 10; // everyone has seen some tape
export const INTERVIEW_SLOTS = 15;
export const VISIT_SLOTS = 10;

/** Standard-normal draw keyed by a string. */
function gauss(key) {
    const r = seededRng(key);
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── The department ───────────────────────────────────────────────────────────
export function defaultScouting(teamId, year) {
    const seed = `${teamId}:${year}`;
    const scouts = [
        { id: `sc-${seed}-dir`, role: 'director', region: null },
        ...REGIONS.slice(0, 3).map((region, i) => ({ id: `sc-${seed}-a${i}`, role: 'area', region })),
        { id: `sc-${seed}-nat`, role: 'national', region: null },
    ];
    return {
        teamId, scouts, knowledge: {}, proKnowledge: {}, crossChecked: {}, assignments: {},
        interviews: [], visits: [], combineYear: null, board: { order: [], tiers: {} },
        hitRates: {}, reveals: [], lastWeek: null, year,
    };
}

/** Scout record { id, role, region } → full profile with derived traits. */
export const scoutOf = s => ({ ...scoutProfile(s.id, s.role, s.region), ...s, region: s.region ?? (s.role === 'area' ? 'Northeast' : null) });

export function knowledgeOf(scouting, id) {
    return clamp(Math.max(BASE_KNOWLEDGE, scouting?.knowledge?.[id] || 0), 0, 100);
}

/** Knowledge a CPU club has of a prospect: derived, 25-70. */
export function cpuKnowledge(teamId, prospect) {
    const h = hashSeed(`cpuk:${teamId}:${prospect.id}`) % 30;
    const star = (prospect.collegeRecruitTier === 'Elite' || prospect.collegeRecruitTier === 'Generational') ? 15 : 0;
    return 25 + h + star;
}

// ── Bias ─────────────────────────────────────────────────────────────────────
// A scout's bias shifts his read of a player in his region, until the
// director cross-checks that player.
function biasShift(biasId, p) {
    const u = p.attributes?.universal || {};
    switch (biasId) {
        case 'speed': return ((u.speed || 75) - 75) / 5;
        case 'size': return ((u.strength || 70) - 72) / 6;
        case 'production': return (hashSeed(`prod:${p.id}`) % 7) - 3;
        case 'smallSchool': return p.collegeProfile?.competition === 'Group of Five / FCS' ? -3 : 0;
        case 'qbBlind': return p.position === 'QB' ? gauss(`qbb:${p.id}`) * 4 : 0;
        default: return 0;
    }
}

/** The scout responsible for a prospect's region (area) or the national scout. */
export function scoutFor(scouting, prospect) {
    const region = regionOfSchool(prospect.college || prospect.school);
    const scouts = (scouting?.scouts || []).map(scoutOf);
    return scouts.find(s => s.role === 'area' && s.region === region) || scouts.find(s => s.role === 'national') || scouts[0] || null;
}

// ── Perception ───────────────────────────────────────────────────────────────
/**
 * What a team believes about a prospect.
 * @returns {{ ovr, pot, lo, hi, potLo, potHi, grade, k, width }}
 */
export function perceive(prospect, { teamId, k, biasId = null }) {
    const fog = 1 - clamp(k, 0, 100) / 100;
    const shift = biasId ? biasShift(biasId, prospect) * fog : 0;
    const trueOvr = prospect.ovr || 60, truePot = prospect.pot || trueOvr;
    const ovr = Math.round(clamp(trueOvr + gauss(`n:${prospect.id}:${teamId}:o`) * OVR_SD * fog + shift, 35, 95));
    const pot = Math.round(clamp(Math.max(ovr, truePot + gauss(`n:${prospect.id}:${teamId}:p`) * POT_SD * fog + shift), 40, 99));
    const width = Math.max(2, Math.round(12 * fog));
    const potWidth = Math.max(2, Math.round(14 * fog));
    return {
        ovr, pot, k: Math.round(k), width,
        lo: clamp(ovr - width, 30, 99), hi: clamp(ovr + width, 30, 99),
        potLo: clamp(pot - potWidth, 30, 99), potHi: clamp(pot + potWidth, 30, 99),
        grade: Math.round(ovr * 0.45 + pot * 0.55),
    };
}

/** The user's view of a prospect. */
export function userView(prospect, scouting, userTeamId) {
    const k = knowledgeOf(scouting, prospect.id);
    const scout = scoutFor(scouting, prospect);
    const biasId = scouting?.crossChecked?.[prospect.id] ? null : scout?.bias;
    return { ...perceive(prospect, { teamId: userTeamId, k, biasId }), scout };
}

/** A CPU club's view (its own noise and knowledge). */
export function cpuView(prospect, teamId) {
    return perceive(prospect, { teamId, k: cpuKnowledge(teamId, prospect) });
}

/** A copy of the class with `grade`/`ovr`/`pot` replaced by one team's beliefs. */
export function boardFor(teamId, draftClass) {
    return draftClass.map(p => {
        const v = cpuView(p, teamId);
        return { ...p, grade: v.grade, ovr: v.ovr, pot: v.pot, _trueId: p.id };
    });
}

/**
 * League consensus: average CPU grade → rank and projected pick range.
 * Returns Map(id → { grade, rank, lo, hi }).
 */
// How the league values positions on draft day (mirrors draft.js POSITION_VALUE).
export const DRAFT_POSITION_VALUE = { QB: 1.5, DL: 1.45, WR: 1.35, CB: 1.3, OL: 1.25, LB: 1.15, S: 1.1, TE: 1.05, RB: 0.95, K: 0.5, P: 0.5 };

export function consensus(draftClass, teamIds) {
    const rows = draftClass.map(p => {
        const grades = teamIds.map(t => cpuView(p, t).grade).sort((a, b) => a - b);
        const avg = grades.reduce((a, b) => a + b, 0) / (grades.length || 1);
        // Mock drafts rank by grade AND positional value, the way clubs draft.
        const value = avg * (0.75 + 0.25 * (DRAFT_POSITION_VALUE[p.position] || 1));
        return { id: p.id, grade: Math.round(avg * 10) / 10, value, spreadLo: grades[Math.floor(grades.length * 0.2)] ?? avg, spreadHi: grades[Math.floor(grades.length * 0.8)] ?? avg };
    }).sort((a, b) => b.value - a.value);
    const out = new Map();
    rows.forEach((r, i) => {
        // How far teams disagree maps to how wide the draft range is.
        const spread = Math.max(2, Math.round((r.spreadHi - r.spreadLo) * 2.5 + i * 0.12));
        out.set(r.id, { grade: r.grade, rank: i + 1, lo: Math.max(1, i + 1 - spread), hi: i + 1 + spread });
    });
    return out;
}

/**
 * A deterministic mock draft: each club in `order` (teamIds, pick by pick)
 * takes the best player on ITS board by grade, positional value and need,
 * the way the CPU drafts (minus the dice). Returns the same shape as
 * consensus(): Map(id → { grade, rank, lo, hi, team }).
 */
export function mockDraft(draftClass, order, rosters = {}) {
    const pool = new Map(draftClass.map(p => [p.id, p]));
    const needsFor = new Map();
    const added = {};
    const avgGrade = new Map(draftClass.map(p => {
        const grades = order.slice(0, 32).map(t => cpuView(p, t).grade);
        return [p.id, grades.reduce((a, b) => a + b, 0) / (grades.length || 1)];
    }));
    const out = new Map();
    order.forEach((teamId, i) => {
        if (!pool.size) return;
        if (!needsFor.has(teamId)) needsFor.set(teamId, calculatePositionNeeds([...(rosters[teamId] || []), ...(added[teamId] || [])]));
        const needs = needsFor.get(teamId);
        const qb = (rosters[teamId] || []).filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
        let best = null, bestScore = -Infinity;
        for (const p of pool.values()) {
            if (i < 128 && (p.position === 'K' || p.position === 'P')) continue;
            const g = cpuView(p, teamId).grade;
            const pv = p.position === 'QB' && qb?.ovr >= 72 ? 0.6 : (DRAFT_POSITION_VALUE[p.position] || 1);
            const score = g * pv * 0.45 + (needs[p.position] || 50) * 0.4;
            if (score > bestScore) { bestScore = score; best = p; }
        }
        if (!best) return;
        pool.delete(best.id);
        (added[teamId] ||= []).push(best);
        needsFor.delete(teamId);
        const spread = Math.max(2, Math.round(3 + i * 0.1));
        out.set(best.id, { grade: Math.round(avgGrade.get(best.id) * 10) / 10, rank: i + 1, lo: Math.max(1, i + 1 - spread), hi: i + 1 + spread, team: teamId });
    });
    // Everyone left is projected undrafted, ordered by grade.
    [...pool.values()].sort((a, b) => avgGrade.get(b.id) - avgGrade.get(a.id)).forEach((p, j) => {
        const rank = order.length + j + 1;
        out.set(p.id, { grade: Math.round(avgGrade.get(p.id) * 10) / 10, rank, lo: rank - 10, hi: rank + 10, team: null, undrafted: true });
    });
    return out;
}

// ── Medicals and athletic testing ────────────────────────────────────────────
export function medicalOf(prospect) {
    const d = prospect.attributes?.universal?.durability ?? prospect.injuryRisk ?? 85;
    if (d < 74) return { id: 'major', label: 'Major flag', tone: 'negative', text: 'Knee history. Our doctors see an elevated injury risk.' };
    if (d < 82) return { id: 'minor', label: 'Minor flag', tone: 'warning', text: 'Minor soft-tissue history; should hold up.' };
    return { id: 'clean', label: 'Clean', tone: 'positive', text: 'Clean medical.' };
}

const POS_40 = { QB: 4.85, RB: 4.55, WR: 4.5, TE: 4.75, OL: 5.25, DL: 4.95, LB: 4.7, CB: 4.48, S: 4.55, K: 5.0, P: 5.0 };
/** Combine measurables: public, derived from real attributes with testing-day noise. */
export function measurables(p) {
    const u = p.attributes?.universal || {};
    const n = k => gauss(`combine:${p.id}:${k}`);
    const spd = u.speed || 70, acc = u.acceleration || 70, agi = u.agility || 70, str = u.strength || 70;
    return {
        forty: Math.max(4.22, (POS_40[p.position] || 4.8) - (spd - 75) * 0.012 + n('40') * 0.04).toFixed(2),
        vertical: Math.max(22, Math.round(26 + ((acc + agi) / 2 - 40) * 0.3 + n('v') * 1.5)),
        bench: Math.max(8, Math.round(13 + (str - 40) * 0.38 + n('b') * 2)),
        shuttle: Math.max(3.85, 4.6 - (agi - 70) * 0.012 + n('s') * 0.05).toFixed(2),
    };
}
/** 0-100 percentile of a measurable within a position group (lower-is-better for times). */
export function percentile(value, values, lowerIsBetter = false) {
    if (!values.length) return 50;
    const v = Number(value);
    const beaten = values.filter(x => (lowerIsBetter ? Number(x) > v : Number(x) < v)).length;
    return Math.round(beaten / values.length * 100);
}

// ── Knowledge gains ──────────────────────────────────────────────────────────
export const ASSIGNMENTS = {
    watch: { id: 'watch', label: 'Watch player', blurb: 'Deep dive on one prospect.' },
    region: { id: 'region', label: 'Cover region', blurb: 'A little on everyone in his region.' },
    crosscheck: { id: 'crosscheck', label: 'Cross-check', blurb: 'Director re-grades a player and removes bias.' },
    pro: { id: 'pro', label: 'Pro scouting', blurb: 'Hidden trajectory and injury risk of a pro player.' },
};

const gain = (eye, base) => Math.round(base * (0.6 + eye / 125));

/**
 * One week of assignments. pool = prospects scouts may cover (college
 * pipeline rows or draft class). Returns a new scouting object.
 */
export function runAssignments(scouting, pool, { week, year } = {}) {
    if (!scouting) return scouting;
    const stamp = `${year}-${week}`;
    if (scouting.lastWeek === stamp) return scouting;
    const knowledge = { ...scouting.knowledge }, proKnowledge = { ...scouting.proKnowledge }, crossChecked = { ...scouting.crossChecked };
    const add = (id, n) => { knowledge[id] = clamp(Math.max(BASE_KNOWLEDGE, knowledge[id] || 0) + n, 0, 100); };
    for (const raw of scouting.scouts || []) {
        const s = scoutOf(raw);
        const a = scouting.assignments?.[s.id] || defaultAssignment(scouting, s);
        if (!a) continue;
        if (a.type === 'watch' && a.target) add(a.target, gain(s.eye, s.role === 'director' ? 14 : 18));
        else if (a.type === 'region') {
            // Coverage is broad and shallow: the next class only, a little at a time.
            const region = a.target || s.region;
            const nextClass = Math.min(...pool.map(p => p.draftYear ?? Infinity));
            for (const p of pool) if ((p.draftYear ?? nextClass) === nextClass && regionOfSchool(p.school || p.college) === region) add(p.id, gain(s.eye, 1.5));
        } else if (a.type === 'crosscheck' && a.target) { add(a.target, gain(s.eye, 10)); crossChecked[a.target] = true; }
        else if (a.type === 'pro' && a.target) proKnowledge[a.target] = clamp((proKnowledge[a.target] || 0) + gain(s.eye, 30), 0, 100);
    }
    return { ...scouting, knowledge, proKnowledge, crossChecked, lastWeek: stamp };
}

/** Auto-assignment from the board: area scouts watch their top board player, others cover. */
export function defaultAssignment(scouting, s) {
    const board = scouting.board?.order || [];
    if (s.role === 'director') return board[0] ? { type: 'crosscheck', target: board.find(id => !scouting.crossChecked?.[id]) || board[0] } : null;
    if (s.role === 'area') return { type: 'region', target: s.region };
    if (s.role === 'national') return board.length ? { type: 'watch', target: board.find(id => (scouting.knowledge?.[id] || 0) < 70) || board[0] } : null;
    return null;
}

export function applyVisit(scouting, id) {
    if (!scouting || scouting.visits.includes(id) || scouting.visits.length >= VISIT_SLOTS) return null;
    const k = clamp(Math.max(BASE_KNOWLEDGE, scouting.knowledge[id] || 0) + 30, 0, 100);
    return { ...scouting, visits: [...scouting.visits, id], knowledge: { ...scouting.knowledge, [id]: k } };
}
export function applyInterview(scouting, id) {
    if (!scouting || scouting.interviews.includes(id) || scouting.interviews.length >= INTERVIEW_SLOTS) return null;
    const k = clamp(Math.max(BASE_KNOWLEDGE, scouting.knowledge[id] || 0) + 6, 0, 100);
    return { ...scouting, interviews: [...scouting.interviews, id], knowledge: { ...scouting.knowledge, [id]: k } };
}
/** Attending a college game: a real look at up to four prospects. */
export function applyAttendance(scouting, ids) {
    const knowledge = { ...scouting.knowledge };
    for (const id of ids.slice(0, 4)) knowledge[id] = clamp(Math.max(BASE_KNOWLEDGE, knowledge[id] || 0) + 15, 0, 100);
    return { ...scouting, knowledge };
}
/** Combine day: everyone tests, athletic picture sharpens for the whole class. */
export function applyCombine(scouting, draftClass, year) {
    if (!scouting || scouting.combineYear === year) return scouting;
    const knowledge = { ...scouting.knowledge };
    for (const p of draftClass) knowledge[p.id] = clamp(Math.max(BASE_KNOWLEDGE, knowledge[p.id] || 0) + 5, 0, 100);
    return { ...scouting, knowledge, combineYear: year };
}

// ── Scout disagreement ───────────────────────────────────────────────────────
const ROUND_OF = grade => grade >= 80 ? 1 : grade >= 75 ? 2 : grade >= 71 ? 3 : grade >= 67 ? 4 : grade >= 63 ? 5 : grade >= 59 ? 6 : 7;
const QUOTES_UP = ['Fluid hips, easy mover.', 'The tape jumps off the screen.', 'Plays faster than he tests.', 'Rare feel for the game.', 'Wins with technique, not just traits.'];
const QUOTES_DOWN = ['Tight in space.', 'Too many false steps.', 'Production came against weak competition.', 'Stiff when he has to change direction.', 'Wins with traits, not technique.'];
/** Two or three scout opinions on one prospect, from each scout's own read. */
export function scoutOpinions(prospect, scouting, userTeamId) {
    const scouts = (scouting?.scouts || []).map(scoutOf);
    const k = knowledgeOf(scouting, prospect.id);
    const region = regionOfSchool(prospect.college || prospect.school);
    const involved = scouts.filter(s => s.role === 'director' || s.role === 'national' || s.region === region).slice(0, 3);
    return involved.map(s => {
        const v = perceive(prospect, { teamId: `${userTeamId}:${s.id}`, k: Math.max(k - 5, BASE_KNOWLEDGE), biasId: scouting.crossChecked?.[prospect.id] ? null : s.bias });
        const r = seededRng(`quote:${prospect.id}:${s.id}`);
        const avg = userView(prospect, scouting, userTeamId).grade;
        const quote = v.grade >= avg ? QUOTES_UP[Math.floor(r() * QUOTES_UP.length)] : QUOTES_DOWN[Math.floor(r() * QUOTES_DOWN.length)];
        return { scout: s, round: ROUND_OF(v.grade), grade: v.grade, quote, bias: biasInfo(s.bias) };
    });
}
export const roundLabel = r => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][r] || 'UDFA';
export const projectedRound = ROUND_OF;

/** Scouts flag prospects the league undervalues. */
export function sleepers(draftClass, scouting, userTeamId, cons, n = 5) {
    return draftClass
        .map(p => ({ p, mine: userView(p, scouting, userTeamId).grade, rank: cons.get(p.id)?.rank ?? 999 }))
        .filter(x => x.rank > 40)
        .sort((a, b) => (b.mine - (cons.get(b.p.id)?.grade || 0)) - (a.mine - (cons.get(a.p.id)?.grade || 0)))
        .slice(0, n).map(x => x.p.id);
}

/** A pro comp: the current league player at the position whose OVR/pot profile is closest. */
export function proComp(prospect, rosters) {
    const target = (prospect.pot || prospect.ovr) - 2;
    let best = null;
    for (const [teamId, roster] of Object.entries(rosters || {})) {
        for (const p of roster) {
            if (p.position !== prospect.position || p.archetype !== prospect.archetype) continue;
            const d = Math.abs(p.ovr - target);
            if (!best || d < best.d) best = { d, player: p, teamId };
        }
    }
    return best && { name: best.player.name, teamId: best.teamId, ovr: best.player.ovr };
}

// ── Pro personnel ─────────────────────────────────────────────────────────────
/** Hidden career trajectory of a pro player. Real: offseason progression reads it. */
export function trajectoryOf(player) {
    const h = hashSeed(`traj:${player.id}`) % 100;
    if (h < 14) return { id: 'cliff', label: 'Early decline', tone: 'negative', text: 'Our pro scout thinks he falls off a cliff around 29.' };
    if (h < 26) return { id: 'bloomer', label: 'Late bloomer', tone: 'positive', text: 'Still improving; could peak later than most.' };
    return { id: 'steady', label: 'Steady', tone: 'neutral', text: 'Normal aging curve expected.' };
}
/** Trajectory shows once pro knowledge reaches 50. */
export function proReport(player, scouting) {
    const k = scouting?.proKnowledge?.[player.id] || 0;
    return k >= 50 ? { k, trajectory: trajectoryOf(player), medical: medicalOf(player) } : { k };
}

// ── Camp reveal and hit rates ────────────────────────────────────────────────
/** Snapshot stored on a drafted rookie so camp can reveal how right we were. */
export function draftSnapshot(prospect, scouting, userTeamId) {
    const v = userView(prospect, scouting, userTeamId);
    return { est: v.ovr, lo: v.lo, hi: v.hi, potEst: v.pot, scoutId: v.scout?.id || null, k: v.k };
}
/** Verdict for one rookie. */
export function revealVerdict(snapshot, actualOvr) {
    const diff = actualOvr - snapshot.est;
    const inRange = actualOvr >= snapshot.lo && actualOvr <= snapshot.hi;
    const label = Math.abs(diff) <= 2 ? 'Scout nailed it' : diff > 0 ? `Better than we graded (+${diff})` : `Worse than we graded (${diff})`;
    return { diff, inRange, label, hit: Math.abs(diff) <= 3 };
}
export function recordHits(hitRates = {}, verdicts) {
    const next = { ...hitRates };
    for (const v of verdicts) {
        if (!v.scoutId) continue;
        const r = next[v.scoutId] || { hits: 0, misses: 0 };
        next[v.scoutId] = v.hit ? { ...r, hits: r.hits + 1 } : { ...r, misses: r.misses + 1 };
    }
    return next;
}
