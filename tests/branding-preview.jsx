// Development-only visual fixture. initialized:false prevents every save path.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TEAMS } from '../src/data/teams';
import { TEAM_PLAYBOOK_MAP } from '../src/data/playbooks';
import { useGameStore } from '../src/store/gameStore';
import { generateRoster } from '../src/engine/player';
import { calculateTeamRatings } from '../src/engine/ratings';
import { createSeededRandom } from './helpers/seededRandom.mjs';
import ThemeProvider from '../src/components/ThemeProvider';
import { TeamCrest, ToastProvider } from '../src/components/ui';
import HomeHub from '../src/screens/HomeHub';
import Standings from '../src/screens/Standings';
import Schedule from '../src/screens/Schedule';
import Playbook from '../src/screens/Playbook';
import '../src/index.css';

function chooseTeam(id) {
  const away = TEAMS.find(t => t.id !== id);
  useGameStore.setState({ initialized: false, userTeamId: id, userPlaybookId: TEAM_PLAYBOOK_MAP[id],
    schedule: [[{ id: 'brand-game', week: 1, homeTeamId: id, awayTeamId: away.id, played: false }]],
  });
}

export function BrandingPreview() {
  const [page, setPage] = useState('gallery');
  const teamId = useGameStore(s => s.userTeamId);
  const pages = { hub: HomeHub, standings: Standings, schedule: Schedule, playbook: Playbook };
  const Page = pages[page];
  return <ThemeProvider><ToastProvider><main className="mx-auto max-w-7xl space-y-6 p-6">
    <header className="flex flex-wrap items-center gap-4 rounded-lg bg-surface-raised p-4 text-fg">
      <strong>Brand preview · never saves</strong>
      <label>Team <select aria-label="Preview team" value={teamId} onChange={e => chooseTeam(e.target.value)} className="bg-surface-raised text-fg">
        {TEAMS.map(t => <option key={t.id} value={t.id}>{t.location} {t.name}</option>)}
      </select></label>
      <label>Page <select aria-label="Preview page" value={page} onChange={e => setPage(e.target.value)} className="bg-surface-raised text-fg">
        {['gallery', ...Object.keys(pages)].map(id => <option key={id} value={id}>{id}</option>)}
      </select></label>
    </header>
    {Page ? <Page onNavigate={id => setPage(pages[id] ? id : 'hub')} /> : <div className="grid grid-cols-4 gap-4">
      {TEAMS.map(t => <article key={t.id} className="flex flex-col items-center gap-2 rounded-lg border border-default bg-surface-raised p-4 text-fg">
        <TeamCrest team={t} size={96}/><h2 className="font-display text-h3">{t.location} {t.name}</h2>
        <div className="flex gap-2"><span className="h-3 w-10 rounded" style={{background:t.theme.primary}}/><span className="h-3 w-10 rounded" style={{background:t.theme.secondary}}/></div>
      </article>)}
    </div>}
  </main></ToastProvider></ThemeProvider>;
}

if (import.meta.env.DEV) {
  const random = Math.random;
  let rosters;
  try {
    Math.random = createSeededRandom(20260926);
    rosters = Object.fromEntries(TEAMS.map(t => [t.id, generateRoster()]));
  } finally { Math.random = random; }
  useGameStore.setState({ initialized: false, teams: TEAMS, rosters, year: 2026, season: 1, week: 1, phase: 'regular',
    standings: Object.fromEntries(TEAMS.map(t => [t.id, {id:t.id,wins:0,losses:0,ties:0,pf:0,pa:0,divWins:0,streak:0}])),
    teamRatings: Object.fromEntries(TEAMS.map(t => [t.id,calculateTeamRatings(rosters[t.id])])),
    injuries: [], pendingStoryEvent: null, pendingTradeOffer: null, storylineQueue: [], weeklyNews: [], seasonHistory: [],
    owner: null, lastWeekScores: [], positionBattle: null, weeklyDecisionHistory: [], coach: null,
  });
  chooseTeam('49ers');
  const root = createRoot(document.getElementById('root'));
  root.render(<BrandingPreview />);
  if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
}
