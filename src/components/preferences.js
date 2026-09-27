import { useSyncExternalStore } from 'react';

// Per-device display preferences. These are how *this browser* wants the game
// presented, not franchise state, so they live outside the save slot: a new
// franchise, a reset or a slot switch never changes your sim speed.

const KEY = 'gridiron_prefs_v1';
const DEFAULTS = { simSpeed: 'slow' };

/**
 * Game-day presentation per speed. `null` skips the scoreboard entirely and
 * goes straight to the result.
 *   intro: kickoff card, game: running clock, hold: finals left on screen (ms)
 *   broadcast: length of "Watch our game" after its kickoff card (ms)
 */
export const SIM_SPEEDS = {
  slow:    { intro: 1100, game: 8000, hold: 2000, broadcast: 28000 },
  fast:    { intro: 350,  game: 2200, hold: 900,  broadcast: 11000 },
  instant: null,
};

export const SIM_SPEED_OPTIONS = [
  { id: 'slow',    label: 'Slow',    blurb: 'Watch your game play out snap by snap (~30s), or a full league scoreboard.', seconds: '~30s' },
  { id: 'fast',    label: 'Fast',    blurb: 'Same broadcast and scoreboard, sped up. Good for grinding a season.',       seconds: '~12s' },
  { id: 'instant', label: 'Instant', blurb: 'Skip the scoreboard and jump straight to the final.',                        seconds: '0s' },
];

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    stored = {};
  }
  cache = { ...DEFAULTS, ...stored };
  if (!(cache.simSpeed in SIM_SPEEDS)) cache.simSpeed = DEFAULTS.simSpeed;
  return cache;
}

export function getPreference(key) {
  return read()[key];
}

export function setPreference(key, value) {
  cache = { ...read(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or full storage: the choice still holds for this session.
  }
  listeners.forEach(fn => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  const onStorage = e => {
    if (e.key !== KEY) return;
    cache = null;
    fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePreference(key) {
  return useSyncExternalStore(subscribe, () => read()[key], () => DEFAULTS[key]);
}
