import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import WeeklyPreparation from './WeeklyPreparation';
import {
  Modal, Button, Badge, TeamCrest, SplitMeter, Stat, PositionTag, cx,
  IconFastForward,
} from './ui';

function SideColumn({ team, record, ovr, off, def, injuries, align }) {
  return (
    <div className={cx('flex min-w-0 flex-1 flex-col gap-3', align === 'right' && 'items-end text-right')}>
      <TeamCrest team={team} size="xl" />
      <div className="min-w-0">
        <p className="truncate text-micro uppercase text-fg-muted">{team?.location}</p>
        <p className="truncate font-display text-h1 uppercase leading-tight text-fg">{team?.name}</p>
        <p className="text-label tabular-nums text-fg-secondary">{record}</p>
      </div>
      <div className={cx('flex gap-4', align === 'right' && 'flex-row-reverse')}>
        <Stat size="sm" value={ovr} label="OVR" align={align === 'right' ? 'right' : 'left'} />
        <Stat size="sm" value={off} label="OFF" align={align === 'right' ? 'right' : 'left'} />
        <Stat size="sm" value={def} label="DEF" align={align === 'right' ? 'right' : 'left'} />
      </div>
      {injuries.length > 0 && (
        <div className={cx('flex flex-wrap gap-1', align === 'right' && 'justify-end')}>
          {injuries.slice(0, 3).map((i, idx) => (
            <Badge key={idx} tone="negative">{i.position} out</Badge>
          ))}
          {injuries.length > 3 && <Badge tone="neutral">+{injuries.length - 3}</Badge>}
        </div>
      )}
    </div>
  );
}

export default function MatchupPreview({
  game, userTeamId, standings, teamRatings, onSimulate, onCancel, week,
}) {
  const injuries = useGameStore(s => s.injuries) || [];

  const userIsHome = game?.homeTeamId === userTeamId;
  const oppTeamId = userIsHome ? game?.awayTeamId : game?.homeTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const oppTeam = TEAMS.find(t => t.id === oppTeamId);

  // ── Bye week ──
  if (!game || !oppTeam) {
    return (
      <Modal
        open
        onClose={onCancel}
        size="sm"
        eyebrow={`Week ${week}`}
        title="Bye week"
        footer={
          <>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={() => onSimulate('board')}>Advance the week</Button>
          </>
        }
      >
        <p className="text-body text-fg-secondary">
          No game this week. Your players get a rest — advance to move the season on.
        </p>
      </Modal>
    );
  }

  const rec = (id) => { const s = standings[id]; return s ? `${s.wins}-${s.losses}` : '0-0'; };
  const rating = (id, key) => Math.round(
    key ? (teamRatings[id]?.[key]?.overall ?? 75) : (teamRatings[id]?.overall ?? 75));

  const userOvr = rating(userTeamId);
  const oppOvr = rating(oppTeamId);
  const winProb = Math.max(10, Math.min(90, Math.round(50 + (userOvr - oppOvr) * 1.8)));
  const probLabel = winProb >= 65 ? 'Favored' : winProb >= 50 ? 'Slight edge'
    : winProb >= 35 ? 'Underdog' : 'Heavy underdog';
  const probTone = winProb >= 65 ? 'positive' : winProb >= 50 ? 'warning' : 'negative';

  const isDivision = userTeam?.conference === oppTeam?.conference && userTeam?.division === oppTeam?.division;
  const isConference = userTeam?.conference === oppTeam?.conference && !isDivision;

  return (
    <Modal
      open
      onClose={onCancel}
      size="lg"
      eyebrow={`Week ${week} · ${userIsHome ? 'home' : 'away'}`}
      title={`${userTeam?.abbreviation} vs ${oppTeam?.abbreviation}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Back</Button>
          <Button variant="secondary" size="lg" onClick={() => onSimulate('board')}>
            Sim all games
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<IconFastForward size={16} />}
            onClick={() => onSimulate('watch')}
          >
            Watch our game
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {(isDivision || isConference) && (
          <div className="flex justify-center">
            <Badge tone={isDivision ? 'warning' : 'info'}>
              {isDivision ? 'Division rivalry' : 'Conference game'}
            </Badge>
          </div>
        )}

        <div className="flex items-start gap-6">
          <SideColumn
            team={userTeam} record={rec(userTeamId)}
            ovr={userOvr} off={rating(userTeamId, 'offense')} def={rating(userTeamId, 'defense')}
            injuries={injuries.filter(i => i.teamId === userTeamId)}
          />
          <div className="shrink-0 pt-8 text-center">
            <p className="font-display text-h2 text-fg-faint">VS</p>
          </div>
          <SideColumn
            team={oppTeam} record={rec(oppTeamId)} align="right"
            ovr={oppOvr} off={rating(oppTeamId, 'offense')} def={rating(oppTeamId, 'defense')}
            injuries={injuries.filter(i => i.teamId === oppTeamId)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Badge tone={probTone}>{probLabel} · {winProb}%</Badge>
            <span className="text-label tabular-nums text-fg-muted">{100 - winProb}%</span>
          </div>
          <SplitMeter
            leftPct={winProb}
            leftColor={userTeam?.theme?.primary}
            rightColor={oppTeam?.theme?.primary}
          />
        </div>

        <WeeklyPreparation compact />
      </div>
    </Modal>
  );
}
