import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { XFactorMatchup } from './frontOffice/XFactorMatchup'; // CLAUDE
import { TEAMS } from '../data/teams';
import { gameContext, SLOT_LABEL } from '../engine/gameContext';
import { winProbability } from '../engine/gameStory';
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

const TAG_TONE = { gold: 'warning', night: 'neutral', fire: 'negative', alert: 'info', plain: 'neutral' };

/** One line on why this game is different, from the game context. */
function storyNotes(ctx, userSide, abbr) {
  if (!ctx) return [];
  const notes = [];
  const opp = 1 - userSide;
  if (ctx.slot) notes.push(`${SLOT_LABEL[ctx.slot]} Football — the whole league is watching. Bigger stage, wilder games.`);
  if (ctx.division) notes.push(ctx.favorite === userSide
    ? 'Division games play closer than the ratings say. They know your calls — don\'t get caught looking past them.'
    : 'Division games play closer than the ratings say. Familiarity is the underdog\'s best friend.');
  if (ctx.rivalry >= 2) notes.push(`${ctx.rivalryLabel}: the crowd will be loud and nobody will give an inch.`);
  if (ctx.trap?.[userSide]) notes.push(`Trap game: ${abbr[opp]} is struggling and a big one is next week. Stay focused.`);
  if (ctx.trap?.[opp]) notes.push(`${abbr[opp]} might be looking ahead to next week. Punish it.`);
  if (ctx.stakes?.[userSide] === 'bubble') notes.push('On the playoff bubble: every snap matters from here.');
  if (ctx.stakes?.[opp] === 'eliminated') notes.push(`${abbr[opp]} is out of the race. Will they show up?`);
  return notes.slice(0, 3);
}

export default function MatchupPreview({
  game, userTeamId, standings, teamRatings, onSimulate, onCancel, week,
}) {
  const injuries = useGameStore(s => s.injuries) || [];
  const rosters = useGameStore(s => s.rosters);
  const schedule = useGameStore(s => s.schedule);
  const phase = useGameStore(s => s.phase);
  const playoffBracket = useGameStore(s => s.playoffBracket);
  const seasonHistory = useGameStore(s => s.seasonHistory);
  const year = useGameStore(s => s.year);
  const ctx = useMemo(() => {
    if (!game?.homeTeamId || !game?.awayTeamId) return null;
    try {
      return gameContext({ rosters, schedule, standings, week, phase, playoffBracket, seasonHistory, year }, game.homeTeamId, game.awayTeamId);
    } catch { return null; }
  }, [game?.homeTeamId, game?.awayTeamId, rosters, schedule, standings, week, phase, playoffBracket, seasonHistory, year]);

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
  // Same spread model the broadcast's win-probability chart starts from.
  const userSide = userIsHome ? 0 : 1;
  const homeWp = ctx ? winProbability({ margin: 0, spread: ctx.spread }) : null;
  const winProb = homeWp != null
    ? Math.max(5, Math.min(95, Math.round((userIsHome ? homeWp : 1 - homeWp) * 100)))
    : Math.max(10, Math.min(90, Math.round(50 + (userOvr - oppOvr) * 1.8)));
  const abbr = userIsHome ? [userTeam?.abbreviation, oppTeam?.abbreviation] : [oppTeam?.abbreviation, userTeam?.abbreviation];
  const line = ctx && ctx.spread ? `${abbr[ctx.spread > 0 ? 0 : 1]} −${Math.abs(ctx.spread)}` : ctx ? 'Pick ’em' : null;
  const notes = storyNotes(ctx, userSide, abbr);
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
        {ctx?.tags?.length ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {ctx.tags.map(t => <Badge key={t.id} tone={TAG_TONE[t.tone] || 'neutral'}>{t.label}</Badge>)}
            {line && <Badge tone="neutral">Line: {line}</Badge>}
          </div>
        ) : (isDivision || isConference) && (
          <div className="flex justify-center">
            <Badge tone={isDivision ? 'warning' : 'info'}>
              {isDivision ? 'Division rivalry' : 'Conference game'}
            </Badge>
          </div>
        )}
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-card bg-surface-sunken px-4 py-2.5">
            {notes.map(n => <li key={n} className="text-label text-fg-secondary">• {n}</li>)}
          </ul>
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

        <XFactorMatchup userTeamId={userTeamId} oppTeamId={oppTeamId} />

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
