import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ACHIEVEMENTS, ACHIEVEMENT_TIERS, achievementById, legacyScore } from '../engine/legacy';
import { Card, CardHeader, CardBody, Badge, Meter, FilterChips, useToast, cx } from './ui';

// Achievements UI: a watcher that unlocks and celebrates milestones, and the
// panel shown on the Awards screen's Achievements tab.

const TIER_STYLE = {
  bronze: { ring: 'border-rarity-bronze', text: 'text-rarity-bronze' },
  silver: { ring: 'border-rarity-silver', text: 'text-rarity-silver' },
  gold:   { ring: 'border-rarity-gold',   text: 'text-rarity-gold' },
  legend: { ring: 'border-rarity-legend', text: 'text-rarity-legend' },
};

/** Renders nothing. Checks for unlocks whenever the season moves. */
export function LegacyWatcher() {
  const toast = useToast();
  const initialized = useGameStore(s => s.initialized);
  const week = useGameStore(s => s.week);
  const phase = useGameStore(s => s.phase);
  const historyLen = useGameStore(s => s.seasonHistory?.length || 0);
  const bracket = useGameStore(s => s.playoffBracket);
  const reviews = useGameStore(s => s.owner?.reviews?.length || 0);
  const tenure = useGameStore(s => s.legacyMeta?.tenure?.length || 0);

  useEffect(() => {
    if (!initialized) return;
    const ids = useGameStore.getState().checkAchievements();
    // A first load on an old save can unlock many at once; summarize instead of spamming.
    if (ids.length > 3) {
      toast.success({ title: `${ids.length} achievements unlocked`, body: 'See them under Awards → Achievements.' });
      return;
    }
    for (const id of ids) {
      const a = achievementById(id);
      if (a) toast.success({ title: `${a.icon} Achievement unlocked: ${a.title}`, body: `${a.desc} (+${ACHIEVEMENT_TIERS[a.tier].points} legacy)` });
    }
  }, [initialized, week, phase, historyLen, bracket, reviews, tenure, toast]);
  return null;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
];

function AchievementTile({ a, unlock }) {
  const style = TIER_STYLE[a.tier];
  return (
    <li
      className={cx(
        'flex items-start gap-3 rounded-card border-2 px-4 py-3',
        unlock ? cx(style.ring, 'bg-surface-raised shadow-1') : 'border-dashed border-line-subtle',
      )}
    >
      <span className={cx('text-h1 leading-none', !unlock && 'opacity-25 grayscale')} aria-hidden="true">{a.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('text-label font-semibold', unlock ? 'text-fg' : 'text-fg-muted')}>{a.title}</span>
          <span className={cx('text-micro uppercase', unlock ? style.text : 'text-fg-faint')}>{ACHIEVEMENT_TIERS[a.tier].label}</span>
        </div>
        <p className="text-label text-fg-muted">{a.desc}</p>
        {unlock && <p className="mt-1 text-micro uppercase text-fg-faint">Unlocked {unlock.year}{unlock.week ? ` · week ${unlock.week}` : ''}</p>}
      </div>
    </li>
  );
}

export function AchievementsPanel() {
  const unlocked = useGameStore(s => s.achievements) || {};
  const [filter, setFilter] = useState('all');
  const score = legacyScore(unlocked);
  const max = useMemo(() => ACHIEVEMENTS.reduce((s, a) => s + ACHIEVEMENT_TIERS[a.tier].points, 0), []);
  const count = Object.keys(unlocked).filter(id => achievementById(id)).length;

  const shown = ACHIEVEMENTS
    .filter(a => filter === 'all' || (filter === 'unlocked') === !!unlocked[a.id])
    // Unlocked first, then by tier value, so the wall reads as a trophy shelf.
    .sort((x, y) => (!!unlocked[y.id] - !!unlocked[x.id]) || (ACHIEVEMENT_TIERS[y.tier].points - ACHIEVEMENT_TIERS[x.tier].points));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Legacy score"
          eyebrow={`${count} of ${ACHIEVEMENTS.length} achievements`}
          action={<Badge tone="team">{score} pts</Badge>}
        />
        <CardBody>
          <Meter value={score} max={max} caption={`${score} / ${max}`} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Achievements"
          action={<FilterChips value={filter} onChange={setFilter} items={FILTERS} />}
        />
        <CardBody>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map(a => <AchievementTile key={a.id} a={a} unlock={unlocked[a.id]} />)}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
