import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { getAwardRaces, getStatLeaders } from '../engine/awards';
import PlayerModal from '../components/PlayerModal';
import { AchievementsPanel } from '../components/Legacy';
import {
  PageHeader, Card, CardHeader, CardBody, Tabs, TeamCrest, PositionTag,
  RarityChip, Badge, Stat, EmptyState, cx,
} from '../components/ui';

const AWARD_META = {
  mvp:  { title: 'Most Valuable Player', short: 'MVP',  accent: 'var(--rarity-gold)' },
  opoy: { title: 'Offensive Player of the Year', short: 'OPOY', accent: 'var(--rarity-elite)' },
  dpoy: { title: 'Defensive Player of the Year', short: 'DPOY', accent: 'var(--info-fg)' },
};

const LEADER_META = [
  { key: 'passingYards',   label: 'Passing yards',   stat: 'yards' },
  { key: 'passingTds',     label: 'Passing TDs',     stat: 'tds' },
  { key: 'rushingYards',   label: 'Rushing yards',   stat: 'rushYards' },
  { key: 'receivingYards', label: 'Receiving yards', stat: 'recYards' },
  { key: 'receptions',     label: 'Receptions',      stat: 'receptions' },
  { key: 'sacks',          label: 'Sacks',           stat: 'sacks' },
  { key: 'ints',           label: 'Interceptions',   stat: 'ints' },
  { key: 'tackles',        label: 'Tackles',         stat: 'tackles' },
];

function teamOf(p) {
  return TEAMS.find(t => t.id === p.teamId) ?? TEAMS.find(t => t.abbreviation === p.team);
}

// ── Award race: a podium, then the chasing pack ─────────────────────────────
function AwardRace({ awardKey, players, onSelect }) {
  const meta = AWARD_META[awardKey];
  if (!players?.length) {
    return (
      <Card>
        <CardHeader title={meta.title} eyebrow={meta.short} />
        <EmptyState size="sm" icon="🏆" title="Race not open yet" body="Play some games to start the voting." />
      </Card>
    );
  }
  const [leader, ...rest] = players;
  return (
    <Card>
      <CardHeader title={meta.title} eyebrow={`${meta.short} race`} />

      {/* Front-runner */}
      <button
        type="button"
        onClick={() => onSelect(leader)}
        className="relative flex items-center gap-4 border-b border-line-subtle px-5 py-5 text-left transition-colors hover:bg-surface-hover"
        style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${meta.accent} 14%, transparent), transparent 62%)` }}
      >
        <TeamCrest team={teamOf(leader)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="warning">Front-runner</Badge>
            <PositionTag position={leader.position} />
          </div>
          <p className="truncate font-display text-h1 uppercase text-fg">{leader.name}</p>
          <p className="truncate text-label text-fg-muted">
            {teamOf(leader)?.location} {teamOf(leader)?.name}
          </p>
        </div>
        <RarityChip ovr={leader.ovr} />
      </button>

      {/* Chasing pack */}
      <ul>
        {rest.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className="flex w-full items-center gap-3 border-b border-line-subtle px-5 py-2.5 text-left transition-colors last:border-0 hover:bg-surface-hover"
            >
              <span className="w-4 shrink-0 text-label tabular-nums text-fg-faint">{i + 2}</span>
              <TeamCrest team={teamOf(p)} size="xs" decorative />
              <PositionTag position={p.position} />
              <span className="min-w-0 flex-1 truncate text-label text-fg-secondary">{p.name}</span>
              <span className="shrink-0 text-label tabular-nums text-fg-muted">{p.ovr}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Awards() {
  const rosters = useGameStore(s => s.rosters);
  const userTeamId = useGameStore(s => s.userTeamId);
  const year = useGameStore(s => s.year);
  const seasonHistory = useGameStore(s => s.seasonHistory) || [];
  const franchiseRecords = useGameStore(s => s.franchiseRecords) || {};
  const ownerReviews = useGameStore(s => s.owner?.reviews);
  const standingsRaw = useGameStore(s => s.standings);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [activeTab, setActiveTab] = useState('awards');

  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const awards = useMemo(() => getAwardRaces(rosters, TEAMS, standingsRaw || {}), [rosters, standingsRaw]);
  const leaders = useMemo(() => getStatLeaders(rosters, TEAMS), [rosters]);

  const champSeasons = seasonHistory.filter(h => h.seasonRecap?.winner === userTeamId);
  const playoffSeasons = seasonHistory.filter(h =>
    h.seasonRecap?.winner !== userTeamId &&
    (h.seasonRecap?.playoffTeams?.includes(userTeamId) || h.seasonRecap?.finalist === userTeamId));

  const recordRows = [
    franchiseRecords.mostPointsGame && { label: 'Most points in a game', val: franchiseRecords.mostPointsGame },
    franchiseRecords.biggestWinMargin > 0 && { label: 'Biggest win margin', val: `+${franchiseRecords.biggestWinMargin}` },
    franchiseRecords.fewestPointsAllowed < 999 && { label: 'Fewest points allowed', val: franchiseRecords.fewestPointsAllowed },
    franchiseRecords.mostWins && { label: 'Most wins in a season', val: franchiseRecords.mostWins },
  ].filter(Boolean);

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="League awards"
        eyebrow={`${userTeam?.location ?? ''} · ${year} season`}
        team={userTeam}
        actions={champSeasons.length > 0 && (
          <Badge tone="warning">{champSeasons.length}× champion</Badge>
        )}
        tabs={
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            label="Awards views"
            items={[
              { id: 'awards', label: 'Trophy races' },
              { id: 'stats', label: 'Stat leaders' },
              { id: 'franchise', label: 'Franchise' },
              { id: 'achievements', label: 'Achievements' },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-content px-6 py-6">
        {/* ── TROPHY RACES ── */}
        {activeTab === 'awards' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {Object.keys(AWARD_META).map(key => (
              <AwardRace key={key} awardKey={key} players={awards[key]} onSelect={setSelectedPlayer} />
            ))}
          </div>
        )}

        {/* ── STAT LEADERS ── */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {LEADER_META.map(({ key, label, stat }) => {
              const list = leaders[key] || [];
              if (!list.length) return null;
              return (
                <Card key={key}>
                  <CardHeader title={label} />
                  <ul>
                    {list.map((p, i) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayer(p)}
                          className={cx(
                            'flex w-full items-center gap-2.5 border-b border-line-subtle px-4 py-2.5 text-left',
                            'transition-colors last:border-0 hover:bg-surface-hover',
                            p.teamId === userTeamId && 'bg-team-8',
                          )}
                        >
                          <span className="w-3 shrink-0 text-label tabular-nums text-fg-faint">{i + 1}</span>
                          <TeamCrest team={teamOf(p)} size="xs" decorative />
                          <span className="min-w-0 flex-1 truncate text-label text-fg-secondary">{p.name}</span>
                          <span className={cx('shrink-0 tabular-nums', i === 0 ? 'font-display text-h3 text-fg' : 'text-label text-fg-muted')}>
                            {p.stats?.season?.[stat] ?? 0}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'achievements' && <AchievementsPanel />}

        {/* ── FRANCHISE ── */}
        {activeTab === 'franchise' && (
          <div className="flex flex-col gap-4">
            {/* Trophy case: earned trophies gold, the rest empty plinths to fill */}
            <Card>
              <CardHeader title="Trophy case" eyebrow={`${champSeasons.length} championship${champSeasons.length === 1 ? '' : 's'}`} />
              <CardBody className="flex flex-wrap gap-3">
                {Array.from({ length: Math.max(5, champSeasons.length + 2) }, (_, i) => {
                  const won = champSeasons[i];
                  return (
                    <div
                      key={i}
                      className={cx(
                        'flex h-28 w-24 flex-col items-center justify-center gap-1.5 rounded-panel border',
                        won ? 'border-rarity-gold' : 'border-dashed border-line-subtle',
                      )}
                      style={won ? { background: 'linear-gradient(160deg, var(--rarity-gold-wash), transparent 70%)' } : undefined}
                      title={won ? `Champions — ${won.year ?? ''}` : 'Not yet won'}
                    >
                      <span className={cx('text-h1', !won && 'opacity-15')} aria-hidden="true">🏆</span>
                      <span className={cx('text-micro uppercase', won ? 'text-rarity-gold' : 'text-fg-faint')}>
                        {won ? (won.year ?? 'Champion') : 'Empty'}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Franchise records" />
                {recordRows.length ? (
                  <CardBody className="grid grid-cols-2 gap-4">
                    {recordRows.map(r => <Stat key={r.label} value={r.val} label={r.label} size="sm" />)}
                  </CardBody>
                ) : (
                  <EmptyState size="sm" icon="📈" title="No records yet" body="They start filling in after your first games." />
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Season history"
                  eyebrow={`${seasonHistory.length} season${seasonHistory.length === 1 ? '' : 's'} · ${playoffSeasons.length} playoff berths`}
                />
                {seasonHistory.length ? (
                  <ul>
                    {[...seasonHistory].reverse().map((h, i) => {
                      const champion = h.seasonRecap?.winner === userTeamId;
                      const playoffs = h.seasonRecap?.playoffTeams?.includes(userTeamId);
                      return (
                        <li key={i} className="flex items-center gap-3 border-b border-line-subtle px-4 py-3 last:border-0">
                          <span className="w-12 shrink-0 text-label tabular-nums text-fg-faint">{h.year ?? '—'}</span>
                          <span className="flex-1 text-label text-fg-secondary">
                            {champion ? 'Won the championship' : playoffs ? 'Made the playoffs' : 'Missed the playoffs'}
                          </span>
                          {h.record && <span className="text-label tabular-nums text-fg-muted">{h.record.wins}-{h.record.losses}{h.record.ties ? `-${h.record.ties}` : ''}</span>}
                          {(() => { const r = ownerReviews?.find(x => x.year === h.year); return r && <Badge tone={r.grade <= 'B' ? 'positive' : r.grade === 'C' ? 'neutral' : 'negative'}>Owner: {r.grade}</Badge>; })()}
                          {champion && <Badge tone="warning">Champions</Badge>}
                          {!champion && playoffs && <Badge tone="positive">Playoffs</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState size="sm" icon="📜" title="First season underway" body="Your history starts here." />
                )}
              </Card>
            </div>
          </div>
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
