import { weeklyStrategy, weeklyDefaults, choosePositionBattle, resolvePositionBattle, battleGameRoster, weeklyGameReview, settlePositionBattle } from '../engine/weeklyExperience';
import { rivalryGames } from '../engine/rivalries';
import { manageCPURosters, rookieReserve } from '../engine/cpuRosterManagement';
import { TRADE_DEADLINE_WEEK, tradesOpen, validContractOffer } from '../engine/leagueRules';
import { packCollege, unpackCollege } from '../engine/franchiseSave';
import { createStaff, staffBonuses, coachingCarousel } from '../engine/franchiseStaff';
import { createCollegePipeline, updateCollege, nextCollegeYear, collegeDraftClass } from '../engine/collegePipeline';
import { ASSISTANT_DEFAULTS, assistantPlan } from '../engine/frontOfficeAssistant';
import { findLeagueTrade } from '../engine/leagueTrades';
import { draftTeamOrder, exchangePicks, pickKey, pickValue } from '../engine/draftExperience';
import { create } from 'zustand';
import { TEAMS } from '../data/teams';
import { refreshSavedTeamBranding } from '../engine/teamBranding';
import { PLAYBOOK_MAP, TEAM_PLAYBOOK_MAP } from '../data/playbooks';
import { calculateSeasonAwards } from '../engine/awards';
import { generateRoster, injectLeagueSuperstars, ROSTER_LIMIT } from '../engine/player';
import { calculateTeamRatings } from '../engine/ratings';
import { simulateGame } from '../engine/simulation';
import { gamePlans, gameDetailFields } from '../engine/gamePlan'; // CLAUDE
import { cpuMakePick } from '../engine/draft';
import { generateSeasonSchedule } from '../engine/schedule';
import { generateWeeklyHeadlines } from '../engine/news';
import { runSeasonProgression, generateFreeAgentPool, generateWaiverPool, generateWeeklyInjuries, generateWeeklyEvent, getCoachLevel, hasCoachPerk, COACH_LEVELS, askingSalary } from '../engine/progression';
import { seedConference } from '../engine/playoffs';
import { createOwnerState, generateSeasonGoals, teamRank, buildOwnerContext, reviewSeason, jobOffers, REHIRE_TRUST } from '../engine/owner'; // CLAUDE
import { newlyUnlocked } from '../engine/legacy'; // CLAUDE
import { openMarket, resolveMarketDay, offerBudget, validateOffer, askOf, preferredYears, FA_DAYS } from '../engine/faMarket'; // CLAUDE
import { contractStance, teamContext, tradeFallout } from '../engine/character'; // CLAUDE

// Fast lookups + cloning for simulation hot paths
const TEAM_MAP = new Map(TEAMS.map(t => [t.id, t]));
const deepClone = (obj) =>
    typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

const CAP_TOTAL = 200;

// ── Game-day rules shared by the regular season and the playoffs ────────────

const BONUS_KEYS = ['passingBoost', 'rushingBoost', 'defenseBoost', 'moraleBoost'];
const addBonuses = (...parts) => {
    const out = {};
    for (const part of parts) {
        if (!part) continue;
        for (const k of BONUS_KEYS) if (part[k]) out[k] = (out[k] || 0) + part[k];
    }
    return Object.keys(out).length ? out : null;
};

// Story-event choices promise temporary effects; this is where they reach the sim.
function boostBonuses(activeBoosts = []) {
    const b = { passingBoost: 0, rushingBoost: 0, defenseBoost: 0, moraleBoost: 0 };
    for (const boost of activeBoosts) {
        const v = Number(boost.value) || 0;
        if (boost.type === 'team_ovr') b.moraleBoost += v;
        else if (boost.type === 'win_prob') b.moraleBoost += v / 2; // +6% ≈ +3 team rating
        else if (boost.type === 'group_ovr') {
            if (boost.group === 'Offense') { b.passingBoost += v; b.rushingBoost += v; }
            else if (boost.group === 'O-Line') b.rushingBoost += v;
            else b.defenseBoost += v; // Defense, Secondary
        }
    }
    return b;
}

// Everything the user's coaching adds to a game: playbook, coach style,
// weekly strategy, difficulty, locker-room morale and active story boosts.
function userGameBonuses(state) {
    const playbookBonuses = PLAYBOOK_MAP[state.userPlaybookId || 'pro-style']?.bonuses || {};
    const coachData = state.coach || {};
    const coachBonuses = coachData.bonus || {};
    const diffBonus = coachData.difficultyBonus ?? 0;
    const strategyBonuses = weeklyStrategy(state.weekStrategy).bonuses;
    const morale = state.morale ?? 50;
    const moraleEffect = morale >= 80 ? 4 : morale >= 65 ? 2 : morale >= 50 ? 0 : morale >= 35 ? -2 : -4;
    return addBonuses(
        {
            passingBoost: (playbookBonuses.passingBoost || 0) + (coachBonuses.passingBoost || 0) + strategyBonuses.passingBoost,
            rushingBoost: (playbookBonuses.rushingBoost || 0) + (coachBonuses.rushingBoost || 0) + strategyBonuses.rushingBoost,
            defenseBoost: (playbookBonuses.defenseBoost || 0) + (coachBonuses.defenseBoost || 0) + strategyBonuses.defenseBoost,
            moraleBoost: diffBonus + strategyBonuses.moraleBoost + moraleEffect,
        },
        boostBonuses(state.activeBoosts),
    );
}

// The players who actually suit up: injured and rested players sit, and
// story-event penalties apply. Returns the original array when nothing
// changes so the sim's per-roster cache keeps hitting.
function gameDayRoster(roster, teamId, state) {
    if (!roster) return [];
    roster = battleGameRoster(roster, teamId, state);
    const out = new Set((state.injuries || []).filter(i => i.teamId === teamId && i.weeksRemaining > 0).map(i => i.playerId));
    const penalties = new Map();
    if (teamId === state.userTeamId) {
        for (const b of state.activeBoosts || []) {
            if (b.type === 'rest') out.add(b.playerId);
            else if (b.type === 'player_penalty') penalties.set(b.playerId, (penalties.get(b.playerId) || 0) + (Number(b.value) || 0));
        }
    }
    if (!out.size && !penalties.size) return roster;
    const available = roster.filter(p => !out.has(p.id));
    // Never field an empty unit because of injuries: if every QB is hurt,
    // the healthiest-available fallback is the injured starter.
    if (!available.some(p => p.position === 'QB')) {
        const qb = roster.filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
        if (qb) available.push(qb);
    }
    return penalties.size
        ? available.map(p => penalties.has(p.id) ? { ...p, ovr: Math.max(1, p.ovr + penalties.get(p.id)) } : p)
        : available;
}

// Postseason game between two team ids — same bonuses and availability rules
// as the regular season, and overtime always produces a winner.
function playPlayoffGame(state, homeId, awayId) {
    const home = TEAM_MAP.get(homeId), away = TEAM_MAP.get(awayId);
    if (!home || !away) return null;
    const userBonuses = userGameBonuses(state);
    const result = simulateGame(
        home, away,
        gameDayRoster(state.rosters[homeId], homeId, state),
        gameDayRoster(state.rosters[awayId], awayId, state),
        addBonuses(staffBonuses(state.coachingStaff, homeId), homeId === state.userTeamId ? userBonuses : null),
        addBonuses(staffBonuses(state.coachingStaff, awayId), awayId === state.userTeamId ? userBonuses : null),
        { allowTie: false, ...gamePlans(state, homeId, awayId) }, // CLAUDE: coaching plans
    );
    return {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winnerId: result.homeScore > result.awayScore ? homeId : awayId,
        overtime: result.overtime,
        ...gameDetailFields(result, homeId === state.userTeamId || awayId === state.userTeamId), // CLAUDE
    };
}

// ── Save slot management ─────────────────────────────────────────────────────
// Up to 3 independent save slots. Active slot key stored in 'gridiron_active_slot'.
const SAVE_SLOT_COUNT = 3;
const SAVE_KEY_PREFIX = 'gridiron_save_slot_';
const ACTIVE_SLOT_KEY = 'gridiron_active_slot';

export function getActiveSlot() {
    try {
        const slot = Number(localStorage.getItem(ACTIVE_SLOT_KEY) || 0);
        return Number.isInteger(slot) && slot >= 0 && slot < SAVE_SLOT_COUNT ? slot : 0;
    } catch { return 0; }
}
export function setActiveSlot(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) return false;
    // Finish the old franchise's pending save before the picker changes state.
    if (_persistTimer) { clearTimeout(_persistTimer); flushPersist(); }
    _requestedSlot = slot;
    try { localStorage.setItem(ACTIVE_SLOT_KEY, String(slot)); } catch { /* noop */ }
    return true;
}
function slotKey(slot) { return `${SAVE_KEY_PREFIX}${slot}`; }

export function getAllSlotMeta() {
    const slots = [];
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
        try {
            const raw = localStorage.getItem(slotKey(i));
            if (!raw) { slots.push({ slot: i, empty: true }); continue; }
            const data = JSON.parse(raw);
            slots.push({
                slot: i,
                empty: false,
                teamId: data.userTeamId,
                season: data.season,
                year: data.year,
                week: data.week,
                phase: data.phase,
                coachName: data.coach?.name || null,
                coachIcon: data.coach?.styleIcon || null,
                record: data.standings?.[data.userTeamId]
                    ? `${data.standings[data.userTeamId].wins}-${data.standings[data.userTeamId].losses}`
                    : '0-0',
            });
        } catch { slots.push({ slot: i, empty: true }); }
    }
    return slots;
}

export function deleteSlot(slot) {
    try { localStorage.removeItem(slotKey(slot)); } catch { /* noop */ }
}

// Debounced persistence — all save paths funnel through one timer so a burst
// of actions (e.g. "Sim to Week 18") serializes state once, not once per action.
let _persistTimer = null;

// A long franchise outgrows localStorage: box scores, the draft archive and
// the season's schedule all accumulate. A save that simply throws leaves the
// player losing progress with nothing but a console message, so when the quota
// is hit we shed the most expendable history and try again rather than give up.
// Each tier keeps the save playable; only replay detail is lost.
const SAVE_FALLBACKS = [
    // 1. Box scores for all but the last four weeks — season totals live on the
    //    players, so this only costs per-game stat lookups for older weeks.
    (data) => {
        const schedule = data.schedule || [];
        // The playoff/offseason week counter resets to one. Use the schedule
        // itself so quota recovery still sheds old box scores after Week 18.
        const latestPlayed = schedule.findLastIndex(week => week?.some(game => game.played));
        return {
            ...data,
            schedule: schedule.map((week, i) => i >= latestPlayed - 3
                ? week
                : (week || []).map(({ playerStats: _ps, stats: _ts, ...game }) => game)),
        };
    },
    // 2. All but the two most recent drafts.
    (data) => ({ ...data, draftArchive: (data.draftArchive || []).slice(-2) }),
    // 3. Everything optional: news, storylines and the rest of the archive.
    (data) => ({ ...data, draftArchive: [], weeklyNews: [], tradeHistory: [], storylineQueue: [] }),
];

// Save status for the UI. A failed save used to be a console message only, so
// players found out when a reload rolled them back weeks.
const saveListeners = new Set();
let lastSaveStatus = 'ok';
export function onSaveStatus(listener) {
    saveListeners.add(listener);
    return () => saveListeners.delete(listener);
}
function reportSave(status) {
    if (status === lastSaveStatus) return;
    lastSaveStatus = status;
    saveListeners.forEach(fn => { try { fn(status); } catch { /* listener errors never block saving */ } });
}

function flushPersist() {
    _persistTimer = null;
    const slot = _saveSlot;
    let data = {};
    try {
        const state = useGameStore.getState();
        if (!state.initialized) return;
        for (const [k, v] of Object.entries(state)) {
            if (typeof v !== 'function') data[k] = v;
        }
    } catch (e) {
        console.error('Save failed while reading state', e);
        return;
    }

    data.collegePipeline = packCollege(data.collegePipeline);
    data.collegeAlumni = packCollege(data.collegeAlumni);
    for (let tier = 0; tier <= SAVE_FALLBACKS.length; tier++) {
        try {
            localStorage.setItem(slotKey(slot), JSON.stringify(data));
            if (tier > 0) console.warn(`Save trimmed to fit storage (tier ${tier}).`);
            reportSave(tier > 0 ? 'trimmed' : 'ok');
            return;
        } catch (e) {
            const outOfRoom = e && (e.name === 'QuotaExceededError' || e.code === 22);
            if (!outOfRoom || tier === SAVE_FALLBACKS.length) {
                console.error('Save failed', e);
                reportSave('failed');
                return;
            }
            data = SAVE_FALLBACKS[tier](data);
        }
    }
}
function schedulePersist() {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(flushPersist, 250);
}

// Helper kept for call-site compat — args ignored, always saves latest store state
const persist = () => schedulePersist();

const load = (key) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    } catch (e) {
        return null;
    }
};

// Initial State Defaults
const defaultState = {
    coachingStaff: [],
    collegePipeline: [],
    collegeAlumni: [],
    collegeWatchlist: [],
    franchiseStories: [],
    assistantSettings: { ...ASSISTANT_DEFAULTS },
    assistantLog: [],
    initialized: false,
    userTeamId: null,
    year: 2024,
    season: 1,
    week: 1,
    phase: 'regular', // preseason, regular, playoffs, offseason, freeAgency, draft

    // Roster mode: 'generated' = procedural, 'csv' = imported from Madden CSV
    rosterMode: 'generated',

    // Data
    teams: TEAMS,
    rosters: {}, // teamId -> [players]
    schedule: [], // [week][games]
    standings: {}, // teamId -> { wins, losses, ties, pf, pa, divWins, ... }
    teamRatings: {}, // teamId -> { off, def, st }

    // Draft State
    draftClass: [],
    draftOrder: [], // [{ teamId, pickNum }]
    currentPickIndex: 0,
    onClockTeamId: null,
    tradeHistory: [],
    draftArchive: [],
    draftHistory: [],
    draftTimer: 120, // 2 minutes in seconds
    draftTimerActive: false,

    // Activity Log
    activityLog: [],
    weeklyNews: [],
    lastDismissedGameId: null, // Track viewed summaries

    // Playoffs State
    playoffBracket: null,
    seasonRecap: null,

    // Playbook
    userPlaybookId: 'pro-style',

    // Draft Picks (teamId -> [{ round, originalTeamId }])
    draftPickOwners: {},

    // Multi-season & Progression
    injuries: [], // [{ id, playerId, playerName, teamId, position, ovr, type, weeksRemaining, severity }]
    freeAgents: [], // [{ id, name, position, ovr, age, contract: { salary, years }, ... }]
    storylineQueue: [], // [{ type, icon, playerName, teamId, position, ovr, severity, title, headline, subtext }]
    seasonHistory: [], // [{ year, champion, awards }]
    trainingDoneThisOffseason: false,

    // Coach profile
    coach: null, // { name, style, styleName, styleIcon, bonus, difficulty, difficultyBonus, seasonGoal }

    // Player of the Week
    playerOfWeek: null, // { player, teamId, statLine, week, label }

    // Season goal tracking
    seasonGoalMet: false,

    // Waiver Wire
    waiverWire: [], // [{ id, name, position, ovr, age, contract, ... }]

    // FA watchlist (player ids starred by user during free agency)
    faWatchlist: [],

    // Coach progression
    coachXp: 0,

    // Weekly story event
    pendingStoryEvent: null, // { type, icon, title, body, choices, ctx, week }

    // Active temporary boosts from event choices
    activeBoosts: [], // [{ type, value, weeks, weeksLeft, group, playerId }]

    // Development training — one focus per week during regular season
    devTrainingDone: false, // resets each week

    // Free Agency flags
    cpuSigningsDone: false,

    // Pre-draft scouting
    scoutingPoints: 10,        // replenish every season start
    scoutedProspects: {},      // { prospectId: true } — reveals true OVR
    draftWatchlist: [],        // [prospectId] — starred prospects

    // CPU Trade Offers (incoming)
    pendingTradeOffer: null,   // { fromTeamId, give: [{type:'player'|'pick', ...}], receive: [{...}], expiresWeek }

    // Pre-game strategy selection
    weekStrategy: 'balanced',  // 'aggressive' | 'balanced' | 'conservative'

    // Franchise records
    franchiseRecords: {},

    // Team morale (0-100): wins boost, losses drop, affects simulation
    morale: 50,

    // Last simulated week's scores (for scoreboard display)
    lastWeekScores: [],

    // Breakout moments: player id -> season they broke out
    breakoutPlayers: {},

    // ===== CODEX STATE =====
    ...weeklyDefaults(),
    // ===== END CODEX =====

    // ===== CLAUDE STATE =====
    owner: null, // see engine/owner.js createOwnerState
    achievements: {}, // { [id]: { year, week, teamId } } — see engine/legacy.js
    legacyMeta: null, // { tenure: [{ teamId, from }] }
    faMarket: null, // { year, teamId, day, offers, floors, log, closed } — see engine/faMarket.js
    // ===== END CLAUDE =====
};

// Claude-owned fields reset when a new franchise starts in the same slot.
const CLAUDE_FRESH_FRANCHISE = { owner: null, achievements: {}, legacyMeta: null, faMarket: null };

const SAVE_VERSION = 6;

// Hydrate state — load from active slot, fall back to legacy key
const _activeSlot = getActiveSlot();
let _saveSlot = _activeSlot;
let _requestedSlot = null;
const savedState = load(slotKey(_activeSlot)) || load('gridiron_save_v3');
// Older saves recorded a season's champion as a full team object under
// `champion`; history readers look for the team id under `winner`.
function migrateSave(saved) {
    if (!saved) return saved;
    const seasonHistory = (saved.seasonHistory || []).map(h => {
        const r = h?.seasonRecap;
        if (!r || r.winner || !r.champion) return h;
        return { ...h, seasonRecap: { ...r, winner: r.champion.id } };
    });
    return refreshSavedTeamBranding({ ...saved, seasonHistory, collegePipeline: unpackCollege(saved.collegePipeline), collegeAlumni: unpackCollege(saved.collegeAlumni) });
}

// Merge saved state on top of defaults so new fields always have values
const initialState = savedState ? { ...defaultState, ...migrateSave(savedState) } : defaultState;

export const useGameStore = create((set, get) => ({
    ...initialState,

    ensureFranchiseSystems: () => {
        const s = get();
        if (!s.initialized) return;
        const patch = {};
        if (!s.coachingStaff?.length) patch.coachingStaff = createStaff(TEAMS, s.year, s.userTeamId, s.coach);
        if (!s.collegePipeline?.length) patch.collegePipeline = createCollegePipeline(s.year);
        if (Object.keys(patch).length) set(patch);
    },
    setAssistantSettings: patch => {
        const old = get().assistantSettings || ASSISTANT_DEFAULTS;
        const next = { ...old, ...patch };
        next.reserve = Math.max(0, Math.min(50, Number(next.reserve) || 0));
        next.maxSalary = Math.max(1, Math.min(50, Number(next.maxSalary) || 1));
        next.maxYears = Math.max(2, Math.min(3, Math.floor(Number(next.maxYears) || 3)));
        next.contracts = !!next.contracts; next.cap = !!next.cap;
        set({ assistantSettings: next });
    },
    runAssistants: () => {
        const s = get();
        if (!s.initialized || s.phase === 'draft') return;
        const plan = assistantPlan(s.rosters[s.userTeamId], s.assistantSettings);
        const reports = [];
        for (const action of plan.actions) {
            if (action.type === 'extend') {
                const result = get().resignPlayer(s.userTeamId, action.playerId, action.salary, action.years);
                reports.push(`${action.name}: ${result.accepted ? `renewed for $${action.salary}M × ${action.years} years` : result.reason}`);
            } else {
                get().cutPlayer(action.playerId);
                reports.push(`${action.name}: released to save $${action.salary}M.`);
            }
        }
        if (reports.length || plan.notices.length) set({ assistantLog: [{ year: s.year, week: s.week, phase: s.phase, reports, notices: plan.notices }, ...(get().assistantLog || [])].slice(0, 30) });
    },
    hireStaff: (coachId, role) => {
        const s = get();
        if (!['OC', 'DC', 'Assistant'].includes(role)) return { ok: false, reason: 'Your head coach is managed through your coaching career.' };
        if (s.coachingStaff.some(c => c.teamId === s.userTeamId && c.role === role)) return { ok: false, reason: 'Fire the current coach before filling this role.' };
        const candidate = s.coachingStaff.find(c => c.id === coachId && !c.teamId);
        if (!candidate) return { ok: false, reason: 'This coach is no longer available.' };
        const mentorId = s.coachingStaff.find(c => c.teamId === s.userTeamId && c.role === 'HC')?.id;
        const text = `${candidate.name} joins your staff as ${role}${candidate.role === 'HC' ? ' after a head-coaching stint' : ''}.`;
        set({ coachingStaff: s.coachingStaff.map(c => c.id === coachId ? { ...c, teamId: s.userTeamId, role, mentorId: c.mentorId || (c.history.some(h => h.role === 'HC') ? null : mentorId), history: [...c.history, { year: s.year, teamId: s.userTeamId, role, event: 'Hired' }] } : c), franchiseStories: [{ year: s.year, text, kind: 'Coaching' }, ...s.franchiseStories].slice(0, 300) });
        return { ok: true };
    },
    fireStaff: coachId => {
        const s = get(), coach = s.coachingStaff.find(c => c.id === coachId);
        if (!coach || coach.teamId !== s.userTeamId || coach.role === 'HC') return;
        set({ coachingStaff: s.coachingStaff.map(c => c.id === coachId ? { ...c, teamId: null, history: [...c.history, { year: s.year, teamId: s.userTeamId, role: c.role, event: 'Fired' }] } : c), franchiseStories: [{ year: s.year, kind: 'Coaching', text: `You fired ${coach.name} (${coach.role}). The position is vacant until you hire a replacement.` }, ...s.franchiseStories].slice(0, 300) });
    },
    upgradeStaff: (coachId, branch) => {
        if (!['offense', 'defense', 'leadership'].includes(branch)) return;
        const s = get(), coach = s.coachingStaff.find(c => c.id === coachId);
        if (!coach || coach.teamId !== s.userTeamId || coach.points < 1 || (coach.skills[branch] || 0) >= 3) return;
        set({ coachingStaff: s.coachingStaff.map(c => c.id === coachId ? { ...c, points: c.points - 1, skills: { ...c.skills, [branch]: (c.skills[branch] || 0) + 1 } } : c) });
    },
    toggleCollegeWatch: id => {
        const list = get().collegeWatchlist || [];
        set({ collegeWatchlist: list.includes(id) ? list.filter(p => p !== id) : [...list, id] });
    },

    // Actions
    dismissGameSummary: (gameId) => {
        set({ lastDismissedGameId: gameId });
        persist('gridiron_save_v3', { ...get(), lastDismissedGameId: gameId });
    },

    generateLeague: () => {
        // Skip if CSV rosters have already been loaded
        if (get().rosterMode === 'csv' && Object.keys(get().rosters).length > 0) return;

        const rosters = {};
        const ratings = {};
        const standings = {};

        // 1. Assign Team Tiers (Variance)
        const shuffled = [...TEAMS].sort(() => 0.5 - Math.random());

        // Distribution: 3 Elite, 6 Good, 14 Avg, 6 Bad, 3 Tanking
        const tiers = [
            { count: 3, mod: 4 },   // Dynasties
            { count: 6, mod: 1 },   // Contenders
            { count: 14, mod: 0 },  // Average
            { count: 6, mod: -5 },  // Struggling
            { count: 3, mod: -10 }  // Rebuild
        ];

        let teamIdx = 0;
        const tierMap = {};

        tiers.forEach(tier => {
            for (let i = 0; i < tier.count; i++) {
                if (shuffled[teamIdx]) {
                    tierMap[shuffled[teamIdx].id] = tier.mod;
                    teamIdx++;
                }
            }
        });



        // 2. Generate Rosters
        TEAMS.forEach(team => {
            const mod = tierMap[team.id] || 0;
            rosters[team.id] = generateRoster(mod);
            standings[team.id] = {
                id: team.id,
                wins: 0, losses: 0, ties: 0,
                pf: 0, pa: 0,
                confWins: 0, divWins: 0,
                streak: 0
            };
        });

        // 3. Inject League-Wide Superstars
        injectLeagueSuperstars(rosters);

        // 4. Calc Ratings (After superstars injected!)
        TEAMS.forEach(team => {
            ratings[team.id] = calculateTeamRatings(rosters[team.id]);
        });

        const schedule = generateSeasonSchedule(TEAMS, 2024);

        // Each team starts owning all 7 of their own draft picks
        const draftPickOwners = {};
        TEAMS.forEach(team => {
            draftPickOwners[team.id] = [1, 2, 3, 4, 5, 6, 7].map(r => ({ round: r, originalTeamId: team.id }));
        });

        set({
            rosters,
            teamRatings: ratings,
            standings,
            schedule,
            draftPickOwners,
            initialized: false
        });
    },

    // Import pre-built CSV rosters — call this before TeamSelect when in CSV mode
    generateLeagueFromCSV: (importedRosters) => {
        const ratings = {};
        const standings = {};

        TEAMS.forEach(team => {
            standings[team.id] = {
                id: team.id,
                wins: 0, losses: 0, ties: 0,
                pf: 0, pa: 0,
                confWins: 0, divWins: 0,
                streak: 0,
            };
            ratings[team.id] = calculateTeamRatings(importedRosters[team.id] || []);
        });

        const schedule = generateSeasonSchedule(TEAMS, 2024);

        const draftPickOwners = {};
        TEAMS.forEach(team => {
            draftPickOwners[team.id] = [1, 2, 3, 4, 5, 6, 7].map(r => ({ round: r, originalTeamId: team.id }));
        });

        set({
            rosters: importedRosters,
            teamRatings: ratings,
            standings,
            schedule,
            draftPickOwners,
            rosterMode: 'csv',
            initialized: false,
        });
    },

    selectTeam: (userTeamId, coachProfile = null) => {
        // Only an explicit local picker choice may retarget this store instance.
        if (_requestedSlot !== null) { _saveSlot = _requestedSlot; _requestedSlot = null; }
        const { rosters } = get();

        if (!rosters || Object.keys(rosters).length === 0) {
            get().generateLeague();
        }

        const state = get();
        const defaultPlaybookId = TEAM_PLAYBOOK_MAP[userTeamId] || 'pro-style';

        const finalState = {
            ...state,
            coachingStaff: createStaff(TEAMS, 2024, userTeamId, coachProfile),
            collegePipeline: createCollegePipeline(2024),
            collegeAlumni: [],
            collegeWatchlist: [],
            franchiseStories: [],
            assistantSettings: { ...ASSISTANT_DEFAULTS },
            assistantLog: [],
            initialized: true,
            userTeamId,
            userPlaybookId: defaultPlaybookId,
            year: 2024,
            season: 1,
            week: 1,
            phase: 'regular',
            draftClass: [],
            draftHistory: [],
            draftTimer: 120,
            draftTimerActive: false,
            activityLog: [`Franchise started with ${TEAM_MAP.get(userTeamId)?.location ?? ''} ${TEAM_MAP.get(userTeamId)?.name ?? userTeamId}`],
            coach: coachProfile || { name: 'Head Coach', style: 'balanced', bonus: {}, difficulty: 'pro', difficultyBonus: 0, seasonGoal: 'Make the Playoffs' },
            playerOfWeek: null,
            seasonGoalMet: false,
            trainingDoneThisOffseason: false,
            waiverWire: generateWaiverPool(),
            coachXp: 0,
            pendingStoryEvent: null,
            activeBoosts: [],
            devTrainingDone: false,
            morale: 50,
            lastWeekScores: [],
            breakoutPlayers: {},
            ...weeklyDefaults(),
            weekStrategy: 'balanced',
            ...CLAUDE_FRESH_FRANCHISE,
        };

        persist('gridiron_save_v3', finalState);
        set(finalState);
    },

    // Deprecated but kept for compatibility if needed (mapped to selectTeam)
    initializeGame: (userTeamId) => {
        get().generateLeague();
        get().selectTeam(userTeamId);
    },

    resetGame: () => {
        const slot = _saveSlot;
        clearTimeout(_persistTimer);
        _persistTimer = null; // prevent pagehide flush from re-writing the deleted save
        localStorage.removeItem(slotKey(slot));
        localStorage.removeItem('gridiron_save_v3'); // clear legacy too
        window.location.reload();
    },

    setWeekStrategy: (strategy) => {
        if (get().phase !== 'regular' || weeklyStrategy(strategy).id !== strategy) return;
        set({ weekStrategy: strategy });
        persist('gridiron_save_v3', { ...get(), weekStrategy: strategy });
    },

    simulateWeek: () => {
        get().ensureFranchiseSystems();
        if (get().phase !== 'regular' || get().week > 18) return;
        get().runAssistants();
        const { week, schedule, rosters, standings, userTeamId } = get();
        const userBonuses = userGameBonuses(get());

        // Safety check
        if (week > 18) {
            console.log("Sim skipped: Week > 18");
            return;
        }

        // Deep clone schedule to avoid direct mutation of state
        // We only really need to clone the current week's games or the whole thing?
        // Let's copy the whole array first, then the specific week array.
        const newSchedule = [...schedule];

        // Safety for specific week
        if (!newSchedule[week - 1]) {
            console.error("Critical Error: Schedule missing for week", week);
            return;
        }

        // Clone the inner array so we don't mutate the old state's array ref
        const weeksGames = newSchedule[week - 1].map(g => ({ ...g }));
        newSchedule[week - 1] = weeksGames;

        if (weeksGames.length === 0) {
            console.log(`Sim skipped: No games found for Week ${week}. Attempting to advance...`);
            // But we need to increment week still? 
            // Yes, let's just proceed to logic below which increments week.
        } else {
            console.log(`Simulating Week ${week}, ${weeksGames.length} games.`);
        }

        const newStandings = { ...standings };
        // Deep clone rosters for simulation to avoid mutating state directly during sim
        // Using JSON for safety, though structuredClone is better if available.
        const newRosters = deepClone(rosters);
        const weekResults = [];

        weeksGames.forEach(game => {
            // already played?
            if (game.played) {
                weekResults.push(game); // Keep it in results for headlines/logging
                return;
            }

            const homeTeam = TEAM_MAP.get(game.homeTeamId);
            const awayTeam = TEAM_MAP.get(game.awayTeamId);

            if (!homeTeam || !awayTeam) return;

            try {
                // Ensure rosters exist
                if (!newRosters[homeTeam.id] || !newRosters[awayTeam.id]) {
                    console.error('Missing roster for game', game);
                    return;
                }

                const isUserHome = game.homeTeamId === userTeamId;
                const isUserAway = game.awayTeamId === userTeamId;

                // Streak-based morale: long streaks give a small rating boost/penalty
                const getStreakBonus = (teamId) => {
                    const streak = newStandings[teamId]?.streak || 0;
                    if (streak >= 5) return 4;
                    if (streak >= 3) return 2;
                    if (streak <= -5) return -4;
                    if (streak <= -3) return -2;
                    return 0;
                };
                const homeStreakBonus = getStreakBonus(homeTeam.id);
                const awayStreakBonus = getStreakBonus(awayTeam.id);
                // Streak momentum stacks on top of the user's coaching bonuses
                // (it used to overwrite their moraleBoost).
                const homeBonusCombined = addBonuses(staffBonuses(get().coachingStaff, homeTeam.id), isUserHome && userBonuses, { moraleBoost: homeStreakBonus });
                const awayBonusCombined = addBonuses(staffBonuses(get().coachingStaff, awayTeam.id), isUserAway && userBonuses, { moraleBoost: awayStreakBonus });

                const state = get();
                const result = game.pendingResult || simulateGame(
                    homeTeam,
                    awayTeam,
                    gameDayRoster(newRosters[homeTeam.id], homeTeam.id, state),
                    gameDayRoster(newRosters[awayTeam.id], awayTeam.id, state),
                    homeBonusCombined,
                    awayBonusCombined,
                    gamePlans(state, homeTeam.id, awayTeam.id) // CLAUDE: coaching plans
                );

                // Update game object (in our local weeksGames copy)
                delete game.pendingResult;
                game.played = true;
                game.homeScore = result.homeScore;
                game.awayScore = result.awayScore;
                game.winnerId = result.homeScore > result.awayScore ? homeTeam.id : (result.awayScore > result.homeScore ? awayTeam.id : null);

                game.stats = {
                    home: result.homeStats,
                    away: result.awayStats
                };
                game.playerStats = {
                    home: result.homePlayerStats,
                    away: result.awayPlayerStats
                };
                game.weather = result.weather || null;
                game.overtime = result.overtime || false;
                Object.assign(game, gameDetailFields(result, isUserHome || isUserAway)); // CLAUDE: quarters, scoring, user pbp
                if (isUserHome || isUserAway) game.weeklyReview = weeklyGameReview(state, game);

                // Update Standings (Immutable pattern)
                const homeStats = { ...newStandings[homeTeam.id] };
                const awayStats = { ...newStandings[awayTeam.id] };
                newStandings[homeTeam.id] = homeStats;
                newStandings[awayTeam.id] = awayStats;

                homeStats.pf += result.homeScore;
                homeStats.pa += result.awayScore;
                awayStats.pf += result.awayScore;
                awayStats.pa += result.homeScore;

                if (result.homeScore > result.awayScore) {
                    homeStats.wins++;
                    awayStats.losses++;
                    homeStats.streak = homeStats.streak > 0 ? homeStats.streak + 1 : 1;
                    awayStats.streak = awayStats.streak < 0 ? awayStats.streak - 1 : -1;
                    if (homeTeam.conference === awayTeam.conference) {
                        homeStats.confWins++;
                        if (homeTeam.division === awayTeam.division) homeStats.divWins++;
                    }
                } else if (result.awayScore > result.homeScore) {
                    awayStats.wins++;
                    homeStats.losses++;
                    awayStats.streak = awayStats.streak > 0 ? awayStats.streak + 1 : 1;
                    homeStats.streak = homeStats.streak < 0 ? homeStats.streak - 1 : -1;
                    if (homeTeam.conference === awayTeam.conference) {
                        awayStats.confWins++;
                        if (homeTeam.division === awayTeam.division) awayStats.divWins++;
                    }
                } else {
                    homeStats.ties++;
                    awayStats.ties++;
                }

                // Update Player Stats
                [
                    { stats: result.homePlayerStats, teamId: homeTeam.id },
                    { stats: result.awayPlayerStats, teamId: awayTeam.id }
                ].forEach(({ stats: statGroup, teamId }) => {
                    if (!statGroup) return;

                    // Ensure we are working with the correct roster array from our clone
                    const teamRoster = newRosters[teamId];
                    if (!teamRoster) return;
                    const playersById = new Map(teamRoster.map(p => [p.id, p]));

                    Object.values(statGroup).forEach(statEntry => {
                        const { player: refPlayer, ...gameStats } = statEntry;
                        if (!refPlayer) return;

                        const player = playersById.get(refPlayer.id);

                        if (player) {
                            if (!player.stats) player.stats = { season: {}, career: {} };
                            if (!player.stats.season) player.stats.season = {};
                            if (!player.stats.career) player.stats.career = {};

                            Object.entries(gameStats).forEach(([statKey, statValue]) => {
                                if (statKey === 'rating' || statKey === 'player' || typeof statValue !== 'number' || !Number.isFinite(statValue)) return;

                                player.stats.season[statKey] = (player.stats.season[statKey] || 0) + statValue;
                                player.stats.career[statKey] = (player.stats.career[statKey] || 0) + statValue;
                            });
                        }
                    });
                });

                weekResults.push({ ...game, result });
            } catch (error) {
                console.error(`Simulation failed for ${homeTeam.id} vs ${awayTeam.id}`, error);
            }
        });

        // --- PLAYER OF THE WEEK ---
        let playerOfWeek = null;
        try {
            let bestScore = 0;
                weekResults.forEach(game => {
                if (!game.playerStats) return;
                [
                    { stats: game.playerStats.home, teamId: game.homeTeamId },
                    { stats: game.playerStats.away, teamId: game.awayTeamId },
                ].forEach(({ stats, teamId }) => {
                    if (!stats) return;
                    Object.values(stats).forEach(entry => {
                        const p = entry.player;
                        if (!p) return;
                        let score = 0, label = '';
                        if (p.position === 'QB') {
                            score = (entry.yards || 0) * 0.05 + (entry.tds || 0) * 6 - (entry.ints || 0) * 3;
                            label = `${entry.yards || 0} YDS · ${entry.tds || 0} TD`;
                        } else if (['RB', 'FB'].includes(p.position)) {
                            score = (entry.rushYards || 0) * 0.07 + (entry.rushTds || 0) * 6 + (entry.receptions || 0) * 0.5;
                            label = `${entry.rushYards || 0} RU · ${entry.rushTds || 0} TD`;
                        } else if (['WR', 'TE'].includes(p.position)) {
                            score = (entry.recYards || 0) * 0.07 + (entry.recTds || 0) * 6 + (entry.receptions || 0) * 0.5;
                            label = `${entry.recYards || 0} YDS · ${entry.receptions || 0} REC · ${entry.recTds || 0} TD`;
                        } else {
                            score = (entry.sacks || 0) * 8 + (entry.ints || 0) * 8 + (entry.tackles || 0) * 0.5 + (entry.tfl || 0) * 2;
                            label = `${entry.sacks || 0} SK · ${entry.ints || 0} INT · ${entry.tackles || 0} TKL`;
                        }
                        if (score > bestScore) {
                            bestScore = score;
                            playerOfWeek = { player: p, teamId, statLine: label, week };
                        }
                    });
                });
            });
        } catch { /* non-critical */ }

        // --- MEAN SCORES CALCULATION ---
        const allPlayedGames = newSchedule.flat().filter(g => g.played);
        const totalPoints = allPlayedGames.reduce((sum, g) => sum + g.homeScore + g.awayScore, 0);
        const meanPPG = allPlayedGames.length > 0 ? (totalPoints / allPlayedGames.length).toFixed(1) : 0;
        console.log(`League Stats: ${allPlayedGames.length} games played. Mean PPG: ${meanPPG} (Target: ~45)`);

        // --- INJURY SYSTEM ---
        // Generate new injuries from this week's games
        const rosterArray = Object.entries(newRosters).map(([id, roster]) => ({ id, roster }));
        const freshInjuries = generateWeeklyInjuries(weekResults, rosterArray);

        set(state => {
            // Check if we should advance to next week
            let nextWeek = state.week;
            let nextPhase = state.phase;

            if (nextWeek <= 18) {
                nextWeek += 1;
            }

            if (nextWeek > 18 && nextPhase === 'regular') {
                nextPhase = 'playoffs';
                nextWeek = 1; // Playoff week 1
                setTimeout(() => get().generatePlayoffs(), 0);
            }

            // Generate Headlines for the week (pass updated standings for streak/division news)
            const headlines = generateWeeklyHeadlines(weekResults || [], TEAMS, newStandings);

            // Generate Activity Log Message
            let logMsg = `Week ${state.week} simulation complete`;

            // Find user game in the NEW weeksGames array
            const userGame = weeksGames.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);

            if (userGame && userGame.played) {
                const userIsHome = userGame.homeTeamId === userTeamId;
                const userScore = userIsHome ? userGame.homeScore : userGame.awayScore;
                const oppScore = userIsHome ? userGame.awayScore : userGame.homeScore;
                const oppId = userIsHome ? userGame.awayTeamId : userGame.homeTeamId;
                const oppCity = TEAMS.find(t => t.id === oppId)?.location || oppId;

                const result = userScore > oppScore ? 'Win' : (userScore < oppScore ? 'Loss' : 'Tie');
                logMsg = `${result} ${userScore}-${oppScore} vs ${oppCity}`;
            } else if (!userGame) {
                logMsg = `Week ${state.week} - Bye Week`;
            }

            // Check if season goal is met
            const standing = newStandings[userTeamId];
            const goal = state.coach?.seasonGoal || '';
            let goalMet = state.seasonGoalMet || false;
            if (!goalMet && standing) {
                if (goal === 'Win the Super Bowl') goalMet = false; // checked at season end in playoffs
                else if (goal === 'Make the Playoffs') {
                    // Check at end of regular season: user is in top 7 of their conference
                    if (nextPhase === 'playoffs') {
                        const userTeamObj = TEAM_MAP.get(userTeamId);
                        goalMet = seedConference(TEAMS, newStandings, userTeamObj?.conference).includes(userTeamId);
                    }
                }
                else if (goal === 'Reach .500 or better' && standing.wins > standing.losses) goalMet = true;
                else if (goal === 'Win at least 6 games' && standing.wins >= 6) goalMet = true;
                else if (goal === 'Win 10+ games' && standing.wins >= 10) goalMet = true;
                else if (goal === 'Develop your young core') goalMet = false; // checked at season end
            }

            // Expire old trade offers
            const expiredOffer = state.pendingTradeOffer && state.pendingTradeOffer.expiresWeek < nextWeek
                ? null
                : state.pendingTradeOffer;

            // Process injuries: decrement week counters, remove healed, add new
            const healedInjuries = (state.injuries || [])
                .map(i => ({ ...i, weeksRemaining: i.weeksRemaining - 1 }))
                .filter(i => i.weeksRemaining > 0);
            const existingIds = new Set(healedInjuries.map(i => i.playerId));
            const uniqueNew = freshInjuries.filter(i => !existingIds.has(i.playerId));
            const updatedInjuries = [...healedInjuries, ...uniqueNew];

            // Update franchise records + generate milestone storylines
            const userGamePlayed = weeksGames.find(g => (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) && g.played);
            const prevRecords = state.franchiseRecords || {};
            let newRecords = { ...prevRecords };
            const milestoneStorylines = [];
            if (userGamePlayed) {
                const uIsHome = userGamePlayed.homeTeamId === userTeamId;
                const uScore = uIsHome ? userGamePlayed.homeScore : userGamePlayed.awayScore;
                const oScore = uIsHome ? userGamePlayed.awayScore : userGamePlayed.homeScore;
                const margin = uScore - oScore;
                const isWin = userGamePlayed.winnerId === userTeamId;
                const streak = newStandings[userTeamId]?.streak || 0;
                if (uScore > (newRecords.mostPointsGame || 0)) {
                    newRecords.mostPointsGame = uScore;
                    if (uScore >= 40) milestoneStorylines.push({ type: 'MILESTONE', icon: '🔥', teamId: userTeamId, title: 'Offensive Explosion', headline: `${uScore} points scored!`, subtext: `New franchise record for most points in a game.`, severity: 'great' });
                }
                if (oScore < (newRecords.fewestPointsAllowed ?? 999)) newRecords.fewestPointsAllowed = oScore;
                if (oScore === 0 && isWin) milestoneStorylines.push({ type: 'MILESTONE', icon: '🔒', teamId: userTeamId, title: 'Shutout!', headline: `Defense holds opponent to zero points`, subtext: `Dominant defensive performance.`, severity: 'great' });
                if (margin > (newRecords.biggestWinMargin || 0)) {
                    newRecords.biggestWinMargin = margin;
                    if (margin >= 20) milestoneStorylines.push({ type: 'MILESTONE', icon: '💪', teamId: userTeamId, title: 'Blowout Win', headline: `Won by ${margin} points`, subtext: `Statement victory for the franchise.`, severity: 'great' });
                }
                if (newStandings[userTeamId]?.wins > (newRecords.mostWins || 0)) newRecords.mostWins = newStandings[userTeamId].wins;
                if (isWin && streak === 5) milestoneStorylines.push({ type: 'MILESTONE', icon: '🔥', teamId: userTeamId, title: '5-Game Win Streak!', headline: 'Hot streak continues', subtext: 'Five wins in a row.', severity: 'great' });
                if (isWin && newStandings[userTeamId]?.wins === 1) milestoneStorylines.push({ type: 'MILESTONE', icon: '🎉', teamId: userTeamId, title: 'First Win!', headline: 'First victory of the season', subtext: 'The franchise is off to a start.', severity: 'great' });
            }

            // Award coach XP for the week
            const isWinThisWeek = userGamePlayed?.winnerId === userTeamId;
            let xpGained = 10; // base XP per week
            if (isWinThisWeek) xpGained += 25;
            if (isWinThisWeek && standing?.streak >= 3) xpGained += 10; // win streak bonus
            if (userGamePlayed && !isWinThisWeek && (userGamePlayed.homeScore === userGamePlayed.awayScore)) xpGained += 5; // tie
            const newCoachXp = (state.coachXp || 0) + xpGained;
            const oldLevel = getCoachLevel(state.coachXp || 0);
            const newLevel = getCoachLevel(newCoachXp);
            if (newLevel > oldLevel) {
                const perkInfo = COACH_LEVELS.find(l => l.level === newLevel);
                milestoneStorylines.push({
                    type: 'COACH_LEVEL', icon: '🏅', teamId: userTeamId,
                    title: `Coach Level ${newLevel}!`,
                    headline: `You've reached Coach Level ${newLevel}`,
                    subtext: perkInfo?.perkLabel || 'New perk unlocked.',
                    severity: 'great',
                });
            }

            // Decay active boosts
            const decayedBoosts = (state.activeBoosts || [])
                .map(b => ({ ...b, weeksLeft: b.weeksLeft - 1 }))
                .filter(b => b.weeksLeft > 0);

            // Generate weekly story event (only if no event already pending)
            const existingEvent = state.pendingStoryEvent;
            let newStoryEvent = existingEvent;
            if (!existingEvent && nextPhase === 'regular' && nextWeek <= 18) {
                newStoryEvent = generateWeeklyEvent(
                    newRosters[userTeamId] || [],
                    nextWeek,
                    newStandings,
                    userTeamId
                );
            }

            // ── MORALE UPDATE ─────────────────────────────────────────────────
            const isWinForMorale = userGamePlayed?.winnerId === userTeamId;
            const isTieForMorale = userGamePlayed && userGamePlayed.homeScore === userGamePlayed.awayScore;
            const userStreakNow = newStandings[userTeamId]?.streak || 0;
            let moraleDelta = 0;
            if (userGamePlayed) {
                if (isWinForMorale) {
                    moraleDelta = 6;
                    if (userStreakNow >= 5) moraleDelta += 4;
                    else if (userStreakNow >= 3) moraleDelta += 2;
                } else if (!isTieForMorale) {
                    moraleDelta = -5;
                    if (userStreakNow <= -3) moraleDelta -= 3;
                }
            } else if (!userGamePlayed) {
                // Bye week — slight morale recovery
                moraleDelta = 2;
            }
            const newMorale = Math.max(0, Math.min(100, (state.morale ?? 50) + moraleDelta));

            // ── LAST WEEK SCORES (compact scoreboard) ────────────────────────
            const newLastWeekScores = weeksGames
                .filter(g => g.played)
                .map(g => ({
                    homeTeamId: g.homeTeamId,
                    awayTeamId: g.awayTeamId,
                    homeScore: g.homeScore,
                    awayScore: g.awayScore,
                    winnerId: g.winnerId,
                }));

            // ── PER-GAME PLAYER MILESTONES ────────────────────────────────────
            if (userGamePlayed && userGamePlayed.playerStats) {
                const uIsHome = userGamePlayed.homeTeamId === userTeamId;
                const playerStatGroup = uIsHome ? userGamePlayed.playerStats.home : userGamePlayed.playerStats.away;
                const userRosterForMilestones = newRosters[userTeamId] || [];
                if (playerStatGroup) {
                    Object.values(playerStatGroup).forEach(entry => {
                        const p = entry.player;
                        if (!p) return;
                        const player = userRosterForMilestones.find(pl => pl.id === p.id);
                        if (!player) return;
                        const pos = p.position;
                        if (pos === 'QB') {
                            if ((entry.yards || 0) >= 350) milestoneStorylines.push({ type: 'MILESTONE', icon: '🎯', teamId: userTeamId, title: 'Elite Passing Day', headline: `${p.name} threw for ${entry.yards} yards`, subtext: `${entry.tds || 0} TDs · ${entry.ints || 0} INTs`, severity: 'great' });
                            if ((entry.tds || 0) >= 4) milestoneStorylines.push({ type: 'MILESTONE', icon: '🔥', teamId: userTeamId, title: 'Touchdown Machine', headline: `${p.name} threw ${entry.tds} touchdowns`, subtext: `Dominant performance under center`, severity: 'great' });
                        } else if (['RB', 'FB'].includes(pos)) {
                            if ((entry.rushYards || 0) >= 150) milestoneStorylines.push({ type: 'MILESTONE', icon: '🏃', teamId: userTeamId, title: 'Ground & Pound', headline: `${p.name} rushed for ${entry.rushYards} yards`, subtext: `${entry.rushTds || 0} TDs on the ground`, severity: 'great' });
                            if ((entry.rushYards || 0) >= 100 && (entry.rushTds || 0) >= 2) milestoneStorylines.push({ type: 'MILESTONE', icon: '💪', teamId: userTeamId, title: '100 & 2 Performance', headline: `${p.name} was unstoppable`, subtext: `100+ yards and 2 rushing TDs`, severity: 'great' });
                        } else if (['WR', 'TE'].includes(pos)) {
                            if ((entry.recYards || 0) >= 150) milestoneStorylines.push({ type: 'MILESTONE', icon: '⚡', teamId: userTeamId, title: 'Route Runner', headline: `${p.name} caught for ${entry.recYards} yards`, subtext: `${entry.receptions || 0} catches · ${entry.recTds || 0} TDs`, severity: 'great' });
                        } else if (['DL', 'DE', 'DT', 'LB', 'OLB', 'MLB'].includes(pos)) {
                            if ((entry.sacks || 0) >= 3) milestoneStorylines.push({ type: 'MILESTONE', icon: '💥', teamId: userTeamId, title: 'Wrecking Ball', headline: `${p.name} had ${entry.sacks} sacks`, subtext: `Dominated the opposing offense`, severity: 'great' });
                        } else if (['CB', 'S', 'FS', 'SS'].includes(pos)) {
                            if ((entry.ints || 0) >= 2) milestoneStorylines.push({ type: 'MILESTONE', icon: '🔒', teamId: userTeamId, title: 'Ball Hawk', headline: `${p.name} had ${entry.ints} interceptions`, subtext: `Lockdown performance in the secondary`, severity: 'great' });
                        }
                    });
                }
            }

            // ── BREAKOUT PLAYER DETECTION ─────────────────────────────────────
            // Young players (age ≤ 25, OVR 65-82) with outstanding games get a small OVR bump
            const currentBreakouts = state.breakoutPlayers || {};
            const newBreakouts = { ...currentBreakouts };
            if (userGamePlayed && userGamePlayed.playerStats) {
                const uIsHome2 = userGamePlayed.homeTeamId === userTeamId;
                const playerStatGroup2 = uIsHome2 ? userGamePlayed.playerStats.home : userGamePlayed.playerStats.away;
                if (playerStatGroup2) {
                    Object.values(playerStatGroup2).forEach(entry => {
                        const p = entry.player;
                        if (!p) return;
                        const player = (newRosters[userTeamId] || []).find(pl => pl.id === p.id);
                        if (!player || player.age > 25 || player.ovr < 65 || player.ovr > 82) return;
                        // Already broke out this season?
                        if (newBreakouts[player.id] === state.season) return;
                        let isBreakout = false;
                        const pos = player.position;
                        if (pos === 'QB' && (entry.yards || 0) >= 280 && (entry.tds || 0) >= 2) isBreakout = true;
                        if (['RB','FB'].includes(pos) && (entry.rushYards || 0) >= 120) isBreakout = true;
                        if (['WR','TE'].includes(pos) && (entry.recYards || 0) >= 100) isBreakout = true;
                        if (['DL','DE','DT','LB','OLB'].includes(pos) && (entry.sacks || 0) >= 2) isBreakout = true;
                        if (isBreakout) {
                            player.ovr = Math.min(99, player.ovr + 1);
                            newBreakouts[player.id] = state.season;
                            milestoneStorylines.push({
                                type: 'BREAKOUT', icon: '⭐', teamId: userTeamId,
                                title: `${player.name} is Breaking Out!`,
                                headline: `${player.name} had a career-defining performance`,
                                subtext: `+1 OVR boost — watch this ${player.age}-year-old blossom`,
                                severity: 'great',
                            });
                        }
                    });
                }
            }

            const newState = {
                ...state,
                standings: newStandings,
                schedule: newSchedule,
                rosters: newRosters,
                collegePipeline: updateCollege(state.collegePipeline || [], state.year, week),
                weeklyNews: headlines,
                activityLog: [logMsg, ...state.activityLog].slice(0, 50),
                week: nextWeek,
                phase: nextPhase,
                playerOfWeek: playerOfWeek || state.playerOfWeek,
                seasonGoalMet: goalMet,
                pendingTradeOffer: expiredOffer,
                injuries: updatedInjuries,
                franchiseRecords: newRecords,
                storylineQueue: [...(state.storylineQueue || []), ...milestoneStorylines],
                coachXp: newCoachXp,
                activeBoosts: decayedBoosts,
                pendingStoryEvent: newStoryEvent,
                devTrainingDone: false,
                morale: newMorale,
                lastWeekScores: newLastWeekScores,
                breakoutPlayers: newBreakouts,
                ...settlePositionBattle(state, userGame),
            };
            persist('gridiron_save_v3', newState);
            return newState;
        });
        // Possibly generate a CPU trade offer after simming the week
        get().runLeagueTrades();
        get().maybeGenerateCPUTradeOffer();
    },

    advanceWeek: () => {
        set(state => {
            let nextWeek = state.week + 1;
            let nextPhase = state.phase;

            if (state.phase === 'regular' && nextWeek > 18) {
                nextPhase = 'playoffs';
                nextWeek = 1;
                // Trigger playoff generation here or in component
            }

            const newState = {
                ...state,
                week: nextWeek,
                phase: nextPhase
            };
            persist('gridiron_save_v3', newState);
            return newState;
        });
    },

    advancePhase: (newPhase) => {
        set(state => {
            const newState = { phase: newPhase, week: 1 };
            persist('gridiron_save_v3', { ...state, ...newState });
            return newState;
        })
    },

    setPlaybook: (playbookId) => {
        set(state => {
            const newState = { ...state, userPlaybookId: playbookId };
            persist('gridiron_save_v3', newState);
            return { userPlaybookId: playbookId };
        });
    },

    simulateToWeek: (targetWeek) => {
        while (get().week <= targetWeek && get().phase === 'regular') {
            get().simulateWeek();
        }
    },

    setPlayerOvr: (teamId, playerId, newOvr) => {
        const { rosters, teamRatings } = get();
        const newRosters = deepClone(rosters);
        const player = newRosters[teamId]?.find(p => p.id === playerId);
        if (!player) return;

        const oldOvr = Math.max(1, player.ovr);
        const clamped = Math.max(1, Math.min(99, Math.round(newOvr)));
        const ratio = clamped / oldOvr;

        player.ovr = clamped;

        // Scale all position and universal attributes proportionally so simulation reflects the change
        if (player.attributes?.position) {
            Object.keys(player.attributes.position).forEach(key => {
                player.attributes.position[key] = Math.max(1, Math.min(99, Math.round(player.attributes.position[key] * ratio)));
            });
        }
        if (player.attributes?.universal) {
            Object.keys(player.attributes.universal).forEach(key => {
                player.attributes.universal[key] = Math.max(1, Math.min(99, Math.round(player.attributes.universal[key] * ratio)));
            });
        }

        const newRatings = { ...teamRatings, [teamId]: calculateTeamRatings(newRosters[teamId]) };
        const newState = { ...get(), rosters: newRosters, teamRatings: newRatings };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    // Edit a single attribute key (position or universal) directly without scaling OVR
    setPlayerAttr: (teamId, playerId, category, key, value) => {
        const { rosters, teamRatings } = get();
        const newRosters = deepClone(rosters);
        const player = newRosters[teamId]?.find(p => p.id === playerId);
        if (!player || !player.attributes?.[category]) return;
        player.attributes[category][key] = Math.max(1, Math.min(99, Math.round(value)));
        const newRatings = { ...teamRatings, [teamId]: calculateTeamRatings(newRosters[teamId]) };
        const newState = { ...get(), rosters: newRosters, teamRatings: newRatings };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    executeTrade: (myPlayerIds, myPickRounds, cpuTeamId, cpuPlayerIds, cpuPickRounds) => {
        const { rosters, draftPickOwners, userTeamId } = get();
        if (!cpuTeamId || cpuTeamId === userTeamId || !tradesOpen(get().phase, get().week)) return false;
        for (const [team, playerIds, picks] of [[userTeamId, myPlayerIds, myPickRounds], [cpuTeamId, cpuPlayerIds, cpuPickRounds]]) {
            if (new Set(playerIds).size !== playerIds.length || playerIds.some(id => !rosters[team]?.some(p => p.id === id))) return false;
            if (new Set(picks.map(p => typeof p === 'object' ? pickKey(p) : p)).size !== picks.length || picks.some(p => !(draftPickOwners[team] || []).some(o => typeof p === 'object' ? pickKey(o) === pickKey(p) : o.round === p))) return false;
        }
        const newRosters = deepClone(rosters);
        const newPickOwners = deepClone(draftPickOwners || {});

        const movePlayer = (fromTeam, toTeam, playerId) => {
            const idx = newRosters[fromTeam]?.findIndex(p => p.id === playerId);
            if (idx >= 0) {
                const [player] = newRosters[fromTeam].splice(idx, 1);
                player.teamId = toTeam;
                if (!newRosters[toTeam]) newRosters[toTeam] = [];
                newRosters[toTeam].push(player);
            }
        };

        myPlayerIds.forEach(pid => movePlayer(userTeamId, cpuTeamId, pid));
        cpuPlayerIds.forEach(pid => movePlayer(cpuTeamId, userTeamId, pid));

        const movePick = (fromTeam, toTeam, round) => {
            const picks = newPickOwners[fromTeam] || [];
            const idx = picks.findIndex(p => typeof round === 'object' ? pickKey(p) === pickKey(round) : p.round === round);
            if (idx >= 0) {
                const [pick] = picks.splice(idx, 1);
                newPickOwners[fromTeam] = picks;
                if (!newPickOwners[toTeam]) newPickOwners[toTeam] = [];
                newPickOwners[toTeam].push(pick);
            }
        };

        myPickRounds.forEach(r => movePick(userTeamId, cpuTeamId, r));
        cpuPickRounds.forEach(r => movePick(cpuTeamId, userTeamId, r));

        const newRatings = {};
        TEAMS.forEach(t => { newRatings[t.id] = calculateTeamRatings(newRosters[t.id] || []); });

        const newState = { ...get(), rosters: newRosters, draftPickOwners: newPickOwners, teamRatings: newRatings };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    // Playoff Actions
    generatePlayoffs: () => {
        const { standings, teams, phase, playoffBracket } = get();
        // simulateWeek schedules this on a timer; never let a late call reset
        // a bracket already in progress or a season that has moved on.
        if (phase !== 'regular' && phase !== 'playoffs') return;
        if (playoffBracket?.afc?.wc?.some(m => m.played)) return;

        // Seeds 1-4 go to division winners, 5-7 to the best remaining records.
        const afcSeeds = seedConference(teams, standings, 'AFC');
        const nfcSeeds = seedConference(teams, standings, 'NFC');

        const createMatchup = (id, home, away) => ({
            id,
            homeTeamId: home,
            awayTeamId: away,
            homeScore: null,
            awayScore: null,
            winnerId: null,
            played: false
        });

        const bracket = {
            round: 1, // 1=WC, 2=DIV, 3=CONF, 4=SB
            afc: {
                seeds: afcSeeds,
                wc: [
                    createMatchup('afc-wc-1', afcSeeds[1], afcSeeds[6]), // 2 vs 7
                    createMatchup('afc-wc-2', afcSeeds[2], afcSeeds[5]), // 3 vs 6
                    createMatchup('afc-wc-3', afcSeeds[3], afcSeeds[4]), // 4 vs 5
                ],
                div: [],
                conf: [],
            },
            nfc: {
                seeds: nfcSeeds,
                wc: [
                    createMatchup('nfc-wc-1', nfcSeeds[1], nfcSeeds[6]),
                    createMatchup('nfc-wc-2', nfcSeeds[2], nfcSeeds[5]),
                    createMatchup('nfc-wc-3', nfcSeeds[3], nfcSeeds[4]),
                ],
                div: [],
                conf: [],
            },
            sb: null
        };

        // Check "Make the Playoffs" goal
        const { userTeamId: uid, coach, seasonGoalMet: alreadyMet } = get();
        const userInPlayoffs = [...afcSeeds, ...nfcSeeds].includes(uid);
        const playoffGoalMet = !alreadyMet && coach?.seasonGoal === 'Make the Playoffs' && userInPlayoffs;

        set({ playoffBracket: bracket, phase: 'playoffs', week: 1, ...(playoffGoalMet ? { seasonGoalMet: true } : {}) });
        persist('gridiron_save_v3', { ...get(), playoffBracket: bracket, phase: 'playoffs', week: 1, ...(playoffGoalMet ? { seasonGoalMet: true } : {}) });
    },

    simulateNextPlayoffGame: () => {
        const { playoffBracket } = get();
        if (!playoffBracket) return null;

        const round = playoffBracket.round;
        const newBracket = deepClone(playoffBracket);
        let matchToPlay = null;

        // Helper to find next unplayed
        const findUnplayed = (matches) => matches.find(m => !m.played);

        if (round === 1) { // WC
            matchToPlay = findUnplayed(newBracket.afc.wc) || findUnplayed(newBracket.nfc.wc);
        } else if (round === 2) { // Div
            matchToPlay = findUnplayed(newBracket.afc.div) || findUnplayed(newBracket.nfc.div);
        } else if (round === 3) { // Conf
            matchToPlay = findUnplayed(newBracket.afc.conf) || findUnplayed(newBracket.nfc.conf);
        } else if (round === 4) { // SB
            if (newBracket.sb && !newBracket.sb.played) matchToPlay = newBracket.sb;
        }

        if (!matchToPlay) {
            // No games left in this round, advance round logic check
            return get().advancePlayoffRound(newBracket); // We'll refactor advance logic into a helper or call it here
        }

        // Simulate THIS game
        const result = playPlayoffGame(get(), matchToPlay.homeTeamId, matchToPlay.awayTeamId);
        if (!result) return null;
        Object.assign(matchToPlay, result, { played: true });

        // If Super Bowl just finished
        let seasonOver = false;
        if (round === 4 && matchToPlay.id === 'sb') {
            seasonOver = true;
        }

        set({ playoffBracket: newBracket });
        persist('gridiron_save_v3', { ...get(), playoffBracket: newBracket });

        return {
            playedGame: matchToPlay,
            seasonOver
        };
    },

    // Sim every game in the current playoff round at once, then advance bracket
    simPlayoffRound: () => {
        const { playoffBracket } = get();
        if (!playoffBracket) return null;

        const newBracket = deepClone(playoffBracket);
        const round = newBracket.round;
        if (round === 4 && newBracket.sb?.played) return { seasonOver: true, newRound: 4 };

        const state = get();
        const simMatchup = (m) => {
            if (m.played) return;
            const result = playPlayoffGame(state, m.homeTeamId, m.awayTeamId);
            if (result) Object.assign(m, result, { played: true });
        };

        if (round === 1) {
            newBracket.afc.wc.forEach(simMatchup);
            newBracket.nfc.wc.forEach(simMatchup);
        } else if (round === 2) {
            newBracket.afc.div.forEach(simMatchup);
            newBracket.nfc.div.forEach(simMatchup);
        } else if (round === 3) {
            newBracket.afc.conf.forEach(simMatchup);
            newBracket.nfc.conf.forEach(simMatchup);
        } else if (round === 4 && newBracket.sb) {
            simMatchup(newBracket.sb);
        }

        let seasonOver = false;

        if (round === 1) {
            const processConf = (confData, conf) => {
                const winners = confData.wc.map(m => ({ id: m.winnerId, seedIdx: confData.seeds.indexOf(m.winnerId) }));
                winners.sort((a, b) => a.seedIdx - b.seedIdx);
                const seed1 = confData.seeds[0];
                const worstWinner = winners.pop();
                const bestWinner = winners[0];
                const midWinner = winners[1];
                confData.div = [
                    { id: `${conf}-div-1`, homeTeamId: seed1, awayTeamId: worstWinner.id, played: false, winnerId: null },
                    { id: `${conf}-div-2`, homeTeamId: bestWinner.id, awayTeamId: midWinner.id, played: false, winnerId: null }
                ];
            };
            processConf(newBracket.afc, 'afc');
            processConf(newBracket.nfc, 'nfc');
            newBracket.round = 2;
        } else if (round === 2) {
            const processConf = (confData, conf) => {
                const w1 = confData.div[0].winnerId;
                const w2 = confData.div[1].winnerId;
                const idx1 = confData.seeds.indexOf(w1);
                const idx2 = confData.seeds.indexOf(w2);
                const home = idx1 < idx2 ? w1 : w2;
                const away = idx1 < idx2 ? w2 : w1;
                confData.conf = [{ id: `${conf}-conf-1`, homeTeamId: home, awayTeamId: away, played: false, winnerId: null }];
            };
            processConf(newBracket.afc, 'afc');
            processConf(newBracket.nfc, 'nfc');
            newBracket.round = 3;
        } else if (round === 3) {
            const afcChamp = newBracket.afc.conf[0].winnerId;
            const nfcChamp = newBracket.nfc.conf[0].winnerId;
            newBracket.sb = { id: 'sb', homeTeamId: afcChamp, awayTeamId: nfcChamp, homeScore: null, awayScore: null, winnerId: null, played: false };
            newBracket.round = 4;
        } else if (round === 4) {
            seasonOver = true;
        }

        // A playoff round is a week: injuries heal the same way.
        const injuries = (get().injuries || [])
            .map(i => ({ ...i, weeksRemaining: i.weeksRemaining - 1 }))
            .filter(i => i.weeksRemaining > 0);
        set({ playoffBracket: newBracket, injuries });
        return { seasonOver, newRound: newBracket.round };
    },

    advancePlayoffRound: (currentBracket) => {
        const round = currentBracket.round;
        let newBracket = currentBracket;

        // This is extracted from the old logic to be reusable
        // Logic to setup next round based on current results
        // ... (reuse existing logic from lines 424-488 but adapted)

        // Actually, let's keep it simple. If we call simulateNextPlayoffGame and return null, 
        // the UI can check if round is complete.
        // But we need a state update to "next round" if all are played.

        // Check if round complete
        let roundComplete = false;
        if (round === 1) roundComplete = [...newBracket.afc.wc, ...newBracket.nfc.wc].every(m => m.played);
        else if (round === 2) roundComplete = [...newBracket.afc.div, ...newBracket.nfc.div].every(m => m.played);
        else if (round === 3) roundComplete = [...newBracket.afc.conf, ...newBracket.nfc.conf].every(m => m.played);

        if (roundComplete) {
            // Logic to setup next round structures (WC -> Div, Div -> Conf, etc)
            // We can copy/paste the logic from the old simulatePlayoffRound here
            // ...
            // For brevity in this edit, I will call the old function if round complete lol. 
            // Wait, the old function simulates everything. 
            // I'll rewrite the setup logic here.

            if (round === 1) { // WC Done -> Setup Div
                const processConf = (confData, conf) => {
                    const winners = confData.wc.map(m => ({ id: m.winnerId, seedIdx: confData.seeds.indexOf(m.winnerId) }));
                    winners.sort((a, b) => a.seedIdx - b.seedIdx);
                    const seed1 = confData.seeds[0];
                    const worstWinner = winners.pop();
                    const bestWinner = winners[0];
                    const midWinner = winners[1];
                    confData.div = [
                        { id: `${conf}-div-1`, homeTeamId: seed1, awayTeamId: worstWinner.id, played: false, winnerId: null },
                        { id: `${conf}-div-2`, homeTeamId: bestWinner.id, awayTeamId: midWinner.id, played: false, winnerId: null }
                    ];
                };
                processConf(newBracket.afc, 'afc');
                processConf(newBracket.nfc, 'nfc');
                newBracket.round = 2;
            } else if (round === 2) { // Div Done -> Setup Conf
                const processConf = (confData, conf) => {
                    const w1 = confData.div[0].winnerId;
                    const w2 = confData.div[1].winnerId;
                    const idx1 = confData.seeds.indexOf(w1);
                    const idx2 = confData.seeds.indexOf(w2);
                    const home = idx1 < idx2 ? w1 : w2;
                    const away = idx1 < idx2 ? w2 : w1;
                    confData.conf = [{ id: `${conf}-conf-1`, homeTeamId: home, awayTeamId: away, played: false, winnerId: null }];
                };
                processConf(newBracket.afc, 'afc');
                processConf(newBracket.nfc, 'nfc');
                newBracket.round = 3;
            } else if (round === 3) { // Conf Done -> Setup SB
                const afcChamp = newBracket.afc.conf[0].winnerId;
                const nfcChamp = newBracket.nfc.conf[0].winnerId;
                newBracket.sb = { id: 'sb', homeTeamId: afcChamp, awayTeamId: nfcChamp, homeScore: null, awayScore: null, winnerId: null, played: false };
                newBracket.round = 4;
            }

            set({ playoffBracket: newBracket });
            persist('gridiron_save_v3', { ...get(), playoffBracket: newBracket });
            return { roundAdvanced: true };
        }
        return null;
    },

    concludeSeason: () => {
        const { rosters, teams, playoffBracket, year, standings, seasonRecap } = get();
        if (!playoffBracket?.sb?.played) return null;
        if (seasonRecap?.year === year) {
            // Already concluded; older saves could stop short of the offseason.
            get().startOffseason();
            return seasonRecap;
        }

        const awards = calculateSeasonAwards(rosters, teams, standings);
        const sb = playoffBracket.sb;
        const winner = teams.find(t => t.id === sb.winnerId);

        const recap = {
            year,
            champion: winner,
            winner: sb.winnerId,
            finalist: sb.winnerId === sb.homeTeamId ? sb.awayTeamId : sb.homeTeamId,
            playoffTeams: [...(playoffBracket.afc?.seeds || []), ...(playoffBracket.nfc?.seeds || [])],
            awards
        };

        set({ seasonRecap: recap });

        // Offseason progression runs right away. It used to fire from a 500ms
        // timer, which raced "Begin the offseason": progression could run
        // twice, or be skipped entirely if the page closed in between.
        get().startOffseason();

        return recap;
    },

    // Keeping old function for compatibility or bulk sim if needed, but updated to use new logic is better.
    // For now, let's just REPLACE simulatePlayoffRound with the new logic completely if possible, 
    // OR just leave it and add new ones. 
    // I will replace lines 371-492 with `simulateNextPlayoffGame` and helpers.


    debugForcePlayoffs: () => {
        const { teams } = get();
        // Randomize some wins for seeding consistency
        const teamsWithWins = teams.map(t => ({
            ...t,
            wins: Math.floor(Math.random() * 10) + 5,
            losses: Math.floor(Math.random() * 5),
            pf: Math.floor(Math.random() * 500),
            pa: Math.floor(Math.random() * 400)
        }));

        // Update standings state
        const newStandings = {};
        teamsWithWins.forEach(t => {
            newStandings[t.id] = { ...t };
        });

        set({ teams: teamsWithWins, standings: newStandings, week: 18, phase: 'regular' });
        // Defer generate to next tick to ensure state update
        setTimeout(() => get().generatePlayoffs(), 50);
    },

    // Draft Actions
    // Generate draft class early (during FA) so user can pre-scout
    generateDraftPreview: () => {
        const existing = get().draftClass;
        if (existing && existing.length > 0) return; // Already generated
        get().ensureFranchiseSystems();
        const draftClass = collegeDraftClass(get().collegePipeline, get().year + 1);
        set({ draftClass });
        persist('gridiron_save_v3', { ...get(), draftClass });
    },

    startDraft: () => {
        // Rival clubs fill their rosters before the draft even if the user
        // never pressed "Sim rival signings".
        if (get().phase === 'freeAgency' && !get().cpuSigningsDone) get().simCPUSignings();
        // Reuse draft class if already generated via pre-draft scouting
        get().ensureFranchiseSystems();
        const existingClass = get().draftClass;
        const draftClass = (existingClass && existingClass.length > 0) ? existingClass : collegeDraftClass(get().collegePipeline, get().year + 1);
        const { standings, draftPickOwners } = get();

        // Sort teams by record (worst first for draft order)
        const teamsSorted = draftTeamOrder(TEAMS, standings, get().schedule, get().playoffBracket);

        // Build draft order respecting pick trades
        // draftPickOwners: { receivingTeamId: [{ round, originalTeamId }] }
        const draftOrder = [];
        for (let r = 1; r <= 7; r++) {
            teamsSorted.forEach(originalTeamId => {
                // Default: team owns its own pick
                let ownerTeamId = originalTeamId;
                if (draftPickOwners) {
                    // Check if any team has received this team's pick for this round
                    for (const [receivingTeamId, picksOwned] of Object.entries(draftPickOwners)) {
                        if (Array.isArray(picksOwned) && picksOwned.some(p => p.originalTeamId === originalTeamId && p.round === r)) {
                            ownerTeamId = receivingTeamId;
                            break;
                        }
                    }
                }
                draftOrder.push({ teamId: ownerTeamId, originalTeamId, round: r });
            });
        }

        let pickCounter = 1;
        draftOrder.forEach(p => p.pickNumber = pickCounter++);

        const draftState = {
            phase: 'draft',
            draftClass,
            draftOrder,
            currentPickIndex: 0,
            onClockTeamId: draftOrder[0].teamId,
            draftHistory: [],
            draftTimer: 120,
            draftTimerActive: true,
            scoutedProspects: get().scoutedProspects,
            draftWatchlist: get().draftWatchlist,
            scoutingPoints: get().scoutingPoints,
        };
        set(draftState);
        persist('gridiron_save_v3', { ...get(), ...draftState });
    },

    makePick: (playerId) => {
        const { draftClass, draftOrder, currentPickIndex, rosters, draftHistory, teamRatings } = get();
        const pick = draftOrder[currentPickIndex];
        const player = draftClass.find(p => p.id === playerId);
        if (!pick || !player || get().phase !== 'draft') return false;
        const salary = Math.round(Math.max(0.8, 10 / Math.pow(1 + (pick.pickNumber - 1) / 8, 0.7)) * 100) / 100;
        const rookie = { ...player, teamId: pick.teamId, experience: 0, draftYear: get().year + 1, draftPick: pick.pickNumber, contract: { salary, years: 4, yearsLeft: 4 } };
        const roster = [...(rosters[pick.teamId] || []), rookie];
        const next = currentPickIndex + 1;
        set({ draftClass: draftClass.filter(p => p.id !== playerId), rosters: { ...rosters, [pick.teamId]: roster },
            teamRatings: { ...teamRatings, [pick.teamId]: calculateTeamRatings(roster) },
            currentPickIndex: next, draftHistory: [...draftHistory, { ...pick, player: rookie }],
            onClockTeamId: draftOrder[next]?.teamId || null, draftTimer: 120 });
        return next < draftOrder.length;
    },
    tradeDraftPicks: (partner, give, receive) => {
        const state = get();
        const value = picks => picks.reduce((sum, p) => sum + pickValue(state.draftOrder.find(o => pickKey(o) === pickKey(p))?.pickNumber || p.round * 32 - 15), 0);
        if (value(give) < value(receive) * 1.03) return { success: false, message: 'Offer at least 103% of the requested pick value.' };
        const change = exchangePicks(state.draftPickOwners, state.draftOrder, state.currentPickIndex, state.userTeamId, partner, give, receive);
        if (!change) return { success: false, message: 'These picks are no longer available.' };
        const event = { id: `trade-${Date.now()}`, year: state.year + 1, week: state.week, from: state.userTeamId, to: partner, text: `${TEAM_MAP.get(state.userTeamId)?.abbreviation} sends ${give.map(p => `R${p.round} (${p.originalTeamId.toUpperCase()})`).join(', ')} to ${TEAM_MAP.get(partner)?.abbreviation} for ${receive.map(p => `R${p.round} (${p.originalTeamId.toUpperCase()})`).join(', ')}.` };
        set({ ...change, tradeHistory: [event, ...(state.tradeHistory || [])].slice(0, 100) });
        return { success: true, message: 'Trade accepted. Pick ownership updated.' };
    },
    maybeDraftTrade: () => {
        const state = get(), order = state.draftOrder, idx = state.currentPickIndex;
        const seller = order[idx];
        if (!seller || seller.teamId === state.userTeamId || Math.random() > 0.18) return;
        const buyer = order.slice(idx + 1, idx + 9).find(p => p.teamId !== seller.teamId && p.teamId !== state.userTeamId);
        if (!buyer) return;
        const sweetener = order.slice(idx + 1).find(p => p.teamId === buyer.teamId && p.pickNumber !== buyer.pickNumber && pickValue(p.pickNumber) + pickValue(buyer.pickNumber) >= pickValue(seller.pickNumber) && pickValue(p.pickNumber) + pickValue(buyer.pickNumber) <= pickValue(seller.pickNumber) * 1.45);
        if (!sweetener) return;
        const change = exchangePicks(state.draftPickOwners, order, idx, seller.teamId, buyer.teamId, [seller], [buyer, sweetener]);
        if (!change) return;
        set({ ...change, tradeHistory: [{ id: `draft-${state.year}-${idx}`, year: state.year + 1, text: `${TEAM_MAP.get(buyer.teamId)?.abbreviation} moves up to #${seller.pickNumber}; ${TEAM_MAP.get(seller.teamId)?.abbreviation} receives #${buyer.pickNumber} and #${sweetener.pickNumber}.` }, ...(state.tradeHistory || [])].slice(0, 100) });
    },
    simToNextUserPick: () => {
        let safety = 0;
        while (get().draftOrder[get().currentPickIndex] && get().draftOrder[get().currentPickIndex].teamId !== get().userTeamId && safety++ < 224) get().simOneCpuPick();
    },
    simOneCpuPick: () => {
        const before = get();
        if (!before.draftOrder[before.currentPickIndex] || before.draftOrder[before.currentPickIndex].teamId === before.userTeamId) return;
        get().maybeDraftTrade();
        const state = get(), pick = state.draftOrder[state.currentPickIndex];
        const prospect = cpuMakePick(state.rosters[pick.teamId] || [], state.draftClass, TEAM_MAP.get(pick.teamId)?.draftStyle);
        if (prospect) get().makePick(prospect.id);
    },

    // Timer Actions
    setDraftTimer: (seconds) => set({ draftTimer: seconds }),
    toggleDraftTimer: (isActive) => set({ draftTimerActive: isActive }),
    decrementDraftTimer: () => {
        const { draftTimer, draftTimerActive, currentPickIndex, draftOrder, userTeamId } = get();
        if (!draftTimerActive) return;

        if (draftTimer > 0) {
            set({ draftTimer: draftTimer - 1 });
        } else {
            // Time expired! Auto-pick for user if it's their turn
            if (draftOrder[currentPickIndex]?.teamId === userTeamId) {
                // Auto pick best available
                const { draftClass } = get();
                // Simple: pick highest OVR (copy first — don't mutate state in place)
                const bestAvailable = [...draftClass].sort((a, b) => b.ovr - a.ovr)[0];
                if (bestAvailable) get().makePick(bestAvailable.id);
            }
        }
    },

    // Scout a prospect (spend 1 scouting point to reveal true OVR)
    scoutProspect: (prospectId) => {
        const { scoutingPoints, scoutedProspects } = get();
        if (scoutingPoints <= 0 || scoutedProspects[prospectId]) return false;
        const newScouted = { ...scoutedProspects, [prospectId]: true };
        set({ scoutingPoints: scoutingPoints - 1, scoutedProspects: newScouted });
        persist('gridiron_save_v3', { ...get(), scoutingPoints: scoutingPoints - 1, scoutedProspects: newScouted });
        return true;
    },

    // Toggle prospect on/off watchlist
    toggleWatchlist: (prospectId) => {
        const { draftWatchlist } = get();
        const newList = draftWatchlist.includes(prospectId)
            ? draftWatchlist.filter(id => id !== prospectId)
            : [...draftWatchlist, prospectId];
        set({ draftWatchlist: newList });
        persist('gridiron_save_v3', { ...get(), draftWatchlist: newList });
    },

    // Offseason Training — user picks a unit to focus development on (+1-2 OVR to starters)
    trainRoster: (unitKey) => {
        const { rosters, userTeamId, teamRatings } = get();
        const UNIT_POSITIONS = {
            QB:  ['QB'],
            RB:  ['RB', 'FB'],
            WR:  ['WR', 'TE'],
            OL:  ['OL', 'C', 'OG', 'OT', 'G', 'T'],
            DL:  ['DL', 'DE', 'DT'],
            LB:  ['LB', 'MLB', 'OLB'],
            DB:  ['CB', 'S', 'FS', 'SS', 'DB'],
        };
        const positions = UNIT_POSITIONS[unitKey] || [unitKey];
        const userRoster = rosters[userTeamId] || [];

        const posGroups = {};
        userRoster.forEach(p => {
            if (positions.includes(p.position)) {
                if (!posGroups[p.position]) posGroups[p.position] = [];
                posGroups[p.position].push(p);
            }
        });
        const trained = new Set();
        Object.values(posGroups).forEach(group => {
            group.sort((a, b) => b.ovr - a.ovr).slice(0, 2).forEach(p => trained.add(p.id));
        });

        const newRoster = userRoster.map(p => {
            if (!trained.has(p.id)) return p;
            const boost = p.age <= 25 ? 2 : 1;
            const newOvr = Math.min(99, p.ovr + boost);
            return { ...p, ovr: newOvr, ovrHistory: [...(p.ovrHistory || [p.ovr]), newOvr] };
        });

        const newRosters = { ...rosters, [userTeamId]: newRoster };
        const newRatings = { ...teamRatings, [userTeamId]: calculateTeamRatings(newRoster) };
        set({ rosters: newRosters, teamRatings: newRatings, trainingDoneThisOffseason: true });
        persist('gridiron_save_v3', { ...get(), rosters: newRosters, teamRatings: newRatings, trainingDoneThisOffseason: true });
        return trained.size;
    },

    // Multi-Season & Progression Actions
    // Returns { accepted, reason }. Players want at least their asking price
    // (they'll give a small discount for security on 1-2 year deals, and want
    // a premium to commit 5+ years), and the new salary must fit under the cap.
    resignPlayer: (teamId, playerId, salary, years) => {
        if (!validContractOffer(salary, years)) return { accepted: false, reason: 'Enter a finite positive salary and a whole contract term from 1 to 6 years.' };
        const { rosters } = get();
        const roster = rosters[teamId] || [];
        const player = roster.find(p => p.id === playerId);
        if (!player) return { accepted: false, reason: 'Player not found.' };

        const stance = contractStance(player, teamContext(get(), teamId)); // CLAUDE: personality sets the price
        if (!stance.willing) return { accepted: false, reason: stance.refusal }; // CLAUDE
        const asking = Math.max(1, Math.round(askingSalary(player) * stance.askMultiplier)); // CLAUDE
        const termFactor = years <= 2 ? 0.9 : years >= 5 ? 1.1 : 1;
        const minimum = Math.max(1, Math.round(asking * termFactor * 10) / 10);
        if (salary < minimum) {
            return { accepted: false, reason: `${player.name} turned it down — he wants at least $${minimum}M a year for ${years} years.` };
        }
        const capAfter = roster.reduce((sum, p) => sum + (p.id === playerId ? salary : (p.contract?.salary || 2)), 0);
        // A team already over the cap can still extend someone at a pay cut.
        if (capAfter > CAP_TOTAL && salary > (player.contract?.salary || 2)) {
            return { accepted: false, reason: `That deal would put you $${Math.round(capAfter - CAP_TOTAL)}M over the cap.` };
        }

        const newRosters = { ...rosters, [teamId]: roster.map(p =>
            p.id === playerId
                ? { ...p, contract: { salary, years, yearsLeft: years } }
                : p
        )};
        set({ rosters: newRosters });
        return { accepted: true };
    },

    startOffseason: () => {
        if (get().phase !== 'playoffs') return;
        get().ensureFranchiseSystems();
        get().runAssistants();
        const { rosters, season, year, phase } = get();
        // Progression, contract expiry and ageing happen exactly once a year.
        if (phase !== 'playoffs') return;

        const carousel = coachingCarousel(get().coachingStaff, TEAMS, get().standings, get().userTeamId, year);
        const completedCollege = updateCollege(get().collegePipeline, year, 18);
        const watchedStories = completedCollege.filter(p => get().collegeWatchlist.includes(p.id)).map(p => ({ year, kind: 'College', text: `${p.name} (${p.school}): ${p.events.at(-1)?.text}` }));
        const nextStories = [...carousel.stories.map(text => ({ year, kind: 'Coaching', text })), ...watchedStories, ...get().franchiseStories].slice(0, 300);
        // Run season progression for all players
        const { newRosters, storylines } = runSeasonProgression(rosters);

        // --- Contract countdown + expiration ---
        const expiredPlayers = []; // will join generated FA pool
        Object.entries(newRosters).forEach(([teamId, roster]) => {
            if (!Array.isArray(roster)) return;
            for (let i = roster.length - 1; i >= 0; i--) {
                const p = roster[i];
                const yearsLeft = (p.contract?.yearsLeft ?? 1) - 1;
                if (yearsLeft <= 0) {
                    // Player's contract expired — release to FA pool
                    expiredPlayers.push({
                        ...p,
                        previousTeamId: teamId, // track origin for CPU re-sign
                        contract: { salary: p.contract?.salary || 2, years: 1, yearsLeft: 1 },
                        teamId: null,
                        draftStatus: 'available',
                    });
                    roster.splice(i, 1);
                } else {
                    roster[i] = { ...p, contract: { ...p.contract, yearsLeft } };
                }
            }
        });

        // CPU teams auto-resign their top players before they hit the FA pool
        const toRemoveFromExpired = new Set();
        const userTeamIdNow = get().userTeamId;
        expiredPlayers.forEach((p, idx) => {
            const tid = p.previousTeamId;
            if (!tid || tid === userTeamIdNow) return; // User manages their own
            if (p.ovr < 70) return; // Only quality players get re-signed by CPU

            // Check CPU team cap room
            const teamRoster = newRosters[tid] || [];
            const capUsed = teamRoster.reduce((s, pl) => s + (pl.contract?.salary || 2), 0);
            const capRoom = 200 - capUsed;
            const salary = p.contract?.salary || 2;
            if (capRoom < salary) return;

            // Chance to re-sign scales with OVR
            const resignChance = p.ovr >= 85 ? 0.80 : p.ovr >= 78 ? 0.68 : 0.50;
            if (Math.random() > resignChance) return;

            const resignYears = Math.floor(Math.random() * 2) + 1;
            newRosters[tid] = newRosters[tid] || [];
            newRosters[tid].push({
                ...p,
                teamId: tid,
                previousTeamId: undefined,
                contract: { salary, years: resignYears, yearsLeft: resignYears },
                draftStatus: undefined,
            });
            toRemoveFromExpired.add(idx);
        });
        const filteredExpired = expiredPlayers.filter((_, idx) => !toRemoveFromExpired.has(idx));

        // Generate free agent pool (only players not re-signed by CPU)
        const freeAgents = generateFreeAgentPool(filteredExpired);

        // Route storylines to news feed (non-blocking)
        const storyNews = storylines.map(s => ({
            type: s.type,
            headline: s.headline,
            subtext: s.subtext,
            icon: s.icon,
            teamId: s.teamId,
        }));
        const staffNews = carousel.stories.map(headline => ({ type: 'coaching', headline, subtext: 'Coaching carousel · open Coaching Staff to review vacancies and candidates', icon: '📋' }));
        const mergedNews = [...staffNews, ...storyNews, ...get().weeklyNews].slice(0, 30);

        // Ratings must follow the rosters progression just rewrote.
        const newRatings = {};
        TEAMS.forEach(t => { newRatings[t.id] = calculateTeamRatings(newRosters[t.id] || []); });

        // History keeps ids and names only — the full player/team objects
        // bloated every save for no reader's benefit.
        const recap = get().seasonRecap;
        const slimAward = p => p && { id: p.id, name: p.name, position: p.position, teamId: p.teamId, teamLocation: p.teamLocation };
        const userStanding = get().standings?.[get().userTeamId];
        const historyEntry = {
            year, season,
            rivalryGames: rivalryGames(get().schedule, get().playoffBracket),
            record: userStanding ? { wins: userStanding.wins, losses: userStanding.losses, ties: userStanding.ties || 0 } : null,
            seasonRecap: recap && {
                year: recap.year,
                winner: recap.winner ?? recap.champion?.id,
                finalist: recap.finalist,
                playoffTeams: recap.playoffTeams || [],
                awards: Object.fromEntries(Object.entries(recap.awards || {}).map(([k, p]) => [k, slimAward(p)])),
            },
        };

        set({
            rosters: newRosters,
            teamRatings: newRatings,
            coachingStaff: carousel.coaches,
            collegePipeline: completedCollege,
            franchiseStories: nextStories,
            phase: 'offseason',
            week: 1,
            freeAgents,
            injuries: [],
            activeBoosts: [],
            pendingStoryEvent: null,
            storylineQueue: [],
            weeklyNews: mergedNews,
            seasonHistory: [...(get().seasonHistory || []), historyEntry]
        });
    },

    startFreeAgency: () => {
        // If the season hasn't been wrapped up yet, do it now (no-op otherwise).
        if (get().phase === 'playoffs') {
            if (get().playoffBracket?.sb?.played) get().concludeSeason();
            else return;
        }
        if (get().phase !== 'offseason') return;
        set({ phase: 'freeAgency', week: 1, cpuSigningsDone: false, scoutingPoints: 10, scoutedProspects: {}, draftWatchlist: [], pendingTradeOffer: null, draftClass: [], injuries: [] });
        persist('gridiron_save_v3', { ...get(), phase: 'freeAgency', week: 1, cpuSigningsDone: false, scoutingPoints: 10, scoutedProspects: {}, draftWatchlist: [], pendingTradeOffer: null, draftClass: [], injuries: [] });
    },

    // Apply a story event choice
    resolveStoryEvent: (choiceIndex) => {
        const { pendingStoryEvent, rosters, userTeamId, teamRatings, activeBoosts } = get();
        if (!pendingStoryEvent) return;
        const choice = pendingStoryEvent.choices[choiceIndex];
        const effect = choice?.effect;

        let newRosters = deepClone(rosters);
        let newBoosts = [...(activeBoosts || [])];

        if (effect) {
            if (effect.type === 'player_ovr' || effect.type === 'rookie_ovr') {
                const pid = effect.type === 'rookie_ovr' ? effect.rookieId : effect.playerId;
                const roster = newRosters[userTeamId] || [];
                const p = roster.find(pl => pl.id === pid);
                if (p) p.ovr = Math.min(99, p.ovr + effect.delta);
            } else if (effect.type === 'player_penalty') {
                const p = (newRosters[userTeamId] || []).find(pl => pl.id === effect.playerId);
                if (p) {
                    newBoosts.push({ type: 'player_penalty', playerId: effect.playerId, value: effect.delta, weeks: effect.weeks, weeksLeft: effect.weeks });
                }
            } else if (effect.type === 'win_prob_boost') {
                newBoosts.push({ type: 'win_prob', value: effect.value, weeks: effect.weeks, weeksLeft: effect.weeks });
            } else if (effect.type === 'team_boost') {
                newBoosts.push({ type: 'team_ovr', value: effect.value, weeks: effect.weeks, weeksLeft: effect.weeks });
            } else if (effect.type === 'group_boost') {
                newBoosts.push({ type: 'group_ovr', group: pendingStoryEvent.ctx?.posGroup, value: effect.value, weeks: effect.weeks, weeksLeft: effect.weeks });
            } else if (effect.type === 'rest_player') {
                // Sits out this week's game (see gameDayRoster).
                if (effect.playerId) newBoosts.push({ type: 'rest', playerId: effect.playerId, weeks: 1, weeksLeft: 1 });
            } else if (effect.type === 'extend_contract') {
                const p = (newRosters[userTeamId] || []).find(pl => pl.id === effect.playerId);
                if (p) {
                    p.contract = { ...p.contract, years: effect.years, yearsLeft: effect.years };
                }
            }
        }

        const newRatings = { ...teamRatings, [userTeamId]: calculateTeamRatings(newRosters[userTeamId] || []) };
        const newState = { ...get(), pendingStoryEvent: null, rosters: newRosters, teamRatings: newRatings, activeBoosts: newBoosts };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    dismissStoryEvent: () => {
        const newState = { ...get(), pendingStoryEvent: null };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    // Dev training — target a specific player for a focused training session (once per week)
    devTrainPlayer: (playerId, focusAttr) => {
        const { rosters, userTeamId, teamRatings, devTrainingDone, coachXp } = get();
        if (devTrainingDone) return { success: false, reason: 'Already trained this week' };

        const newRosters = deepClone(rosters);
        const roster = newRosters[userTeamId] || [];
        const p = roster.find(pl => pl.id === playerId);
        if (!p) return { success: false, reason: 'Player not found' };

        // Base gain: 1 OVR, coach perk doubles it
        const hasFocusPerk = hasCoachPerk(coachXp, 'focus_boost');
        const gain = hasFocusPerk ? 2 : 1;

        // Boost specific attribute if provided
        if (focusAttr && p.attributes?.position?.[focusAttr] !== undefined) {
            p.attributes.position[focusAttr] = Math.min(99, p.attributes.position[focusAttr] + gain * 2);
        } else if (focusAttr && p.attributes?.universal?.[focusAttr] !== undefined) {
            p.attributes.universal[focusAttr] = Math.min(99, p.attributes.universal[focusAttr] + gain * 2);
        }
        p.ovr = Math.min(99, p.ovr + gain);
        if (!p.ovrHistory) p.ovrHistory = [p.ovr - gain];
        p.ovrHistory.push(p.ovr);

        const newRatings = { ...teamRatings, [userTeamId]: calculateTeamRatings(roster) };
        const newState = { ...get(), rosters: newRosters, teamRatings: newRatings, devTrainingDone: true };
        set(newState);
        persist('gridiron_save_v3', newState);
        return { success: true, gain, playerName: p.name, newOvr: p.ovr };
    },

    toggleFAWatchlist: (faId) => {
        const { faWatchlist } = get();
        const next = faWatchlist.includes(faId)
            ? faWatchlist.filter(id => id !== faId)
            : [...faWatchlist, faId];
        set({ faWatchlist: next });
        persist('gridiron_save_v3', { ...get(), faWatchlist: next });
    },

    signFreeAgent: (faId, teamId, contractOverride) => {
        const { freeAgents, rosters, teamRatings } = get();
        const fa = freeAgents.find(f => f.id === faId);

        if (!fa) return false;

        // Move FA to roster with contract (keep salary for cap tracking)
        const newRosters = deepClone(rosters);
        const rawContract = contractOverride || fa.contract || { salary: 2, years: 1 };
        const contract = { ...rawContract, yearsLeft: rawContract.yearsLeft ?? rawContract.years ?? 1 };
        const signedPlayer = { ...fa, teamId, contract };

        if (!newRosters[teamId]) newRosters[teamId] = [];
        newRosters[teamId].push(signedPlayer);

        // Remove from FA pool
        const newFreeAgents = freeAgents.filter(f => f.id !== faId);

        // Update ratings
        const newRatings = { ...teamRatings, [teamId]: calculateTeamRatings(newRosters[teamId]) };

        set({ freeAgents: newFreeAgents, rosters: newRosters, teamRatings: newRatings });
        persist('gridiron_save_v3', { ...get(), freeAgents: newFreeAgents, rosters: newRosters, teamRatings: newRatings });

        return true;
    },

    simCPUSignings: () => {
        if (get().cpuSigningsDone) return;
        const { rosters, freeAgents, userTeamId, draftPickOwners, teamRatings } = get();
        const reserveByTeam = Object.fromEntries(TEAMS.map(t => [t.id, rookieReserve(draftPickOwners?.[t.id] || [])]));
        const managed = manageCPURosters({ rosters, freeAgents, userTeamId, targetSize: ROSTER_LIMIT - 7, reserveByTeam });
        const newRatings = { ...teamRatings };
        for (const t of TEAMS) if (t.id !== userTeamId) newRatings[t.id] = calculateTeamRatings(managed.rosters[t.id] || []);
        set({ rosters: managed.rosters, freeAgents: managed.freeAgents, teamRatings: newRatings, cpuSigningsDone: true });
    },

    dismissStoryline: () => {
        const { storylineQueue } = get();
        const remaining = storylineQueue.slice(1);
        set({ storylineQueue: remaining });
        persist('gridiron_save_v3', { ...get(), storylineQueue: remaining });
    },

    finalizeDraft: () => {
        if (get().phase !== 'draft') return;
        get().ensureFranchiseSystems();
        // After draft, proceed to new regular season
        const { year, season, draftClass, freeAgents } = get();
        if (get().currentPickIndex < get().draftOrder.length) return;
        const newSchedule = generateSeasonSchedule(TEAMS, year + 1, get().standings);

        // Convert undrafted prospects into UDFA free agents so user can sign them
        const undraftedFAs = draftClass.map(p => ({
            ...p,
            id: `udfa_${p.id}`,
            contract: { salary: 1, years: 1 },
            note: p.note || 'Undrafted free agent rookie',
            interest: '2 teams',
            isUndrafted: true
        }));

        // Merge existing unsigned FAs with undrafted rookies
        let updatedFreeAgents = [...freeAgents, ...undraftedFAs];

        // Reset standings for new season
        const newStandings = {};
        TEAMS.forEach(team => {
            newStandings[team.id] = {
                id: team.id,
                wins: 0, losses: 0, ties: 0,
                pf: 0, pa: 0,
                confWins: 0, divWins: 0,
                streak: 0
            };
        });

        const newWaiverWire = generateWaiverPool();

        // Repair cap and roster legality after rookie additions and pick trades.
        // Released players return to the market; existing salaries never change.
        const { rosters, userTeamId } = get();
        const managed = manageCPURosters({ rosters, freeAgents: updatedFreeAgents, userTeamId, targetSize: ROSTER_LIMIT });
        const newRosters = managed.rosters;
        updatedFreeAgents = managed.freeAgents;
        const newRatings = { ...get().teamRatings };
        for (const t of TEAMS) if (t.id !== userTeamId) newRatings[t.id] = calculateTeamRatings(newRosters[t.id] || []);

        set({
            rosters: newRosters,
            teamRatings: newRatings,
            collegeAlumni: [...(get().collegeAlumni || []), ...(get().collegePipeline || []).filter(p => p.draftYear === year + 1 && get().collegeWatchlist.includes(p.id))],
            collegePipeline: nextCollegeYear(get().collegePipeline || [], year + 1),
            draftArchive: [...(get().draftArchive || []), { year: year + 1, picks: get().draftHistory }],
            draftPickOwners: Object.fromEntries(TEAMS.map(t => [t.id, [1,2,3,4,5,6,7].map(round => ({ round, originalTeamId: t.id }))])),
            year: year + 1,
            season: season + 1,
            week: 1,
            phase: 'regular',
            schedule: newSchedule,
            standings: newStandings,
            draftClass: [],
            draftOrder: [],
            draftHistory: [],
            currentPickIndex: 0,
            onClockTeamId: null,
            injuries: [],
            freeAgents: updatedFreeAgents,
            waiverWire: newWaiverWire,
            faWatchlist: [],
            storylineQueue: [],
            playoffBracket: null,
            seasonRecap: null,
            trainingDoneThisOffseason: false,
            playerOfWeek: null,
            seasonGoalMet: false,
        });

        persist('gridiron_save_v3', { ...get(), year: year + 1, season: season + 1, week: 1, phase: 'regular', schedule: newSchedule, standings: newStandings, freeAgents: updatedFreeAgents, waiverWire: newWaiverWire });
    },

    updateInjuries: () => {
        // Decrement injury weeks remaining, remove healed
        const { injuries } = get();
        const updated = injuries
            .map(inj => ({ ...inj, weeksRemaining: inj.weeksRemaining - 1 }))
            .filter(inj => inj.weeksRemaining > 0);

        set({ injuries: updated });
        persist('gridiron_save_v3', { ...get(), injuries: updated });
    },

    addStorylines: (newStorylines) => {
        // Push storylines to weeklyNews (non-blocking news feed) instead of queue
        const { weeklyNews } = get();
        const asNews = newStorylines.map(s => ({
            type: s.type,
            headline: s.headline,
            subtext: s.subtext,
            icon: s.icon,
            teamId: s.teamId,
        }));
        const updated = [...asNews, ...weeklyNews].slice(0, 30);
        set({ weeklyNews: updated, storylineQueue: [] });
        persist('gridiron_save_v3', { ...get(), weeklyNews: updated, storylineQueue: [] });
    },

    dismissStorylines: () => {
        set({ storylineQueue: [] });
        persist('gridiron_save_v3', { ...get(), storylineQueue: [] });
    },

    cutPlayer: (playerId) => {
        const { rosters, userTeamId, teamRatings, phase, waiverWire } = get();
        const newRosters = deepClone(rosters);
        const cutP = (newRosters[userTeamId] || []).find(p => p.id === playerId);
        newRosters[userTeamId] = (newRosters[userTeamId] || []).filter(p => p.id !== playerId);
        const newRatings = { ...teamRatings, [userTeamId]: calculateTeamRatings(newRosters[userTeamId]) };

        // During regular season, add cut player to waiver wire so others can claim them
        let newWaiverWire = waiverWire || [];
        if (phase === 'regular' && cutP) {
            const waiverPlayer = {
                ...cutP,
                id: `ww_cut_${cutP.id}`,
                teamId: null,
                contract: { salary: cutP.contract?.salary || 1, years: 1, yearsLeft: 1 },
                note: `Cut from ${userTeamId.toUpperCase()} — available on waivers`,
                interest: '0 teams',
            };
            newWaiverWire = [waiverPlayer, ...newWaiverWire];
        }

        const newState = { ...get(), rosters: newRosters, teamRatings: newRatings, waiverWire: newWaiverWire, freeAgents: phase !== 'regular' && cutP ? [{ ...cutP, teamId: null }, ...get().freeAgents] : get().freeAgents };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    signFromWaivers: (playerId) => {
        const { waiverWire, rosters, userTeamId, teamRatings } = get();
        const player = (waiverWire || []).find(p => p.id === playerId);
        if (!player) return false;

        const newRosters = deepClone(rosters);
        const contract = { ...player.contract, yearsLeft: player.contract?.yearsLeft ?? 1 };
        const signedPlayer = { ...player, id: `signed_${playerId}_${Date.now().toString(36)}`, teamId: userTeamId, contract };

        if (!newRosters[userTeamId]) newRosters[userTeamId] = [];
        newRosters[userTeamId].push(signedPlayer);

        const newWaiverWire = (waiverWire || []).filter(p => p.id !== playerId);
        const newRatings = { ...teamRatings, [userTeamId]: calculateTeamRatings(newRosters[userTeamId]) };

        const newState = { ...get(), waiverWire: newWaiverWire, rosters: newRosters, teamRatings: newRatings };
        set(newState);
        persist('gridiron_save_v3', newState);
        return true;
    },

    runLeagueTrades: () => {
        const state = get();
        if (state.phase !== 'regular' || state.week < 2 || state.week > 9) return;
        const deal = findLeagueTrade(state.rosters, state.userTeamId);
        if (!deal) return;
        const text = `${TEAM_MAP.get(deal.a)?.abbreviation} acquires ${deal.q.name} (${deal.q.position}); ${TEAM_MAP.get(deal.b)?.abbreviation} acquires ${deal.p.name} (${deal.p.position}). Both clubs address a position of need.`;
        set({ rosters: deal.rosters, teamRatings: { ...state.teamRatings, [deal.a]: calculateTeamRatings(deal.rosters[deal.a]), [deal.b]: calculateTeamRatings(deal.rosters[deal.b]) }, tradeHistory: [{ id: `league-${state.year}-${state.week}`, year: state.year, week: state.week, text }, ...(state.tradeHistory || [])].slice(0, 100), weeklyNews: [{ type: 'TRADE', headline: 'Around the league: trade completed', subtext: text, icon: '🔄', teamId: deal.a }, ...state.weeklyNews] });
    },

    // ── CPU Trade Offer System ────────────────────────────────────────────────
    // Called after simulating a week — ~18% chance a CPU team proposes a trade
    maybeGenerateCPUTradeOffer: () => {
        const { pendingTradeOffer, rosters, userTeamId, draftPickOwners, week, phase } = get();
        // Don't generate if one already pending, not regular season, too early, or past deadline
        if (pendingTradeOffer || phase !== 'regular' || week < 3 || week > TRADE_DEADLINE_WEEK) return;
        if (Math.random() > 0.18) return;

        const userRoster = rosters[userTeamId] || [];
        const cpuTeams = TEAMS.filter(t => t.id !== userTeamId);
        const fromTeam = cpuTeams[Math.floor(Math.random() * cpuTeams.length)];
        const cpuRoster = rosters[fromTeam.id] || [];

        // CPU wants to acquire a position they need (top 80+ OVR user player)
        const tradeBait = [...userRoster].filter(p => p.ovr >= 78).sort((a, b) => b.ovr - a.ovr);
        if (tradeBait.length === 0) return;
        const targetPlayer = tradeBait[Math.floor(Math.random() * Math.min(3, tradeBait.length))];

        // CPU offers a player of similar or slightly lower value + possibly a pick
        const cpuContenders = [...cpuRoster].filter(p =>
            p.position !== targetPlayer.position &&
            p.ovr >= targetPlayer.ovr - 8 && p.ovr <= targetPlayer.ovr + 4
        ).sort((a, b) => b.ovr - a.ovr);

        if (cpuContenders.length === 0) return;
        const offeredPlayer = cpuContenders[0];

        // For worse deals, sweeten with a pick
        const valueDiff = targetPlayer.ovr - offeredPlayer.ovr;
        // Offer a real asset the club currently owns. A bare round number is
        // ambiguous once previous trades have moved original-team picks.
        const wantedRound = valueDiff > 10 ? 1 : 2;
        const ownedPick = (draftPickOwners?.[fromTeam.id] || [])
            .filter(p => p.round === wantedRound)
            .sort((a, b) => a.round - b.round)[0];
        const offerPicks = valueDiff > 5 && ownedPick ? [ownedPick] : [];

        const offer = {
            fromTeamId: fromTeam.id,
            give: [{ type: 'player', ...targetPlayer }],   // what user gives up
            receive: [
                { type: 'player', ...offeredPlayer },
                ...offerPicks.map(p => ({ type: 'pick', ...p }))
            ],
            expiresWeek: week + 1,
        };

        set({ pendingTradeOffer: offer });
        persist('gridiron_save_v3', { ...get(), pendingTradeOffer: offer });
    },

    acceptTradeOffer: () => {
        const { pendingTradeOffer, rosters, userTeamId, draftPickOwners, teamRatings } = get();
        if (!pendingTradeOffer) return;
        if (!tradesOpen(get().phase, get().week) || (get().phase === 'regular' && pendingTradeOffer.expiresWeek < get().week)) {
            set({ pendingTradeOffer: null });
            return false;
        }

        const { fromTeamId, give, receive } = pendingTradeOffer;
        const newRosters = deepClone(rosters);
        const newPickOwners = deepClone(draftPickOwners || {});

        const receivedPicks = receive.filter(item => item.type === 'pick');
        if (receivedPicks.some(item => !(newPickOwners[fromTeamId] || []).some(p => p.round === item.round && p.originalTeamId === item.originalTeamId))) {
            set({ pendingTradeOffer: null });
            return;
        }
        const offeredPlayers = give.filter(item => item.type === 'player');
        const requestedPlayers = receive.filter(item => item.type === 'player');
        if (offeredPlayers.some(item => !(rosters[userTeamId] || []).some(p => p.id === item.id)) ||
            requestedPlayers.some(item => !(rosters[fromTeamId] || []).some(p => p.id === item.id))) {
            set({ pendingTradeOffer: null });
            return;
        }

        // Remove given players from user, add to CPU
        give.forEach(item => {
            if (item.type === 'player') {
                newRosters[userTeamId] = (newRosters[userTeamId] || []).filter(p => p.id !== item.id);
                if (!newRosters[fromTeamId]) newRosters[fromTeamId] = [];
                newRosters[fromTeamId].push({ ...item, teamId: fromTeamId });
            }
        });

        // Add received items to user
        receive.forEach(item => {
            if (item.type === 'player') {
                newRosters[fromTeamId] = (newRosters[fromTeamId] || []).filter(p => p.id !== item.id);
                if (!newRosters[userTeamId]) newRosters[userTeamId] = [];
                newRosters[userTeamId].push({ ...item, teamId: userTeamId });
            } else if (item.type === 'pick') {
                if (!newPickOwners[userTeamId]) newPickOwners[userTeamId] = [];
                newPickOwners[userTeamId].push({ round: item.round, originalTeamId: item.originalTeamId });
                // Remove from CPU's picks
                if (newPickOwners[fromTeamId]) {
                    newPickOwners[fromTeamId] = newPickOwners[fromTeamId].filter(
                        p => !(p.round === item.round && p.originalTeamId === item.originalTeamId)
                    );
                }
            }
        });

        const newRatings = {
            ...teamRatings,
            [userTeamId]: calculateTeamRatings(newRosters[userTeamId]),
            [fromTeamId]: calculateTeamRatings(newRosters[fromTeamId]),
        };

        const newState = { ...get(), rosters: newRosters, draftPickOwners: newPickOwners, teamRatings: newRatings, pendingTradeOffer: null };
        set(newState);
        persist('gridiron_save_v3', newState);
    },

    declineTradeOffer: () => {
        set({ pendingTradeOffer: null });
        persist('gridiron_save_v3', { ...get(), pendingTradeOffer: null });
    },

    // ===== CLAUDE ACTIONS =====
    // Owner & job security (logic in engine/owner.js). Driven by OwnerWatcher.
    ensureOwner: () => {
        const s = get();
        if (!s.initialized || !s.userTeamId) return;
        // A stale owner (other team, or from a later year of a save that was reset) is replaced.
        const valid = s.owner && s.owner.teamId === s.userTeamId && !(s.owner.goalsYear > s.year);
        let owner = valid ? s.owner : createOwnerState(s.userTeamId);
        if (s.phase === 'regular' && owner.goalsYear !== s.year && !owner.fired) {
            owner = { ...owner, goals: generateSeasonGoals(owner.archetypeId, teamRank(s.teamRatings, s.userTeamId), buildOwnerContext(s)), goalsYear: s.year };
        }
        if (owner !== s.owner) set({ owner });
    },

    runOwnerReview: () => {
        const s = get();
        const year = s.seasonRecap?.year;
        if (!s.owner?.goals?.length || year == null || s.owner.lastReviewYear === year || s.owner.goalsYear !== year) return;
        const owner = reviewSeason(s.owner, buildOwnerContext(s), year);
        set({ owner: owner.fired ? { ...owner, offers: jobOffers(s.teamRatings, s.userTeamId) } : owner });
    },

    dismissOwnerReview: () => {
        const { owner } = get();
        if (owner?.pendingReview) set({ owner: { ...owner, pendingReview: null } });
    },

    acceptJobOffer: (teamId) => {
        const s = get();
        if (!s.owner?.fired || !s.owner.offers?.includes(teamId)) return;
        const fresh = createOwnerState(teamId, REHIRE_TRUST);
        // The new club's owner inherits your résumé so the history carries over.
        set({
            userTeamId: teamId,
            userPlaybookId: TEAM_PLAYBOOK_MAP[teamId] || 'pro-style',
            owner: { ...fresh, reviews: s.owner.reviews, goalsYear: s.owner.goalsYear },
            // Fired in the offseason; the new club's first season is next year.
            legacyMeta: { tenure: [...(s.legacyMeta?.tenure || [{ teamId: s.userTeamId, from: 0 }]), { teamId, from: s.year + 1 }] },
            franchiseRecords: {},
            faWatchlist: [],
            pendingTradeOffer: null,
            coachingStaff: (s.coachingStaff || []).map(c => {
                if (c.role !== 'HC') return c;
                if (c.teamId === s.userTeamId) return { ...c, teamId, history: [...c.history, { year: s.year, teamId, role: 'HC', event: 'Hired' }] };
                if (c.teamId === teamId) return { ...c, teamId: null, history: [...c.history, { year: s.year, teamId, role: 'HC', event: 'Replaced' }] };
                return c;
            }),
            franchiseStories: [{ year: s.year, kind: 'Coaching', text: `Fired by ${TEAM_MAP.get(s.userTeamId)?.name || 'your old club'}, you were hired to rebuild the ${TEAM_MAP.get(teamId)?.name || teamId}.` }, ...(s.franchiseStories || [])].slice(0, 300),
            activityLog: [...(s.activityLog || []), `Hired as head coach of ${TEAM_MAP.get(teamId)?.location ?? ''} ${TEAM_MAP.get(teamId)?.name ?? teamId}`],
        });
    },

    /** Unlocks any newly earned achievements; returns their ids for the UI to celebrate. */
    checkAchievements: () => {
        const s = get();
        if (!s.initialized || !s.userTeamId) return [];
        const ids = newlyUnlocked(s, s.achievements || {});
        if (!ids.length) return [];
        const stamp = { year: s.year, week: s.week, teamId: s.userTeamId };
        set({ achievements: { ...(s.achievements || {}), ...Object.fromEntries(ids.map(id => [id, stamp])) } });
        return ids;
    },

    // Free-agency market (logic in engine/faMarket.js). FreeAgency.jsx opens it.
    openFAMarket: () => {
        const s = get();
        if (s.phase !== 'freeAgency' || !s.userTeamId) return;
        if (s.faMarket?.year === s.year && s.faMarket.teamId === s.userTeamId) return;
        set({
            freeAgents: openMarket(s.freeAgents || []),
            faMarket: { year: s.year, teamId: s.userTeamId, day: 0, offers: {}, floors: {}, log: [], closed: false },
        });
    },

    placeFAOffer: (faId, salary, years) => {
        const s = get(), m = s.faMarket;
        if (s.phase !== 'freeAgency' || !m || m.closed) return { ok: false, reason: 'The market is closed.' };
        const player = (s.freeAgents || []).find(p => p.id === faId);
        const budget = offerBudget({ userRoster: s.rosters[s.userTeamId] || [], offers: m.offers, pool: s.freeAgents, exceptId: faId });
        const reason = validateOffer(player, { salary, years }, budget);
        if (reason) return { ok: false, reason };
        set({ faMarket: { ...m, offers: { ...m.offers, [faId]: { salary, years } } } });
        return { ok: true };
    },

    withdrawFAOffer: (faId) => {
        const m = get().faMarket;
        if (!m?.offers?.[faId]) return;
        const { [faId]: _gone, ...offers } = m.offers;
        set({ faMarket: { ...m, offers } });
    },

    /** Resolves one market day; returns what happened for the UI to report. */
    advanceFADay: () => {
        const s = get(), m = s.faMarket;
        if (s.phase !== 'freeAgency' || !m || m.closed) return null;
        const r = resolveMarketDay({ pool: s.freeAgents || [], offers: m.offers, floors: m.floors, day: m.day,
            rosters: s.rosters, userTeamId: s.userTeamId, draftPickOwners: s.draftPickOwners, standings: s.standings });
        const rosters = { ...s.rosters }, teamRatings = { ...s.teamRatings }, touched = new Set();
        for (const { player, teamId, contract } of r.signings) {
            const { ask: _a, openingAsk: _o, interest: _i, ...clean } = player;
            rosters[teamId] = [...(rosters[teamId] || []), { ...clean, teamId, previousTeamId: undefined, draftStatus: undefined, contract }];
            touched.add(teamId);
        }
        touched.forEach(id => { teamRatings[id] = calculateTeamRatings(rosters[id]); });
        const day = m.day + 1;
        const entry = (kind, player, extra) => ({ day, kind, playerId: player.id, name: player.name, position: player.position, ovr: player.ovr, ...extra });
        const log = [
            ...r.signings.map(sg => entry(sg.byUser ? 'user' : 'rival', sg.player, { teamId: sg.teamId, salary: sg.contract.salary, years: sg.contract.years })),
            ...r.rejections.map(rj => entry('rejected', rj.player, { text: rj.text, teamId: rj.signedWith, salary: rj.offer.salary, years: rj.offer.years })),
        ];
        set({
            rosters, teamRatings, freeAgents: r.pool,
            faMarket: { ...m, day, closed: day >= FA_DAYS, offers: {}, floors: r.floors, log: [...log, ...(m.log || [])].slice(0, 250) },
        });
        return {
            day,
            closed: day >= FA_DAYS,
            signed: r.signings.filter(sg => sg.byUser),
            rejected: r.rejections,
            rivalSignings: r.signings.filter(sg => !sg.byUser).length,
        };
    },

    /** Plays out the remaining market days (pending offers resolve on the next one). */
    finishFreeAgency: () => {
        const results = [];
        for (let i = 0; i < FA_DAYS && get().faMarket && !get().faMarket.closed; i++) {
            const r = get().advanceFADay();
            if (!r) break;
            results.push(r);
        }
        return results;
    },

    /** Outside the offseason market, unsigned players take their ask immediately. */
    quickSignFA: (faId) => {
        const s = get();
        const player = (s.freeAgents || []).find(p => p.id === faId);
        const salary = player ? askOf(player) : 0, years = player ? preferredYears(player) : 1;
        const budget = offerBudget({ userRoster: s.rosters[s.userTeamId] || [] });
        const reason = validateOffer(player, { salary, years }, budget);
        if (reason) return { ok: false, reason };
        get().signFreeAgent(faId, s.userTeamId, { salary, years });
        return { ok: true, salary, years };
    },
    /**
     * The locker room's reaction to players the user just traded away.
     * Call AFTER a successful trade with the departing players' snapshots.
     */
    applyTradeFallout: (outgoing = []) => {
        const { moraleDelta, notes } = tradeFallout(outgoing);
        if (!notes.length) return { moraleDelta: 0, notes };
        const s = get();
        const morale = Math.max(0, Math.min(100, (s.morale ?? 50) + moraleDelta));
        const worst = [...notes].sort((a, b) => a.delta - b.delta)[0];
        const story = {
            type: 'LOCKER_ROOM', icon: moraleDelta < 0 ? '😬' : '😮‍💨', teamId: s.userTeamId,
            title: moraleDelta < 0 ? 'Locker room shaken' : 'Locker room relieved',
            headline: worst.text,
            subtext: `Team morale ${moraleDelta > 0 ? '+' : ''}${moraleDelta}.`,
            severity: moraleDelta < 0 ? 'tense' : 'relief',
        };
        set({ morale, storylineQueue: [...(s.storylineQueue || []), story] });
        return { moraleDelta, notes };
    },
    // ===== END CLAUDE =====

    // ===== CODEX ACTIONS =====
    choosePositionBattle: (choice) => {
        const patch = choosePositionBattle(get(), choice);
        if (!patch) return { ok: false, reason: 'This evaluation is no longer available.' };
        set(patch);
        persist('gridiron_save_v3', get());
        return { ok: true };
    },
    resolvePositionBattle: (choice) => {
        const patch = resolvePositionBattle(get(), choice);
        if (!patch) return { ok: false, reason: 'That starter is unavailable or the evaluation has not finished.' };
        set(patch);
        persist('gridiron_save_v3', get());
        return { ok: true };
    },
    // ===== END CODEX =====

}));

// ── Auto-save: persist state to active slot on every meaningful change ────────
useGameStore.subscribe((state) => {
    if (!state.initialized) return;
    schedulePersist();
});

// Flush any pending save before the tab closes / hides
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        if (_persistTimer) {
            clearTimeout(_persistTimer);
            flushPersist();
        }
    });
}
