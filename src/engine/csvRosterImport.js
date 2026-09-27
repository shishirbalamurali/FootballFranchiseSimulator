/**
 * CSV Roster Import Engine
 * Converts Madden 26 CSV player data into the game's internal player format.
 */

import { TEAMS } from '../data/teams';
import { generatePlayer, ARCHETYPES, DEV_TRAITS, PERSONALITY_TRAITS } from './player';

// ── Team name → game team ID ──────────────────────────────────────────────────
const TEAM_NAME_TO_ID = {
  'Arizona Cardinals':      'cardinals',
  'Atlanta Falcons':        'falcons',
  'Baltimore Ravens':       'ravens',
  'Buffalo Bills':          'bills',
  'Carolina Panthers':      'panthers',
  'Chicago Bears':          'bears',
  'Cincinnati Bengals':     'bengals',
  'Cleveland Browns':       'browns',
  'Dallas Cowboys':         'cowboys',
  'Denver Broncos':         'broncos',
  'Detroit Lions':          'lions',
  'Green Bay Packers':      'packers',
  'Houston Texans':         'texans',
  'Indianapolis Colts':     'colts',
  'Jacksonville Jaguars':   'jaguars',
  'Kansas City Chiefs':     'chiefs',
  'Las Vegas Raiders':      'raiders',
  'Los Angeles Chargers':   'chargers',
  'Los Angeles Rams':       'rams',
  'Miami Dolphins':         'dolphins',
  'Minnesota Vikings':      'vikings',
  'New England Patriots':   'patriots',
  'New Orleans Saints':     'saints',
  'New York Giants':        'giants',
  'New York Jets':          'jets',
  'Philadelphia Eagles':    'eagles',
  'Pittsburgh Steelers':    'steelers',
  'San Francisco 49ers':    '49ers',
  'Seattle Seahawks':       'seahawks',
  'Tampa Bay Buccaneers':   'bucs',
  'Tennessee Titans':       'titans',
  'Washington Commanders':  'commanders',
};

// ── Madden position → game position ──────────────────────────────────────────
const POSITION_MAP = {
  'Quarterback':        'QB',
  'Halfback':           'RB',
  'Fullback':           'RB',
  'Wide Receiver':      'WR',
  'Tight End':          'TE',
  'Right Tackle':       'OL',
  'Left Tackle':        'OL',
  'Right Guard':        'OL',
  'Left Guard':         'OL',
  'Center':             'OL',
  'Defensive Tackle':   'DL',
  'Left End':           'DL',
  'Right End':          'DL',
  'Left Edge':          'DL',
  'Right Edge':         'DL',
  'Edge':               'DL',
  'Mike Linebacker':    'LB',
  'Weak Linebacker':    'LB',
  'Sam Linebacker':     'LB',
  'Middle Linebacker':  'LB',
  'Outside Linebacker': 'LB',
  'Linebacker':         'LB',
  'Cornerback':         'CB',
  'Free Safety':        'S',
  'Strong Safety':      'S',
  'Safety':             'S',
  'Kicker':             'K',
  'Punter':             'P',
  'Long Snapper':       'OL',
};

// Target roster composition per team (53-man roster)
const TARGET_COUNTS = {
  QB: 3, RB: 4, WR: 6, TE: 4, OL: 9,
  DL: 8, LB: 7, CB: 6, S: 4, K: 1, P: 1,
};

// Typical age range by position (min, avg, max)
const AGE_PROFILE = {
  QB:  [23, 28, 38],
  RB:  [21, 25, 31],
  WR:  [21, 26, 33],
  TE:  [22, 27, 33],
  OL:  [22, 28, 35],
  DL:  [21, 27, 34],
  LB:  [21, 26, 33],
  CB:  [21, 26, 32],
  S:   [22, 27, 34],
  K:   [24, 30, 40],
  P:   [24, 30, 40],
};

const POS_SALARY_MULT = {
  QB: 2.0, WR: 1.3, CB: 1.2, DL: 1.2, OL: 1.1,
  LB: 1.0, S: 0.9, TE: 1.0, RB: 0.85, K: 0.5, P: 0.4,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(val) {
  const v = parseInt(val, 10);
  return isNaN(v) ? 60 : Math.max(40, Math.min(99, v));
}

function clamp(v, lo = 40, hi = 99) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function avg(...vals) {
  const nums = vals.map(v => n(v)).filter(v => v > 0);
  if (!nums.length) return 60;
  return Math.round(nums.reduce((s, v) => s + v, 0) / nums.length);
}

function calcSalary(position, ovr) {
  const base = Math.max(0.5, (ovr - 62) * 0.27);
  const mult = POS_SALARY_MULT[position] || 1.0;
  return Math.round(base * mult * 10) / 10;
}

function getDevTrait(ovr) {
  if (ovr >= 92) return DEV_TRAITS.SUPERSTAR;
  if (ovr >= 84) return Math.random() < 0.5 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
  if (ovr >= 72) return Math.random() < 0.2 ? DEV_TRAITS.STAR : DEV_TRAITS.NORMAL;
  return Math.random() < 0.65 ? DEV_TRAITS.NORMAL : DEV_TRAITS.SLOW;
}

function getAge(position) {
  const [lo, mid, hi] = AGE_PROFILE[position] || [22, 27, 34];
  // Skew toward mid range
  const roll = Math.random();
  if (roll < 0.6) return clamp(mid + Math.floor(Math.random() * 5) - 2, lo, hi);
  if (roll < 0.85) return clamp(lo + Math.floor(Math.random() * (mid - lo)), lo, hi);
  return clamp(mid + 1 + Math.floor(Math.random() * (hi - mid)), mid + 1, hi);
}

function getArchetype(position) {
  const pool = ARCHETYPES[position];
  if (!pool) return 'Balanced';
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildUniversal(row) {
  return {
    speed:        n(row.SPEED),
    acceleration: n(row.ACCELERATION),
    agility:      n(row.AGILITY || row.CHANGEOFDIRECTION),
    strength:     n(row.STRENGTH),
    stamina:      n(row.STAMINA),
    awareness:    n(row.AWARENESS),
    discipline:   clamp(n(row.AWARENESS) + Math.floor(Math.random() * 10) - 5),
    durability:   n(row.INJURY), // Madden INJURY = injury resistance = durability
  };
}

function buildPositionAttrs(position, row) {
  switch (position) {
    case 'QB':
      return {
        accuracy:   avg(row.THROWACCURACYSHORT, row.THROWACCURACYMID, row.THROWACCURACYDEEP),
        aggression: avg(row.THROWONTHERUN, row.PLAYACTION),
        processing: avg(row.AWARENESS, row.PLAYRECOGNITION || row.AWARENESS),
        pocket:     n(row.THROWUNDERPRESSURE),
        arm:        n(row.THROWPOWER),
        clutch:     avg(row.THROWUNDERPRESSURE, row.THROWACCURACYSHORT),
      };
    case 'RB':
      return {
        eff:         n(row.BCVISION),
        vol:         n(row.BREAKTACKLE),
        exp:         avg(row.JUKEMOVE, row.SPINMOVE),
        gl:          n(row.TRUCKING),
        sec:         n(row.CARRYING),
        // legacy
        carrying:    n(row.CARRYING),
        vision:      n(row.BCVISION),
        breakTackle: n(row.BREAKTACKLE),
        elusiveness: avg(row.JUKEMOVE, row.SPINMOVE),
        catching:    n(row.CATCHING),
        passBlock:   n(row.PASSBLOCK || 50),
      };
    case 'WR':
      return {
        catching:       n(row.CATCHING),
        routeRun:       avg(row.SHORTROUTERUNNING, row.MEDIUMROUTERUNNING, row.DEEPROUTERUNNING),
        release:        n(row.RELEASE),
        catchInTraffic: n(row.CATCHINTRAFFIC),
        deepThreat:     n(row.DEEPROUTERUNNING),
      };
    case 'TE':
      return {
        catching:  n(row.CATCHING),
        routeRun:  avg(row.SHORTROUTERUNNING, row.MEDIUMROUTERUNNING),
        runBlock:  n(row.RUNBLOCK),
        passBlock: n(row.PASSBLOCK),
      };
    case 'OL':
      return {
        passBlock:   avg(row.PASSBLOCK, row.PASSBLOCKFINESSE, row.PASSBLOCKPOWER),
        runBlock:    avg(row.RUNBLOCK, row.RUNBLOCKFINESSE, row.RUNBLOCKPOWER),
        impactBlock: n(row.IMPACTBLOCKING),
        awarenessOL: n(row.AWARENESS),
      };
    case 'DL':
      return {
        blockShedding: n(row.BLOCKSHEDDING),
        powerMoves:    n(row.POWERMOVES),
        finesseMoves:  n(row.FINESSEMOVES),
        tackle:        n(row.TACKLE),
      };
    case 'LB':
      return {
        tackle:   n(row.TACKLE),
        pursuit:  n(row.PURSUIT),
        coverage: avg(row.MANCOVERAGE, row.ZONECOVERAGE),
        blitz:    n(row.BLOCKSHEDDING),
      };
    case 'CB':
      return {
        manCoverage:  n(row.MANCOVERAGE),
        zoneCoverage: n(row.ZONECOVERAGE),
        press:        n(row.PRESS),
        ballSkills:   avg(row.CATCHINTRAFFIC, row.CATCHING),
      };
    case 'S':
      return {
        coverage:   avg(row.MANCOVERAGE, row.ZONECOVERAGE),
        tackle:     n(row.TACKLE),
        ballSkills: avg(row.CATCHINTRAFFIC, row.CATCHING),
        range:      n(row.PURSUIT),
      };
    case 'K':
    case 'P':
      return {
        kickPower:    n(row.KICKPOWER),
        kickAccuracy: n(row.KICKACCURACY),
      };
    default:
      return {};
  }
}

function csvRowToPlayer(row, teamId) {
  const maddenPos = (row.Position || '').trim();
  const position = POSITION_MAP[maddenPos] || 'OL';

  // Use "Overall" (column 5) as the OVR
  const ovrRaw = parseInt(row.Overall || row.OVERALL, 10);
  const ovr = isNaN(ovrRaw) ? 65 : clamp(ovrRaw, 40, 99);

  const age = getAge(position);
  const archetype = getArchetype(position);
  const devTrait = getDevTrait(ovr);
  const personality = PERSONALITY_TRAITS[Math.floor(Math.random() * PERSONALITY_TRAITS.length)];
  const salary = calcSalary(position, ovr);
  const contractYears = Math.floor(1 + Math.random() * 4);

  const firstName = (row['First Name'] || '').trim();
  const lastName = (row['Last Name'] || '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Player';

  const universal = buildUniversal(row);
  const positionAttrs = buildPositionAttrs(position, row);

  const pot = clamp(ovr + (age < 26 ? Math.floor(Math.random() * 9) : Math.floor(Math.random() * 4)));

  return {
    id: `csv-${teamId}-${name.replace(/\s+/g, '_').toLowerCase()}-${Math.random().toString(36).substr(2, 8)}`,
    name,
    position,
    age,
    experience: Math.max(0, age - 22),
    handedness: Math.random() < 0.85 ? 'Right' : 'Left',
    ovr,
    pot,
    devTrait,
    personality,
    archetype,
    attributes: {
      universal,
      position: positionAttrs,
    },
    contract: { salary, years: contractYears, yearsLeft: contractYears },
    ovrHistory: [ovr],
    injuryRisk: universal.durability,
    injured: false,
    morale: 75,
    stats: { career: {}, season: {} },
  };
}

// ── CSV parser (handles quoted values) ───────────────────────────────────────

export function parseCSVText(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map(line => {
    const values = [];
    let inQuotes = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());

    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return row;
  }).filter(row => (row['First Name'] || row['Last Name']) && row.Position && row.Team);
}

// ── Preview stats (for the import confirmation UI) ────────────────────────────

export function getCSVPreviewStats(csvText) {
  const rows = parseCSVText(csvText);
  const teamCounts = {};
  const topPlayers = [];

  rows.forEach(row => {
    const teamId = TEAM_NAME_TO_ID[(row.Team || '').trim()];
    if (!teamId) return;
    teamCounts[teamId] = (teamCounts[teamId] || 0) + 1;

    const ovrRaw = parseInt(row.Overall || row.OVERALL, 10);
    if (!isNaN(ovrRaw)) {
      topPlayers.push({
        name:     `${(row['First Name'] || '').trim()} ${(row['Last Name'] || '').trim()}`.trim(),
        position: POSITION_MAP[(row.Position || '').trim()] || row.Position?.trim(),
        maddenPos: (row.Position || '').trim(),
        ovr:      ovrRaw,
        teamId,
      });
    }
  });

  topPlayers.sort((a, b) => b.ovr - a.ovr);

  return {
    totalPlayers: rows.length,
    teamsFound:   Object.keys(teamCounts).length,
    topPlayers:   topPlayers.slice(0, 12),
  };
}

// ── Main export: build full 32-team rosters from CSV text ─────────────────────

export function buildRostersFromCSV(csvText) {
  const rows = parseCSVText(csvText);

  // Initialize all 32 teams
  const rosters = {};
  TEAMS.forEach(t => { rosters[t.id] = []; });

  // Assign CSV players to teams
  rows.forEach(row => {
    const teamId = TEAM_NAME_TO_ID[(row.Team || '').trim()];
    if (!teamId || !rosters[teamId]) return;
    rosters[teamId].push(csvRowToPlayer(row, teamId));
  });

  // Fill any roster gaps with generated players
  TEAMS.forEach(team => {
    const roster = rosters[team.id];
    Object.entries(TARGET_COUNTS).forEach(([pos, target]) => {
      const existing = roster.filter(p => p.position === pos);
      const need = target - existing.length;
      for (let i = 0; i < need; i++) {
        // Filler: lower OVR so starters from CSV are clearly better
        const fillerOvr = existing.length === 0
          ? clamp(Math.random() * 15 + 68, 65, 82)  // at least a starter if none
          : clamp(Math.random() * 12 + 60, 58, 72); // backups
        roster.push(generatePlayer(pos, Math.round(fillerOvr)));
      }
    });

    // Sort starters to front
    rosters[team.id] = roster.sort((a, b) => b.ovr - a.ovr);
  });

  return rosters;
}
