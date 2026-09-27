import { personalityView, characterFor } from '../engine/character';
import PlayerFace from './PlayerFace';
import { cx, Badge } from './ui';

const TONE_BADGE = { good: 'positive', bad: 'negative', mixed: 'warning' };

/** Known traits as badges, a lock for the unknown ones, and where he's from. */
export function ReputationBadges({ player, own = false, scouted = false, showBio = true, className }) {
  const view = personalityView(player, { own, scouted });
  const c = characterFor(player);
  if (!view || !c) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {view.traits.map(t => (
        <Badge key={t.id} tone={TONE_BADGE[t.tone]} title={t.effect}>{t.icon} {t.label}</Badge>
      ))}
      {view.hiddenTraits > 0 && <Badge tone="neutral" title="Scout him to learn more">🔒 +{view.hiddenTraits} unknown</Badge>}
      {view.full && view.traits.length === 0 && <Badge tone="neutral">Even-keeled</Badge>}
      {showBio && <span className="text-label text-fg-muted">{c.height} · {c.weightLb} lb · {c.hometown}</span>}
    </div>
  );
}

/** Name plus the trait icons you know about (fog of personality applies). */
export function PlayerNameLine({ player, own = false, scouted = false, className }) {
  const traits = personalityView(player, { own, scouted })?.traits ?? [];
  return (
    <p className={cx('flex min-w-0 items-center gap-1.5', className)}>
      <span className="truncate font-semibold text-fg">{player.name}</span>
      {traits.length > 0 && (
        <span className="shrink-0 text-label leading-none" title={traits.map(t => t.label).join(' · ')}>
          {traits.map(t => t.icon).join('')}
        </span>
      )}
    </p>
  );
}

/**
 * Face + name + known traits, for list rows. Other teams' players only show
 * their public reputation until scouted.
 * @param {object}  player
 * @param {string}  teamId  whose jersey he wears ('FA' for free agents)
 * @param {boolean} own     is he on the user's team
 * @param {node}    sub     optional second line
 */
export default function PlayerIdentity({ player, teamId, own = false, scouted = false, size = 'sm', sub, className }) {
  return (
    <div className={cx('flex min-w-0 items-center gap-2.5', className)}>
      <PlayerFace player={player} teamId={teamId} size={size} />
      <div className="min-w-0">
        <PlayerNameLine player={player} own={own} scouted={scouted} />
        {sub && <div className="truncate text-label text-fg-muted">{sub}</div>}
      </div>
    </div>
  );
}
