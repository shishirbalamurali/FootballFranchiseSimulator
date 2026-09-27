// ── Team style engine ───────────────────────────────────────────────────────
// Every franchise gets its own cartoon-retro identity: a paper stock tinted by
// its colours, an ink, a lettering face, a pattern, and a day/night mode.
// `buildTeamTheme()` turns that into the full set of CSS custom properties the
// token layer reads — ThemeProvider is the only caller.

import { contrastRatio, luminance } from '../components/ui/contrast';

// ── Lettering ─────────────────────────────────────────────────────────────
// All loaded up front from Google Fonts (see the @import in index.css) so
// the TeamSelect live preview can swap faces instantly.
// Picked for similar set-widths so headings don't reflow wildly per team.
export const DISPLAY_FONTS = {
  bangers:   { family: 'Bangers',               query: 'Bangers',                          tracking: '0.04em' },
  lilita:    { family: 'Lilita One',            query: 'Lilita+One',                       tracking: '0.01em' },
  changa:    { family: 'Changa One',            query: 'Changa+One:ital@0;1',              tracking: '0.01em' },
  passion:   { family: 'Passion One',           query: 'Passion+One:wght@700;900',         tracking: '0.02em' },
  shoulders: { family: 'Big Shoulders Display', query: 'Big+Shoulders+Display:wght@800;900', tracking: '0.02em' },
  staatl:    { family: 'Staatliches',           query: 'Staatliches',                      tracking: '0.03em' },
  racing:    { family: 'Racing Sans One',       query: 'Racing+Sans+One',                  tracking: '0.02em' },
  titan:     { family: 'Titan One',             query: 'Titan+One',                        tracking: '0.01em' },
  squada:    { family: 'Squada One',            query: 'Squada+One',                       tracking: '0.03em' },
};

// ── Per-franchise art direction ───────────────────────────────────────────
// mode:    'day' (cream paper, dark ink) | 'night' (dark stock, cream ink)
// font:    key into DISPLAY_FONTS
// pattern: key into PATTERNS
// shadow:  what the hard offset shadow is drawn in — 'ink' | 'accent' | 'secondary'
export const TEAM_STYLES = {
  "ravens": { mode: 'night', font: 'staatl', pattern: 'diagonal', shadow: 'ink', tagline: "Own the air" },
  "bengals": { mode: 'day', font: 'shoulders', pattern: 'pinstripe', shadow: 'ink', tagline: "Run together" },
  "browns": { mode: 'night', font: 'squada', pattern: 'diamonds', shadow: 'ink', tagline: "See the whole field" },
  "steelers": { mode: 'day', font: 'staatl', pattern: 'chevron', shadow: 'ink', tagline: "Find your mark" },
  "texans": { mode: 'day', font: 'racing', pattern: 'sunburst', shadow: 'ink', tagline: "Reach higher" },
  "colts": { mode: 'night', font: 'shoulders', pattern: 'chevron', shadow: 'ink', tagline: "Take the high ground" },
  "jaguars": { mode: 'day', font: 'staatl', pattern: 'diamonds', shadow: 'ink', tagline: "Earn the crown" },
  "titans": { mode: 'day', font: 'squada', pattern: 'grid', shadow: 'ink', tagline: "Set the direction" },
  "bills": { mode: 'day', font: 'passion', pattern: 'pinstripe', shadow: 'ink', tagline: "Built to endure" },
  "dolphins": { mode: 'night', font: 'squada', pattern: 'chevron', shadow: 'ink', tagline: "Own the night" },
  "patriots": { mode: 'day', font: 'staatl', pattern: 'pinstripe', shadow: 'ink', tagline: "Light the way" },
  "jets": { mode: 'night', font: 'shoulders', pattern: 'grid', shadow: 'ink', tagline: "Stand above" },
  "broncos": { mode: 'day', font: 'squada', pattern: 'chevron', shadow: 'ink', tagline: "Small margin. Big fight." },
  "chiefs": { mode: 'day', font: 'passion', pattern: 'pinstripe', shadow: 'ink', tagline: "Move as one" },
  "raiders": { mode: 'night', font: 'staatl', pattern: 'zigzag', shadow: 'ink', tagline: "Strike from anywhere" },
  "chargers": { mode: 'day', font: 'shoulders', pattern: 'waves', shadow: 'ink', tagline: "Turn the tide" },
  "bears": { mode: 'day', font: 'shoulders', pattern: 'rivets', shadow: 'ink', tagline: "Built by hand" },
  "lions": { mode: 'day', font: 'racing', pattern: 'diagonal', shadow: 'ink', tagline: "Win the next yard" },
  "packers": { mode: 'day', font: 'passion', pattern: 'plaid', shadow: 'ink', tagline: "Hold your ground" },
  "vikings": { mode: 'night', font: 'squada', pattern: 'chevron', shadow: 'ink', tagline: "Weather every storm" },
  "falcons": { mode: 'day', font: 'staatl', pattern: 'chevron', shadow: 'ink', tagline: "Lead the charge" },
  "panthers": { mode: 'day', font: 'squada', pattern: 'diamonds', shadow: 'ink', tagline: "Wait. Read. Strike." },
  "saints": { mode: 'night', font: 'staatl', pattern: 'diamonds', shadow: 'ink', tagline: "Keep the flame" },
  "bucs": { mode: 'day', font: 'racing', pattern: 'waves', shadow: 'ink', tagline: "Rise with purpose" },
  "cowboys": { mode: 'day', font: 'passion', pattern: 'diagonal', shadow: 'ink', tagline: "Never give ground" },
  "giants": { mode: 'day', font: 'shoulders', pattern: 'chevron', shadow: 'ink', tagline: "Rooted here" },
  "eagles": { mode: 'day', font: 'staatl', pattern: 'pinstripe', shadow: 'ink', tagline: "Write the next chapter" },
  "commanders": { mode: 'day', font: 'racing', pattern: 'diagonal', shadow: 'ink', tagline: "Always one step ahead" },
  "cardinals": { mode: 'day', font: 'racing', pattern: 'diagonal', shadow: 'ink', tagline: "Set the pace" },
  "49ers": { mode: 'day', font: 'squada', pattern: 'waves', shadow: 'ink', tagline: "Three points. One purpose." },
  "seahawks": { mode: 'day', font: 'racing', pattern: 'waves', shadow: 'ink', tagline: "Against the current" },
  "rams": { mode: 'night', font: 'shoulders', pattern: 'diagonal', shadow: 'ink', tagline: "Make your mark" },
};

const DEFAULT_STYLE = { mode: 'day', font: 'bangers', pattern: 'halftone', shadow: 'ink', tagline: 'Franchise Simulator' };

export function getTeamStyle(teamId) {
  return TEAM_STYLES[teamId] ?? DEFAULT_STYLE;
}

// ── Colour maths ─────────────────────────────────────────────────────────
function toRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return [0, 0, 0];
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
}
function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
/** Linear blend: t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
}
function rgba(hex, a) {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** Darken toward black until the colour clears `ratio` against `bg`. */
function readableOn(color, bg, ratio = 4.5) {
  let c = color;
  const towards = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  for (let i = 0; i < 14 && contrastRatio(c, bg) < ratio; i++) c = mix(c, towards, 0.12);
  return c;
}
function onFill(bg, light, dark) {
  const preferred = contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
  if (contrastRatio(bg, preferred) >= 4.5) return preferred;
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#000000') ? '#ffffff' : '#000000';
}
function saturation(hex) {
  const [r, g, b] = toRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// ── Patterns ─────────────────────────────────────────────────────────────
// Each returns an SVG tile. Colour is baked in (CSS vars can't reach inside
// a data URI), which is why patterns are rebuilt per team.
const svg = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`,
  )}")`;

export const PATTERNS = {
  halftone:  c => ({ image: svg(14, 14, `<circle cx='3.5' cy='3.5' r='1.8' fill='${c}'/><circle cx='10.5' cy='10.5' r='1.8' fill='${c}'/>`), size: '14px 14px' }),
  polka:     c => ({ image: svg(36, 36, `<circle cx='9' cy='9' r='4.5' fill='${c}'/><circle cx='27' cy='27' r='4.5' fill='${c}'/>`), size: '36px 36px' }),
  spots:     c => ({ image: svg(60, 60, `<path d='M12 10c5-3 11 1 9 6s-9 6-11 2-2-6 2-8zM42 34c4-2 9 1 8 5s-7 5-9 2-2-5 1-7zM44 6c3-1 5 2 4 4s-5 2-5 0 0-3 1-4zM14 44c3-1 6 1 5 4s-5 3-6 1-1-4 1-5z' fill='${c}'/>`), size: '60px 60px' }),
  pinstripe: c => ({ image: svg(22, 22, `<rect x='10' width='2' height='22' fill='${c}'/>`), size: '22px 22px' }),
  diagonal:  c => ({ image: svg(24, 24, `<path d='M-6 6 6 -6M0 24 24 0M18 30 30 18' stroke='${c}' stroke-width='5'/>`), size: '24px 24px' }),
  tiger:     c => ({ image: svg(80, 40, `<path d='M0 8c14 2 22 10 30 22-10-6-20-9-30-8zM40 0c10 6 18 6 26 2-6 8-16 12-26 8zM48 40c6-10 16-14 32-14-10 4-18 10-22 14z' fill='${c}'/>`), size: '80px 40px' }),
  checker:   c => ({ image: svg(28, 28, `<rect width='14' height='14' fill='${c}'/><rect x='14' y='14' width='14' height='14' fill='${c}'/>`), size: '28px 28px' }),
  plaid:     c => ({ image: svg(40, 40, `<rect y='14' width='40' height='6' fill='${c}'/><rect x='14' width='6' height='40' fill='${c}'/><rect y='30' width='40' height='2' fill='${c}'/><rect x='30' width='2' height='40' fill='${c}'/>`), size: '40px 40px' }),
  chevron:   c => ({ image: svg(40, 20, `<path d='M0 14 10 4l10 10 10-10 10 10' fill='none' stroke='${c}' stroke-width='4'/>`), size: '40px 20px' }),
  zigzag:    c => ({ image: svg(32, 16, `<path d='M0 12 8 4l8 8 8-8 8 8' fill='none' stroke='${c}' stroke-width='3'/>`), size: '32px 16px' }),
  waves:     c => ({ image: svg(48, 20, `<path d='M0 10c6-8 18-8 24 0s18 8 24 0' fill='none' stroke='${c}' stroke-width='3'/>`), size: '48px 20px' }),
  diamonds:  c => ({ image: svg(28, 28, `<path d='M14 3 22 14 14 25 6 14z' fill='${c}'/>`), size: '28px 28px' }),
  stars:     c => ({ image: svg(48, 48, `<path d='M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6zM36 28l2.4 5 5.4.6-4 3.7 1.1 5.3L36 40l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z' fill='${c}'/>`), size: '48px 48px' }),
  bolts:     c => ({ image: svg(40, 40, `<path d='M14 2 6 18h6l-4 14 12-18h-7l5-12z' fill='${c}'/><path d='M34 22l-5 9h4l-2 8 7-10h-4l3-7z' fill='${c}'/>`), size: '40px 40px' }),
  rivets:    c => ({ image: svg(24, 24, `<circle cx='12' cy='12' r='3' fill='${c}'/><circle cx='12' cy='12' r='1.2' fill='none' stroke='${c}'/>`), size: '24px 24px' }),
  grid:      c => ({ image: svg(26, 26, `<path d='M0 .5h26M.5 0v26' stroke='${c}' stroke-width='1.5'/>`), size: '26px 26px' }),
  sunburst:  c => ({ image: svg(60, 60, `<path d='M30 30 30 0 38 0zM30 30 60 30 60 38zM30 30 30 60 22 60zM30 30 0 30 0 22zM30 30 60 0 60 8zM30 30 0 60 0 52z' fill='${c}'/>`), size: '60px 60px' }),
};

function patternVars(name, color, prefix) {
  const p = (PATTERNS[name] ?? PATTERNS.halftone)(color);
  return { [`--${prefix}-image`]: p.image, [`--${prefix}-size`]: p.size };
}

// ── Palette builder ──────────────────────────────────────────────────────
const CREAM = '#f7efdc';
const CARD = '#fffaf0';
const BLACK = '#0d0a10';

const DEFAULT_THEME = { primary: '#e8552b', secondary: '#16254a', accent: '#ffc933' };

/**
 * @returns {{ mode:string, font:object, style:object, vars:Record<string,string> }}
 */
export function buildTeamTheme(team) {
  const style = getTeamStyle(team?.id);
  const t = team?.theme ?? DEFAULT_THEME;
  const primary = t.primary;
  const secondary = t.secondary;
  const accent = t.accent;

  // Of the two brand colours, the darker one becomes the root of the ink.
  const darker = luminance(primary) <= luminance(secondary) ? primary : secondary;
  const brandInk = mix(darker, BLACK, 0.62);

  const night = style.mode === 'night';
  const v = {};

  if (!night) {
    const tint = saturation(primary) > 0.12 ? primary : secondary;
    const shell = mix(CREAM, tint, 0.13);
    const raised = mix(CARD, tint, 0.035);
    const sunken = mix(CREAM, tint, 0.24);
    const ink = brandInk;

    Object.assign(v, {
      '--surface-shell': shell,
      '--surface-base': shell,
      '--surface-raised': raised,
      '--surface-overlay': raised,
      '--surface-sunken': sunken,
      '--surface-hover': rgba(ink, 0.06),
      '--surface-active': rgba(ink, 0.11),
      '--ink': ink,
      '--text-primary': ink,
      '--text-secondary': mix(ink, raised, 0.22),
      '--text-muted': mix(ink, raised, 0.36),
      '--text-faint': readableOn(mix(ink, raised, 0.48), sunken, 3.2),
      '--text-inverse': CARD,
      '--border-subtle': rgba(ink, 0.14),
      '--border-default': rgba(ink, 0.32),
      '--border-strong': ink,
      '--pattern-alpha': '0.035',
    });
  } else {
    const tint = saturation(primary) > 0.12 ? primary : (saturation(secondary) > 0.12 ? secondary : primary);
    const shell = mix(mix('#15121c', tint, 0.22), BLACK, 0.15);
    const raised = mix('#221d2b', tint, 0.2);
    const sunken = mix(shell, BLACK, 0.35);
    const text = '#fbf2dc';
    const ink = '#060409';

    Object.assign(v, {
      '--surface-shell': shell,
      '--surface-base': shell,
      '--surface-raised': raised,
      '--surface-overlay': mix(raised, '#ffffff', 0.04),
      '--surface-sunken': sunken,
      '--surface-hover': 'rgba(255, 244, 220, 0.06)',
      '--surface-active': 'rgba(255, 244, 220, 0.11)',
      '--ink': ink,
      '--text-primary': text,
      '--text-secondary': mix(text, raised, 0.2),
      '--text-muted': mix(text, raised, 0.36),
      '--text-faint': readableOn(mix(text, raised, 0.5), sunken, 3.2),
      '--text-inverse': ink,
      '--border-subtle': 'rgba(255, 244, 220, 0.10)',
      '--border-default': 'rgba(255, 244, 220, 0.22)',
      '--border-strong': ink,
      '--pattern-alpha': '0.045',
    });
  }

  // ── Status colours tuned for the paper they sit on ──
  if (!night) {
    Object.assign(v, {
      '--positive-fg': '#157a3a', '--positive-bg': 'rgba(34, 160, 80, 0.14)', '--positive-border': 'rgba(21, 122, 58, 0.55)', '--positive-solid': '#1f9d4c',
      '--negative-fg': '#c0261c', '--negative-bg': 'rgba(220, 50, 40, 0.12)', '--negative-border': 'rgba(192, 38, 28, 0.55)', '--negative-solid': '#d8362a',
      '--warning-fg':  '#a55a00', '--warning-bg':  'rgba(245, 160, 20, 0.18)', '--warning-border':  'rgba(165, 90, 0, 0.55)',  '--warning-solid':  '#f0a020',
      '--info-fg':     '#1e5bc6', '--info-bg':     'rgba(40, 110, 230, 0.12)', '--info-border':     'rgba(30, 91, 198, 0.55)', '--info-solid':     '#2f6fe0',
      '--rarity-bronze': '#9c5a24', '--rarity-bronze-wash': 'rgba(176, 115, 63, 0.18)',
      '--rarity-silver': '#5f6b7a', '--rarity-silver-wash': 'rgba(120, 135, 150, 0.18)',
      '--rarity-gold':   '#a87400', '--rarity-gold-wash':   'rgba(230, 175, 30, 0.24)',
      '--rarity-elite':  '#7a2fd6', '--rarity-elite-wash':  'rgba(150, 80, 240, 0.16)',
      '--rarity-legend': '#d8401c', '--rarity-legend-wash': 'rgba(255, 94, 58, 0.18)',
    });
  } else {
    Object.assign(v, {
      '--positive-fg': '#5ee38a', '--positive-bg': 'rgba(60, 220, 120, 0.14)', '--positive-border': 'rgba(94, 227, 138, 0.5)', '--positive-solid': '#22a553',
      '--negative-fg': '#ff7a6b', '--negative-bg': 'rgba(255, 90, 70, 0.14)', '--negative-border': 'rgba(255, 122, 107, 0.5)', '--negative-solid': '#e0392b',
      '--warning-fg':  '#ffc23d', '--warning-bg':  'rgba(255, 190, 50, 0.15)', '--warning-border':  'rgba(255, 194, 61, 0.5)',  '--warning-solid':  '#f0a020',
      '--info-fg':     '#78b4ff', '--info-bg':     'rgba(100, 160, 255, 0.14)', '--info-border':     'rgba(120, 180, 255, 0.5)', '--info-solid':     '#2f6fe0',
      '--rarity-bronze': '#d9955a', '--rarity-bronze-wash': 'rgba(217, 149, 90, 0.18)',
      '--rarity-silver': '#c3ccd6', '--rarity-silver-wash': 'rgba(195, 204, 214, 0.16)',
      '--rarity-gold':   '#ffcc4d', '--rarity-gold-wash':   'rgba(255, 204, 77, 0.18)',
      '--rarity-elite':  '#c08bff', '--rarity-elite-wash':  'rgba(192, 139, 255, 0.18)',
      '--rarity-legend': '#ff7a52', '--rarity-legend-wash': 'rgba(255, 122, 82, 0.22)',
    });
  }

  // ── Team colours ──
  const raised = v['--surface-raised'];
  const light = night ? '#fbf2dc' : '#fffaf0';
  const dark = night ? '#060409' : v['--ink'];
  const shadowSource = {
    ink: v['--ink'],
    accent,
    secondary: luminance(secondary) > 0.9 ? accent : secondary,
    primary,
  }[style.shadow] ?? v['--ink'];

  Object.assign(v, {
    '--crest-surface': CARD,
    '--team-primary': primary,
    '--team-secondary': secondary,
    '--team-accent': accent,
    '--team-on-primary': onFill(primary, light, dark),
    '--team-on-accent': onFill(accent, light, dark),
    '--team-on-secondary': onFill(secondary, light, dark),
    // Team colour as *text* — nudged until it's readable on a card.
    '--team-text': readableOn(primary, raised, night ? 4.2 : 4.5),
    '--team-tint-8': rgba(primary, night ? 0.14 : 0.1),
    '--team-tint-16': rgba(primary, night ? 0.24 : 0.18),
    '--team-tint-24': rgba(primary, night ? 0.34 : 0.26),
    '--shadow-color': shadowSource,
    // Banner stock: primary, deepened a touch on night so the paper reads as
    // the "lit" layer.
    '--banner-bg': night ? mix(primary, BLACK, 0.18) : primary,
    '--banner-fg': onFill(night ? mix(primary, BLACK, 0.18) : primary, '#fffaf0', v['--ink'] === '#060409' ? '#060409' : v['--ink']),
    '--nav-bg': night ? mix(v['--surface-shell'], BLACK, 0.55) : mix(brandInk, BLACK, 0.1),
    '--nav-fg': '#fbf2dc',
  });

  // Cartoon lettering fill: the accent when it pops off the banner, else cream.
  // The ink outline carries legibility either way.
  const bannerBg = v['--banner-bg'];
  v['--title-fill'] = luminance(accent) > 0.3 && contrastRatio(accent, bannerBg) > 1.7 ? accent : '#fffaf0';

  // ── Patterns ── page wallpaper in ink, banner in the banner's own contrast
  const bgPatternColor = night ? '#fbf2dc' : v['--ink'];
  Object.assign(v, patternVars(style.pattern, bgPatternColor, 'pattern'));
  Object.assign(v, patternVars(style.pattern, v['--banner-fg'], 'banner-pattern'));

  // Copies of the paper text colours so `.paper-scope` can restore them
  // inside a banner (which re-points --text-* at --banner-fg).
  for (const k of ['primary', 'secondary', 'muted', 'faint']) {
    v[`--paper-text-${k}`] = v[`--text-${k}`];
  }

  const font = DISPLAY_FONTS[style.font] ?? DISPLAY_FONTS.bangers;
  v['--font-display'] = `'${font.family}', 'Rubik', system-ui, sans-serif`;
  v['--display-tracking'] = font.tracking;

  return { mode: style.mode, font, style, vars: v };
}
