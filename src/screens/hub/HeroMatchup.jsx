import { Button, TeamCrest, SplitMeter, Badge, Card, cx, IconFastForward, IconArrowRight } from '../../components/ui';
import { TEAMS } from '../../data/teams';

// The Hub's centrepiece. Previously the "upcoming game" panel was a 7-row grid
// widget whose primary action sat ~1.5 screens below the fold, inside a large
// empty box. The action is now the largest control above the fold.

function TeamSide({ team, record, align = 'left' }) {
  return (
    <div className={cx('flex min-w-0 flex-1 items-center gap-4', align === 'right' && 'flex-row-reverse text-right')}>
      <div className={cx('shrink-0 transition-transform duration-base ease-bounce hover:scale-110', align === 'right' ? 'rotate-6' : '-rotate-6')}>
        <TeamCrest team={team} size="xl" />
      </div>
      <div className="min-w-0">
        <p className="text-micro uppercase text-chalk opacity-80">{team?.location}</p>
        <p className="toon-title truncate py-0.5 text-[clamp(26px,2.6vw,40px)] uppercase leading-none text-chalk">{team?.name}</p>
        <span className="mt-1 inline-block rounded-full bg-ink px-2 py-0.5 text-micro tabular-nums text-chalk">{record}</span>
      </div>
    </div>
  );
}

/** Comic-book burst behind the VS / score. */
function Burst({ children, wide = false }) {
  return (
    <div className="relative grid shrink-0 place-items-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className={cx('absolute animate-wobble', wide ? 'w-[170px]' : 'w-[108px]')}
        style={{ filter: 'drop-shadow(3px 3px 0 var(--ink))' }}
      >
        <path
          d="M50 2 58 26 80 10 74 36 98 38 78 54 94 76 68 72 66 98 50 80 34 98 32 72 6 76 22 54 2 38 26 36 20 10 42 26Z"
          fill="var(--team-accent)"
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

export default function HeroMatchup({
  phase,
  week,
  game,
  userTeam,
  oppTeam,
  userRecord,
  oppRecord,
  winProbability,
  onSimWeek,
  onWatchGame,
  onSimToWeek,
  onPrimary,
  primaryLabel,
}) {
  // Off-season / playoffs: one clear call to action, no fake matchup.
  if (phase !== 'regular' || !game || !oppTeam) {
    return (
      <Card elevation={2} className="overflow-hidden">
        <div className="toon-banner banner-scope relative flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div aria-hidden="true" className="toon-rays pointer-events-none absolute inset-[-50%] animate-[spin_60s_linear_infinite]" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="-rotate-6"><TeamCrest team={userTeam} size="2xl" /></div>
            <div>
              <p className="text-micro uppercase text-fg-muted">{userTeam?.location} {userTeam?.name}</p>
              <h2 className="toon-title py-1 text-display uppercase text-banner-title">{primaryLabel}</h2>
            </div>
            <Button variant="primary" size="lg" iconRight={<IconArrowRight size={16} />} onClick={onPrimary}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const isHome = game.homeTeamId === userTeam?.id;
  const prob = Math.round(winProbability);

  // The week's game can already be in the books while the store is still on
  // this week. Showing "Upcoming game" with a final score in the standings
  // reads as a bug, so the panel switches to a result state instead.
  const played = !!game.played;
  const myScore = isHome ? game.homeScore : game.awayScore;
  const theirScore = isHome ? game.awayScore : game.homeScore;
  const result = !played ? null
    : myScore > theirScore ? 'won' : myScore < theirScore ? 'lost' : 'tied';

  return (
    <Card elevation={2} className="overflow-hidden">
      {/* Eyebrow strip */}
      <div className="flex items-center justify-between border-b-[3px] border-ink bg-surface-raised px-5 py-2.5">
        <span className="font-display text-h3 uppercase text-fg">
          Week {week} · {played ? 'Final' : 'Upcoming game'}
        </span>
        {played
          ? <Badge tone={result === 'won' ? 'positive' : result === 'lost' ? 'negative' : 'warning'}>
              {result === 'won' ? 'Win' : result === 'lost' ? 'Loss' : 'Tie'}
            </Badge>
          : <Badge tone={isHome ? 'team' : 'neutral'}>{isHome ? 'Home' : 'Away'}</Badge>}
      </div>

      {/* Fight-card poster: each side on its own team's colour */}
      <div
        className="relative isolate overflow-hidden px-6 py-7"
        style={{
          background: `linear-gradient(104deg, ${userTeam?.theme?.primary} 0 calc(50% - 2px), var(--ink) calc(50% - 2px) calc(50% + 2px), ${oppTeam?.theme?.primary} calc(50% + 2px))`,
        }}
      >
        <div aria-hidden="true" className="toon-halftone pointer-events-none absolute inset-0 -z-10 text-ink opacity-60" />
        <div className="relative flex items-center gap-4">
          <TeamSide team={userTeam} record={userRecord} />
          {played ? (
            <Burst wide>
              <p className="font-display text-h1 tabular-nums leading-none text-team-on-accent">
                {myScore}<span className="mx-1.5 opacity-60">–</span>{theirScore}
              </p>
            </Burst>
          ) : (
            <Burst>
              <p className="font-display text-h1 leading-none text-team-on-accent">VS</p>
            </Burst>
          )}
          <TeamSide team={oppTeam} record={oppRecord} align="right" />
        </div>
      </div>

      <div className="relative px-6">

        {/* Win probability — the two team colors, so it reads instantly */}
        {!played && (
        <div className="relative py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-micro uppercase text-team-ink">
              {prob}% win probability
            </span>
            <span className="text-micro uppercase text-fg-faint">{100 - prob}%</span>
          </div>
          <SplitMeter
            leftPct={prob}
            leftColor={userTeam?.theme?.primary}
            rightColor={oppTeam?.theme?.primary}
            height="h-3.5"
          />
        </div>
        )}
      </div>

      {/* Actions — the reason this panel exists */}
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-line bg-surface-sunken px-6 py-4">
        {played && (
          <Button variant="primary" size="xl" icon={<IconFastForward size={18} />} onClick={onSimWeek}>
            Advance to week {week + 1}
          </Button>
        )}
        {!played && game && onWatchGame && (
          <Button variant="primary" size="xl" icon={<IconFastForward size={18} />} onClick={onWatchGame}>
            Watch our game
          </Button>
        )}
        {!played && (
          <Button variant={game && onWatchGame ? 'secondary' : 'primary'} size={game && onWatchGame ? 'lg' : 'xl'}
            icon={game && onWatchGame ? undefined : <IconFastForward size={18} />} onClick={onSimWeek}>
            {game && onWatchGame ? 'Sim all games' : `Sim week ${week}`}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {week <= 17 && (
            <Button variant="ghost" size="sm" onClick={() => onSimToWeek(Math.min(18, week + 3))}>
              Sim 4 weeks
            </Button>
          )}
          {week <= 17 && (
            <Button variant="ghost" size="sm" onClick={() => onSimToWeek(18)}>
              Sim to playoffs
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
