// Compact only the on-disk college representation. Repeated story prose and
// property names otherwise cost more storage than the actual career data.
// The simulation and UI continue using ordinary objects.
export function packCollege(players) {
    if (!Array.isArray(players)) return players;
    const strings = [], indexes = new Map();
    const intern = value => {
        if (!indexes.has(value)) { indexes.set(value, strings.length); strings.push(value); }
        return indexes.get(value);
    };
    const rows = players.map(p => [
        p.id, intern(p.name), intern(p.position), intern(p.school), p.entryYear, p.draftYear,
        p.ceiling, p.readyOvr, intern(p.tier), intern(p.arc),
        p.seasons.map(s => [s.year, intern(s.school || p.school), s.games, s.throughWeek || 0, intern(Object.keys(s.stats).join('|')), Object.values(s.stats)]),
        p.events.map(e => [e.year, e.week, intern(e.text)]),
    ]);
    return { format: 'college-v1', strings, rows };
}
export function unpackCollege(data) {
    if (!data || Array.isArray(data) || data.format !== 'college-v1') return data || [];
    const text = i => data.strings[i];
    return data.rows.map(r => ({
        id: r[0], name: text(r[1]), position: text(r[2]), school: text(r[3]), entryYear: r[4], draftYear: r[5],
        ceiling: r[6], readyOvr: r[7], tier: text(r[8]), arc: text(r[9]),
        seasons: r[10].map(s => ({ year: s[0], school: text(s[1]), games: s[2], throughWeek: s[3], stats: Object.fromEntries(text(s[4]).split('|').map((key,i) => [key,s[5][i]])) })),
        events: r[11].map(e => ({ year: e[0], week: e[1], text: text(e[2]) })),
    }));
}
