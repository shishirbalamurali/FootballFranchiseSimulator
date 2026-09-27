import { useState } from 'react';
import { Card, CardHeader, Badge, EmptyState, cx } from '../../components/ui';

// The Hub used to stack up to five full-width alert banners above the fold —
// season goal, injuries, story event, trade offer, expiring contracts — each
// with its own colour scheme, each pushing the actual game further down.
//
// They are now one ranked list. Highest-priority item first, three visible,
// the rest behind a disclosure.

const TONE_STYLE = {
  urgent:  { dot: 'bg-negative-fg',  badge: 'negative' },
  warning: { dot: 'bg-warning-fg',   badge: 'warning'  },
  info:    { dot: 'bg-info-fg',      badge: 'info'     },
  good:    { dot: 'bg-positive-fg',  badge: 'positive' },
};

function InboxItem({ item }) {
  const tone = TONE_STYLE[item.tone] ?? TONE_STYLE.info;
  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
      <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {/* Title gets the full width — the tag and action sit below it, so a
            headline like "2 players injured" is never clipped to "2 players inju…" */}
        <p className="text-label font-semibold leading-snug text-fg">{item.title}</p>
        {item.body && <p className="mt-0.5 line-clamp-2 text-label text-fg-muted">{item.body}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          {item.tag && <Badge tone={tone.badge}>{item.tag}</Badge>}
          {item.action && (
            <button
              type="button"
              onClick={item.onAction}
              className="text-label font-semibold text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              {item.action} →
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * @param {Array} items  [{ id, title, body, tone, tag, action, onAction, priority }]
 */
export default function Inbox({ items }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const visible = expanded ? sorted : sorted.slice(0, 3);
  const hidden = sorted.length - visible.length;

  return (
    <Card>
      <CardHeader
        title="Front office"
        eyebrow={sorted.length ? `${sorted.length} item${sorted.length === 1 ? '' : 's'} need you` : 'All clear'}
      />
      {sorted.length === 0 ? (
        <EmptyState
          size="sm"
          icon="✓"
          title="Nothing needs your attention"
          body="Injuries, trade offers and contract decisions will show up here."
        />
      ) : (
        <>
          <ul className="divide-y divide-line-subtle">
            {visible.map(item => <InboxItem key={item.id} item={item} />)}
          </ul>
          {(hidden > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="border-t border-line-subtle py-2.5 text-label font-semibold text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              {expanded ? 'Show less' : `${hidden} more`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
