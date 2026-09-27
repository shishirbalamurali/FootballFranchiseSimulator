import { Assistants, FranchiseJournal } from './screens/FranchiseOffice';
import CommandCenter from './screens/frontOffice/CommandCenter';
import BigBoard from './screens/frontOffice/BigBoard';
import Contracts from './screens/frontOffice/Contracts';
import Saturdays from './screens/frontOffice/Saturdays';
import XFactors from './screens/frontOffice/XFactors';
import TradeMachine from './screens/frontOffice/TradeMachine';
import Staff from './screens/frontOffice/Staff';
import PlayerCardHost from './components/player/PlayerCardHost';
import { useNav } from './components/player/cardStore';
import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import ThemeProvider from './components/ThemeProvider';
import ModeSelectScreen from './components/ModeSelectScreen';
import TeamSelect from './screens/TeamSelect';
import HomeHub from './screens/HomeHub';
import Standings from './screens/Standings';
import Roster from './screens/Roster';
import Draft from './screens/Draft';
import Schedule from './screens/Schedule';
import Stats from './screens/Stats';
import Playoffs from './screens/Playoffs';
import Awards from './screens/Awards';
import Playbook from './screens/Playbook';
import FreeAgency from './screens/FreeAgency';
import Development from './screens/Development';
import ErrorBoundary from './components/ErrorBoundary';
import { useGameStore } from './store/gameStore';
import {
  getAllSlotMeta,
  setActiveSlot,
  deleteSlot,
} from './store/gameStore';
import { TEAMS } from './data/teams';
import { Button, ConfirmModal, TeamCrest } from './components/ui';
import AppNav from './components/AppNav';
import { OwnerWatcher, OwnerReviewModal } from './components/OwnerOffice';
import { LegacyWatcher } from './components/Legacy';
import { IMMERSIVE_SCREENS } from './navigation';

// ── Save Slot Picker ──────────────────────────────────────────────────────────
// The game's first impression: a cartoon title card over a sun-ray burst,
// with each save drawn as a sticker in its franchise's colours.
function SlotPicker({ onSlotSelected }) {
  const [slots, setSlots] = useState(() => getAllSlotMeta());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handlePick = (slot) => {
    setActiveSlot(slot);
    window.location.reload();   // rehydrate the store from the chosen slot
  };
  const handleNew = (slot) => {
    setActiveSlot(slot);
    onSlotSelected(slot);
  };
  const handleDelete = (slot) => {
    deleteSlot(slot);
    setConfirmDelete(null);
    setSlots(getAllSlotMeta());
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Sun-ray burst behind the title card */}
      <div
        aria-hidden="true"
        className="toon-rays pointer-events-none absolute left-1/2 top-[22%] size-[160vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_120s_linear_infinite] text-team"
      />

      <div className="relative mb-12 text-center animate-bounce-in">
        <p className="toon-sticker mb-4 text-h3 uppercase">Est. 1962 · 32 franchises</p>
        <h1 className="toon-title font-display text-[clamp(72px,12vw,150px)] uppercase leading-[0.9] text-team-accent">
          Gridiron
        </h1>
        <p className="mt-4 inline-block -rotate-1 rounded-full bg-ink px-5 py-1.5 font-display text-h2 uppercase tracking-[0.2em] text-nav-fg">
          Franchise Simulator
        </p>
      </div>

      <div className="relative grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {slots.map((s, i) => {
          const team = TEAMS.find(t => t.id === s.teamId);
          if (s.empty) {
            return (
              <button
                key={s.slot}
                onClick={() => handleNew(s.slot)}
                className="toon-lift group flex h-64 flex-col items-center justify-center gap-3 rounded-panel border-[3px] border-dashed border-ink animate-fade-up hover:bg-surface-raised"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="grid size-14 place-items-center rounded-full bg-team-accent font-display text-h1 text-team-on-accent shadow-1 transition-transform duration-base ease-bounce group-hover:rotate-90">
                  +
                </span>
                <span className="font-display text-h2 uppercase text-fg">New franchise</span>
                <span className="text-micro uppercase text-fg-faint">Slot {s.slot + 1}</span>
              </button>
            );
          }
          return (
            <div
              key={s.slot}
              className="toon-lift relative flex h-64 flex-col overflow-hidden rounded-panel bg-surface-raised shadow-2 animate-fade-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {/* Team-colour header stock */}
              <div
                className="relative flex h-20 shrink-0 items-end border-b-[3px] border-ink px-4 pb-2"
                style={{ backgroundColor: team?.theme?.primary }}
              >
                <div aria-hidden="true" className="toon-halftone absolute inset-0 text-ink opacity-50" />
                <p className="relative rounded-full bg-ink px-2 py-0.5 text-micro uppercase text-nav-fg">Slot {s.slot + 1}</p>
                <div className="absolute -bottom-7 right-4 rotate-6">
                  <TeamCrest team={team} size="lg" ring />
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.slot); }}
                aria-label={`Delete save in slot ${s.slot + 1}`}
                className="absolute left-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-surface-raised text-label text-fg-muted shadow-1 transition-colors hover:bg-negative-solid hover:text-n-0"
              >
                ✕
              </button>

              <div className="relative flex flex-1 flex-col px-4 pb-4 pt-3">
                <p className="truncate text-micro uppercase text-fg-muted">{team?.location}</p>
                <p className="truncate pr-16 font-display text-h1 uppercase leading-none text-fg">
                  {team?.name ?? 'Unknown'}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-fg-muted">
                  <span className="rounded-chip bg-surface-sunken px-1.5 font-bold tabular-nums text-fg">{s.record}</span>
                  <span>Season {s.season}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{s.phase === 'regular' ? `Week ${s.week}` : s.phase}</span>
                </div>
                {s.coachName && (
                  <p className="mt-1 truncate text-label text-fg-faint">Coach {s.coachName}</p>
                )}

                <Button variant="primary" fullWidth className="mt-auto" onClick={() => handlePick(s.slot)}>
                  Continue
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        destructive
        title="Delete this save?"
        body={`Slot ${(confirmDelete ?? 0) + 1} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete save"
      />
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const initialized = useGameStore(state => state.initialized);
  useEffect(() => { if (initialized) useGameStore.getState().ensureFranchiseSystems(); }, [initialized]);
  const userTeamId = useGameStore(state => state.userTeamId);
  const userTeam = TEAMS.find(team => team.id === userTeamId);
  const phase = useGameStore(state => state.phase);
  const week = useGameStore(state => state.week);
  const standings = useGameStore(state => state.standings);
  const [currentScreen, setCurrentScreen] = useState('home');
  // Dev-only: jump to any screen from the console, e.g. __go('roster').
  useEffect(() => {
    if (import.meta.env.DEV) { window.__go = setCurrentScreen; window.__store = useGameStore; }
    useNav.getState().register(setCurrentScreen);
  }, []);

  const userStanding = standings?.[userTeamId];
  const record = userStanding ? `${userStanding.wins}-${userStanding.losses}` : null;

  // The nav's primary action. `sim` is the one case the Hub owns (it runs the
  // week simulation with its loading sequence), so we route there and let the
  // Hub pick it up via a pending-intent flag.
  const [pendingIntent, setPendingIntent] = useState(null);
  const handlePrimaryAction = (action) => {
    if (action.intent === 'startFA') useGameStore.getState().startFreeAgency();
    if (action.intent === 'sim') setPendingIntent('sim');
    setCurrentScreen(action.screen);
  };
  const [slotReady, setSlotReady] = useState(() => {
    // If a slot was already chosen before (activeSlot in localStorage), skip picker
    const saved = localStorage.getItem('gridiron_active_slot');
    return saved !== null;
  });
  // showModeSelect is true only when the user just created a brand-new save slot
  const [showModeSelect, setShowModeSelect] = useState(false);

  // Screen content lives in its own scroll container, which used to keep its
  // offset across navigation — switching from a scrolled Hub to a shorter
  // screen landed the player on blank space. Reset it on every screen change.
  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentScreen]);

  // If no slot has ever been chosen, show slot picker
  if (!slotReady) {
    return (
      <ErrorBoundary>
        <SlotPicker onSlotSelected={() => {
          setSlotReady(true);
          setShowModeSelect(true);
          // Force store to re-initialize from the new (empty) slot
          useGameStore.setState({ initialized: false, userTeamId: null, rosterMode: 'generated' });
        }} />
      </ErrorBoundary>
    );
  }

  // New save: choose roster mode before TeamSelect
  if (showModeSelect && !initialized) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <ModeSelectScreen
            onModeSelected={(mode, csvRosters) => {
              if (mode === 'csv' && csvRosters) {
                useGameStore.getState().generateLeagueFromCSV(csvRosters);
              }
              setShowModeSelect(false);
            }}
          />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  if (!initialized) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <TeamSelect onTeamSelected={() => setCurrentScreen('home')} />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  const isImmersive = IMMERSIVE_SCREENS.has(currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':        return <HomeHub onNavigate={setCurrentScreen} pendingIntent={pendingIntent} onIntentHandled={() => setPendingIntent(null)} />;
      case 'assistants': return <Assistants />;
      case 'staff': return <Staff />;
      case 'college': return <Saturdays />;
      case 'command': return <CommandCenter onNavigate={setCurrentScreen} />;
      case 'bigBoard': return <BigBoard onNavigate={setCurrentScreen} />;
      case 'contracts': return <Contracts onNavigate={setCurrentScreen} />;
      case 'xfactors': return <XFactors />;
      case 'journal': return <FranchiseJournal />;
      case 'standings':   return <Standings />;
      case 'roster':      return <Roster />;
      case 'development': return <Development />;
      case 'schedule':   return <Schedule />;
      case 'stats':      return <Stats />;
      case 'awards':     return <Awards onBack={() => setCurrentScreen('home')} />;
      case 'playbook':   return <Playbook />;
      case 'trade':      return <TradeMachine />;
      case 'draft':
        return <Draft onNavigate={setCurrentScreen} />;
      case 'playoffs':
        return (
          <Playoffs
            onBack={() => setCurrentScreen('home')}
            onStartOffseason={() => setCurrentScreen('command')}
          />
        );
      case 'freeAgency':
        return <FreeAgency onNavigate={setCurrentScreen} />;
      default:
        return <HomeHub onNavigate={setCurrentScreen} pendingIntent={pendingIntent} onIntentHandled={() => setPendingIntent(null)} />;
    }
  };

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="flex h-screen w-screen flex-col overflow-hidden font-sans text-fg">

          {/* ── Persistent shell ──
              Immersive screens (draft night, playoffs) take over the window
              and carry their own back affordance. */}
          {!isImmersive && (
            <AppNav
              screen={currentScreen}
              onNavigate={setCurrentScreen}
              team={userTeam}
              phase={phase}
              week={week}
              record={record}
              onPrimaryAction={handlePrimaryAction}
              onOpenSaveSlots={() => {
                localStorage.removeItem('gridiron_active_slot');
                window.location.reload();
              }}
              onResetFranchise={() => useGameStore.getState().resetGame()}
            />
          )}

          {/* ── Screen content ──
              No AnimatePresence here on purpose. Screen content used to be
              wrapped in a motion.div starting at `opacity: 0`, so the page was
              invisible until an rAF-driven animation completed — any throttling
              (background tab, low-power mode) left the app showing a blank
              screen. Content is now visible by default and the entrance is a
              pure-CSS animation that cannot gate visibility. */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div key={currentScreen} className="min-h-full w-full animate-fade-up">
              {renderScreen()}
            </div>
          </div>

          <OwnerWatcher />
          <LegacyWatcher />
          <OwnerReviewModal />
          <PlayerCardHost />

        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
