// College Saturdays (Claude-owned). Schools, conferences, a lightweight
// college season (results, standings, Top 25, conference title games, a
// 12-team playoff), the Heisman race, draft stock, prospect storylines, early
// declarations and transfers.
//
// Schools are DERIVED (names, colours, prestige: zero save bytes). Only game
// results for the current college season are stored: `college` state below.
// Prospect production still comes from collegeProduction.js, keyed per game.
import { hashSeed, seededRng } from './seededRandom.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ── Schools ───────────────────────────────────────────────────────────────────
export const CONFERENCES = [
    { id: 'atl', name: 'Atlantic Ten', short: 'ATL', region: 'Northeast', power: true },
    { id: 'npc', name: 'North Pines', short: 'NPC', region: 'Northeast', power: false },
    { id: 'sec', name: 'Southern Crescent', short: 'SCC', region: 'Southeast', power: true },
    { id: 'gul', name: 'Gulf Coast', short: 'GCC', region: 'Southeast', power: false },
    { id: 'big', name: 'Great Lakes', short: 'GLC', region: 'Midwest', power: true },
    { id: 'pra', name: 'Prairie', short: 'PRA', region: 'Midwest', power: false },
    { id: 'pac', name: 'Pacific Summit', short: 'PSC', region: 'West', power: true },
    { id: 'mtn', name: 'Mountain Frontier', short: 'MFC', region: 'West', power: false },
];
const PLACES = {
    atl: ['Harborview', 'Kingsbridge', 'Colonial', 'Bay State', 'Ashford', 'Granite', 'Hudson Valley', 'Merrimack', 'Chesapeake', 'Allegheny', 'Brandywine', 'Seaboard'],
    npc: ['Pinecrest', 'Lakeshore', 'Adirondack', 'Mohawk', 'Green Mountain', 'Cape Ann', 'Susquehanna', 'Catskill', 'Berkshire', 'Keene', 'Acadia', 'Delmarva'],
    sec: ['Ridgeline', 'Magnolia', 'Tidewater', 'Palmetto', 'Blue Ridge', 'Cumberland', 'Savannah', 'Chattahoochee', 'Piedmont', 'Ozark', 'Bayou', 'Live Oak'],
    gul: ['Coastal', 'Mobile Bay', 'Everglade', 'Gulfport', 'Pensacola', 'Sabine', 'Brazos', 'Galveston', 'Suwannee', 'Tampa Bay', 'Choctaw', 'Pearl River'],
    big: ['Northfield', 'Ironwood', 'Maumee', 'Wabash', 'Cuyahoga', 'Superior', 'Kalamazoo', 'Fox River', 'Des Plaines', 'Sangamon', 'Hoosier', 'Menominee'],
    pra: ['Prairie Rock', 'Cottonwood', 'Platte', 'Flint Hills', 'Red River', 'Big Sioux', 'Cimarron', 'Loess Hills', 'Pawnee', 'Salina', 'Mesabi', 'Dakota'],
    pac: ['Coastal Range', 'Redwood', 'Sierra', 'Cascade', 'Puget', 'Mission Bay', 'Sonoran', 'Willamette', 'Monterey', 'Golden Gate', 'San Gabriel', 'Olympic'],
    mtn: ['Wasatch', 'Front Range', 'Bitterroot', 'Snake River', 'Teton', 'Mesa Verde', 'Sangre', 'Big Horn', 'Tahoe', 'Mojave', 'Yellowstone', 'Gila'],
};
const MASCOTS = ['Wolves', 'Hawks', 'Rams', 'Mustangs', 'Owls', 'Bears', 'Tigers', 'Knights', 'Pioneers', 'Rangers', 'Falcons', 'Bulldogs',
    'Coyotes', 'Cougars', 'Hornets', 'Mariners', 'Lumberjacks', 'Stallions', 'Raptors', 'Gators', 'Badgers', 'Aggies', 'Comets', 'Spartans'];

export const SCHOOLS = CONFERENCES.flatMap((conf, ci) => PLACES[conf.id].map((place, i) => {
    const h = hashSeed(`school:${place}`);
    const tierBase = conf.power ? 62 : 44;
    return {
        id: `${conf.id}-${i}`, idx: ci * 12 + i, name: place, mascot: MASCOTS[h % MASCOTS.length],
        conf: conf.id, region: conf.region,
        prestige: clamp(tierBase + (h % 29) - (i >= 8 ? 8 : 0), 30, 95),
        hue: h % 360,
    };
}));
const BY_NAME = new Map(SCHOOLS.map(s => [s.name, s]));
export const schoolByName = name => BY_NAME.get(name) || null;
export const confOf = id => CONFERENCES.find(c => c.id === id);
export const isPowerSchool = name => !!confOf(schoolByName(name)?.conf)?.power;

/** Deterministic school for a new recruit, weighted toward prestige. */
export function schoolFor(key) {
    const r = seededRng(`recruit:${key}`);
    for (let i = 0; i < 8; i++) {
        const s = SCHOOLS[Math.floor(r() * SCHOOLS.length)];
        if (r() * 100 < s.prestige + 10) return s.name;
    }
    return SCHOOLS[hashSeed(key) % SCHOOLS.length].name;
}

/** Region for any school name, including legacy real-world names in old saves. */
export function regionOfSchool(name) {
    const s = BY_NAME.get(name);
    if (s) return s.region;
    return ['Northeast', 'Southeast', 'Midwest', 'West'][hashSeed(`legacy:${name}`) % 4];
}

/** Old saves used a handful of real schools; move those prospects onto the map. */
export function migrateSchools(pipeline = []) {
    let changed = false;
    const out = pipeline.map(p => {
        if (BY_NAME.has(p.school)) return p;
        changed = true;
        const school = schoolFor(p.id);
        return { ...p, school, seasons: (p.seasons || []).map(s => ({ ...s, school })) };
    });
    return changed ? out : pipeline;
}

// ── Schedule ─────────────────────────────────────────────────────────────────
// Week 1 is non-conference; weeks 2-12 a conference round robin (circle method).
function roundRobin(n, round) {
    const teams = Array.from({ length: n }, (_, i) => i);
    const fixed = teams[0], rest = teams.slice(1);
    const rot = rest.map((_, i) => rest[(i + round) % rest.length]);
    const order = [fixed, ...rot];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([order[i], order[n - 1 - i]]);
    return pairs;
}
export function weekGames(year, week) {
    if (week === 1) {
        const r = seededRng(`nonconf:${year}`);
        const idx = SCHOOLS.map(s => s.idx).sort(() => r() - 0.5);
        const games = [];
        for (let i = 0; i < idx.length; i += 2) games.push([idx[i], idx[i + 1]]);
        return games;
    }
    if (week < 2 || week > 12) return [];
    return CONFERENCES.flatMap((c, ci) => roundRobin(12, week - 2).map(([a, b]) => {
        const home = (a + b + week + year) % 2 ? a : b, away = home === a ? b : a;
        return [ci * 12 + home, ci * 12 + away];
    }));
}

// ── Team strength ────────────────────────────────────────────────────────────
export function schoolStrengths(pipeline, year) {
    const talent = new Map();
    for (const p of pipeline) {
        if (year < p.entryYear || year >= p.draftYear) continue;
        const s = BY_NAME.get(p.school);
        if (!s) continue;
        if (!talent.has(s.idx)) talent.set(s.idx, []);
        talent.get(s.idx).push(p.readyOvr);
    }
    return SCHOOLS.map(s => {
        const top = (talent.get(s.idx) || []).sort((a, b) => b - a).slice(0, 8);
        const t = top.length ? top.reduce((a, b) => a + b, 0) / 8 : 40;
        const form = (hashSeed(`form:${s.idx}:${year}`) % 11) - 5;
        return Math.round(s.prestige * 0.45 + t * 0.55 + form);
    });
}

function playCollegeGame(home, away, strengths, year, week) {
    const r = seededRng(`cg:${year}:${week}:${home}:${away}`);
    const edge = (strengths[home] + 2.5 - strengths[away]) * 0.9;
    const base = 24;
    const hs = Math.max(0, Math.round(base + edge / 2 + (r() - 0.5) * 24));
    let as = Math.max(0, Math.round(base - edge / 2 + (r() - 0.5) * 24));
    if (as === hs) as += r() < 0.5 ? 3 : -3;
    return [home, away, hs, Math.max(0, as)];
}

export function defaultCollege(year) {
    return { year, results: {}, confChamps: {}, playoff: null, champion: null, heisman: null };
}

/** Play the college slate through NFL week `week`. Idempotent per week. */
export function playCollegeThrough(college, pipeline, year, week) {
    let c = college?.year === year ? college : defaultCollege(year);
    const strengths = schoolStrengths(pipeline, year);
    const results = { ...c.results };
    for (let w = 1; w <= Math.min(12, week); w++) {
        if (results[w]) continue;
        results[w] = weekGames(year, w).map(([h, a]) => playCollegeGame(h, a, strengths, year, w));
    }
    c = { ...c, results };
    if (week >= 13 && !Object.keys(c.confChamps).length) {
        const table = standingsFor(c);
        const confChamps = {};
        const games = [];
        for (const [ci, conf] of CONFERENCES.entries()) {
            const rows = table.filter(t => t.conf === conf.id).slice(0, 2);
            const g = playCollegeGame(rows[0].idx, rows[1].idx, strengths, year, 13);
            confChamps[conf.id] = g[2] > g[3] ? g[0] : g[1];
            games.push(g);
            void ci;
        }
        c = { ...c, confChamps, results: { ...c.results, 13: games } };
    }
    if (week >= 14 && !c.playoff) {
        const seeds = pollFor(c, pipeline, year).slice(0, 12).map(r => r.idx);
        c = { ...c, playoff: { seeds, rounds: {} }, heisman: heismanRace(pipeline, c, year)[0]?.id || null };
    }
    if (c.playoff) {
        const rounds = { ...c.playoff.rounds };
        const s = c.playoff.seeds;
        const winner = g => (g[2] > g[3] ? g[0] : g[1]);
        if (week >= 14 && !rounds[14]) rounds[14] = [[s[4], s[11]], [s[5], s[10]], [s[6], s[9]], [s[7], s[8]]].map(([h, a]) => playCollegeGame(h, a, strengths, year, 14));
        if (week >= 15 && !rounds[15]) { const w = rounds[14].map(winner); rounds[15] = [[s[0], w[3]], [s[1], w[2]], [s[2], w[1]], [s[3], w[0]]].map(([h, a]) => playCollegeGame(h, a, strengths, year, 15)); }
        if (week >= 16 && !rounds[16]) { const w = rounds[15].map(winner); rounds[16] = [[w[0], w[3]], [w[1], w[2]]].map(([h, a]) => playCollegeGame(h, a, strengths, year, 16)); }
        if (week >= 17 && !rounds[17]) { const w = rounds[16].map(winner); rounds[17] = [playCollegeGame(w[0], w[1], strengths, year, 17)]; }
        c = { ...c, playoff: { ...c.playoff, rounds }, champion: rounds[17] ? winner(rounds[17][0]) : c.champion };
    }
    return c;
}

/** Records for every school from stored results. */
export function standingsFor(college) {
    const rows = SCHOOLS.map(s => ({ idx: s.idx, name: s.name, conf: s.conf, w: 0, l: 0, cw: 0, cl: 0, pf: 0, pa: 0 }));
    for (const [wk, games] of Object.entries(college?.results || {})) {
        for (const [h, a, hs, as] of games) {
            const H = rows[h], A = rows[a];
            H.pf += hs; H.pa += as; A.pf += as; A.pa += hs;
            const conf = Number(wk) >= 2 && Number(wk) <= 12;
            if (hs > as) { H.w++; A.l++; if (conf) { H.cw++; A.cl++; } } else { A.w++; H.l++; if (conf) { A.cw++; H.cl++; } }
        }
    }
    return rows.sort((a, b) => (b.cw - b.cl) - (a.cw - a.cl) || (b.w - b.l) - (a.w - a.l) || (b.pf - b.pa) - (a.pf - a.pa));
}

/** Top 25: record, margin and schedule strength. */
export function pollFor(college, pipeline, year) {
    const rows = standingsFor(college);
    const strengths = schoolStrengths(pipeline, year);
    const champs = new Set(Object.values(college?.confChamps || {}));
    return rows.map(r => {
        const g = r.w + r.l || 1;
        const score = (r.w / g) * 60 + clamp((r.pf - r.pa) / g, -20, 25) * 0.6 + strengths[r.idx] * 0.35 + (champs.has(r.idx) ? 6 : 0) + (confOf(r.conf)?.power ? 3 : 0);
        return { ...r, score };
    }).sort((a, b) => b.score - a.score).slice(0, 25).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function schoolGames(college, idx) {
    const out = [];
    const add = (week, g, label) => { if (g[0] === idx || g[1] === idx) out.push({ week: Number(week), home: g[0], away: g[1], hs: g[2], as: g[3], label }); };
    for (const [wk, games] of Object.entries(college?.results || {})) for (const g of games) add(wk, g, Number(wk) === 13 ? 'Conference title' : null);
    for (const [wk, games] of Object.entries(college?.playoff?.rounds || {})) for (const g of games) add(wk, g, { 14: 'Playoff first round', 15: 'Quarterfinal', 16: 'Semifinal', 17: 'National title' }[wk]);
    return out.sort((a, b) => a.week - b.week);
}

// ── Heisman, stock ───────────────────────────────────────────────────────────
function productionScore(p, year) {
    const row = (p.seasons || []).find(s => s.year === year);
    if (!row || !row.games) return 0;
    const s = row.stats || {};
    const g = row.games;
    switch (p.position) {
        case 'QB': return ((s.YDS || 0) / 25 + (s.TD || 0) * 4 - (s.INT || 0) * 2) / g;
        case 'RB': return ((s.YDS || 0) / 10 + (s.TD || 0) * 6 + (s.REC_YDS || 0) / 10) / g;
        case 'WR': case 'TE': return ((s.YDS || 0) / 10 + (s.TD || 0) * 6 + (s.REC || 0) * 0.5) / g;
        case 'OL': return (6 - (s.SACKS_ALLOWED || 0) * 2 - (s.PENALTIES || 0)) / Math.max(1, g / 4);
        case 'K': return ((s.FGM || 0) * 3 + (s.XPM || 0)) / g;
        default: return ((s.TKL || 0) + (s.TFL || 0) * 2 + (s.SACKS || 0) * 4 + (s.INT || 0) * 6 + (s.PD || 0)) / g;
    }
}
const EXPECTED = { QB: 13, RB: 9, WR: 7, TE: 5, OL: 4, K: 7, DL: 6, LB: 8, CB: 6, S: 7 };

/** Draft stock −3…+3: production vs what a player of his readiness should do. */
export function stockOf(p, year) {
    const score = productionScore(p, year);
    if (!score) return 0;
    const expected = (EXPECTED[p.position] || 6) * (0.6 + (p.readyOvr - 50) / 60);
    return clamp(Math.round((score - expected) / Math.max(1.5, expected * 0.2)), -3, 3);
}

export function heismanRace(pipeline, college, year, n = 10) {
    const standings = new Map(standingsFor(college).map(r => [r.name, r]));
    return pipeline
        .filter(p => year >= p.entryYear && year < p.draftYear && ['QB', 'RB', 'WR'].includes(p.position))
        .map(p => {
            const rec = standings.get(p.school) || { w: 0, l: 0 };
            const games = rec.w + rec.l || 1;
            return { id: p.id, name: p.name, position: p.position, school: p.school, score: productionScore(p, year) * (p.position === 'QB' ? 1.15 : 1) + (rec.w / games) * 8 };
        })
        .sort((a, b) => b.score - a.score).slice(0, n);
}

// ── Storylines ───────────────────────────────────────────────────────────────
// Each template: beats at (college-year offset, week). Effects change truth
// (readyOvr/ceiling) and a public `hype` read by stock. Not everyone gets one.
export const STORY_TEMPLATES = [
    { id: 'breakout', label: 'Breakout sophomore', beats: [[1, 6, 'Took over as a starter at {school} and hasn\'t looked back.', { ready: 2 }], [1, 12, 'Named second-team all-conference as a sophomore.', { ready: 1 }]] },
    { id: 'injuryComeback', label: 'Injury comeback', beats: [[1, 4, 'Tore a ligament in practice; out for the season at {school}.', { ready: -2 }], [2, 5, 'Back on the field for {school} and moving like himself again.', { ready: 2 }]] },
    { id: 'transfer', label: 'Transfer portal', beats: [[1, 17, 'Entered the transfer portal seeking a bigger role.', { transfer: true }], [2, 3, 'Earned the starting job at his new school, {school}.', { ready: 1 }]] },
    { id: 'qbBattle', label: 'QB battle', pos: ['QB'], beats: [[1, 1, 'Locked in a camp battle for the starting job at {school}.', {}], [1, 4, 'Won the job. The coaching staff says it wasn\'t close.', { ready: 1 }]] },
    { id: 'smallSchool', label: 'Small-school dominator', smallOnly: true, beats: [[2, 8, 'Putting up video-game numbers at {school}. Scouts are starting to make the trip.', { ready: 1 }], [3, 10, 'Dominated a power-conference opponent. Nobody is laughing now.', { ready: 1, ceiling: 1 }]] },
    { id: 'character', label: 'Character concern', beats: [[2, 7, 'Suspended one game at {school} for a violation of team rules.', { hype: -1 }], [3, 3, 'Teammates voted him a captain after a quiet, focused offseason.', { hype: 1 }]] },
    { id: 'positionSwitch', label: 'Position switch', beats: [[1, 2, 'Moved to a new spot on the depth chart at {school}; coaches love the athlete.', { ceiling: 2 }], [2, 9, 'The switch is working. Scouts see a higher ceiling than before.', { ready: 1 }]] },
    { id: 'bloodlines', label: 'Bloodlines', beats: [[0, 1, 'Son of a former pro; grew up in NFL locker rooms. Arrived at {school} ahead of his years.', { ready: 1 }]] },
    { id: 'seniorBowl', label: 'Senior Bowl riser', beats: [[3, 17, 'Stole the show at the Senior Bowl practices. Evaluators are re-checking the tape.', { hype: 2 }]] },
    { id: 'workoutWarrior', label: 'Workout warrior', beats: [[3, 16, 'Testing numbers are off the charts. The tape is less convincing.', { hype: 2, ceiling: 1 }]] },
    { id: 'tapeDarling', label: 'Tape darling', beats: [[3, 12, 'The film is excellent; the stopwatch may not be. Classic "plays faster than he tests."', { ready: 2, hype: -1 }]] },
    { id: 'captain', label: 'Team captain', beats: [[2, 1, 'Named a captain at {school} as a junior.', { hype: 1 }]] },
    { id: 'walkOn', label: 'Walk-on to starter', beats: [[0, 2, 'Walked on at {school} without a scholarship.', { hype: -1 }], [2, 5, 'The walk-on is now a starter and on scholarship.', { ready: 2 }]] },
    { id: 'coachsSon', label: "Coach's son", beats: [[0, 3, 'His father coached high school ball for 30 years. It shows in his preparation.', { ready: 1 }]] },
    { id: 'twoWay', label: 'Two-way player', beats: [[1, 8, 'Now playing both ways for {school}. Teams are split on his best position.', { ceiling: 1, hype: 1 }]] },
    { id: 'collapse', label: 'Late-season slump', beats: [[2, 10, 'A rough November at {school}: a string of costly mistakes.', { ready: -1, hype: -1 }], [3, 6, 'Came back more consistent. The slump looks like a blip.', { ready: 1 }]] },
    { id: 'bowlMvp', label: 'Bowl-game MVP', beats: [[2, 17, 'Named MVP of his bowl game for {school}.', { hype: 1, ready: 1 }]] },
    { id: 'schemeMismatch', label: 'Scheme mismatch', beats: [[2, 4, 'A new coordinator at {school} doesn\'t use him well; production is down.', { hype: -2 }], [3, 5, 'Back in a scheme that suits him, the numbers are back.', { hype: 1 }]] },
    { id: 'redshirt', label: 'Medical redshirt', beats: [[1, 3, 'Granted a medical redshirt after an early injury at {school}.', { ready: -1 }], [2, 2, 'Healthy and bigger after a year in the weight room.', { ready: 2 }]] },
    { id: 'hometown', label: 'Hometown hero', beats: [[0, 1, 'Stayed home to play for {school}; the whole town shows up on Saturdays.', {}]] },
    { id: 'bigStageFlop', label: 'Big-stage flop', beats: [[2, 13, 'Struggled badly in the conference title game. Questions about big moments.', { hype: -2 }]] },
    { id: 'lateBloomer', label: 'Late bloomer', beats: [[2, 6, 'Two years of reserve work, and suddenly he\'s one of the best players on the field.', { ready: 2 }], [3, 8, 'Still getting better every week. His ceiling is the question.', { ceiling: 2 }]] },
    { id: 'filmRoom', label: 'Film-room student', beats: [[1, 10, 'Coaches say he knows the playbook better than some of the staff.', { ready: 1 }]] },
    { id: 'generationalHype', label: 'Generational hype', minCeiling: 94, beats: [[0, 1, 'The most hyped recruit {school} has signed in years. The word "generational" is being used.', { hype: 1 }], [2, 8, 'Living up to it. NFL scouts talk about X-Factor potential.', { ceiling: 1 }]] },
];

/** Which story a prospect is living (≈45% have one), derived from id. */
export function storyFor(p) {
    const h = hashSeed(`story:${p.id}`);
    if (h % 100 >= 45) return null;
    const eligible = STORY_TEMPLATES.filter(t => (!t.pos || t.pos.includes(p.position)) && (!t.smallOnly || !isPowerSchool(p.school)) && (!t.minCeiling || (p.ceiling || 0) >= t.minCeiling));
    const pool = eligible.filter(t => t.id !== 'generationalHype');
    if ((p.ceiling || 0) >= 94 && eligible.some(t => t.id === 'generationalHype')) return STORY_TEMPLATES.find(t => t.id === 'generationalHype');
    return pool[(h >>> 8) % pool.length] || null;
}

/** Fires due story beats through (year, week). Exactly once: dedupe by year/week/text. */
export function advanceStories(pipeline, year, week) {
    let changed = false;
    const out = pipeline.map(p => {
        const t = storyFor(p);
        if (!t) return p;
        let next = p;
        for (const [i, [offset, beatWeek, , fx]] of t.beats.entries()) {
            const beatYear = p.entryYear + offset;
            if (beatYear !== year || beatWeek > week || year >= p.draftYear) continue;
            // Stored as a tiny marker (the save interns it); eventText() renders it.
            const text = `${STORY_MARK}${t.id}:${i}`;
            if ((next.events || []).some(e => e.text === text)) continue;
            let school = next.school;
            if (fx.transfer) {
                const options = SCHOOLS.filter(s => s.name !== next.school && s.prestige > (schoolByName(next.school)?.prestige || 50) - 5);
                school = options[hashSeed(`xfer:${p.id}`) % Math.max(1, options.length)]?.name || next.school;
            }
            next = {
                ...next, school,
                readyOvr: clamp(next.readyOvr + (fx.ready || 0), 40, Math.min(85, next.ceiling + (fx.ceiling || 0))),
                ceiling: clamp(next.ceiling + (fx.ceiling || 0), 45, 99),
                events: [...(next.events || []), { year, week: beatWeek, text }],
            };
            changed = true;
        }
        return next;
    });
    return changed ? out : pipeline;
}

/** Public hype from story beats so far (reads stored events; zero extra bytes). */
export function hypeOf(p) {
    const t = storyFor(p);
    if (!t) return 0;
    let h = 0;
    t.beats.forEach(([, , , fx], i) => { if (fx.hype && (p.events || []).some(e => e.text === `${STORY_MARK}${t.id}:${i}`)) h += fx.hype; });
    return h;
}

export const STORY_MARK = '§';
/** Display text for a college event (story beats are stored as markers). */
export function eventText(p, e) {
    if (!e?.text?.startsWith(STORY_MARK)) return e?.text || '';
    const [id, i] = e.text.slice(1).split(':');
    const t = STORY_TEMPLATES.find(x => x.id === id);
    return t?.beats[Number(i)]?.[2]?.replaceAll('{school}', p.school) || '';
}
/** Story label for a prospect, if he's living one. */
export const storyLabel = p => storyFor(p)?.label || null;

// ── Offseason: declarations and transfers ───────────────────────────────────
/**
 * After the college season: the best juniors declare early (≈25-40 a year),
 * and a few underclassmen transfer. `year` is the season just completed.
 */
export function offseasonMoves(pipeline, year) {
    const juniors = pipeline.filter(p => p.draftYear === year + 2 && year - p.entryYear >= 2);
    const ranked = juniors.map(p => ({ p, score: p.readyOvr + (p.ceiling - 75) * 0.4 + stockOf(p, year) * 1.5 + hypeOf(p) + (hashSeed(`declare:${p.id}`) % 7) - 3 }))
        .sort((a, b) => b.score - a.score);
    const count = 25 + (hashSeed(`declarations:${year}`) % 16);
    const declaring = new Set(ranked.slice(0, count).filter(x => x.p.readyOvr >= 66).map(x => x.p.id));
    const stories = [];
    const out = pipeline.map(p => {
        if (declaring.has(p.id)) {
            const text = `Declared early for the ${year + 1} draft, skipping his senior season at ${p.school}.`;
            stories.push({ id: p.id, text: `${p.name} (${p.position}, ${p.school}) declares early.` });
            return { ...p, draftYear: year + 1, events: [...p.events, { year, week: 18, text }] };
        }
        const under = p.draftYear > year + 2 && year >= p.entryYear;
        if (under && hashSeed(`transfer:${p.id}:${year}`) % 100 < 4) {
            const options = SCHOOLS.filter(s => s.name !== p.school);
            const school = options[hashSeed(`xferTo:${p.id}:${year}`) % options.length].name;
            stories.push({ id: p.id, text: `${p.name} transfers from ${p.school} to ${school}.` });
            return { ...p, school, events: [...p.events, { year, week: 18, text: `Transferred from ${p.school} to ${school}.` }] };
        }
        return p;
    });
    return { pipeline: out, stories, declared: declaring.size };
}

/** Class-strength forecast for a draft year: count of likely day-one talents by position. */
export function classForecast(pipeline, draftYear) {
    const cls = pipeline.filter(p => p.draftYear === draftYear);
    const top = cls.filter(p => p.readyOvr + (p.ceiling - 75) * 0.4 >= 74);
    const byPos = {};
    for (const p of top) byPos[p.position] = (byPos[p.position] || 0) + 1;
    const n = top.length;
    return { draftYear, size: cls.length, blueChips: n, label: n >= 40 ? 'Deep class' : n >= 28 ? 'Average class' : 'Thin class', byPos };
}

export const schoolColor = (name, l = 42) => `hsl(${schoolByName(name)?.hue ?? hashSeed(name) % 360} 55% ${l}%)`;
