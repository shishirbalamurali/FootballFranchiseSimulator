import cx from './cx';

// The cartoon panel: ink outline + hard offset shadow (both via --elev-*).
// Header / Body / Footer are optional slots so a card is always assembled
// the same way.

export function Card({ children, className = '', elevation = 1, as: As = 'section', ...props }) {
  return (
    <As
      className={cx(
        'relative flex flex-col overflow-hidden rounded-panel bg-surface-raised',
        elevation === 0 && 'toon-outline',
        elevation === 1 && 'shadow-1',
        elevation === 2 && 'shadow-2',
        elevation === 3 && 'shadow-3',
        className,
      )}
      {...props}
    >
      {children}
    </As>
  );
}

/**
 * Card header. `title` renders as a real heading element — pass `headingLevel`
 * so the page keeps a sane document outline.
 */
export function CardHeader({
  title,
  eyebrow,
  action,
  headingLevel = 2,
  className = '',
  children,
}) {
  const H = `h${Math.min(6, Math.max(1, headingLevel))}`;
  return (
    <header
      className={cx(
        'flex items-center gap-3 px-4 py-3 border-b-2 border-line shrink-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-micro uppercase text-team-ink mb-0.5">{eyebrow}</p>}
        {title && <H className="font-display text-h2 leading-none text-fg truncate">{title}</H>}
        {children}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ children, className = '', padded = true, scroll = false }) {
  return (
    <div
      className={cx(
        'min-h-0 flex-1',
        padded && 'p-4',
        scroll && 'overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <footer
      className={cx(
        'flex items-center gap-3 px-4 py-3 border-t-2 border-line shrink-0',
        className,
      )}
    >
      {children}
    </footer>
  );
}

export default Card;
