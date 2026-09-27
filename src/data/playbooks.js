// 32 team-specific playbooks — fixed every session, never randomized.
// Scheme IDs and bonuses stay stable across franchise rebrands.
import { getTeamById } from './teams.js';

export const PLAYBOOKS = [
    // ─── AFC NORTH ───────────────────────────────────────────────────
    {
        id: 'ravens-scheme', teamId: 'ravens',
        name: "Osprey Option", category: 'RPO',
        description: 'Mobile QB-led option attack that stresses defenses on both edges. Elite rushing attack combined with a deep-shot vertical passing game.',
        bonuses: { passingBoost: 11, rushingBoost: 10, defenseBoost: 4 },
        keyPosition: 'QB', keyAttribute: 'pocket',
        fitLabel: 'Mobile QB who can threaten as a runner',
        icon: "🦅", color: getTeamById('ravens').theme.primary,
    },
    {
        id: 'bengals-scheme', teamId: 'bengals',
        name: "Hounds Route Tree", category: 'Pass-Heavy',
        description: 'Precision route-running and elite WR separation. High-volume passing attack built around timing and contested catches.',
        bonuses: { passingBoost: 13, rushingBoost: 2, defenseBoost: 2 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Precise route runners who win their matchups',
        icon: "🐕", color: getTeamById('bengals').theme.primary,
    },
    {
        id: 'browns-scheme', teamId: 'browns',
        name: "Owls Ground Game", category: 'Run-Heavy',
        description: 'Physically dominant run game with a bruising back and stout OL. Wears defenses down through four quarters of smash-mouth football.',
        bonuses: { passingBoost: -2, rushingBoost: 15, defenseBoost: 5 },
        keyPosition: 'RB', keyAttribute: 'power',
        fitLabel: 'Power back + physical OL required to maximize',
        icon: "🦉", color: getTeamById('browns').theme.primary,
    },
    {
        id: 'steelers-scheme', teamId: 'steelers',
        name: "Archers 3–4", category: 'Defense-First',
        description: 'Attacking 3-4 defense with versatile pass-rushing linebackers. Disguised coverages and relentless blitzes overwhelm offensive lines.',
        bonuses: { passingBoost: 0, rushingBoost: 2, defenseBoost: 15 },
        keyPosition: 'LB', keyAttribute: 'blitz',
        fitLabel: 'Pass-rushing LBs are the engine of this defense',
        icon: "🏹", color: getTeamById('steelers').theme.primary,
    },

    // ─── AFC SOUTH ───────────────────────────────────────────────────
    {
        id: 'texans-scheme', teamId: 'texans',
        name: "Apollo Air Raid", category: 'Pass-Heavy',
        description: 'Four-wide spread sets flood zones and create open lanes deep. High-ceiling explosive passing when the QB is dialed in.',
        bonuses: { passingBoost: 14, rushingBoost: -4, defenseBoost: 2 },
        keyPosition: 'QB', keyAttribute: 'accuracy',
        fitLabel: 'Elite accurate QB makes this scheme elite',
        icon: "☀️", color: getTeamById('texans').theme.primary,
    },
    {
        id: 'colts-scheme', teamId: 'colts',
        name: "Ibex Power Run", category: 'Run-Heavy',
        description: 'Downhill power run game anchored by an elite OL and bruising back. Controls the clock and field position.',
        bonuses: { passingBoost: 0, rushingBoost: 14, defenseBoost: 3 },
        keyPosition: 'RB', keyAttribute: 'power',
        fitLabel: 'Physical interior OL unlocks the ground game',
        icon: "⛰️", color: getTeamById('colts').theme.primary,
    },
    {
        id: 'jaguars-scheme', teamId: 'jaguars',
        name: "Kings Vertical", category: 'Pass-Heavy',
        description: 'Vertical routes and downfield shots off of play-action. A QB with arm strength turns this into a big-play machine.',
        bonuses: { passingBoost: 11, rushingBoost: 4, defenseBoost: 3 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Fast WRs and a big arm stretch the field',
        icon: "👑", color: getTeamById('jaguars').theme.primary,
    },
    {
        id: 'titans-scheme', teamId: 'titans',
        name: "Switchmen Smash", category: 'Run-Heavy',
        description: 'Pounding ground attack that demoralizes defenses. Elite RB who can carry the ball 30+ times a game.',
        bonuses: { passingBoost: -2, rushingBoost: 18, defenseBoost: 3 },
        keyPosition: 'RB', keyAttribute: 'power',
        fitLabel: 'Elite workhorse RB is the entire offense',
        icon: "🚆", color: getTeamById('titans').theme.primary,
    },

    // ─── AFC EAST ────────────────────────────────────────────────────
    {
        id: 'bills-scheme', teamId: 'bills',
        name: "Mammoth Air Strike", category: 'Pass-Heavy',
        description: 'Elite QB-led passing attack with multiple receiving weapons. Controlled aggression — punishes mistakes deep and over the middle.',
        bonuses: { passingBoost: 17, rushingBoost: -1, defenseBoost: 3 },
        keyPosition: 'QB', keyAttribute: 'arm',
        fitLabel: 'Elite QB arm carries this high-octane offense',
        icon: "🦣", color: getTeamById('bills').theme.primary,
    },
    {
        id: 'dolphins-scheme', teamId: 'dolphins',
        name: "Bats Speed Offense", category: 'Pass-Heavy',
        description: 'Speed in space — fastest WR corps in the league stretches defenses horizontally and vertically. Lightning strikes on every snap.',
        bonuses: { passingBoost: 14, rushingBoost: -2, defenseBoost: 2 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Elite speed WRs make this offense impossible to stop',
        icon: "🦇", color: getTeamById('dolphins').theme.primary,
    },
    {
        id: 'patriots-scheme', teamId: 'patriots',
        name: "Beacon Concepts", category: 'Balanced',
        description: 'Concept-based system disguises routes and exploits coverage weaknesses. No flashy stars needed — execution beats schemes.',
        bonuses: { passingBoost: 6, rushingBoost: 6, defenseBoost: 8 },
        keyPosition: null, keyAttribute: null,
        fitLabel: 'Fits smart, versatile rosters — system elevates everyone',
        icon: "🔆", color: getTeamById('patriots').theme.primary,
    },
    {
        id: 'jets-scheme', teamId: 'jets',
        name: "Gargoyle Pressure", category: 'Defense-First',
        description: 'Aggressive man-coverage packages with overload blitzes. Designed to shut down elite QBs and destroy game plans.',
        bonuses: { passingBoost: 0, rushingBoost: 3, defenseBoost: 14 },
        keyPosition: 'CB', keyAttribute: 'coverage',
        fitLabel: 'Elite CB who can lock down #1 WRs all game',
        icon: "🏙️", color: getTeamById('jets').theme.primary,
    },

    // ─── AFC WEST ────────────────────────────────────────────────────
    {
        id: 'broncos-scheme', teamId: 'broncos',
        name: "Pika Zone Pressure", category: 'Defense-First',
        description: 'Aggressive zone-pressure hybrid that collapses the pocket. Elite secondary blankets receivers while the front four does damage.',
        bonuses: { passingBoost: 2, rushingBoost: 4, defenseBoost: 13 },
        keyPosition: 'DL', keyAttribute: 'blockShedding',
        fitLabel: 'Disruptive DL generates the pressure this zone needs',
        icon: "⛰️", color: getTeamById('broncos').theme.primary,
    },
    {
        id: 'chiefs-scheme', teamId: 'chiefs',
        name: "Bison Motion RPO", category: 'RPO',
        description: 'Pre-snap motion, RPO reads, and a historically elite QB. The most efficient offense in football when fully loaded.',
        bonuses: { passingBoost: 16, rushingBoost: 5, defenseBoost: 2 },
        keyPosition: 'QB', keyAttribute: 'pocket',
        fitLabel: 'Elite IQ QB who reads defenses pre-snap',
        icon: "🦬", color: getTeamById('chiefs').theme.primary,
    },
    {
        id: 'raiders-scheme', teamId: 'raiders',
        name: "Sidewinder Vertical", category: 'Pass-Heavy',
        description: 'Explosive vertical passing game with big receivers. High-reward deep shots combined with check-down efficiency.',
        bonuses: { passingBoost: 12, rushingBoost: 2, defenseBoost: 3 },
        keyPosition: 'WR', keyAttribute: 'hands',
        fitLabel: 'Big-bodied WRs who win in the air',
        icon: "🐍", color: getTeamById('raiders').theme.primary,
    },
    {
        id: 'chargers-scheme', teamId: 'chargers',
        name: "Whale Coast Attack", category: 'Pass-Heavy',
        description: 'Timing-based routes and horizontal flooding create easy throws. Elite TE is the centerpiece in the red zone.',
        bonuses: { passingBoost: 11, rushingBoost: 3, defenseBoost: 4 },
        keyPosition: 'TE', keyAttribute: 'hands',
        fitLabel: 'Receiving TE who can line up anywhere',
        icon: "🐋", color: getTeamById('chargers').theme.primary,
    },

    // ─── NFC NORTH ───────────────────────────────────────────────────
    {
        id: 'bears-scheme', teamId: 'bears',
        name: "Riveter 46", category: 'Defense-First',
        description: 'Suffocating defensive scheme invented in Chicago. Overloads gaps, traps QBs, and dictates field position.',
        bonuses: { passingBoost: 0, rushingBoost: 5, defenseBoost: 14 },
        keyPosition: 'DL', keyAttribute: 'powerMoves',
        fitLabel: 'Dominant interior DL anchors everything',
        icon: "🔨", color: getTeamById('bears').theme.primary,
    },
    {
        id: 'lions-scheme', teamId: 'lions',
        name: "Peregrine Spread", category: 'Balanced',
        description: 'Modern spread system with multiple playmakers in space. Passes and runs flow naturally from the same formations.',
        bonuses: { passingBoost: 12, rushingBoost: 7, defenseBoost: 4 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Versatile skill players who thrive in space',
        icon: "🦅", color: getTeamById('lions').theme.primary,
    },
    {
        id: 'packers-scheme', teamId: 'packers',
        name: "Badger West Coast", category: 'Balanced',
        description: 'West Coast roots mixed with modern spread principles. A QB-first system that rewards accuracy and pre-snap reads.',
        bonuses: { passingBoost: 9, rushingBoost: 8, defenseBoost: 3 },
        keyPosition: 'QB', keyAttribute: 'accuracy',
        fitLabel: 'Accurate QB who can read all levels of the defense',
        icon: "🦡", color: getTeamById('packers').theme.primary,
    },
    {
        id: 'vikings-scheme', teamId: 'vikings',
        name: "Muskox Balance", category: 'Balanced',
        description: 'Physical run-pass balance backed by a stout defense. Wins close games by controlling the line of scrimmage.',
        bonuses: { passingBoost: 8, rushingBoost: 6, defenseBoost: 9 },
        keyPosition: 'DL', keyAttribute: 'blockShedding',
        fitLabel: 'Physical DL who can stop the run and rush the QB',
        icon: "❄️", color: getTeamById('vikings').theme.primary,
    },

    // ─── NFC SOUTH ───────────────────────────────────────────────────
    {
        id: 'falcons-scheme', teamId: 'falcons',
        name: "Stag Outside Zone", category: 'Balanced',
        description: 'Outside zone run game sets up devastating play-action. Misdirection and athletic skill players create chaos.',
        bonuses: { passingBoost: 8, rushingBoost: 9, defenseBoost: 2 },
        keyPosition: 'RB', keyAttribute: 'speed',
        fitLabel: 'Speedy, agile RB who thrives in outside zone',
        icon: "🦌", color: getTeamById('falcons').theme.primary,
    },
    {
        id: 'panthers-scheme', teamId: 'panthers',
        name: "Copperhead Option", category: 'RPO',
        description: 'Athletic QB dictates the option game while stout defense holds leads. A physical identity built around big plays.',
        bonuses: { passingBoost: 4, rushingBoost: 12, defenseBoost: 2 },
        keyPosition: 'QB', keyAttribute: 'pocket',
        fitLabel: 'Athletic QB who is a genuine rushing threat',
        icon: "🐍", color: getTeamById('panthers').theme.primary,
    },
    {
        id: 'saints-scheme', teamId: 'saints',
        name: "Lantern West Coast", category: 'Pass-Heavy',
        description: 'Sophisticated short-to-intermediate passing attack with elite TE usage. Surgical precision from the QB position.',
        bonuses: { passingBoost: 11, rushingBoost: 6, defenseBoost: 3 },
        keyPosition: 'TE', keyAttribute: 'hands',
        fitLabel: 'Pass-catching TE who can line up in the slot',
        icon: "🏮", color: getTeamById('saints').theme.primary,
    },
    {
        id: 'bucs-scheme', teamId: 'bucs',
        name: "Heron Deep Zone", category: 'Defense-First',
        description: 'Deep-dropping MLB removes the middle of the field. Zone-based scheme that forces conservative QB play.',
        bonuses: { passingBoost: 5, rushingBoost: 2, defenseBoost: 12 },
        keyPosition: 'LB', keyAttribute: 'zoneCoverage',
        fitLabel: 'Athletic MLB with range to cover deep middle zones',
        icon: "🪶", color: getTeamById('bucs').theme.primary,
    },

    // ─── NFC EAST ────────────────────────────────────────────────────
    {
        id: 'cowboys-scheme', teamId: 'cowboys',
        name: "Javelina Vertical", category: 'Pass-Heavy',
        description: 'Vertical threats to every level of the field. A big-armed QB and multiple speed weapons make this the league\'s most dangerous passing scheme.',
        bonuses: { passingBoost: 14, rushingBoost: 0, defenseBoost: 3 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Multiple speed WRs who win vertically',
        icon: "🐗", color: getTeamById('cowboys').theme.primary,
    },
    {
        id: 'giants-scheme', teamId: 'giants',
        name: "Fir Ground Control", category: 'Balanced',
        description: 'Physical ground game with a ball-control philosophy. Defense anchors the team while the run game controls field position.',
        bonuses: { passingBoost: 0, rushingBoost: 10, defenseBoost: 9 },
        keyPosition: 'RB', keyAttribute: 'power',
        fitLabel: 'Physical interior run game needs a punishing RB',
        icon: "🌲", color: getTeamById('giants').theme.primary,
    },
    {
        id: 'eagles-scheme', teamId: 'eagles',
        name: "Founders RPO", category: 'RPO',
        description: 'Dominant run-pass option powered by one of the best offensive lines in football. Every snap is a mismatch nightmare for defenses.',
        bonuses: { passingBoost: 9, rushingBoost: 13, defenseBoost: 4 },
        keyPosition: 'QB', keyAttribute: 'pocket',
        fitLabel: 'Smart QB backed by a dominant OL makes this elite',
        icon: "🪶", color: getTeamById('eagles').theme.primary,
    },
    {
        id: 'commanders-scheme', teamId: 'commanders',
        name: "Fox Air Attack", category: 'Pass-Heavy',
        description: 'High-volume passing with wide receiver routes at every level. The QB is the star — get the ball out fast and often.',
        bonuses: { passingBoost: 13, rushingBoost: 2, defenseBoost: 3 },
        keyPosition: 'QB', keyAttribute: 'accuracy',
        fitLabel: 'Accurate QB who can distribute to multiple weapons',
        icon: "🦊", color: getTeamById('commanders').theme.primary,
    },

    // ─── NFC WEST ────────────────────────────────────────────────────
    {
        id: 'cardinals-scheme', teamId: 'cardinals',
        name: "Roadrunner Spread", category: 'Pass-Heavy',
        description: 'Wide-open spread formations flood every zone. The fastest players on the field create impossible coverage assignments.',
        bonuses: { passingBoost: 13, rushingBoost: -3, defenseBoost: 2 },
        keyPosition: 'WR', keyAttribute: 'separation',
        fitLabel: 'Speed-first WRs who run crisp separation routes',
        icon: "🌵", color: getTeamById('cardinals').theme.primary,
    },
    {
        id: '49ers-scheme', teamId: '49ers',
        name: "Trident Motion RPO", category: 'RPO',
        description: 'Outside zone runs combined with pre-snap motion. One of the most balanced and deceptive offenses in football.',
        bonuses: { passingBoost: 9, rushingBoost: 10, defenseBoost: 5 },
        keyPosition: 'RB', keyAttribute: 'speed',
        fitLabel: 'Speedy, versatile RB who can catch and run outside zone',
        icon: "🔱", color: getTeamById('49ers').theme.primary,
    },
    {
        id: 'seahawks-scheme', teamId: 'seahawks',
        name: "Sockeye Power", category: 'Balanced',
        description: 'Physical run game and stifling press coverage. Win by dominating the trenches on both sides of the ball.',
        bonuses: { passingBoost: 3, rushingBoost: 11, defenseBoost: 10 },
        keyPosition: 'CB', keyAttribute: 'coverage',
        fitLabel: 'Press-man CB who can play physical at the line',
        icon: "🐟", color: getTeamById('seahawks').theme.primary,
    },
    {
        id: 'rams-scheme', teamId: 'rams',
        name: "Saber Motion", category: 'Pass-Heavy',
        description: 'Motion-heavy pre-snap manipulation with creative route combinations. One of the most schematically advanced offenses in football.',
        bonuses: { passingBoost: 13, rushingBoost: 5, defenseBoost: 3 },
        keyPosition: 'WR', keyAttribute: 'routeRunning',
        fitLabel: 'Elite route-running WR who wins in tight spaces',
        icon: "🐈", color: getTeamById('rams').theme.primary,
    },
];

// Maps playbook ID → playbook object
export const PLAYBOOK_MAP = Object.fromEntries(PLAYBOOKS.map(p => [p.id, p]));

// Maps team ID → default playbook ID for that team
export const TEAM_PLAYBOOK_MAP = Object.fromEntries(PLAYBOOKS.map(p => [p.teamId, p.id]));

// Returns 0–100 fit score for a playbook given a roster
export function calculatePlaybookFit(playbook, roster) {
    if (!playbook.keyPosition || !roster || roster.length === 0) return 88;

    const GROUP = {
        QB: ['QB'],
        RB: ['RB', 'FB'],
        WR: ['WR'],
        TE: ['TE'],
        DL: ['DL', 'DE', 'DT'],
        LB: ['LB', 'MLB', 'OLB'],
        CB: ['CB'],
        S: ['S', 'FS', 'SS', 'DB'],
    };

    const group = GROUP[playbook.keyPosition] || [playbook.keyPosition];
    const players = roster.filter(p => group.includes(p.position));
    if (players.length === 0) return 25;

    const ranked = [...players].sort((a, b) => b.ovr - a.ovr);

    const keyValue = (pl) => {
        if (!playbook.keyAttribute) return pl.ovr;
        return pl.attributes?.position?.[playbook.keyAttribute]
            ?? pl.attributes?.universal?.[playbook.keyAttribute]
            ?? pl.ovr;
    };

    // Weight the starter heavily but let the backup matter — a scheme that
    // leans on one position is fragile if there is nothing behind him.
    const starter = keyValue(ranked[0]);
    const backup = ranked[1] ? keyValue(ranked[1]) : starter - 12;
    const attrVal = starter * 0.75 + backup * 0.25;

    // Mapped across the full 50–99 attribute band. The previous curve was
    // ((attr - 55) / 40) * 100, which saturated at 95 — so on any decent
    // roster every one of the 32 schemes reported "Elite fit · 100" and the
    // meter carried no information.
    return Math.round(Math.max(15, Math.min(100, ((attrVal - 50) / 49) * 100)));
}
