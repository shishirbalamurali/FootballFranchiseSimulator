import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Modal, Button, Badge, TeamCrest, cx } from './ui';
import { useGameStore } from '../store/gameStore';
import { decisionScene } from '../engine/franchiseLore';

const PHASE_EYEBROW = {
  regular:   (w) => `Week ${w}`,
  midseason: (w) => `Mid-season · week ${w}`,
  playoffs:  ()  => 'Playoffs',
  offseason: ()  => 'Offseason',
};

const LETTERS = ['A', 'B', 'C', 'D'];

const FIT = {
  1:  { label: 'Fits the culture', tone: 'positive', icon: '▲' },
  0:  { label: 'Culture neutral',  tone: 'neutral',  icon: '●' },
  '-1': { label: 'Against the grain', tone: 'negative', icon: '▼' },
};

/**
 * A branching decision, staged in two beats:
 *   1. the brief: category, the staffer bringing it to you, stakes, options
 *      with their real effects and how the franchise culture reads each one
 *   2. the verdict: your pick is stamped, the building reacts, then Continue
 *      applies it (so a misclick can still be reconsidered)
 * The handler is `onChoice(index)`; `onDismiss` stays out of it.
 */
export default function StoryEventModal({ event, onChoice, onDismiss, gamePhase = 'regular' }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  const roster = useGameStore(s => s.rosters?.[s.userTeamId]);
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState(null);

  const scene = useMemo(
    () => decisionScene(event, { teamId: userTeamId, roster: roster || [] }),
    [event, userTeamId, roster],
  );

  // Keyboard: A/B (or 1/2) picks, Enter confirms a pick.
  useEffect(() => {
    if (!scene) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toUpperCase();
      const idx = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : Number(k) - 1;
      if (picked == null && idx >= 0 && idx < scene.choices.length) setPicked(idx);
      else if (picked != null && e.key === 'Enter') { e.preventDefault(); onChoice?.(picked); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, picked, onChoice]);

  // One stable close handler: Modal re-runs its focus trap when onClose changes.
  const latest = useRef({ picked, onChoice, onDismiss });
  useEffect(() => { latest.current = { picked, onChoice, onDismiss }; });
  const handleClose = useCallback(() => {
    const { picked: p, onChoice: choose, onDismiss: dismiss } = latest.current;
    if (p != null) choose?.(p); else dismiss?.();
  }, []);

  if (!event || !scene) return null;
  const eyebrow = (PHASE_EYEBROW[gamePhase] ?? PHASE_EYEBROW.regular)(event.week);
  const chosen = picked != null ? scene.choices[picked] : null;
  const spring = reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 };
  const stagger = (i, base = 0.12) => (reduce ? { duration: 0 } : { ...spring, delay: base + i * 0.07 });

  return (
    <Modal
      open
      bare
      ariaLabel={event.title}
      onClose={handleClose}
      size="lg"
      closeOnBackdrop={false}
      footer={chosen ? (
        <>
          <Button variant="ghost" onClick={() => setPicked(null)}>Reconsider</Button>
          <Button variant="primary" onClick={() => onChoice?.(picked)}>Make it official →</Button>
        </>
      ) : (
        <>
          <span className="mr-auto hidden text-micro uppercase text-fg-faint sm:inline">
            Press {scene.choices.map((_, i) => LETTERS[i]).join(' / ')} to choose
          </span>
          <Button variant="ghost" onClick={onDismiss}>Stay out of it</Button>
        </>
      )}
    >
      {/* ── Hero: who is bringing this to you, and what it is ── */}
      <header className="toon-banner banner-scope relative overflow-hidden border-b-[3px] border-ink px-6 pb-5 pt-5">
        <div aria-hidden="true" className={cx('toon-rays pointer-events-none absolute -right-24 -top-24 size-72', !reduce && 'animate-[spin_40s_linear_infinite]')} />
        <div className="relative flex items-start gap-4">
          <motion.span
            aria-hidden="true"
            initial={reduce ? false : { scale: 0.2, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            transition={{ ...spring, delay: 0.05 }}
            className="grid size-16 shrink-0 place-items-center rounded-card bg-surface-overlay text-[34px] shadow-[3px_3px_0_0_var(--ink)] toon-outline"
          >
            {event.icon || '📋'}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-micro uppercase tracking-[0.14em] text-fg-muted">
              <span className="rounded-full bg-ink px-2 py-0.5 text-nav-fg">{scene.category}</span>
              <span>{eyebrow}</span>
            </p>
            <motion.h2
              initial={reduce ? false : { y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring, delay: 0.1 }}
              className="mt-2 font-headline text-[34px] font-black uppercase leading-[0.95] tracking-tight text-fg sm:text-[40px]"
            >
              {event.title}
            </motion.h2>
          </div>
          <TeamCrest teamId={userTeamId} size={48} decorative className="hidden shrink-0 opacity-90 sm:block" />
        </div>
      </header>

      <div className="flex flex-col gap-5 px-6 py-5">
        {/* ── The brief ── */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={stagger(0, 0.15)}
          className="flex flex-col gap-4"
        >
          <p className="font-editorial text-[17px] leading-relaxed text-fg">{event.body}</p>
          {scene.quote && (
            <figure className="border-l-4 border-team pl-4">
              <blockquote className="font-editorial text-[16px] italic leading-relaxed text-fg-secondary">
                “{scene.quote}”
              </blockquote>
              <figcaption className="mt-1 text-micro uppercase tracking-[0.12em] text-fg-faint">
                {scene.speaker}
              </figcaption>
            </figure>
          )}
          <div className="flex flex-wrap items-center gap-2 text-label">
            {scene.stakes && (
              <span className="text-fg-muted"><b className="text-fg">At stake:</b> {scene.stakes}</span>
            )}
            {scene.culture && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-micro uppercase text-fg-secondary"
                title={scene.culture.blurb}>
                <span aria-hidden="true">{scene.culture.icon}</span> Culture: {scene.culture.label}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Options ── */}
        <div>
          <p className="mb-2 font-headline text-h3 font-black uppercase tracking-[0.1em] text-fg-faint">
            {chosen ? 'Your call' : 'Make the call'}
          </p>
          <div className={cx('grid gap-3', scene.choices.length === 2 && 'sm:grid-cols-2')}>
            {scene.choices.map((choice, i) => {
              const isPicked = picked === i;
              const dimmed = picked != null && !isPicked;
              const fit = FIT[choice.fit] ?? FIT[0];
              return (
                <motion.button
                  key={i}
                  type="button"
                  disabled={picked != null}
                  onClick={() => setPicked(i)}
                  initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: dimmed ? 0.4 : 1, y: 0, scale: dimmed ? 0.97 : 1 }}
                  whileHover={picked == null && !reduce ? { y: -3 } : undefined}
                  whileTap={picked == null && !reduce ? { scale: 0.98 } : undefined}
                  transition={picked == null ? stagger(i, 0.22) : spring}
                  className={cx(
                    'group relative flex flex-col gap-3 overflow-hidden rounded-card p-4 text-left toon-outline',
                    'bg-surface-raised transition-[box-shadow,background-color] duration-micro',
                    picked == null && 'hover:bg-team-8 hover:shadow-[4px_4px_0_0_var(--team-primary)]',
                    isPicked && 'bg-team-8 shadow-[4px_4px_0_0_var(--team-primary)]',
                    'disabled:cursor-default',
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span className={cx(
                      'grid size-9 shrink-0 place-items-center rounded-chip font-headline text-h2 font-black',
                      isPicked ? 'bg-team text-team-on' : 'bg-surface-sunken text-fg-muted group-hover:bg-team group-hover:text-team-on',
                    )}>
                      {LETTERS[i]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-headline text-[22px] font-extrabold uppercase leading-none text-fg">{choice.label}</span>
                      {choice.stances?.length > 0 && (
                        <span className="mt-1 block text-micro uppercase tracking-[0.1em] text-fg-faint">{choice.stances.join(' · ')}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {choice.chips.map((chip, ci) => <Badge key={ci} tone={chip.tone}>{chip.label}</Badge>)}
                  </span>
                  <span className={cx(
                    'mt-auto flex items-center gap-1.5 border-t-2 border-line-subtle pt-2 text-micro uppercase',
                    choice.fit > 0 ? 'text-positive-fg' : choice.fit < 0 ? 'text-negative-fg' : 'text-fg-faint',
                  )}>
                    <span aria-hidden="true">{fit.icon}</span> {fit.label}
                  </span>

                  <AnimatePresence>
                    {isPicked && (
                      <motion.span
                        aria-hidden="true"
                        initial={reduce ? { opacity: 1 } : { scale: 2.4, rotate: -24, opacity: 0 }}
                        animate={{ scale: 1, rotate: -9, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 18 }}
                        className="pointer-events-none absolute bottom-2 right-3 rounded-sm bg-surface-raised border-[3px] border-team px-2 py-0.5 font-headline text-h3 font-black uppercase tracking-[0.12em] text-team-ink"
                      >
                        Decided
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Verdict: how the building takes it ── */}
        <AnimatePresence mode="wait">
          {chosen && (
            <motion.div
              key="verdict"
              role="status"
              ref={el => el?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ ...spring, delay: reduce ? 0 : 0.18 }}
              className={cx(
                'flex items-start gap-3 rounded-card p-4 toon-outline',
                chosen.fit > 0 ? 'bg-positive-bg' : chosen.fit < 0 ? 'bg-negative-bg' : 'bg-surface-sunken',
              )}
            >
              <span className="text-[28px] leading-none" aria-hidden="true">{scene.culture?.icon ?? '📣'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-micro uppercase tracking-[0.12em] text-fg-muted">The building reacts</p>
                <p className="mt-1 font-editorial text-[16px] leading-relaxed text-fg">{chosen.reaction}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
