// Canvas can't read CSS custom properties — `ctx.fillStyle = 'var(--x)'` is a
// no-op. This resolves the token layer to concrete values once per frame-loop
// start so the in-game HUD matches the rest of the app instead of carrying its
// own hardcoded palette.

const TOKEN_KEYS = {
  shell:     '--surface-shell',
  base:      '--surface-base',
  raised:    '--surface-raised',
  overlay:   '--surface-overlay',
  sunken:    '--surface-sunken',
  text:      '--text-primary',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  border:    '--border-default',
  positive:  '--positive-fg',
  negative:  '--negative-fg',
  warning:   '--warning-fg',
  info:      '--info-fg',
  team:      '--team-primary',
  teamOn:    '--team-on-primary',
  accent:    '--team-accent',
};

let cache = null;

/** Resolved token map for canvas drawing. Call `refreshCanvasTokens()` after a theme change. */
export function canvasTokens() {
  if (cache) return cache;
  const cs = getComputedStyle(document.documentElement);
  cache = Object.fromEntries(
    Object.entries(TOKEN_KEYS).map(([k, v]) => [k, cs.getPropertyValue(v).trim() || '#ffffff']),
  );
  return cache;
}

export function refreshCanvasTokens() {
  cache = null;
  return canvasTokens();
}
