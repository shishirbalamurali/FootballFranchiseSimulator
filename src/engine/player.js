// Player attribute schema and generation system

// Salary multipliers by position (relative to base)
const POS_SALARY_MULT = {
    QB: 2.0, WR: 1.3, CB: 1.2, DL: 1.2, OL: 1.1,
    LB: 1.0, S: 0.9, TE: 1.0, RB: 0.85, K: 0.5, P: 0.4
};

// Salary in $M based on OVR and position — tuned so 53-man roster ≈ $140-180M average
function calcSalary(position, ovr) {
    const base = Math.max(0.5, (ovr - 62) * 0.27);
    const mult = POS_SALARY_MULT[position] || 1.0;
    return Math.round(base * mult * 10) / 10; // 1 decimal place
}

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

// Athletic tools are position-relative, not a second copy of overall skill.
// A developmental receiver can still run; an All-Pro guard need not run like one.
const PHYSICAL_PROFILES = {
    QB: { speed: 65, acceleration: 68, agility: 67, strength: 64 },
    RB: { speed: 87, acceleration: 89, agility: 86, strength: 74 },
    WR: { speed: 89, acceleration: 88, agility: 86, strength: 59 },
    TE: { speed: 77, acceleration: 77, agility: 74, strength: 79 },
    OL: { speed: 57, acceleration: 61, agility: 58, strength: 88 },
    DL: { speed: 70, acceleration: 75, agility: 67, strength: 87 },
    LB: { speed: 80, acceleration: 81, agility: 77, strength: 80 },
    CB: { speed: 90, acceleration: 89, agility: 88, strength: 58 },
    S:  { speed: 85, acceleration: 85, agility: 81, strength: 69 },
    K:  { speed: 60, acceleration: 61, agility: 60, strength: 57 },
    P:  { speed: 61, acceleration: 62, agility: 61, strength: 59 }
};
const ATHLETIC_ARCHETYPES = {
    QB: { 'Scrambly Pocket Escape': [16, 15, 14, 0], 'Alien MVP': [12, 11, 10, 3], 'Game Manager': [-4, -3, -3, 0] },
    RB: { 'Power Back': [-5, -4, -5, 9], 'Speed Back': [5, 3, 0, -5], Elusive: [1, 2, 5, -4], 'Receiving Back': [0, 1, 3, -4] },
    WR: { 'Deep Threat': [5, 3, -1, -3], Possession: [-4, -3, -2, 5], Slot: [-1, 2, 5, -3], 'Red Zone': [-3, -2, -3, 7] },
    TE: { Receiving: [5, 4, 5, -5], Blocking: [-5, -4, -4, 6] },
    OL: { 'Pass Protector': [1, 2, 4, -2], 'Run Blocker': [-1, 0, -2, 3] },
    DL: { 'Speed Rusher': [8, 7, 7, -7], 'Power Rusher': [-3, -2, -3, 4], 'Run Stopper': [-6, -5, -5, 6] },
    LB: { Coverage: [4, 3, 5, -5], 'Run Stopper': [-4, -3, -4, 5], 'Pass Rusher': [1, 3, 0, 2] },
    CB: { Press: [-2, -1, -2, 7] },
    S: { 'Free Safety': [3, 2, 3, -3], 'Strong Safety': [-3, -2, -2, 4], Enforcer: [-4, -3, -3, 7] }
};

function generateUniversalAttributes(position, ovr, archetype) {
    const profile = PHYSICAL_PROFILES[position];
    const adjustments = ATHLETIC_ARCHETYPES[position]?.[archetype] || [0, 0, 0, 0];
    const physical = Object.fromEntries(Object.entries(profile).map(([key, center], index) => {
        // Moderate tools/skill correlation, with enough spread for athletic projects.
        const mean = center + (ovr - 75) * 0.2 + adjustments[index];
        return [key, Math.max(40, Math.min(99, randAttr(mean - 7, mean + 7)))];
    }));
    return {
        ...physical,
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
        case 'QB': {
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
        }
        case 'RB': {
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
        }
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

    // Aliases must reflect the final clamped/archetype-adjusted latent traits.
    if (position === 'RB') {
        attrs.carrying = attrs.sec;
        attrs.vision = attrs.eff;
        attrs.breakTackle = attrs.vol;
        attrs.elusiveness = attrs.exp;
    }
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

    const skills = Object.values(positionSpecific).filter(Number.isFinite);
    const skillLevel = skills.length ? skills.reduce((sum, value) => sum + value, 0) / skills.length : 75;
    Object.entries(universalWeights).forEach(([attr, weight]) => {
        if (universal[attr]) {
            const center = PHYSICAL_PROFILES[position]?.[attr];
            // Grade athleticism against this position's expected tools, keeping
            // the league's OVR bands comparable across big men and skill players.
            const rating = center == null ? universal[attr]
                : skillLevel + universal[attr] - (center + (skillLevel - 75) * 0.2);
            weightedSum += rating * weight;
            totalWeight += weight;
        }
    });

    // Position-specific weights (all high importance)
    Object.values(positionSpecific).forEach(value => {
        weightedSum += value * 2.0;
        totalWeight += 2.0;
    });

    return Math.max(40, Math.min(99, Math.round(weightedSum / totalWeight)));
}

// Roll a development trait from a player's ceiling. Exported so the draft can
// re-derive it after assigning a prospect a band-specific potential.
export function devTraitForPotential(pot) {
    if (pot >= 88) return DEV_TRAITS.SUPERSTAR;
    if (pot >= 80) return Math.random() < 0.3 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
    if (pot >= 70) return Math.random() < 0.2 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
    return Math.random() < 0.7 ? DEV_TRAITS.NORMAL : DEV_TRAITS.SLOW;
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

    const universal = generateUniversalAttributes(position, baseOvr, archetype);
    const positionSpecific = generatePositionAttributes(position, archetype, baseOvr);

    const ovr = calculateOVR(position, universal, positionSpecific);

    // Headroom shrinks as a player's current rating rises: a 70 OVR rookie can
    // still become a star, while an 88 OVR player is already close to his
    // ceiling. A flat +0-10 for everyone handed the league's best players
    // 95-99 ceilings, and progression then marched them all there — the count
    // of 90+ players more than doubled over four simulated seasons.
    const headroom = Math.max(2, Math.round((95 - ovr) * 0.45));
    const potVariance = playerAge < 25
        ? randAttr(0, headroom)
        : randAttr(-5, Math.max(1, Math.round(headroom * 0.3)));
    const pot = Math.max(ovr, Math.min(99, ovr + potVariance));

    const devTrait = devTraitForPotential(pot);

    const personality = PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)];
    const handedness = Math.random() < 0.85 ? 'Right' : (Math.random() < 0.9 ? 'Left' : 'Ambidextrous');

    // Contract: salary scales with OVR, years 1-4 (stagger so not everyone expires same season)
    const salary = calcSalary(position, ovr);
    const contractYears = Math.floor(1 + Math.random() * 4);

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
        contract: { salary, years: contractYears, yearsLeft: contractYears },
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

// The canonical shape of a 53-man roster. Exported so roster generation, the
// CSV importer and the CPU's free-agency logic all agree on what a complete
// team looks like — they used to carry three separate copies of these numbers.
export const ROSTER_COMPOSITION = {
    QB: 3, RB: 4, WR: 6, TE: 4, OL: 9, DL: 8, LB: 7, CB: 6, S: 4, K: 1, P: 1
};

// The minimum a team must carry at each position to field a legal, functioning
// unit. The CPU fills up to these first, then adds depth toward the full 53.
export const POSITION_MINIMUMS = {
    QB: 2, RB: 3, WR: 5, TE: 2, OL: 8, DL: 6, LB: 5, CB: 5, S: 4, K: 1, P: 1
};

export const ROSTER_LIMIT = Object.values(ROSTER_COMPOSITION).reduce((a, b) => a + b, 0);

// Generate a full roster (53 players) with Team Quality Modifier
export function generateRoster(qualityMod = 0) {
    const roster = [];
    const positionCounts = ROSTER_COMPOSITION;

    Object.entries(positionCounts).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            // Bands are set so the league lands near the real distribution of
            // talent: a median roster player in the low 70s, ~30 players at 90+
            // league-wide and a handful at 95+. The previous bands topped out
            // high enough to produce ~90 players at 90+, which made "elite"
            // meaningless and inflated every statistical leaderboard.
            let targetOvr;
            const isStarter = i === 0 || (i === 1 && ['WR', 'CB', 'DL', 'LB', 'OL'].includes(pos));
            const superstarChance = 0.023 + (qualityMod * 0.003);

            if (isStarter && Math.random() < superstarChance) {
                targetOvr = randAttr(89, 95);
            } else {
                if (i === 0) targetOvr = randAttr(76 + qualityMod, 88 + qualityMod);
                else if (i === 1 && ['WR', 'CB', 'DL', 'LB', 'OL'].includes(pos)) targetOvr = randAttr(72 + qualityMod, 83 + qualityMod);
                else if (i < count / 2) targetOvr = randAttr(68 + Math.floor(qualityMod / 2), 77 + Math.floor(qualityMod / 2));
                else targetOvr = randAttr(60 + Math.min(0, qualityMod), 70 + Math.min(0, qualityMod));
            }

            targetOvr = Math.max(50, Math.min(99, targetOvr));
            roster.push(generatePlayer(pos, targetOvr));
        }
    });

    return roster.sort((a, b) => b.ovr - a.ovr);
}

// Enforce a league-wide superstar quota.
//
// The NFL has a handful of true 95+ players at any moment, not three to five at
// every position. This promotes a small, position-weighted set of the league's
// existing best players instead of ~40, which is what kept the top of the OVR
// curve from meaning anything.
const SUPERSTAR_POSITION_WEIGHT = {
    QB: 3.0, WR: 2.2, DL: 2.2, CB: 1.6, OL: 1.5, LB: 1.3, TE: 1.0, S: 1.0, RB: 0.9,
};

export function injectLeagueSuperstars(rosters) {
    const teams = Object.keys(rosters);
    if (teams.length === 0) return;

    // Candidate pool: each team's best player at each weighted position.
    const pool = [];
    Object.entries(SUPERSTAR_POSITION_WEIGHT).forEach(([pos, weight]) => {
        teams.forEach(tid => {
            const best = (rosters[tid] || [])
                .filter(p => p.position === pos)
                .sort((a, b) => b.ovr - a.ovr)[0];
            if (best) pool.push({ tid, player: best, weight: weight * Math.random() });
        });
    });

    // Weighted shuffle, then take the quota off the top. One superstar per team
    // at most, so the talent does not stack on a single roster.
    pool.sort((a, b) => b.weight - a.weight);

    const quota = randAttr(5, 8);
    const usedTeams = new Set();
    let promoted = 0;

    for (const entry of pool) {
        if (promoted >= quota) break;
        if (usedTeams.has(entry.tid)) continue;

        const teamRoster = rosters[entry.tid];
        const idx = teamRoster.findIndex(p => p.id === entry.player.id);
        if (idx === -1) continue;

        teamRoster[idx] = generatePlayer(entry.player.position, randAttr(95, 98), entry.player.age);
        usedTeams.add(entry.tid);
        promoted++;
    }
}
