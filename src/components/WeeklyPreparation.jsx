import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { weeklyPreparation, WEEKLY_STRATEGIES, positionBattleCandidate, positionBattleInterruption } from '../engine/weeklyExperience';
import { Card, CardHeader, CardBody, Badge, Button, cx } from './ui';

function StrategyChoices({ preparation, onChoose }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card bg-surface-sunken px-3 py-3">
        <p className="text-label font-semibold text-fg">{preparation.facts[0]}</p>
        {preparation.facts.slice(1).map(fact => <p key={fact} className="mt-1 text-label text-fg-secondary">{fact}</p>)}
      </div>
      <div role="group" aria-label="Weekly game plan" className="grid gap-2 sm:grid-cols-3">
        {WEEKLY_STRATEGIES.map(strategy => {
          const selected = preparation.strategy.id === strategy.id;
          return (
            <button key={strategy.id} type="button" aria-pressed={selected} onClick={() => onChoose(strategy.id)}
              className={cx('flex min-w-0 flex-col gap-2 rounded-card border-2 p-3 text-left transition-colors hover:border-team',
                selected ? 'border-team bg-team-8' : 'border-line-subtle bg-surface-raised')}>
              <span className="text-label font-bold text-fg">{selected ? '✓ ' : ''}{strategy.label}</span>
              <span className="text-label text-fg-secondary">{strategy.description}</span>
              <span className="mt-auto text-micro text-fg-muted">{strategy.effects}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayerOption({ player, label, detail, onClick, selected, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cx('flex min-w-0 flex-col gap-1 rounded-card border-2 p-3 text-left transition-colors hover:border-team disabled:opacity-50 disabled:cursor-not-allowed',
        selected ? 'border-team bg-team-8' : 'border-line-subtle bg-surface-raised')}>
      <span className="text-micro uppercase text-fg-muted">{player.position} · Age {player.age} · {player.ovr} OVR</span>
      <span className="font-display text-h3 text-fg">{player.name}</span>
      <span className="text-label font-semibold text-team-ink">{selected ? '✓ ' : ''}{label}</span>
      <span className="text-label text-fg-secondary">{detail}</span>
    </button>
  );
}

function BattlePanel({ state, candidate, battle, canDecide, onChoose, onResolve }) {
  if (!candidate && !battle) return null;
  const source = battle || candidate;
  const active = battle?.status === 'active';
  const canResolve = ['complete', 'settled'].includes(battle?.status);
  const interruption = battle ? positionBattleInterruption(state, battle) : null;
  const isUnavailable = player => !(state.rosters?.[state.userTeamId] || []).some(p => p.id === player.id)
    || (state.injuries || []).some(i => i.playerId === player.id && i.teamId === state.userTeamId && i.weeksRemaining > 0)
    || (state.activeBoosts || []).some(b => b.type === 'rest' && b.playerId === player.id && b.weeksLeft > 0);
  return (
    <section className="flex flex-col gap-3 border-t-2 border-line-subtle pt-4" aria-label="Position evaluation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-h2 text-fg">{candidate ? 'Experience or upside?' : `${source.position} · Your decision`}</h3>
        <Badge tone={active ? 'info' : canResolve ? 'positive' : 'neutral'}>
          {candidate ? 'Two-game evaluation' : active ? `${battle.games.length} of 2 games` : battle.status === 'settled' ? 'Starter chosen' : battle.status === 'complete' ? 'Evaluation complete' : 'Evaluation ended'}
        </Badge>
      </div>
      {candidate && <p className="text-label text-fg-secondary">Give {source.rookie.name} a real chance, or back {source.veteran.name} for the next two games. Your choice sets the first player on the {source.position} depth chart for both games. It does not guarantee a rating increase.</p>}
      {candidate && (
        <div className="grid gap-2 sm:grid-cols-2">
          <PlayerOption player={source.rookie} label="Give the prospect two games" detail="Trade experience for a chance to see what your young player can do." onClick={() => onChoose('rookie')} />
          <PlayerOption player={source.veteran} label="Back the veteran for two games" detail="Keep the stronger rating in the lead role; the prospect waits." onClick={() => onChoose('veteran')} />
        </div>
      )}
      {battle && <p role="status" className="text-label text-fg-secondary">{interruption || battle.summary || `${battle[battle.choice].name} leads the depth chart for the next two games. Bye weeks do not count.`}</p>}
      {!!battle?.games?.length && (
        <ol className="flex flex-col gap-2" aria-label="Evaluation performances">
          {battle.games.map(game => <li key={game.key} className="rounded-card bg-surface-sunken px-3 py-2">
            <p className="text-micro text-fg-muted">{game.playerName || 'Evaluation'} · Week {game.week} · {game.opponentName}</p>
            <p className="text-label font-semibold text-fg">{game.statLine}</p>
          </li>)}
        </ol>
      )}
      {canResolve && canDecide && (
        <>
          <p className="text-label text-fg-secondary">Who leads this position for the rest of the regular season? You can change your choice later.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {['rookie', 'veteran'].map(choice => <PlayerOption key={choice} player={source[choice]}
              label={isUnavailable(source[choice]) ? 'Currently unavailable' : 'Choose as starter'}
              detail={choice === 'rookie' ? 'Keep giving the young player the lead role.' : 'Rely on the veteran in the lead role.'}
              selected={battle.status === 'settled' && battle.choice === choice}
              disabled={isUnavailable(source[choice])} onClick={() => onResolve(choice)} />)}
          </div>
          <Button variant="ghost" size="sm" className="self-start" onClick={() => onResolve('auto')}>Use automatic depth order</Button>
        </>
      )}
      {active && <p className="text-micro text-fg-muted">The commitment lasts two games. An injury to your chosen player or a roster move can end it early.</p>}
    </section>
  );
}

export default function WeeklyPreparation({ compact = false }) {
  // Subscribe to the stable store snapshot, then derive allocating helpers outside the selector.
  const state = useGameStore();
  const [error, setError] = useState(null);
  const preparation = weeklyPreparation(state);
  const candidate = positionBattleCandidate(state);
  const battle = state.positionBattle?.teamId === state.userTeamId && state.positionBattle?.year === state.year ? state.positionBattle : null;
  if (state.phase !== 'regular' || (!preparation && !battle)) return null;
  const act = (action, choice) => {
    const result = action(choice);
    setError(result?.ok ? null : { week: state.week, text: result?.reason || 'This choice is no longer available.' });
  };
  const body = <div className="flex flex-col gap-4">
    {preparation ? <StrategyChoices preparation={preparation} onChoose={state.setWeekStrategy} />
      : <p className="text-label text-fg-secondary">No game this week. Your evaluation stays here; bye weeks do not use a game.</p>}
    <BattlePanel state={state} candidate={candidate} battle={battle} canDecide={!!preparation}
      onChoose={choice => act(state.choosePositionBattle, choice)} onResolve={choice => act(state.resolvePositionBattle, choice)} />
    {error?.week === state.week && <p role="alert" className="text-label text-negative-fg">{error.text}</p>}
    <details className="text-label text-fg-muted">
      <summary className="cursor-pointer">What happens when I sim ahead?</summary>
      <p className="mt-2">Your current game plan carries forward. If you skip an evaluation, normal depth order stays in use. An active evaluation runs for two games, then normal depth order resumes until you choose a starter. A chosen starter stays in place while available for the rest of this regular season.</p>
    </details>
  </div>;
  if (compact) return <section aria-label="Weekly preparation"><h3 className="mb-3 font-display text-h2 text-fg">Your plan for Sunday</h3>{body}</section>;
  return <Card aria-label="Weekly preparation">
    <CardHeader title="Your plan for Sunday" eyebrow={preparation ? `Week ${state.week} · ${preparation.opponentName}` : 'Bye week'} />
    <CardBody>{body}</CardBody>
  </Card>;
}

export function WeeklyGameReview({ review, userTeamId }) {
  if (!review || review.teamId !== userTeamId) return null;
  return <section className="flex flex-col gap-3 rounded-card border-2 border-line-subtle p-4" aria-label="Your decisions and the result">
    <div>
      <p className="text-micro uppercase text-team-ink">Your decisions · Week {review.week}</p>
      <h3 className="font-display text-h2 text-fg">{review.strategyLabel}</h3>
      <p className="text-label text-fg-muted">Against {review.opponentName}</p>
    </div>
    <ul className="flex flex-col gap-1 text-label text-fg-secondary">{review.evidence.map(line => <li key={line}>{line}</li>)}</ul>
    {review.battle && <div className="rounded-card bg-surface-sunken p-3">
      <p className="text-micro uppercase text-fg-muted">{review.battle.gameNumber ? `Evaluation · Game ${review.battle.gameNumber} of 2` : 'Your chosen starter'}</p>
      <p className="text-label font-bold text-fg">{review.battle.playerName}</p>
      <p className="text-label text-fg-secondary">{review.battle.statLine}</p>
    </div>}
    {review.interruption && <p className="text-label text-fg-secondary">{review.interruption}</p>}
    <p className="text-micro text-fg-muted">{review.note}</p>
  </section>;
}
