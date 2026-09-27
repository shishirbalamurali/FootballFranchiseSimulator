import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { COACH_LEVELS, getCoachLevel, getCoachXpToNext, hasCoachPerk } from '../engine/progression';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Badge, Meter, Stat,
  FilterChips, SegmentedControl, PositionTag, RarityChip, EmptyState,
  Modal, cx, useToast, getRarity,
} from '../components/ui';

const DEV_TRAIT = {
  Superstar: { label: 'Superstar', tone: 'positive' },
  Star:      { label: 'Star',      tone: 'warning'  },
  Normal:    { label: 'Normal',    tone: 'neutral'  },
  Slow:      { label: 'Slow',      tone: 'negative' },
};

function ceilingOf(player) {
  const pot = player.pot || player.ovr;
  const gap = pot - player.ovr;
  if (gap >= 10) return { label: 'Elite ceiling', color: 'var(--rarity-elite)', gap };
  if (gap >= 6)  return { label: 'High ceiling',  color: 'var(--positive-fg)',  gap };
  if (gap >= 3)  return { label: 'Some room',     color: 'var(--info-fg)',      gap };
  if (gap >= 0)  return { label: 'Near peak',     color: 'var(--warning-fg)',   gap };
  return { label: 'Declining', color: 'var(--negative-fg)', gap };
}

// ── Coach perk ladder ───────────────────────────────────────────────────────
function PerkLadder({ coachXp }) {
  const level = getCoachLevel(coachXp);
  return (
    <ol className="relative flex flex-col">
      {COACH_LEVELS.map((lvl, i) => {
        const unlocked = lvl.level <= level;
        const isNext = lvl.level === level + 1;
        const [name, detail] = (lvl.perkLabel || '').split(' — ');
        return (
          <li key={lvl.level} className="relative flex gap-3 pb-4 last:pb-0">
            {/* connector */}
            {i < COACH_LEVELS.length - 1 && (
              <span
                aria-hidden="true"
                className={cx('absolute left-[13px] top-7 bottom-0 w-px',
                  unlocked ? 'bg-team' : 'bg-line-subtle')}
              />
            )}
            <span
              className={cx(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-micro tabular-nums',
                unlocked ? 'border-team bg-team text-team-on'
                  : isNext ? 'border-team text-team-ink' : 'border-line-subtle text-fg-faint',
              )}
            >
              {lvl.level}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <p className={cx('text-label font-semibold', unlocked ? 'text-fg' : 'text-fg-muted')}>
                  {name || `Level ${lvl.level}`}
                </p>
                {isNext && <Badge tone="team">Next</Badge>}
              </div>
              {detail && (
                <p className={cx('text-label', unlocked ? 'text-fg-muted' : 'text-fg-faint')}>{detail}</p>
              )}
              {!unlocked && (
                <p className="mt-0.5 text-micro uppercase text-fg-faint">{lvl.xpNeeded} XP</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Development() {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const coachXp = useGameStore(s => s.coachXp) || 0;
  const devTrainingDone = useGameStore(s => s.devTrainingDone);
  const devTrainPlayer = useGameStore(s => s.devTrainPlayer);
  const activeBoostsRaw = useGameStore(s => s.activeBoosts);
  const phase = useGameStore(s => s.phase);
  const toast = useToast();

  const [posFilter, setPosFilter] = useState('All');
  const [sortBy, setSortBy] = useState('potential');
  const [trainTarget, setTrainTarget] = useState(null);
  const [trainAttr, setTrainAttr] = useState(null);

  const teamData = TEAMS.find(t => t.id === userTeamId);
  const roster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const activeBoosts = activeBoostsRaw || [];

  const level = getCoachLevel(coachXp);
  const xpInfo = getCoachXpToNext(coachXp);
  const trainGain = hasCoachPerk(coachXp, 'focus_boost') ? 2 : 1;
  const canTrain = phase === 'regular' && !devTrainingDone;

  const positions = useMemo(
    () => ['All', ...Array.from(new Set(roster.map(p => p.position)))],
    [roster],
  );

  const pipeline = useMemo(() => {
    let list = posFilter === 'All' ? [...roster] : roster.filter(p => p.position === posFilter);
    if (sortBy === 'potential') {
      list.sort((a, b) => ((b.pot || b.ovr) - b.ovr) - ((a.pot || a.ovr) - a.ovr));
    } else if (sortBy === 'age') {
      list.sort((a, b) => a.age - b.age);
    } else {
      list.sort((a, b) => b.ovr - a.ovr);
    }
    return list;
  }, [roster, posFilter, sortBy]);

  const youngProspects = roster.filter(p => p.age <= 24 && (p.pot || p.ovr) - p.ovr >= 5);

  const trainAttrs = trainTarget
    ? Object.entries(trainTarget.attributes?.position || {}).sort(([, a], [, b]) => b - a).slice(0, 4)
    : [];

  const runTraining = () => {
    const result = devTrainPlayer(trainTarget.id, trainAttr);
    if (result?.success) {
      toast.success({
        title: `${trainTarget.name} trained`,
        body: trainAttr
          ? `${trainAttr.replace(/([A-Z])/g, ' $1').trim()} improved.`
          : `+${trainGain} overall.`,
      });
    } else {
      toast.error('Training could not be run this week.');
    }
    setTrainTarget(null);
    setTrainAttr(null);
  };

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Player development"
        eyebrow={`${teamData?.location ?? ''} · coach level ${level}`}
        team={teamData}
        actions={
          <Badge tone={canTrain ? 'positive' : 'neutral'}>
            {canTrain ? 'Training available' : phase === 'regular' ? 'Training used this week' : 'Regular season only'}
          </Badge>
        }
      />

      <div className="mx-auto max-w-content px-6 py-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* ── Coach ── */}
          <div className="flex flex-col gap-4 xl:col-span-4">
            <Card>
              <div
                className="flex items-center gap-4 px-5 py-5"
                style={{ background: 'linear-gradient(135deg, var(--team-tint-24), transparent 70%)' }}
              >
                <div className="grid size-14 shrink-0 place-items-center rounded-panel bg-surface-sunken font-display text-h1 text-team-ink">
                  {level}
                </div>
                <div className="min-w-0">
                  <p className="text-micro uppercase text-fg-muted">Head coach</p>
                  <p className="font-display text-h1 uppercase text-fg">Level {level}</p>
                  <p className="text-label tabular-nums text-fg-muted">{coachXp} XP earned</p>
                </div>
              </div>
              <CardBody>
                {level < 10 ? (
                  <Meter
                    label={`Progress to level ${level + 1}`}
                    caption={`${xpInfo.current} / ${xpInfo.needed}`}
                    value={xpInfo.pct}
                  />
                ) : (
                  <p className="text-label text-positive-fg">Max level reached.</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Perk tree" eyebrow="Earn XP by winning and developing players" />
              <CardBody><PerkLadder coachXp={coachXp} /></CardBody>
            </Card>

            {activeBoosts.length > 0 && (
              <Card>
                <CardHeader title="Active boosts" eyebrow={`${activeBoosts.length} in effect`} />
                <ul>
                  {activeBoosts.map((b, i) => (
                    <li key={i} className="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-0">
                      <span className="min-w-0 flex-1 truncate text-label text-fg-secondary">
                        {b.label || b.type}
                      </span>
                      <Badge tone="info">{b.weeks ?? b.weeksRemaining ?? 1}wk</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* ── Pipeline ── */}
          <div className="flex flex-col gap-4 xl:col-span-8">
            <Card>
              <CardBody className="flex flex-wrap items-center gap-6">
                <Stat value={roster.length} label="On roster" size="sm" />
                <Stat value={youngProspects.length} label="High-upside U24" size="sm" />
                <Stat value={`+${trainGain}`} label="Training gain" size="sm" />
                <Stat value={activeBoosts.length} label="Active boosts" size="sm" />
              </CardBody>
            </Card>

            <Card>
              <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-raised px-4 py-3">
                <FilterChips
                  items={positions.map(p => ({ id: p, label: p }))}
                  value={posFilter}
                  onChange={setPosFilter}
                />
                <div className="ml-auto">
                  <SegmentedControl
                    size="sm"
                    label="Sort"
                    value={sortBy}
                    onChange={setSortBy}
                    items={[
                      { id: 'potential', label: 'Upside' },
                      { id: 'ovr', label: 'Rating' },
                      { id: 'age', label: 'Age' },
                    ]}
                  />
                </div>
              </div>

              {pipeline.length === 0 ? (
                <EmptyState icon="🔍" title="No players at this position" />
              ) : (
                <ul>
                  {pipeline.map(p => {
                    const ceiling = ceilingOf(p);
                    const rarity = getRarity(p.ovr);
                    const pot = p.pot || p.ovr;
                    const trait = DEV_TRAIT[p.devTrait];
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-4 border-b border-line-subtle px-4 py-3 last:border-0"
                      >
                        <PositionTag position={p.position} />
                        <div className="min-w-0 w-44">
                          <p className="truncate text-label font-semibold text-fg">{p.name}</p>
                          <p className="text-label text-fg-muted">Age {p.age}</p>
                        </div>

                        {/* Current → ceiling, as one bar */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-baseline justify-between">
                            <span className="text-micro uppercase" style={{ color: ceiling.color }}>
                              {ceiling.label}
                            </span>
                            <span className="text-label tabular-nums text-fg-muted">
                              {p.ovr} → {pot}
                            </span>
                          </div>
                          <div className="relative h-2 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full opacity-35"
                              style={{ width: `${pot}%`, backgroundColor: ceiling.color }}
                            />
                            <div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${p.ovr}%`, backgroundColor: rarity.color }}
                            />
                          </div>
                        </div>

                        {trait && <Badge tone={trait.tone}>{trait.label}</Badge>}
                        <RarityChip ovr={p.ovr} />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canTrain}
                          onClick={() => { setTrainTarget(p); setTrainAttr(null); }}
                        >
                          Train
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── Training session ── */}
      <Modal
        open={!!trainTarget}
        onClose={() => { setTrainTarget(null); setTrainAttr(null); }}
        eyebrow="Weekly training session"
        title={trainTarget ? `Train ${trainTarget.name}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setTrainTarget(null); setTrainAttr(null); }}>Cancel</Button>
            <Button variant="primary" onClick={runTraining}>Run session</Button>
          </>
        }
      >
        {trainTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <PositionTag position={trainTarget.position} />
              <span className="flex-1 text-h3 text-fg">{trainTarget.name}</span>
              <RarityChip ovr={trainTarget.ovr} />
            </div>
            <p className="text-body text-fg-secondary">
              You get one training session a week. Pick a focus.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setTrainAttr(null)}
                className={cx(
                  'flex items-center justify-between rounded-card border px-4 py-3 text-left transition-colors',
                  trainAttr === null ? 'border-team bg-team-16' : 'border-line-subtle hover:bg-surface-hover',
                )}
              >
                <span className="text-label font-semibold text-fg">Overall development</span>
                <Badge tone="positive">+{trainGain} OVR</Badge>
              </button>
              {trainAttrs.map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrainAttr(key)}
                  className={cx(
                    'flex items-center justify-between rounded-card border px-4 py-3 text-left transition-colors',
                    trainAttr === key ? 'border-team bg-team-16' : 'border-line-subtle hover:bg-surface-hover',
                  )}
                >
                  <span className="text-label capitalize text-fg">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-label tabular-nums text-fg-muted">{value}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
