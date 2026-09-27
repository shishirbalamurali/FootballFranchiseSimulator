import { useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import {
  OWNER_ARCHETYPES, ownerForTeam, buildOwnerContext, projectTrust, securityLevel, FIRE_THRESHOLD,
} from '../engine/owner';
import { Card, CardHeader, CardBody, Meter, Badge, Modal, Button, TeamCrest, cx } from './ui';

// Owner & job security UI: a watcher that keeps the owner in sync with the
// season, a Hub card with the hot-seat meter, and the end-of-season review.

const STATUS_BADGE = {
  met:        { tone: 'positive', label: 'Met' },
  'on-track': { tone: 'info',     label: 'On track' },
  behind:     { tone: 'warning',  label: 'Behind' },
  failed:     { tone: 'negative', label: 'Missed' },
};

const TONE_COLOR = {
  positive: 'var(--positive-fg)', info: 'var(--info-fg)',
  warning: 'var(--warning-fg)', negative: 'var(--negative-fg)',
};

/** Renders nothing. Sets season goals and runs the review when a season ends. */
export function OwnerWatcher() {
  const initialized = useGameStore(s => s.initialized);
  const userTeamId = useGameStore(s => s.userTeamId);
  const year = useGameStore(s => s.year);
  const phase = useGameStore(s => s.phase);
  const recapYear = useGameStore(s => s.seasonRecap?.year);
  useEffect(() => {
    if (!initialized) return;
    const { ensureOwner, runOwnerReview } = useGameStore.getState();
    ensureOwner();
    if (recapYear != null) runOwnerReview();
  }, [initialized, userTeamId, year, phase, recapYear]);
  return null;
}

function GoalRow({ goal }) {
  const badge = STATUS_BADGE[goal.status] ?? STATUS_BADGE.behind;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold text-fg">{goal.label}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <Meter value={goal.progress * 100} size="sm" caption={goal.detail} color={TONE_COLOR[badge.tone]} />
    </li>
  );
}

/** Hub card: owner, projected job security, and live goal progress. */
export function OwnerCard() {
  const owner = useGameStore(s => s.owner);
  const standings = useGameStore(s => s.standings);
  const playoffBracket = useGameStore(s => s.playoffBracket);
  const rosters = useGameStore(s => s.rosters);
  const schedule = useGameStore(s => s.schedule);
  const teams = useGameStore(s => s.teams);
  const userTeamId = useGameStore(s => s.userTeamId);
  const phase = useGameStore(s => s.phase);

  const projection = useMemo(() => {
    if (!owner) return null;
    const ctx = buildOwnerContext({ userTeamId, standings, teams, playoffBracket, rosters, schedule, phase });
    return projectTrust(owner, ctx);
  }, [owner, userTeamId, standings, teams, playoffBracket, rosters, schedule, phase]);

  if (!owner || !projection) return null;
  const arch = OWNER_ARCHETYPES[owner.archetypeId];
  const reviewed = owner.lastReviewYear != null && owner.lastReviewYear === owner.goalsYear;
  const shown = reviewed ? owner.trust : projection.trust;
  const level = securityLevel(shown);
  const last = owner.reviews?.[owner.reviews.length - 1];

  return (
    <Card>
      <CardHeader
        title="Owner's box"
        eyebrow={`${arch?.icon ?? ''} ${owner.name}`}
        action={<Badge tone={level.tone}>{level.label}</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        <div>
          <p className="text-label font-semibold text-fg">{arch?.title}</p>
          <p className="text-label text-fg-muted">{arch?.blurb}</p>
        </div>

        <div>
          <Meter
            value={shown}
            label={reviewed ? 'Owner trust' : 'Projected trust at season end'}
            caption={reviewed ? `${shown}/100` : `${shown}/100 (${projection.delta >= 0 ? '+' : ''}${projection.delta})`}
            color={TONE_COLOR[level.tone]}
            marker={FIRE_THRESHOLD}
          />
          <p className="mt-1 text-micro uppercase text-fg-faint">Below {FIRE_THRESHOLD} you're fired</p>
        </div>

        {owner.goals?.length > 0 && !reviewed && (
          <ul className="flex flex-col gap-3">
            {projection.goals.map(g => <GoalRow key={g.id} goal={g} />)}
          </ul>
        )}

        {reviewed && last && (
          <p className="text-label text-fg-secondary">
            {last.year} review: grade <strong className="text-fg">{last.grade}</strong> ({last.record}).
            New goals arrive when next season kicks off.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function JobOffer({ teamId, onAccept }) {
  const team = TEAMS.find(t => t.id === teamId);
  const ratings = useGameStore(s => s.teamRatings?.[teamId]);
  if (!team) return null;
  return (
    <button
      type="button"
      onClick={() => onAccept(teamId)}
      className={cx(
        'toon-lift flex items-center gap-3 rounded-card border border-line-subtle px-4 py-3 text-left',
        'transition-colors duration-micro hover:border-team hover:bg-team-8',
      )}
    >
      <TeamCrest team={team} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-label font-semibold text-fg">{team.location} {team.name}</p>
        <p className="text-label text-fg-muted">
          {OWNER_ARCHETYPES[ownerForTeam(teamId).archetypeId]?.title} · Team OVR {ratings?.overall ?? '—'}
        </p>
      </div>
      <span className="text-label font-semibold text-team-ink">Take the job</span>
    </button>
  );
}

/** The end-of-season review. Fired coaches must pick a new job or start over. */
export function OwnerReviewModal() {
  const owner = useGameStore(s => s.owner);
  const review = owner?.pendingReview;
  if (!review) return null;
  const { fired, goals } = review;

  const { dismissOwnerReview, acceptJobOffer, resetGame } = useGameStore.getState();
  const arch = OWNER_ARCHETYPES[owner.archetypeId];
  const level = securityLevel(review.trustAfter);

  return (
    <Modal
      open
      onClose={fired ? undefined : dismissOwnerReview}
      size="lg"
      closeOnBackdrop={false}
      eyebrow={`${review.year} season review · ${owner.name}`}
      title={fired ? "You're fired." : `Season grade: ${review.grade}`}
      footer={fired
        ? <Button variant="ghost" onClick={() => resetGame()}>Retire and start a new franchise</Button>
        : <Button variant="primary" onClick={dismissOwnerReview}>Back to work</Button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span
            className={cx(
              'grid size-20 shrink-0 place-items-center rounded-full border-[3px] border-ink font-display text-display shadow-1',
              fired ? 'bg-negative-solid text-n-0' : 'bg-team text-team-on',
            )}
            aria-hidden="true"
          >
            {fired ? '✕' : review.grade}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body text-fg-secondary">
              {fired
                ? `${arch?.title ?? 'The owner'} has seen enough. After a ${review.record} season, trust fell to ${review.trustAfter}, and your office has been cleared out.`
                : review.verdict}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={review.delta >= 0 ? 'positive' : 'negative'}>
                Trust {review.delta >= 0 ? '+' : ''}{review.delta}
              </Badge>
              <Badge tone={level.tone}>{level.label}</Badge>
              <span className="text-label tabular-nums text-fg-muted">{review.trustBefore} → {review.trustAfter}</span>
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {goals.map(g => <GoalRow key={g.id} goal={g} />)}
        </ul>

        {fired && (
          <div className="flex flex-col gap-2">
            <p className="text-micro uppercase text-fg-faint">Teams calling your agent</p>
            {(owner.offers || []).map(id => <JobOffer key={id} teamId={id} onAccept={acceptJobOffer} />)}
          </div>
        )}
      </div>
    </Modal>
  );
}
