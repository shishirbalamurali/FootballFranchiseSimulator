// ── Contrast utilities ──────────────────────────────────────────────────────
// The single implementation of what used to be `gc()` / `getContrastColor()`
// copy-pasted into 16 separate files with three different thresholds.

/** Relative luminance (WCAG 2.x), 0–1. */
export function luminance(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 0;
  const srgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = srgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two hex colors, 1–21. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Best readable foreground for a background.
 * Picks whichever of near-white / near-black actually scores higher, rather
 * than the old fixed 128-brightness cut that failed on saturated team colors.
 */
export function onColor(bg, { light = '#ffffff', dark = '#0b0e14' } = {}) {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/** `rgba()` string for a hex at a given alpha — for tints without a 2nd color. */
export function alpha(hex, a) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${a})`;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default onColor;
