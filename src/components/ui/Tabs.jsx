import { useId } from 'react';
import cx from './cx';

// Replaces 10 bespoke tab implementations (Roster viewMode, Standings
// activeTab, Stats viewMode + second tab row, Awards TABS, FreeAgency
// viewMode, Development, Draft, WaiverWireModal, LeagueInfoPanel, PlayerModal)
// — each previously styled differently.
//
// Keyboard: arrow keys move between tabs, per the WAI-ARIA tabs pattern.

function useTabKeys(items, value, onChange) {
  return (e) => {
    const i = items.findIndex(t => t.id === value);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % items.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].id);
  };
}

/**
 * Underlined tabs — for switching the main content of a page.
 * items: [{ id, label, count?, icon? }]
 */
export function Tabs({ items, value, onChange, className = '', label = 'Sections' }) {
  const onKeyDown = useTabKeys(items, value, onChange);
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('flex items-center gap-2 py-2', className)}
    >
      {items.map(t => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative inline-flex items-center gap-2 px-4 h-9 text-label font-bold rounded-full',
              'transition-[background-color,color,transform,box-shadow] duration-micro whitespace-nowrap',
              active
                ? 'bg-team text-team-on -rotate-1 shadow-[0_0_0_2px_var(--ink),3px_3px_0_2px_var(--ink)]'
                : 'text-fg-muted hover:text-fg hover:bg-surface-hover',
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className={cx(
                'grid min-w-5 h-5 place-items-center rounded-full px-1 text-micro tabular-nums',
                active ? 'bg-surface-raised text-fg' : 'bg-surface-sunken text-fg-faint',
              )}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pill segmented control — for switching a *view* of the same content
 * (Team/League, Cards/Table). Visually distinct from Tabs on purpose.
 */
export function SegmentedControl({ items, value, onChange, size = 'md', className = '', label = 'View' }) {
  const onKeyDown = useTabKeys(items, value, onChange);
  const h = size === 'sm' ? 'h-8' : 'h-9';
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('inline-flex items-center gap-1 rounded-card bg-surface-sunken p-1 toon-outline', className)}
    >
      {items.map(t => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              h,
              'px-3 rounded-chip text-label font-bold transition-colors duration-micro whitespace-nowrap',
              active
                ? 'bg-team text-team-on shadow-[0_0_0_2px_var(--ink)]'
                : 'text-fg-muted hover:text-fg hover:bg-surface-hover',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filter chips — for multi-value narrowing (positions, conferences).
 * Not a tablist: these are toggles, so they use aria-pressed.
 */
export function FilterChips({ items, value, onChange, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {items.map(t => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.id)}
            className={cx(
              'h-7 px-3 rounded-full text-micro uppercase transition-[background-color,color,transform] duration-micro border-2',
              active
                ? 'bg-team text-team-on border-ink -rotate-1'
                : 'bg-surface-raised text-fg-muted border-line hover:border-ink hover:text-fg',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Panel wrapper that ties content back to its tab for screen readers. */
export function TabPanel({ children, tabId, className = '' }) {
  const id = useId();
  return (
    <div role="tabpanel" id={`${id}-${tabId}`} aria-label={tabId} className={className}>
      {children}
    </div>
  );
}

export default Tabs;
