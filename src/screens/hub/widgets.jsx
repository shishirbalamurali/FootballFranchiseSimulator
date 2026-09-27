import {
  Card, CardHeader, CardBody, Button, TeamCrest, Stat, Badge, RarityChip, cx,
} from '../../components/ui';
import { TEAMS } from '../../data/teams';
import { useGameStore } from '../../store/gameStore';
import PlayerIdentity from '../../components/PlayerIdentity';
import PlayerFace from '../../components/PlayerFace';

// Hub widgets. The governing rule after the rebuild: a widget that has no data
// yet renders NOTHING — it returns null and the grid closes up. On a fresh
// save the old Hub showed eight grey "No X yet" boxes.

// ── Status strip ────────────────────────────────────────────────────────────
// One row of franchise vitals. Replaces four separate cards (identity, cap,
// coach, season progress) that each cost a full card of vertical space to say
// one number.

function StripCell({ label, value, tone, caption, bar, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'flex min-w-0 flex-col justify-center gap-0.5 px-4 py-3 text-left',
        onClick && 'transition-colors hover:bg-surface-hover',
      )}
    >
      <span className="truncate text-micro uppercase text-fg-faint">{label}</span>
      <span className="truncate font-display text-h1 leading-none tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {bar != null && (
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <span className="block h-full rounded-full transition-[width] duration-slow"
                style={{ width: `${Math.max(0, Math.min(100, bar))}%`, background: tone || 'var(--team-primary)' }} />
        </span>
      )}
      {caption && <span className="truncate text-micro text-fg-muted">{caption}</span>}
    </Tag>
  );
}

export function StatusStrip({
  record, streak, ovr, off, def, morale, cap, coachLevel, xpInfo,
  playbook, phase, week, onNavigate,
}) {
  const moraleLabel =
    morale >= 85 ? 'Fired up' : morale >= 70 ? 'Locked in' :
    morale >= 50 ? 'Steady'   : morale >= 35 ? 'Shaky'     : 'Broken';
  const moraleTone =
    morale >= 70 ? 'var(--positive-fg)' : morale >= 50 ? 'var(--warning-fg)' : 'var(--negative-fg)';
  const capTone = cap.overCap ? 'var(--negative-fg)' : cap.space < 20 ? 'var(--warning-fg)' : 'var(--positive-fg)';

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-line-subtle sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        <StripCell
          label="Record"
          value={record}
          caption={streak ? (streak > 0 ? `Won ${streak} straight` : `Lost ${Math.abs(streak)} straight`) : 'Season record'}
        />
        <StripCell label="Team rating" value={ovr} caption={`${off} off · ${def} def`} onClick={() => onNavigate('roster')} />
        <StripCell label="Morale" value={moraleLabel} tone={moraleTone} bar={morale} />
        <StripCell
          label="Cap space"
          value={cap.overCap ? `-$${Math.abs(cap.space)}M` : `$${cap.space}M`}
          tone={capTone}
          caption={`$${cap.used}M of $${cap.total}M used`}
          onClick={() => onNavigate('roster')}
        />
        <StripCell
          label="Coach"
          value={`Lv ${coachLevel}`}
          caption={coachLevel < 10 ? `${xpInfo.current}/${xpInfo.needed} XP to Lv ${coachLevel + 1}` : 'Max level'}
          bar={coachLevel < 10 ? xpInfo.pct : 100}
          onClick={() => onNavigate('development')}
        />
        <StripCell
          label={phase === 'regular' ? `Week ${week} of 18` : 'Playbook'}
          value={playbook?.name ?? 'Playbook'}
          bar={phase === 'regular' ? ((week - 1) / 18) * 100 : null}
          onClick={() => onNavigate('playbook')}
        />
      </div>
    </Card>
  );
}

// ── Division ────────────────────────────────────────────────────────────────
export function DivisionCard({ teams, userTeamId, conference, division, onNavigate }) {
  return (
    <Card>
      <CardHeader
        title={`${conference} ${division}`}
        eyebrow="Division"
        action={<Button variant="ghost" size="sm" onClick={() => onNavigate('standings')}>Standings</Button>}
      />
      <ul>
        {teams.map((t, i) => {
          const isUser = t.id === userTeamId;
          return (
            <li
              key={t.id}
              className={cx(
                'flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-0',
                isUser && 'bg-team-8',
              )}
            >
              <span className="w-3 shrink-0 text-micro tabular-nums text-fg-faint">{i + 1}</span>
              <TeamCrest team={t} size="xs" decorative />
              <span className={cx('flex-1 truncate text-label', isUser ? 'font-bold text-fg' : 'text-fg-secondary')}>
                {t.abbreviation}
              </span>
              <span className="shrink-0 text-label tabular-nums text-fg-muted">
                {t.record.wins}-{t.record.losses}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Roster grades ───────────────────────────────────────────────────────────
export function RosterGradesCard({ grades, onNavigate }) {
  if (!grades.units.length) return null;
  return (
    <Card>
      <CardHeader
        title="Roster grades"
        eyebrow="Versus league average"
        action={
          <div className="flex items-center gap-2">
            <span className="font-display text-h2" style={{ color: grades.overall.color }}>
              {grades.overall.letter}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('roster')}>Roster</Button>
          </div>
        }
      />
      <CardBody className="flex flex-col gap-2.5">
        {grades.units.map(u => (
          <div key={u.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-label text-fg-muted">{u.label}</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              {/* centre tick = league average */}
              <span className="absolute inset-y-0 left-1/2 w-px bg-fg/20" />
              <div className="h-full rounded-full transition-[width] duration-slow ease-out"
                   style={{ width: `${u.pct}%`, backgroundColor: u.color }} />
            </div>
            <span className="w-7 shrink-0 text-right font-display text-h3" style={{ color: u.color }}>{u.letter}</span>
            <span className="w-7 shrink-0 text-right text-label tabular-nums text-fg-faint">{u.ovr}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

// ── Weekly objectives ───────────────────────────────────────────────────────
export function ObjectivesCard({ objectives, completed, phase }) {
  if (phase !== 'regular') return null;
  return (
    <Card>
      <CardHeader
        title="This week's objectives"
        eyebrow={`${completed.length} of ${objectives.length} met`}
      />
      {/* One row, not a stack: three short lines do not need three card rows. */}
      <ul className="grid grid-cols-1 divide-y divide-line-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {objectives.map(obj => {
          const done = completed.includes(obj.id);
          return (
            <li key={obj.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className={cx(
                'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                done ? 'border-positive-fg bg-positive-fg text-n-950' : 'border-line text-transparent',
              )}>✓</span>
              <span className={cx('min-w-0 flex-1 text-label', done ? 'text-fg-muted line-through' : 'text-fg')}>
                {obj.text}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Team leaders ────────────────────────────────────────────────────────────
export function TeamLeadersCard({ leaders, onNavigate }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  // Self-hiding: before week 2 nobody has stats, so there is nothing to say.
  if (!leaders.length) return null;
  return (
    <Card>
      <CardHeader title="Team leaders"
        action={<Button variant="ghost" size="sm" onClick={() => onNavigate('stats')}>All stats</Button>} />
      <ul className="divide-y divide-line-subtle">
        {leaders.map(({ p, stat }) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid min-w-9 shrink-0 place-items-center rounded-chip bg-surface-sunken px-1.5 py-0.5 text-micro uppercase text-fg-secondary">
              {p.position}
            </span>
            <PlayerIdentity player={p} teamId={userTeamId} own sub={stat} className="flex-1 text-label" />
            <RarityChip ovr={p.ovr} showOvr />
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Around the league ───────────────────────────────────────────────────────
export function LastScoresCard({ scores, week, userTeamId }) {
  if (!scores.length) return null;
  // `week` resets to 1 for the postseason, which used to render "Week 0 results".
  const title = week > 1 ? `Week ${week - 1} results` : 'Latest results';
  return (
    <Card>
      <CardHeader title={title} eyebrow="Around the league" />
      <ul className="max-h-80 divide-y divide-line-subtle overflow-y-auto">
        {scores.map((g, i) => {
          const home = TEAMS.find(t => t.id === g.homeTeamId);
          const away = TEAMS.find(t => t.id === g.awayTeamId);
          const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId;
          const homeWon = g.winnerId === g.homeTeamId;
          return (
            <li key={i} className={cx('flex items-center gap-2 px-4 py-2', isUserGame && 'bg-team-8')}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TeamCrest team={away} size="xs" decorative />
                <span className={cx('truncate text-label', homeWon ? 'text-fg-muted' : 'font-semibold text-fg')}>
                  {away?.abbreviation}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className={cx('w-6 text-right text-label', homeWon ? 'text-fg-muted' : 'font-bold text-fg')}>{g.awayScore}</span>
                <span className="text-fg-faint">–</span>
                <span className={cx('w-6 text-label', homeWon ? 'font-bold text-fg' : 'text-fg-muted')}>{g.homeScore}</span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span className={cx('truncate text-label', homeWon ? 'font-semibold text-fg' : 'text-fg-muted')}>
                  {home?.abbreviation}
                </span>
                <TeamCrest team={home} size="xs" decorative />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Player of the week ──────────────────────────────────────────────────────
export function PlayerOfWeekCard({ potw }) {
  if (!potw?.player) return null;
  const team = TEAMS.find(t => t.id === potw.teamId);
  return (
    <Card>
      <CardHeader title="Player of the week" eyebrow={`Week ${potw.week}`} />
      <CardBody className="flex items-center gap-4">
        <PlayerFace player={potw.player} teamId={potw.teamId} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-h3 text-fg">{potw.player.name}</p>
          <p className="truncate text-label text-fg-muted">{team?.abbreviation} · {potw.player.position}</p>
        </div>
        <span className="shrink-0 text-right text-label font-semibold tabular-nums text-warning-fg">
          {potw.statLine}
        </span>
      </CardBody>
    </Card>
  );
}

// ── Playoff race ────────────────────────────────────────────────────────────
export function PlayoffRaceCard({ race, userTeamId, conference, week }) {
  // Meaningless before the picture takes shape.
  if (!race || week < 8) return null;
  return (
    <Card>
      <CardHeader
        title="Playoff race"
        eyebrow={`${conference} · seed ${race.rank}`}
        action={<Badge tone={race.inPlayoffs ? 'positive' : 'warning'}>
          {race.inPlayoffs ? 'In the field' : 'On the bubble'}
        </Badge>}
      />
      <ul className="divide-y divide-line-subtle">
        {race.top7.map((t, i) => {
          const isUser = t.id === userTeamId;
          return (
            <li key={t.id} className={cx('flex items-center gap-3 px-4 py-2', isUser && 'bg-team-8')}>
              <span className="w-3 shrink-0 text-micro tabular-nums text-fg-faint">{i + 1}</span>
              <TeamCrest team={t} size="xs" decorative />
              <span className={cx('flex-1 truncate text-label', isUser ? 'font-bold text-fg' : 'text-fg-secondary')}>
                {t.abbreviation}
              </span>
              <span className="shrink-0 text-label tabular-nums text-fg-muted">{t.s.wins}-{t.s.losses}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Franchise records ───────────────────────────────────────────────────────
export function FranchiseRecordsCard({ records }) {
  const rows = [
    records.mostPointsGame && { label: 'Most points, game', val: records.mostPointsGame },
    records.biggestWinMargin > 0 && { label: 'Biggest win', val: `+${records.biggestWinMargin}` },
    records.fewestPointsAllowed < 999 && { label: 'Fewest allowed', val: records.fewestPointsAllowed },
    records.mostWins && { label: 'Most wins, season', val: records.mostWins },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title="Franchise records" />
      <CardBody className="grid grid-cols-2 gap-3">
        {rows.map(r => <Stat key={r.label} value={r.val} label={r.label} size="sm" />)}
      </CardBody>
    </Card>
  );
}

// ── Season history ──────────────────────────────────────────────────────────
export function SeasonHistoryCard({ history, year, userTeamId }) {
  if (!history?.length) return null;
  return (
    <Card>
      <CardHeader title="Season history" />
      <ul className="divide-y divide-line-subtle">
        {[...history].reverse().slice(0, 6).map((h, i) => {
          const champion = h.seasonRecap?.winner === userTeamId;
          const playoffs = h.seasonRecap?.playoffTeams?.includes(userTeamId);
          return (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-10 shrink-0 text-label tabular-nums text-fg-faint">
                {h.year ?? year - history.length + i}
              </span>
              <span className="flex-1 text-label text-fg-secondary">
                {champion ? 'Champions' : playoffs ? 'Made the playoffs' : 'Missed the playoffs'}
              </span>
              {champion && <Badge tone="warning">Title</Badge>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
