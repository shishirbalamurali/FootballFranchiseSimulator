// Player progression and regression system
import { TEAMS } from '../data/teams.js';

// Peak performance ages by position
const PEAK_AGES = {
    QB: 30, RB: 26, WR: 28, TE: 28, OL: 29, DL: 28, LB: 27, CB: 27, S: 28, K: 32, P: 32
};

// When regression acceleration begins
const REGRESSION_START = {
    QB: 36, RB: 28, WR: 30, TE: 30, OL: 32, DL: 30, LB: 30, CB: 30, S: 31, K: 38, P: 38
};

// Dev trait growth multipliers
const DEV_MULTIPLIERS = {
    Superstar: 1.6,
    Star: 1.3,
    Normal: 1.0,
    Slow: 0.4
};

// Injury types and frequency
const INJURY_TYPES = [
    { name: 'Hamstring', severity: 'minor', weeks: 1 },
    { name: 'Ankle Sprain', severity: 'minor', weeks: 1 },
    { name: 'Groin', severity: 'moderate', weeks: 2 },
    { name: 'Knee Injury', severity: 'moderate', weeks: 2 },
    { name: 'Shoulder', severity: 'moderate', weeks: 3 },
    { name: 'High Ankle Sprain', severity: 'severe', weeks: 4 }
];

// Free agent name pools
const FA_FIRST = [
    'James', 'Michael', 'David', 'Robert', 'John', 'William', 'Richard', 'Joseph', 'Thomas', 'Christopher',
    'Daniel', 'Anthony', 'Charles', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'George', 'Edward'
];

const FA_LAST = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

// Helper: apply OVR change while scaling all attributes proportionally
function applyOvrChange(player, ovrDelta) {
    const clone = JSON.parse(JSON.stringify(player));
    const oldOvr = clone.ovr;
    const newOvr = Math.max(40, Math.min(99, clone.ovr + ovrDelta));

    if (newOvr === oldOvr) return clone;

    const ratio = oldOvr > 40 ? (newOvr - 40) / (oldOvr - 40) : 1;

    // Scale position attributes
    if (clone.attributes.position) {
        Object.keys(clone.attributes.position).forEach(attr => {
            const baseVal = clone.attributes.position[attr];
            const delta = baseVal - 40;
            clone.attributes.position[attr] = Math.max(40, Math.min(99, Math.round(40 + delta * ratio + (oldOvr <= 40 ? newOvr - oldOvr : 0))));
        });
    }

    // Scale universal attributes
    if (clone.attributes.universal) {
        Object.keys(clone.attributes.universal).forEach(attr => {
            const baseVal = clone.attributes.universal[attr];
            const delta = baseVal - 40;
            clone.attributes.universal[attr] = Math.max(40, Math.min(99, Math.round(40 + delta * ratio + (oldOvr <= 40 ? newOvr - oldOvr : 0))));
        });
    }

    clone.ovr = newOvr;
    return clone;
}

// Run end-of-season progression for all players
// rosters format: { teamId: [players] }
export function runSeasonProgression(rosters) {
    const newRosters = JSON.parse(JSON.stringify(rosters));
    const storylines = [];
    const retiredPlayers = [];

    Object.entries(newRosters).forEach(([teamId, roster]) => {
        if (!Array.isArray(roster)) return;
        // Iterate backwards so splice doesn't skip players
        for (let idx = roster.length - 1; idx >= 0; idx--) {
            let updatedPlayer = { ...roster[idx] };

            // Age and experience
            updatedPlayer.age = (updatedPlayer.age || 22) + 1;
            updatedPlayer.experience = (updatedPlayer.experience || 0) + 1;

            // Retirement. The old rule only fired past 36, so nobody ever left
            // the league: an isolated run aged the average roster from 25 to 33
            // without a single retirement. Real attrition starts when a
            // position's decline does, hits fringe players years before stars,
            // and is near-certain by the very late thirties.
            const retireStart = REGRESSION_START[updatedPlayer.position] || 30;
            const pOvr = updatedPlayer.ovr;
            let retirementChance = Math.max(0, (updatedPlayer.age - retireStart) * 2.6);
            if (pOvr < 68) retirementChance += Math.max(0, (updatedPlayer.age - 26) * 2.4);
            if (pOvr >= 85) retirementChance *= 0.45;   // stars hang on
            retirementChance = Math.min(92, retirementChance);
            if (updatedPlayer.age >= 40) retirementChance = 100;

            if (Math.random() * 100 < retirementChance) {
                retiredPlayers.push({
                    playerId: updatedPlayer.id,
                    playerName: updatedPlayer.name,
                    position: updatedPlayer.position,
                    ovr: updatedPlayer.ovr,
                    years: updatedPlayer.experience,
                    teamId
                });
                storylines.push({
                    type: 'RETIREMENT',
                    icon: '🎬',
                    playerName: updatedPlayer.name,
                    teamId,
                    position: updatedPlayer.position,
                    ovr: updatedPlayer.ovr,
                    severity: 'neutral',
                    title: 'Calling It Quits',
                    headline: `${updatedPlayer.name} has retired`,
                    subtext: `Career spanning ${updatedPlayer.experience} years.`
                });
                roster.splice(idx, 1);
                continue;
            }

            // Calculate progression/regression
            const peakAge = PEAK_AGES[updatedPlayer.position] || 28;
            const regStartAge = REGRESSION_START[updatedPlayer.position] || 30;
            let progressionDelta = 0;

            if (updatedPlayer.age < peakAge) {
                // Growth closes part of the gap to the ceiling, but most players
                // plateau short of it. Ceiling-closing was previously a
                // guaranteed 22% of the gap every year, which turned potential
                // into a promise and flooded the league with 90+ players.
                const gap = (updatedPlayer.pot || updatedPlayer.ovr) - updatedPlayer.ovr;
                const devMult = DEV_MULTIPLIERS[updatedPlayer.devTrait] || 1.0;
                const youth = Math.max(0.35, (peakAge - updatedPlayer.age) / Math.max(1, peakAge - 21));
                progressionDelta = Math.round(gap * 0.20 * devMult * youth * (0.4 + Math.random() * 1.2));
                // Flat years are common; the occasional step back is not rare
                if (Math.random() < 0.18) progressionDelta = 0;
                else if (Math.random() < 0.06) progressionDelta = -1;
            } else if (updatedPlayer.age <= peakAge + 1) {
                progressionDelta = Math.floor((Math.random() - 0.5) * 3);
            } else if (updatedPlayer.age >= regStartAge) {
                // The old formula floored to zero for the first two years past
                // the regression age, so decline effectively never started.
                const yearsOverStart = updatedPlayer.age - regStartAge;
                progressionDelta = -(1 + Math.round(yearsOverStart * 0.7) + (Math.random() < 0.3 ? 1 : 0));
                if (['RB', 'CB'].includes(updatedPlayer.position)) {
                    progressionDelta = Math.round(progressionDelta * 1.3);
                }
            }

            updatedPlayer = applyOvrChange(updatedPlayer, progressionDelta);

            // Dev trait upgrade chance
            if (progressionDelta >= 3) {
                if (updatedPlayer.devTrait === 'Normal' && Math.random() * 100 < 7) {
                    updatedPlayer.devTrait = 'Star';
                    storylines.push({
                        type: 'DEV_UPGRADE', icon: '⭐',
                        playerName: updatedPlayer.name, teamId,
                        position: updatedPlayer.position, ovr: updatedPlayer.ovr,
                        severity: 'great', title: 'Star Rising',
                        headline: `${updatedPlayer.name} is now a Star`,
                        subtext: 'Development trait upgraded from Normal to Star.'
                    });
                } else if (updatedPlayer.devTrait === 'Star' && Math.random() * 100 < 4) {
                    updatedPlayer.devTrait = 'Superstar';
                    storylines.push({
                        type: 'DEV_UPGRADE', icon: '✨',
                        playerName: updatedPlayer.name, teamId,
                        position: updatedPlayer.position, ovr: updatedPlayer.ovr,
                        severity: 'elite', title: 'Superstar Ascends',
                        headline: `${updatedPlayer.name} is now a Superstar`,
                        subtext: 'Development trait upgraded from Star to Superstar.'
                    });
                }
            }

            if (progressionDelta >= 5) {
                storylines.push({
                    type: 'BREAKOUT', icon: '🚀',
                    playerName: updatedPlayer.name, teamId,
                    position: updatedPlayer.position, ovr: updatedPlayer.ovr,
                    severity: 'great', title: 'Breakout Season',
                    headline: `${updatedPlayer.name} had a breakout season!`,
                    subtext: `Improved +${progressionDelta} overall this offseason.`
                });
            }

            // Reset season stats
            updatedPlayer.stats = { ...(updatedPlayer.stats || {}), season: {} };

            roster[idx] = updatedPlayer;
        }
    });

    return { newRosters, storylines, retiredPlayers };
}

const FA_FIRST_EXT = [
    'James', 'Michael', 'David', 'Robert', 'John', 'William', 'Richard', 'Joseph', 'Thomas', 'Christopher',
    'Daniel', 'Anthony', 'Charles', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'George', 'Edward',
    'Malik', 'Darius', 'DeShawn', 'Jaylen', 'Tyrone', 'Marcus', 'DeAndre', 'Jalen', 'Kadarius', 'Lavonte',
    'Treylon', 'Amon-Ra', 'Chase', 'Justin', 'Tee', 'Rashod', 'Elijah', 'Wan\'Dale', 'Calvin', 'Courtland',
    'Travon', 'Kayvon', 'Aidan', 'Jordan', 'Drake', 'Isaiah', 'Micah', 'Devin', 'Sauce', 'Patrick',
    'Lamar', 'Josh', 'Joe', 'Jared', 'Kenny', 'Tua', 'Deshaun', 'Trevor', 'Zach', 'Mac'
];

const FA_LAST_EXT = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Robinson', 'Walker', 'White', 'Harris', 'Thompson', 'Lewis', 'Lee', 'Hall', 'Allen', 'Young',
    'King', 'Wright', 'Scott', 'Green', 'Adams', 'Baker', 'Hill', 'Carter', 'Mitchell', 'Nelson',
    'Campbell', 'Roberts', 'Evans', 'Turner', 'Phillips', 'Parker', 'Collins', 'Stewart', 'Morris', 'Rogers',
    'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox'
];

const FA_ARCHETYPE_NOTES = {
    QB: ['Pocket passer with strong arm', 'Dual-threat mobile QB', 'Game manager, strong IQ', 'Scrambler with big arm'],
    RB: ['Power back, runs between tackles', 'Elusive scatback, receiving threat', 'Between-the-tackles bruiser', 'Pass-catching specialist'],
    WR: ['Slot receiver, YAC specialist', 'Deep threat, burner', 'Physical boundary receiver', 'Route runner, possession'],
    TE: ['Blocking TE, run game anchor', 'Receiving threat, mismatches', 'Balanced two-way tight end'],
    OL: ['Pass protector, technique sound', 'Run blocker, road grader', 'Athletic lineman, zone scheme'],
    DL: ['Penetrating 3-tech', 'Edge rusher, speed', 'Run stopper, gap plugger', 'Pass rush specialist'],
    LB: ['Coverage linebacker', 'Run stopper, downhill', 'Pass rusher from linebacker', 'All-around linebacker'],
    CB: ['Press corner, physical', 'Zone corner, ball hawk', 'Slot corner specialist', 'Man coverage specialist'],
    S: ['Deep safety, range', 'Box safety, run support', 'Slot blitzer, versatile'],
    K: ['Strong leg, long range', 'Accurate kicker, clutch'],
    P: ['Big leg, flips the field', 'Directional punter, pins deep'],
};

const FA_INTEREST_TEAMS = ['3 teams', '4 teams', '5 teams', '2 teams', '6 teams', '8 teams', '1 team', 'Multiple teams'];

// Generate free agent pool for offseason
/// Salary multipliers (must match player.js)
const POS_SALARY_MULT = {
    QB: 2.0, WR: 1.3, CB: 1.2, DL: 1.2, OL: 1.1,
    LB: 1.0, S: 0.9, TE: 1.0, RB: 0.85, K: 0.5, P: 0.4
};
function marketSalary(position, ovr) {
    const base = Math.max(0.5, (ovr - 62) * 0.27);
    return Math.round(base * (POS_SALARY_MULT[position] || 1.0) * 10) / 10;
}

// What a player asks for on a new deal, in whole $M.
export function askingSalary(player) {
    return Math.max(1, Math.round(marketSalary(player.position, player.ovr || 0)));
}

// expiredRosterPlayers: contract-expired roster players from startOffseason
// extraUndrafted: undrafted rookies from draft
export function generateFreeAgentPool(expiredRosterPlayers = [], extraUndrafted = []) {
    const freeAgents = [];
    // Healthy mix of veterans and mid-tier players
    const positionCounts = { QB: 5, RB: 9, WR: 12, TE: 6, OL: 12, DL: 10, LB: 8, CB: 8, S: 7, K: 3, P: 3 };

    Object.entries(positionCounts).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            const firstName = FA_FIRST_EXT[Math.floor(Math.random() * FA_FIRST_EXT.length)];
            const lastName = FA_LAST_EXT[Math.floor(Math.random() * FA_LAST_EXT.length)];
            const name = `${firstName} ${lastName}`;

            // Tiered OVR: 10% elite (82-91), 25% solid starter (74-82), 45% backup/spot (62-74), 20% depth (55-62)
            const roll = Math.random() * 100;
            let ovr;
            if (roll < 10) ovr = Math.floor(82 + Math.random() * 9);
            else if (roll < 35) ovr = Math.floor(74 + Math.random() * 8);
            else if (roll < 80) ovr = Math.floor(62 + Math.random() * 12);
            else ovr = Math.floor(55 + Math.random() * 7);

            const salary = Math.round(Math.max(1, (ovr - 58) * 1.9 + Math.random() * 5));
            const age = Math.floor(24 + Math.random() * 13);
            const archetypeNotes = FA_ARCHETYPE_NOTES[pos] || [];
            const note = archetypeNotes[Math.floor(Math.random() * archetypeNotes.length)] || '';
            const interest = FA_INTEREST_TEAMS[Math.floor(Math.random() * FA_INTEREST_TEAMS.length)];

            freeAgents.push({
                id: `fa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                position: pos,
                ovr,
                age,
                experience: Math.max(1, Math.floor((age - 22) + Math.random() * 3)),
                devTrait: ovr >= 82 ? (Math.random() < 0.4 ? 'Star' : 'Normal') : (Math.random() < 0.08 ? 'Star' : Math.random() < 0.12 ? 'Slow' : 'Normal'),
                contract: { salary, years: Math.floor(1 + Math.random() * 3) },
                note,
                interest,
                attributes: {
                    position: {},
                    universal: {
                        strength: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 10))),
                        speed: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 10))),
                        durability: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 8)))
                    }
                }
            });
        }
    });

    // Add expired roster players with proper market-rate salaries
    expiredRosterPlayers.forEach(p => {
        const salary = marketSalary(p.position, p.ovr);
        freeAgents.push({
            ...p,
            id: p.id || `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            contract: { salary, years: Math.floor(1 + Math.random() * 2) },
            interest: FA_INTEREST_TEAMS[Math.floor(Math.random() * FA_INTEREST_TEAMS.length)],
            note: p.note || `Veteran free agent, age ${p.age}`,
            teamId: null,
        });
    });

    // Add undrafted rookies from the draft
    extraUndrafted.forEach(p => {
        freeAgents.push({
            ...p,
            id: `udfa_${p.id}`,
            contract: { salary: 1, years: 1 },
            note: 'Undrafted free agent rookie',
            interest: '2 teams',
            isUndrafted: true
        });
    });

    return freeAgents.sort((a, b) => b.ovr - a.ovr);
}

// Generate a pool of waiver wire players available mid-season (lower OVR, minimum contracts)
export function generateWaiverPool() {
    const players = [];
    const positionCounts = { QB: 2, RB: 4, WR: 5, TE: 3, OL: 5, DL: 4, LB: 4, CB: 4, S: 3, K: 1, P: 1 };

    Object.entries(positionCounts).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            const firstName = FA_FIRST_EXT[Math.floor(Math.random() * FA_FIRST_EXT.length)];
            const lastName = FA_LAST_EXT[Math.floor(Math.random() * FA_LAST_EXT.length)];
            // Waiver wire: mostly backup/depth quality (58-72 OVR)
            const roll = Math.random() * 100;
            let ovr;
            if (roll < 15) ovr = Math.floor(68 + Math.random() * 5);   // 15% decent (68-72)
            else if (roll < 55) ovr = Math.floor(62 + Math.random() * 6); // 40% backup (62-67)
            else ovr = Math.floor(55 + Math.random() * 7);              // 45% depth (55-61)

            const salary = Math.max(1, Math.round(1 + (ovr - 58) * 0.5 + Math.random() * 1.5));
            const age = Math.floor(22 + Math.random() * 10);
            const archetypeNotes = FA_ARCHETYPE_NOTES[pos] || [];
            const note = archetypeNotes[Math.floor(Math.random() * archetypeNotes.length)] || 'Veteran journeyman';

            players.push({
                id: `ww_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                name: `${firstName} ${lastName}`,
                position: pos,
                ovr,
                age,
                experience: Math.max(1, Math.floor((age - 22) + Math.random() * 2)),
                devTrait: Math.random() < 0.05 ? 'Star' : Math.random() < 0.12 ? 'Slow' : 'Normal',
                contract: { salary, years: 1, yearsLeft: 1 },
                note,
                interest: '0 teams',
                attributes: {
                    position: {},
                    universal: {
                        strength: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 10))),
                        speed: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 10))),
                        durability: Math.max(40, Math.min(95, ovr + Math.floor((Math.random() - 0.5) * 8)))
                    }
                }
            });
        }
    });

    return players.sort((a, b) => b.ovr - a.ovr);
}

// Generate injuries for the week
export function generateWeeklyInjuries(weekResults, rosters) {
    const injuries = [];
    const injuryChances = { QB: 0.022, RB: 0.030, WR: 0.030, TE: 0.030, OL: 0.025, DL: 0.025, LB: 0.027, CB: 0.028, S: 0.027, K: 0.015, P: 0.015 };

    // Only players who took the field this week can get hurt — a team on its
    // bye used to pick up injuries too.
    const played = new Set();
    for (const g of weekResults || []) {
        if (g.homeTeamId) played.add(g.homeTeamId);
        if (g.awayTeamId) played.add(g.awayTeamId);
    }

    rosters.forEach(team => {
        if (played.size && !played.has(team.id)) return;
        team.roster.forEach(player => {
            const chance = injuryChances[player.position] || 0.020;

            // Injury roll per game (assume 1 game per week)
            if (Math.random() < chance) {
                const injuryType = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];
                injuries.push({
                    id: `inj_${Math.random().toString(36).substr(2, 9)}`,
                    playerId: player.id,
                    playerName: player.name,
                    teamId: team.id,
                    position: player.position,
                    ovr: player.ovr,
                    type: injuryType.name,
                    weeksRemaining: injuryType.weeks,
                    severity: injuryType.severity
                });
            }
        });
    });

    // Cap at 5 injuries per week. Taking the first five handed every injury to
    // the teams at the top of the iteration order, so draw them at random.
    for (let i = injuries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [injuries[i], injuries[j]] = [injuries[j], injuries[i]];
    }
    return injuries.slice(0, 5);
}

// ── Coach XP & Leveling ──────────────────────────────────────────────────────

export const COACH_LEVELS = [
    { level: 1, xpNeeded: 0,    perk: null,                   perkLabel: '' },
    { level: 2, xpNeeded: 150,  perk: 'underdog',             perkLabel: 'Underdog Mentality — Outperform OVR deficit by 5%' },
    { level: 3, xpNeeded: 400,  perk: 'youth_dev',            perkLabel: 'Youth Developer — Under-24s gain +1 extra OVR/season' },
    { level: 4, xpNeeded: 750,  perk: 'focus_boost',          perkLabel: 'Practice Focus — Training boosts grant +2 instead of +1' },
    { level: 5, xpNeeded: 1200, perk: 'scout_eye',            perkLabel: 'Scout\'s Eye — +3 scouting points each season' },
    { level: 6, xpNeeded: 1800, perk: 'resilience',           perkLabel: 'Resilience — Team gets +3 boost the week after a loss' },
    { level: 7, xpNeeded: 2600, perk: 'cap_wizard',           perkLabel: 'Cap Wizard — Cap ceiling raised to $225M' },
    { level: 8, xpNeeded: 3600, perk: 'elite_scheme',         perkLabel: 'Elite Scheme — Playbook bonuses doubled' },
    { level: 9, xpNeeded: 4800, perk: 'dynasty',              perkLabel: 'Dynasty Builder — Veterans decline 1 less OVR/year' },
    { level: 10, xpNeeded: 6500, perk: 'legend',              perkLabel: 'Hall of Fame — All perks active, +5% win prob in playoffs' },
];

export function getCoachLevel(xp) {
    let level = 1;
    for (const tier of COACH_LEVELS) {
        if (xp >= tier.xpNeeded) level = tier.level;
        else break;
    }
    return level;
}

export function getCoachXpToNext(xp) {
    const level = getCoachLevel(xp);
    if (level >= 10) return { current: xp, needed: xp, pct: 100 };
    const current = COACH_LEVELS[level - 1].xpNeeded;
    const next = COACH_LEVELS[level].xpNeeded;
    return { current: xp - current, needed: next - current, pct: Math.round(((xp - current) / (next - current)) * 100) };
}

export function hasCoachPerk(coachXp, perkName) {
    const level = getCoachLevel(coachXp || 0);
    return COACH_LEVELS.slice(0, level).some(l => l.perk === perkName);
}

// ── Weekly Story Events ──────────────────────────────────────────────────────

const EVENT_POOL = [
    {
        type: 'BREAKOUT_CANDIDATE',
        icon: '🔥',
        needsYoungPlayer: true,
        title: (ctx) => `${ctx.player?.name} Is Ready to Break Out`,
        body: (ctx) => `Your scouts are buzzing about ${ctx.player?.name} (${ctx.player?.position}, ${ctx.player?.ovr} OVR). He's been electric in practice and pushing for a bigger role.`,
        choices: [
            { label: 'Give Him Extra Reps', sub: '+1 OVR immediately', effect: { type: 'player_ovr', delta: 1 } },
            { label: 'Let Him Earn It', sub: 'No change now', effect: null },
        ],
    },
    {
        type: 'VETERAN_MENTOR',
        icon: '🧠',
        needsVet: true,
        title: (ctx) => `${ctx.vet?.name} Offers to Mentor ${ctx.rookie?.name}`,
        body: (ctx) => `Veteran ${ctx.vet?.name} (${ctx.vet?.position}, ${ctx.vet?.ovr} OVR) wants to work with young ${ctx.rookie?.name} before Sunday. This kind of mentorship is rare.`,
        choices: [
            { label: 'Allow the Mentorship', sub: '+2 OVR to the rookie', effect: { type: 'rookie_ovr', delta: 2 } },
            { label: 'Keep Normal Schedule', sub: 'No change', effect: null },
        ],
    },
    {
        type: 'SCOUTING_REPORT',
        icon: '🔭',
        title: (ctx) => `Weakness Spotted in ${ctx.oppName}`,
        body: (ctx) => `Your defensive coordinator found a critical gap in ${ctx.oppName}'s protection scheme. Capitalizing on this could change the game.`,
        choices: [
            { label: 'Install the Scheme', sub: '+6% win probability this week', effect: { type: 'win_prob_boost', value: 6, weeks: 1 } },
            { label: 'Trust Our System', sub: 'No change', effect: null },
        ],
    },
    {
        type: 'CHEMISTRY_EVENT',
        icon: '🏈',
        title: () => 'Team Bonding Weekend',
        body: () => `The players want to organize a team bonding event — a weekend retreat before next week’s game. This could build some real chemistry.`,
        choices: [
            { label: 'Host the Retreat', sub: '+2 OVR to whole team, 2 weeks', effect: { type: 'team_boost', value: 2, weeks: 2 } },
            { label: 'Focus on Film Study', sub: 'No change', effect: null },
        ],
    },
    {
        type: 'MEDIA_CONTROVERSY',
        icon: '📰',
        needsPlayer: true,
        title: (ctx) => `${ctx.player?.name} Stirs Up Media Drama`,
        body: (ctx) => `${ctx.player?.name} made controversial comments after practice. The locker room is watching how you handle this.`,
        choices: [
            { label: 'Address It Publicly', sub: 'Team rallies — +1 OVR for 3 weeks', effect: { type: 'team_boost', value: 1, weeks: 3 } },
            { label: 'Let It Blow Over', sub: 'Player distracted — -2 OVR for 2 weeks', effect: { type: 'player_penalty', delta: -2, weeks: 2 } },
        ],
    },
    {
        type: 'POSITION_COACH',
        icon: '📋',
        title: (ctx) => `New ${ctx.posGroup} Coach Available`,
        body: (ctx) => `A top-tier ${ctx.posGroup} coach is available on short notice. Installing their scheme mid-season is a risk, but the ceiling is higher.`,
        choices: [
            { label: 'Hire Them', sub: 'Position group gets +3 OVR for 4 weeks', effect: { type: 'group_boost', group: null, value: 3, weeks: 4 } },
            { label: 'Stay the Course', sub: 'No change', effect: null },
        ],
    },
    {
        type: 'INJURY_SCARE',
        icon: '🏥',
        needsPlayer: true,
        title: (ctx) => `${ctx.player?.name} Nursing an Injury`,
        body: (ctx) => `${ctx.player?.name} (${ctx.player?.position}, ${ctx.player?.ovr} OVR) tweaked something in practice. He says he can play, but the risk is real.`,
        choices: [
            { label: 'Rest Him This Week', sub: 'Prevents potential season-ending injury', effect: { type: 'rest_player' } },
            { label: 'Play Through It', sub: 'He plays — elevated injury risk', effect: null },
        ],
    },
    {
        type: 'UNDERDOG_MOMENT',
        icon: '⚡',
        title: () => `Team Feeling Disrespected`,
        body: () => `Your team has been overlooked in the national media all week. The locker room is fired up. You could channel this energy before Sunday.`,
        choices: [
            { label: 'Fire Them Up', sub: '+8% win probability, win streak momentum', effect: { type: 'win_prob_boost', value: 8, weeks: 1 } },
            { label: 'Stay Focused', sub: 'No change', effect: null },
        ],
    },
    {
        type: 'CONTRACT_EXTENSION',
        icon: '📝',
        needsExpiringPlayer: true,
        title: (ctx) => `${ctx.player?.name} Wants an Extension`,
        body: (ctx) => `${ctx.player?.name} (${ctx.player?.ovr} OVR) has one year left on his deal and wants to know his future. Extend him now or risk losing him this offseason.`,
        choices: [
            { label: 'Offer 3-Year Extension', sub: 'Locks him up long-term', effect: { type: 'extend_contract', years: 3 } },
            { label: 'Discuss After Season', sub: 'Player may test free agency', effect: null },
        ],
    },
    {
        type: 'RIVAL_WEEK',
        icon: '⚔️',
        title: () => `Rivalry Week — Extra Edge`,
        body: () => `This week's opponent is a division rival. The history between these teams runs deep. How you prepare could determine the outcome.`,
        choices: [
            { label: 'Go All In on Prep', sub: '+7% win probability this week', effect: { type: 'win_prob_boost', value: 7, weeks: 1 } },
            { label: 'Normal Game Plan', sub: 'No change', effect: null },
        ],
    },
];

export function generateWeeklyEvent(userRoster, week) {
    // ~60% chance of event per week
    if (Math.random() > 0.60) return null;

    const youngPlayers = userRoster.filter(p => p.age <= 25 && p.ovr >= 65).sort((a, b) => b.ovr - a.ovr);
    const vetPlayers = userRoster.filter(p => p.age >= 30 && p.ovr >= 75).sort((a, b) => b.ovr - a.ovr);
    const rookies = userRoster.filter(p => (p.experience || 0) <= 2 && p.age <= 23).sort((a, b) => b.ovr - a.ovr);
    const expiringPlayers = userRoster.filter(p => (p.contract?.yearsLeft ?? 1) <= 1 && p.ovr >= 75).sort((a, b) => b.ovr - a.ovr);
    const anyPlayer = [...userRoster].sort((a, b) => b.ovr - a.ovr);

    const POSITION_GROUPS = ['Offense', 'Defense', 'O-Line', 'Secondary'];
    const oppNames = TEAMS.map(team => team.location);

    // Filter valid events based on roster state
    const validEvents = EVENT_POOL.filter(e => {
        if (e.needsYoungPlayer && youngPlayers.length === 0) return false;
        if (e.needsVet && (vetPlayers.length === 0 || rookies.length === 0)) return false;
        if (e.needsExpiringPlayer && expiringPlayers.length === 0) return false;
        return true;
    });

    if (validEvents.length === 0) return null;

    const template = validEvents[Math.floor(Math.random() * validEvents.length)];
    const ctx = {
        player: template.needsYoungPlayer ? youngPlayers[0] : template.needsPlayer ? anyPlayer[0] : null,
        vet: vetPlayers[0],
        rookie: rookies[0] || youngPlayers[0],
        oppName: oppNames[Math.floor(Math.random() * oppNames.length)],
        posGroup: POSITION_GROUPS[Math.floor(Math.random() * POSITION_GROUPS.length)],
        extSalary: anyPlayer[0] ? Math.round((anyPlayer[0].contract?.salary || 5) + 2 + Math.random() * 4) : 8,
    };
    if (template.needsExpiringPlayer) ctx.player = expiringPlayers[0];

    return {
        type: template.type,
        icon: template.icon,
        title: template.title(ctx),
        body: template.body(ctx),
        choices: template.choices.map(c => ({
            ...c,
            effect: c.effect ? { ...c.effect, playerId: ctx.player?.id, rookieId: ctx.rookie?.id } : null,
        })),
        ctx: { playerId: ctx.player?.id, vetId: ctx.vet?.id, rookieId: ctx.rookie?.id, posGroup: ctx.posGroup },
        week,
    };
}
