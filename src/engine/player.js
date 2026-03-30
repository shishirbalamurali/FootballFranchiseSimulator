// Player attribute schema and generation system

// Position definitions
export const POSITIONS = {
    // Offense
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    OL: 'OL',
    // Defense
    DL: 'DL',
    LB: 'LB',
    CB: 'CB',
    S: 'S',
    // Special Teams
    K: 'K',
    P: 'P' // Added Punter
};

// Handedness
export const HANDEDNESS = ['Right', 'Left', 'Ambidextrous'];

// Development traits
export const DEV_TRAITS = {
    SUPERSTAR: 'Superstar',
    STAR: 'Star',
    NORMAL: 'Normal',
    SLOW: 'Slow'
};

// Personality traits
export const PERSONALITY_TRAITS = [
    'Leader',
    'Clutch',
    'BoomBust',
    'Workhorse',
    'Playmaker',
    'Reliable',
    'Hothead',
    'IceInVeins'
];

// Archetypes by position
export const ARCHETYPES = {
    QB: ['Point Guard', 'Gunslinger', 'Scrambly Pocket Escape', 'Game Manager', 'Alien MVP'],
    RB: ['Power Back', 'Speed Back', 'Receiving Back', 'Elusive', 'Balanced'],
    WR: ['Deep Threat', 'Possession', 'Route Runner', 'Slot', 'Red Zone'],
    TE: ['Receiving', 'Blocking', 'Balanced'],
    OL: ['Pass Protector', 'Run Blocker', 'Balanced'],
    DL: ['Speed Rusher', 'Power Rusher', 'Run Stopper', 'Balanced'],
    LB: ['Coverage', 'Run Stopper', 'Pass Rusher', 'Balanced'],
    CB: ['Man Coverage', 'Zone Coverage', 'Press', 'Balanced'],
    S: ['Free Safety', 'Strong Safety', 'Ball Hawk', 'Enforcer'],
    K: ['Accurate', 'Power Leg'],
    P: ['Power Leg', 'Precision']
};

// Peak ages by position
export const PEAK_AGES = {
    QB: 30,
    RB: 26,
    WR: 28,
    TE: 28,
    OL: 29,
    DL: 28,
    LB: 27,
    CB: 27,
    S: 28,
    K: 32,
    P: 32
};

// Expanded Name Lists
const FIRST_NAMES = [
    'Marcus', 'Tyler', 'Brandon', 'Derek', 'Jordan', 'Alex', 'Chris', 'Ryan',
    'Josh', 'Kyle', 'Cameron', 'Justin', 'Trent', 'Jake', 'Connor', 'Mason',
    'Devin', 'Blake', 'Cole', 'Logan', 'Austin', 'Hunter', 'Chase', 'Brett',
    'Trevor', 'Drew', 'Sean', 'Travis', 'Zach', 'Cody', 'Dylan', 'Dustin',
    'Jared', 'Luke', 'Matt', 'Nick', 'Owen', 'Riley', 'Sam', 'Taylor',
    'DeAndre', 'Malik', 'Trevon', 'Jamal', 'Dante', 'Tyrell', 'Kobe', 'Isaiah',
    'Xavier', 'Jalen', 'Darius', 'Elijah', 'Kyrie', 'Terrence', 'Quincy', 'Lamar',
    'Deshaun', 'Khalil', 'Jaylen', 'Marquis', 'Aiden', 'Ethan', 'Liam', 'Noah',
    'Caleb', 'Julian', 'Adrian', 'Christian', 'Gabriel', 'Elias', 'Anthony',
    'Jeremiah', 'Josiah', 'Micah', 'Amari'
];

const LAST_NAMES = [
    'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
    'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
    'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark',
    'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott',
    'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Carter', 'Mitchell', 'Turner',
    'Washington', 'Jefferson', 'Banks', 'Mosley', 'Diggs', 'Sanders', 'Rhodes',
    'Campbell', 'Bryant', 'Griffin', 'Haynes', 'Bishop', 'Cannon', 'Davenport',
    'Ellison', 'Floyd', 'Glover', 'Hampton', 'Ingram', 'Jennings', 'Knight',
    'Lawson', 'Mack', 'Nixon', 'Owens', 'Patton', 'Quinn', 'Reed', 'Sims',
    'Tate', 'Underwood', 'Vaughn', 'Ware', 'York', 'Zimmerman'
];

export function generateName() {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${first} ${last}`;
}

// Generate a random attribute value with variance
function randAttr(min, max, bias = 0) {
    const range = max - min;
    const value = min + Math.random() * range;
    return Math.round(Math.max(min, Math.min(max, value + bias)));
}

// Generate base universal attributes
function generateUniversalAttributes(position, ovr) {
    const variance = 10;
    return {
        speed: randAttr(Math.max(40, ovr - variance), Math.min(99, ovr + variance)),
        acceleration: randAttr(Math.max(40, ovr - variance), Math.min(99, ovr + variance)),
        agility: randAttr(Math.max(40, ovr - variance), Math.min(99, ovr + variance)),
        strength: randAttr(Math.max(40, ovr - variance), Math.min(99, ovr + variance)),
        stamina: randAttr(70, 99),
        awareness: randAttr(Math.max(40, ovr - 5), Math.min(99, ovr + 5)),
        discipline: randAttr(60, 95),
        durability: randAttr(70, 99)
    };
}

// Generate position-specific attributes
function generatePositionAttributes(position, archetype, baseOvr) {
    const variance = 12;
    const attrs = {};

    switch (position) {
        case 'QB':
            // LATENT TRAITS SYSTEM
            const base = baseOvr;
            attrs.accuracy = randAttr(base - 10, base + 10);
            attrs.aggression = randAttr(base - 10, base + 10);
            attrs.processing = randAttr(base - 10, base + 10);
            attrs.pocket = randAttr(base - 10, base + 10);
            attrs.arm = randAttr(base - 10, base + 10);
            attrs.clutch = randAttr(base - 15, base + 15);

            if (archetype === 'Point Guard') {
                attrs.accuracy += 8;
                attrs.processing += 8;
                attrs.aggression -= 5;
            } else if (archetype === 'Gunslinger') {
                attrs.arm += 8;
                attrs.aggression += 10;
                attrs.accuracy -= 5;
            } else if (archetype === 'Scrambly Pocket Escape') {
                attrs.pocket += 12;
                attrs.aggression += 5;
                attrs.processing -= 5;
            } else if (archetype === 'Game Manager') {
                attrs.processing += 5;
                attrs.accuracy += 5;
                attrs.aggression -= 10;
                attrs.arm -= 5;
            } else if (archetype === 'Alien MVP') {
                attrs.arm += 5;
                attrs.pocket += 5;
                attrs.aggression += 5;
                attrs.processing += 5;
            }
            break;

        case 'RB':
            const rbBase = baseOvr;
            // New 5-Trait RB Model (Clean Sim)
            attrs.vol = randAttr(rbBase - 10, rbBase + 10); // Volume / Workload
            attrs.eff = randAttr(rbBase - 10, rbBase + 10); // Efficiency / Vision
            attrs.exp = randAttr(rbBase - 10, rbBase + 10); // Explosiveness
            attrs.gl = randAttr(rbBase - 10, rbBase + 10);  // Goal Line
            attrs.sec = randAttr(rbBase - 10, rbBase + 10); // Ball Security

            // Legacy mappings for UI/Display (optional but good for compatibility)
            attrs.carrying = attrs.sec;
            attrs.vision = attrs.eff;
            attrs.breakTackle = attrs.vol;
            attrs.elusiveness = attrs.exp;
            attrs.catching = randAttr(Math.max(40, baseOvr - 15), Math.min(99, baseOvr + 5)); // Keep catching separate
            attrs.passBlock = randAttr(40, 80);

            if (archetype === 'Power Back') {
                attrs.vol += 8;
                attrs.gl += 8;
                attrs.exp -= 5;
            } else if (archetype === 'Speed Back') {
                attrs.exp += 10;
                attrs.eff += 5;
                attrs.vol -= 5;
                attrs.gl -= 5;
            } else if (archetype === 'Elusive') {
                attrs.eff += 10;
                attrs.exp += 5;
                attrs.vol -= 5;
            } else if (archetype === 'Receiving Back') {
                attrs.catching += 10;
                attrs.vol -= 8; // Less of a workhorse
                attrs.exp += 5;
            }
            break;

        case 'WR':
            attrs.catching = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.routeRun = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.release = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.catchInTraffic = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.deepThreat = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Deep Threat') attrs.deepThreat += 5;
            if (archetype === 'Route Runner') attrs.routeRun += 5;
            break;

        case 'TE':
            attrs.catching = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.routeRun = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.runBlock = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.passBlock = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Receiving') attrs.catching += 5;
            if (archetype === 'Blocking') { attrs.runBlock += 5; attrs.passBlock += 5; }
            break;

        case 'OL':
            attrs.passBlock = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.runBlock = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.impactBlock = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.awarenessOL = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Pass Protector') attrs.passBlock += 5;
            if (archetype === 'Run Blocker') attrs.runBlock += 5;
            break;

        case 'DL':
            attrs.blockShedding = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.powerMoves = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.finesseMoves = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.tackle = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            if (archetype === 'Speed Rusher') attrs.finesseMoves += 5;
            if (archetype === 'Power Rusher') attrs.powerMoves += 5;
            break;

        case 'LB':
            attrs.tackle = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.pursuit = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.coverage = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.blitz = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Coverage') attrs.coverage += 5;
            if (archetype === 'Pass Rusher') attrs.blitz += 5;
            break;

        case 'CB':
            attrs.manCoverage = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.zoneCoverage = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.press = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.ballSkills = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Man Coverage') attrs.manCoverage += 5;
            if (archetype === 'Zone Coverage') attrs.zoneCoverage += 5;
            break;

        case 'S':
            attrs.coverage = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.tackle = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.ballSkills = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            attrs.range = randAttr(Math.max(40, baseOvr - variance), Math.min(99, baseOvr + variance));
            if (archetype === 'Ball Hawk') attrs.ballSkills += 5;
            if (archetype === 'Enforcer') attrs.tackle += 5;
            break;

        case 'K':
            attrs.kickPower = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.kickAccuracy = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            if (archetype === 'Accurate') attrs.kickAccuracy += 5;
            if (archetype === 'Power Leg') attrs.kickPower += 5;
            break;

        case 'P':
            attrs.kickPower = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            attrs.kickAccuracy = randAttr(Math.max(40, baseOvr - 5), Math.min(99, baseOvr + 5));
            break;
    }

    // Cap all attributes
    Object.keys(attrs).forEach(key => {
        attrs[key] = Math.max(40, Math.min(99, attrs[key]));
    });

    return attrs;
}

// Calculate OVR from attributes
export function calculateOVR(position, universal, positionSpecific) {
    let weightedSum = 0;
    let totalWeight = 0;

    if (position === 'QB') {
        const { processing, accuracy, arm, pocket, aggression, clutch } = positionSpecific;
        // QB_OVR = 0.28 PROC + 0.22 ACC + 0.18 ARM + 0.14 POCK + 0.12 AGG + 0.06 CLUTCH
        weightedSum = (processing * 0.28) + (accuracy * 0.22) + (arm * 0.18) + (pocket * 0.14) + (aggression * 0.12) + (clutch * 0.06);
        return Math.round(weightedSum);
    }

    if (position === 'RB') {
        const { vol, eff, exp, gl, sec } = positionSpecific;
        // RB OVR = 0.30 EFF + 0.25 VOL + 0.20 EXP + 0.15 GL + 0.10 SEC
        // Using provided 5 traits directly
        weightedSum = (eff * 0.30) + (vol * 0.25) + (exp * 0.20) + (gl * 0.15) + (sec * 0.10);
        return Math.round(weightedSum);
    }

    // Universal weights (vary by position)
    const universalWeights = {
        speed: position === 'OL' ? 0.5 : 1.5,
        acceleration: position === 'OL' ? 0.3 : 1.2,
        agility: position === 'OL' ? 0.5 : 1.0,
        strength: ['OL', 'DL', 'LB'].includes(position) ? 1.5 : 0.8,
        awareness: 1.0,
        discipline: 0.5
    };

    Object.entries(universalWeights).forEach(([attr, weight]) => {
        if (universal[attr]) {
            weightedSum += universal[attr] * weight;
            totalWeight += weight;
        }
    });

    // Position-specific weights (all high importance)
    Object.values(positionSpecific).forEach(value => {
        weightedSum += value * 2.0;
        totalWeight += 2.0;
    });

    return Math.round(weightedSum / totalWeight);
}

// Generate a player
export function generatePlayer(position, targetOvr = null, age = null) {
    const id = `${position}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let baseOvr = targetOvr;
    if (!baseOvr) {
        const roll = Math.random();
        if (roll < 0.55) baseOvr = randAttr(55, 70);
        else if (roll < 0.80) baseOvr = randAttr(71, 79);
        else if (roll < 0.94) baseOvr = randAttr(80, 89);
        else if (roll < 0.985) baseOvr = randAttr(90, 95);
        else baseOvr = randAttr(96, 99);
    }

    const playerAge = age || randAttr(22, 28);
    const experience = Math.max(0, playerAge - 22);

    const archetypes = ARCHETYPES[position];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    const universal = generateUniversalAttributes(position, baseOvr);
    const positionSpecific = generatePositionAttributes(position, archetype, baseOvr);

    const ovr = calculateOVR(position, universal, positionSpecific);

    const potVariance = playerAge < 25 ? randAttr(0, 10) : randAttr(-5, 3);
    const pot = Math.max(ovr, Math.min(99, ovr + potVariance));

    let devTrait;
    if (pot >= 88) devTrait = DEV_TRAITS.SUPERSTAR;
    else if (pot >= 80) devTrait = Math.random() < 0.3 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
    else if (pot >= 70) devTrait = Math.random() < 0.2 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
    else devTrait = Math.random() < 0.7 ? DEV_TRAITS.NORMAL : DEV_TRAITS.SLOW;

    const personality = PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)];
    const handedness = Math.random() < 0.85 ? 'Right' : (Math.random() < 0.9 ? 'Left' : 'Ambidextrous');

    return {
        id,
        name: generateName(),
        position,
        age: playerAge,
        experience,
        handedness,
        ovr,
        pot,
        devTrait,
        personality,
        archetype,
        attributes: {
            universal,
            position: positionSpecific
        },
        ovrHistory: [ovr],
        injuryRisk: universal.durability,
        injured: false,
        morale: 75,
        stats: {
            career: {},
            season: {}
        }
    };
}

// Generate a full roster (53 players) with Team Quality Modifier
export function generateRoster(qualityMod = 0) {
    const roster = [];
    const positionCounts = {
        QB: 3, RB: 4, WR: 6, TE: 4, OL: 9, DL: 8, LB: 7, CB: 6, S: 4, K: 1, P: 1
    };

    Object.entries(positionCounts).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            let targetOvr;
            const isStarter = i === 0 || (i === 1 && ['WR', 'CB', 'DL', 'LB', 'OL'].includes(pos));
            const superstarChance = 0.035 + (qualityMod * 0.005);

            if (isStarter && Math.random() < superstarChance) {
                targetOvr = randAttr(91, 99);
            } else {
                if (i === 0) targetOvr = randAttr(78 + qualityMod, 90 + qualityMod);
                else if (i === 1 && ['WR', 'CB', 'DL', 'LB', 'OL'].includes(pos)) targetOvr = randAttr(75 + qualityMod, 85 + qualityMod);
                else if (i < count / 2) targetOvr = randAttr(70 + Math.floor(qualityMod / 2), 78 + Math.floor(qualityMod / 2));
                else targetOvr = randAttr(60, 72);
            }

            targetOvr = Math.max(50, Math.min(99, targetOvr));
            roster.push(generatePlayer(pos, targetOvr));
        }
    });

    return roster.sort((a, b) => b.ovr - a.ovr);
}

// Function to enforce league-wide superstar quotas
export function injectLeagueSuperstars(rosters) {
    const teams = Object.keys(rosters);
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];

    positions.forEach(pos => {
        let pool = [];
        teams.forEach(tid => {
            const players = rosters[tid].filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr);
            if (players.length > 0) pool.push({ tid, player: players[0] });
        });

        const count = randAttr(3, 5);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        for (let i = 0; i < count; i++) {
            if (pool[i]) {
                const p = pool[i].player;
                const newOvr = randAttr(95, 99);
                const newP = generatePlayer(pos, newOvr, p.age);
                const teamRoster = rosters[pool[i].tid];
                const idx = teamRoster.findIndex(Rp => Rp.id === p.id);
                if (idx !== -1) {
                    teamRoster[idx] = newP;
                }
            }
        }
    });
}
