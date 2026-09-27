
// NFL-style news headline engine
// Generates dramatic, varied storylines from weekly results

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- HEADLINE TEMPLATES ---

const UPSET_PHRASES = [
    (w, l) => `${w} Stuns ${l} in Major Upset`,
    (w, l) => `Nobody Saw This Coming: ${w} Topples ${l}`,
    (w, l) => `${l} Falls in Shocking Defeat to ${w}`,
    (w, l) => `${w} Pulls Off the Impossible Against ${l}`,
];

const BLOWOUT_PHRASES = [
    (w, l, d) => `${w} Demolishes ${l} by ${d}`,
    (w, l, d) => `No Contest: ${w} Runs Away from ${l}, ${d}-Point Win`,
    (w, l, d) => `${l} Has No Answer as ${w} Rolls, +${d}`,
    (w, l, d) => `${w} Makes a Statement with ${d}-Point Shellacking`,
];

const THRILLER_PHRASES = [
    (w, l) => `${w} Survives Heart-Stopper vs ${l}`,
    (w, l) => `Down to the Wire: ${w} Edges ${l}`,
    (w, l) => `Last-Second Drama as ${w} Escapes ${l}`,
    (w, l) => `${w} and ${l} Deliver an Instant Classic`,
];

const OVERTIME_PHRASES = [
    (w, l) => `${w} Outlasts ${l} in Overtime Thriller`,
    (w, l) => `Sudden Death: ${w} Walks It Off Against ${l}`,
    (w, l) => `${w} Wins an OT Classic Over ${l}`,
    (w, l) => `Free Football! ${w} Survives ${l} in Overtime`,
];

const SHUTOUT_PHRASES = [
    (w, l) => `${w} Defense Shuts Down ${l} Completely`,
    (w, l) => `${l} Offense Goes Silent Against ${w}`,
    (w, l) => `Dominant: ${w} Blanks ${l}`,
];

const WIN_STREAK_PHRASES = [
    (t, n) => `${t} Winning Machine: ${n} Straight`,
    (t, n) => `${t} Rolls to ${n}-Game Win Streak`,
    (t, n) => `Is Anyone Stopping ${t}? ${n} Wins Running`,
    (t, n) => `${t} on Fire — ${n} in a Row`,
];

const LOSS_STREAK_PHRASES = [
    (t, n) => `${t} Skid Reaches ${n} Games`,
    (t, n) => `${t} Can't Find a Win — ${n} Straight Losses`,
    (t, n) => `${t} in Freefall: ${n}-Game Losing Streak`,
];

const QB_BIG_GAME = [
    (n, s) => `${n} Lights It Up: ${s}`,
    (n, s) => `${n} Dominant in the Pocket: ${s}`,
    (n, s) => `${n} Has Everything Working: ${s}`,
    (n, s) => `Masterful: ${n} Throws for ${s}`,
];

const RB_BIG_GAME = [
    (n, s) => `${n} Goes Off: ${s} on the Ground`,
    (n, s) => `${n} Unstoppable: ${s} Rushing`,
    (n, s) => `Run Game Dominance — ${n} with ${s}`,
];

const DEF_BIG_GAME = [
    (n, s) => `${n} Wrecking Ball: ${s}`,
    (n, s) => `${n} Takes Over Defensively: ${s}`,
    (n, s) => `Defense Wins Games — ${n} with ${s}`,
];

const DIVISION_LEAD_PHRASES = [
    (t, c, d) => `${t} Seizes ${c} ${d} Lead`,
    (t, c, d) => `Division Race Tightens as ${t} Climbs Atop ${c} ${d}`,
    (t, c, d) => `${t} in the Driver's Seat for ${c} ${d} Crown`,
];

const PERFECT_RECORD_PHRASES = [
    (t, w) => `${t} Remains Perfect at ${w}-0`,
    (t, w) => `${w}-0 and Rolling: ${t} Is Unstoppable`,
    (t, w) => `Can Anything Stop ${t}? ${w} Wins, Zero Losses`,
];

const HIGH_SCORE_PHRASES = [
    (t, s) => `${t} Erupts for ${s} Points — Offense Cooking`,
    (t, s) => `${s}-Point Explosion: ${t} Offense Unstoppable`,
    (t, s) => `${t} Puts Up ${s}: No Defense Can Stop Them`,
];

const COMEBACK_PHRASES = [
    (w, l) => `${w} Mounts Incredible Comeback to Beat ${l}`,
    (w, l) => `Never Count Out ${w} — Comeback Win over ${l}`,
    (w, l) => `${l} Had It Won but ${w} Didn't Quit`,
];

export const generateWeeklyHeadlines = (weekResults, teams, standings = {}) => {
    const headlines = [];

    if (!weekResults || weekResults.length === 0) return [];

    const playedGames = weekResults.filter(g => g.played);
    if (playedGames.length === 0) return [];

    const getTeam = (id) => teams.find(t => t.id === id);
    const getStanding = (id) => standings[id] || { wins: 0, losses: 0, streak: 0 };

    // ─────────────────────────────────────────────
    // 1. GAME OF THE WEEK (thriller — closest game)
    // ─────────────────────────────────────────────
    const scored = playedGames.map(g => {
        const diff = Math.abs(g.homeScore - g.awayScore);
        const total = g.homeScore + g.awayScore;
        return { g, excitement: (total * 1.5) - (diff * 4) + (g.overtime ? 30 : 0) };
    }).sort((a, b) => b.excitement - a.excitement);

    if (scored.length > 0) {
        const { g } = scored[0];
        const diff = Math.abs(g.homeScore - g.awayScore);
        const home = getTeam(g.homeTeamId);
        const away = getTeam(g.awayTeamId);
        const winner = g.homeScore > g.awayScore ? home : away;
        const loser = g.homeScore > g.awayScore ? away : home;
        const wScore = Math.max(g.homeScore, g.awayScore);
        const lScore = Math.min(g.homeScore, g.awayScore);

        if (g.homeScore === g.awayScore) {
            headlines.push({ type: 'TIE', headline: `${home?.location} and ${away?.location} Finish Level`, subtext: `${g.homeScore}–${g.awayScore}. Neither team earns a win.`, icon: '⏱️', teamId: home?.id });
        } else if (g.overtime) {
            headlines.push({
                type: 'GAME_OF_WEEK',
                headline: pick(OVERTIME_PHRASES)(winner?.location, loser?.location),
                subtext: `${wScore}–${lScore} in overtime. The ${winner?.name} advance to ${getStanding(winner?.id).wins}-${getStanding(winner?.id).losses}.`,
                icon: '⏱️',
                teamId: winner?.id,
            });
        } else if (diff <= 7) {
            headlines.push({
                type: 'GAME_OF_WEEK',
                headline: pick(THRILLER_PHRASES)(winner?.location, loser?.location),
                subtext: `${wScore}–${lScore} in a game that came down to the wire. The ${winner?.name} advance to ${getStanding(winner?.id).wins}-${getStanding(winner?.id).losses}.`,
                icon: '🎯',
                teamId: winner?.id,
            });
        }
    }

    // ─────────────────────────────────────────────
    // 2. UPSETS (underdog wins by OVR not available — use records)
    // ─────────────────────────────────────────────
    playedGames.forEach(g => {
        if (g.homeScore === g.awayScore) return;
        const homeRec = getStanding(g.homeTeamId);
        const awayRec = getStanding(g.awayTeamId);
        // Underdog = team with more losses going in wins
        const homeWinPct = homeRec.wins / Math.max(1, homeRec.wins + homeRec.losses);
        const awayWinPct = awayRec.wins / Math.max(1, awayRec.wins + awayRec.losses);
        const winnerIsHome = g.homeScore > g.awayScore;
        const winnerPct = winnerIsHome ? homeWinPct : awayWinPct;
        const loserPct = winnerIsHome ? awayWinPct : homeWinPct;

        if (loserPct - winnerPct >= 0.25 && (homeRec.wins + homeRec.losses + awayRec.wins + awayRec.losses) >= 4) {
            const winner = getTeam(winnerIsHome ? g.homeTeamId : g.awayTeamId);
            const loser = getTeam(winnerIsHome ? g.awayTeamId : g.homeTeamId);
            if (winner && loser && headlines.length < 8) {
                headlines.push({
                    type: 'UPSET',
                    headline: pick(UPSET_PHRASES)(winner.location, loser.location),
                    subtext: `${winner.location} was a heavy underdog but delivered a ${Math.max(g.homeScore, g.awayScore)}–${Math.min(g.homeScore, g.awayScore)} victory.`,
                    icon: '⚡',
                    teamId: winner.id,
                });
            }
        }
    });

    // ─────────────────────────────────────────────
    // 3. BLOWOUTS (21+ point wins)
    // ─────────────────────────────────────────────
    playedGames.forEach(g => {
        if (g.homeScore === g.awayScore) return;
        const diff = Math.abs(g.homeScore - g.awayScore);
        if (diff >= 21 && headlines.length < 8) {
            const winnerIsHome = g.homeScore > g.awayScore;
            const winner = getTeam(winnerIsHome ? g.homeTeamId : g.awayTeamId);
            const loser = getTeam(winnerIsHome ? g.awayTeamId : g.homeTeamId);
            if (winner && loser) {
                headlines.push({
                    type: 'BLOWOUT',
                    headline: pick(BLOWOUT_PHRASES)(winner.location, loser.location, diff),
                    subtext: `Final: ${Math.max(g.homeScore, g.awayScore)}–${Math.min(g.homeScore, g.awayScore)}. The ${loser.name} had no answers on either side of the ball.`,
                    icon: '💥',
                    teamId: winner.id,
                });
            }
        }
    });

    // ─────────────────────────────────────────────
    // 4. SHUTOUT / NEAR-SHUTOUT (held under 10)
    // ─────────────────────────────────────────────
    playedGames.forEach(g => {
        if (g.homeScore === g.awayScore) return;
        const lowScore = Math.min(g.homeScore, g.awayScore);
        if (lowScore <= 9 && headlines.length < 8) {
            const winnerIsHome = g.homeScore > g.awayScore;
            const defender = getTeam(winnerIsHome ? g.homeTeamId : g.awayTeamId);
            const victim = getTeam(winnerIsHome ? g.awayTeamId : g.homeTeamId);
            if (defender && victim) {
                headlines.push({
                    type: 'SHUTOUT',
                    headline: lowScore === 0 ? pick(SHUTOUT_PHRASES)(defender.location, victim.location) : `${defender.location} Holds ${victim.location} to ${lowScore} Points`,
                    subtext: `${victim.location} managed just ${lowScore} points. The ${defender.name} defense was dominant all game long.`,
                    icon: '🛡',
                    teamId: defender.id,
                });
            }
        }
    });

    // ─────────────────────────────────────────────
    // 5. HIGH-SCORING OFFENSE (40+ points)
    // ─────────────────────────────────────────────
    playedGames.forEach(g => {
        if (g.homeScore === g.awayScore) return;
        const highScore = Math.max(g.homeScore, g.awayScore);
        if (highScore >= 40 && headlines.length < 8) {
            const scorerId = g.homeScore >= 40 ? g.homeTeamId : g.awayTeamId;
            const scorer = getTeam(scorerId);
            if (scorer) {
                headlines.push({
                    type: 'HIGH_SCORE',
                    headline: pick(HIGH_SCORE_PHRASES)(scorer.location, highScore),
                    subtext: `The ${scorer.name} offense is firing on all cylinders. Nobody looks capable of slowing them down right now.`,
                    icon: '🔥',
                    teamId: scorer.id,
                });
            }
        }
    });

    // ─────────────────────────────────────────────
    // 6. WIN / LOSS STREAKS from standings
    // ─────────────────────────────────────────────
    Object.entries(standings).forEach(([teamId, s]) => {
        if (headlines.length >= 8) return;
        const team = getTeam(teamId);
        if (!team) return;

        if (s.streak >= 4) {
            headlines.push({
                type: 'STREAK',
                headline: pick(WIN_STREAK_PHRASES)(team.location, s.streak),
                subtext: `The ${team.name} are now ${s.wins}-${s.losses} on the season. They've looked unstoppable during this run.`,
                icon: '📈',
                teamId,
            });
        } else if (s.streak <= -4) {
            headlines.push({
                type: 'STREAK',
                headline: pick(LOSS_STREAK_PHRASES)(team.location, Math.abs(s.streak)),
                subtext: `The ${team.name} fall to ${s.wins}-${s.losses}. Pressure mounting on the coaching staff to turn things around.`,
                icon: '📉',
                teamId,
            });
        }
    });

    // ─────────────────────────────────────────────
    // 7. PERFECT RECORD (undefeated through W weeks)
    // ─────────────────────────────────────────────
    Object.entries(standings).forEach(([teamId, s]) => {
        if (headlines.length >= 8) return;
        if (s.losses === 0 && s.wins >= 4) {
            const team = getTeam(teamId);
            if (team) {
                headlines.push({
                    type: 'PERFECT',
                    headline: pick(PERFECT_RECORD_PHRASES)(team.location, s.wins),
                    subtext: `Still perfect. The ${team.name} have cleared every obstacle this season and show no signs of slowing down.`,
                    icon: '👑',
                    teamId,
                });
            }
        }
    });

    // ─────────────────────────────────────────────
    // 8. PLAYER PERFORMANCE — top skill position
    // ─────────────────────────────────────────────
    let bestPlayer = null;
    let bestScore = -1;
    let bestStatLine = '';
    let bestPos = '';

    playedGames.forEach(g => {
        if (g.homeScore === g.awayScore) return;
        const allStats = [
            ...Object.values(g.playerStats?.home || {}),
            ...Object.values(g.playerStats?.away || {}),
        ];
        allStats.forEach(entry => {
            const p = entry.player;
            if (!p) return;
            let score = 0;
            let line = '';

            if (p.position === 'QB') {
                const yds = entry.yards || 0;
                const tds = entry.tds || 0;
                score = (yds / 25) + (tds * 5);
                line = `${yds} yds, ${tds} TDs`;
            } else if (['RB', 'FB'].includes(p.position)) {
                const yds = entry.rushYards || entry.yards || 0;
                const tds = entry.rushTds || entry.tds || 0;
                score = (yds / 10) + (tds * 6);
                line = `${yds} rush yds, ${tds} TDs`;
            } else if (['WR', 'TE'].includes(p.position)) {
                const yds = entry.recYards || 0;
                const tds = entry.recTds || entry.tds || 0;
                const rec = entry.receptions || 0;
                score = (yds / 10) + (tds * 6) + (rec * 0.5);
                line = `${rec} rec, ${yds} yds, ${tds} TDs`;
            } else {
                const sacks = entry.sacks || 0;
                const ints = entry.ints || 0;
                score = (sacks * 6) + (ints * 8);
                line = `${sacks} sacks, ${ints} INTs`;
            }

            if (score > bestScore) {
                bestScore = score;
                bestPlayer = p;
                bestStatLine = line;
                bestPos = p.position;
            }
        });
    });

    if (bestPlayer && headlines.length < 8) {
        const isQB = bestPos === 'QB';
        const isRB = ['RB', 'FB'].includes(bestPos);
        const phrases = isQB ? QB_BIG_GAME : isRB ? RB_BIG_GAME : DEF_BIG_GAME;
        headlines.push({
            type: 'PLAYER_WEEK',
            headline: pick(phrases)(bestPlayer.name, bestStatLine),
            subtext: `${bestPlayer.position} earns Player of the Week honors with a dominant performance. ${bestPlayer.devTrait ? `(${bestPlayer.devTrait})` : ''}`,
            icon: '🌟',
        });
    }

    // ─────────────────────────────────────────────
    // 9. DIVISION LEADER update (pick one division)
    // ─────────────────────────────────────────────
    if (headlines.length < 6) {
        const divMap = {};
        teams.forEach(t => {
            const key = `${t.conference}-${t.division}`;
            if (!divMap[key]) divMap[key] = { teams: [], conf: t.conference, div: t.division };
            const s = standings[t.id];
            if (s) divMap[key].teams.push({ ...t, wins: s.wins, losses: s.losses });
        });

        const keys = Object.keys(divMap).sort(() => Math.random() - 0.5);
        for (const key of keys) {
            const div = divMap[key];
            if (div.teams.length < 2) continue;
            div.teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
            const leader = div.teams[0];
            const second = div.teams[1];
            if (leader.wins > second.wins && leader.wins >= 2) {
                headlines.push({
                    type: 'DIVISION_LEAD',
                    headline: pick(DIVISION_LEAD_PHRASES)(leader.location, leader.conference, leader.division),
                    subtext: `${leader.location} leads the ${leader.conference} ${leader.division} at ${leader.wins}-${leader.losses}, ahead of ${second.location} (${second.wins}-${second.losses}).`,
                    icon: '🏟',
                    teamId: leader.id,
                });
                break;
            }
        }
    }

    // ─────────────────────────────────────────────
    // 10. Fallback — at least one item always
    // ─────────────────────────────────────────────
    if (headlines.length === 0) {
        headlines.push({
            type: 'GENERIC',
            headline: 'Another week in the books',
            subtext: 'Check the standings for the latest playoff picture.',
            icon: '📋',
        });
    }

    return headlines;
};
