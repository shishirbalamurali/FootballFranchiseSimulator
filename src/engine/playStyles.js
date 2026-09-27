// Play styles: the signature way a player plays, one level more specific than
// his generated archetype ("WR / Deep Threat" → "Burner", "DL / Speed Rusher"
// → "Edge Bender").
//
// A style is DERIVED from the player's attribute shape (what he is best at
// relative to his own level), nudged by his archetype, so it costs zero save
// bytes, is stable across loads and shows up on every existing save at once.
// It follows the player as his attributes change: a receiver who adds strength
// can turn into a contested-catch guy.
//
// Styles matter on the field (gameEngine.js reads `mods`) and in the booth
// (gameStory.js reads `calls`), so the same player shows up the same way in the
// box score, the broadcast and the player card.

import { hashSeed } from './seededRandom.js';

// mods — read by the engine, all small and mostly redistributive:
//   QB:   cmp (completion rate), int (INT rate), ypa, sigma (explosive spread),
//         sack (sack rate), scram (scramble rate), designed (designed-run rate)
//   RB:   share (carry share), burst (breakaway rate), gl (goal-line), fumble (×), tgt (target weight ×)
//   pass catchers: tgt (target weight ×), catch (catch rate ×), ypc (yards per catch ×), rz (red-zone weight ×)
//   defense: rush / hawk / cover / tackle / stuff (selection weights ×), strip (forced-fumble ×), six (return-TD ×)
//   K / P: range (FG yards), clutch (Witching Hour FG bonus), punt (gross ×), pin (inside-20 ×)
export const PLAY_STYLES = {
    // ── Quarterbacks
    fieldGeneral: { pos: 'QB', label: 'Field General', icon: '🧠', blurb: 'Reads it out pre-snap and never takes the bad sack.',
        mods: { cmp: 0.010, int: -0.003, sack: -0.004, ypa: -0.1 }, calls: ['checks to the right play', 'the Field General had that one diagnosed before the snap', 'surgical — he saw it all the way'] },
    gunslinger:   { pos: 'QB', label: 'Gunslinger', icon: '🔫', blurb: 'Every throw is a dare. Big plays — and the occasional big mistake.',
        mods: { ypa: 0.35, int: 0.004, sigma: 0.06, cmp: -0.012, sack: 0.006 }, calls: ['fires it into a window that wasn\'t there', 'pure gunslinger', 'he will NOT stop taking shots'] },
    dualThreat:   { pos: 'QB', label: 'Dual Threat', icon: '⚡', blurb: 'As dangerous with his legs as his arm. Designed runs are part of the plan.',
        mods: { designed: 0.05, scram: 0.02, sack: 0.003, ypa: -0.1 }, calls: ['defenses have to account for his legs', 'the dual threat strikes again', 'you cannot spy him with one guy'] },
    improviser:   { pos: 'QB', label: 'Improviser', icon: '🎩', blurb: 'Plays break down, he doesn\'t. Escapes the rush and makes something out of nothing.',
        mods: { sack: -0.010, scram: 0.025, int: 0.002 }, calls: ['escapes the rush like it was nothing', 'backyard football — and it works', 'the play broke down, he didn\'t'] },
    cannon:       { pos: 'QB', label: 'Cannon Arm', icon: '💥', blurb: 'Can throw it through a wall from the far hash. The deep ball is always open.',
        mods: { ypa: 0.25, sigma: 0.08, cmp: -0.008, sack: 0.004, int: 0.002 }, calls: ['that ball traveled sixty yards in the air', 'what an arm', 'a throw only a handful of people alive can make'] },
    surgeon:      { pos: 'QB', label: 'Surgeon', icon: '🎯', blurb: 'Pinpoint ball placement. Completion percentage is a lifestyle.',
        mods: { cmp: 0.016, int: -0.002 }, calls: ['puts it where only his guy can get it', 'textbook ball placement', 'a dime'] },
    gameManager:  { pos: 'QB', label: 'Game Manager', icon: '📋', blurb: 'Takes what the defense gives. Rarely loses you a game.',
        mods: { int: -0.005, ypa: -0.2, sigma: -0.05 }, calls: ['takes the checkdown — smart football', 'no mistakes, just moving the chains', 'he just doesn\'t turn it over'] },

    // ── Running backs
    bellCow:      { pos: 'RB', label: 'Bell Cow', icon: '🐂', blurb: 'The offense runs through him. Twenty-five carries and still going.',
        mods: { share: 0.07, fumble: 0.85, burst: -0.004 }, calls: ['the workhorse keeps churning', 'feed him — and they are', 'he gets stronger as the game goes on'] },
    homeRun:      { pos: 'RB', label: 'Home-Run Hitter', icon: '🚀', blurb: 'Any carry can go the distance. Boom or bust, mostly boom.',
        mods: { burst: 0.008 }, calls: ['one cut and he is GONE', 'home-run speed', 'nobody\'s catching him from behind'] },
    hammer:       { pos: 'RB', label: 'Goal-Line Hammer', icon: '🔨', blurb: 'Short yardage and the goal line belong to him.',
        mods: { gl: 0.3, fumble: 0.8, burst: -0.006 }, calls: ['moves the pile', 'you do not arm-tackle him at the goal line', 'lowers the shoulder and finishes'] },
    scatback:     { pos: 'RB', label: 'Scatback', icon: '🐇', blurb: 'Jitterbug in space. Makes the first man miss every time.',
        mods: { burst: 0.004, tgt: 1.25 }, calls: ['makes the first man miss', 'how did he get out of that?', 'ankles everywhere'] },
    thirdDown:    { pos: 'RB', label: 'Third-Down Back', icon: '🧤', blurb: 'Soft hands, sharp blitz pickup. The safety valve on money downs.',
        mods: { tgt: 1.35, share: -0.04, burst: -0.004 }, calls: ['the safety valve comes through again', 'money-down back', 'reliable hands out of the backfield'] },

    // ── Wide receivers
    burner:       { pos: 'WR', label: 'Burner', icon: '🔥', blurb: 'Takes the top off the defense. Safeties play scared.',
        mods: { ypc: 1.13, catch: 0.94 }, calls: ['nobody on that defense can run with him', 'the Burner just ran right past the coverage', 'track speed'] },
    contested:    { pos: 'WR', label: 'Contested Catch', icon: '🦒', blurb: '50/50 balls are 80/20 for him. Automatic in the red zone.',
        mods: { rz: 1.45 }, calls: ['high-points it over the defender', 'he was covered — didn\'t matter', 'that\'s his ball, always'] },
    yacMonster:   { pos: 'WR', label: 'YAC Monster', icon: '🦈', blurb: 'Catch it short, turn it long. Dangerous after every catch.',
        mods: { ypc: 1.07, tgt: 1.05 }, calls: ['breaks a tackle and keeps going', 'all of those yards after the catch', 'you have to wrap him up'] },
    technician:   { pos: 'WR', label: 'Route Technician', icon: '📐', blurb: 'Separation artist. Always open, always on time.',
        mods: { catch: 1.03, tgt: 1.08 }, calls: ['open by three yards — that route was art', 'the route technician gets his separation', 'crisp, crisp route'] },
    possession:   { pos: 'WR', label: 'Possession', icon: '🧲', blurb: 'Sure hands, moves the chains, never drops one.',
        mods: { catch: 1.05, ypc: 0.93 }, calls: ['moves the sticks again', 'those hands are glue', 'the chain-mover'] },
    slotWeapon:   { pos: 'WR', label: 'Slot Weapon', icon: '🎰', blurb: 'Lives in the middle of the field. Unguardable on third down.',
        mods: { tgt: 1.12, catch: 1.02, ypc: 0.96 }, calls: ['finds the soft spot in the zone', 'the slot is his office', 'mismatch in the middle'] },

    // ── Tight ends
    seamStretcher:{ pos: 'TE', label: 'Seam Stretcher', icon: '📏', blurb: 'A receiver in a tight end\'s body. Splits safeties down the seam.',
        mods: { ypc: 1.12, tgt: 1.1, catch: 0.98 }, calls: ['splits the safeties up the seam', 'linebackers cannot run with him', 'a big man who moves like a wideout'] },
    redZoneTE:    { pos: 'TE', label: 'Red-Zone Mismatch', icon: '🏀', blurb: 'Box out, go up, touchdown.',
        mods: { rz: 1.45 }, calls: ['boxes him out like a power forward', 'too big, too strong in there', 'red-zone nightmare'] },
    yBlocker:     { pos: 'TE', label: 'Y Blocker', icon: '🧱', blurb: 'A sixth offensive lineman who occasionally leaks out.',
        mods: { tgt: 0.8, catch: 1.02 }, calls: ['nobody covered the blocker', 'sneaks out and nobody noticed'] },

    // ── Offensive line
    brickWall:    { pos: 'OL', label: 'Brick Wall', icon: '🧱', blurb: 'Pass protection anchor. Edge rushers go home frustrated.', mods: {}, calls: [] },
    mauler:       { pos: 'OL', label: 'Mauler', icon: '🦍', blurb: 'Drives defenders five yards off the ball.', mods: {}, calls: [] },
    oLineTech:    { pos: 'OL', label: 'Technician', icon: '🛠️', blurb: 'Perfect hands, perfect feet. Never beaten twice by the same move.', mods: {}, calls: [] },

    // ── Defensive line
    edgeBender:   { pos: 'DL', label: 'Edge Bender', icon: '🌪️', blurb: 'Dips under the tackle at full speed. Strip-sacks are his signature.',
        mods: { rush: 1.3, strip: 1.6 }, calls: ['bends the edge and gets home', 'the tackle never had a chance', 'speed kills'] },
    bullRusher:   { pos: 'DL', label: 'Bull Rusher', icon: '🐃', blurb: 'Walks blockers straight back into the quarterback.',
        mods: { rush: 1.18, stuff: 1.15 }, calls: ['walks the guard right into the quarterback\'s lap', 'pure power', 'bull rush, and he\'s home'] },
    noseAnchor:   { pos: 'DL', label: 'Nose Anchor', icon: '⚓', blurb: 'Eats double teams. Nothing runs up the middle.',
        mods: { stuff: 1.5, rush: 0.8, tackle: 1.1 }, calls: ['nothing gets through the middle', 'the anchor holds', 'blew up the double team'] },
    wrecker:      { pos: 'DL', label: 'Interior Wrecker', icon: '💣', blurb: 'Pressure from the inside, where quarterbacks can\'t step up.',
        mods: { rush: 1.18, stuff: 1.2 }, calls: ['collapses the pocket from the inside', 'right up the gut', 'nowhere to step up'] },

    // ── Linebackers
    thumper:      { pos: 'LB', label: 'Thumper', icon: '🥊', blurb: 'Downhill run stuffer. Every tackle is a collision.',
        mods: { tackle: 1.25, stuff: 1.3 }, calls: ['meets him in the hole — thump', 'you could hear that one upstairs', 'downhill and violent'] },
    sidelineHunter:{ pos: 'LB', label: 'Sideline Hunter', icon: '🐆', blurb: 'Sideline-to-sideline range. Nothing gets to the edge.',
        mods: { tackle: 1.2 }, calls: ['runs it down from the backside', 'what range', 'sideline to sideline'] },
    blitzer:      { pos: 'LB', label: 'Blitz Specialist', icon: '🎯', blurb: 'Times the snap count and arrives unblocked.',
        mods: { rush: 1.6, strip: 1.2 }, calls: ['timed the snap perfectly', 'came free on the blitz', 'nobody picked him up'] },
    coverageLB:   { pos: 'LB', label: 'Coverage Backer', icon: '🛡️', blurb: 'Carries tight ends and running backs up the field.',
        mods: { cover: 1.4, hawk: 1.3 }, calls: ['carries the tight end stride for stride', 'a linebacker who covers like a safety'] },

    // ── Cornerbacks
    shutdown:     { pos: 'CB', label: 'Shutdown Corner', icon: '🔒', blurb: 'Takes away one side of the field. Quarterbacks stop looking there.',
        mods: { cover: 1.35, hawk: 1.1 }, calls: ['blanket coverage', 'that side of the field is closed', 'locked him up'] },
    ballhawk:     { pos: 'CB', label: 'Ballhawk', icon: '🦅', blurb: 'Jumps routes. Gambles, and usually wins.',
        mods: { hawk: 1.45, six: 1.5 }, calls: ['jumped the route — he read the quarterback\'s eyes', 'the ballhawk strikes', 'he was baiting that throw'] },
    pressBully:   { pos: 'CB', label: 'Press Bully', icon: '💪', blurb: 'Reroutes receivers at the line and wins every contested ball.',
        mods: { cover: 1.2, tackle: 1.1 }, calls: ['jammed him at the line and never let go', 'physical, physical corner'] },
    zoneRobber:   { pos: 'CB', label: 'Zone Robber', icon: '🕵️', blurb: 'Reads the quarterback, breaks on the ball.',
        mods: { hawk: 1.25, cover: 1.1 }, calls: ['sat on that route all day', 'read the quarterback\'s eyes'] },

    // ── Safeties
    centerfielder:{ pos: 'S', label: 'Centerfielder', icon: '🧢', blurb: 'Deep-middle eraser. Nothing goes over the top.',
        mods: { hawk: 1.3, cover: 1.2 }, calls: ['the centerfielder covers a lot of grass', 'erased from deep middle'] },
    boxEnforcer:  { pos: 'S', label: 'Box Enforcer', icon: '🔨', blurb: 'An extra linebacker. Receivers hear him coming.',
        mods: { tackle: 1.3, stuff: 1.2, strip: 1.3 }, calls: ['comes downhill and lays the wood', 'you do not go over the middle on him', 'an enforcer'] },
    ballhawkS:    { pos: 'S', label: 'Ballhawk', icon: '🦅', blurb: 'Instincts for the football. Turnovers follow him.',
        mods: { hawk: 1.45, six: 1.4 }, calls: ['always around the football', 'the ballhawk strikes again'] },

    // ── Specialists
    bigLeg:       { pos: 'K', label: 'Big Leg', icon: '🦵', blurb: 'In range from the logo.', mods: { range: 2 }, calls: ['that had another ten yards on it', 'from the logo'] },
    iceVeins:     { pos: 'K', label: 'Ice Veins', icon: '🧊', blurb: 'The bigger the kick, the calmer he gets.', mods: { clutch: 0.06 }, calls: ['ice water', 'never a doubt'] },
    boomer:       { pos: 'P', label: 'Boomer', icon: '💨', blurb: 'Flips the field with hang time to spare.', mods: { punt: 1.06 }, calls: [] },
    coffinCorner: { pos: 'P', label: 'Coffin Corner', icon: '📌', blurb: 'Pins offenses inside the ten.', mods: { pin: 1.3 }, calls: [] },
};

// How much each attribute stands out from the player's own level.
const rel = (v, mean) => (Number.isFinite(v) ? v - mean : 0);
const meanOf = vals => {
    const ok = vals.filter(Number.isFinite);
    return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : 70;
};

// Position-relative athletic centres (player.js PHYSICAL_PROFILES), so a slow
// receiver still reads as slow for a receiver.
const SPEED_CENTRE = { QB: 65, RB: 87, WR: 89, TE: 77, OL: 57, DL: 70, LB: 80, CB: 90, S: 85, K: 60, P: 61 };
const STRENGTH_CENTRE = { QB: 64, RB: 74, WR: 59, TE: 79, OL: 88, DL: 87, LB: 80, CB: 58, S: 69 };

// Each position scores its candidate styles; the best score wins. The
// archetype adds a bonus to the style it naturally grows into.
const RULES = {
    QB: (a, u, arch, ovr) => {
        const m = meanOf([a.accuracy, a.aggression, a.processing, a.pocket, a.arm]);
        const spd = rel(u.speed, SPEED_CENTRE.QB + (ovr - 75) * 0.2);
        return {
            fieldGeneral: rel(a.processing, m) * 1.1 + rel(a.accuracy, m) * 0.5 - rel(a.aggression, m) * 0.3 + (arch === 'Point Guard' ? 4 : 0),
            gunslinger:   rel(a.aggression, m) + rel(a.arm, m) * 0.5 + (arch === 'Gunslinger' ? 5 : 0),
            dualThreat:   spd * 0.9 + (arch === 'Scrambly Pocket Escape' || arch === 'Alien MVP' ? 3 : 0) - 3,
            improviser:   rel(a.pocket, m) * 1.1 + spd * 0.3 + (arch === 'Scrambly Pocket Escape' ? 3 : 0),
            cannon:       rel(a.arm, m) * 1.2 + 1.5,
            surgeon:      rel(a.accuracy, m) * 1.2 + 1.5 + (arch === 'Alien MVP' ? 2 : 0),
            gameManager:  -rel(a.aggression, m) * 0.9 - rel(a.arm, m) * 0.4 + (arch === 'Game Manager' ? 6 : 0) - 1,
        };
    },
    RB: (a, u, arch) => {
        const m = meanOf([a.vol, a.eff, a.exp, a.gl, a.sec]);
        const spd = rel(u.speed, SPEED_CENTRE.RB), str = rel(u.strength, STRENGTH_CENTRE.RB);
        return {
            bellCow:   rel(a.vol, m) * 1.1 + rel(a.sec, m) * 0.4 + 2 + (arch === 'Balanced' ? 3 : 0),
            homeRun:   rel(a.exp, m) + spd * 0.5 + (arch === 'Speed Back' ? 4 : 0),
            hammer:    rel(a.gl, m) + str * 0.4 + (arch === 'Power Back' ? 4 : 0),
            scatback:  rel(a.eff, m) * 0.7 + rel(u.agility, 86) * 0.6 + (arch === 'Elusive' ? 4 : 0),
            thirdDown: rel(a.catching, m) * 0.8 + (arch === 'Receiving Back' ? 6 : 0),
        };
    },
    WR: (a, u, arch, ovr) => {
        const m = meanOf([a.catching, a.routeRun, a.release, a.catchInTraffic, a.deepThreat]);
        const spd = rel(u.speed, SPEED_CENTRE.WR), str = rel(u.strength, STRENGTH_CENTRE.WR);
        return {
            burner:      rel(a.deepThreat, m) + spd * 0.5 + (arch === 'Deep Threat' ? 4 : 0),
            contested:   rel(a.catchInTraffic, m) + str * 0.4 + (arch === 'Red Zone' ? 4 : 0),
            yacMonster:  rel(u.agility, 86 + (ovr - 75) * 0.2) * 0.6 + str * 0.25 + rel(a.release, m) * 0.3 + 3,
            technician:  rel(a.routeRun, m) * 1.1 + (arch === 'Route Runner' ? 4 : 0),
            possession:  rel(a.catching, m) * 1.1 - spd * 0.2 + (arch === 'Possession' ? 5 : 0) + 1,
            slotWeapon:  rel(a.release, m) * 0.6 + rel(u.agility, 86 + (ovr - 75) * 0.2) * 0.3 + (arch === 'Slot' ? 6 : 0),
        };
    },
    TE: (a, u, arch) => {
        const m = meanOf([a.catching, a.routeRun, a.runBlock, a.passBlock]);
        const spd = rel(u.speed, SPEED_CENTRE.TE);
        return {
            seamStretcher: rel(a.routeRun, m) * 0.7 + spd * 0.6 + (arch === 'Receiving' ? 3 : 0),
            redZoneTE:     rel(a.catching, m) + rel(u.strength, STRENGTH_CENTRE.TE) * 0.3 + (arch === 'Balanced' ? 2 : 0),
            yBlocker:      (rel(a.runBlock, m) + rel(a.passBlock, m)) * 0.6 + (arch === 'Blocking' ? 5 : 0),
        };
    },
    OL: (a, u, arch) => {
        const m = meanOf([a.passBlock, a.runBlock, a.impactBlock, a.awarenessOL]);
        return {
            brickWall: rel(a.passBlock, m) + (arch === 'Pass Protector' ? 4 : 0),
            mauler:    rel(a.runBlock, m) * 0.6 + rel(a.impactBlock, m) * 0.6 + (arch === 'Run Blocker' ? 4 : 0),
            oLineTech: rel(a.awarenessOL, m) + (arch === 'Balanced' ? 2 : 0),
        };
    },
    DL: (a, u, arch) => {
        const m = meanOf([a.blockShedding, a.powerMoves, a.finesseMoves, a.tackle]);
        const spd = rel(u.speed, SPEED_CENTRE.DL), str = rel(u.strength, STRENGTH_CENTRE.DL);
        return {
            edgeBender: rel(a.finesseMoves, m) + spd * 0.4 + (arch === 'Speed Rusher' ? 4 : 0),
            bullRusher: rel(a.powerMoves, m) + str * 0.3 + (arch === 'Power Rusher' ? 4 : 0),
            noseAnchor: rel(a.blockShedding, m) * 0.6 + rel(a.tackle, m) * 0.5 + str * 0.2 + (arch === 'Run Stopper' ? 4 : 0),
            wrecker:    (rel(a.powerMoves, m) + rel(a.blockShedding, m)) * 0.5 + str * 0.2 + 2 + (arch === 'Balanced' ? 3 : 0),
        };
    },
    LB: (a, u, arch) => {
        const m = meanOf([a.tackle, a.pursuit, a.coverage, a.blitz]);
        const spd = rel(u.speed, SPEED_CENTRE.LB);
        return {
            thumper:        rel(a.tackle, m) + rel(u.strength, STRENGTH_CENTRE.LB) * 0.3 + (arch === 'Run Stopper' ? 4 : 0),
            sidelineHunter: rel(a.pursuit, m) + spd * 0.4 + (arch === 'Balanced' ? 2 : 0),
            blitzer:        rel(a.blitz, m) + (arch === 'Pass Rusher' ? 4 : 0),
            coverageLB:     rel(a.coverage, m) + spd * 0.2 + (arch === 'Coverage' ? 4 : 0),
        };
    },
    CB: (a, u, arch) => {
        const m = meanOf([a.manCoverage, a.zoneCoverage, a.press, a.ballSkills]);
        return {
            shutdown:   rel(a.manCoverage, m) + rel(u.speed, SPEED_CENTRE.CB) * 0.3 + (arch === 'Man Coverage' ? 4 : 0),
            ballhawk:   rel(a.ballSkills, m) * 1.1 + (arch === 'Balanced' ? 1 : 0),
            pressBully: rel(a.press, m) + rel(u.strength, STRENGTH_CENTRE.CB) * 0.3 + (arch === 'Press' ? 4 : 0),
            zoneRobber: rel(a.zoneCoverage, m) + (arch === 'Zone Coverage' ? 4 : 0),
        };
    },
    S: (a, u, arch) => {
        const m = meanOf([a.coverage, a.tackle, a.ballSkills, a.range]);
        return {
            centerfielder: rel(a.range, m) * 0.7 + rel(a.coverage, m) * 0.5 + (arch === 'Free Safety' ? 4 : 0),
            boxEnforcer:   rel(a.tackle, m) + rel(u.strength, STRENGTH_CENTRE.S) * 0.3 + (arch === 'Strong Safety' || arch === 'Enforcer' ? 4 : 0),
            ballhawkS:     rel(a.ballSkills, m) * 1.1 + (arch === 'Ball Hawk' ? 5 : 0),
        };
    },
    K: (a, u, arch) => ({
        bigLeg:   rel(a.kickPower, a.kickAccuracy) + (arch === 'Power Leg' ? 3 : 0),
        iceVeins: rel(a.kickAccuracy, a.kickPower) + (arch === 'Accurate' ? 3 : 0),
    }),
    P: (a, u, arch) => ({
        boomer:       rel(a.kickPower, a.kickAccuracy) + (arch === 'Power Leg' ? 3 : 0),
        coffinCorner: rel(a.kickAccuracy, a.kickPower) + (arch === 'Precision' ? 3 : 0),
    }),
};

const cache = new Map();

/** The player's play-style id, or null for positions without styles. */
export function playStyleIdFor(player) {
    if (!player?.position) return null;
    const rule = RULES[player.position];
    if (!rule) return null;
    const a = player.attributes?.position || {};
    const u = player.attributes?.universal || {};
    const key = `${player.id}|${player.position}|${player.ovr}|${player.archetype ?? ''}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const scores = rule(a, u, player.archetype, player.ovr || 70);
    // A per-player tiebreak so flat attribute profiles still spread across styles.
    const seed = hashSeed(`${player.id}|style`);
    let best = null, bestScore = -Infinity, i = 0;
    for (const [id, s] of Object.entries(scores)) {
        const jitter = ((seed >>> (i++ * 3)) & 7) / 7 * 1.5;
        const v = (Number.isFinite(s) ? s : 0) + jitter;
        if (v > bestScore) { bestScore = v; best = id; }
    }
    if (cache.size > 8000) cache.clear();
    cache.set(key, best);
    return best;
}

/** The full style record ({ id, label, icon, blurb, mods, calls }) or null. */
export function playStyleFor(player) {
    const id = playStyleIdFor(player);
    return id ? { id, ...PLAY_STYLES[id] } : null;
}

/** Engine modifiers for a style id (empty object when none). */
export const styleMods = id => (id && PLAY_STYLES[id]?.mods) || {};

/** Every style defined for a position, for legends and tests. */
export const stylesForPosition = pos => Object.entries(PLAY_STYLES).filter(([, s]) => s.pos === pos).map(([id, s]) => ({ id, ...s }));

// ── Composure under pressure ─────────────────────────────────────────────────
// How a player handles the Witching Hour, in [-1, 1]. Built from what the save
// already knows: the QB clutch attribute, the legacy personality label and the
// kicker's style. character.js composure layers on top where it is loaded
// (gameEngine passes it in), so this stays dependency-free.
const PERSONALITY_CLUTCH = { Clutch: 0.45, IceInVeins: 0.5, Leader: 0.15, Reliable: 0.1, Hothead: -0.4, BoomBust: -0.25 };

export function clutchBase(player, composure = null) {
    if (!player) return 0;
    let c = PERSONALITY_CLUTCH[player.personality] || 0;
    const qbClutch = player.attributes?.position?.clutch;
    if (Number.isFinite(qbClutch)) c += (qbClutch - (player.ovr || 70)) / 30;
    if (Number.isFinite(composure)) c += (composure - 50) / 80;
    if (playStyleIdFor(player) === 'iceVeins') c += 0.3;
    return Math.max(-1, Math.min(1, c));
}
