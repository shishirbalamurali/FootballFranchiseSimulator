import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import PlayerModal from '../components/PlayerModal';
import { extractSeasonBests } from './statsData';
import {
  PageHeader, Card, CardHeader, CardBody, DataTable, Tabs, SegmentedControl,
  FilterChips, TeamCrest, PositionTag, RarityChip, Stat, EmptyState, cx,
} from '../components/ui';

const POS_GROUPS = {
  QB: ['QB'],
  RB: ['RB', 'FB'],
  WR: ['WR'],
  TE: ['TE'],
  OL: ['OL', 'C', 'OG', 'OT', 'G', 'T'],
  DL: ['DL', 'DE', 'DT'],
  LB: ['LB', 'MLB', 'OLB'],
  DB: ['DB', 'CB', 'S', 'FS', 'SS'],
  K:  ['K', 'P'],
};

const COLUMNS = {
  QB: [
    { label: 'Yds', key: 'yards' }, { label: 'TD', key: 'tds' }, { label: 'INT', key: 'ints' },
    { label: 'Cmp', key: 'completions' }, { label: 'Att', key: 'attempts' },
    { label: 'Rating', key: 'rating' }, { label: 'Ru yds', key: 'rushYards' },
  ],
  RB: [
    { label: 'Ru yds', key: 'yards' }, { label: 'TD', key: 'tds' }, { label: 'Car', key: 'carries' },
    { label: 'Rec', key: 'receptions' }, { label: 'Re yds', key: 'recYards' }, { label: 'Fum', key: 'fumbles' },
  ],
  WR: [{ label: 'Rec', key: 'receptions' }, { label: 'Yds', key: 'recYards' }, { label: 'TD', key: 'tds' }, { label: 'Tgt', key: 'targets' }],
  TE: [{ label: 'Rec', key: 'receptions' }, { label: 'Yds', key: 'recYards' }, { label: 'TD', key: 'tds' }, { label: 'Tgt', key: 'targets' }],
  OL: [{ label: 'Pancakes', key: 'pancakes' }, { label: 'Sacks allowed', key: 'sacksAllowed' }],
  DL: [{ label: 'Tkl', key: 'tackles' }, { label: 'Sacks', key: 'sacks' }, { label: 'TFL', key: 'tfl' }],
  LB: [{ label: 'Tkl', key: 'tackles' }, { label: 'Sacks', key: 'sacks' }, { label: 'INT', key: 'ints' }, { label: 'TFL', key: 'tfl' }],
  DB: [{ label: 'Tkl', key: 'tackles' }, { label: 'INT', key: 'ints' }, { label: 'PD', key: 'pd' }, { label: 'TFL', key: 'tfl' }],
  K:  [{ label: 'FGM', key: 'fgm' }, { label: 'FGA', key: 'fga' }, { label: 'XPM', key: 'xpm' }],
};

// The headline stat for each position group — drives the leader podium.
const HEADLINE = {
  QB: 'yards', RB: 'yards', WR: 'recYards', TE: 'recYards',
  OL: 'pancakes', DL: 'sacks', LB: 'tackles', DB: 'ints', K: 'fgm',
};

function passerRating(att, comp, yds, tds, ints) {
  if (!att) return 0;
  const a = Math.max(0, Math.min(2.375, ((comp / att) - 0.3) * 5));
  const b = Math.max(0, Math.min(2.375, ((yds / att) - 3) * 0.25));
  const c = Math.max(0, Math.min(2.375, (tds / att) * 20));
  const d = Math.max(0, Math.min(2.375, 2.375 - ((ints / att) * 25)));
  return parseFloat((((a + b + c + d) / 6) * 100).toFixed(1));
}

export default function Stats() {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const schedule = useGameStore(s => s.schedule);
  const week = useGameStore(s => s.week);
  const year = useGameStore(s => s.year);

  const [mainTab, setMainTab] = useState('table');
  const [filterPos, setFilterPos] = useState('QB');
  const [selectedWeek, setSelectedWeek] = useState('season');
  const [scope, setScope] = useState('LEAGUE');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const teamData = TEAMS.find(t => t.id === userTeamId);

  const getStat = useMemo(() => (player, key) => {
    if (key === 'ovr') return player.ovr;
    let src = {};
    if (selectedWeek === 'season') {
      src = player.stats?.season || {};
    } else {
      const games = schedule[parseInt(selectedWeek, 10) - 1] || [];
      const game = games.find(g => (scope === 'LEAGUE'
        ? (g.homeTeamId === player.teamId || g.awayTeamId === player.teamId)
        : (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)));
      if (game?.playerStats) {
        src = game.playerStats.home?.[player.id] || game.playerStats.away?.[player.id] || {};
      }
    }
    if (key === 'rating') {
      return passerRating(src.attempts || 0, src.completions || 0, src.yards || 0, src.tds || 0, src.ints || 0);
    }
    return src[key] || 0;
  }, [selectedWeek, schedule, scope, userTeamId]);

  const players = useMemo(() => {
    let list = [];
    if (scope === 'LEAGUE') {
      Object.keys(rosters).forEach(tid => (rosters[tid] || []).forEach(p => list.push({ ...p, teamId: tid })));
    } else {
      list = (rosters[userTeamId] || []).map(p => ({ ...p, teamId: userTeamId }));
    }
    const allowed = POS_GROUPS[filterPos] || [filterPos];
    list = list.filter(p => allowed.includes(p.position));
    const headline = HEADLINE[filterPos] ?? 'ovr';
    list.sort((a, b) => getStat(b, headline) - getStat(a, headline));
    return scope === 'LEAGUE' ? list.slice(0, 50) : list;
  }, [scope, rosters, userTeamId, filterPos, getStat]);

  const cols = COLUMNS[filterPos] || COLUMNS.QB;
  const headlineKey = HEADLINE[filterPos] ?? 'ovr';
  const podium = players.slice(0, 3).filter(p => getStat(p, headlineKey) > 0);
  const seasonBests = useMemo(() => extractSeasonBests(schedule, rosters), [schedule, rosters]);

  const weekOptions = [];
  for (let i = 1; i < week && i <= 18; i++) weekOptions.push(i);

  const tableColumns = [
    { id: 'pos', header: 'Pos', width: '62px', accessor: p => p.position, cell: p => <PositionTag position={p.position} /> },
    {
      id: 'name', header: 'Player', accessor: p => p.name,
      cell: p => (
        <div className="flex min-w-0 items-center gap-2.5">
          {scope === 'LEAGUE' && <TeamCrest teamId={p.teamId} size="xs" decorative />}
          <span className="truncate font-semibold text-fg">{p.name}</span>
        </div>
      ),
    },
    { id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '128px', cell: p => <RarityChip ovr={p.ovr} /> },
    ...cols.map(c => ({
      id: c.key,
      header: c.label,
      accessor: p => getStat(p, c.key),
      numeric: true,
      align: 'right',
      width: '84px',
      cell: p => {
        const v = getStat(p, c.key);
        return <span className={cx('tabular-nums', c.key === headlineKey && 'font-bold text-fg')}>{v}</span>;
      },
    })),
  ];

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title={mainTab === 'bests' ? 'Season bests' : selectedWeek === 'season' ? 'Season stats' : `Week ${selectedWeek} stats`}
        eyebrow={`${teamData?.location ?? ''} · ${year} season`}
        team={teamData}
        tabs={
          <Tabs
            value={mainTab}
            onChange={setMainTab}
            label="Stats views"
            items={[{ id: 'table', label: 'Leaders' }, { id: 'bests', label: 'Single-game bests' }]}
          />
        }
      />

      <div className="mx-auto max-w-content px-6 py-6">
        {mainTab === 'table' ? (
          <Card>
            {/* One control bar. Previously this screen had a tab row, a native
                <select> and a chip row, all styled differently. */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-raised px-4 py-3">
              <SegmentedControl
                label="Scope"
                value={scope}
                onChange={setScope}
                items={[{ id: 'TEAM', label: 'My team' }, { id: 'LEAGUE', label: 'League' }]}
              />
              <FilterChips
                items={Object.keys(POS_GROUPS).map(p => ({ id: p, label: p }))}
                value={filterPos}
                onChange={setFilterPos}
              />
              <div className="ml-auto flex items-center gap-2">
                <label className="text-micro uppercase text-fg-faint" htmlFor="stats-week">Period</label>
                <select
                  id="stats-week"
                  value={selectedWeek}
                  onChange={e => setSelectedWeek(e.target.value)}
                  className="h-9 rounded-card border border-line bg-surface-sunken px-2.5 text-label text-fg"
                >
                  <option value="season">Full season</option>
                  {weekOptions.map(w => <option key={w} value={String(w)}>Week {w}</option>)}
                </select>
              </div>
            </div>

            {/* Leader podium — the top three, before the wall of numbers */}
            {podium.length > 0 && (
              <CardBody className="grid grid-cols-1 gap-3 border-b border-line-subtle sm:grid-cols-3">
                {podium.map((p, i) => {
                  const label = cols.find(c => c.key === headlineKey)?.label ?? 'Stat';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayer(p)}
                      className={cx(
                        'flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors hover:bg-surface-hover',
                        i === 0 ? 'border-team bg-team-8' : 'border-line-subtle',
                      )}
                    >
                      <span className="font-display text-h1 tabular-nums text-fg-faint">{i + 1}</span>
                      <TeamCrest teamId={p.teamId} size="sm" decorative />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label font-semibold text-fg">{p.name}</p>
                        <p className="text-label text-fg-muted">{p.position}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-h2 tabular-nums text-fg">{getStat(p, headlineKey)}</p>
                        <p className="text-micro uppercase text-fg-faint">{label}</p>
                      </div>
                    </button>
                  );
                })}
              </CardBody>
            )}

            {players.length === 0 ? (
              <EmptyState icon="📊" title="No stats yet" body="Play or simulate a week to start generating statistics." />
            ) : (
              <DataTable
                rows={players}
                columns={tableColumns}
                caption={`${filterPos} statistics`}
                initialSort={{ id: headlineKey, dir: 'desc' }}
                onRowClick={setSelectedPlayer}
                highlightRow={p => p.teamId === userTeamId && scope === 'LEAGUE'}
                dense
              />
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Single-game records" eyebrow="Best individual performances this season" />
            {seasonBests?.length ? (
              <ul>
                {seasonBests.map((b, i) => {
                  // `b.team` is an abbreviation, not an id.
                  const team = TEAMS.find(t => t.abbreviation === b.team);
                  return (
                    <li key={i} className="flex items-center gap-4 border-b border-line-subtle px-4 py-3 last:border-0">
                      <span className="w-36 shrink-0 text-micro uppercase text-fg-faint">{b.label}</span>
                      <TeamCrest team={team} size="xs" decorative />
                      <PositionTag position={b.pos} />
                      <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg">{b.name}</span>
                      <span className="shrink-0 text-label text-fg-muted">Week {b.week}</span>
                      <span className="w-20 shrink-0 text-right font-display text-h3 tabular-nums text-fg">{b.val}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="🏅" title="No records yet" body="Single-game bests appear once games have been played." />
            )}
          </Card>
        )}
      </div>

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          teamId={selectedPlayer.teamId || userTeamId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
