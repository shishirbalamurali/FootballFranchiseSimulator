// Turns a game into the scoring plays the sim screen replays, so the board
// only ever moves in real football units (7, 3, 6, 8, 2) and always lands on
// the true result.
//
// Games simulated by the play-by-play engine carry `game.scoringLog`: every
// score in order with its quarter and clock, so the replay is exact. Older
// rows fall back to the sim's scoring breakdown (`game.scoring`) or to the
// most plausible TD/FG mix of the final, ordered by a seeded RNG so a given
// game's replay is identical every time it is shown.

import { seededRng } from '../engine/seededRandom.js';

export const PLAYS = {
  TD:   { pts: 7, short: 'TD',   call: 'Touchdown!' },
  TD6:  { pts: 6, short: 'TD',   call: 'Touchdown!' },
  TD8:  { pts: 8, short: 'TD+2', call: 'Touchdown + two!' },
  DTD:  { pts: 7, short: 'D-TD', call: 'Defensive TD!' },
  RTD:  { pts: 7, short: 'RET TD', call: 'Return touchdown!' },
  FG:   { pts: 3, short: 'FG',   call: 'Field goal!' },
  OTFG: { pts: 3, short: 'OT FG', call: 'Walk-off field goal!' },
  SAF:  { pts: 2, short: 'SAF',  call: 'Safety!' },
};

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Plausible scoring plays that sum exactly to `score`. NFL team-games run
 * about 60% touchdowns to 40% field goals; missed XPs, two-point tries and
 * safeties are rare, so each is weighted down rather than excluded.
 */
export function decomposeScore(score, rng = Math.random) {
  if (!(score > 0)) return [];
  const options = [];
  for (let n8 = 0; n8 <= 1; n8++) {
    for (let n6 = 0; n6 <= 1; n6++) {
      for (let n2 = 0; n2 <= 2; n2++) {
        const rest = score - 8 * n8 - 6 * n6 - 2 * n2;
        if (rest < 0) continue;
        for (let n7 = Math.floor(rest / 7); n7 >= 0; n7--) {
          const r = rest - 7 * n7;
          if (r % 3) continue;
          const n3 = r / 3;
          const tds = n7 + n6 + n8;
          const fgShare = n3 / Math.max(1, n3 + tds);
          const weight = Math.exp(-((fgShare - 0.4) ** 2) / 0.08)
            * (n6 ? 0.12 : 1) * (n8 ? 0.1 : 1) * (n2 ? 0.04 ** n2 : 1)
            * (n3 > 5 ? 0.15 : 1);
          options.push({ n7, n3, n6, n8, n2, weight });
        }
      }
    }
  }
  // Only a final of 1 has no legal decomposition, and the sim cannot produce it.
  if (!options.length) return [{ type: 'FG', pts: score }];

  let roll = rng() * options.reduce((s, o) => s + o.weight, 0);
  const pick = options.find(o => (roll -= o.weight) <= 0) ?? options[options.length - 1];
  const plays = [
    ...Array(pick.n7).fill('TD'), ...Array(pick.n3).fill('FG'),
    ...Array(pick.n6).fill('TD6'), ...Array(pick.n8).fill('TD8'), ...Array(pick.n2).fill('SAF'),
  ];
  return plays.map(type => ({ type, pts: PLAYS[type].pts }));
}

/** Exact plays from the sim's breakdown, when a game row carries one. */
function playsFromBreakdown(b) {
  if (!b) return null;
  const td = b.td | 0, xp = b.xp | 0, two = b.twoPt | 0;
  const plays = [];
  for (let i = 0; i < td; i++) {
    const type = i < two ? 'TD8' : i < two + xp ? 'TD' : 'TD6';
    plays.push({ type, pts: PLAYS[type].pts });
  }
  for (let i = 0; i < (b.fg | 0); i++) plays.push({ type: 'FG', pts: 3 });
  for (let i = 0; i < (b.defTd | 0); i++) plays.push({ type: 'DTD', pts: 7 });
  for (let i = 0; i < (b.safety | 0); i++) plays.push({ type: 'SAF', pts: 2 });
  return plays;
}

const total = plays => plays.reduce((s, p) => s + p.pts, 0);

function sidePlays(final, breakdown, rng) {
  const exact = playsFromBreakdown(breakdown);
  if (exact && total(exact) <= final) {
    const rest = final - total(exact);
    return { plays: exact, rest };
  }
  return { plays: decomposeScore(final, rng), rest: 0 };
}

// Regulation occupies [0, REG_END_OT] of the replay when a game went to
// overtime, leaving the tail of the bar for the extra period.
const REG_END_OT = 0.86;

/**
 * @param {object} game   schedule row: ids, optional `overtime`, optional `scoring`
 * @param {number} away   final away score
 * @param {number} home   final home score
 * @returns {{ plays: Array<{side, type, pts, t}>, regEnd: number, overtime: boolean }}
 *          `t` is the moment in the replay (0..1) that the play lands.
 */
export function buildScoringTimeline(game, away, home) {
  if (away == null || home == null) return { plays: [], regEnd: 1, overtime: false };
  const exact = timelineFromLog(game, away, home);
  if (exact) return exact;
  const rng = seededRng(`${game.id ?? ''}|${game.awayTeamId}|${game.homeTeamId}|${away}|${home}`);

  // The sim only goes to overtime from a tie and settles it with a field goal,
  // so the winner's last 3 points are the walk-off.
  const walkOff = !!game.overtime && away !== home;
  const otSide = walkOff ? (away > home ? 'away' : 'home') : null;

  const a = sidePlays(away - (otSide === 'away' ? 3 : 0), game.scoring?.away, rng);
  const h = sidePlays(home - (otSide === 'home' ? 3 : 0), game.scoring?.home, rng);
  // Points the breakdown did not account for are decomposed like any final.
  const extra = (side, rest) => decomposeScore(rest, rng).map(p => ({ ...p, side }));

  const regulation = shuffle([
    ...a.plays.map(p => ({ ...p, side: 'away' })), ...extra('away', a.rest),
    ...h.plays.map(p => ({ ...p, side: 'home' })), ...extra('home', h.rest),
  ], rng);

  const regEnd = walkOff ? REG_END_OT : 1;
  const n = regulation.length;
  // Evenly paced with jitter: scoring spread across all four quarters rather
  // than bunched, and nothing lands on the final whistle itself.
  const plays = regulation.map((p, k) => ({ ...p, t: regEnd * ((k + 0.2 + 0.6 * rng()) / n) * 0.97 }));
  if (walkOff) plays.push({ side: otSide, type: 'OTFG', pts: 3, t: REG_END_OT + (1 - REG_END_OT) * 0.7 });
  return { plays, regEnd, overtime: !!game.overtime };
}

// Exact replay from the engine's scoring log: [quarter, clock, side (0 home /
// 1 away), points, kind]. Regulation maps onto [0, regEnd], overtime onto the
// tail. Returns null when the log is missing or does not add up to the final.
function timelineFromLog(game, away, home) {
  const log = game?.scoringLog;
  if (!Array.isArray(log)) return null;
  let a = 0, h = 0;
  for (const e of log) { if (e[2] === 0) h += e[3]; else a += e[3]; }
  if (a !== away || h !== home) return null;
  const overtime = !!game.overtime;
  const regEnd = overtime ? REG_END_OT : 1;
  const plays = log.map(([q, clock, side, pts, kind]) => {
    let t;
    if (q <= 4) t = regEnd * (((q - 1) * 900 + (900 - clock)) / 3600);
    else t = REG_END_OT + (1 - REG_END_OT) * Math.min(0.97, (600 - clock) / 600);
    const td = pts >= 6;
    const type = kind === 'FG' ? (q >= 5 ? 'OTFG' : 'FG')
      : kind === 'SAF' ? 'SAF'
      : kind === 'DEF' ? 'DTD'
      : kind === 'KR' || kind === 'PR' ? 'RTD'
      : td ? (pts === 8 ? 'TD8' : pts === 6 ? 'TD6' : 'TD') : 'FG';
    return { side: side === 0 ? 'home' : 'away', type, pts, t: Math.min(0.995, t) };
  });
  return { plays, regEnd, overtime };
}

/** [away, home] on the board at replay progress p. */
export function scoreAt(timeline, p) {
  let a = 0, h = 0;
  for (const play of timeline.plays) {
    if (play.t > p) continue;
    if (play.side === 'away') a += play.pts; else h += play.pts;
  }
  return [a, h];
}

/** Plays that have landed by p, oldest first. */
export const playsBy = (timeline, p) => timeline.plays.filter(pl => pl.t <= p).sort((x, y) => x.t - y.t);

/** The play that landed within `window` of p, if any — drives the score flash. */
export function freshPlay(timeline, p, window) {
  let best = null;
  for (const play of timeline.plays) {
    if (play.t <= p && p - play.t < window && (!best || play.t > best.t)) best = play;
  }
  return best;
}

/** Period label + clock at progress p. */
export function periodAt(timeline, p) {
  if (p >= 1) return { label: timeline.overtime ? 'Final/OT' : 'Final', clock: null };
  if (p > timeline.regEnd) {
    const within = (p - timeline.regEnd) / (1 - timeline.regEnd);
    return { label: 'OT', clock: fmt(600 * (1 - within)) };
  }
  const reg = p / timeline.regEnd;
  const q = Math.min(3, Math.floor(reg * 4));
  const within = reg * 4 - q;
  return { label: `Q${q + 1}`, clock: fmt(900 * (1 - within)) };
}

function fmt(secs) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
