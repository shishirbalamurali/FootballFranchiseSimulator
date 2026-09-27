// CPU clubs exchange surplus depth for a positional upgrade. No user assets move.
export function findLeagueTrade(rosters, userTeamId, random = Math.random) {
    const ids = Object.keys(rosters).filter(id => id !== userTeamId);
    const starters = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 };
    const rank = (id, pos) => rosters[id].filter(p => p.position === pos && !p.injured).sort((a, b) => b.ovr - a.ovr);
    const start = Math.floor(random() * ids.length);
    for (let i = 0; i < ids.length; i++) {
        const a = ids[(start + i) % ids.length];
        for (const b of ids.filter(id => id !== a)) {
            for (const p of rosters[a]) {
                const atA = rank(a, p.position), atB = rank(b, p.position);
                if (atA.indexOf(p) < (starters[p.position] || 1) || p.ovr < 68 || p.ovr <= (atB[(starters[p.position] || 1) - 1]?.ovr || 50) + 3) continue;
                const q = rosters[b].find(q => q.position !== p.position && rank(b, q.position).indexOf(q) >= (starters[q.position] || 1) && q.ovr > (rank(a, q.position)[(starters[q.position] || 1) - 1]?.ovr || 50) + 3 && Math.abs(q.ovr - p.ovr) <= 5 && Math.abs(q.age - p.age) <= 5 && Math.abs((q.contract?.salary || 0) - (p.contract?.salary || 0)) <= 2);
                if (!q) continue;
                const salary = roster => roster.reduce((n, p) => n + (p.contract?.salary || 0), 0);
                const aRoster = [...rosters[a].filter(x => x.id !== p.id), { ...q, teamId: a }];
                const bRoster = [...rosters[b].filter(x => x.id !== q.id), { ...p, teamId: b }];
                if (salary(aRoster) > Math.max(200, salary(rosters[a])) || salary(bRoster) > Math.max(200, salary(rosters[b]))) continue;
                return { a, b, p, q, rosters: { ...rosters, [a]: aRoster, [b]: bRoster } };
            }
        }
    }
    return null;
}
