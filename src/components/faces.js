// Deterministic player faces. facesjs draws with Math.random, so generation
// runs with a seeded generator swapped in: the same player id always produces
// the same face, and nothing about the face is ever stored in the save.

import { generate } from 'facesjs';
import { seededRng } from '../engine/seededRandom.js';

// Roughly the league's make-up; only the face drawing uses it.
const RACES = [['black', 0.56], ['white', 0.33], ['brown', 0.07], ['asian', 0.04]];
const JERSEYS = ['football', 'football2', 'football3', 'football4', 'football5'];
const NO_HATS = new Set(['hat', 'hat2', 'hat3', 'santa-hat']);

const cache = new Map();

function pickRace(rng) {
  let r = rng();
  for (const [race, share] of RACES) if ((r -= share) <= 0) return race;
  return 'black';
}

/** The base face for a player id — generated once, then cached. */
export function faceFor(playerId) {
  const hit = cache.get(playerId);
  if (hit) return hit;

  const rng = seededRng(`${playerId}|face`);
  const race = pickRace(rng);
  const realRandom = Math.random;
  let face;
  try {
    Math.random = rng;
    face = generate(undefined, { gender: 'male', race });
  } finally {
    Math.random = realRandom;
  }
  // Portraits, not a costume party: no caps or Santa hats, and no facemask
  // "glasses". Eye black and headbands stay — they read as football.
  if (NO_HATS.has(face.accessories?.id)) face.accessories = { id: rng() < 0.35 ? 'eye-black' : 'none' };
  if (face.glasses?.id === 'facemask' || rng() < 0.7) face.glasses = { id: 'none' };

  if (cache.size > 4000) cache.clear();
  cache.set(playerId, face);
  return face;
}

function mix(hex, target, t) {
  const n = h => parseInt(h, 16);
  const a = String(hex).replace('#', ''), b = target.replace('#', '');
  if (a.length !== 6) return hex;
  const c = [0, 2, 4].map(i => Math.round(n(a.slice(i, i + 2)) * (1 - t) + n(b.slice(i, i + 2)) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Per-render changes layered on the base face: the current team's jersey and
 * colours (so a traded player changes uniform), and grey creeping into a
 * veteran's hair and beard.
 */
export function faceOverrides(face, { age, team, teamId }) {
  const theme = team?.theme;
  const out = {
    jersey: { id: JERSEYS[(teamId ? [...teamId].reduce((s, c) => s + c.charCodeAt(0), 0) : 0) % JERSEYS.length] },
  };
  if (theme) out.teamColors = [theme.primary, theme.secondary, theme.accent];
  else out.teamColors = ['#6b7280', '#374151', '#d1d5db'];
  const grey = Math.min(0.75, Math.max(0, ((age ?? 25) - 31) / 9));
  if (grey > 0 && face?.hair?.color) out.hair = { color: mix(face.hair.color, '#bdbdbd', grey) };
  return out;
}
