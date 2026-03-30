// Authentic NFL Statistical Simulation Engine
// "Latent QB DNA" Model

import { calculateTeamRatings } from './ratings.js';
export { calculateTeamRatings };

// --- HELPERS ---

// Sigmoid function for probability scaling
// Maps input (roughly 0-100) to a probability range [min, max]
function sigmoidOp(val, base, scale, min, max) {
    const x = (val - 50) * scale;
    // Simple linear approximation/clamping for performance and control
    let p = base + x;
    return Math.max(min, Math.min(max, p));
}

// Binomial Sampler (approximated via Normal for speed or strict binomial?)
// Binomial(n, p) -> number of successes
function binomial(n, p) {
    if (n <= 0) return 0;
    let successes = 0;
    for (let i = 0; i < n; i++) {
        if (Math.random() < p) successes++;
    }
    return successes;
}

// Gaussian Random (Normal Distribution)
function gaussian(mean, stdev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

// --- SIMULATION LOOP ---

export function simulateGame(homeTeam, awayTeam, homeRoster, awayRoster) {
    // 1. Setup State
    const homeState = initializeTeamState(homeTeam, homeRoster);
    const awayState = initializeTeamState(awayTeam, awayRoster);

    // Ratings
    const hRat = homeState.ratings;
    const aRat = awayState.ratings;

    // Home Field Advantage: +2 to Defense?
    const hDefMod = 2; // Slight boost to home defense

    // 2. SIMULATE OFFENSES (Independent but correlated via Opponent Defense)

    // HOME OFFENSE
    const homeStats = simulateOffense(homeState, awayState, hDefMod);
    // AWAY OFFENSE
    const awayStats = simulateOffense(awayState, homeState, 0);

    // 3. CONVERT STATS TO SCORE
    // We generated TDs and FGs.
    const hScore = homeStats.points;
    const aScore = awayStats.points;

    // 4. FINALIZE
    return {
        homeTeam, awayTeam,
        homeScore: hScore, awayScore: aScore,
        winner: hScore >= aScore ? homeTeam : awayTeam, // Tie handles >= usually Home wins tie? Or Draw? Sim engine usually avoids draw.
        homeStats: homeStats.teamStats,
        awayStats: awayStats.teamStats,
        homePlayerStats: homeStats.playerStats,
        awayPlayerStats: awayStats.playerStats
    };
}

function simulateOffense(offense, defense, homeFieldMod) {
    const qb = offense.roster.find(p => p.position === 'QB') || offense.roster[0];
    const defRat = defense.ratings.defense; // { front7, secondary, overall }
    const offRat = offense.ratings.offense; // { ol, skill, overall }

    // QB TRAITS (Handle legacy/missing traits with defaults)
    const traits = qb.attributes?.position || {};
    const ACC = traits.accuracy || 75;
    const AGG = traits.aggression || 50;
    const PROC = traits.processing || 70;
    const POCK = traits.pocket || 65;
    const ARM = traits.arm || 70;
    const CLUTCH = traits.clutch || 50;

    // Opponent Ratings
    const DEF_OVR = defRat.overall - homeFieldMod;
    const DEF_FRONT = defRat.front7;
    const DEF_SEC = defRat.secondary;

    // A. GAME SCRIPT / VOLUME
    // Base dropbacks ~38. Modified by Pace (OC) and Expectation.
    // Simplifying:    // A. GAME SCRIPT / VOLUME
    let dropbacks = Math.round(gaussian(34, 5));
    // Hard Cap Volume to prevent inflating counts
    // 50 * 17 = 850 max dropbacks. Realistically ~550 attempts.
    dropbacks = Math.max(20, Math.min(50, dropbacks));

    // B. RATE CALCULATION

    // 1. SACK Rate (Per Dropback)
    // Base 0.070. Modifiers: OL, POCK, PROC vs DEF_FRONT
    let p_sack = 0.070;
    p_sack -= 0.0006 * (offRat.ol - 75);
    p_sack -= 0.0006 * (POCK - 50);
    p_sack -= 0.0003 * (PROC - 50);
    p_sack += 0.0006 * (AGG - 50); // Holding ball
    p_sack += 0.0006 * (DEF_FRONT - 75);
    p_sack = Math.max(0.02, Math.min(0.14, p_sack));

    // 2. COMPLETION Rate (Per Attempt)
    // 2. COMPLETION Rate (Per Attempt)
    // Base 0.68. Modifiers: ACC, PROC, WR vs DEF_SEC (Baseline 82)
    // 2. COMPLETION Rate (Per Attempt)
    // Base 0.64. Modifiers: ACC, PROC, WR vs DEF_SEC (Baseline 82)
    // Increased penalty for low accuracy
    let p_cmp = 0.64;
    p_cmp += 0.0035 * (ACC - 82);
    p_cmp += 0.0015 * (PROC - 82);
    p_cmp -= 0.0010 * (AGG - 60);
    p_cmp -= 0.0015 * (DEF_SEC - 75);

    // Mediocrity Trap
    if (ACC < 88) p_cmp -= 0.03; // Flat penalty for non-elite accuracy

    p_cmp = Math.max(0.50, Math.min(0.75, p_cmp));

    // 3. INTERCEPTION Rate (Per Attempt)
    // Base 0.012. Modifiers: PROC, ACC, AGG vs DEF_SEC (Baseline 82)
    let p_int = 0.012;
    p_int -= 0.0006 * (PROC - 82);
    p_int -= 0.0004 * (ACC - 82);
    p_int += 0.0005 * (AGG - 60);
    p_int += 0.0004 * (DEF_SEC - 75);
    p_int = Math.max(0.005, Math.min(0.045, p_int));

    // 4. TD Rate (Per Attempt)
    // Base 0.012! (Extreme Floor). Modifiers: ARM, AGG, PROC vs DEF_OVR
    // Target: Avg 24. Elites 40+.
    let p_td = 0.024;
    p_td += 0.00120 * (ARM - 82); // Shifted curve right
    p_td += 0.00060 * (AGG - 60);
    p_td += 0.00060 * (PROC - 82);
    p_td -= 0.0005 * (DEF_OVR - 75); // Defense matters more

    // Global Dampener to force stats down (League Adjustment)
    // p_td *= 0.78;

    // Hard Cap at 6.3% prevents > 60 TDs (935 * 0.063 = 59 max)
    // Allows elite seasons (40-50 TDs) but blocks unbreakable records.
    p_td = Math.max(0.01, Math.min(0.063, p_td));

    // 5. YARDS PER ATTEMPT (Target)
    // Base 6.6 (Conservative Baseline to crush avg QBs). Modifiers: ARM, AGG (Baseline 82/60)
    let target_ypa = 6.6;
    // Recalibrated Mods
    target_ypa += 0.020 * (ARM - 82); // Stronger Arm impact on YPA
    target_ypa += 0.015 * (AGG - 60); // Aggression drives YPA
    target_ypa -= 0.020 * (DEF_SEC - 75);

    // Non-Linear "Elite" Boost (Tail stretches nicely but controlled)
    // Coeff 0.025. Threshold 92 (True Elite relative to 86 avg).
    // Non-Linear "Elite" Boost (Only for the true freaks)
    // Coeff 0.035. Threshold 93 (Top 3-4 QBs only).
    if (ARM > 93) target_ypa += Math.pow((ARM - 93), 1.8) * 0.035;
    if (PROC > 93) target_ypa += Math.pow((PROC - 93), 1.8) * 0.030;

    // Non-Linear "Mediocrity" Penalty (The Middle Class Massacre)
    // If you aren't Elite (90+), you get dragged down.
    if (ARM < 88) target_ypa -= Math.pow((88 - ARM), 1.5) * 0.015;

    // Bad Penalty
    if (ACC < 70) target_ypa -= Math.pow((70 - ACC), 1.6) * 0.030;
    if (PROC < 70) target_ypa -= Math.pow((70 - PROC), 1.6) * 0.025;

    // Hard Cap on YPA (Prevents > 5400 yard seasons)
    // 600 att * 9.0 = 5400. Mathematically possible to briefly touch 5400, but rare.
    target_ypa = Math.max(3.0, Math.min(9.0, target_ypa));

    // C. GENERATE OUTCOMES
    const sacks = binomial(dropbacks, p_sack);
    const attempts = dropbacks - sacks;
    const completions = binomial(attempts, p_cmp);
    const ints = binomial(attempts, p_int);
    let tds = binomial(attempts, p_td); // Passing TDs

    // Cap TDs/INTs at attempts/completions roughly? Binomial handles standard bounds.
    // Ensure TDs don't exceed completions roughly (rarely an issue at these rates).
    if (tds > completions) tds = completions;

    // Yards Calculation with High Variance
    // Total Yards = Attempts * Target_YPA + Variance (55 yds)
    const yards = Math.round(attempts * target_ypa + gaussian(0, 55));

    // Rushing Outputs (Simplified for now, can expand later)
    // Based on Team Run Rating
    const runAtt = Math.round(gaussian(25, 5));
    const ypc = 4.2 + (offRat.skill - 75) * 0.05 - (DEF_FRONT - 75) * 0.04;
    const rushYards = Math.round(runAtt * ypc);
    const rushTds = binomial(runAtt, 0.035); // 3.5% TD rate

    const totalTds = tds + rushTds;

    // Points Scoring
    // 7 pts per TD
    // Field Goals? Drive stalling logic implied.
    // Est Points = (Total Yards / 15) roughly?
    // Let's use a "Drives that didn't TD" logic for FGs.
    // Approx Drives = Dropbacks / 2.5 + RunAtt / 3? ~11 drives.
    const drives = Math.round((dropbacks + runAtt) / 5.5);
    const nonTdDrives = Math.max(0, drives - totalTds - Math.ceil(ints / 0.8)); // INT usually ends drive
    // FG Chance per non-TD drive ~25%
    const fgs = binomial(nonTdDrives, 0.25);

    const points = (totalTds * 7) + (fgs * 3);

    // D. ASSIGN STATS TO PLAYERS
    const pStats = offense.stats; // Ref to stats object initialized earlier

    // QB Stats
    const s_qb = pStats[qb.id];
    s_qb.attempts += attempts;
    s_qb.completions += completions;
    s_qb.yards += yards;
    s_qb.tds += tds;
    s_qb.ints += ints;
    s_qb.sacks += sacks;
    // NFL Rule: Sack yards reduce Team Passing Yards, NOT QB Rushing Yards.
    // So we do NOT subtract here. (Legacy: s_qb.rushYards -= sacks * 6)

    // QB Rushing / Scrambling Logic
    const speed = qb.attributes?.universal?.speed || 60;
    const isMobile = speed > 80 || qb.archetype === 'Scrambly Pocket Escape' || qb.archetype === 'Dual Threat'; // Dual Threat legacy check

    // Base Scramble Chance per dropback
    let scrambleRate = 0.02;
    if (speed > 70) scrambleRate += (speed - 70) * 0.004; // up to ~10% for 90 speed
    if (isMobile) scrambleRate += 0.05;

    const scrambles = binomial(dropbacks, scrambleRate);

    // Designed Runs (Option plays) for high speed QBs
    let designedRuns = 0;
    if (speed > 85) designedRuns = Math.round(gaussian(2, 1)); // 2-3 designed runs

    const totalQbRuns = scrambles + Math.max(0, designedRuns);

    if (totalQbRuns > 0) {
        // YPC based on speed
        let qbYpc = 4.0 + (speed - 70) * 0.15;
        // Variance
        const qbRushYards = Math.round(totalQbRuns * qbYpc + gaussian(0, 10));

        // TD Chance (Higher for mobile QBs near goal line)
        const qbTdRate = isMobile ? 0.08 : 0.02;
        const qbRushTds = binomial(totalQbRuns, qbTdRate);

        s_qb.carries += totalQbRuns;
        s_qb.rushYards += qbRushYards;
        s_qb.rushTds += qbRushTds;
        s_qb.tds += qbRushTds; // Add to Total TDs

        // Add to Team Rush Totals?
        // Note: RushYards variable above was calculated from RB stats but we need to add QB's contribution to team total line 250
        // Wait, line 250 re-sums stats? No, it uses calculated variables.
        // We need to update `rushYards` variable or just let the teamStats object aggregate it?
        // Let's update the local variables that feed Team Stats
    }

    // Rushing Distribution (RB) - NEW FORMULA MODEL (Tuned Ceiling)
    // 1. Team Context
    const teamRunCarries = Math.round(gaussian(27, 4)); // ~27 carries per game total
    const rbs = offense.roster.filter(p => p.position === 'RB');
    const olRating = offense.ratings.offense.ol;

    // Sort RBs by depth
    let remainingCarries = teamRunCarries;

    rbs.forEach((rb, idx) => {
        if (remainingCarries <= 0) return;

        // Get Traits
        const attr = rb.attributes?.position || {};
        const VOL = attr.vol || 70;
        const EFF = attr.eff || 70;
        const EXP = attr.exp || 70;
        const GL = attr.gl || 70;
        const SEC = attr.sec || 70;

        // Step 1: Carries (Cliffs Edge Logic - Tuned Down)
        // Base Share
        let share = 0.22 + 0.007 * (VOL - 50);

        // Elite Volume Kicker (Only the freaks)
        if (VOL > 92) share += 0.13;

        // RB1 logic
        if (idx === 0) {
            share = Math.max(0.35, Math.min(0.85, share));
        } else {
            share = Math.max(0.05, Math.min(0.25, share));
        }

        let att = Math.round(teamRunCarries * share);

        if (idx > 0) att = Math.min(att, remainingCarries);
        if (idx === rbs.length - 1) att = remainingCarries;

        if (att <= 0) return;
        remainingCarries -= att;

        // Step 2: YPC (Lower Base, Moderate Scaling)
        // Base 3.15
        let ypc = 3.15 + 0.015 * (EFF - 50) + 0.012 * (EXP - 50) + 0.012 * (olRating - 50);

        // Quadratic "Elite Efficiency" Boost (The separation factor)
        // High threshold (90) but high coefficient (0.010) to select only true elites
        if (EFF > 90) ypc += Math.pow((EFF - 90), 1.6) * 0.010;

        // "Bad Efficiency" Penalty
        if (EFF < 75) ypc -= 0.015 * (75 - EFF);

        // Safety Cap to prevent > 2000 yards
        // 350 carries * 5.4 = 1890 yards. Safe.
        ypc = Math.max(2.5, Math.min(5.4, ypc));

        // Step 3: Yards
        const rushYards = Math.round(att * ypc + gaussian(0, 15));

        // Step 4: Explosive Runs
        // Base 1% + up to 2% more
        const p_20 = Math.max(0, 0.010 + 0.00050 * (EXP - 50));
        const runs20 = binomial(att, p_20);

        const longRun = runs20 > 0 ? (20 + (EXP - 50) * 0.9 + Math.random() * 25) : (5 + Math.random() * 10);

        // Step 5: TDs
        // Recalibrated (Baseline 82). Target 3.0% avg.
        let tdRate = 0.030 + 0.0005 * (GL - 82);
        tdRate = Math.max(0.01, Math.min(0.045, tdRate)); // Cap at 4.5% (Elite)
        const tds = binomial(att, tdRate);

        // Step 6: Fumbles
        let fumRate = 0.006 - 0.00004 * (SEC - 50);
        fumRate = Math.max(0.001, fumRate);
        const fumbles = binomial(att, fumRate);

        // Update Values
        const s = pStats[rb.id];
        s.carries += att;
        s.rushYards += rushYards;
        s.rushTds += tds;
        s.tds += tds;
        s.fumbles += fumbles;
        s.yards += rushYards;
    });

    // Update Team Rushing Totals
    const totalRushYards = s_qb.rushYards + Object.values(pStats).filter(s => s.player.position === 'RB').reduce((sum, s) => sum + s.rushYards, 0);

    // Receiving Distribution (Simple Proportional)
    const targets = offense.roster.filter(p => ['WR', 'TE', 'RB'].includes(p.position));
    // Distribute yards/TDs/rec
    let remainingRec = completions;
    let remainingYds = yards;
    let remainingTds = tds;

    targets.forEach((p, idx) => {
        if (remainingRec <= 0) return;
        // Simple weight: WRs get more
        const share = p.position === 'WR' ? 0.26 : (p.position === 'TE' ? 0.18 : 0.08);

        // Random variance on share
        const actualShare = Math.min(1.0, share * (Math.random() + 0.5));

        let r = Math.round(completions * actualShare);
        if (idx === targets.length - 1) r = remainingRec; // Dump rest
        r = Math.min(r, remainingRec);

        // Yds share roughly proportional to Rec share but WRs deeper
        let y = Math.round(yards * actualShare);
        if (idx === targets.length - 1) y = remainingYds;

        let t = 0;
        if (remainingTds > 0 && Math.random() < actualShare * 2) {
            t = 1;
            remainingTds--;
        }

        const s = pStats[p.id];
        s.receptions += r;
        s.yards += y;
        s.recTds += t;
        s.tds += t;
        s.targets += Math.round(r * 1.6); // Catch rate ~60%

        remainingRec -= r;
    });

    // E. ASSIGN DEFENSIVE STATS
    // Sacks, Ints, Tackles
    const defensiveRoster = defense.roster;
    const defStats = defense.stats; // Assign to the opposing team's stats object

    // 1. Distribute Sacks (Team Total)

    // 1. Distribute Sacks (Team Total)
    let remainingSacks = sacks;
    if (remainingSacks > 0) {
        // Filter Front 7 (IDL, EDGE, LB)
        const rushers = defensiveRoster.filter(p => ['IDL', 'EDGE', 'LB'].includes(p.position));
        // Weight by Pass Rush Rating (PR / PM) - assume PR (Pass Rush)
        // Attribute mapping: IDL/EDGE use PR, LB uses BLTZ? Let's genericize.
        // We'll use a generic "RushGrade"
        const rushCandidates = rushers.map(p => {
            // Access deeply nested attributes safely?
            // Helper or direct access. Assuming attributes.position...
            const pr = p.attributes?.position?.passRush || 70;
            return { p, weight: Math.pow(pr, 3) }; // Cube weight for elites
        });

        // Simple weighted lottery
        for (let i = 0; i < remainingSacks; i++) {
            const totalW = rushCandidates.reduce((a, b) => a + b.weight, 0);
            let r = Math.random() * totalW;
            for (const c of rushCandidates) {
                r -= c.weight;
                if (r <= 0) {
                    defStats[c.p.id].sacks += 1;
                    defStats[c.p.id].tackles += 1; // Sack is a tackle
                    break;
                }
            }
        }
    }

    // 2. Distribute INTs (Team Total)
    let remainingInts = ints;
    if (remainingInts > 0) {
        // Filter Secondary + LB
        const coverage = defensiveRoster.filter(p => ['CB', 'S', 'LB'].includes(p.position));
        const covCandidates = coverage.map(p => {
            const cov = p.attributes?.position?.zoneCoverage || 70; // Simplified
            return { p, weight: Math.pow(cov, 3) };
        });
        for (let i = 0; i < remainingInts; i++) {
            const totalW = covCandidates.reduce((a, b) => a + b.weight, 0);
            let r = Math.random() * totalW;
            for (const c of covCandidates) {
                r -= c.weight;
                if (r <= 0) {
                    defStats[c.p.id].ints += 1; // Assuming 'ints' property on player stat
                    // Actually line 405 says `ints`. 
                    break;
                }
            }
        }
    }

    // 3. Distribute Tackles (Generic Volume)
    // Approx 45-55 tackles allowed per game (Plays - Incompletions - TDs?)
    // Simplified: 50 Tackles per game distributed
    const totalTackles = 50;
    const tacklers = defensiveRoster.filter(p => ['IDL', 'EDGE', 'LB', 'CB', 'S'].includes(p.position));
    // Weights: LB (3.0), S (2.0), CB (1.5), EDGE (1.5), IDL (1.0)
    const tWeight = { 'LB': 3.0, 'S': 2.0, 'CB': 1.5, 'EDGE': 1.5, 'IDL': 1.0, 'DL': 1.0, 'DB': 1.5 };

    tacklers.forEach(p => {
        // Base share
        const w = tWeight[p.position] || 1.0;
        // Attribute boost (Tackling)
        const tkl = p.attributes?.position?.tackle || 70;
        const finalW = w * (tkl / 100);

        // Approx share
        // 50 tackles / 11 starters ~ 4.5.
        // We'll just generate poisson based on expected value?
        // Simplest: Assign `w` tackles + variance.
        // LB (3.0 * 0.8) = 2.4 scaling factor?
        // Let's just give them 2 + random(5) weighted by Pos.

        let count = 0;
        if (p.position === 'LB') count = Math.round(gaussian(6, 2));
        else if (p.position === 'S') count = Math.round(gaussian(5, 2));
        else if (p.position === 'CB') count = Math.round(gaussian(3, 1));
        else if (['EDGE', 'IDL'].includes(p.position)) count = Math.round(gaussian(2, 1));

        defStats[p.id].tackles += count;

        // TFLs (approx 10-15% of tackles for Front 7)
        if (['IDL', 'EDGE', 'LB'].includes(p.position)) {
            const tflRate = 0.12 + (p.attributes?.position?.passRush || 70 - 70) * 0.002;
            const tfls = binomial(count, tflRate);
            defStats[p.id].tfl = (defStats[p.id].tfl || 0) + tfls; // Ensure property exists
            // Note: initializeTeamState defines tfl: 0, so += works.
        }
    });

    // F. ASSIGN OL STATS (Sacks Allowed, Pancakes)
    // 1. Sacks Allowed
    const olPlayers = offense.roster.filter(p => ['OL', 'C', 'OG', 'OT', 'G', 'T'].includes(p.position));
    if (sacks > 0 && olPlayers.length > 0) {
        let remainingSacksAllowed = sacks;
        // Inverse weight by Pass Block
        const sackCandidates = olPlayers.map(p => {
            const pb = p.attributes?.position?.passBlock || 70;
            // Lower PB = Higher Weight
            // Weight = (100 - PB)^2
            return { p, weight: Math.pow(Math.max(1, 100 - pb), 2) };
        });

        for (let i = 0; i < remainingSacksAllowed; i++) {
            const totalW = sackCandidates.reduce((a, b) => a + b.weight, 0);
            let r = Math.random() * totalW;
            for (const c of sackCandidates) {
                r -= c.weight;
                if (r <= 0) {
                    pStats[c.p.id].sacksAllowed += 1;
                    break;
                }
            }
        }
    }

    // 2. Pancakes (Impact Blocks)
    // Approx 1 pancake per 10-15 rush yards? Or just random volume.
    // Let's say ~3-5 per game for good OL.
    olPlayers.forEach(p => {
        const rbk = p.attributes?.position?.runBlock || 70;
        // Rate per snap (assume 60 snaps)
        // Rate ~ 5% base + boost
        const panRate = 0.04 + (rbk - 70) * 0.002;
        const pancakes = binomial(60, Math.max(0.01, panRate));
        pStats[p.id].pancakes += pancakes;
    });

    const teamStats = {
        passYards: yards - (sacks * 6), // NET Passing Yards
        rushYards: totalRushYards,
        yards: (yards - (sacks * 6)) + totalRushYards,
        turnovers: ints, // Fumbles not tracked in team total yet?
        sacks: sacks
    };

    return { points, teamStats, playerStats: pStats };
}

function initializeTeamState(team, roster) {
    const stats = {};
    roster.forEach(p => {
        stats[p.id] = { player: p, attempts: 0, completions: 0, yards: 0, tds: 0, ints: 0, rating: 0, carries: 0, rushYards: 0, rushTds: 0, fumbles: 0, targets: 0, receptions: 0, recYards: 0, recTds: 0, sacks: 0, tackles: 0, tfl: 0, pd: 0, pancakes: 0, sacksAllowed: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0, defensiveTds: 0 };
    });

    return {
        id: team.id,
        roster,
        stats,
        ratings: calculateTeamRatings(roster)
    };
}

export function simulateWeek(games) {
    return games.map(game => simulateGame(game.homeTeam, game.awayTeam, game.homeRoster, game.awayRoster));
}
