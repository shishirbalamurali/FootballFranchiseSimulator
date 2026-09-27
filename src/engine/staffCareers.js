// Coaching careers v2 (Claude-owned). Pure functions over the existing
// coachingStaff records from franchiseStaff.js.
//
// Everything new about a coach is DERIVED from his id and record (age, scheme,
// traits, three ratings), so old saves gain it with zero bytes. Stored on top:
// coach.retired (year), coach.contract (user staff), and frontOffice fields
// (successorId, interviewed, blocked) owned by the store.
import { hashSeed, seededRng } from './seededRandom.js';
import { OFFENSE_IDS, DEFENSE_IDS, rosterFitShare } from './schemes.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export const COACH_TRAITS = {
    playersCoach: { id: 'playersCoach', label: "Players' coach", icon: '🤝', text: 'Locker room loves him: +morale, players re-sign a little cheaper.' },
    disciplinarian: { id: 'disciplinarian', label: 'Disciplinarian', icon: '📏', text: 'Fewer mistakes, but stars bristle.' },
    innovator: { id: 'innovator', label: 'Innovator', icon: '💡', text: 'Scheme bonus is stronger in year one.' },
    recruiter: { id: 'recruiter', label: 'Recruiter', icon: '📣', text: 'Free agents like hearing from him.' },
    loyal: { id: 'loyal', label: 'Loyal', icon: '🛡️', text: 'Rarely interviews elsewhere.' },
    ambitious: { id: 'ambitious', label: 'Ambitious', icon: '🚀', text: 'Wants a head job; sours if blocked.' },
    qbWhisperer: { id: 'qbWhisperer', label: 'QB whisperer', icon: '🎯', text: 'Young quarterbacks develop faster.' },
    aggressive: { id: 'aggressive', label: 'Aggressive play-caller', icon: '🔥', text: 'Goes for it on fourth down; more deep shots.' },
};
const TRAIT_IDS = Object.keys(COACH_TRAITS);
export const EXTRA_ROLES = ['QB Coach', 'Development'];
export const USER_ROLES = ['OC', 'DC', 'Assistant', ...EXTRA_ROLES];

export function coachAge(c, year) {
    const start = c.history?.[0]?.year ?? year;
    const base = c.role === 'HC' ? 44 : c.role === 'Assistant' || EXTRA_ROLES.includes(c.role) ? 34 : 38;
    return base + (hashSeed(`age:${c.id}`) % 14) + Math.max(0, year - start);
}

/** Derived profile: scheme, traits (two), ratings. */
export function coachProfile(c, year) {
    const r = seededRng(`coach:${c.id}`);
    const offense = OFFENSE_IDS[Math.floor(r() * OFFENSE_IDS.length)];
    const defense = DEFENSE_IDS[Math.floor(r() * DEFENSE_IDS.length)];
    const t1 = TRAIT_IDS[Math.floor(r() * TRAIT_IDS.length)];
    let t2 = TRAIT_IDS[Math.floor(r() * TRAIT_IDS.length)];
    if (t2 === t1) t2 = TRAIT_IDS[(TRAIT_IDS.indexOf(t1) + 3) % TRAIT_IDS.length];
    const rep = c.reputation ?? 55;
    const lean = r();
    const sk = c.skills || {};
    const ratings = {
        offense: clamp(Math.round(35 + rep * 0.45 + (sk.offense || 0) * 6 + (c.role === 'OC' ? 8 : 0) + lean * 8), 30, 99),
        defense: clamp(Math.round(35 + rep * 0.45 + (sk.defense || 0) * 6 + (c.role === 'DC' ? 8 : 0) + (1 - lean) * 8), 30, 99),
        development: clamp(Math.round(30 + rep * 0.4 + (sk.leadership || 0) * 6 + (EXTRA_ROLES.includes(c.role) ? 10 : 0) + r() * 12), 30, 99),
    };
    return {
        age: coachAge(c, year), scheme: { offense, defense }, traits: [t1, t2], ratings,
        salary: Math.round((0.6 + (Math.max(ratings.offense, ratings.defense, ratings.development) - 50) / 25) * 10) / 10,
        retireAge: 66 + (hashSeed(`retire:${c.id}`) % 7),
    };
}

/** A team's identity: offense from its OC (or HC), defense from its DC (or HC). */
export function teamIdentity(coaches = [], teamId, year) {
    const staff = coaches.filter(c => c.teamId === teamId);
    const hc = staff.find(c => c.role === 'HC'), oc = staff.find(c => c.role === 'OC'), dc = staff.find(c => c.role === 'DC');
    const off = coachProfile(oc || hc || { id: `none-o-${teamId}` }, year).scheme.offense;
    const def = coachProfile(dc || hc || { id: `none-d-${teamId}` }, year).scheme.defense;
    return { offense: off, defense: def };
}
export function allIdentities(coaches, teamIds, year) {
    return Object.fromEntries(teamIds.map(id => [id, teamIdentity(coaches, id, year)]));
}

/** How well a roster suits a candidate coordinator (% of starters who fit). */
export function candidateFit(c, role, roster, year) {
    const p = coachProfile(c, year);
    if (role === 'OC') return rosterFitShare(roster, p.scheme.offense);
    if (role === 'DC') return rosterFitShare(roster, p.scheme.defense);
    return null;
}

// ── Tree ─────────────────────────────────────────────────────────────────────
export function descendants(coaches = [], rootId) {
    const kids = new Map();
    for (const c of coaches) if (c.mentorId) { if (!kids.has(c.mentorId)) kids.set(c.mentorId, []); kids.get(c.mentorId).push(c); }
    const out = [];
    const walk = (id, depth) => { for (const k of kids.get(id) || []) { if (out.some(o => o.c.id === k.id) || depth > 6) continue; out.push({ c: k, depth }); walk(k.id, depth + 1); } };
    walk(rootId, 1);
    return out;
}
/** Nested tree for the UI: { coach, children: [...] }. */
export function treeOf(coaches = [], rootId) {
    const byMentor = new Map();
    for (const c of coaches) if (c.mentorId) { if (!byMentor.has(c.mentorId)) byMentor.set(c.mentorId, []); byMentor.get(c.mentorId).push(c); }
    const root = coaches.find(c => c.id === rootId);
    const seen = new Set();
    const build = (c, depth) => { seen.add(c.id); return { coach: c, children: depth > 5 ? [] : (byMentor.get(c.id) || []).filter(k => !seen.has(k.id)).map(k => build(k, depth + 1)) }; };
    return root ? build(root, 0) : null;
}
export function treePrestige(coaches, rootId) {
    return Math.round(descendants(coaches, rootId).reduce((n, { c }) => n + (c.retired ? 2 : c.role === 'HC' && c.teamId ? 10 + (c.reputation || 50) / 10 : ['OC', 'DC'].includes(c.role) && c.teamId ? 4 : 1), 0));
}
/** Biggest trees in the league: [{ root, size, headCoaches, prestige }]. */
export function leagueTrees(coaches, n = 5) {
    const roots = coaches.filter(c => !c.mentorId || !coaches.some(m => m.id === c.mentorId));
    return roots.map(root => {
        const d = descendants(coaches, root.id);
        return { root, size: d.length, headCoaches: d.filter(x => x.c.role === 'HC' && x.c.teamId).length, prestige: treePrestige(coaches, root.id) };
    }).filter(t => t.size > 0).sort((a, b) => b.prestige - a.prestige).slice(0, n);
}

// ── Staff budget ─────────────────────────────────────────────────────────────
/** Owner-set budget in $M (separate from the cap), grows with trust. */
export const staffBudget = (ownerTrust = 60) => Math.round((9 + ownerTrust / 12) * 10) / 10;
export function staffPayroll(coaches, teamId, year, scouts = []) {
    const coachPay = coaches.filter(c => c.teamId === teamId && c.role !== 'HC').reduce((n, c) => n + (c.contract?.salary ?? coachProfile(c, year).salary), 0);
    return Math.round((coachPay + scouts.reduce((n, s) => n + (s.salary || 0), 0)) * 10) / 10;
}

// ── Offseason: aging, retirement, poaching ──────────────────────────────────
/**
 * Retire old coaches (they become analysts). Returns { coaches, retired }.
 */
export function retireCoaches(coaches, year, userTeamId) {
    const retired = [];
    const next = coaches.map(c => {
        if (c.retired) return c;
        const p = coachProfile(c, year);
        if (p.age < p.retireAge) return c;
        if (c.teamId === userTeamId && c.role === 'HC') return c; // that's you
        retired.push(c);
        return { ...c, retired: year, formerTeamId: c.teamId, teamId: null, history: [...(c.history || []), { year, teamId: c.teamId, role: c.role, event: 'Retired to the broadcast booth' }] };
    });
    return { coaches: next, retired };
}

/** Coaches who left the user's staff for head jobs in this carousel. */
export function poachedFromUser(before, after, userTeamId) {
    const was = new Map(before.filter(c => c.teamId === userTeamId && c.role !== 'HC').map(c => [c.id, c]));
    return after.filter(c => was.has(c.id) && c.teamId && c.teamId !== userTeamId && c.role === 'HC').map(c => ({ coach: c, formerRole: was.get(c.id).role, newTeamId: c.teamId }));
}

/** Undo a poach: coach returns; the CPU team hires the best market HC instead. */
export function blockPoach(coaches, coachId, userTeamId, formerRole, year) {
    const c = coaches.find(x => x.id === coachId);
    if (!c) return coaches;
    const teamId = c.teamId;
    let next = coaches.map(x => x.id === coachId ? { ...x, teamId: userTeamId, role: formerRole, blockedYear: year, history: [...x.history.slice(0, -1), { year, teamId: userTeamId, role: formerRole, event: 'Blocked from a head-coaching interview' }] } : x);
    const hire = next.filter(x => !x.teamId && !x.retired).sort((a, b) => (b.reputation || 0) - (a.reputation || 0))[0];
    if (hire) next = next.map(x => x.id === hire.id ? { ...x, teamId, role: 'HC', history: [...x.history, { year, teamId, role: 'HC', event: 'Hired after a rival blocked his first choice' }] } : x);
    return next;
}

/** Development coach: a few young players on the user's roster take an extra step. */
export function developmentBoost(roster, devRating, year) {
    const chance = clamp((devRating - 40) / 120, 0.05, 0.45);
    let boosted = 0;
    const next = roster.map(p => {
        if ((p.age || 26) > 25 || p.ovr >= (p.pot || p.ovr)) return p;
        if (seededRng(`dev:${p.id}:${year}`)() >= chance) return p;
        boosted++;
        return { ...p, ovr: Math.min(p.pot || 99, p.ovr + 1) };
    });
    return { roster: next, boosted };
}

/** Interview questions reveal traits (hidden until interviewed). */
export const INTERVIEW_QUESTIONS = [
    'How would you use our quarterback?',
    'Tell me about a time you disagreed with your head coach.',
    'Where do you see yourself in three years?',
    'What does your practice week look like?',
];
export function interviewAnswers(c, year) {
    const p = coachProfile(c, year);
    return p.traits.map(t => ({ trait: COACH_TRAITS[t], answer: {
        playersCoach: '"My door is always open. Players play hard for people who care about them."',
        disciplinarian: '"We will be the least-penalized team in football. That starts Monday at 6 a.m."',
        innovator: '"I have a few ideas nobody in this league is running yet."',
        recruiter: '"Free agents want to know who they\'ll work with. I close deals."',
        loyal: '"I\'m not looking for my next job. I want to win this one."',
        ambitious: '"I want to be a head coach. Here, I\'ll prove I\'m ready."',
        qbWhisperer: '"Give me a young quarterback and eighteen months."',
        aggressive: '"Fourth-and-two at midfield? We\'re going for it."',
    }[t] }));
}
