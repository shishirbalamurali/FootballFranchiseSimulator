import { generateName } from './player';
// Coaching careers are league entities: identity and mentorship survive job changes.
export const STAFF_ROLES = ['HC', 'OC', 'DC', 'Assistant'];
export const STAFF_BRANCHES = { offense: 'Offensive architect', defense: 'Defensive architect', leadership: 'Culture builder' };
export function createCoach(id, role, teamId, year, mentorId = null) {
    return { id, name: generateName(), role, teamId, mentorId,
        reputation: 45 + Math.floor(Math.random() * 30), points: 1, skills: { offense: 0, defense: 0, leadership: 0 },
        poorSeasons: 0, history: [{ year, teamId, role, event: 'Hired' }] };
}
export function createStaff(teams, year, userId, profile) {
    const coaches = teams.flatMap(t => STAFF_ROLES.map(role => createCoach(`coach-${t.id}-${role}`, role, t.id, year, role === 'HC' ? null : `coach-${t.id}-HC`)));
    const hc = coaches.find(c => c.teamId === userId && c.role === 'HC');
    if (hc) hc.name = profile?.name || 'Head Coach';
    for (let i = 0; i < 16; i++) coaches.push(createCoach(`coach-market-${year}-${i}`, STAFF_ROLES[i % 4], null, year));
    return coaches;
}
export function staffBonuses(coaches = [], teamId) {
    const staff = coaches.filter(c => c.teamId === teamId);
    const strength = role => {
        const c = staff.find(c => c.role === role);
        return c ? Math.max(0, (c.reputation - 45) / 25) : 0;
    };
    const skill = branch => staff.reduce((sum, c) => sum + (c.skills?.[branch] || 0), 0) * 0.35;
    return { passingBoost: strength('OC') + skill('offense'), rushingBoost: strength('OC') + skill('offense'), defenseBoost: strength('DC') + skill('defense'), moraleBoost: strength('HC') * 0.5 + strength('Assistant') * 0.5 + skill('leadership') };
}
export function coachingCarousel(coaches, teams, standings, userId, year) {
    let next = coaches.map(c => ({ ...c, skills: { ...c.skills }, history: [...c.history] }));
    const stories = [];
    const teamName = id => teams.find(t => t.id === id)?.name || id;
    const move = (c, teamId, role, event) => {
        const formerTeamId = c.teamId;
        c.teamId = teamId; c.role = role; c.poorSeasons = 0;
        c.history.push({ year, teamId: teamId || formerTeamId, role, event });
        stories.push(`${c.name}: ${event}${teamId ? ` — ${teamName(teamId)} ${role}` : ''}.`);
    };
    for (const c of next.filter(c => c.teamId)) {
        const s = standings[c.teamId] || {};
        if ((s.wins || 0) + (s.losses || 0) + (s.ties || 0) < 10) continue;
        c.reputation = Math.max(20, Math.min(99, c.reputation + ((s.wins || 0) - 8) * 2));
        c.points = Math.min(9, c.points + ((s.wins || 0) >= 10 ? 2 : 1));
        c.poorSeasons = (s.wins || 0) <= 6 ? c.poorSeasons + 1 : 0;
        if (c.role === 'HC' && c.teamId !== userId && ((s.wins || 0) <= 4 || c.poorSeasons >= 2)) move(c, null, 'HC', `Fired after ${s.wins || 0} wins`);
    }
    for (const t of teams.filter(t => t.id !== userId)) {
        if (next.some(c => c.teamId === t.id && c.role === 'HC')) continue;
        // Successful coordinators get their first shot before recycling fired HCs.
        const candidates = next.filter(c => (c.teamId && c.teamId !== t.id && ['OC', 'DC', 'Assistant'].includes(c.role) && (standings[c.teamId]?.wins || 0) >= 9) || (!c.teamId && c.role === 'HC' && !(c.history.at(-1)?.event.startsWith('Fired') && c.history.at(-1)?.teamId === t.id)));
        candidates.sort((a, b) => (b.reputation + (b.teamId ? 15 : 0)) - (a.reputation + (a.teamId ? 15 : 0)));
        let hire = candidates[0];
        if (!hire) { hire = createCoach(`coach-new-${year}-${t.id}`, 'HC', null, year); next.push(hire); }
        const former = hire.teamId;
        move(hire, t.id, 'HC', former ? `Earned a head-coach job after assisting ${teamName(former)}` : 'Hired from coaching market');
    }
    for (const t of teams.filter(t => t.id !== userId)) for (const role of STAFF_ROLES.slice(1)) {
        if (next.some(c => c.teamId === t.id && c.role === role)) continue;
        let hire = next.filter(c => !c.teamId).sort((a, b) => b.reputation - a.reputation)[0];
        if (!hire) { hire = createCoach(`coach-replacement-${year}-${t.id}-${role}`, role, null, year); next.push(hire); }
        if (!hire.mentorId && !hire.history.some(h => h.role === 'HC')) hire.mentorId = next.find(c => c.teamId === t.id && c.role === 'HC')?.id;
        move(hire, t.id, role, 'Joined the staff');
    }
    for (const c of next.filter(c => c.teamId && c.teamId !== userId)) {
        const order = c.role === 'OC' ? ['offense','leadership','defense'] : c.role === 'DC' ? ['defense','leadership','offense'] : ['leadership','offense','defense'];
        const branch = order.find(key => (c.skills[key] || 0) < 3);
        if (branch && c.points > 0) { c.skills[branch] = (c.skills[branch] || 0) + 1; c.points--; }
    }
    // Keep a fresh hiring pool, including former head coaches.
    for (let i = next.filter(c => !c.teamId).length; i < 12; i++) next.push(createCoach(`coach-intake-${year}-${i}`, STAFF_ROLES[i % 4], null, year));
    return { coaches: next, stories };
}
