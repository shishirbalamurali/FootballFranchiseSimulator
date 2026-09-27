import { useState } from 'react';
import {
  Button, TeamCrest, Tabs, ConfirmModal, cx,
  IconHub, IconTeam, IconLeague, IconOffice, IconAwards, IconSettings,
  IconFastForward, IconArrowRight,
} from './ui';
import {
  SECTIONS, sectionForScreen, subTabsForSection,
  primaryActionFor, PHASE_LABELS,
} from '../navigation';
import SettingsModal from './SettingsModal';
import PhoneButton from './frontOffice/Phone';

const ICONS = {
  IconHub, IconTeam, IconLeague, IconOffice, IconAwards,
};

/**
 * The persistent shell. Three jobs:
 *   1. say where you are (section + sub-tab)
 *   2. say what state the franchise is in (phase pill)
 *   3. always offer the one action that moves the season forward
 */
export default function AppNav({
  screen,
  onNavigate,
  team,
  phase,
  week,
  record,
  onPrimaryAction,
  onOpenSaveSlots,
  onResetFranchise,
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeSection = sectionForScreen(screen);
  const subTabs = subTabsForSection(activeSection);
  const action = primaryActionFor(phase, week);

  return (
    <header className="relative z-30 shrink-0">
      {/* ── Row 1: identity · sections · action ── */}
      <div className="nav-scope flex h-nav items-center gap-1 bg-nav px-3">
        {/* Franchise mark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="group flex shrink-0 items-center gap-2.5 self-stretch pr-4 mr-2 border-r-2 border-line"
          title={team ? `${team.location} ${team.name}` : 'Franchise'}
        >
          {team && (
            <span className="transition-transform duration-base ease-bounce group-hover:-rotate-6 group-hover:scale-110">
              <TeamCrest team={team} size={38} decorative />
            </span>
          )}
          <span className="hidden text-left leading-none lg:block">
            <span className="block text-micro uppercase text-fg-faint">{team?.location ?? 'Gridiron'}</span>
            <span className="mt-0.5 block font-display text-h2 uppercase text-team-accent">{team?.name ?? 'Franchise'}</span>
          </span>
        </button>

        {/* Sections */}
        <nav aria-label="Main" className="flex items-center gap-1">
          {SECTIONS.map(section => {
            const Icon = ICONS[section.icon];
            const active = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                aria-label={section.label}
                title={section.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(section.screens[0])}
                className={cx(
                  'relative flex h-9 items-center gap-2 rounded-full px-3.5 text-label font-bold whitespace-nowrap',
                  'transition-[background-color,color,transform] duration-micro',
                  active
                    ? 'bg-team-accent text-team-on-accent -rotate-2 shadow-[0_0_0_2px_var(--ink),3px_3px_0_2px_var(--team-primary)]'
                    : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
                )}
              >
                {Icon && <Icon size={17} />}
                <span className="hidden md:inline">{section.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex shrink-0 items-center gap-3 pl-4">
          {/* Phase pill — the franchise's current state, always visible */}
          <div className="hidden items-center gap-2 rounded-full border-2 border-line px-3 py-1.5 sm:flex">
            <span className="size-2 rounded-full bg-team-accent shadow-[0_0_0_1.5px_var(--ink)] animate-pulse" />
            <span className="text-micro uppercase text-fg-secondary">
              {PHASE_LABELS[phase] ?? phase}
              {phase === 'regular' && ` · Wk ${week}`}
            </span>
            {record && <span className="text-micro tabular-nums text-fg-faint">{record}</span>}
          </div>

          {/* The one action that advances the season */}
          <Button
            variant="primary"
            size="sm"
            icon={phase === 'regular' ? <IconFastForward size={14} /> : null}
            iconRight={phase === 'regular' ? null : <IconArrowRight size={14} />}
            onClick={() => onPrimaryAction(action)}
          >
            {action.label}
          </Button>

          {/* The front-office phone: trade calls, agents, decisions. */}
          <PhoneButton />

          {/* Settings — sim speed plus the destructive/save controls, kept
              out of the page header next to the team name. */}
          <Button
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            aria-label="Settings"
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings size={16} />
          </Button>
        </div>
      </div>

      {/* ── Row 2: sub-tabs, only when the section has more than one screen ── */}
      {/* Varsity stripe — primary over accent, inked top and bottom */}
      <div aria-hidden="true" className="h-2.5 border-y-[2.5px] border-ink bg-team">
        <div className="mx-auto h-full w-full bg-[linear-gradient(90deg,transparent_0_60%,var(--team-accent)_60%_66%,transparent_66%_70%,var(--team-accent)_70%_72%,transparent_72%)]" />
      </div>

      {subTabs.length > 0 && (
        <div className="border-b-2 border-line bg-surface-sunken">
          <Tabs
            items={subTabs}
            value={screen}
            onChange={onNavigate}
            label={`${activeSection} sections`}
            className="mx-auto max-w-content border-b-0 px-6 py-1.5"
          />
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenSaveSlots={onOpenSaveSlots}
        onResetFranchise={() => setConfirmReset(true)}
      />

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={onResetFranchise}
        destructive
        title="Reset franchise?"
        body="Your whole save — roster, season history, coach progress — is deleted and the franchise starts over. This cannot be undone."
        confirmLabel="Reset everything"
      />
    </header>
  );
}
