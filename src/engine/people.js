// Front-office people (Claude-owned): rival GMs, agents and scouts.
//
// GMs and agents are DERIVED from ids, so they cost zero save bytes and are
// identical on every load. Scouts are hired and fired, so the user's scouting
// department is stored (see scouting.js), but each scout's traits are still
// derived from his id.
import { hashSeed, seededRng } from './seededRandom.js';

const FIRST = ['Rich', 'Dana', 'Morgan', 'Terry', 'Lou', 'Casey', 'Vic', 'Jordan', 'Pat', 'Sam', 'Glen', 'Reggie', 'Marty', 'Andre', 'Buddy',
    'Leon', 'Frank', 'Tomás', 'Ike', 'Walt', 'Kendra', 'Rosa', 'Nate', 'Hal', 'Omar', 'Dwight', 'Bev', 'Sal', 'Curtis', 'Jo', 'Wes', 'Ray',
    'Arnie', 'Lyle', 'Priya', 'Deacon', 'Mo', 'Chet', 'Ines', 'Theo', 'Gus', 'Noor', 'Emmett', 'Bo', 'Kai', 'Fitz', 'Harlan', 'Yusuf'];
const LAST = ['Voss', 'Kessler', 'Lund', 'Okoro', 'Pruitt', 'Halloran', 'Mbeki', 'Castellano', 'Brandt', 'Whitfield', 'Ashby', 'Ferreira',
    'Tolliver', 'Ng', 'Rasmussen', 'Dupree', 'Keane', 'Salazar', 'Holt', 'Ivers', 'Marchetti', 'Pembroke', 'Quarles', 'Renfro', 'Stroud',
    'Tanaka', 'Uribe', 'Vance', 'Winslow', 'Yates', 'Zeller', 'Abernathy', 'Bledsoe', 'Crowder', 'Delacroix', 'Eckert', 'Fontaine',
    'Gallagher', 'Hargrove', 'Iwu', 'Jaworski', 'Kowalczyk', 'Lindqvist', 'Mancuso', 'Novak', 'Oyelaran', 'Petrakis', 'Rinaldi'];

export function derivedName(key) {
    const r = seededRng(`name:${key}`);
    return `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`;
}

// ── GMs ───────────────────────────────────────────────────────────────────────
// Archetypes parameterize every CPU front-office decision.
export const GM_ARCHETYPES = {
    aggressive: { id: 'aggressive', label: 'Aggressive trader', icon: '📞', blurb: 'Always working the phones; will overpay to move up.', tradeRate: 1.6, tradeUp: 1.5, spend: 1.05, youth: 1.0, threshold: 0.93 },
    developer:  { id: 'developer', label: 'Draft and develop', icon: '🌱', blurb: 'Hoards picks, trusts his scouts, rarely spends big in FA.', tradeRate: 0.8, tradeUp: 0.7, spend: 0.85, youth: 1.3, threshold: 1.02 },
    analytics:  { id: 'analytics', label: 'Analytics', icon: '📊', blurb: 'Values surplus and cheap contracts; ignores name value.', tradeRate: 1.2, tradeUp: 0.9, spend: 0.95, youth: 1.15, threshold: 1.0 },
    oldSchool:  { id: 'oldSchool', label: 'Old school', icon: '🎩', blurb: 'Trenches and toughness; loves proven veterans.', tradeRate: 0.9, tradeUp: 1.0, spend: 1.0, youth: 0.85, threshold: 0.98 },
    bigSpender: { id: 'bigSpender', label: 'Big spender', icon: '💰', blurb: 'Opens the checkbook on day one of free agency.', tradeRate: 1.0, tradeUp: 1.1, spend: 1.25, youth: 0.9, threshold: 0.97 },
    capHawk:    { id: 'capHawk', label: 'Cap hawk', icon: '🦅', blurb: 'Never overpays; lets stars walk rather than bust the cap.', tradeRate: 0.9, tradeUp: 0.8, spend: 0.8, youth: 1.05, threshold: 1.04 },
};
const GM_IDS = Object.keys(GM_ARCHETYPES);

/** The GM of a CPU team. `era` changes when a GM is replaced (see tradeTalks). */
export function gmFor(teamId, era = 0) {
    const key = `gm:${teamId}:${era}`;
    const r = seededRng(key);
    const archetype = GM_ARCHETYPES[GM_IDS[Math.floor(r() * GM_IDS.length)]];
    return { id: key, teamId, name: derivedName(key), age: 38 + Math.floor(r() * 26), archetype, era };
}

// ── Agents ────────────────────────────────────────────────────────────────────
export const AGENT_STYLES = {
    hardball: { id: 'hardball', label: 'Hardball', blurb: 'Asks high, remembers lowballs.', askMult: 1.08, memory: 1.5 },
    relationship: { id: 'relationship', label: 'Relationship', blurb: 'Values a club that treats his clients well.', askMult: 1.0, memory: 1.0 },
    fastMover: { id: 'fastMover', label: 'Fast mover', blurb: 'Takes the first fair deal on the table.', askMult: 0.97, memory: 0.6 },
};
const AGENCIES = ['Apex Sports', 'Keystone Athlete Group', 'Northstar Management', 'Blue Line Talent', 'Paramount Pro', 'Ironclad Reps', 'Summit & Vale', 'Crosswind Agency'];
/** Eight agents represent the whole league; each player is assigned by id. */
export function agentFor(playerId) {
    const idx = hashSeed(`agent:${playerId}`) % AGENCIES.length;
    const key = `agent:${idx}`;
    const styles = Object.values(AGENT_STYLES);
    return { id: key, name: derivedName(key), agency: AGENCIES[idx], style: styles[idx % styles.length] };
}

// ── Scouts ────────────────────────────────────────────────────────────────────
export const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'West'];
export const SCOUT_BIASES = [
    { id: 'speed', label: 'Loves speed', text: 'Grades fast players up, slow players down.' },
    { id: 'size', label: 'Size snob', text: 'Wants big, strong bodies; marks down undersized players.' },
    { id: 'production', label: 'Box-score guy', text: 'Trusts college production over traits.' },
    { id: 'smallSchool', label: 'Small-school skeptic', text: 'Discounts players from weaker conferences.' },
    { id: 'qbBlind', label: 'QB blind spot', text: 'His quarterback grades are noisy.' },
    { id: 'none', label: 'Level-headed', text: 'No obvious bias.' },
];
export const SCOUT_ROLES = { director: 'Director', area: 'Area scout', national: 'National scout' };

/** A scout's fixed traits, derived from id. `eye` 0-100 = how fast knowledge accrues. */
export function scoutProfile(id, role = 'area', region = null) {
    const r = seededRng(`scout:${id}`);
    const eye = Math.round(45 + r() * 50);
    const bias = SCOUT_BIASES[Math.floor(r() * SCOUT_BIASES.length)];
    const salary = Math.round((0.4 + eye / 200 + (role === 'director' ? 0.6 : 0)) * 10) / 10;
    return { id, name: derivedName(`scout:${id}`), role, region: region ?? REGIONS[Math.floor(r() * REGIONS.length)], eye, bias: bias.id, salary, age: 30 + Math.floor(r() * 32) };
}

export function biasInfo(id) {
    return SCOUT_BIASES.find(b => b.id === id) || SCOUT_BIASES.at(-1);
}
