import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Badge, TeamCrest,
  Stat, StatRow, Meter, EmptyState, cx, IconArrowRight,
} from '../components/ui';

const STATUS = {
  win:      { label: 'W', tone: 'positive', color: 'var(--positive-fg)' },
  loss:     { label: 'L', tone: 'negative', color: 'var(--negative-fg)' },
  tie:      { label: 'T', tone: 'warning',  color: 'var(--warning-fg)'  },
  upcoming: { label: '·', tone: 'neutral',  color: 'var(--n-600)'       },
  bye:      { label: 'BYE', tone: 'neutral', color: 'var(--n-700)'      },
};

export default function Schedule() {
  const schedule = useGameStore(s => s.schedule);
  const currentWeek = useGameStore(s => s.week);
  const userTeamId = useGameStore(s => s.userTeamId);
  const standings = useGameStore(s => s.standings);
  const teamRatings = useGameStore(s => s.teamRatings);
  const [viewWeek, setViewWeek] = useState(Math.min(18, currentWeek));

  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const getTeam = (id) => TEAMS.find(t => t.id === id);
  const getRecord = (id) => {
    const s = standings[id];
    return s ? `${s.wins}-${s.losses}` : '0-0';
  };

  const weekSummaries = useMemo(() => (schedule || []).map((games, idx) => {
    const wk = idx + 1;
    const game = games.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);
    if (!game) return { wk, status: 'bye', game: null };
    if (!game.played) return { wk, status: 'upcoming', game };
    const tied = game.winnerId === null;
    return { wk, status: tied ? 'tie' : game.winnerId === userTeamId ? 'win' : 'loss', game };
  }), [schedule, userTeamId]);

  const wins = weekSummaries.filter(w => w.status === 'win').length;
  const losses = weekSummaries.filter(w => w.status === 'loss').length;
  const ties = weekSummaries.filter(w => w.status === 'tie').length;
  const gamesPlayed = wins + losses + ties;

  const { pointsFor, pointsAgainst } = useMemo(() => weekSummaries.reduce((acc, w) => {
    if (!w.game?.played) return acc;
    const isHome = w.game.homeTeamId === userTeamId;
    acc.pointsFor += isHome ? w.game.homeScore : w.game.awayScore;
    acc.pointsAgainst += isHome ? w.game.awayScore : w.game.homeScore;
    return acc;
  }, { pointsFor: 0, pointsAgainst: 0 }), [weekSummaries, userTeamId]);

  const remainingOpps = weekSummaries
    .filter(w => w.status === 'upcoming' && w.game)
    .map(w => {
      const oppId = w.game.homeTeamId === userTeamId ? w.game.awayTeamId : w.game.homeTeamId;
      return Math.round(teamRatings?.[oppId]?.overall ?? 75);
    });
  const avgOppOvr = remainingOpps.length
    ? Math.round(remainingOpps.reduce((s, v) => s + v, 0) / remainingOpps.length)
    : null;
  const sos = avgOppOvr === null ? null
    : avgOppOvr >= 78 ? { text: 'Hard', tone: 'negative' }
    : avgOppOvr >= 73 ? { text: 'Medium', tone: 'warning' }
    : { text: 'Easy', tone: 'positive' };

  const upcoming = weekSummaries.filter(w => w.status === 'upcoming' && w.game).slice(0, 5);
  const currentGames = schedule?.[viewWeek - 1] || [];
  const selected = weekSummaries[viewWeek - 1];

  if (!schedule?.length) {
    return (
      <div className="min-h-full bg-surface-base">
        <PageHeader title="Schedule" team={userTeam} />
        <div className="mx-auto max-w-content px-6 py-12">
          <Card><EmptyState icon="📅" title="No schedule yet" body="Start a franchise to generate the season." /></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Schedule"
        eyebrow={`${userTeam?.location} ${userTeam?.name} · ${schedule.length}-game season`}
        team={userTeam}
        actions={gamesPlayed > 0 && (
          <div className="text-right">
            <p className="font-display text-h1 tabular-nums text-fg">
              {wins}-{losses}{ties ? `-${ties}` : ''}
            </p>
            <p className="text-micro uppercase text-fg-muted">Record</p>
          </div>
        )}
      />

      <div className="mx-auto max-w-content px-6 py-6">
        {/* ── Season strip: the whole season at a glance ── */}
        <Card className="mb-4">
          <CardHeader
            title="Season at a glance"
            eyebrow="Click a week to see the full slate"
            action={sos && <Badge tone={sos.tone}>Remaining SOS: {sos.text}</Badge>}
          />
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {weekSummaries.map(w => {
                const st = STATUS[w.status];
                const isCurrent = w.wk === currentWeek;
                const isSelected = w.wk === viewWeek;
                const oppId = w.game
                  ? (w.game.homeTeamId === userTeamId ? w.game.awayTeamId : w.game.homeTeamId)
                  : null;
                const opp = oppId ? getTeam(oppId) : null;
                const isHome = w.game?.homeTeamId === userTeamId;
                const score = w.game?.played
                  ? (isHome ? `${w.game.homeScore}-${w.game.awayScore}` : `${w.game.awayScore}-${w.game.homeScore}`)
                  : null;
                return (
                  <button
                    key={w.wk}
                    type="button"
                    onClick={() => setViewWeek(w.wk)}
                    aria-current={isSelected ? 'true' : undefined}
                    title={opp ? `Week ${w.wk} ${isHome ? 'vs' : '@'} ${opp.location} ${opp.name}${score ? ` — ${score}` : ''}` : `Week ${w.wk} — bye`}
                    className={cx(
                      'group relative flex w-[58px] flex-col items-center gap-1 rounded-card border px-1.5 py-2 transition-colors duration-micro',
                      isSelected ? 'border-team bg-team-16' : 'border-line-subtle hover:border-line hover:bg-surface-hover',
                    )}
                  >
                    <span className="text-micro uppercase text-fg-faint">
                      {isCurrent ? 'NOW' : `W${w.wk}`}
                    </span>
                    {opp ? <TeamCrest team={opp} size={22} decorative /> : <span className="h-[22px] text-label text-fg-faint">—</span>}
                    <span
                      className="text-label font-bold tabular-nums"
                      style={{ color: st.color }}
                    >
                      {w.status === 'bye' ? 'BYE' : score ?? (isHome ? 'vs' : '@')}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardBody>
          {gamesPlayed > 0 && (
            <CardBody className="border-t border-line-subtle">
              <StatRow className="flex-wrap gap-8">
                <Stat size="sm" value={pointsFor} label="Points for" />
                <Stat size="sm" value={pointsAgainst} label="Points against" />
                <Stat size="sm" value={(pointsFor / gamesPlayed).toFixed(1)} label="Points per game" />
                <Stat size="sm" value={pointsFor - pointsAgainst > 0 ? `+${pointsFor - pointsAgainst}` : pointsFor - pointsAgainst}
                      label="Differential"
                      tone={pointsFor >= pointsAgainst ? 'var(--positive-fg)' : 'var(--negative-fg)'} />
                {avgOppOvr && <Stat size="sm" value={avgOppOvr} label="Avg opp rating" />}
              </StatRow>
            </CardBody>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ── Next up ── */}
          <Card className="lg:col-span-1">
            <CardHeader title="Next up" eyebrow="Your next five games" />
            {upcoming.length ? (
              <ul>
                {upcoming.map(w => {
                  const isHome = w.game.homeTeamId === userTeamId;
                  const opp = getTeam(isHome ? w.game.awayTeamId : w.game.homeTeamId);
                  const oppOvr = Math.round(teamRatings?.[opp?.id]?.overall ?? 75);
                  const myOvr = Math.round(teamRatings?.[userTeamId]?.overall ?? 75);
                  const edge = myOvr - oppOvr;
                  return (
                    <li key={w.wk}>
                      <button
                        type="button"
                        onClick={() => setViewWeek(w.wk)}
                        className="flex w-full items-center gap-3 border-b border-line-subtle px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-hover"
                      >
                        <span className="w-8 shrink-0 text-micro uppercase text-fg-faint">W{w.wk}</span>
                        <TeamCrest team={opp} size="sm" decorative />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-label font-semibold text-fg">
                            {isHome ? '' : '@ '}{opp?.location} {opp?.name}
                          </p>
                          <p className="text-label text-fg-muted">
                            {isHome ? 'Home' : 'Away'} · {getRecord(opp?.id)} · OVR {oppOvr}
                          </p>
                        </div>
                        <Badge tone={edge >= 5 ? 'positive' : edge <= -5 ? 'negative' : 'neutral'}>
                          {edge >= 5 ? 'Favored' : edge <= -5 ? 'Underdog' : 'Even'}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState size="sm" icon="🏁" title="Regular season complete" />
            )}
          </Card>

          {/* ── Week slate ── */}
          <Card className="lg:col-span-2">
            <CardHeader
              title={`Week ${viewWeek}`}
              eyebrow="Full league slate"
              action={
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={viewWeek <= 1}
                          onClick={() => setViewWeek(w => Math.max(1, w - 1))} aria-label="Previous week">←</Button>
                  <Button variant="ghost" size="sm" disabled={viewWeek >= schedule.length}
                          onClick={() => setViewWeek(w => Math.min(schedule.length, w + 1))} aria-label="Next week">→</Button>
                </div>
              }
            />
            {selected?.status === 'bye' && (
              <div className="border-b border-line-subtle bg-surface-sunken px-4 py-2.5">
                <p className="text-label text-fg-muted">You are on a bye in week {viewWeek}.</p>
              </div>
            )}
            <ul>
              {currentGames.map((g, i) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId;
                const homeWon = g.played && g.winnerId === g.homeTeamId;
                const awayWon = g.played && g.winnerId === g.awayTeamId;
                return (
                  <li
                    key={i}
                    className={cx(
                      'flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-0',
                      isUserGame && 'bg-team-8',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <TeamCrest team={away} size="xs" decorative />
                      <span className={cx('truncate text-label', awayWon ? 'font-bold text-fg' : g.played ? 'text-fg-muted' : 'text-fg-secondary')}>
                        {away?.abbreviation}
                      </span>
                      <span className="text-label text-fg-faint">{getRecord(away?.id)}</span>
                    </div>

                    <div className="shrink-0 text-center">
                      {g.played ? (
                        <span className="text-label font-bold tabular-nums text-fg">
                          {g.awayScore} – {g.homeScore}
                        </span>
                      ) : (
                        <span className="text-micro uppercase text-fg-faint">@</span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <span className="text-label text-fg-faint">{getRecord(home?.id)}</span>
                      <span className={cx('truncate text-label', homeWon ? 'font-bold text-fg' : g.played ? 'text-fg-muted' : 'text-fg-secondary')}>
                        {home?.abbreviation}
                      </span>
                      <TeamCrest team={home} size="xs" decorative />
                    </div>

                    {isUserGame && <Badge tone="team" className="shrink-0">You</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
