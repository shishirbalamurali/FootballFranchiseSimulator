// Manual browser fixture. Not a production entry point; never writes franchise saves.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGameStore } from '../src/store/gameStore';
import { generateRoster } from '../src/engine/player';
import { calculateTeamRatings } from '../src/engine/ratings';
import { TEAMS } from '../src/data/teams';
import { createSeededRandom } from './helpers/seededRandom.mjs';
import WeeklyPreparation from '../src/components/WeeklyPreparation';
import MatchupPreview from '../src/components/MatchupPreview';
import GameSummaryModal from '../src/screens/hub/GameSummaryModal';
import ThemeProvider from '../src/components/ThemeProvider';
import { Button, ToastProvider } from '../src/components/ui';
import '../src/index.css';

const originalRandom = Math.random;
Math.random = createSeededRandom(20260925);
const home = TEAMS[0], away = TEAMS[1];
const rosters = Object.fromEntries(TEAMS.map(t => [t.id, generateRoster()]));
const qbs = rosters[home.id].filter(p => p.position === 'QB').sort((a,b) => b.ovr-a.ovr);
Object.assign(qbs[0], { age: 32, ovr: 80, experience: 10, name: 'Marcus Reed' });
Object.assign(qbs[1], { age: 22, ovr: 72, experience: 0, name: 'Eli Brooks' });
Math.random = originalRandom;
const base = {
  initialized: false, phase: 'regular', year: 2028, week: 1, userTeamId: home.id, rosters,
  teamRatings: Object.fromEntries(TEAMS.map(t => [t.id, calculateTeamRatings(rosters[t.id])])),
  standings: Object.fromEntries(TEAMS.map(t => [t.id, { wins:0, losses:0, ties:0, pf:0, pa:0, streak:0 }])),
  schedule: Array.from({ length: 18 }, (_,i) => i === 1 ? [] : [{ id: `fixture-${i}`, week:i+1, homeTeamId:home.id, awayTeamId:away.id }]),
  injuries: [], activeBoosts: [], positionBattle: null, weeklyDecisionHistory: [], weekStrategy:'balanced',
  coachingStaff: [], collegePipeline: [], collegeWatchlist: [], collegeAlumni: [], pendingStoryEvent: null,
  activityLog: [], weeklyNews: [], storylineQueue: [], coachXp:0, coach:null, morale:50,
  franchiseRecords:{}, breakoutPlayers:{}, pendingTradeOffer:null, lastDismissedGameId:null,
};
function reset() { useGameStore.setState(structuredClone(base)); }
if (import.meta.env.DEV) reset();

export function Preview() {
  const state = useGameStore();
  const [modal, setModal] = useState(null);
  const [result, setResult] = useState(null);
  const simulate = () => {
    const week = useGameStore.getState().week;
    useGameStore.getState().simulateWeek();
    const game = useGameStore.getState().schedule[week-1]?.[0];
    setResult(game || null);
    setModal(game ? 'recap' : null);
  };
  return <ThemeProvider><main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
    <h1 className="font-display text-h1 text-fg">Weekly loop · development fixture</h1>
    <p className="text-label text-fg-muted">Disposable in-memory fixture · Week {state.week} · Week 2 is a bye · does not save</p>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => { reset(); setModal(null); }}>Reset fixture</Button>
      <Button onClick={() => setModal('preview')}>Matchup preview</Button>
      <Button onClick={simulate}>Advance fixture week</Button>
      <Button onClick={() => useGameStore.setState({ injuries:[{ playerId:qbs[1].id, teamId:home.id, weeksRemaining:3 }] })}>Injure prospect</Button>
      <Button onClick={() => useGameStore.setState({ positionBattle:undefined, weeklyDecisionHistory:undefined })}>Old save fields</Button>
    </div>
    <WeeklyPreparation />
    {modal === 'preview' && <MatchupPreview game={state.schedule[state.week-1]?.[0]} userTeamId={home.id} standings={state.standings} teamRatings={state.teamRatings} week={state.week} onCancel={() => setModal(null)} onSimulate={simulate} />}
    {modal === 'recap' && result && <GameSummaryModal game={result} userTeamId={home.id} teamData={home} rosters={state.rosters} objectives={[]} completedObjectives={[]} onClose={() => setModal(null)} />}
  </main></ThemeProvider>;
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root'));
  root.render(<ToastProvider><Preview /></ToastProvider>);
  if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
}
