import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { PLAYBOOK_MAP } from '../data/playbooks';
import { getCoachLevel, getCoachXpToNext } from '../engine/progression';

import WeekLoadingScreen from '../components/WeekLoadingScreen';
import GameBroadcast from '../components/GameBroadcast';
import { usePreference, SIM_SPEEDS } from '../components/preferences';
import MatchupPreview from '../components/MatchupPreview';
import WeeklyPreparation from '../components/WeeklyPreparation';
import StorylinePopup from '../components/StorylinePopup';
import WaiverWireModal from '../components/WaiverWireModal';
import StoryEventModal from '../components/StoryEventModal';
import { OwnerCard } from '../components/OwnerOffice';
import FranchiseLoreCard from '../components/FranchiseLore';
import { teamContext, wantsOut, contractStance } from '../engine/character';
import LeagueNewsPanel from '../components/LeagueNewsPanel';
import { Card, CardHeader, PageHeader, Button, Modal, Tabs } from '../components/ui';
import { PHASE_LABELS } from '../navigation';

import HeroMatchup from './hub/HeroMatchup';
import Inbox from './hub/Inbox';
import GameSummaryModal from './hub/GameSummaryModal';
import {
  getWeekObjectives, getRosterGrades, getCapSummary,
  getConferenceRace, getDivisionTable, getTeamLeaders,
} from './hub/hubData';
import {
  StatusStrip, DivisionCard, RosterGradesCard,
  ObjectivesCard, TeamLeadersCard, LastScoresCard, PlayerOfWeekCard,
  PlayoffRaceCard, FranchiseRecordsCard, SeasonHistoryCard,
} from './hub/widgets';

const DECK_TABS = [
  { id: 'team', label: 'My team' },
  { id: 'league', label: 'Around the league' },
  { id: 'legacy', label: 'Franchise legacy' },
];

/**
 * The Franchise Hub.
 *
 * Replaces a 15-widget react-grid-layout in which eight widgets were empty
 * placeholders on a fresh save and the primary action sat below the fold.
 * This is a fixed, art-directed layout: the game you are about to play is the
 * hero, alerts are consolidated into one inbox, and every secondary widget
 * hides itself until it has something to say.
 */
export default function HomeHub({ onNavigate, pendingIntent, onIntentHandled }) {
  // ── Store ────────────────────────────────────────────────────────────────
  const year = useGameStore(s => s.year);
  const coachingStaff = useGameStore(s => s.coachingStaff);
  const assistantLog = useGameStore(s => s.assistantLog);
  const collegePipeline = useGameStore(s => s.collegePipeline);
  const collegeWatchlist = useGameStore(s => s.collegeWatchlist);
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.week);
  const phase = useGameStore(s => s.phase);
  const userTeamId = useGameStore(s => s.userTeamId);
  const standings = useGameStore(s => s.standings);
  const schedule = useGameStore(s => s.schedule);
  const lastDismissedGameId = useGameStore(s => s.lastDismissedGameId);
  const injuries = useGameStore(s => s.injuries);
  const simulateWeek = useGameStore(s => s.simulateWeek);
  const simulateToWeek = useGameStore(s => s.simulateToWeek);
  const teamRatings = useGameStore(s => s.teamRatings);
  const userPlaybookId = useGameStore(s => s.userPlaybookId);
  const rosters = useGameStore(s => s.rosters);
  const waiverWireRaw = useGameStore(s => s.waiverWire);
  const seasonHistory = useGameStore(s => s.seasonHistory);
  const coach = useGameStore(s => s.coach);
  const playerOfWeek = useGameStore(s => s.playerOfWeek);
  const seasonGoalMet = useGameStore(s => s.seasonGoalMet);
  const coachXp = useGameStore(s => s.coachXp) || 0;
  const pendingStoryEvent = useGameStore(s => s.pendingStoryEvent);
  const resolveStoryEvent = useGameStore(s => s.resolveStoryEvent);
  const dismissStoryEvent = useGameStore(s => s.dismissStoryEvent);
  const devTrainingDone = useGameStore(s => s.devTrainingDone);
  const pendingTradeOffer = useGameStore(s => s.pendingTradeOffer);
  const acceptTradeOffer = useGameStore(s => s.acceptTradeOffer);
  const declineTradeOffer = useGameStore(s => s.declineTradeOffer);
  const storylineQueue = useGameStore(s => s.storylineQueue);
  const dismissStorylines = useGameStore(s => s.dismissStorylines);
  const franchiseRecords = useGameStore(s => s.franchiseRecords) || {};
  const morale = useGameStore(s => s.morale) ?? 50;
  const lastWeekScores = useGameStore(s => s.lastWeekScores) || [];

  // ── Local UI state ───────────────────────────────────────────────────────
  const [storyCursor, setStoryCursor] = useState(0);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showStoryEvent, setShowStoryEvent] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simWeekDisplay, setSimWeekDisplay] = useState(1);
  const [simRealScores, setSimRealScores] = useState(null);
  const [simStretch, setSimStretch] = useState(null);
  // 'watch' = the user's game as a live broadcast; 'board' = league scoreboard
  const [simMode, setSimMode] = useState('board');
  const simSpeed = usePreference('simSpeed');
  const [matchupOpen, setMatchupOpen] = useState(false);
  const [deck, setDeck] = useState('team');

  const teamData = TEAMS.find(t => t.id === userTeamId);
  const userStanding = standings[userTeamId];
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  const record = userStanding ? `${userStanding.wins}-${userStanding.losses}` : '0-0';

  // ── Derived data ─────────────────────────────────────────────────────────
  const nextGame = useMemo(() => {
    if (phase !== 'regular') return null;
    return schedule[week - 1]?.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) ?? null;
  }, [schedule, week, userTeamId, phase]);

  const oppTeamId = nextGame ? (nextGame.homeTeamId === userTeamId ? nextGame.awayTeamId : nextGame.homeTeamId) : null;
  const oppTeam = TEAMS.find(t => t.id === oppTeamId);
  const oppStanding = standings[oppTeamId];

  const objectives = useMemo(() => getWeekObjectives(week), [week]);
  const grades = useMemo(() => getRosterGrades(rosters, userTeamId), [rosters, userTeamId]);
  const cap = useMemo(() => getCapSummary(rosters, userTeamId), [rosters, userTeamId]);
  const division = useMemo(() => getDivisionTable(standings, teamData, userTeamId), [standings, teamData, userTeamId]);
  const race = useMemo(() => getConferenceRace(standings, teamData, userTeamId), [standings, teamData, userTeamId]);
  const leaders = useMemo(
    () => (phase === 'regular' && week >= 2 ? getTeamLeaders(rosters, userTeamId) : []),
    [rosters, userTeamId, phase, week],
  );

  const winProbability = useMemo(() => {
    const u = teamRatings?.[userTeamId]?.overall ?? 75;
    const o = teamRatings?.[oppTeamId]?.overall ?? 75;
    return Math.max(10, Math.min(90, Math.round(50 + (u - o) * 1.8)));
  }, [teamRatings, userTeamId, oppTeamId]);

  const coachLevel = getCoachLevel(coachXp);
  const xpInfo = getCoachXpToNext(coachXp);
  const activePlaybook = PLAYBOOK_MAP[userPlaybookId] ?? PLAYBOOK_MAP['pro-style'] ?? { name: 'Playbook' };
  const userRoster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const userInjuries = (injuries || []).filter(i => i.teamId === userTeamId);
  const expiringPlayers = useMemo(
    () => (phase === 'regular'
      ? userRoster.filter(p => (p.contract?.yearsLeft ?? 1) <= 1).sort((a, b) => b.ovr - a.ovr)
      : []),
    [phase, userRoster],
  );

  // ── Storyline queue ──────────────────────────────────────────────────────
  // A bulk sim can enqueue a dozen storylines; showing them all as blocking
  // dialogs is miserable. Keep the two most recent for the user's team plus
  // one league headline, and page through them with a cursor rather than
  // copying the queue into component state.
  const storylines = useMemo(() => {
    if (!storylineQueue?.length) return [];
    const mine = storylineQueue.filter(s => s.teamId === userTeamId);
    const others = storylineQueue.filter(s => s.teamId !== userTeamId).slice(0, 1);
    return [...mine.slice(-2), ...others].slice(-3);
  }, [storylineQueue, userTeamId]);

  const currentStoryline = storylines[storyCursor] ?? null;
  const remainingStorylines = Math.max(0, storylines.length - storyCursor - 1);

  const handleDismissStoryline = () => {
    if (remainingStorylines > 0) {
      setStoryCursor(c => c + 1);
    } else {
      setStoryCursor(0);
      dismissStorylines?.();
    }
  };
  const handleDismissAllStorylines = () => {
    setStoryCursor(0);
    dismissStorylines?.();
  };

  // ── Last game result ─────────────────────────────────────────────────────
  // Fully derived. Closing the summary calls dismissGameSummary(id), which
  // updates lastDismissedGameId in the store and makes this evaluate to null —
  // so there is no duplicated state to keep in sync via an effect.
  const gameResult = useMemo(() => {
    const prevIdx = week - 2;
    if (prevIdx < 0) return null;
    const g = schedule[prevIdx]?.find(x => x.homeTeamId === userTeamId || x.awayTeamId === userTeamId);
    return g?.played && g.id !== lastDismissedGameId ? g : null;
  }, [week, schedule, userTeamId, lastDismissedGameId]);

  const completedObjectives = useMemo(() => {
    if (!gameResult) return [];
    return getWeekObjectives(gameResult.week || Math.max(1, week - 1))
      .filter(o => o.cond(gameResult, userTeamId))
      .map(o => o.id);
  }, [gameResult, week, userTeamId]);

  // ── Simulation ───────────────────────────────────────────────────────────
  const triggerSim = useCallback((targetWeek, mode = 'board') => {
    const from = week;
    const target = targetWeek ?? week;
    // Always simulate first, then show the loading screen with the real
    // results. Multi-week runs used to show invented scores and only
    // simulate once the animation ended.
    if (target === from) simulateWeek();
    else simulateToWeek(target);

    const state = useGameStore.getState();
    const played = state.schedule || [];
    const userGame = (w) => (played[w - 1] || []).find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);
    const lastWeek = Math.max(from, Math.min(target, state.phase === 'regular' ? state.week - 1 : target));
    const scoresFor = (w) => (played[w - 1] || []).map(g => (g.played ? [g.awayScore, g.homeScore] : null));

    const stretch = [];
    for (let w = from; w <= lastWeek; w++) {
      const g = userGame(w);
      if (!g?.played) { stretch.push({ week: w, result: null }); continue; }
      const home = g.homeTeamId === userTeamId;
      const u = home ? g.homeScore : g.awayScore, o = home ? g.awayScore : g.homeScore;
      stretch.push({ week: w, result: u > o ? 'W' : u < o ? 'L' : 'T', score: `${u}-${o}` });
    }

    setSimWeekDisplay(lastWeek);
    setSimRealScores(scoresFor(lastWeek));
    setSimStretch(stretch);
    // A broadcast needs a single week and a game with its play-by-play.
    setSimMode(mode === 'watch' && lastWeek === from && userGame(lastWeek)?.pbp ? 'watch' : 'board');
    setSimLoading(true);
  }, [week, simulateWeek, simulateToWeek, userTeamId]);

  const broadcastGame = simLoading && simMode === 'watch'
    ? (schedule[simWeekDisplay - 1] || []).find(g => (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) && g.pbp) ?? null
    : null;

  const handleLoadingComplete = useCallback(() => {
    setSimLoading(false);
    setSimRealScores(null);
    setSimStretch(null);
  }, []);

  // The nav's primary button routes here carrying a `sim` intent. Deriving the
  // open state from it (rather than mirroring it into state via an effect)
  // means the preview is open on the very first render after navigation.
  const showMatchupPreview =
    matchupOpen || (pendingIntent === 'sim' && phase === 'regular' && !!nextGame && !nextGame.played);

  const closeMatchup = useCallback(() => {
    setMatchupOpen(false);
    onIntentHandled?.();
  }, [onIntentHandled]);

  const closeSummary = () => {
    if (gameResult) useGameStore.getState().dismissGameSummary(gameResult.id);
  };

  const handleOffseasonPrimary = () => {
    if (phase === 'playoffs') return onNavigate('playoffs');
    if (phase === 'draft') return onNavigate('draft');
    if (phase === 'offseason') { useGameStore.getState().startFreeAgency(); return onNavigate('freeAgency'); }
    if (phase === 'freeAgency') return onNavigate('freeAgency');
    return undefined;
  };

  // Any deliberately-opened overlay suppresses the passive storyline queue.
  const anotherOverlayOpen =
    showMatchupPreview || simLoading ||
    showWaiverModal || showStoryEvent || showTradeModal || !!gameResult;

  const primaryLabel =
    phase === 'playoffs' ? 'Enter the playoffs' :
    phase === 'draft' ? 'Enter the draft room' :
    phase === 'freeAgency' ? 'Open free agency' :
    phase === 'offseason' ? 'Start the offseason' : 'Continue';

  // ── Inbox items — what used to be five stacked banners ───────────────────
  const inboxItems = useMemo(() => {
    const items = [];
    const vacancies = coachingStaff?.length ? ['OC', 'DC', 'Assistant'].filter(role => !coachingStaff.some(c => c.teamId === userTeamId && c.role === role)) : [];
    if (vacancies.length) items.push({ id: 'staff', priority: 85, tone: 'warning', title: `Coaching vacancies: ${vacancies.join(', ')}`, body: 'Your coaching tree is changing. Appoint replacements to restore their game-day contributions.', tag: 'Staff', action: 'Hire coaches', onAction: () => onNavigate('staff') });
    const report = assistantLog?.[0];
    if (report && report.year === year) items.push({ id: 'assistant-report', priority: report.notices.length ? 55 : 25, tone: report.notices.length ? 'warning' : 'good', title: report.notices.length ? 'Your assistants need your judgment' : 'Your assistants completed their work', body: `${report.reports.length} transactions · ${report.notices.length} decisions left for you`, tag: 'Assistants', action: 'Read report', onAction: () => onNavigate('assistants') });
    const campusEvent = (collegePipeline || []).filter(p => collegeWatchlist?.includes(p.id)).flatMap(p => p.events.filter(e => e.year === year && e.week > 1).map(e => ({ ...e, name: p.name }))).sort((a,b) => b.week-a.week)[0];
    if (campusEvent) items.push({ id: 'campus', priority: 35, tone: 'info', title: `${campusEvent.name}: campus update`, body: campusEvent.text, tag: 'College', action: 'Read journal', onAction: () => onNavigate('journal') });
    if (userInjuries.length) {
      items.push({
        id: 'injuries', priority: 90, tone: 'urgent',
        title: `${userInjuries.length} player${userInjuries.length === 1 ? '' : 's'} injured`,
        body: userInjuries.map(i => `${i.playerName} (${i.position}) — ${i.type}, ${i.weeksRemaining}wk`).join(' · '),
        tag: 'Injury', action: 'Roster', onAction: () => onNavigate('roster'),
      });
    }
    if (pendingTradeOffer) {
      const from = TEAMS.find(t => t.id === pendingTradeOffer.fromTeamId);
      const want = pendingTradeOffer.give.find(i => i.type === 'player');
      const offer = pendingTradeOffer.receive.filter(i => i.type === 'player');
      items.push({
        id: 'trade', priority: 80, tone: 'info',
        title: `Trade offer from ${from?.location ?? 'a rival'}`,
        body: `They want ${want?.name ?? 'a player'} for ${offer.map(p => p.name).join(', ') || 'picks'}.`,
        tag: 'Trade', action: 'Review', onAction: () => setShowTradeModal(true),
      });
    }
    if (pendingStoryEvent && phase === 'regular') {
      items.push({
        id: 'story', priority: 70, tone: 'info',
        title: pendingStoryEvent.title, body: pendingStoryEvent.body,
        tag: 'Decision', action: 'Decide', onAction: () => setShowStoryEvent(true),
      });
    }
    if (expiringPlayers.length) {
      items.push({
        id: 'expiring', priority: 40, tone: 'warning',
        title: `${expiringPlayers.length} contract${expiringPlayers.length === 1 ? '' : 's'} expiring`,
        body: expiringPlayers.slice(0, 3).map(p => `${p.name} (${p.position})`).join(', ')
          + (expiringPlayers.length > 3 ? ` +${expiringPlayers.length - 3} more` : ''),
        tag: 'Contracts', action: 'Manage', onAction: () => onNavigate('roster'),
      });
    }
    const waiverWire = waiverWireRaw || [];
    if (phase === 'regular' && waiverWire.length) {
      items.push({
        id: 'waivers', priority: 30, tone: 'info',
        title: `${waiverWire.length} players on waivers`,
        body: 'Claim a free upgrade before another team does.',
        tag: 'Waivers', action: 'View', onAction: () => setShowWaiverModal(true),
      });
    }
    if (phase === 'regular' && !devTrainingDone) {
      items.push({
        id: 'training', priority: 45, tone: 'info',
        title: 'Training session available',
        body: 'Spend this week\'s session on a player to speed up their development.',
        tag: 'Development', action: 'Train', onAction: () => onNavigate('development'),
      });
    }
    // Personality: players who want out, and stars angling for a new deal.
    // Capped so a losing season doesn't turn the inbox into a complaints desk.
    if (phase === 'regular' && week >= 3) {
      const ctx = teamContext({ rosters, standings }, userTeamId);
      const unhappy = userRoster
        .map(p => ({ p, out: wantsOut(p, ctx) }))
        .filter(x => x.out.yes)
        .sort((a, b) => b.p.ovr - a.p.ovr)
        .slice(0, 2);
      unhappy.forEach(({ p, out }) => items.push({
        id: `wants-out-${p.id}`, priority: 75, tone: 'urgent',
        title: `${p.name} wants out`,
        body: `${out.reason}. He won't talk extension until something changes. Trade him or fix it.`,
        tag: 'Locker room', action: 'Trade Center', onAction: () => onNavigate('trade'),
      }));
      const angling = userRoster
        .filter(p => p.ovr >= 78 && (p.contract?.yearsLeft ?? 2) <= 1 && !unhappy.some(u => u.p.id === p.id))
        .map(p => ({ p, st: contractStance(p, ctx) }))
        .filter(x => x.st.willing && x.st.mood.score < 66)
        .sort((a, b) => b.p.ovr - a.p.ovr)[0];
      if (angling) items.push({
        id: `new-deal-${angling.p.id}`, priority: 50, tone: 'warning',
        title: `${angling.p.name} wants a new deal`,
        body: `Final year of his contract. His ask: $${angling.st.ask}M/yr. ${angling.st.notes[0] ?? ''}`,
        tag: 'Contracts', action: 'Negotiate', onAction: () => onNavigate('roster'),
      });
    }
    if (coach?.seasonGoal && phase === 'regular') {
      items.push({
        id: 'goal', priority: seasonGoalMet ? 10 : 20, tone: seasonGoalMet ? 'good' : 'info',
        title: seasonGoalMet ? 'Season goal achieved' : 'Season goal',
        body: coach.seasonGoal,
        tag: seasonGoalMet ? 'Done' : 'Goal',
      });
    }
    return items;
  }, [userInjuries, pendingTradeOffer, pendingStoryEvent, expiringPlayers, waiverWireRaw,
      coach, seasonGoalMet, phase, onNavigate, coachingStaff, assistantLog, collegePipeline,
      collegeWatchlist, userTeamId, year, devTrainingDone, rosters, standings, userRoster, week]);

  if (!teamData) {
    return <div className="grid min-h-screen place-items-center text-fg-muted">Loading…</div>;
  }

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title={`${teamData.location} ${teamData.name}`}
        eyebrow={`Season ${season} · ${year} · ${phaseLabel}${phase === 'regular' ? ` · Week ${week}` : ''}`}
        team={teamData}
        size="hero"
      >
        {coach?.name && (
          <p className="mt-1 text-label text-fg-muted">
            Coach {coach.name}
            {division.rank > 0 && ` · ${teamData.conference} ${teamData.division} #${division.rank}`}
          </p>
        )}
      </PageHeader>

      <div className="mx-auto flex max-w-content flex-col gap-4 px-6 py-5">
        {/* Vitals: six numbers in one row, replacing four cards that each spent
            a whole card saying one thing. */}
        <StatusStrip
          record={record}
          streak={userStanding?.streak}
          ovr={Math.round(teamRatings?.[userTeamId]?.overall ?? 0) || '--'}
          off={Math.round(teamRatings?.[userTeamId]?.offense?.overall ?? 0) || '--'}
          def={Math.round(teamRatings?.[userTeamId]?.defense?.overall ?? 0) || '--'}
          morale={morale}
          cap={cap}
          coachLevel={coachLevel}
          xpInfo={xpInfo}
          playbook={activePlaybook}
          phase={phase}
          week={week}
          onNavigate={onNavigate}
        />

        {/* Above the fold is only ever two things: the game you are about to
            play, and the decisions waiting on you. Everything else lives in the
            deck below, grouped, so the Hub stops reading as 17 loose cards. */}
        <div className="grid grid-cols-12 items-start gap-4">
          <main className="col-span-12 flex min-w-0 flex-col gap-4 lg:col-span-8">
            <HeroMatchup
              phase={phase}
              week={week}
              game={nextGame}
              userTeam={teamData}
              oppTeam={oppTeam}
              userRecord={record}
              oppRecord={oppStanding ? `${oppStanding.wins}-${oppStanding.losses}` : '0-0'}
              winProbability={winProbability}
              onSimWeek={() => triggerSim(week)}
              onWatchGame={() => triggerSim(week, 'watch')}
              onSimToWeek={(w) => triggerSim(w)}
              onPrimary={handleOffseasonPrimary}
              primaryLabel={primaryLabel}
            />
            <WeeklyPreparation />
            <ObjectivesCard objectives={objectives} completed={completedObjectives} phase={phase} />
          </main>

          <aside className="col-span-12 min-w-0 lg:col-span-4">
            <Inbox items={inboxItems} />
          </aside>
        </div>

        {/* The deck */}
        <section className="flex flex-col gap-3">
          <Tabs items={DECK_TABS} value={deck} onChange={setDeck} label="Franchise detail" />
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {deck === 'team' && (
              <>
                <OwnerCard />
                <RosterGradesCard grades={grades} onNavigate={onNavigate} />
                <TeamLeadersCard leaders={leaders} onNavigate={onNavigate} />
                <PlayerOfWeekCard potw={playerOfWeek} />
              </>
            )}
            {deck === 'league' && (
              <>
                <DivisionCard
                  teams={division.teams}
                  userTeamId={userTeamId}
                  conference={teamData.conference}
                  division={teamData.division}
                  onNavigate={onNavigate}
                />
                <PlayoffRaceCard race={race} userTeamId={userTeamId} conference={teamData.conference} week={week} />
                <LastScoresCard scores={lastWeekScores} week={week} userTeamId={userTeamId} />
                <Card>
                  <CardHeader
                    title="League news"
                    action={<Button variant="ghost" size="sm" onClick={() => onNavigate('awards')}>Awards</Button>}
                  />
                  <div className="max-h-96 overflow-y-auto">
                    <LeagueNewsPanel onNavigate={onNavigate} />
                  </div>
                </Card>
              </>
            )}
            {deck === 'legacy' && (
              <>
                <FranchiseLoreCard teamId={userTeamId} seasonHistory={seasonHistory} />
                <FranchiseRecordsCard records={franchiseRecords} />
                <SeasonHistoryCard history={seasonHistory} year={year} userTeamId={userTeamId} />
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Overlays ──
          Storylines queue up after a sim, but they must never stack on top of
          a modal the player deliberately opened — you could end up with the
          matchup preview and a storyline card fighting for the same space. */}
      {currentStoryline && !anotherOverlayOpen && (
        <StorylinePopup
          storyline={currentStoryline}
          onDismiss={handleDismissStoryline}
          onDismissAll={handleDismissAllStorylines}
          remainingCount={remainingStorylines}
          theme={teamData.theme}
        />
      )}

      <AnimatePresence>
        {simLoading && simMode === 'watch' && SIM_SPEEDS[simSpeed] && broadcastGame && (
          <GameBroadcast
            game={broadcastGame}
            title={`Week ${simWeekDisplay}`}
            others={(schedule[simWeekDisplay - 1] || [])
              .map((g, i) => ({ g, final: simRealScores?.[i] || null }))
              .filter(({ g }) => g !== broadcastGame)}
            duration={SIM_SPEEDS[simSpeed].broadcast}
            onComplete={handleLoadingComplete}
          />
        )}
        {simLoading && !(simMode === 'watch' && SIM_SPEEDS[simSpeed] && broadcastGame) && (
          <WeekLoadingScreen
            week={simWeekDisplay}
            theme={teamData.theme}
            onComplete={handleLoadingComplete}
            games={schedule[simWeekDisplay - 1] || []}
            teamRatings={teamRatings}
            realScores={simRealScores}
            stretch={simStretch}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMatchupPreview && (
          <MatchupPreview
            game={nextGame}
            userTeamId={userTeamId}
            standings={standings}
            teamRatings={teamRatings}
            week={week}
            onSimulate={(mode) => { closeMatchup(); triggerSim(week, mode); }}
            onCancel={closeMatchup}
          />
        )}
      </AnimatePresence>


      <AnimatePresence>
        {gameResult && !simLoading && (
          <GameSummaryModal
            game={gameResult}
            userTeamId={userTeamId}
            teamData={teamData}
            rosters={rosters}
            objectives={getWeekObjectives(gameResult.week || Math.max(1, week - 1))}
            completedObjectives={completedObjectives}
            onClose={closeSummary}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWaiverModal && (
          <WaiverWireModal onClose={() => setShowWaiverModal(false)} theme={teamData.theme} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStoryEvent && pendingStoryEvent && (
          <StoryEventModal
            event={pendingStoryEvent}
            theme={teamData.theme}
            onChoice={(choiceIdx) => { resolveStoryEvent(choiceIdx); setShowStoryEvent(false); }}
            onDismiss={() => { dismissStoryEvent(); setShowStoryEvent(false); }}
          />
        )}
      </AnimatePresence>

      {showTradeModal && pendingTradeOffer && (
        <TradeOfferModal
          offer={pendingTradeOffer}
          onAccept={() => {
            const outgoing = pendingTradeOffer.give.filter(i => i.type === 'player');
            acceptTradeOffer();
            // Only react if the deal actually went through.
            const mine = useGameStore.getState().rosters[userTeamId] || [];
            if (outgoing.length && !outgoing.some(o => mine.some(p => p.id === o.id))) {
              useGameStore.getState().applyTradeFallout(outgoing);
            }
            setShowTradeModal(false);
          }}
          onDecline={() => { declineTradeOffer(); setShowTradeModal(false); }}
          onClose={() => setShowTradeModal(false)}
        />
      )}
    </div>
  );
}

// ── CPU trade offer ─────────────────────────────────────────────────────────
function TradeSide({ label, items }) {
  return (
    <div className="flex-1">
      <p className="mb-2 text-micro uppercase text-fg-faint">{label}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i, idx) => (
          <li key={idx} className="rounded-chip bg-surface-sunken px-3 py-2 text-label text-fg">
            {i.type === 'player' ? `${i.name} · ${i.position} · ${i.ovr} OVR` : `Round ${i.round} pick`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeOfferModal({ offer, onAccept, onDecline, onClose }) {
  const from = TEAMS.find(t => t.id === offer.fromTeamId);
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Incoming offer"
      title={`${from?.location ?? 'A rival'} ${from?.name ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onDecline}>Decline</Button>
          <Button variant="primary" onClick={onAccept}>Accept trade</Button>
        </>
      }
    >
      <div className="flex gap-6">
        <TradeSide label="You give" items={offer.give} />
        <TradeSide label="You get" items={offer.receive} />
      </div>
    </Modal>
  );
}
