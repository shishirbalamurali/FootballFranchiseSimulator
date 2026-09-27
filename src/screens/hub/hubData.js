// Pure data helpers for the Hub. Extracted so the widgets stay presentational
// and the same logic can be reused by the game-summary modal.

import { TEAMS } from '../../data/teams';

// ── Weekly objectives ───────────────────────────────────────────────────────
const OBJ_POOL = [
  { id: 'win',    text: 'Win the game',           icon: '🏆', cond: (g, uid) => g.winnerId === uid },
  { id: 'sc25',   text: 'Score 25+ points',       icon: '🎯', cond: (g, uid) => (g.homeTeamId === uid ? g.homeScore : g.awayScore) >= 25 },
  { id: 'sc30',   text: 'Score 30+ points',       icon: '🔥', cond: (g, uid) => (g.homeTeamId === uid ? g.homeScore : g.awayScore) >= 30 },
  { id: 'hold20', text: 'Hold opponent under 20', icon: '🛡', cond: (g, uid) => (g.homeTeamId === uid ? g.awayScore : g.homeScore) < 20 },
  { id: 'hold17', text: 'Hold opponent under 17', icon: '🔒', cond: (g, uid) => (g.homeTeamId === uid ? g.awayScore : g.homeScore) < 17 },
  { id: 'blow10', text: 'Win by 10+ points',      icon: '💪', cond: (g, uid) => { const d = g.homeTeamId === uid ? g.homeScore - g.awayScore : g.awayScore - g.homeScore; return d >= 10; } },
  { id: 'close7', text: "Don't lose by more than 7", icon: '💛', cond: (g, uid) => { const d = g.homeTeamId === uid ? g.homeScore - g.awayScore : g.awayScore - g.homeScore; return d >= -7; } },
];

export function getWeekObjectives(week) {
  const pool = OBJ_POOL.slice(1);
  const i1 = week % pool.length;
  const i2 = (week * 3 + 2) % pool.length;
  const second = pool[i1];
  const third = pool[i2 === i1 ? (i2 + 1) % pool.length : i2];
  return [OBJ_POOL[0], second, third];
}

export function getTopPerformers(game, userTeamId, rosters) {
  if (!game?.playerStats) return {};
  const userIsHome = game.homeTeamId === userTeamId;
  const stats = userIsHome ? game.playerStats.home : game.playerStats.away;
  if (!stats) return {};
  const roster = rosters[userTeamId] || [];

  let topQB = null, topRB = null, topWR = null;
  let maxPass = 0, maxRush = 0, maxRec = 0;

  Object.entries(stats).forEach(([pid, s]) => {
    const p = roster.find(pl => pl.id === pid);
    if (!p) return;
    if (p.position === 'QB' && (s.yards || 0) > maxPass) { maxPass = s.yards || 0; topQB = { ...p, gs: s }; }
    if (['RB', 'FB'].includes(p.position) && (s.rushYards || s.yards || 0) > maxRush) { maxRush = s.rushYards || s.yards || 0; topRB = { ...p, gs: s }; }
    if (['WR', 'TE'].includes(p.position) && (s.recYards || 0) > maxRec) { maxRec = s.recYards || 0; topWR = { ...p, gs: s }; }
  });
  return { topQB, topRB, topWR };
}

// ── Roster grades ───────────────────────────────────────────────────────────
// Unit grades are curved against a league-average baseline rather than an
// absolute OVR cut. The old fixed ladder handed out A+ to every position group
// on a freshly generated roster, which made the whole widget meaningless.
const UNIT_GROUPS = [
  { label: 'QB',      positions: ['QB'],                   count: 1 },
  { label: 'Backs',   positions: ['RB', 'FB'],             count: 2 },
  { label: 'Pass catchers', positions: ['WR', 'TE'],       count: 4 },
  { label: 'O-Line',  positions: ['OL', 'T', 'G', 'C'],    count: 5 },
  { label: 'D-Line',  positions: ['DL', 'DE', 'DT'],       count: 4 },
  { label: 'Linebackers', positions: ['LB', 'MLB', 'OLB'], count: 3 },
  { label: 'Secondary', positions: ['CB', 'S', 'FS', 'SS'], count: 4 },
];

const GRADE_LADDER = [
  { min:  9, letter: 'A+' }, { min:  6, letter: 'A'  }, { min:  4, letter: 'A-' },
  { min:  2.5, letter: 'B+' }, { min:  1, letter: 'B'  }, { min: -1, letter: 'B-' },
  { min: -2.5, letter: 'C+' }, { min: -4, letter: 'C'  }, { min: -6, letter: 'C-' },
  { min: -9, letter: 'D'  }, { min: -Infinity, letter: 'F' },
];

function gradeColor(letter) {
  if (letter.startsWith('A')) return 'var(--positive-fg)';
  if (letter.startsWith('B')) return 'var(--info-fg)';
  if (letter.startsWith('C')) return 'var(--warning-fg)';
  return 'var(--negative-fg)';
}

function unitAverage(roster, positions, count) {
  const ps = roster.filter(p => positions.includes(p.position)).sort((a, b) => b.ovr - a.ovr).slice(0, count);
  if (!ps.length) return null;
  return ps.reduce((s, p) => s + p.ovr, 0) / ps.length;
}

/**
 * @param {object} rosters   all rosters, keyed by team id
 * @param {string} teamId    the user's team
 * @returns {{units: Array, overall: object}}
 */
export function getRosterGrades(rosters, teamId) {
  const roster = rosters?.[teamId] || [];
  const allTeamIds = Object.keys(rosters || {});

  const units = UNIT_GROUPS.map(g => {
    const mine = unitAverage(roster, g.positions, g.count);
    if (mine == null) return null;

    // League baseline for this unit, so a grade means "relative to the league".
    const leagueVals = allTeamIds
      .map(id => unitAverage(rosters[id] || [], g.positions, g.count))
      .filter(v => v != null);
    const baseline = leagueVals.length
      ? leagueVals.reduce((a, b) => a + b, 0) / leagueVals.length
      : mine;

    const delta = mine - baseline;
    const letter = GRADE_LADDER.find(t => delta >= t.min).letter;
    return {
      label: g.label,
      ovr: Math.round(mine),
      delta: Math.round(delta * 10) / 10,
      letter,
      color: gradeColor(letter),
      // 0–100 bar position: centred on the league average.
      pct: Math.max(4, Math.min(100, 50 + delta * 4.5)),
    };
  }).filter(Boolean);

  const avgDelta = units.length ? units.reduce((s, u) => s + u.delta, 0) / units.length : 0;
  const overallLetter = GRADE_LADDER.find(t => avgDelta >= t.min).letter;

  return {
    units,
    overall: { letter: overallLetter, color: gradeColor(overallLetter), delta: Math.round(avgDelta * 10) / 10 },
  };
}

// ── Salary cap ──────────────────────────────────────────────────────────────
export const CAP_TOTAL = 200;

export function getCapSummary(rosters, teamId) {
  const roster = rosters?.[teamId] || [];
  const used = Math.round(roster.reduce((sum, p) => sum + (p.contract?.salary || p.salary || 2), 0));
  const space = CAP_TOTAL - used;
  return {
    used,
    space,
    total: CAP_TOTAL,
    pct: Math.min(100, Math.round((used / CAP_TOTAL) * 100)),
    overCap: space < 0,
  };
}

// ── Playoff picture ─────────────────────────────────────────────────────────
export function getConferenceRace(standings, teamData, userTeamId) {
  if (!teamData) return null;
  const teams = TEAMS
    .filter(t => t.conference === teamData.conference)
    .map(t => ({ ...t, s: standings?.[t.id] || { wins: 0, losses: 0, pf: 0, pa: 0 } }))
    .sort((a, b) => b.s.wins - a.s.wins || (b.s.pf - b.s.pa) - (a.s.pf - a.s.pa));
  const rank = teams.findIndex(t => t.id === userTeamId) + 1;
  return { teams, rank, inPlayoffs: rank > 0 && rank <= 7, top7: teams.slice(0, 7) };
}

// ── Division ────────────────────────────────────────────────────────────────
export function getDivisionTable(standings, teamData, userTeamId) {
  if (!teamData) return { teams: [], rank: 0 };
  const teams = TEAMS
    .filter(t => t.conference === teamData.conference && t.division === teamData.division)
    .map(t => ({ ...t, record: standings?.[t.id] || { wins: 0, losses: 0, pf: 0, pa: 0 } }))
    .sort((a, b) => b.record.wins - a.record.wins || (b.record.pf - b.record.pa) - (a.record.pf - a.record.pa));
  return { teams, rank: teams.findIndex(t => t.id === userTeamId) + 1 };
}

// ── Team leaders ────────────────────────────────────────────────────────────
export function getTeamLeaders(rosters, teamId) {
  const roster = rosters?.[teamId] || [];
  const by = (fn) => [...roster].sort((a, b) => fn(b) - fn(a))[0];
  const qb = by(p => (p.position === 'QB' ? (p.stats?.season?.yards || 0) : -1));
  const rb = by(p => (['RB', 'FB'].includes(p.position) ? (p.stats?.season?.rushYards || p.stats?.season?.yards || 0) : -1));
  const wr = by(p => (['WR', 'TE'].includes(p.position) ? (p.stats?.season?.recYards || 0) : -1));
  const def = by(p => (['LB', 'CB', 'DL', 'S'].includes(p.position)
    ? (p.stats?.season?.tackles || 0) + (p.stats?.season?.sacks || 0) * 3 : -1));

  return [
    qb  && { p: qb,  stat: `${qb.stats?.season?.yards || 0} pass yds · ${qb.stats?.season?.tds || 0} TD` },
    rb  && { p: rb,  stat: `${rb.stats?.season?.rushYards || 0} rush yds` },
    wr  && { p: wr,  stat: `${wr.stats?.season?.recYards || 0} rec yds` },
    def && { p: def, stat: `${def.stats?.season?.tackles || 0} tkl · ${def.stats?.season?.sacks || 0} sk` },
  ].filter(Boolean);
}
