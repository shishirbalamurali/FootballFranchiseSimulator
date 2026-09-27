// Draft system - prospect generation and CPU drafting

import { collegeProfile } from './draftExperience.js';
import { devTraitForPotential, generatePlayer } from './player.js';

// Position value tiers for CPU decision-making
// QB is valuable but not so dominant that every team grabs one round 1
const POSITION_VALUE = {
    QB: 1.5,
    DL: 1.45,
    WR: 1.35,
    CB: 1.30,
    OL: 1.25,
    LB: 1.15,
    S:  1.10,
    TE: 1.05,
    RB: 0.95,
    K:  0.50,
};

// Draft grade letter from numeric grade
export function getDraftGradeLetter(grade) {
    if (grade >= 88) return 'A+';
    if (grade >= 84) return 'A';
    if (grade >= 80) return 'A-';
    if (grade >= 76) return 'B+';
    if (grade >= 72) return 'B';
    if (grade >= 68) return 'B-';
    if (grade >= 64) return 'C+';
    if (grade >= 60) return 'C';
    if (grade >= 56) return 'C-';
    return 'D';
}

export function getGradeColor(letter) {
    if (letter.startsWith('A')) return '#16a34a';
    if (letter === 'B+' || letter === 'B') return '#2563eb';
    if (letter === 'B-' || letter === 'C+') return '#d97706';
    return '#9ca3af';
}

// Scouting report snippets per position
const SCOUT_REPORTS = {
    QB: {
        strengths: [
            ['Elite arm strength', 'Throws frozen ropes into tight windows with ease.'],
            ['Elite mobility', 'Can escape pressure and extend plays outside the pocket.'],
            ['Pro-ready IQ', 'Pre-snap reads are exceptional; rarely fooled by coverage.'],
            ['Strong release', 'Quick release limits sack exposure and speeds up the passing game.'],
            ['Leadership pedigree', 'Multiple years as a starter; commands the huddle naturally.'],
            ['Big-game composure', 'Thrives under pressure; stats improve in clutch situations.'],
        ],
        weaknesses: [
            ['Footwork inconsistency', 'Tends to drift in the pocket, affecting ball placement downfield.'],
            ['Happy feet', 'Can bail on clean pockets early when facing a strong pass rush.'],
            ['Turnover-prone', 'Tries to force throws in coverage; needs to learn when to throw it away.'],
            ['Limited touch', 'Throws too hard underneath; receivers struggle to make YAC.'],
        ],
        background: [
            'Three-year starter at a major program. Broke nearly every school passing record.',
            'Dual-threat weapon who lit up the Combine with elite athletic testing numbers.',
            'Classic pocket passer who took a small-school program to back-to-back conference titles.',
            'Raw talent with only one year of starting experience but jaw-dropping upside.',
        ],
    },
    RB: {
        strengths: [
            ['Elite burst', 'Hits the hole with instant acceleration; no wasted motion.'],
            ['Receiving ability', 'Natural pass-catcher out of the backfield; a true weapon on screens.'],
            ['Contact balance', 'Breaks tackles at an elite rate; rarely goes down on first contact.'],
            ['Vision', 'Reads the backfield like a veteran; sets up blocks instinctively.'],
            ['Pass protection', 'Willing and capable pass protector; stays in on third downs.'],
        ],
        weaknesses: [
            ['Durability questions', 'Heavy workload in college; scouts monitor wear and tear.'],
            ['Limited receiving', 'Primarily a between-the-tackles back; needs work as a receiver.'],
            ['Fumble tendency', 'Ball security must improve at the next level.'],
            ['Top-end speed', 'Gets by on power and vision; won\'t outrun safeties in the open field.'],
        ],
        background: [
            'Two-time all-conference selection. Led the nation in rushing yards per carry.',
            'Converted fullback with a thick frame and elite power for the position.',
            'Undersized but electric; Pro scouts love his contact balance and route running.',
            'Workhorse who handled 25+ carries per game in college without missing time.',
        ],
    },
    WR: {
        strengths: [
            ['Route precision', 'Crisp cuts and sharp breaks; creates instant separation.'],
            ['Elite speed', 'Ran a blistering 40 at the Combine; stretches every defense.'],
            ['Contested catch ability', 'Has a large catch radius and fights for every ball.'],
            ['YAC ability', 'Makes defenders miss after the catch; hard to bring down.'],
            ['Physicality', 'Uses body to box out corners on the outside; red zone threat.'],
        ],
        weaknesses: [
            ['Route tree', 'Relies heavily on the go route; intermediate routes need refinement.'],
            ['Drops', 'Occasional concentration drops; needs to clean up hands work.'],
            ['Consistency', 'Disappears for stretches in games; needs to find ways to stay involved.'],
            ['Physicality at the line', 'Struggles against press coverage; needs to improve release.'],
        ],
        background: [
            'Led Power 5 conference in receiving yards two straight seasons.',
            'Track star turned wide receiver; still raw as a route runner but the speed translates.',
            'Inside-outside versatility is his calling card; can line up anywhere on the field.',
            'Tough as nails; played through injuries and still produced at an elite level.',
        ],
    },
    TE: {
        strengths: [
            ['Receiving upside', 'Smooth route runner with reliable hands; a true mismatch weapon.'],
            ['Blocking', 'Excellent inline blocker; will help a pro run game immediately.'],
            ['Athleticism', 'Moves like a wide receiver; creates problems for linebackers in coverage.'],
            ['Red zone threat', 'Big body and great hands; nearly impossible to stop in the end zone.'],
        ],
        weaknesses: [
            ['Blocking', 'Prefers the receiving game; needs improvement as an inline blocker.'],
            ['Contested catches', 'Drops the ball when taking hits; needs to play through contact.'],
            ['Route running', 'Routes are predictable; will need to expand his tree in the pros.'],
        ],
        background: [
            'Former high school basketball star whose athleticism is still being tapped.',
            'Won two blocking awards in college; the receiving ability is an added bonus.',
            'The most complete tight end in the draft class; rare combination of skills.',
            'Transition from defensive end; raw technique but tremendous physical tools.',
        ],
    },
    OL: {
        strengths: [
            ['Pass pro technique', 'Textbook hand placement and footwork; a plug-and-play starter.'],
            ['Power', 'Generates elite drive in the run game; moves defenders off the ball.'],
            ['Football IQ', 'Understands protections; makes the right calls at the line.'],
            ['Athleticism', 'Excels in zone-blocking schemes; can pull and reach block effectively.'],
            ['Anchor strength', 'Bull rushers struggle to move him; keeps the pocket clean.'],
        ],
        weaknesses: [
            ['Speed off the edge', 'Can be exposed against elite speed rushers around the corner.'],
            ['Technique inconsistencies', 'Hand fighting gets sloppy when fatigued.'],
            ['Experience', 'Only one year of starting experience; raw but coachable.'],
        ],
        background: [
            'Three-year starter who anchored a line that allowed a conference-low in sacks.',
            'Converted defensive tackle with ideal frame and surprising athleticism.',
            'All-conference first team selection in a league known for producing pro linemen.',
            'Dominant run blocker whose pass protection is the last piece still developing.',
        ],
    },
    DL: {
        strengths: [
            ['Pass rush', 'Has a full repertoire of moves; doesn\'t rely on just one rush lane.'],
            ['Motor', 'Never stops competing; gives max effort on every single snap.'],
            ['Run defense', 'Anchor in the middle; two-gap ability that teams covet.'],
            ['Burst off the ball', 'Elite first step; in the backfield before blockers can react.'],
            ['Hand technique', 'Uses his hands like a veteran; wins the leverage battle consistently.'],
        ],
        weaknesses: [
            ['Bend', 'Stiff hips limit his ability to turn the corner on rush lanes.'],
            ['Weight', 'Frame may limit him to one role; could struggle in some schemes.'],
            ['Stamina', 'Production dips late in games; conditioning must improve.'],
        ],
        background: [
            'Led the nation in sacks from the interior; nearly impossible to block one-on-one.',
            'The most feared pass rusher in his conference for three consecutive seasons.',
            'Disruptive presence who forced double teams that opened up the entire defense.',
            'Two-way threat who excels in both run support and as a pass rusher.',
        ],
    },
    LB: {
        strengths: [
            ['Coverage', 'Can match up with tight ends and running backs out of the backfield.'],
            ['Blitzing', 'Elite pass rush off the edge; causes havoc on any blitz package.'],
            ['Instincts', 'Reads the run before the snap; diagnoses and attacks with speed.'],
            ['Physicality', 'Delivers devastating hits; sets the tone for the entire defense.'],
        ],
        weaknesses: [
            ['Coverage', 'Struggles in space against slot receivers; a liability in zone.'],
            ['Lateral agility', 'Change of direction needs work; gets caught on misdirection.'],
            ['Pass rush', 'Limited in his ability to contribute as a rusher; better against the run.'],
        ],
        background: [
            'Led his team in tackles for three straight years and was twice named all-conference.',
            'Converted defensive end who brings pass rush instincts to the linebacker spot.',
            'Teams love his intelligence; he\'s been known to call out plays before the snap.',
            'Defensive team captain whose energy and leadership elevates everyone around him.',
        ],
    },
    CB: {
        strengths: [
            ['Man coverage', 'Mirror technique is elite; opponents didn\'t throw his way twice.'],
            ['Ball hawk', 'Exceptional ball skills; has nose for the football in any coverage.'],
            ['Press ability', 'Physical at the line; disrupts timing routes with aggressive jam.'],
            ['Zone awareness', 'Excellent pattern recognition; breaks on the ball with urgency.'],
        ],
        weaknesses: [
            ['Size', 'May be limited to slot corner role at the next level against physical WRs.'],
            ['Recovery speed', 'If beaten off the line, struggles to close the gap.'],
            ['Zone awareness', 'Better in man; reads are too slow in zone coverage.'],
        ],
        background: [
            'Blanketed the opposition\'s number one receiver every single week.',
            'Recorded double-digit pass deflections in each of his last two seasons.',
            'Track star background gives him unmatched straight-line speed at the position.',
            'Ball hawk who converted defensive back; ball skills are off the charts.',
        ],
    },
    S: {
        strengths: [
            ['Range', 'Center field safety who can cover the entire deep half.',],
            ['Run support', 'Thumper in the box; one of the best run-stopping safeties in the class.'],
            ['Coverage IQ', 'Disguises coverages better than most veterans; a chess player on defense.'],
            ['Versatility', 'Can line up anywhere in the secondary; the position coach\'s dream.'],
        ],
        weaknesses: [
            ['Single coverage', 'Can be exploited by elite receivers in one-on-one situations.'],
            ['Angle tackles', 'Occasionally takes bad angles in pursuit; misses open field tackles.'],
            ['Physicality', 'Smaller frame for a box safety; can be pushed around by big backs.'],
        ],
        background: [
            'Three-year team captain whose communication kept the secondary in perfect position.',
            'Former high school quarterback whose football IQ is among the best in the class.',
            'Led his conference in pass deflections from the safety position two seasons running.',
            'Converted linebacker brings unique physicality to the modern safety position.',
        ],
    },
    K: {
        strengths: [
            ['Leg strength', 'Booms kickoffs into the end zone consistently; 60-yard range in a dome.'],
            ['Accuracy', 'Went 38-of-40 on field goals in college; missed two were from 55+ yards.'],
            ['Clutch', 'Converted every game-winner attempt throughout his college career.'],
        ],
        weaknesses: [
            ['Touchbacks', 'Inconsistent on kickoffs in poor weather; may need wind adjustments.'],
            ['Long range', 'Accuracy drops off beyond 55 yards; best from short-to-mid range.'],
        ],
        background: [
            'Soccer background; just converted to football two years ago but the leg is pro-caliber.',
            'Three-year starter who never missed a kick under 45 yards throughout his career.',
            'Known as the most mentally tough kicker in the draft class; pressure doesn\'t faze him.',
        ],
    },
};

// Generate a scouting report for a prospect
export function generateScoutReport(player) {
    const reports = SCOUT_REPORTS[player.position] || SCOUT_REPORTS.OL;
    const strengths = reports.strengths || [];
    const weaknesses = reports.weaknesses || [];
    const backgrounds = reports.background || [];

    // Pick strengths proportional to OVR (higher OVR = better strengths, fewer weaknesses)
    const numStrengths = player.ovr >= 80 ? 3 : player.ovr >= 70 ? 2 : 1;
    const numWeaknesses = player.ovr >= 80 ? 1 : player.ovr >= 70 ? 2 : 3;

    const shuffledStrengths = [...strengths].sort(() => Math.random() - 0.5).slice(0, numStrengths);
    const shuffledWeaknesses = [...weaknesses].sort(() => Math.random() - 0.5).slice(0, numWeaknesses);
    const background = backgrounds[Math.floor(Math.random() * backgrounds.length)] || '';

    return { strengths: shuffledStrengths, weaknesses: shuffledWeaknesses, background };
}

// Generate a draft class (~350 prospects)
export function generateDraftClass(year = 2025) {
    const prospects = [];

    // Position distribution (realistic NFL draft breakdown)
    const positionDistribution = {
        QB: 0.07,
        RB: 0.09,
        WR: 0.14,
        TE: 0.07,
        OL: 0.18,
        DL: 0.16,
        LB: 0.11,
        CB: 0.10,
        S:  0.06,
        K:  0.02,
    };

    // Rookies enter the NFL well below the veterans they line up against: a
    // top-five pick plays like a fringe starter in year one and the rest of the
    // first round is depth. The value of a high pick is the ceiling, not the
    // day-one rating, so each band pairs a modest starting OVR with the
    // potential range that makes it worth spending a pick on.
    const bands = [
        { min: 68, max: 79, count: 32, pot: [6, 20] }, // Round 1 caliber
        { min: 63, max: 73, count: 64, pot: [4, 16] }, // Rounds 2-3 caliber
        { min: 57, max: 68, count: 96, pot: [3, 13] }, // Rounds 4-5 caliber
        { min: 51, max: 62, count: 80, pot: [2, 11] }, // Rounds 6-7 caliber
        { min: 45, max: 56, count: 78, pot: [0,  9] }, // Undrafted caliber
    ];

    const positions = Object.keys(positionDistribution);

    bands.forEach(band => {
        for (let i = 0; i < band.count; i++) {
            const roll = Math.random();
            let cumulative = 0;
            let selectedPos = positions[0];
            for (const [pos, prob] of Object.entries(positionDistribution)) {
                cumulative += prob;
                if (roll < cumulative) { selectedPos = pos; break; }
            }

            // Vary age (21-24)
            const age = 21 + Math.floor(Math.random() * 4);
            const targetOvr = Math.floor(band.min + Math.random() * (band.max - band.min));
            const prospect = generatePlayer(selectedPos, targetOvr, age);
            // Ceiling is what separates a first-rounder from a UDFA, so it is
            // drawn from the band rather than from generatePlayer's flat +0-10.
            const [potMin, potMax] = band.pot;
            prospect.pot = Math.min(99, prospect.ovr + potMin + Math.floor(Math.random() * (potMax - potMin + 1)));
            prospect.devTrait = devTraitForPotential(prospect.pot);
            prospect.draftStatus = 'available';
            prospect.collegeProfile = collegeProfile(prospect, year, prospects.length);
            prospect.college = prospect.collegeProfile.school;
            prospect.experience = 0;
            prospect.contract = null;
            prospect.grade = calculateDraftGrade(prospect);
            prospect.scoutReport = generateScoutReport(prospect);
            // Combine numbers derive from real attributes (small testing-day noise)
            // so a blazing 40 time actually signals a fast player
            const u = prospect.attributes?.universal || {};
            const spd = u.speed || 70, acc = u.acceleration || 70, agi = u.agility || 70, str = u.strength || 70;
            prospect.combineSpeed = Math.max(4.25, ({ QB: 4.85, RB: 4.55, WR: 4.5, TE: 4.75, OL: 5.25, DL: 4.95, LB: 4.7, CB: 4.48, S: 4.55, K: 5.0 }[selectedPos] || 4.8) - (spd - 75) * 0.012 + (Math.random() - 0.5) * 0.08).toFixed(2);
            prospect.combineVert = Math.max(24, Math.round(26 + ((acc + agi) / 2 - 40) * 0.30 + (Math.random() - 0.5) * 3));
            prospect.combineStrength = Math.max(10, Math.round(13 + (str - 40) * 0.38 + (Math.random() - 0.5) * 4));
            prospects.push(prospect);
        }
    });

    prospects.sort((a, b) => b.grade - a.grade);
    prospects.forEach((p, idx) => { p.draftRank = idx + 1; });

    return prospects;
}

// Calculate draft grade (OVR weighted with potential)
function calculateDraftGrade(player) {
    const potFactor = player.pot ? (player.pot - player.ovr) * 0.3 : 0;
    return Math.round(player.ovr * 0.75 + player.pot * 0.25 + potFactor);
}

// Per-style position multipliers layered on top of base POSITION_VALUE
const STYLE_BIAS = {
    BPA:      { QB: 1.0, WR: 1.0, CB: 1.0, DL: 1.0, OL: 1.0, LB: 1.0, S: 1.0, TE: 1.0, RB: 1.0, K: 1.0 },
    NEED:     { QB: 1.0, WR: 1.0, CB: 1.0, DL: 1.0, OL: 1.0, LB: 1.0, S: 1.0, TE: 1.0, RB: 1.0, K: 1.0 }, // need handled by weight
    OFFENSE:  { QB: 1.25, WR: 1.35, TE: 1.25, RB: 1.15, OL: 1.05, DL: 0.80, LB: 0.80, CB: 0.80, S: 0.80, K: 0.6 },
    DEFENSE:  { QB: 0.85, WR: 0.80, TE: 0.80, RB: 0.75, OL: 0.90, DL: 1.45, LB: 1.35, CB: 1.35, S: 1.25, K: 0.5 },
    TRENCHES: { QB: 0.80, WR: 0.80, TE: 0.85, RB: 0.75, OL: 1.60, DL: 1.55, LB: 1.10, CB: 0.85, S: 0.85, K: 0.5 },
    SKILL:    { QB: 0.90, WR: 1.50, TE: 1.10, RB: 0.90, OL: 0.80, DL: 0.80, LB: 0.80, CB: 1.45, S: 1.35, K: 0.5 },
    REBUILD:  { QB: 1.10, WR: 1.10, CB: 1.10, DL: 1.10, OL: 1.10, LB: 1.00, S: 1.00, TE: 1.00, RB: 0.90, K: 0.5 },
    BALANCED: { QB: 1.0, WR: 1.05, CB: 1.05, DL: 1.05, OL: 1.05, LB: 1.0, S: 1.0, TE: 1.0, RB: 0.95, K: 0.5 },
};

// Weight mix by style: [valueWeight, needWeight, scarcityWeight]
const STYLE_WEIGHTS = {
    BPA:      [0.70, 0.15, 0.15],
    NEED:     [0.25, 0.62, 0.13],
    OFFENSE:  [0.50, 0.35, 0.15],
    DEFENSE:  [0.50, 0.35, 0.15],
    TRENCHES: [0.50, 0.35, 0.15],
    SKILL:    [0.50, 0.35, 0.15],
    REBUILD:  [0.35, 0.30, 0.35], // scarcity high — grab upside before others
    BALANCED: [0.45, 0.40, 0.15],
};

// Deterministic part of a CPU pick: every prospect's score for this club.
// CLAUDE: shared with the league mock draft (scouting.js mockDraft).
export function scoreProspects(roster, availableProspects, draftStyle = 'BALANCED') {
    const needScores = calculatePositionNeeds(roster);
    const style = STYLE_BIAS[draftStyle] || STYLE_BIAS.BALANCED;
    const [wVal, wNeed, wScar] = STYLE_WEIGHTS[draftStyle] || STYLE_WEIGHTS.BALANCED;

    // Check if team already has a starting-caliber QB — suppress QB value regardless of style
    const existingQBs = (roster || []).filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr);
    const hasQBStarter = existingQBs.length > 0 && existingQBs[0].ovr >= 72;

    const scarcity = Object.fromEntries(Object.keys(POSITION_VALUE).map(pos => [pos, calculateScarcity(pos, availableProspects)]));
    return availableProspects.map(prospect => {
        let posValue = POSITION_VALUE[prospect.position] || 1.0;
        const styleMult = style[prospect.position] || 1.0;

        // QB suppression — team already has a starter
        if (prospect.position === 'QB' && hasQBStarter) {
            posValue = 0.60;
        }

        // REBUILD style: weight potential over current OVR
        const gradeBase = draftStyle === 'REBUILD'
            ? (prospect.grade * 0.4 + (prospect.pot || prospect.ovr) * 0.6)
            : prospect.grade;

        const valueScore = gradeBase * posValue * styleMult;
        const needScore = needScores[prospect.position] || 0;
        const scarcityScore = scarcity[prospect.position] || 20;

        return { prospect, score: valueScore * wVal + needScore * wNeed + scarcityScore * wScar };
    });
}

// CPU draft decision — respects team's draftStyle
export function cpuMakePick(roster, availableProspects, draftStyle = 'BALANCED') {
    if (!availableProspects.length) return null;
    const scoredProspects = scoreProspects(roster, availableProspects, draftStyle).map(({ prospect, score }) => {
        // Slight variance — every team deviates occasionally
        const variance = score * (Math.random() * 0.08 - 0.02);
        return { prospect, score: score + variance };
    });

    scoredProspects.sort((a, b) => b.score - a.score);

    // ~8% chance to surprise-pick from top 3 (realistic reach)
    if (Math.random() < 0.08 && scoredProspects.length > 3) {
        return scoredProspects[Math.floor(Math.random() * 3)].prospect;
    }

    return scoredProspects[0].prospect;
}

// Calculate position needs based on roster composition
export function calculatePositionNeeds(roster) {
    const needs = {};

    const idealCounts = {
        QB:  { starters: 1, depth: 3, starterOvr: 75 },
        RB:  { starters: 2, depth: 4, starterOvr: 72 },
        WR:  { starters: 3, depth: 6, starterOvr: 73 },
        TE:  { starters: 1, depth: 3, starterOvr: 70 },
        OL:  { starters: 5, depth: 8, starterOvr: 72 },
        DL:  { starters: 4, depth: 6, starterOvr: 72 },
        LB:  { starters: 3, depth: 6, starterOvr: 71 },
        CB:  { starters: 2, depth: 5, starterOvr: 73 },
        S:   { starters: 2, depth: 4, starterOvr: 71 },
        K:   { starters: 1, depth: 1, starterOvr: 68 }
    };

    Object.entries(idealCounts).forEach(([pos, ideal]) => {
        const posPlayers = (roster || []).filter(p => p.position === pos).sort((a, b) => b.ovr - a.ovr);
        const starters = posPlayers.slice(0, ideal.starters);

        let needScore = 50;

        if (posPlayers.length < ideal.depth) {
            needScore += (ideal.depth - posPlayers.length) * 10;
        }

        if (starters.length > 0) {
            const avgOvr = starters.reduce((s, p) => s + p.ovr, 0) / starters.length;
            if (avgOvr < ideal.starterOvr) needScore += (ideal.starterOvr - avgOvr) * 2;
        } else {
            needScore += 40; // No starter = critical need
        }

        const oldStarters = starters.filter(p => p.age > 30).length;
        needScore += oldStarters * 15;

        needs[pos] = Math.min(100, needScore);
    });

    return needs;
}

// Position scarcity in remaining pool
function calculateScarcity(position, availableProspects) {
    const posProspects = availableProspects.filter(p => p.position === position);
    const highGrade = posProspects.filter(p => p.grade >= 72);
    if (highGrade.length === 0) return 100;
    if (highGrade.length === 1) return 80;
    if (highGrade.length <= 3) return 60;
    if (highGrade.length <= 6) return 40;
    return 20;
}

// Get top fits for user's team (combine value + need)
export function getBestFits(roster, availableProspects, count = 5) {
    const needScores = calculatePositionNeeds(roster);
    const scored = availableProspects.map(prospect => {
        const posValue = POSITION_VALUE[prospect.position] || 1.0;
        const fitScore = prospect.grade * posValue * 0.6 + (needScores[prospect.position] || 0) * 0.4;
        return { prospect, fitScore };
    });
    scored.sort((a, b) => b.fitScore - a.fitScore);
    return scored.slice(0, count).map(s => s.prospect);
}
