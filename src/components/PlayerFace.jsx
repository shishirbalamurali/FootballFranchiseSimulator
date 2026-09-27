import { lazy, memo, Suspense } from 'react';
import { TEAMS } from '../data/teams';
import { cx, alpha } from './ui';

// Loaded on first use so the face artwork stays out of the main bundle.
const FaceArt = lazy(() => import('./FaceArt'));

const SIZES = { xs: 28, sm: 36, md: 52, lg: 88, xl: 136 };
const TEAM_BY_ID = new Map(TEAMS.map(t => [t.id, t]));

// facesjs draws on a 400×600 canvas; the head sits in the upper ~70%.
// These offsets frame head-and-shoulders for each crop.
const CROPS = {
  avatar:   { scale: 1.12, lift: 0.19 },  // round chip, face fills the circle
  portrait: { scale: 0.9, lift: -0.01 },  // card, hair to jersey visible
};

/**
 * A player's generated face, in his current team's jersey.
 * @param {object} player   needs id and age
 * @param {string} teamId   drives jersey colours ('FA' / unknown = neutral kit)
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} size   width in px
 * @param {'avatar'|'portrait'} variant
 */
function PlayerFace({ player, teamId, size = 'sm', variant = 'avatar', lazy: lazyDraw = true, className, label }) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const team = TEAM_BY_ID.get(teamId);
  const crop = CROPS[variant];
  const innerW = px * crop.scale;
  const height = variant === 'portrait' ? Math.round(px * 1.22) : px;
  const tint = team?.theme?.primary;

  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden',
        variant === 'avatar' ? 'rounded-full shadow-[0_0_0_2px_var(--ink)]' : 'rounded-panel shadow-2',
        className,
      )}
      style={{
        width: px,
        height,
        background: tint
          ? `radial-gradient(circle at 50% 35%, ${alpha(tint, 0.18)}, ${alpha(tint, 0.55)})`
          : 'var(--surface-sunken)',
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* The tinted chip is the placeholder while the artwork loads. */}
      <Suspense fallback={null}>
        <FaceArt
          playerId={player.id}
          age={player.age}
          team={team}
          teamId={teamId}
          lazy={lazyDraw}
          style={{
            position: 'absolute',
            width: innerW,
            height: innerW * 1.5,
            left: (px - innerW) / 2,
            top: -innerW * 1.5 * crop.lift,
          }}
        />
      </Suspense>
    </div>
  );
}

export default memo(PlayerFace);
