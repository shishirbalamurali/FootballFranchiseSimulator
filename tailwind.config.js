/** @type {import('tailwindcss').Config} */
//
// Every value here maps to a CSS variable in src/styles/tokens.css.
// Add colors/sizes there first, then surface them here — never inline a hex.
//
// NOTE ON MIGRATION: this file *extends* rather than replaces Tailwind's
// defaults, so the not-yet-migrated screens keep rendering while pages move
// over one at a time. The final consistency sweep (Phase 6) replaces
// `theme.extend` with `theme` for colors + fontSize, which will hard-fail any
// screen still using `text-gray-400` / `text-xs` and guarantee full coverage.
//
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        n: {
          950: 'var(--n-950)', 900: 'var(--n-900)', 850: 'var(--n-850)',
          800: 'var(--n-800)', 750: 'var(--n-750)', 700: 'var(--n-700)',
          600: 'var(--n-600)', 500: 'var(--n-500)', 400: 'var(--n-400)',
          300: 'var(--n-300)', 200: 'var(--n-200)', 100: 'var(--n-100)',
          50:  'var(--n-50)',  0:   'var(--n-0)',
        },

        surface: {
          shell:   'var(--surface-shell)',
          base:    'var(--surface-base)',
          raised:  'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          sunken:  'var(--surface-sunken)',
          hover:   'var(--surface-hover)',
          active:  'var(--surface-active)',
        },

        // Foreground / text colors. Named `fg` because `ink` is already taken
        // by the legacy palette below (367 usages) and `content` collides with
        // Tailwind's own config key.
        fg: {
          DEFAULT:   'var(--text-primary)',
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          faint:     'var(--text-faint)',
          inverse:   'var(--text-inverse)',
        },

        line: {
          subtle:  'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong:  'var(--border-strong)',
        },

        positive: {
          fg: 'var(--positive-fg)', bg: 'var(--positive-bg)',
          border: 'var(--positive-border)', solid: 'var(--positive-solid)',
        },
        negative: {
          fg: 'var(--negative-fg)', bg: 'var(--negative-bg)',
          border: 'var(--negative-border)', solid: 'var(--negative-solid)',
        },
        warning: {
          fg: 'var(--warning-fg)', bg: 'var(--warning-bg)',
          border: 'var(--warning-border)', solid: 'var(--warning-solid)',
        },
        info: {
          fg: 'var(--info-fg)', bg: 'var(--info-bg)',
          border: 'var(--info-border)', solid: 'var(--info-solid)',
        },

        rarity: {
          bronze: 'var(--rarity-bronze)', silver: 'var(--rarity-silver)',
          gold:   'var(--rarity-gold)',   elite:  'var(--rarity-elite)',
          legend: 'var(--rarity-legend)',
        },

        xfactor: { DEFAULT: 'var(--xfactor)', 2: 'var(--xfactor-2)', wash: 'var(--xfactor-wash)', glow: 'var(--xfactor-glow)' },
        status: { danger: 'var(--status-danger)', warning: 'var(--status-warning)', positive: 'var(--status-positive)', info: 'var(--status-info)', neutral: 'var(--status-neutral)' },
        ink: 'var(--ink)',
        chalk: 'var(--chalk)',
        turf: { DEFAULT: 'var(--turf)', stripe: 'var(--turf-stripe)', line: 'var(--turf-line)', ball: 'var(--pigskin)', first: 'var(--first-down)', night: 'var(--turf-night)' },
        witch: { DEFAULT: 'var(--witch)', glow: 'var(--witch-glow)' },
        shadow: 'var(--shadow-color)',
        banner: { DEFAULT: 'var(--banner-bg)', fg: 'var(--banner-fg)', title: 'var(--title-fill)' },
        nav: { DEFAULT: 'var(--nav-bg)', fg: 'var(--nav-fg)' },

        team: {
          DEFAULT:     'var(--team-primary)',
          ink:         'var(--team-text)',
          'on-secondary': 'var(--team-on-secondary)',
          primary:     'var(--team-primary)',
          secondary:   'var(--team-secondary)',
          accent:      'var(--team-accent)',
          on:          'var(--team-on-primary)',
          'on-accent': 'var(--team-on-accent)',
          8:  'var(--team-tint-8)',
          16: 'var(--team-tint-16)',
          24: 'var(--team-tint-24)',
        },

        // Legacy aliases, now token-backed so old markup follows the theme.
        cream: 'var(--surface-sunken)',
        paper: 'var(--surface-raised)',
      },

      // The seven-step scale. Legacy text-xs/sm/lg/xl remain available until
      // the Phase 6 sweep removes them.
      fontSize: {
        micro:   ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '700' }],
        label:   ['13px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        body:    ['15px', { lineHeight: '22px' }],
        h3:      ['16px', { lineHeight: '20px', fontWeight: '700' }],
        h2:      ['22px', { lineHeight: '26px', fontWeight: '700' }],
        h1:      ['32px', { lineHeight: '34px', fontWeight: '700' }],
        display: ['46px', { lineHeight: '44px', fontWeight: '800' }],
        // Reserved for the ONE hero number on a screen (a final score, an OVR).
        hero:    ['76px', { lineHeight: '70px', fontWeight: '800' }],
      },

      // Semantic names so these don't silently redefine Tailwind's
      // rounded-sm/md/lg, which 130+ existing usages still depend on.
      borderRadius: {
        chip:  'var(--radius-sm)',
        card:  'var(--radius-md)',
        panel: 'var(--radius-lg)',
      },

      boxShadow: {
        1: 'var(--elev-1)',
        press: 'var(--elev-press)',
        2: 'var(--elev-2)',
        3: 'var(--elev-3)',
      },

      // Legacy: `border-3` is still used by 10 not-yet-migrated call sites.
      // The old `thick/thicker/thickest` and `rounded-retro` aliases were
      // defined but never used anywhere, so they are gone.
      borderWidth: {
        3: '3px',
        stroke: 'var(--stroke)',
      },

      fontFamily: {
        display: ['var(--font-display)'],
        headline: ['var(--font-headline)'],
        editorial: ['var(--font-editorial)'],
        sans:    ['var(--font-body)'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      spacing: {
        nav: 'var(--nav-height)',
      },
      maxWidth: {
        content: 'var(--content-max)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        bounce: 'var(--ease-bounce)',
      },
      transitionDuration: {
        micro: 'var(--dur-micro)',
        base:  'var(--dur-base)',
        slow:  'var(--dur-slow)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'pop-in':  { from: { opacity: '0', transform: 'scale(0.96)' },     to: { opacity: '1', transform: 'none' } },
        shimmer:   { '100%': { transform: 'translateX(100%)' } },
        foil:      { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        wobble:    { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
        'bounce-in': { '0%': { opacity: '0', transform: 'scale(.8) rotate(-3deg)' }, '60%': { opacity: '1', transform: 'scale(1.04) rotate(1deg)' }, '100%': { transform: 'none' } },
        'stripe-slide': { to: { backgroundPosition: '28px 0' } },
        'zone-pulse': { '0%,100%': { boxShadow: '0 0 0 0 var(--xfactor-glow)' }, '50%': { boxShadow: '0 0 0 8px transparent' } },
        'reveal-flip': { from: { transform: 'rotateY(90deg)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'slide-in-left':  { from: { opacity: '0', transform: 'translateX(-24px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(24px)' },  to: { opacity: '1', transform: 'none' } },
        'witch-pulse': { '0%,100%': { boxShadow: 'inset 0 0 24px 2px var(--witch-glow)' }, '50%': { boxShadow: 'inset 0 0 48px 8px var(--witch-glow)' } },
      },
      animation: {
        'fade-up': 'fade-up var(--dur-base) var(--ease-out) both',
        'pop-in':  'pop-in var(--dur-base) var(--ease-out) both',
        shimmer:   'shimmer 1.6s infinite',
        foil:      'foil 4s ease-in-out infinite',
        wobble:    'wobble 2.4s ease-in-out infinite',
        'bounce-in': 'bounce-in 420ms var(--ease-out) both',
        'stripe-slide': 'stripe-slide 1s linear infinite',
        'zone-pulse': 'zone-pulse 1.6s ease-in-out infinite',
        'reveal-flip': 'reveal-flip 520ms var(--ease-bounce) both',
        'slide-in-left':  'slide-in-left 320ms var(--ease-out) both',
        'slide-in-right': 'slide-in-right 320ms var(--ease-out) both',
        'witch-pulse': 'witch-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
