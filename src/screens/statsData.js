// Pure stat helpers, lifted out of Stats.jsx so the screen stays presentational.

import { TEAMS } from '../data/teams';

export function extractSeasonBests(schedule, rosters) {
    const records = {
        passYds:  { val: 0, name: '', pos: 'QB',  team: '', week: 0, label: 'Pass Yards' },
        rushYds:  { val: 0, name: '', pos: 'RB',  team: '', week: 0, label: 'Rush Yards' },
        recYds:   { val: 0, name: '', pos: 'WR',  team: '', week: 0, label: 'Rec Yards' },
        tds:      { val: 0, name: '', pos: 'QB',  team: '', week: 0, label: 'TDs in Game' },
        sacks:    { val: 0, name: '', pos: 'DL',  team: '', week: 0, label: 'Sacks in Game' },
        tackles:  { val: 0, name: '', pos: 'LB',  team: '', week: 0, label: 'Tackles in Game' },
    };

    // Build flat player lookup
    const playerMap = {};
    Object.entries(rosters).forEach(([tid, players]) => {
        players.forEach(p => { playerMap[p.id] = { ...p, teamId: tid }; });
    });

    (schedule || []).forEach((weekGames, wi) => {
        (weekGames || []).filter(g => g.played && g.playerStats).forEach(game => {
            ['home', 'away'].forEach(side => {
                const stats = game.playerStats?.[side] || {};
                Object.entries(stats).forEach(([pid, s]) => {
                    const p = playerMap[pid];
                    if (!p) return;
                    const team = TEAMS.find(t => t.id === p.teamId)?.abbreviation || p.teamId;
                    const wk = wi + 1;
                    if ((s.yards || 0) > records.passYds.val && (p.position === 'QB')) {
                        records.passYds = { val: s.yards, name: p.name, pos: p.position, team, week: wk, label: 'Pass Yards' };
                    }
                    const rYds = s.rushYards || (p.position !== 'QB' ? s.yards || 0 : 0);
                    if (rYds > records.rushYds.val && ['RB', 'FB', 'QB'].includes(p.position)) {
                        records.rushYds = { val: rYds, name: p.name, pos: p.position, team, week: wk, label: 'Rush Yards' };
                    }
                    if ((s.recYards || 0) > records.recYds.val) {
                        records.recYds = { val: s.recYards, name: p.name, pos: p.position, team, week: wk, label: 'Rec Yards' };
                    }
                    const gameTds = (s.tds || 0) + (s.rushTds || 0);
                    if (gameTds > records.tds.val) {
                        records.tds = { val: gameTds, name: p.name, pos: p.position, team, week: wk, label: 'TDs in Game' };
                    }
                    if ((s.sacks || 0) > records.sacks.val) {
                        records.sacks = { val: s.sacks, name: p.name, pos: p.position, team, week: wk, label: 'Sacks in Game' };
                    }
                    if ((s.tackles || 0) > records.tackles.val) {
                        records.tackles = { val: s.tackles, name: p.name, pos: p.position, team, week: wk, label: 'Tackles in Game' };
                    }
                });
            });
        });
    });

    return Object.values(records).filter(r => r.val > 0);
}

