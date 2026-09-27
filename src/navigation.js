// ── Navigation model ────────────────────────────────────────────────────────
// The app previously exposed 9 flat top-level tabs plus 3 screens that hid the
// nav entirely, plus a second 9-tile nav grid duplicated at the bottom of the
// Hub. That is 12 destinations competing for attention with no grouping.
//
// Now: 5–6 sections, each owning a small set of related screens. Screen ids
// are unchanged, so every screen component keeps working as-is.

export const SECTIONS = [
  {
    id: 'hub',
    label: 'Hub',
    icon: 'IconHub',
    screens: ['home'],
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'IconTeam',
    screens: ['roster', 'development', 'playbook', 'staff'],
  },
  {
    id: 'league',
    label: 'League',
    icon: 'IconLeague',
    screens: ['standings', 'schedule', 'stats', 'college', 'xfactors', 'journal'],
  },
  {
    id: 'office',
    label: 'Front Office',
    icon: 'IconOffice',
    screens: ['command', 'bigBoard', 'trade', 'freeAgency', 'contracts', 'assistants'],
  },
  {
    id: 'awards',
    label: 'Awards',
    icon: 'IconAwards',
    screens: ['awards'],
  },
];

/** Sub-tab labels, keyed by screen id. */
export const SCREEN_META = {
  staff: { label: 'Staff & Tree', title: 'Coaching Staff' },
  college: { label: 'Saturdays', title: 'College Saturdays' },
  command: { label: 'Command Center', title: 'Front Office' },
  bigBoard: { label: 'Big Board', title: 'Big Board' },
  contracts: { label: 'Contracts', title: 'Contracts' },
  xfactors: { label: 'X-Factors', title: 'X-Factors' },
  journal: { label: 'Journal', title: 'Franchise Journal' },
  assistants: { label: 'Assistants', title: 'Front Office Assistants' },
  home:        { label: 'Hub',          title: 'Franchise Hub' },
  roster:      { label: 'Roster',       title: 'Roster' },
  development: { label: 'Development',  title: 'Player Development' },
  playbook:    { label: 'Playbook',     title: 'Playbook' },
  standings:   { label: 'Standings',    title: 'Standings' },
  schedule:    { label: 'Schedule',     title: 'Schedule' },
  stats:       { label: 'Stats',        title: 'League Stats' },
  trade:       { label: 'Trade Machine', title: 'Trade Machine' },
  freeAgency:  { label: 'Free Agency',  title: 'Free Agency' },
  awards:      { label: 'Awards',       title: 'League Awards' },
  draft:       { label: 'Draft',        title: 'Draft Room' },
  playoffs:    { label: 'Playoffs',     title: 'Playoffs' },
};

/** Which section owns a given screen. */
export function sectionForScreen(screenId) {
  return SECTIONS.find(s => s.screens.includes(screenId))?.id ?? null;
}

/** The sub-tabs to show for a section, or [] when it has only one screen. */
export function subTabsForSection(sectionId) {
  const section = SECTIONS.find(s => s.id === sectionId);
  if (!section || section.screens.length < 2) return [];
  return section.screens.map(id => ({ id, label: SCREEN_META[id]?.label ?? id }));
}

/**
 * Screens that take over the whole window because they are set pieces with
 * their own pacing. Free Agency used to be here too, but it is an ordinary
 * management screen and belongs inside the shell.
 */
export const IMMERSIVE_SCREENS = new Set(['draft', 'playoffs']);

/**
 * The single most important thing the player can do right now. Drives the
 * persistent action button in the nav, so "what do I do next" is always
 * answerable from any screen.
 */
export function primaryActionFor(phase, week) {
  switch (phase) {
    case 'regular':    return { label: `Sim Week ${week}`, screen: 'home', intent: 'sim' };
    case 'playoffs':   return { label: 'Enter Playoffs',    screen: 'playoffs' };
    case 'offseason':  return { label: 'Offseason',         screen: 'command' };
    case 'freeAgency': return { label: 'Free Agency',       screen: 'freeAgency' };
    case 'draft':      return { label: 'Enter Draft Room',  screen: 'draft' };
    default:           return { label: 'Continue',          screen: 'home' };
  }
}

export const PHASE_LABELS = {
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  draft: 'Draft',
  offseason: 'Offseason',
  preseason: 'Preseason',
  freeAgency: 'Free Agency',
};
