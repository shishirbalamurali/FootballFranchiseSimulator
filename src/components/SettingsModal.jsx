import { motion } from 'framer-motion';
import { Modal, Button, cx } from './ui';
import { usePreference, setPreference, SIM_SPEED_OPTIONS } from './preferences';

// Game settings. Presentation preferences are per-device (preferences.js);
// the franchise actions below act on the current save.

function Section({ title, hint, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-headline text-h2 uppercase leading-none text-fg">{title}</h3>
        {hint && <p className="mt-1 text-label text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Three animated bars: a tiny preview of how long a sim takes. */
function SpeedGlyph({ id, active }) {
  const dur = { slow: 1.6, fast: 0.55, instant: 0 }[id];
  return (
    <span aria-hidden="true" className="flex h-6 items-end gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className={cx('w-1.5 rounded-sm', active ? 'bg-team-on' : 'bg-fg-faint')}
          initial={{ height: 6 }}
          animate={dur ? { height: [6, 22, 6] } : { height: 22 }}
          transition={dur ? { duration: dur, repeat: Infinity, delay: i * dur * 0.2, ease: 'easeInOut' } : { duration: 0 }}
        />
      ))}
    </span>
  );
}

export default function SettingsModal({ open, onClose, onOpenSaveSlots, onResetFranchise }) {
  const simSpeed = usePreference('simSpeed');

  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow="Game settings" title="Settings"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-8">
        <Section title="Sim speed" hint="How long the scoreboard runs when you sim a week or a playoff round. You can still skip any game.">
          <div role="radiogroup" aria-label="Sim speed" className="grid gap-3 sm:grid-cols-3">
            {SIM_SPEED_OPTIONS.map(opt => {
              const active = simSpeed === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreference('simSpeed', opt.id)}
                  className={cx(
                    'flex flex-col gap-2 rounded-card p-4 text-left toon-outline',
                    'transition-[transform,background-color] duration-micro hover:-translate-y-0.5',
                    active ? 'bg-team text-team-on shadow-[3px_3px_0_0_var(--ink)]' : 'bg-surface-sunken text-fg',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-headline text-h2 uppercase leading-none">{opt.label}</span>
                    <SpeedGlyph id={opt.id} active={active} />
                  </span>
                  <span className={cx('text-label', active ? 'opacity-90' : 'text-fg-muted')}>{opt.blurb}</span>
                  <span className={cx('text-micro uppercase tabular-nums', active ? 'opacity-80' : 'text-fg-faint')}>
                    {opt.seconds} per week
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Franchise" hint="Switch between saved franchises, or start this one over.">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => { onClose(); onOpenSaveSlots?.(); }}>Save slots</Button>
            <Button variant="danger" onClick={() => { onClose(); onResetFranchise?.(); }}>Reset franchise…</Button>
          </div>
        </Section>
      </div>
    </Modal>
  );
}
