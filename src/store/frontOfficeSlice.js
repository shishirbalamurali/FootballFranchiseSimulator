// Front-office overhaul: store actions (Claude-owned).
//
// Spread into gameStore inside the CLAUDE fences. Real logic lives in the
// engine modules; each action here is a thin, save-safe wrapper. New state:
//   frontOffice — inbox, GM trust, dead cap, trade block/requests, stages,
//                 X-Factor history, camp reveal, staff extras, FA visits
//   scouting    — the user's department (engine/scouting.js)
//   college     — this college season's results (engine/collegeSeason.js)
// Every field defaults safely when an older save lacks it (foEnsure).
import { TEAMS } from '../data/teams';
import { calculateTeamRatings } from '../engine/ratings';
import { defaultScouting, runAssignments, applyVisit, applyInterview, applyCombine, applyAttendance, userView, draftSnapshot, revealVerdict, recordHits, scoutOf, trajectoryOf, VISIT_SLOTS, INTERVIEW_SLOTS } from '../engine/scouting';
import { scoutProfile } from '../engine/people';
import { defaultCollege, playCollegeThrough, advanceStories, offseasonMoves, migrateSchools, heismanRace, schoolByName, weekGames, SCHOOLS, eventText } from '../engine/collegeSeason';
import { seasonXFactorPass, seedLeagueXFactors, abilityFor, isActiveXF } from '../engine/xFactor';
import { evaluateProposal, applyProposal, counterOffer, blockOffers, cpuPackage, leagueDeals, applyLeagueDeal, valueCtx, pickLabel } from '../engine/tradeTalks';
import { perceivedPlayerValue, teamMode } from '../engine/assetValue';
import { ensurePickYears, compPicks } from '../engine/picks';
import { makeItem, pushItems, removeItem } from '../engine/inbox';
import { markStage, currentStage } from '../engine/offseasonCalendar';
import { deadMoney, chargeDeadCap, tagPrice, TENDERS, isRestricted, structuredContract, fifthYearPrice } from '../engine/contracts';
import { contractStance, teamContext, wantsOut, characterFor } from '../engine/character';
import { askingSalary } from '../engine/progression';
import { retireCoaches, poachedFromUser, blockPoach, developmentBoost, coachProfile, staffBudget, staffPayroll, allIdentities, USER_ROLES } from '../engine/staffCareers';
import { rosterSalary } from '../engine/cpuRosterManagement';
import { SALARY_CAP } from '../engine/contracts';
import { TRADE_DEADLINE_WEEK } from '../engine/leagueRules';
import { hashSeed, seededRng } from '../engine/seededRandom';
import { calculatePositionNeeds } from '../engine/draft';

const POS_VALUE = { QB: 1.5, DL: 1.45, WR: 1.35, CB: 1.3, OL: 1.25, LB: 1.15, S: 1.1, TE: 1.05, RB: 0.95, K: 0.5, P: 0.5 };
import { wouldStart } from '../engine/faMarket';
import { teamFit } from '../engine/schemes';

const TEAM_IDS = TEAMS.map(t => t.id);
const TEAM_MAP = new Map(TEAMS.map(t => [t.id, t]));
const abbr = id => TEAM_MAP.get(id)?.abbreviation || String(id).toUpperCase().slice(0, 3);
const teamName = id => TEAM_MAP.get(id) ? `${TEAM_MAP.get(id).location} ${TEAM_MAP.get(id).name}` : id;

export const FRONT_OFFICE_DEFAULTS = { frontOffice: null, scouting: null, college: null };
export const FRONT_OFFICE_FRESH = { frontOffice: null, scouting: null, college: null };

/** The season whose cap a transaction counts against. */
export const capYear = s => (['offseason', 'freeAgency', 'draft'].includes(s.phase) ? s.year + 1 : s.year);
export const deadCapNow = s => s.frontOffice?.deadCap?.[capYear(s)] || 0;
export const draftYearOf = s => s.year + 1;

function defaultFrontOffice(s) {
    return {
        version: 1, teamId: s.userTeamId, inbox: [], gmTrust: {}, gmEras: {}, deadCap: {}, block: [],
        tradeRequests: {}, calmed: {}, holdouts: {}, stagesDone: {}, xfHistory: [], xfSeeded: false,
        camp: null, successorId: null, interviewed: {}, tagged: {}, faVisits: { year: s.year, ids: [], pitch: {} },
        agentGrudge: {}, collegeHistory: [], deadline: null, udfa: null, promises: {}, attended: {}, lastWeekRun: null,
        identities: {},
    };
}

const news = (headline, subtext, icon, teamId, type = 'FRONT_OFFICE') => ({ type, headline, subtext, icon, teamId });

export const frontOfficeActions = (set, get) => ({
    // ── Setup & migration ──────────────────────────────────────────────────
    foEnsure: () => {
        const s = get();
        if (!s.initialized || !s.userTeamId) return;
        const patch = {};
        let fo = s.frontOffice;
        if (!fo || fo.teamId !== s.userTeamId) fo = { ...defaultFrontOffice(s), ...(fo && fo.teamId === s.userTeamId ? fo : {}) };
        if (!s.scouting || s.scouting.teamId !== s.userTeamId) patch.scouting = defaultScouting(s.userTeamId, s.year);
        if (!s.college || s.college.year !== s.year) patch.college = defaultCollege(s.year);
        // Every club holds its next two drafts' picks.
        const dy = draftYearOf(s);
        const owners = s.draftPickOwners || {};
        const needsYears = TEAM_IDS.some(id => !(owners[id] || []).length || (owners[id] || []).some(p => !p.year) || !(owners[id] || []).some(p => p.year === dy + 1));
        if (needsYears && s.phase !== 'draft') patch.draftPickOwners = ensurePickYears(owners, TEAM_IDS, dy);
        if (s.collegePipeline?.length) {
            const migrated = migrateSchools(s.collegePipeline);
            if (migrated !== s.collegePipeline) patch.collegePipeline = migrated;
        }
        if (!fo.xfSeeded && s.rosters && Object.keys(s.rosters).length) {
            const seeded = seedLeagueXFactors(s.rosters, s.year, 10);
            if (seeded !== s.rosters) {
                patch.rosters = seeded;
                const teamRatings = { ...s.teamRatings };
                for (const id of TEAM_IDS) if (seeded[id] !== s.rosters[id]) teamRatings[id] = calculateTeamRatings(seeded[id] || []);
                patch.teamRatings = teamRatings;
            }
            fo = { ...fo, xfSeeded: true };
        }
        fo = { ...fo, identities: allIdentities(s.coachingStaff || [], TEAM_IDS, s.year) };
        patch.frontOffice = fo;
        set(patch);
    },

    /** Refresh derived team identities after staff changes. */
    foRefreshIdentities: () => {
        const s = get();
        if (!s.frontOffice) return;
        set({ frontOffice: { ...s.frontOffice, identities: allIdentities(s.coachingStaff || [], TEAM_IDS, s.year) } });
    },

    foPushInbox: (items) => {
        const s = get();
        if (!items?.length || !s.frontOffice) return;
        set({ frontOffice: { ...s.frontOffice, inbox: pushItems(s.frontOffice.inbox, items, s) } });
    },
    foDismissInbox: (id) => {
        const s = get();
        set({ frontOffice: { ...s.frontOffice, inbox: removeItem(s.frontOffice?.inbox, id) } });
    },

    // ── Weekly loop (called at the end of simulateWeek) ───────────────────
    foAfterWeek: () => {
        get().foEnsure();
        const s = get();
        const fo = s.frontOffice;
        const played = s.phase === 'regular' ? s.week - 1 : 18;
        const stamp = `${s.year}-${played}`;
        if (!fo || fo.lastWeekRun === stamp) return;
        const items = [];
        const headlines = [];
        // 1. College Saturday: results, stories.
        const pipeline = advanceStories(s.collegePipeline || [], s.year, played);
        const college = playCollegeThrough(s.college, pipeline, s.year, played);
        const followed = new Set([...(s.collegeWatchlist || []), ...(s.scouting?.board?.order || [])]);
        const beats = pipeline.filter(p => followed.has(p.id)).flatMap(p => (p.events || []).filter(e => e.year === s.year && e.week === played && !/^Returning|^College career|^Arrived/.test(e.text)).map(e => ({ p, e })));
        for (const { p, e } of beats.slice(0, 2)) items.push(makeItem('college', { key: `college-${p.id}-${s.year}-${played}`, title: `${p.name} · ${p.position}, ${p.school}`, body: eventText(p, e), playerId: p.id, priority: 3, expires: { year: s.year, week: played + 3 } }, s));
        if (played === 14 && college.heisman) {
            const h = pipeline.find(p => p.id === college.heisman);
            if (h) headlines.push(news(`${h.name} wins the Heisman`, `${h.position}, ${h.school}`, '🏆', null, 'COLLEGE'));
        }
        // 2. Scouting assignments.
        const dy = draftYearOf(s);
        const pool = pipeline.filter(p => p.draftYear === dy || p.draftYear === dy + 1);
        const scouting = runAssignments(s.scouting, pool, { week: played, year: s.year });
        let next = { collegePipeline: pipeline, college, scouting };
        let rosters = s.rosters, owners = s.draftPickOwners, teamRatings = s.teamRatings;
        let foNext = { ...fo, lastWeekRun: stamp };
        // X-Factor zone stats from this week's games (levels come from zone TDs).
        if (s.phase === 'regular') {
            const credit = {};
            for (const g of s.schedule?.[played - 1] || []) for (const [id, side, acts, tds] of g.xf || []) {
                const tid = side === 0 ? g.homeTeamId : g.awayTeamId;
                (credit[tid] ||= {})[id] = [acts, tds];
            }
            if (Object.keys(credit).length) {
                rosters = { ...rosters };
                for (const [tid, byId] of Object.entries(credit)) {
                    rosters[tid] = (rosters[tid] || []).map(p => byId[p.id] && p.xFactor ? { ...p, xFactor: { ...p.xFactor, zoneTds: (p.xFactor.zoneTds || 0) + byId[p.id][1], zones: (p.xFactor.zones || 0) + byId[p.id][0] } } : p);
                }
            }
        }
        // 3. The trade market (regular season, before the deadline).
        if (s.phase === 'regular' && played >= 2 && played <= TRADE_DEADLINE_WEEK) {
            const live = { ...s, rosters, draftPickOwners: owners, frontOffice: foNext };
            const deadlineDay = played === TRADE_DEADLINE_WEEK;
            const deals = leagueDeals(live, deadlineDay ? 5 : played % 2 === 0 ? 1 : 0);
            const tickers = [];
            for (const d of deals) {
                const patch = applyLeagueDeal({ ...s, rosters, draftPickOwners: owners }, d);
                rosters = patch.rosters; owners = patch.draftPickOwners;
                teamRatings = { ...teamRatings, [d.buyer]: calculateTeamRatings(rosters[d.buyer]), [d.seller]: calculateTeamRatings(rosters[d.seller]) };
                const text = `${abbr(d.buyer)} acquires ${d.player.name} (${d.player.position} ${d.player.ovr}) from ${abbr(d.seller)} for ${d.picks.map(pickLabel).join(' + ')}.`;
                tickers.push(text);
                headlines.push(news(deadlineDay ? 'Deadline deal' : 'Trade', text, '🔄', d.buyer, 'TRADE'));
            }
            if (deadlineDay) foNext = { ...foNext, deadline: { year: s.year, deals: tickers } };
            const liveAfter = { ...s, rosters, draftPickOwners: owners, teamRatings, frontOffice: foNext };
            // Offers for players on the user's block.
            for (const o of blockOffers(liveAfter, foNext.block || [], 2)) items.push(tradeItem(liveAfter, o.proposal, 'Offer for your block', o.from));
            // Unsolicited calls: a club that values one of your players more than you might.
            const r = seededRng(`calls:${s.year}:${played}`);
            if (r() < 0.35) {
                const caller = TEAM_IDS.filter(t => t !== s.userTeamId)[Math.floor(r() * 31)];
                const mine = (rosters[s.userTeamId] || []).filter(p => p.ovr >= 74 && p.position !== 'QB' && p.position !== 'K');
                const ctx = valueCtx(liveAfter);
                const target = mine.map(p => ({ p, v: perceivedPlayerValue(p, caller, ctx) })).sort((a, b) => b.v - a.v)[Math.floor(r() * Math.min(3, mine.length))];
                if (target) {
                    const pkg = cpuPackage(liveAfter, caller, target.v * 0.97, { avoid: target.p.position });
                    const proposal = pkg && { partner: caller, give: { players: [target.p.id], picks: [] }, get: pkg };
                    if (proposal && evaluateProposal(liveAfter, proposal).ok) items.push(tradeItem(liveAfter, proposal, `${teamName(caller)} is calling about ${target.p.name}`, caller));
                }
            }
            if (played === TRADE_DEADLINE_WEEK - 1) items.push(makeItem('deadline', { key: `deadline-${s.year}`, title: 'Trade deadline next week', body: `After Week ${TRADE_DEADLINE_WEEK}, rosters are frozen until the offseason. Contenders are buying; rebuilders are selling.`, priority: 1, expires: { year: s.year, week: TRADE_DEADLINE_WEEK + 1 } }, s));
        }
        // 4. Trade requests from unhappy players.
        const userRoster = rosters[s.userTeamId] || [];
        const ctx = teamContext({ ...s, rosters }, s.userTeamId);
        const requests = { ...(foNext.tradeRequests || {}) };
        if (s.phase === 'regular') {
            for (const p of userRoster) {
                if (requests[p.id] || (foNext.calmed?.[p.id] === s.year)) continue;
                if (p.ovr < 72) continue;
                const w = wantsOut(p, ctx);
                if (!w.yes) continue;
                requests[p.id] = { reason: w.reason, public: false, week: played, year: s.year };
                items.push(makeItem('tradeRequest', { key: `req-${p.id}`, title: `${p.name} wants a trade`, body: `${w.reason}. He asked you privately. If nothing changes in three weeks, he'll go public and his value drops.`, playerId: p.id, priority: 1,
                    actions: [{ id: 'talk', label: 'Talk to him' }, { id: 'shop', label: 'Shop him quietly' }, { id: 'ignore', label: 'Ignore', tone: 'danger' }] }, s));
                break;
            }
            for (const [id, req] of Object.entries(requests)) {
                if (!req.public && req.year === s.year && played - req.week >= 3 && userRoster.some(p => p.id === id)) {
                    requests[id] = { ...req, public: true };
                    const p = userRoster.find(x => x.id === id);
                    headlines.push(news(`${p.name} requests a trade`, `The ${teamName(s.userTeamId)} ${p.position} went public after weeks of silence.`, '🧳', s.userTeamId, 'LOCKER_ROOM'));
                }
                if (!userRoster.some(p => p.id === id)) delete requests[id];
            }
        }
        foNext = { ...foNext, tradeRequests: requests, inbox: pushItems(foNext.inbox, items, { ...s, week: s.week }) };
        next = { ...next, frontOffice: foNext };
        if (rosters !== s.rosters) next = { ...next, rosters, draftPickOwners: owners, teamRatings };
        if (headlines.length) next.weeklyNews = [...headlines, ...(get().weeklyNews || [])].slice(0, 30);
        set(next);
    },

    // ── Season end: before progression (called first thing in startOffseason)
    foSeasonEnd: () => {
        get().foEnsure();
        const s = get();
        const fo = s.frontOffice;
        if (!fo || fo.seasonEndYear === s.year) return;
        const pass = seasonXFactorPass(s.rosters, { year: s.year, awards: s.seasonRecap?.awards });
        const items = [];
        const headlines = [];
        for (const a of pass.awakened) {
            const p = (pass.rosters[a.teamId] || []).find(x => x.id === a.id);
            const ab = abilityFor(p);
            headlines.push(news(`${a.name} awakens as an X-Factor`, `${teamName(a.teamId)} ${a.position} · ⚡ ${ab?.name}`, '⚡', a.teamId, 'XFACTOR'));
            if (a.teamId === s.userTeamId) items.push(makeItem('xfactor', { key: `xf-${a.id}-${s.year}`, title: `⚡ ${a.name} is an X-Factor`, body: `${ab?.name}: a one-of-a-kind ability. Open his card to see how it works.`, playerId: a.id, priority: 1, actions: [{ id: 'view', label: 'See ability' }] }, s));
        }
        for (const l of pass.lost) headlines.push(news(`${l.name} loses his X-Factor edge`, 'Two quiet seasons: the ability goes dormant.', '💤', l.teamId, 'XFACTOR'));
        const college = playCollegeThrough(s.college, s.collegePipeline || [], s.year, 17);
        const heisman = (s.collegePipeline || []).find(p => p.id === college.heisman) || heismanRace(s.collegePipeline || [], college, s.year)[0];
        const champ = college.champion != null ? SCHOOLS[college.champion]?.name : null;
        const teamRatings = { ...s.teamRatings };
        for (const id of TEAM_IDS) if (pass.rosters[id] !== s.rosters[id]) teamRatings[id] = calculateTeamRatings(pass.rosters[id] || []);
        set({
            rosters: pass.rosters, teamRatings, college,
            weeklyNews: [...headlines, ...(s.weeklyNews || [])].slice(0, 30),
            frontOffice: {
                ...fo, seasonEndYear: s.year,
                staffBefore: (s.coachingStaff || []).filter(c => c.teamId === s.userTeamId && c.role !== 'HC').map(c => ({ id: c.id, role: c.role })),
                xfHistory: [...pass.awakened.map(a => ({ year: s.year, event: 'awakened', ...a })), ...pass.lost.map(a => ({ year: s.year, event: 'dormant', ...a })), ...(fo.xfHistory || [])].slice(0, 80),
                xfCandidates: pass.candidates,
                collegeHistory: [{ year: s.year, champion: champ, heisman: heisman ? { name: heisman.name, position: heisman.position, school: heisman.school } : null }, ...(fo.collegeHistory || [])].slice(0, 20),
                inbox: pushItems(fo.inbox, items, s),
                deadline: null,
            },
        });
    },

    // ── After startOffseason: staff, college moves, contracts, stage ──────
    foAfterOffseason: () => {
        const s = get();
        const fo = s.frontOffice;
        if (!fo || fo.offseasonYear === s.year) return;
        const items = [], headlines = [];
        let coaches = s.coachingStaff || [];
        // Poaching: user coordinators hired as head coaches elsewhere.
        const before = (fo.staffBefore || []).map(x => ({ ...coaches.find(c => c.id === x.id), role: x.role, teamId: s.userTeamId }));
        for (const p of poachedFromUser(before.filter(c => c.id), coaches, s.userTeamId)) {
            items.push(makeItem('poach', { key: `poach-${p.coach.id}`, title: `${teamName(p.newTeamId)} want your ${p.formerRole}`, body: `${p.coach.name} has been offered their head-coaching job. Let him go and your coaching tree grows (and you gain a friendly GM). Block it and an ambitious coach may sour.`, coachId: p.coach.id, data: { formerRole: p.formerRole, newTeamId: p.newTeamId }, priority: 1,
                actions: [{ id: 'letGo', label: 'Let him go' }, { id: 'block', label: 'Block him', tone: 'danger' }], expires: { phase: 'offseason' } }, s));
        }
        // Retirements.
        const ret = retireCoaches(coaches, s.year, s.userTeamId);
        coaches = ret.coaches;
        for (const c of ret.retired.slice(0, 4)) headlines.push(news(`${c.name} retires`, `After ${c.history.length} stops, he heads to the broadcast booth.`, '🎙️', c.formerTeamId, 'COACHING'));
        // CPU vacancies from retirements are refilled from the market.
        for (const t of TEAM_IDS.filter(id => id !== s.userTeamId)) for (const role of ['HC', 'OC', 'DC', 'Assistant']) {
            if (coaches.some(c => c.teamId === t && c.role === role)) continue;
            const hire = coaches.filter(c => !c.teamId && !c.retired).sort((a, b) => (b.reputation || 0) - (a.reputation || 0))[0];
            if (hire) coaches = coaches.map(c => c.id === hire.id ? { ...c, teamId: t, role, history: [...c.history, { year: s.year, teamId: t, role, event: 'Hired after a retirement' }] } : c);
        }
        // Development coach and hidden career trajectories.
        const rosters = { ...s.rosters };
        const dev = coaches.find(c => c.teamId === s.userTeamId && c.role === 'Development');
        if (dev) {
            const r = developmentBoost(rosters[s.userTeamId] || [], coachProfile(dev, s.year).ratings.development, s.year);
            rosters[s.userTeamId] = r.roster;
            if (r.boosted) headlines.push(news(`${dev.name}'s young players take a step`, `${r.boosted} young player${r.boosted === 1 ? '' : 's'} improved an extra point this offseason.`, '🌱', s.userTeamId, 'DEVELOPMENT'));
        }
        for (const id of TEAM_IDS) {
            rosters[id] = (rosters[id] || []).map(p => {
                const t = trajectoryOf(p).id, age = p.age || 26;
                if (t === 'cliff' && age >= 29) return { ...p, ovr: Math.max(40, p.ovr - 1 - (age >= 31 ? 1 : 0)) };
                if (t === 'bloomer' && age >= 25 && age <= 29 && p.ovr < 95) return { ...p, ovr: p.ovr + 1, pot: Math.max(p.pot || p.ovr, p.ovr + 1) };
                return p;
            });
        }
        const teamRatings = {};
        for (const id of TEAM_IDS) teamRatings[id] = calculateTeamRatings(rosters[id] || []);
        // College: early declarations and transfers.
        const moves = offseasonMoves(s.collegePipeline || [], s.year);
        if (moves.declared) headlines.push(news(`${moves.declared} underclassmen declare for the draft`, 'The class just got deeper.', '🎓', null, 'COLLEGE'));
        const followed = new Set([...(s.collegeWatchlist || []), ...(s.scouting?.board?.order || [])]);
        for (const st of moves.stories.filter(x => followed.has(x.id)).slice(0, 3)) items.push(makeItem('college', { title: 'Saturdays', body: st.text, playerId: st.id, priority: 3 }, s));
        // Fifth-year options and holdouts.
        for (const p of rosters[s.userTeamId] || []) {
            if (p.draftPick && p.draftPick <= 32 && (p.contract?.yearsLeft ?? 0) === 1 && !p.contract?.optionDecided && (p.experience ?? 0) >= 3) {
                const price = fifthYearPrice(p, rosters);
                items.push(makeItem('agent', { key: `option-${p.id}`, title: `Fifth-year option: ${p.name}`, body: `Exercise to keep him one more season at $${price}M. Decline and he's in a walk year.`, playerId: p.id, data: { price }, priority: 2, actions: [{ id: 'exercise', label: `Exercise ($${price}M)` }, { id: 'decline', label: 'Decline' }] }, s));
            }
        }
        const holdouts = { ...(fo.holdouts || {}) };
        for (const p of rosters[s.userTeamId] || []) {
            const c = characterFor(p);
            if (!c || p.ovr < 85 || holdouts[p.id]) continue;
            const ask = askingSalary(p);
            if ((p.contract?.salary ?? 2) < ask * 0.55 && c.axes.greed >= 70 && (p.experience ?? 0) >= 3) {
                holdouts[p.id] = { year: s.year + 1, ask };
                items.push(makeItem('holdout', { key: `holdout-${p.id}`, title: `${p.name} is holding out`, body: `Paid $${p.contract?.salary}M against a $${ask}M market. He won't play until he gets a new deal (or reports on his own after four weeks).`, playerId: p.id, priority: 1, actions: [{ id: 'extend', label: 'Open extension talks' }, { id: 'shop', label: 'Shop him' }, { id: 'wait', label: 'Wait him out' }] }, s));
                break;
            }
        }
        const scouting = s.scouting ? { ...s.scouting, interviews: [], visits: [], year: s.year + 1 } : s.scouting;
        set({
            coachingStaff: coaches, rosters, teamRatings, collegePipeline: moves.pipeline, scouting,
            weeklyNews: [...headlines, ...(s.weeklyNews || [])].slice(0, 30),
            frontOffice: { ...fo, offseasonYear: s.year, holdouts, tagged: {}, faVisits: { year: s.year, ids: [], pitch: {} }, identities: allIdentities(coaches, TEAM_IDS, s.year), inbox: pushItems(fo.inbox, items, s) },
        });
    },

    // ── Stages ─────────────────────────────────────────────────────────────
    foCompleteStage: (id) => {
        const s = get();
        if (!s.frontOffice) return;
        set({ frontOffice: markStage(s.frontOffice, s.year, id) });
    },
    /** "Advance": finish the current stage the recommended way. */
    foAdvance: () => {
        const s = get();
        const stage = currentStage(s);
        switch (stage) {
            case 'review': get().foCompleteStage('review'); break;
            case 'resign': get().foApplyResignRecommendations(); get().foCompleteStage('resign'); break;
            case 'combine': get().foRunCombine(); get().startFreeAgency(); get().openFAMarket?.(); break;
            case 'fa': get().finishFreeAgency?.(); break;
            case 'prodays': get().startDraft(); break;
            case 'draft': get().foSimDraft(); break;
            case 'udfa': get().foResolveUdfa(); get().finalizeDraft(); get().foAfterDraft(); break;
            case 'camp': get().foSeeCamp(); break;
            default: break;
        }
        return currentStage(get());
    },

    // ── Re-sign & tag window ───────────────────────────────────────────────
    foExpiring: () => {
        const s = get();
        return (s.freeAgents || []).filter(p => p.previousTeamId === s.userTeamId);
    },
    foResign: (playerId, offer = {}) => {
        const s = get();
        const p = (s.freeAgents || []).find(x => x.id === playerId && x.previousTeamId === s.userTeamId);
        if (!p) return { ok: false, reason: 'He is no longer yours to re-sign.' };
        const stance = contractStance(p, teamContext(s, s.userTeamId));
        if (!stance.willing) return { ok: false, reason: stance.refusal };
        const years = Math.max(1, Math.min(6, Math.round(offer.years || 2)));
        const salary = Math.max(1, Number(offer.salary) || stance.ask);
        const structureBonus = (offer.guaranteePct || 0) * 0.15 + (offer.bonusPct || 0) * 0.05;
        if (salary * (1 + structureBonus) < stance.ask * 0.97) return { ok: false, reason: `${p.name} wants about $${stance.ask}M a year to stay.` };
        const room = SALARY_CAP - rosterSalary(s.rosters[s.userTeamId] || []) - deadCapNow(s);
        if (salary > room) return { ok: false, reason: `Only $${Math.floor(room)}M of cap space.` };
        const contract = structuredContract({ salary, years, guaranteePct: offer.guaranteePct || 0, bonusPct: offer.bonusPct || 0, year: s.year + 1 });
        get().signFreeAgent(playerId, s.userTeamId, contract);
        return { ok: true };
    },
    foTag: (playerId) => {
        const s = get();
        const fo = s.frontOffice;
        if (Object.values(fo?.tagged || {}).length) return { ok: false, reason: 'You have already used your tag this year.' };
        const p = (s.freeAgents || []).find(x => x.id === playerId && x.previousTeamId === s.userTeamId);
        if (!p) return { ok: false, reason: 'He is no longer yours to tag.' };
        const price = tagPrice(s.rosters, p.position, 'franchise');
        const room = SALARY_CAP - rosterSalary(s.rosters[s.userTeamId] || []) - deadCapNow(s);
        if (price > room) return { ok: false, reason: `The tag costs $${price}M; you have $${Math.floor(room)}M.` };
        get().signFreeAgent(playerId, s.userTeamId, { salary: price, years: 1, yearsLeft: 1, type: 'tag', signedYear: s.year + 1 });
        set({ frontOffice: { ...get().frontOffice, tagged: { [playerId]: s.year } } });
        return { ok: true, price };
    },
    foTender: (playerId, tenderId = 'second') => {
        const s = get();
        const p = (s.freeAgents || []).find(x => x.id === playerId && x.previousTeamId === s.userTeamId);
        const t = TENDERS[tenderId];
        if (!p || !t) return { ok: false, reason: 'Unavailable.' };
        if (!isRestricted(p)) return { ok: false, reason: `${p.name} has too many accrued seasons to be restricted.` };
        const price = t.price(p);
        const room = SALARY_CAP - rosterSalary(s.rosters[s.userTeamId] || []) - deadCapNow(s);
        if (price > room) return { ok: false, reason: `The tender costs $${price}M; you have $${Math.floor(room)}M.` };
        get().signFreeAgent(playerId, s.userTeamId, { salary: price, years: 1, yearsLeft: 1, type: 'tender', tender: tenderId, signedYear: s.year + 1 });
        return { ok: true, price };
    },
    /** Recommendation per expiring player: resign | tag | tender | market | release. */
    foResignAdvice: () => {
        const s = get();
        const exp = get().foExpiring();
        let room = SALARY_CAP - rosterSalary(s.rosters[s.userTeamId] || []) - deadCapNow(s) - 12; // keep FA money
        const ranked = [...exp].sort((a, b) => b.ovr - a.ovr);
        return ranked.map(p => {
            const stance = contractStance(p, teamContext(s, s.userTeamId));
            const age = p.age || 27;
            let rec = 'market';
            if (!stance.willing) rec = 'market';
            else if (isRestricted(p) && p.ovr >= 66 && TENDERS.second.price(p) <= room) rec = 'tender';
            else if (p.ovr >= 76 && age <= 30 && stance.ask <= room) rec = 'resign';
            else if (p.ovr < 65 || age >= 33) rec = 'release';
            if (rec === 'resign') room -= stance.ask;
            if (rec === 'tender') room -= TENDERS.second.price(p);
            return { player: p, stance, rec };
        });
    },
    foApplyResignRecommendations: () => {
        for (const a of get().foResignAdvice()) {
            if (a.rec === 'resign') get().foResign(a.player.id, { salary: a.stance.ask, years: a.player.age <= 27 ? 4 : a.player.age <= 30 ? 3 : 1, guaranteePct: 0.3 });
            if (a.rec === 'tender') get().foTender(a.player.id, 'second');
        }
    },

    // ── Scouting ───────────────────────────────────────────────────────────
    foAssignScout: (scoutId, assignment) => {
        const s = get();
        if (!s.scouting) return;
        set({ scouting: { ...s.scouting, assignments: { ...s.scouting.assignments, [scoutId]: assignment } } });
    },
    foAutoAssign: () => {
        const s = get();
        if (!s.scouting) return;
        set({ scouting: { ...s.scouting, assignments: {} } });
    },
    foHireScout: (role, region) => {
        const s = get();
        if (!s.scouting) return { ok: false };
        if ((s.scouting.scouts || []).length >= 8) return { ok: false, reason: 'The department is full (8 scouts).' };
        const id = `sc-${s.userTeamId}-${s.year}-${Date.now().toString(36)}`;
        const prof = scoutProfile(id, role, region);
        const budget = staffBudget(s.owner?.trust ?? 60);
        const payroll = staffPayroll(s.coachingStaff || [], s.userTeamId, s.year, (s.scouting.scouts || []).map(scoutOf));
        if (payroll + prof.salary > budget) return { ok: false, reason: `Over the staff budget ($${budget}M).` };
        set({ scouting: { ...s.scouting, scouts: [...s.scouting.scouts, { id, role, region: region || prof.region }] } });
        return { ok: true, scout: prof };
    },
    foFireScout: (id) => {
        const s = get();
        if (!s.scouting) return;
        set({ scouting: { ...s.scouting, scouts: s.scouting.scouts.filter(x => x.id !== id), assignments: { ...s.scouting.assignments, [id]: undefined } } });
    },
    foVisit: (id) => {
        const next = applyVisit(get().scouting, id);
        if (!next) return { ok: false, reason: `You have used all ${VISIT_SLOTS} private workouts or already hosted him.` };
        set({ scouting: next });
        return { ok: true };
    },
    foInterview: (id) => {
        const next = applyInterview(get().scouting, id);
        if (!next) return { ok: false, reason: `All ${INTERVIEW_SLOTS} interview slots are used, or you already met him.` };
        set({ scouting: next, scoutedProspects: { ...(get().scoutedProspects || {}), [id]: true } });
        return { ok: true };
    },
    foRunCombine: () => {
        get().generateDraftPreview?.();
        const s = get();
        const cls = s.draftClass || [];
        if (!cls.length || !s.scouting) return;
        set({ scouting: applyCombine(s.scouting, cls, s.year) });
        get().foCompleteStage('combine');
    },
    foAttendGame: (home, away) => {
        const s = get();
        const fo = s.frontOffice;
        const key = `${s.year}-${s.week}`;
        if (!fo || fo.attended?.[key]) return { ok: false, reason: 'You already went to a game this week.' };
        const names = [SCHOOLS[home]?.name, SCHOOLS[away]?.name];
        const board = new Set(s.scouting?.board?.order || []);
        const players = (s.collegePipeline || []).filter(p => names.includes(p.school) && s.year < p.draftYear)
            .sort((a, b) => (board.has(b.id) ? 1 : 0) - (board.has(a.id) ? 1 : 0) || (a.draftYear - b.draftYear) || b.readyOvr - a.readyOvr).slice(0, 4);
        set({ scouting: applyAttendance(s.scouting, players.map(p => p.id)), frontOffice: { ...fo, attended: { ...(fo.attended || {}), [key]: [home, away] } } });
        return { ok: true, players };
    },
    foSetBoard: (order) => {
        const s = get();
        if (!s.scouting) return;
        set({ scouting: { ...s.scouting, board: { ...s.scouting.board, order: [...new Set(order)] } } });
    },
    foToggleBoard: (id) => {
        const s = get();
        if (!s.scouting) return;
        const order = s.scouting.board?.order || [];
        set({ scouting: { ...s.scouting, board: { ...s.scouting.board, order: order.includes(id) ? order.filter(x => x !== id) : [...order, id] } } });
    },
    foSetTier: (id, tier) => {
        const s = get();
        if (!s.scouting) return;
        const tiers = { ...(s.scouting.board?.tiers || {}) };
        if (tier) tiers[id] = tier; else delete tiers[id];
        const order = s.scouting.board?.order || [];
        set({ scouting: { ...s.scouting, board: { ...s.scouting.board, tiers, order: order.includes(id) ? order : [...order, id] } } });
    },

    // ── Draft ──────────────────────────────────────────────────────────────
    /** Your best available player by your own board, then your grades. */
    foBestAvailable: () => {
        const s = get();
        const avail = new Set((s.draftClass || []).map(p => p.id));
        const tiers = s.scouting?.board?.tiers || {};
        const onBoard = (s.scouting?.board?.order || []).filter(id => avail.has(id) && tiers[id] !== 'dnd');
        if (onBoard.length) return onBoard[0];
        // No board left: the war room drafts like a sensible GM — your grades,
        // positional value, needs and scarcity (the CPU's own logic).
        const roster = s.rosters[s.userTeamId] || [];
        const needs = calculatePositionNeeds(roster);
        const qb = roster.filter(p => p.position === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
        const round = s.draftOrder?.[s.currentPickIndex]?.round || 1;
        const scored = (s.draftClass || []).filter(p => round >= 5 || !['K', 'P'].includes(p.position)).map(p => {
            const g = userView(p, s.scouting, s.userTeamId).grade;
            const value = (POS_VALUE[p.position] || 1) * (p.position === 'QB' && qb?.ovr >= 72 ? 0.6 : 1);
            return { id: p.id, score: g * value + (needs[p.position] || 50) * 0.35 };
        }).sort((a, b) => b.score - a.score);
        return scored[0]?.id || (s.draftClass || [])[0]?.id || null;
    },
    foUserPick: (prospectId) => {
        const s = get();
        const pick = s.draftOrder?.[s.currentPickIndex];
        if (!pick || pick.teamId !== s.userTeamId) return false;
        const prospect = (s.draftClass || []).find(p => p.id === prospectId);
        if (!prospect) return false;
        const snap = draftSnapshot(prospect, s.scouting, s.userTeamId);
        const more = s.makePick(prospectId);
        const after = get();
        const roster = (after.rosters[s.userTeamId] || []).map(p => p.id === prospectId ? { ...p, scoutedAs: snap } : p);
        set({ rosters: { ...after.rosters, [s.userTeamId]: roster } });
        return more;
    },
    foSimDraft: () => {
        let guard = 0;
        while (get().phase === 'draft' && get().currentPickIndex < (get().draftOrder?.length || 0) && guard++ < 400) {
            const s = get();
            const pick = s.draftOrder[s.currentPickIndex];
            if (pick.teamId === s.userTeamId) { const id = get().foBestAvailable(); if (!id) break; get().foUserPick(id); }
            else get().simOneCpuPick();
        }
    },
    /** UDFA scramble: sign up to `ids` with bonus money; rivals compete. */
    foResolveUdfa: (ids = null, bonus = {}) => {
        const s = get();
        if (s.phase !== 'draft' || s.currentPickIndex < (s.draftOrder?.length || 0)) return null;
        if (s.frontOffice?.udfa?.year === s.year) return s.frontOffice.udfa;
        const room = Math.max(0, 53 - (s.rosters[s.userTeamId] || []).length);
        const pool = [...(s.draftClass || [])].map(p => ({ p, g: userView(p, s.scouting, s.userTeamId).grade })).sort((a, b) => b.g - a.g);
        const wanted = (ids || pool.slice(0, Math.min(3, room)).map(x => x.p.id)).slice(0, room);
        const signed = [], lost = [];
        let rosters = s.rosters;
        for (const id of wanted) {
            const p = (s.draftClass || []).find(x => x.id === id);
            if (!p) continue;
            const rank = pool.findIndex(x => x.p.id === id);
            const b = Math.max(0, Math.min(0.5, Number(bonus[id]) || 0));
            const chance = Math.min(0.95, 0.45 + b * 1.1 + (rank > 30 ? 0.25 : rank > 10 ? 0.1 : 0) + ((s.collegeWatchlist || []).includes(id) ? 0.1 : 0));
            if (seededRng(`udfa:${id}:${s.year}`)() < chance) {
                const rookie = { ...p, teamId: s.userTeamId, experience: 0, isUndrafted: true, draftYear: s.year + 1, contract: { salary: 1 + b, years: 2, yearsLeft: 2, type: 'rookie', bonus: b } , scoutedAs: draftSnapshot(p, s.scouting, s.userTeamId) };
                rosters = { ...rosters, [s.userTeamId]: [...rosters[s.userTeamId], rookie] };
                signed.push({ id, name: p.name, position: p.position });
            } else lost.push({ id, name: p.name, position: p.position, to: TEAM_IDS[hashSeed(`udfaTo:${id}`) % 32] });
        }
        const signedIds = new Set(signed.map(x => x.id));
        const udfa = { year: s.year, signed, lost };
        set({ rosters, teamRatings: { ...s.teamRatings, [s.userTeamId]: calculateTeamRatings(rosters[s.userTeamId]) }, draftClass: (s.draftClass || []).filter(p => !signedIds.has(p.id)), frontOffice: { ...s.frontOffice, udfa } });
        return udfa;
    },
    /** After finalizeDraft: camp reveal for the rookies you scouted. */
    foAfterDraft: () => {
        const s = get();
        const fo = s.frontOffice;
        if (!fo) return;
        const rookies = (s.rosters[s.userTeamId] || []).filter(p => p.scoutedAs && p.draftYear === s.year && !p.revealed);
        if (!rookies.length) return;
        const reveals = rookies.map(p => ({ id: p.id, name: p.name, position: p.position, draftPick: p.draftPick || null, ...p.scoutedAs, actual: p.ovr, ...revealVerdict(p.scoutedAs, p.ovr) }));
        const scouting = s.scouting ? { ...s.scouting, hitRates: recordHits(s.scouting.hitRates, reveals) } : s.scouting;
        const roster = (s.rosters[s.userTeamId] || []).map(p => rookies.some(r => r.id === p.id) ? { ...p, revealed: true } : p);
        set({ scouting, rosters: { ...s.rosters, [s.userTeamId]: roster }, frontOffice: { ...fo, camp: { year: s.year, reveals, seen: false } } });
    },
    foSeeCamp: () => {
        const fo = get().frontOffice;
        if (fo?.camp) set({ frontOffice: { ...fo, camp: { ...fo.camp, seen: true } } });
    },
    /** Compensatory picks from this year's free-agent market (called by startDraft). */
    foCompPicks: () => {
        const s = get();
        const dy = draftYearOf(s);
        const log = (s.faMarket?.log || []).map(r => ({ ...r, from: r.from }));
        const comp = compPicks(log, dy);
        if (!Object.keys(comp).length) return;
        const owners = { ...s.draftPickOwners };
        for (const [teamId, picks] of Object.entries(comp)) {
            const have = new Set((owners[teamId] || []).filter(p => p.comp && p.year === dy).map(p => `${p.round}:${p.comp}`));
            owners[teamId] = [...(owners[teamId] || []), ...picks.filter(p => !have.has(`${p.round}:${p.comp}`))];
        }
        const mine = comp[s.userTeamId];
        const extra = mine ? [news(`You receive ${mine.length} compensatory pick${mine.length === 1 ? '' : 's'}`, mine.map(pickLabel).join(', '), '🎟️', s.userTeamId, 'DRAFT')] : [];
        set({ draftPickOwners: owners, weeklyNews: [...extra, ...(s.weeklyNews || [])].slice(0, 30) });
    },

    // ── Trades ─────────────────────────────────────────────────────────────
    foProposeTrade: (proposal) => {
        const s = get();
        const tradesOpen = ['offseason', 'freeAgency', 'draft'].includes(s.phase) || (s.phase === 'regular' && s.week <= TRADE_DEADLINE_WEEK);
        if (!tradesOpen) return { ok: false, evaluation: null, reason: 'The trade deadline has passed.' };
        const evaluation = evaluateProposal(s, proposal);
        if (!evaluation.ok) return { ok: false, evaluation, counter: counterOffer(s, proposal) };
        get().foExecuteProposal(proposal, evaluation);
        return { ok: true, evaluation };
    },
    foExecuteProposal: (proposal, evaluation) => {
        const s = get();
        const patch = applyProposal(s, proposal, evaluation);
        const teamRatings = { ...s.teamRatings, [s.userTeamId]: calculateTeamRatings(patch.rosters[s.userTeamId]), [proposal.partner]: calculateTeamRatings(patch.rosters[proposal.partner]) };
        const describe = (players, picks) => [...players.map(p => `${p.name} (${p.position})`), ...picks.map(pickLabel)].join(', ') || 'nothing';
        const text = `${abbr(s.userTeamId)} send ${describe(patch.outgoing, proposal.give?.picks || [])} to ${abbr(proposal.partner)} for ${describe(patch.incoming, proposal.get?.picks || [])}.`;
        const requests = { ...(patch.frontOffice.tradeRequests || {}) };
        patch.outgoing.forEach(p => delete requests[p.id]);
        const block = (patch.frontOffice.block || []).filter(id => !patch.outgoing.some(p => p.id === id));
        const onClock = s.phase === 'draft' ? { onClockTeamId: patch.draftOrder?.[s.currentPickIndex]?.teamId || s.onClockTeamId } : {};
        set({
            rosters: patch.rosters, draftPickOwners: patch.draftPickOwners, teamRatings,
            ...(s.phase === 'draft' ? { draftOrder: patch.draftOrder, ...onClock } : {}),
            frontOffice: { ...patch.frontOffice, tradeRequests: requests, block },
            tradeHistory: [{ id: `fo-${Date.now()}`, year: s.year, week: s.week, from: s.userTeamId, to: proposal.partner, text }, ...(s.tradeHistory || [])].slice(0, 100),
            weeklyNews: [news('Trade completed', text, '🔄', s.userTeamId, 'TRADE'), ...(s.weeklyNews || [])].slice(0, 30),
        });
        if (patch.outgoing.length) get().applyTradeFallout?.(patch.outgoing);
    },
    foToggleBlock: (id) => {
        const s = get();
        const fo = s.frontOffice;
        if (!fo) return;
        const block = fo.block || [];
        set({ frontOffice: { ...fo, block: block.includes(id) ? block.filter(x => x !== id) : [...block, id].slice(-6) } });
    },

    // ── Contracts ──────────────────────────────────────────────────────────
    /** Called by cutPlayer: guaranteed money and bonus proration hit the cap. */
    foChargeCut: (player) => {
        const s = get();
        const fo = s.frontOffice;
        if (!fo || !player) return 0;
        const dead = deadMoney(player);
        if (!dead) return 0;
        set({ frontOffice: { ...fo, deadCap: chargeDeadCap(fo.deadCap, capYear(s), dead) } });
        return dead;
    },

    // ── FA visits & pitch ──────────────────────────────────────────────────
    foFAVisit: (faId) => {
        const s = get();
        const fo = s.frontOffice;
        const v = fo?.faVisits?.year === s.year ? fo.faVisits : { year: s.year, ids: [], pitch: {} };
        if (v.ids.includes(faId)) return { ok: true };
        if (v.ids.length >= 3) return { ok: false, reason: 'You can host three visits on the opening day of free agency.' };
        if ((s.faMarket?.day || 0) > 0) return { ok: false, reason: 'Visits happen on opening day.' };
        set({ frontOffice: { ...fo, faVisits: { ...v, ids: [...v.ids, faId] } } });
        return { ok: true };
    },
    foSetPitch: (faId, points) => {
        const s = get();
        const fo = s.frontOffice;
        const v = fo?.faVisits?.year === s.year ? fo.faVisits : { year: s.year, ids: [], pitch: {} };
        set({ frontOffice: { ...fo, faVisits: { ...v, pitch: { ...v.pitch, [faId]: points.slice(0, 2) } } } });
    },
    /** Visit + pitch → acceptance bonus/penalty per player, read by the market. */
    foFAExtras: () => {
        const s = get();
        const v = s.frontOffice?.faVisits;
        if (!v || v.year !== s.year) return {};
        const out = {};
        for (const id of v.ids) {
            const p = (s.freeAgents || []).find(x => x.id === id);
            if (!p) continue;
            const pitch = v.pitch?.[id] || [];
            let bonus = 0.03;
            const notes = ['you hosted his visit'];
            for (const point of pitch) {
                const truth = pitchTruth(s, p, point);
                bonus += truth ? 0.035 : -0.04;
                notes.push(truth ? `${PITCHES[point].label} rang true` : `${PITCHES[point].label} didn't hold up`);
            }
            out[id] = { bonus, notes };
        }
        return out;
    },

    // ── Staff ──────────────────────────────────────────────────────────────
    foInterviewCoach: (coachId) => {
        const s = get();
        const fo = s.frontOffice;
        const count = Object.values(fo?.interviewed || {}).filter(y => y === s.year).length;
        if (fo?.interviewed?.[coachId] === s.year) return { ok: true };
        if (count >= 5) return { ok: false, reason: 'Five interviews per offseason.' };
        set({ frontOffice: { ...fo, interviewed: { ...(fo.interviewed || {}), [coachId]: s.year } } });
        return { ok: true };
    },
    foHireCoach: (coachId, role) => {
        const s = get();
        if (!USER_ROLES.includes(role)) return { ok: false, reason: 'Unknown role.' };
        if ((s.coachingStaff || []).some(c => c.teamId === s.userTeamId && c.role === role)) return { ok: false, reason: 'Fire the current coach before filling this role.' };
        const c = (s.coachingStaff || []).find(x => x.id === coachId && !x.teamId && !x.retired);
        if (!c) return { ok: false, reason: 'This coach is no longer available.' };
        const prof = coachProfile({ ...c, role }, s.year);
        const budget = staffBudget(s.owner?.trust ?? 60);
        const payroll = staffPayroll(s.coachingStaff || [], s.userTeamId, s.year, (s.scouting?.scouts || []).map(scoutOf));
        if (payroll + prof.salary > budget) return { ok: false, reason: `His $${prof.salary}M salary puts you over the $${budget}M staff budget.` };
        // Rival clubs are hiring too: a coach you haven't interviewed may take another job.
        const hc = s.coachingStaff.find(x => x.teamId === s.userTeamId && x.role === 'HC');
        const coachingStaff = s.coachingStaff.map(x => x.id === coachId ? { ...x, teamId: s.userTeamId, role, contract: { salary: prof.salary, years: 3 }, mentorId: x.mentorId || (x.history?.some(h => h.role === 'HC') ? null : hc?.id), history: [...(x.history || []), { year: s.year, teamId: s.userTeamId, role, event: 'Hired' }] } : x);
        set({ coachingStaff, franchiseStories: [{ year: s.year, kind: 'Coaching', text: `${c.name} joins your staff as ${role}.` }, ...(s.franchiseStories || [])].slice(0, 300) });
        get().foRefreshIdentities();
        return { ok: true };
    },
    /** Weekly prep: scheme for one opposing X-Factor this week (null to clear). */
    foSchemeFor: (playerId) => {
        const s = get();
        set({ frontOffice: { ...s.frontOffice, schemeFor: playerId ? { year: s.year, week: s.week, playerId } : null } });
    },
    foSetSuccessor: (coachId) => {
        const fo = get().frontOffice;
        set({ frontOffice: { ...fo, successorId: fo.successorId === coachId ? null : coachId } });
    },

    // ── Inbox actions ──────────────────────────────────────────────────────
    foResolveInbox: (itemId, actionId) => {
        const s = get();
        const fo = s.frontOffice;
        const item = (fo?.inbox || []).find(i => i.id === itemId);
        if (!item) return { ok: false, reason: 'That item is gone.' };
        const done = (extra = {}, result = { ok: true }) => { set({ frontOffice: { ...get().frontOffice, ...extra, inbox: removeItem(get().frontOffice.inbox, itemId) } }); return result; };
        switch (item.kind) {
            case 'trade': {
                if (actionId === 'decline') return done();
                const r = get().foProposeTrade(item.data.proposal);
                if (!r.ok) return done({}, { ok: false, reason: r.reason || r.evaluation?.problems?.[0] || 'The deal fell through: their situation changed.' });
                return done();
            }
            case 'poach': {
                if (actionId === 'block') {
                    const coaches = blockPoach(s.coachingStaff, item.coachId, s.userTeamId, item.data.formerRole, s.year).map(c => {
                        if (c.id !== item.coachId) return c;
                        const ambitious = coachProfile(c, s.year).traits.includes('ambitious');
                        return ambitious ? { ...c, reputation: Math.max(20, (c.reputation || 50) - 4), disgruntled: s.year } : c;
                    });
                    set({ coachingStaff: coaches, morale: Math.max(0, (s.morale ?? 50) - 2) });
                    get().foRefreshIdentities();
                    return done();
                }
                const trust = { ...(fo.gmTrust || {}), [item.data.newTeamId]: Math.min(100, (fo.gmTrust?.[item.data.newTeamId] ?? 50) + 15) };
                get().foRefreshIdentities();
                return done({ gmTrust: trust });
            }
            case 'tradeRequest': {
                const requests = { ...(fo.tradeRequests || {}) };
                if (actionId === 'talk') {
                    // A sit-down buys the season if he isn't too far gone.
                    const p = (s.rosters[s.userTeamId] || []).find(x => x.id === item.playerId);
                    const ok = p && seededRng(`talk:${p.id}:${s.year}`)() < 0.6;
                    if (ok) { delete requests[item.playerId]; return done({ tradeRequests: requests, calmed: { ...(fo.calmed || {}), [item.playerId]: s.year } }, { ok: true, message: `${p.name} agreed to table it for the season.` }); }
                    return done({ tradeRequests: requests }, { ok: false, reason: 'The talk did not go well. He still wants out.' });
                }
                if (actionId === 'shop') return done({ block: [...new Set([...(fo.block || []), item.playerId])] });
                return done();
            }
            case 'holdout': {
                const holdouts = { ...(fo.holdouts || {}) };
                if (actionId === 'shop') return done({ block: [...new Set([...(fo.block || []), item.playerId])] });
                if (actionId === 'extend') {
                    const p = (s.rosters[s.userTeamId] || []).find(x => x.id === item.playerId);
                    if (!p) return done();
                    const r = s.resignPlayer(s.userTeamId, p.id, askingSalary(p), 4);
                    if (r.accepted) { delete holdouts[p.id]; return done({ holdouts }, { ok: true, message: `${p.name} signed a four-year extension and reports to camp.` }); }
                    return { ok: false, reason: r.reason };
                }
                return done();
            }
            case 'agent': {
                if (item.key?.startsWith('option-')) {
                    const rosters = { ...s.rosters };
                    rosters[s.userTeamId] = rosters[s.userTeamId].map(p => {
                        if (p.id !== item.playerId) return p;
                        if (actionId === 'exercise') return { ...p, contract: { ...p.contract, salary: item.data.price, yearsLeft: (p.contract?.yearsLeft || 1) + 1, years: (p.contract?.years || 4) + 1, optionDecided: 'exercised' } };
                        return { ...p, contract: { ...p.contract, optionDecided: 'declined' } };
                    });
                    set({ rosters });
                }
                return done();
            }
            default: return done();
        }
    },

    // ── Read helpers for the UI ────────────────────────────────────────────
    foTeamMode: (teamId) => teamMode(teamId, valueCtx(get())),
    foCollegeGamesThisWeek: () => {
        const s = get();
        const w = s.phase === 'regular' ? s.week : 1;
        return weekGames(s.year, w);
    },
    foIsXF: (player) => isActiveXF(player),
    foSchool: (name) => schoolByName(name),
});

// ── helpers ─────────────────────────────────────────────────────────────────
function tradeItem(state, proposal, title, from) {
    const get = proposal.get || {};
    const players = (get.players || []).map(id => (state.rosters[from] || []).find(p => p.id === id)).filter(Boolean);
    const give = (proposal.give?.players || []).map(id => (state.rosters[state.userTeamId] || []).find(p => p.id === id)).filter(Boolean);
    const body = `They send ${[...players.map(p => `${p.name} (${p.position} ${p.ovr})`), ...(get.picks || []).map(pickLabel)].join(', ')} for ${give.map(p => `${p.name} (${p.position} ${p.ovr})`).join(', ')}.`;
    return makeItem('trade', { key: `trade-${from}-${give.map(p => p.id).join('+')}`, title, body, teamId: from, data: { proposal }, priority: 2,
        actions: [{ id: 'accept', label: 'Accept' }, { id: 'decline', label: 'Decline' }], expires: { year: state.year, week: state.week + 1, phase: 'regular' } }, state);
}

export const PITCHES = {
    contender: { id: 'contender', label: 'We are contenders', blurb: 'True if your team is contending or winning.' },
    scheme: { id: 'scheme', label: 'You fit our scheme', blurb: 'True if he fits your coordinators\' scheme.' },
    starter: { id: 'starter', label: 'You will start', blurb: 'A promise: he expects to start.' },
    coach: { id: 'coach', label: 'Our coaching staff', blurb: 'True if your staff has a strong reputation.' },
    hometown: { id: 'hometown', label: 'Come home', blurb: 'True if he grew up near your city.' },
};
function pitchTruth(s, p, point) {
    switch (point) {
        case 'contender': return teamMode(s.userTeamId, valueCtx(s)) === 'contend';
        case 'scheme': return teamFit(p, s.frontOffice?.identities?.[s.userTeamId]) >= 72;
        case 'starter': return wouldStart(p, s.rosters[s.userTeamId] || []);
        case 'coach': return (s.coachingStaff || []).filter(c => c.teamId === s.userTeamId).reduce((n, c) => n + (c.reputation || 50), 0) / Math.max(1, (s.coachingStaff || []).filter(c => c.teamId === s.userTeamId).length) >= 60;
        case 'hometown': {
            const home = characterFor(p)?.hometown || '';
            const city = TEAM_MAP.get(s.userTeamId)?.location || '';
            return !!city && home.includes(city);
        }
        default: return false;
    }
}
