// Public prospect information and transactional pick handling.
export const pickKey = p => `${p.year || ''}:${p.originalTeamId}:${p.round}`;
export const pickValue = number => Math.round(3000 / Math.pow(1 + (number - 1) / 12, 1.15));
export const winPct = s => ((s?.wins || 0) + (s?.ties || 0) / 2) / ((s?.wins || 0) + (s?.losses || 0) + (s?.ties || 0) || 1);
export function draftTeamOrder(teams, standings, schedule = [], bracket) {
    // How far each team went in the postseason (store bracket schema:
    // { afc|nfc: { seeds, wc, div, conf }, sb }). Non-playoff teams stay at 0
    // and pick first; the champion picks last and the runner-up just before.
    const stage = {};
    const reach = (id, level) => { if (id) stage[id] = Math.max(stage[id] || 0, level); };
    for (const conf of ['afc', 'nfc']) {
        const b = bracket?.[conf];
        if (!b) continue;
        (b.seeds || []).forEach(id => reach(id, 1));
        reach(b.seeds?.[0], 2); // first-round bye
        for (const [round, level] of [['wc', 1], ['div', 2], ['conf', 3]]) {
            for (const game of b[round] || []) {
                reach(game.homeTeamId, level);
                reach(game.awayTeamId, level);
                if (game.played) reach(game.winnerId, level + 1);
            }
        }
    }
    const sb = bracket?.sb;
    if (sb) {
        reach(sb.homeTeamId, 4);
        reach(sb.awayTeamId, 4);
        if (sb.played) reach(sb.winnerId, 5);
    }
    const sos = id => {
        const opponents = schedule.flat().filter(g => g.homeTeamId === id || g.awayTeamId === id).map(g => standings[g.homeTeamId === id ? g.awayTeamId : g.homeTeamId]).filter(Boolean);
        const games = opponents.reduce((n, s) => n + s.wins + s.losses + (s.ties || 0), 0);
        return opponents.reduce((n, s) => n + s.wins + (s.ties || 0) / 2, 0) / (games || 1);
    };
    return [...teams].sort((a, b) => (stage[a.id] || 0) - (stage[b.id] || 0) || winPct(standings[a.id] || {}) - winPct(standings[b.id] || {}) || sos(a.id) - sos(b.id) || a.id.localeCompare(b.id)).map(t => t.id);
}
export function exchangePicks(owners, order, currentIndex, from, to, give, receive) {
    if (from === to || !give.length || !receive.length) return null;
    const keys = [...give, ...receive].map(pickKey);
    if (new Set(keys).size !== keys.length) return null;
    for (const [id, picks] of [[from, give], [to, receive]]) {
        if (picks.some(p => !(owners[id] || []).some(o => pickKey(o) === pickKey(p)))) return null;
        if (picks.some(p => order.slice(0, currentIndex).some(o => pickKey(o) === pickKey(p)))) return null;
    }
    const next = { ...owners };
    next[from] = [...owners[from].filter(p => !give.some(g => pickKey(g) === pickKey(p))), ...receive];
    next[to] = [...owners[to].filter(p => !receive.some(g => pickKey(g) === pickKey(p))), ...give];
    const updated = order.map((p, i) => i < currentIndex ? p : give.some(g => pickKey(g) === pickKey(p)) ? { ...p, teamId: to } : receive.some(g => pickKey(g) === pickKey(p)) ? { ...p, teamId: from } : p);
    return { draftPickOwners: next, draftOrder: updated, onClockTeamId: updated[currentIndex]?.teamId || null };
}
const SCHOOLS = ['Ohio State', 'Michigan', 'Alabama', 'Georgia', 'LSU', 'Texas', 'Oregon', 'Penn State', 'Notre Dame', 'USC', 'Clemson', 'Florida State', 'Boise State', 'Tulane', 'Memphis', 'North Dakota State'];
export function collegeProfile(player, year, index) {
    const rand = (min, max) => Math.round(min + Math.random() * (max - min));
    const school = SCHOOLS[index % SCHOOLS.length];
    const seasons = Array.from({ length: Math.min(4, Math.max(2, player.age - 19)) }, (_, i) => {
        const games = rand(10, 14), factor = 0.65 + i * 0.12;
        const n = (a, b) => Math.round(rand(a, b) * factor);
        let stats;
        switch (player.position) {
            case 'QB': { const att = n(300, 480), cmp = Math.round(att * rand(57, 71) / 100); stats = { CMP: cmp, ATT: att, YDS: Math.round(cmp * rand(11, 14)), TD: n(18, 38), INT: rand(3, 13) }; break; }
            case 'RB': { const att = n(130, 260); stats = { ATT: att, YDS: Math.round(att * rand(42, 65) / 10), TD: n(5, 18), REC: n(12, 45) }; break; }
            case 'WR': case 'TE': { const rec = n(35, player.position === 'WR' ? 95 : 65); stats = { REC: rec, YDS: rec * rand(10, 17), TD: n(3, 13) }; break; }
            case 'OL': stats = { SNAPS: games * rand(45, 70), 'SACKS ALLOWED': rand(0, 6), PENALTIES: rand(2, 9) }; break;
            case 'K': { const att = rand(16, 28); stats = { FGM: Math.round(att * rand(70, 95) / 100), FGA: att, LONG: rand(46, 59) }; break; }
            default: stats = { TKL: n(35, 100), TFL: n(4, 18), SACK: player.position === 'DL' ? rand(3, 12) : rand(0, 5), INT: ['CB', 'S'].includes(player.position) ? rand(1, 6) : rand(0, 2) };
        }
        return { year: year - (Math.min(4, Math.max(2, player.age - 19)) - i), games, ...stats };
    });
    const arcs = [
        ['Late bloomer', `Earned a starting role after two seasons of reserve work at ${school}. Scouts disagree on how much growth remains.`],
        ['Team captain', `Voted a captain at ${school}. Interviews will help determine how his leadership translates to a professional locker room.`],
        ['Transfer bet', `Transferred to ${school} for a larger role. His production rose, but evaluators are weighing the change in competition.`],
        ['Small details', `Built his reputation through film study at ${school}. Teams see a dependable prospect whose athletic ceiling remains debated.`],
    ];
    const arc = arcs[index % arcs.length];
    return { school, seasons, headline: arc[0], story: arc[1], competition: index % SCHOOLS.length < 12 ? 'Major conference' : 'Group of Five / FCS', generated: true };
}
