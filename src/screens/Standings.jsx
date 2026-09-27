import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { DIVISIONS, TEAMS } from '../data/teams';
import {
  PageHeader, Card, CardHeader, DataTable, Tabs, SegmentedControl,
  TeamCrest, Badge, Stat, cx,
} from '../components/ui';

const CAP_TOTAL = 200;

// Seed colouring: 1 = bye, 2–4 division winners, 5–7 wild cards.
function seedTone(seed) {
  if (seed === 1) return 'warning';
  if (seed <= 4) return 'positive';
  if (seed <= 7) return 'info';
  return 'neutral';
}

export default function Standings() {
  const [activeConf, setActiveConf] = useState('AFC');
  const [activeTab, setActiveTab] = useState('divisions');
  const standings = useGameStore(s => s.standings);
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const teamRatings = useGameStore(s => s.teamRatings);
  const week = useGameStore(s => s.week);
  const phase = useGameStore(s => s.phase);
  const year = useGameStore(s => s.year);

  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const gamesPlayed = phase === 'regular' ? Math.max(0, week - 1) : 17;

  const capSpaceMap = useMemo(() => {
    const m = {};
    TEAMS.forEach(t => {
      const roster = rosters[t.id] || [];
      m[t.id] = CAP_TOTAL - Math.round(roster.reduce((s, p) => s + (p.contract?.salary || p.salary || 2), 0));
    });
    return m;
  }, [rosters]);

  const allTeams = useMemo(() => Object.values(standings).map(s => {
    const info = TEAMS.find(t => t.id === s.id);
    return { ...s, ...info, pointDiff: s.pf - s.pa };
  }), [standings]);

  const powerRankings = useMemo(() => TEAMS.map(team => {
    const s = standings[team.id] || { wins: 0, losses: 0, pf: 0, pa: 0, streak: 0 };
    const ovr = Math.round(teamRatings?.[team.id]?.overall || 70);
    const games = s.wins + s.losses || 1;
    const winPct = s.wins / games;
    const pointDiff = s.pf - s.pa;
    const score = (winPct * 60) + (pointDiff / games * 0.4) + ((ovr - 65) * 0.3);
    return { ...team, ...s, ovr, pointDiff, winPct, score };
  }).sort((a, b) => b.score - a.score).map((t, i) => ({ ...t, rank: i + 1 })), [standings, teamRatings]);

  const confTeams = allTeams.filter(t => t.conference === activeConf);

  const seeds = useMemo(() => [...confTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if ((b.divWins || 0) !== (a.divWins || 0)) return (b.divWins || 0) - (a.divWins || 0);
    return b.pointDiff - a.pointDiff;
  }).map((t, i) => ({ ...t, seed: i + 1 })), [confTeams]);

  const seed7Wins = seeds[6]?.wins ?? 0;
  const magicNumber = (team) => {
    const needed = Math.max(0, seed7Wins - team.wins + 1);
    return team.losses + needed > 17 ? null : needed;
  };

  // ── Shared column definitions ─────────────────────────────────────────────
  const teamCell = (t) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <TeamCrest team={t} size="xs" decorative />
      <span className={cx('truncate', t.id === userTeamId ? 'font-bold text-fg' : 'text-fg-secondary')}>
        {t.location} {t.name}
      </span>
      {t.id === userTeamId && <Badge tone="team">You</Badge>}
    </div>
  );

  const recordCols = [
    { id: 'w',   header: 'W',   accessor: t => t.wins,   numeric: true, align: 'right', width: '52px' },
    { id: 'l',   header: 'L',   accessor: t => t.losses, numeric: true, align: 'right', width: '52px' },
    {
      id: 'pct', header: 'Pct', numeric: true, align: 'right', width: '68px',
      accessor: t => (t.wins + t.losses ? t.wins / (t.wins + t.losses) : 0),
      cell: t => {
        const g = t.wins + t.losses;
        return <span className="tabular-nums">{g ? (t.wins / g).toFixed(3).replace(/^0/, '') : '—'}</span>;
      },
    },
    { id: 'pf',  header: 'PF',  accessor: t => t.pf, numeric: true, align: 'right', width: '60px' },
    { id: 'pa',  header: 'PA',  accessor: t => t.pa, numeric: true, align: 'right', width: '60px' },
    {
      id: 'diff', header: 'Diff', accessor: t => t.pointDiff, numeric: true, align: 'right', width: '68px',
      cell: t => (
        <span className={cx('tabular-nums', t.pointDiff > 0 ? 'text-positive-fg' : t.pointDiff < 0 ? 'text-negative-fg' : '')}>
          {t.pointDiff > 0 ? '+' : ''}{t.pointDiff}
        </span>
      ),
    },
    {
      id: 'streak', header: 'Streak', accessor: t => t.streak ?? 0, numeric: true, align: 'right', width: '78px',
      cell: t => {
        const s = t.streak ?? 0;
        if (!s) return <span className="text-fg-faint">—</span>;
        return (
          <span className={cx('tabular-nums', s > 0 ? 'text-positive-fg' : 'text-negative-fg')}>
            {s > 0 ? `W${s}` : `L${Math.abs(s)}`}
          </span>
        );
      },
    },
  ];

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Standings"
        eyebrow={`${year} season${phase === 'regular' ? ` · week ${week}` : ''} · ${gamesPlayed} games played`}
        team={userTeam}
        actions={
          activeTab === 'playoff' && (
            <SegmentedControl
              label="Conference"
              value={activeConf}
              onChange={setActiveConf}
              items={[{ id: 'AFC', label: 'AFC' }, { id: 'NFC', label: 'NFC' }]}
            />
          )
        }
        tabs={
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            label="Standings views"
            items={[
              { id: 'divisions', label: 'Divisions' },
              { id: 'playoff', label: 'Playoff picture' },
              { id: 'power', label: 'Power rankings' },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-content px-6 py-5">
        {/* ── DIVISIONS ── */}
        {activeTab === 'divisions' && (
          // Both conferences side by side. The old AFC/NFC toggle hid half
          // the league and left the page mostly empty.
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {['AFC', 'NFC'].map(conf => (
              <section key={conf} className="flex flex-col gap-3">
                <h2 className="font-display text-h2 uppercase text-fg">{conf}</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {DIVISIONS.map(div => {
                    const teams = allTeams
                      .filter(t => t.conference === conf && t.division === div)
                      .sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);
                    if (!teams.length) return null;
                    return (
                      <Card key={div}>
                        <CardHeader title={`${conf} ${div}`} />
                        <DataTable
                          rows={teams}
                          dense
                          stickyHeader={false}
                          caption={`${conf} ${div} standings`}
                          initialSort={{ id: 'w', dir: 'desc' }}
                          highlightRow={t => t.id === userTeamId}
                          columns={[
                            { id: 'team', header: 'Team', accessor: t => t.location, cell: teamCell },
                            ...recordCols.filter(c => ['w', 'l', 'pct', 'diff'].includes(c.id)),
                          ]}
                        />
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── PLAYOFF PICTURE ── */}
        {activeTab === 'playoff' && (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                title={`${activeConf} playoff field`}
                eyebrow="Seeds 1–7 · seed 1 gets the bye"
              />
              <DataTable
                rows={seeds.slice(0, 7)}
                caption={`${activeConf} playoff seeds`}
                initialSort={{ id: 'seed', dir: 'asc' }}
                highlightRow={t => t.id === userTeamId}
                columns={[
                  {
                    id: 'seed', header: 'Seed', accessor: t => t.seed, numeric: true, width: '76px',
                    cell: t => <Badge tone={seedTone(t.seed)}>{t.seed}</Badge>,
                  },
                  { id: 'team', header: 'Team', accessor: t => t.location, cell: teamCell },
                  ...recordCols.filter(c => ['w', 'l', 'diff', 'streak'].includes(c.id)),
                ]}
              />
            </Card>

            <Card>
              <CardHeader title="In the hunt" eyebrow="Outside the field" />
              <DataTable
                rows={seeds.slice(7)}
                caption={`${activeConf} teams outside the playoff field`}
                initialSort={{ id: 'seed', dir: 'asc' }}
                highlightRow={t => t.id === userTeamId}
                columns={[
                  { id: 'seed', header: 'Pos', accessor: t => t.seed, numeric: true, width: '76px',
                    cell: t => <span className="tabular-nums text-fg-faint">{t.seed}</span> },
                  { id: 'team', header: 'Team', accessor: t => t.location, cell: teamCell },
                  ...recordCols.filter(c => ['w', 'l', 'diff'].includes(c.id)),
                  {
                    id: 'magic', header: 'Wins needed', sortable: false, align: 'right', width: '124px',
                    cell: t => {
                      const m = magicNumber(t);
                      return m === null
                        ? <Badge tone="negative">Eliminated</Badge>
                        : <span className="tabular-nums text-fg-secondary">{m}</span>;
                    },
                  },
                ]}
              />
            </Card>
          </div>
        )}

        {/* ── POWER RANKINGS ── */}
        {activeTab === 'power' && (
          <Card>
            <CardHeader title="League power rankings" eyebrow="All 32 teams · record, point differential and roster strength" />
            <DataTable
              rows={powerRankings}
              caption="League power rankings"
              initialSort={{ id: 'rank', dir: 'asc' }}
              highlightRow={t => t.id === userTeamId}
              columns={[
                {
                  id: 'rank', header: '#', accessor: t => t.rank, numeric: true, width: '58px',
                  cell: t => (
                    <span className={cx('font-display text-h3 tabular-nums',
                      t.rank <= 4 ? 'text-warning-fg' : t.rank <= 12 ? 'text-fg' : 'text-fg-faint')}>
                      {t.rank}
                    </span>
                  ),
                },
                { id: 'team', header: 'Team', accessor: t => t.location, cell: teamCell },
                { id: 'conf', header: 'Conf', accessor: t => t.conference, width: '78px',
                  cell: t => <span className="text-fg-muted">{t.conference} {t.division}</span> },
                ...recordCols.filter(c => ['w', 'l', 'diff'].includes(c.id)),
                { id: 'ovr', header: 'OVR', accessor: t => t.ovr, numeric: true, align: 'right', width: '64px' },
                {
                  id: 'cap', header: 'Cap', accessor: t => capSpaceMap[t.id] ?? 0, numeric: true, align: 'right', width: '80px',
                  cell: t => {
                    const c = capSpaceMap[t.id] ?? 0;
                    return <span className={cx('tabular-nums', c < 0 && 'text-negative-fg')}>
                      {c < 0 ? `-$${Math.abs(c)}M` : `$${c}M`}
                    </span>;
                  },
                },
              ]}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
