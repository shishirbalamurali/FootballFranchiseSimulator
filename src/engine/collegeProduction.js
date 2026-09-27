// College careers model individual prospect production, not complete school box
// scores. Keyed game randomness makes fast-forward and weekly play identical.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function collegeHash(value) {
    let n = 2166136261;
    for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
    return n;
}
function randomFor(key) {
    let state = collegeHash(key);
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function collegeSeasonArc(player, year) { return collegeHash(`${player.id}-${year}-arc`) % 12; }
export function collegeGamesThrough(player, year, week) {
    const scheduled = clamp(Math.floor(clamp(week, 0, 18) * 12 / 18), 0, 12);
    return scheduled - (collegeSeasonArc(player, year) === 0 ? Math.min(2, Math.max(0, scheduled - 6)) : 0);
}
function gameProduction(p, year, game) {
    const random = randomFor(`${p.id}-${year}-game-${game}`);
    const roll = (trials, chance) => Array.from({ length: trials }, () => random() < chance).filter(Boolean).length;
    const count = (mean, spread = .4) => Math.max(0, Math.round(mean * (1 - spread + random() * spread * 2)));
    const experience = clamp(year - p.entryYear + 1, 1, 4);
    const talent = clamp((p.readyOvr - 40) / 45, 0, 1);
    // Opportunity and efficiency are separate: productive college veterans can
    // have modest NFL ceilings; exceptional recruits can begin behind a veteran.
    const identity = collegeHash(`${p.id}-role`) % 101 / 100;
    const seasonForm = .86 + (collegeHash(`${p.id}-${year}-form`) % 29) / 100;
    const role = clamp(.2 + experience * .17 + identity * .25 - (p.arc === 'Late bloomer' && experience < 3 ? .2 : 0), .15, 1);
    const usage = role * seasonForm;
    switch (p.position) {
        case 'QB': {
            const ATT = count(33 * usage), CMP = roll(ATT, .53 + talent * .15);
            const INT = roll(ATT - CMP, .055 + (1 - talent) * .055);
            return { CMP, ATT, YDS: count(CMP * (10.5 + talent * 3), .22), TD: roll(CMP, .08 + talent * .05), INT };
        }
        case 'RB': {
            const ATT = count(20 * usage), REC = count(2.8 * usage);
            return { ATT, YDS: count(ATT * (4 + talent * 1.6), .28), TD: roll(ATT, .035 + talent * .025), REC, REC_YDS: count(REC * 8.5), REC_TD: roll(REC, .035) };
        }
        case 'WR': case 'TE': {
            const TGT = count((p.position === 'WR' ? 8.5 : 5.7) * usage);
            const REC = roll(TGT, .53 + talent * .2);
            return { TGT, REC, YDS: count(REC * ((p.position === 'WR' ? 12 : 9) + talent * 3), .3), TD: roll(REC, .07 + talent * .055) };
        }
        case 'OL': {
            const SNAPS = count(65 * usage, .12);
            return { SNAPS, SACKS_ALLOWED: roll(SNAPS, .013 - talent * .009), PENALTIES: roll(SNAPS, .009 - talent * .004) };
        }
        case 'K': {
            const FGA = count(2 * usage, .75), FGM = roll(FGA, .61 + talent * .26);
            const XPA = count(3.4 * usage, .55), XPM = roll(XPA, .92 + talent * .065);
            return { FGM, FGA, XPM, XPA, LONG: FGM ? Math.round(34 + talent * 13 + random() * 10) : 0 };
        }
        default: {
            const base = { DL: 3.8, LB: 7.1, CB: 3.8, S: 5.8 }[p.position] || 4.5;
            const TKL = count(base * usage * (.85 + talent * .3), .55);
            const TFL = roll(TKL, p.position === 'DL' ? .24 : p.position === 'LB' ? .12 : .07);
            const SACKS = roll(TFL, p.position === 'DL' ? .52 : p.position === 'LB' ? .3 : .18);
            return { TKL, TFL, SACKS, INT: roll(1, usage * (p.position === 'CB' ? .18 : p.position === 'S' ? .13 : .025)), PD: roll(3, usage * (p.position === 'CB' ? .3 : .12)) };
        }
    }
}
export function collegeProduction(player, year, week, previous) {
    const throughWeek = clamp(Math.floor(week), 0, 18);
    const games = collegeGamesThrough(player, year, throughWeek);
    // Append to recorded totals, including older-save totals. Never regenerate
    // a played game or revise a prospect's past after a development event.
    const stats = { ...(previous?.stats || {}) };
    const played = previous?.games || 0;
    if (!previous) for (const key of Object.keys(gameProduction(player, year, 1))) stats[key] = 0;
    for (let game = played + 1; game <= games; game++) {
        for (const [key, value] of Object.entries(gameProduction(player, year, game))) {
            // Older seasons lack attempt/target counters. Do not expose a
            // partial-season denominator beside their full-season yardage.
            if (previous && !(key in stats)) continue;
            stats[key] = key === 'LONG' ? Math.max(stats[key] || 0, value) : (stats[key] || 0) + value;
        }
    }
    return { year, school: player.school, games: Math.max(games, played), stats, throughWeek };
}
