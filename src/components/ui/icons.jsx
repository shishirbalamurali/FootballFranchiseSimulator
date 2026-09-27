// Inline stroke icons. Emoji were rendering differently on every OS (and at
// wildly different optical weights), which was a large part of the amateur
// feel in the nav and section headers.
//
// All icons share one 24×24 grid, 1.75 stroke, currentColor.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

const Icon = ({ size = 18, children, ...rest }) => (
  <svg {...base} width={size} height={size} {...rest}>{children}</svg>
);

export const IconHub = (p) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5.5h5V20" /></Icon>
);
export const IconTeam = (p) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 6.3" /><path d="M17.8 14.2A6.5 6.5 0 0 1 21.5 20" /></Icon>
);
export const IconLeague = (p) => (
  <Icon {...p}><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3" /><path d="M17 5.5h2.5V7a3 3 0 0 1-3 3" /><path d="M12 13v4" /><path d="M8.5 20h7" /><path d="M10 17h4l1 3H9z" /></Icon>
);
export const IconOffice = (p) => (
  <Icon {...p}><path d="M3 8.5h18V20H3z" /><path d="M9 8.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2.5" /><path d="M3 13.5h18" /><path d="M11 13.5h2v2.5h-2z" /></Icon>
);
export const IconDraft = (p) => (
  <Icon {...p}><path d="M12 3v11" /><path d="m8 10.5 4 4 4-4" /><path d="M4 17.5v2a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-2" /></Icon>
);
export const IconAwards = (p) => (
  <Icon {...p}><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.8-1.3 6.4 4.8-2.6 4.8 2.6-1.3-6.4" /></Icon>
);
export const IconChart = (p) => (
  <Icon {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7.5 15 3.5-4 3 2.5L20 7" /></Icon>
);
export const IconCalendar = (p) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></Icon>
);
export const IconSwap = (p) => (
  <Icon {...p}><path d="M4 8h13" /><path d="m14 5 3 3-3 3" /><path d="M20 16H7" /><path d="m10 13-3 3 3 3" /></Icon>
);
export const IconBook = (p) => (
  <Icon {...p}><path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 0-2 2z" /><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" /></Icon>
);
export const IconGrowth = (p) => (
  <Icon {...p}><path d="M4 19 10 12l3.5 3.5L20 7" /><path d="M15.5 7H20v4.5" /></Icon>
);
export const IconSettings = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.93-1.15l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 14.5a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></Icon>
);
export const IconBell = (p) => (
  <Icon {...p}><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></Icon>
);
export const IconInjury = (p) => (
  <Icon {...p}><rect x="3.5" y="8" width="17" height="8" rx="2.5" /><path d="M12 10v4" /><path d="M10 12h4" /></Icon>
);
export const IconFlame = (p) => (
  <Icon {...p}><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.7.8-3 1.6-4 .2 1 .9 1.8 1.7 1.8 1.3 0 1.7-1.3 1.7-3.3 0-1.4-.5-2.4-1-3.5z" /></Icon>
);
export const IconArrowRight = (p) => (
  <Icon {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>
);
export const IconPlay = (p) => (
  <Icon {...p}><path d="M7 4.5 19 12 7 19.5z" /></Icon>
);
export const IconFastForward = (p) => (
  <Icon {...p}><path d="M4 5.5 12 12l-8 6.5z" /><path d="M13 5.5 21 12l-8 6.5z" /></Icon>
);
