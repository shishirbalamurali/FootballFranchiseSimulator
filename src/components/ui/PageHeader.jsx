import cx from './cx';
import TeamCrest from './TeamCrest';

// The team banner that tops every screen: franchise colour stock with the
// team's pattern knocked in, cartoon lettering, and the crest on a sticker.
// Text inside the banner is re-pointed at --banner-fg via `.banner-scope`, so
// children can keep using the normal text-fg-* classes.

/**
 * @param {string} title
 * @param {string} [eyebrow]   small line above the title (season, phase…)
 * @param {object} [team]      team object; renders crest + colour banner
 * @param {node}   [actions]   right-aligned controls, set on a paper plate
 * @param {node}   [tabs]      rendered in a strip under the banner
 * @param {node}   [children]  extra content under the title
 * @param {'compact'|'hero'} [size]  hero is the Hub's big banner; every other
 *                             screen uses compact so content starts high on the page
 */
export function PageHeader({
  title,
  eyebrow,
  team,
  actions,
  tabs,
  children,
  size = 'compact',
  className = '',
}) {
  const hero = size === 'hero';
  return (
    <header className={cx('relative', className)}>
      <div className="toon-banner banner-scope overflow-hidden border-b-[3px] border-ink">
        {/* Oversized crest watermark bleeding off the right edge */}
        {team && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 rotate-[-10deg] opacity-[0.16]"
          >
            <TeamCrest team={team} size={hero ? 260 : 170} decorative flat />
          </div>
        )}

        <div className={cx('relative mx-auto flex max-w-content items-center px-6', hero ? 'gap-5 py-6' : 'gap-4 py-3')}>
          {team && (
            <div className="relative shrink-0 -rotate-3">
              <div className={cx('grid place-items-center rounded-full bg-surface-raised shadow-2', hero ? 'size-[76px]' : 'size-12')}>
                <TeamCrest team={team} size={hero ? 58 : 36} decorative />
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className={cx('toon-pennant inline-block max-w-full truncate bg-ink py-0.5 pl-2.5 text-micro uppercase text-nav-fg', hero ? 'mb-2' : 'mb-1')}>
                {eyebrow}
              </p>
            )}
            <h1 className={cx('truncate uppercase text-banner-title', hero ? 'toon-title py-1 text-display' : 'toon-title-sm font-display text-h1 leading-tight')}>{title}</h1>
            {children}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2 rounded-panel bg-surface-raised px-3 py-1.5 shadow-1 paper-scope text-fg">
              {actions}
            </div>
          )}
        </div>
      </div>

      {tabs && (
        <div className="border-b-2 border-line bg-surface-base">
          <div className="relative mx-auto max-w-content px-6">{tabs}</div>
        </div>
      )}
    </header>
  );
}

export default PageHeader;
