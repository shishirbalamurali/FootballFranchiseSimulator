import { useEffect, useState } from 'react';

const MIN_WIDTH = 900;

/**
 * Gridiron is a desktop-first franchise sim: the roster tables, the draft
 * board and the playoff bracket all assume a wide viewport. Below 900px the
 * old build simply scrolled sideways with content cut off, which reads as
 * broken rather than unsupported. This says so honestly instead.
 *
 * Full phone/tablet layouts are deliberately out of scope for this pass.
 */
export default function SmallScreenNotice() {
  const [tooNarrow, setTooNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MIN_WIDTH,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`);
    const onChange = (e) => setTooNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!tooNarrow || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="small-screen-title"
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 bg-surface-shell px-8 text-center"
    >
      <span className="font-display text-[clamp(40px,12vw,72px)] font-extrabold uppercase leading-none tracking-tight text-fg">
        Gridiron
      </span>
      <div className="max-w-sm">
        <h1 id="small-screen-title" className="font-display text-h1 uppercase text-fg">
          Built for a bigger screen
        </h1>
        <p className="mt-2 text-body text-fg-muted">
          Depth charts, the draft board and the playoff bracket need room to
          breathe. Open Gridiron on a laptop or desktop for the full experience.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-card border border-line px-4 py-2.5 text-label font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        Continue anyway
      </button>
    </div>
  );
}
