import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';
import { KIND, FLAG } from '../engine/gameEngine';
import {
  readPbp, describePlay, drivesOf, statsThrough, leadersFor, passLine, rushLine, recLine, defLine,
  downText, clockText, periodLabel, spotText, elapsedAt, classifyGame, playerOfGame, creditSide,
} from '../engine/gameStory';
import { TeamCrest, Button, cx, alpha, onColor } from './ui';
import PlayerFace from './PlayerFace';
import { abilityFor } from '../engine/xFactor'; // CLAUDE: X-Factor zone

// "Watch our game": the user's game as a live broadcast, built from the
// engine's real play-by-play. Every snap moves the ball on the field; the big
// ones (scores, turnovers, sacks, chunk plays, fourth-down calls) are called
// out and kept in the feed with the players who made them on both sides of the
// ball. Screen rules: fits the viewport and never scrolls; always skippable.

const TEAM = new Map(TEAMS.map(t => [t.id, t]));
const INTRO_MS = 2200;
const color = team => team?.theme?.primary ?? 'var(--ink)';
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = t => 1 - Math.pow(1 - t, 3);

// Dwell per snap, relative to a routine play. Scores and turnovers linger so
// they can be read; kicks and tries go by quickly.
function dwell(p, d) {
  if (d.tone === 'score') return 9;
  if (d.tone === 'turnover') return 7.5;
  if (d.tag) return 4.2;
  if (p.kind === KIND.XP || p.kind === KIND.KICKOFF || p.kind === KIND.KNEEL) return 0.6;
  return 1;
}

// Field x (0-120 yards, end zones included). Home always drives left → right.
const fieldX = (off, yl) => (off === 0 ? 10 + yl : 110 - yl);
const pct = x => `${(x / 120) * 100}%`;

/** Where the ball ends up after a play, in field yards. */
function endX(p, next) {
  const clampYl = v => Math.max(-1, Math.min(101, v));
  switch (p.kind) {
    case KIND.RUN: case KIND.PASS: case KIND.SCRAMBLE: case KIND.SACK: case KIND.KNEEL:
      if (p.flags & FLAG.TD) return fieldX(p.off, 104);
      if (!(p.flags & FLAG.FUMBLE)) return fieldX(p.off, clampYl(p.yl + p.yards));
      break;
    case KIND.INC: case KIND.SPIKE: return fieldX(p.off, p.yl);
    case KIND.FG: case KIND.FG_MISS: return fieldX(p.off, 110);
    case KIND.XP: case KIND.TWO: case KIND.TWO_FAIL: case KIND.XP_MISS: return fieldX(p.off, 104);
    default:
  }
  if (next && next.kind !== KIND.XP && next.kind !== KIND.TWO && next.kind !== KIND.TWO_FAIL && next.kind !== KIND.XP_MISS) {
    return startX(next);
  }
  return fieldX(p.off, p.yl);
}
function startX(p) {
  if (p.kind === KIND.KICKOFF) return fieldX(p.off, 65);
  if (p.kind === KIND.ONSIDE) return fieldX(p.off, 65);
  if (p.kind === KIND.XP || p.kind === KIND.XP_MISS) return fieldX(p.off, 85);
  if (p.kind === KIND.TWO || p.kind === KIND.TWO_FAIL) return fieldX(p.off, 98);
  return fieldX(p.off, p.yl);
}

// ── pieces ────────────────────────────────────────────────────────────────────

function Field({ plays, idx, f, teams, abbr, drive }) {
  const p = plays[idx];
  const next = plays[idx + 1];
  const from = startX(p);
  const to = endX(p, next);
  const travel = ease(clamp01(f / 0.55));
  const ballX = from + (to - from) * travel;
  const scrimmage = p.down >= 1 && p.down <= 4;
  const los = scrimmage ? fieldX(p.off, p.yl) : null;
  const first = scrimmage && p.yl + p.togo < 100 ? fieldX(p.off, p.yl + p.togo) : null;
  const trailFrom = drive ? fieldX(drive.off, drive.start) : null;
  const offColor = color(teams[p.off]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-panel shadow-2" style={{ background: 'var(--turf)' }}>
      {/* End zones: home defends the left */}
      {[0, 1].map(side => (
        <div
          key={side}
          className="absolute inset-y-0 flex items-center justify-center"
          style={{ left: side === 0 ? 0 : pct(110), width: pct(10), background: color(teams[side]) }}
        >
          <span
            className="font-display text-h2 uppercase tracking-widest"
            style={{ color: onColor(color(teams[side])), writingMode: 'vertical-rl', transform: side === 0 ? 'rotate(180deg)' : 'none' }}
          >
            {abbr[side]}
          </span>
        </div>
      ))}
      {/* Mown stripes and 10-yard lines */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0"
        style={{
          left: pct(10), width: pct(100),
          backgroundImage: 'repeating-linear-gradient(90deg, var(--turf) 0 10%, var(--turf-stripe) 10% 20%), repeating-linear-gradient(90deg, var(--turf-line) 0 2px, transparent 2px 10%)',
          backgroundBlendMode: 'normal',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0"
        style={{ left: pct(10), width: pct(100), backgroundImage: 'repeating-linear-gradient(90deg, var(--turf-line) 0 2px, transparent 2px 10%)' }}
      />
      {/* Yard numbers */}
      {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => (
        <span key={i} aria-hidden="true" className="absolute top-2 -translate-x-1/2 font-display text-label text-turf-line"
          style={{ left: pct(20 + i * 10) }}>{n}</span>
      ))}
      {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => (
        <span key={`b${i}`} aria-hidden="true" className="absolute bottom-2 -translate-x-1/2 rotate-180 font-display text-label text-turf-line"
          style={{ left: pct(20 + i * 10) }}>{n}</span>
      ))}
      {/* Drive so far */}
      {trailFrom != null && (
        <div
          className="absolute top-1/2 h-[26%] -translate-y-1/2 rounded-chip transition-[left,width] duration-100"
          style={{
            left: pct(Math.min(trailFrom, ballX)), width: pct(Math.abs(ballX - trailFrom)),
            background: alpha(offColor, 0.45),
          }}
        />
      )}
      {los != null && <div className="absolute inset-y-0 w-[3px] bg-chalk opacity-80" style={{ left: pct(los) }} />}
      {first != null && <div className="absolute inset-y-0 w-[3px] bg-turf-first" style={{ left: pct(first) }} />}
      {/* The ball */}
      <div
        className="absolute top-1/2 h-3.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-turf-ball shadow-[0_0_0_2px_var(--chalk)]"
        style={{ left: pct(ballX) }}
      />
    </div>
  );
}

function Callout({ play, desc, teams, keyId }) {
  const side = creditSide(play, desc);
  const bg = color(teams[side]);
  const big = desc.tone === 'score' || desc.tone === 'turnover';
  return (
    <div key={keyId} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <span
        className={cx('toon-sticker uppercase animate-bounce-in', big ? 'text-display' : 'text-h1', side === 0 ? '-rotate-3' : 'rotate-3')}
        style={{ background: bg, color: onColor(bg) }}
      >
        {desc.tag}{big ? '!' : ''}
      </span>
    </div>
  );
}

function Scorebug({ teams, abbr, score, q, clock, poss, userSide, final }) {
  const side = (s) => (
    <div className={cx('flex min-w-0 flex-1 items-center gap-3 px-3 py-2', s === 1 && 'flex-row-reverse text-right')}
      style={{ background: color(teams[s]) }}>
      <TeamCrest team={teams[s]} size="md" decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-h3 uppercase leading-none" style={{ color: onColor(color(teams[s])) }}>
          {teams[s]?.name}{s === userSide && <span className="ml-1.5 text-micro opacity-70">YOU</span>}
        </p>
      </div>
      <span className={cx('relative font-display text-[clamp(30px,4vw,48px)] leading-none tabular-nums')}
        style={{ color: onColor(color(teams[s])) }}>
        {!final && poss === s && (
          <span aria-label="possession" className={cx('absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-turf-first', s === 0 ? '-left-3.5' : '-right-3.5')} />
        )}
        <span key={score[s]} className="inline-block animate-bounce-in">{score[s]}</span>
      </span>
    </div>
  );
  return (
    <div className="flex items-stretch overflow-hidden rounded-panel shadow-2">
      {side(1)}
      <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-0.5 bg-ink px-2 text-chalk">
        <span className="font-display text-h3 uppercase leading-none">{final ? (q >= 5 ? 'Final/OT' : 'Final') : periodLabel(q)}</span>
        {!final && <span className="text-label tabular-nums opacity-80">{clockText(clock)}</span>}
        <span className="text-micro uppercase opacity-60">{abbr[1]} @ {abbr[0]}</span>
      </div>
      {side(0)}
    </div>
  );
}

const TONE_CHIP = {
  score: 'bg-positive-solid text-n-0',
  turnover: 'bg-negative-solid text-n-0',
  defense: 'bg-ink text-chalk',
  big: 'bg-warning-solid text-ink',
  plain: 'bg-surface-sunken text-fg-secondary',
};

function FeedItem({ item, teams, abbr }) {
  const { play, desc, drive } = item;
  const side = creditSide(play, desc);
  return (
    <li className="flex animate-fade-up gap-2 border-b border-line-subtle py-1.5 last:border-b-0">
      <span className="mt-0.5 w-1 shrink-0 self-stretch rounded-full" style={{ background: color(teams[side]) }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cx('rounded-full px-1.5 py-0.5 text-micro font-bold uppercase leading-none', TONE_CHIP[desc.tone])}>{desc.tag}</span>
          <span className="text-micro tabular-nums text-fg-faint">{periodLabel(play.q)} {clockText(play.clock)} · {abbr[side]}</span>
        </div>
        <p className="mt-0.5 text-label leading-snug text-fg">{desc.text}</p>
        {drive && (
          <p className="text-micro text-fg-muted">
            Drive: {drive.plays} plays, {drive.yards} yds, {clockText(drive.secs)}
          </p>
        )}
      </div>
    </li>
  );
}

function LeaderRow({ label, line, text }) {
  if (!line || !text) return null;
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="w-8 shrink-0 text-micro uppercase text-fg-faint">{label}</span>
      <span className="truncate text-label font-semibold text-fg">{line.short}</span>
      <span className="ml-auto shrink-0 text-micro tabular-nums text-fg-muted">{text}</span>
    </div>
  );
}

function TeamRail({ team, leaders, totals, align }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-card bg-surface-raised px-3 py-2 shadow-1">
      <div className={cx('flex items-center gap-2', align === 'right' && 'flex-row-reverse')}>
        <span className="h-3 w-3 rounded-full" style={{ background: color(team) }} />
        <span className="font-display text-h3 uppercase leading-none text-fg">{team?.abbreviation}</span>
        <span className={cx('text-micro tabular-nums text-fg-muted', align === 'right' ? 'mr-auto' : 'ml-auto')}>
          {totals.yards} yds · {totals.fd} 1st · {totals.to} TO
        </span>
      </div>
      <LeaderRow label="Pass" line={leaders.passer} text={passLine(leaders.passer)} />
      <LeaderRow label="Rush" line={leaders.rusher} text={rushLine(leaders.rusher)} />
      <LeaderRow label="Rec" line={leaders.receiver} text={recLine(leaders.receiver)} />
      <LeaderRow label="Def" line={leaders.defender} text={defLine(leaders.defender)} />
    </div>
  );
}

/** Score margin over game time, home above the line, away below. */
function MomentumStrip({ points, teams, now, overtime }) {
  const total = overtime ? 4200 : 3600;
  const max = Math.max(14, ...points.map(p => Math.abs(p.d)));
  const X = t => (t / total) * 1000;
  const Y = d => 30 - (d / max) * 26;
  let path = `M0 ${Y(0)}`;
  let last = 0;
  for (const p of points) {
    if (p.t > now) break;
    path += ` H${X(p.t).toFixed(1)} V${Y(p.d).toFixed(1)}`;
    last = p.d;
  }
  path += ` H${X(Math.min(now, total)).toFixed(1)}`;
  const quarters = overtime ? [900, 1800, 2700, 3600] : [900, 1800, 2700];
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <rect x="0" y="0" width="1000" height="30" style={{ fill: alpha(color(teams[0]), 0.10) }} />
        <rect x="0" y="30" width="1000" height="30" style={{ fill: alpha(color(teams[1]), 0.10) }} />
        {quarters.map(q => <line key={q} x1={X(q)} x2={X(q)} y1="0" y2="60" style={{ stroke: 'var(--border-default)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <line x1="0" x2="1000" y1="30" y2="30" style={{ stroke: 'var(--ink)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.4" />
        <path d={path} fill="none" style={{ stroke: 'var(--text-primary)' }} strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={path} fill="none" style={{ stroke: last >= 0 ? color(teams[0]) : color(teams[1]) }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span className="absolute left-1 top-0 text-micro uppercase text-fg-faint">{teams[0]?.abbreviation} ▲</span>
      <span className="absolute bottom-0 left-1 text-micro uppercase text-fg-faint">{teams[1]?.abbreviation} ▼</span>
    </div>
  );
}

function FinalCard({ game, teams, abbr, userSide, others, onContinue, form }) {
  const story = classifyGame(game);
  const pog = playerOfGame(game);
  const rosters = useGameStore(s => s.rosters);
  const pogTeamId = pog ? (pog.side === 'home' ? game.homeTeamId : game.awayTeamId) : null;
  const pogFull = pog ? (rosters?.[pogTeamId] || []).find(p => p.id === pog.player.id) : null;
  const score = [game.homeScore, game.awayScore];
  const userWon = score[userSide] > score[1 - userSide];
  const tie = score[0] === score[1];
  // Game-day form, only where the result bears it out
  const formNotes = [0, 1].flatMap(s => {
    const f = form?.[s];
    if (!f) return [];
    const notes = [];
    if (f.off >= 5 && score[s] >= 27) notes.push(`${abbr[s]} offense came in hot`);
    if (f.off <= -5 && score[s] <= 17) notes.push(`${abbr[s]} offense never got going`);
    if (f.def >= 4.5 && score[1 - s] <= 17) notes.push(`${abbr[s]} defense was locked in`);
    return notes;
  });

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-shell/85 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl animate-pop-in flex-col gap-3 rounded-panel bg-surface-raised p-5 shadow-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cx('toon-sticker text-h2 uppercase', tie ? 'bg-ink text-chalk' : userWon ? 'bg-positive-solid text-n-0' : 'bg-negative-solid text-n-0')}>
            {tie ? 'Tie' : userWon ? 'Victory' : 'Defeat'}
          </span>
          <div className="text-right">
            <p className="font-display text-h2 uppercase leading-none text-team-ink">{story.label}</p>
            <p className="text-label text-fg-muted">{story.blurb}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-6">
          {[1, 0].map(s => (
            <div key={s} className={cx('flex items-center gap-3', s === 0 && 'flex-row-reverse')}>
              <TeamCrest team={teams[s]} size="lg" />
              <span className={cx('font-display text-[clamp(40px,6vw,64px)] leading-none tabular-nums', score[s] < score[1 - s] && 'opacity-40')}>{score[s]}</span>
            </div>
          ))}
        </div>
        {story.tags.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {story.tags.map(t => <span key={t} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-micro font-semibold uppercase text-fg-secondary">{t}</span>)}
          </div>
        )}
        {pog && (
          <div className="flex items-center gap-3 rounded-card bg-surface-sunken px-3 py-2">
            {pogFull && <PlayerFace player={pogFull} teamId={pogTeamId} size="md" />}
            <div className="min-w-0">
              <p className="text-micro uppercase text-fg-faint">Player of the game</p>
              <p className="truncate font-display text-h3 uppercase leading-tight text-fg">{pog.player.name} <span className="text-label text-fg-muted">{pog.player.position} · {abbr[pog.side === 'home' ? 0 : 1]}</span></p>
              <p className="text-label tabular-nums text-fg-secondary">{pog.line}</p>
            </div>
            {formNotes.length > 0 && (
              <ul className="ml-auto hidden max-w-[45%] text-right text-micro text-fg-muted md:block">
                {formNotes.slice(0, 2).map(n => <li key={n}>{n}</li>)}
              </ul>
            )}
          </div>
        )}
        {others.length > 0 && (
          <div>
            <p className="mb-1 text-micro uppercase text-fg-faint">Around the league</p>
            <div className="flex flex-wrap gap-1.5">
              {others.map(({ g, final }) => {
                const a = TEAM.get(g.awayTeamId), h = TEAM.get(g.homeTeamId);
                if (!final) return null;
                return (
                  <span key={g.id ?? `${g.awayTeamId}${g.homeTeamId}`} className="rounded-chip bg-surface-sunken px-2 py-0.5 text-micro tabular-nums text-fg-secondary">
                    <b className={final[0] > final[1] ? 'text-fg' : ''}>{a?.abbreviation} {final[0]}</b>
                    {' – '}
                    <b className={final[1] > final[0] ? 'text-fg' : ''}>{h?.abbreviation} {final[1]}</b>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="primary" size="lg" onClick={onContinue}>Continue →</Button>
        </div>
      </div>
    </div>
  );
}

function Intro({ game, teams, plans, userSide }) {
  const plan = plans?.[userSide];
  const w = game.weather;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex animate-pop-in flex-col items-center gap-3 rounded-panel bg-surface-raised px-8 py-6 shadow-3">
        <p className="text-micro uppercase text-fg-faint">Kickoff</p>
        <div className="flex items-center gap-5">
          <TeamCrest team={teams[1]} size="xl" />
          <span className="font-display text-h1 text-fg-faint">@</span>
          <TeamCrest team={teams[0]} size="xl" />
        </div>
        <p className="font-display text-h2 uppercase text-fg">{teams[1]?.name} at {teams[0]?.name}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-label text-fg-secondary">
          {w && <span>{w.icon} {w.type}</span>}
          {plan && <span className="rounded-full bg-team px-2.5 py-0.5 text-micro font-semibold uppercase text-team-on">Game plan: {plan}</span>}
        </div>
      </div>
    </div>
  );
}

// ── the broadcast ─────────────────────────────────────────────────────────────

/**
 * @param {object}   game       the user's schedule row (must carry `pbp`)
 * @param {string}   title      "Week 5", "Wild Card"…
 * @param {Array}    others     [{ g, final: [away, home] }] the rest of the slate
 * @param {number}   duration   ms for the game itself (intro not included)
 * @param {Function} onComplete
 */
export default function GameBroadcast({ game, title, others = [], duration = 28000, onComplete }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  const teams = useMemo(() => [TEAM.get(game.homeTeamId), TEAM.get(game.awayTeamId)], [game.homeTeamId, game.awayTeamId]);
  const abbr = useMemo(() => teams.map(t => t?.abbreviation ?? '???'), [teams]);
  const userSide = game.awayTeamId === userTeamId ? 1 : 0;

  // Timeline: each snap gets a slice of the broadcast proportional to how
  // much it matters; quarter breaks and halftime get a beat of their own.
  const model = useMemo(() => {
    const plays = readPbp(game.pbp);
    const descs = plays.map(p => describePlay(p, abbr));
    const segs = [];
    plays.forEach((p, i) => {
      const prev = plays[i - 1];
      if (prev && p.q !== prev.q) segs.push({ brk: prev.q === 2 ? 'Halftime' : prev.q === 4 ? 'Overtime' : `End of ${periodLabel(prev.q)}`, i: i - 1, w: prev.q === 2 ? 10 : 4 });
      segs.push({ i, w: dwell(p, descs[i]) });
    });
    const total = segs.reduce((s, x) => s + x.w, 0) || 1;
    let acc = 0;
    for (const s of segs) { s.t0 = acc / total; acc += s.w; s.t1 = acc / total; }
    const drives = drivesOf(plays);
    const driveEnding = new Map(drives.map(d => [d.endIdx, d]));
    const driveAt = [];
    let di = 0;
    plays.forEach((p, i) => {
      while (di < drives.length - 1 && drives[di].endIdx < i) di++;
      const d = drives[di];
      driveAt[i] = d && i >= d.startIdx && i <= d.endIdx ? d : null;
    });
    // Running team totals after each play
    const tot = [];
    const run = [{ yards: 0, to: 0, fd: 0 }, { yards: 0, to: 0, fd: 0 }];
    plays.forEach((p, i) => {
      const t = run[p.off];
      if ([KIND.RUN, KIND.PASS, KIND.SCRAMBLE, KIND.SACK, KIND.KNEEL].includes(p.kind)) t.yards += p.yards;
      if (p.flags & FLAG.FIRST) t.fd++;
      if (p.kind === KIND.INT || (p.flags & FLAG.FUMBLE)) t.to++;
      tot[i] = [{ ...run[0] }, { ...run[1] }];
    });
    const momentum = plays.map(p => ({ t: elapsedAt(p.q, p.clock), d: p.hs - p.as }));
    return { plays, descs, segs, driveEnding, driveAt, tot, momentum };
  }, [game.pbp, abbr]);

  const [ms, setMs] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete?.();
  }, [onComplete]);

  const TOTAL = INTRO_MS + duration;
  useEffect(() => {
    if (skipped) return undefined;
    const start = performance.now();
    let raf = 0;
    const tick = now => {
      const v = Math.min(TOTAL, now - start);
      setMs(v);
      if (v < TOTAL) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const failsafe = setTimeout(() => setMs(TOTAL), TOTAL + 500);
    return () => { cancelAnimationFrame(raf); clearTimeout(failsafe); };
  }, [TOTAL, skipped]);

  const now = skipped ? TOTAL : ms;
  const intro = now < INTRO_MS;
  const gameP = clamp01((now - INTRO_MS) / duration);
  const final = gameP >= 1;
  const { plays, descs, segs } = model;

  // Current segment
  let si = 0;
  if (final) si = segs.length - 1;
  else { while (si < segs.length - 1 && segs[si].t1 <= gameP) si++; }
  const seg = segs[si];
  const idx = seg ? seg.i : 0;
  const play = plays[idx];
  const f = seg && !seg.brk && !final ? clamp01((gameP - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0)) : 1;
  const landed = f >= 0.45 || !!seg?.brk || final;
  const shownIdx = landed ? idx : idx - 1;

  // Keyed on the play index so the heavy derivations only rerun per snap.
  const live = useMemo(() => {
    const lines = statsThrough(plays, shownIdx);
    const feed = [];
    for (let i = 0; i <= shownIdx && i < plays.length; i++) {
      if (descs[i].key) feed.push({ play: plays[i], desc: descs[i], drive: descs[i].tone === 'score' ? model.driveEnding.get(i) : null, i });
    }
    return { leaders: [leadersFor(lines, 0), leadersFor(lines, 1)], feed: feed.reverse().slice(0, 7) };
  }, [plays, descs, shownIdx, model.driveEnding]);

  // X-Factor zone: activation/deactivation events logged by the engine.
  const xfEvents = useMemo(() => (game.pbp?.xf || []).map(([q, clk, side, id, ev]) => ({ t: elapsedAt(q, clk), side, id, ev })), [game.pbp]);
  const rosters = useGameStore(s => s.rosters);
  const xfPlayers = useMemo(() => {
    const out = {};
    for (const tid of [game.homeTeamId, game.awayTeamId]) for (const p of rosters?.[tid] || []) if (p.xFactor) out[p.id] = { p, ability: abilityFor(p) };
    return out;
  }, [rosters, game.homeTeamId, game.awayTeamId]);

  if (!play) return null;
  const scoreSrc = shownIdx >= 0 ? plays[shownIdx] : null;
  const score = final ? [game.homeScore, game.awayScore] : scoreSrc ? [scoreSrc.hs, scoreSrc.as] : [0, 0];
  const nextPlay = plays[idx + 1];
  const clock = final ? 0 : nextPlay && nextPlay.q === play.q && !seg.brk ? play.clock + (nextPlay.clock - play.clock) * f : seg.brk ? 0 : play.clock;
  const totals = shownIdx >= 0 ? model.tot[shownIdx] : [{ yards: 0, to: 0, fd: 0 }, { yards: 0, to: 0, fd: 0 }];
  const desc = descs[idx];
  const showCallout = !intro && !final && !seg.brk && desc.tag && f >= 0.35;
  const drive = model.driveAt[idx];
  const situation = play.down >= 1 && play.down <= 4
    ? `${downText(play.down, play.togo, play.yl)} · ${spotText(play.yl, abbr[play.off], abbr[1 - play.off])}` : '';
  const elapsedNow = final ? Infinity : elapsedAt(play.q, clock);
  const zoneNow = {};
  let lastZone = null;
  for (const e of xfEvents) {
    if (e.t > elapsedNow) break;
    if (e.ev === 'zone') { zoneNow[e.id] = e; lastZone = e; } else if (e.ev === 'off' || e.ev === 'countered') delete zoneNow[e.id];
  }
  const zoneFlash = !final && !intro && lastZone && elapsedNow - lastZone.t <= 45 && xfPlayers[lastZone.id] ? xfPlayers[lastZone.id] : null;
  const inZone = Object.values(zoneNow).map(e => xfPlayers[e.id]).filter(Boolean);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-shell"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      role="dialog" aria-modal="true" aria-label={`${title}: ${abbr[1]} at ${abbr[0]}`}
    >
      <div aria-hidden="true" className="relative h-2.5 shrink-0 border-b-[3px] border-ink bg-team" />
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-2.5 px-5 py-3">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cx('toon-sticker text-micro uppercase', !final && 'animate-pulse')}>{final ? 'Final' : 'Live'}</span>
            <h1 className="toon-title truncate font-display text-[clamp(24px,3.2vw,40px)] uppercase leading-none text-team-accent">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!final && <Button variant="secondary" onClick={() => setSkipped(true)}>Skip to final</Button>}
            {final && <Button variant="ghost" onClick={finish}>Close</Button>}
          </div>
        </header>

        {inZone.length > 0 && !final && (
          <div className="flex shrink-0 flex-wrap gap-1.5" aria-live="polite">
            {inZone.map(z => <span key={z.p.id} className="xf-chip animate-zone-pulse rounded-full border-2 border-ink px-2.5 py-0.5 text-micro uppercase">⚡ {z.p.name} in the zone · {z.ability?.triggerShort}</span>)}
          </div>
        )}
        <div className="shrink-0">
          <Scorebug teams={teams} abbr={abbr} score={score} q={final ? (game.overtime ? 5 : 4) : play.q} clock={clock}
            poss={play.off} userSide={userSide} final={final} />
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          {/* Field + ticker + rails */}
          <div className="flex min-h-0 min-w-0 flex-[1.6] flex-col gap-2">
            <div className="relative min-h-[120px] flex-1">
              <Field plays={plays} idx={idx} f={f} teams={teams} abbr={abbr} drive={drive} />
              {showCallout && <Callout play={play} desc={desc} teams={teams} keyId={idx} />}
              {zoneFlash && (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
                  <span key={lastZone.t} className="xf-chip animate-bounce-in rounded-full border-[3px] border-ink px-4 py-1.5 font-display text-h2 uppercase shadow-2">⚡ Zone · {zoneFlash.p.name.split(' ').slice(-1)[0]} · {zoneFlash.ability?.name}</span>
                </div>
              )}
              {seg?.brk && !final && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <span key={seg.brk} className="toon-sticker animate-bounce-in text-h1 uppercase">{seg.brk} · {abbr[1]} {score[1]} – {abbr[0]} {score[0]}</span>
                </div>
              )}
            </div>
            <div className="flex h-12 shrink-0 items-center gap-3 rounded-card bg-ink px-3 text-chalk">
              <span className="shrink-0 rounded-full px-2 py-0.5 text-micro font-bold uppercase" style={{ background: color(teams[play.off]), color: onColor(color(teams[play.off])) }}>
                {abbr[play.off]}
              </span>
              <span className="w-28 shrink-0 text-micro uppercase tabular-nums opacity-70">{situation}</span>
              <p className="min-w-0 flex-1 truncate text-label">{intro ? 'Teams take the field…' : seg?.brk ? seg.brk : desc.text}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <TeamRail team={teams[1]} leaders={live.leaders[1]} totals={totals[1]} />
              <TeamRail team={teams[0]} leaders={live.leaders[0]} totals={totals[0]} align="right" />
            </div>
          </div>

          {/* Highlights feed: newest on top, never scrolls */}
          <aside className="flex min-h-0 min-w-0 flex-1 flex-col rounded-card bg-surface-raised px-3 py-2 shadow-1">
            <p className="shrink-0 text-micro uppercase text-fg-faint">Big plays</p>
            {live.feed.length === 0
              ? <p className="mt-2 text-label text-fg-faint">Nothing yet — both defenses settling in.</p>
              : (
                <ul className="min-h-0 flex-1 overflow-hidden">
                  {live.feed.map(item => <FeedItem key={item.i} item={item} teams={teams} abbr={abbr} />)}
                </ul>
              )}
          </aside>
        </div>

        <div className="h-12 shrink-0 rounded-card bg-surface-raised px-2 py-1 shadow-1">
          <MomentumStrip points={model.momentum} teams={teams} now={elapsedNow} overtime={!!game.overtime} />
        </div>

        {intro && <Intro game={game} teams={teams} plans={game.pbp?.plans} userSide={userSide} />}
        {final && (
          <FinalCard game={game} teams={teams} abbr={abbr} userSide={userSide} others={others}
            onContinue={finish} form={game.pbp?.form} />
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
