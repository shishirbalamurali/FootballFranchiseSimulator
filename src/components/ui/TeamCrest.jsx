import { TEAMS } from '../../data/teams';
import cx from './cx';
import { onColor } from './contrast';

// All team marks resolve through the canonical identity, including old saves.
// Only ship the supplied franchise artwork, not the retired crest collection.
const logoModules = import.meta.glob('../../assets/team-logos/franchises/*.webp', {
  eager: true,
  import: 'default',
});

const LOGOS = Object.fromEntries(
  Object.entries(logoModules).map(([path, src]) => [
    path.split('/').pop().replace(/\.webp$/, ''),
    src,
  ]),
);

const SIZES = { xs: 20, sm: 28, md: 40, lg: 56, xl: 88, '2xl': 128 };

/**
 * @param {object}  props
 * @param {string}  [props.teamId]   team id, or pass `team`
 * @param {object}  [props.team]     team object from TEAMS
 * @param {keyof SIZES|number} [props.size]
 * @param {boolean} [props.ring]     neutral disc behind the crest
 * @param {boolean} [props.decorative] hide from screen readers
 * @param {boolean} [props.flat]     kept for callers; crests are always bare now
 */
export function TeamCrest({
  teamId,
  team,
  size = 'md',
  ring = false,
  decorative = false,
  flat: _flat = false,
  className = '',
  ...props
}) {
  const id = teamId ?? team?.id;
  const resolved = TEAMS.find(t => t.id === id) ?? team;
  const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.md);
  const src = LOGOS[resolved?.brandId];

  // Fallback: abbreviation on the team color. Never a blank coloured square.
  if (!src) {
    return (
      <span
        className={cx(
          'inline-flex items-center justify-center rounded-full font-display leading-none shrink-0 toon-outline',
          className,
        )}
        style={{
          width: px,
          height: px,
          fontSize: Math.round(px * 0.36),
          backgroundColor: resolved?.theme?.primary ?? 'var(--surface-overlay)',
          color: resolved?.theme?.primary ? onColor(resolved.theme.primary) : 'var(--text-primary)',
        }}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : `${resolved?.location ?? ''} ${resolved?.name ?? 'team'}`.trim()}
        {...props}
      >
        {resolved?.abbreviation ?? '—'}
      </span>
    );
  }

  const img = (
    <img
      src={src}
      alt={decorative ? '' : `${resolved?.location ?? ''} ${resolved?.name ?? 'team'} crest`.trim()}
      aria-hidden={decorative || undefined}
      width={px}
      height={px}
      loading="lazy"
      draggable="false"
      className={cx('object-contain select-none shrink-0', !ring && className)}
      // The supplied art is transparent: no plate behind it (the old light
      // square read as a white box on team banners and dark surfaces).
      style={{ width: px, height: px }}
      {...(ring ? {} : props)}
    />
  );

  if (!ring) return img;

  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-full shrink-0', className)}
      style={{
        width: px * 1.28,
        height: px * 1.28,
        background: 'var(--crest-surface, var(--surface-raised))',
        border: '1px solid var(--border-subtle)',
      }}
      {...props}
    >
      {img}
    </span>
  );
}

export default TeamCrest;
