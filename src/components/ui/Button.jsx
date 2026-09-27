import { forwardRef } from 'react';
import cx from './cx';

// Every clickable affordance in the app should be one of these five variants.
// Filled variants are cartoon buttons: ink outline, hard shadow, squash on press.

const VARIANTS = {
  // The one action the screen wants you to take. Max one per view.
  primary:
    'toon-press bg-team text-team-on shadow-1 hover:brightness-110',
  // Supporting actions.
  secondary:
    'toon-press bg-surface-raised text-fg shadow-1 hover:bg-surface-sunken',
  // Tertiary / inline.
  ghost:
    'bg-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg',
  // Destructive.
  danger:
    'toon-press bg-negative-solid text-n-0 shadow-1 hover:brightness-110',
  // High-emphasis non-team action (draft pick, sign player).
  accent:
    'toon-press bg-team-accent text-team-on-accent shadow-1 hover:brightness-105',
};

const SIZES = {
  sm: 'h-8  px-3 text-label gap-1.5 rounded-chip',
  md: 'h-10 px-4 text-label gap-2 rounded-card',
  lg: 'h-12 px-6 text-h3 font-display gap-2 rounded-card',
  xl: 'h-14 px-8 text-h2 font-display gap-3 rounded-panel',
};

const Button = forwardRef(function Button(
  {
    children,
    variant = 'secondary',
    size = 'md',
    icon = null,
    iconRight = null,
    fullWidth = false,
    loading = false,
    className = '',
    type = 'button',
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center font-bold whitespace-nowrap select-none',
        'transition-colors duration-micro ease-out',
        'disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none',
        VARIANTS[variant] ?? VARIANTS.secondary,
        SIZES[size] ?? SIZES.md,
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading
        ? <span className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin" />
        : icon}
      {children}
      {iconRight}
    </button>
  );
});

export default Button;
