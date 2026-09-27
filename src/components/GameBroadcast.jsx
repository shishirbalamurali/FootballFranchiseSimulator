import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';
import { KIND, FLAG } from '../engine/gameEngine';
import {
  readPbp, describePlay, drivesOf, statsThrough, leadersFor, passLine, rushLine, recLine, defLine,
  downText, clockText, periodLabel, spotText, elapsedAt, classifyGame, threeStars, creditSide,
  winProbSeries, playOfTheGame, boothCalls,
} from '../engine/gameStory';
import { PLAY_STYLES, playStyleFor } from '../engine/playStyles';
import { upsetInfo, SLOT_LABEL } from '../engine/gameContext';
import { characterFor } from '../engine/character';
import { TeamCrest, Button, cx, alpha, onColor } from './ui';
import PlayerFace from './PlayerFace';
import { abilityFor } from '../engine/xFactor'; // CLAUDE: X-Factor zone

// "Watch our game": the user's game as a live broadcast, built from the
// engine's real play-by-play. Every snap moves the ball on the field; the big
// ones are called out, and the player who made the play steps into a
// spotlight with his face, number, play style and line so far. A booth
// analyst adds colour, the field goes to night in the Witching Hour, and a
// win-probability chart tracks every swing. Pause, 1×/2×/4× and "next big
// play" let the viewer drive. Screen rules: fits the viewport, never
// scrolls, always skippable.

const TEAM = new Map(TEAMS.map(t => [t.id, t]));
const INTRO_MS = 4200;
const color = team => team?.theme?.primary ?? 'var(--ink)';
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const SPEEDS = [1, 2, 4];

// Dwell per snap, relative to a routine play. Scores and turnovers linger so
// they can be read; kicks and tries go by quickly; the Witching Hour plays
// in slow motion.
function dwell(p, d) {
  let w;
  if (d.tone === 'score') w = 9;
  else if (d.tone === 'turnover') w = 7.5;
  else if (d.tag) w = 4.6;
  else if (p.kind === KIND.XP || p.kind === KIND.KICKOFF || p.kind === KIND.KNEEL) w = 0.6;
  else w = 1;
  if (p.flags & FLAG.WITCHING) w *= 1.4;
  return w;
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
    case KIND.FG: return fieldX(p.off, 110);
    case KIND.FG_MISS: return (p.flags & FLAG.BLOCKED) ? fieldX(p.off, p.yl - 7) : fieldX(p.off, 110);
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

/** Who made the play — the one to put in the spotlight. */
function starOf(p, d) {
  if (p.R && (d.tone === 'score' || p.has(FLAG.FUMBLE))) return d.tone === 'score' ? p.R : p.X ?? p.R;
  switch (p.kind) {
    case KIND.PASS: return d.tone === 'turnover' ? p.X : p.B ?? p.A;
    case KIND.INT: case KIND.SACK: return p.X ?? p.A;
    case KIND.INC: return p.X ?? p.A;
    case KIND.PUNT: return p.has(FLAG.BLOCKED) ? p.X : p.B;
    case KIND.FG_MISS: return p.has(FLAG.BLOCKED) ? p.X : p.A;
    case KIND.RUN: return d.tone === 'turnover' || d.tone === 'defense' ? p.X ?? p.A : p.A;
    default: return p.A ?? p.B ?? p.X;
  }
}

/** A short "today" line for a player, by what he has done so far. */
function todayLine(line) {
  if (!line) return '';
  if (line.att) return passLine(line);
  if (line.rec) return recLine(line) + (line.car ? ` · ${rushLine(line)}` : '');
  if (line.car) return rushLine(line);
  const d = defLine(line);
  if (d) return d;
  if (line.fga) return `${line.fgm}/${line.fga} FG`;
  return '';
}

// ── pieces ────────────────────────────────────────────────────────────────────

function Field({ plays, idx, f, teams, abbr, drive, night }) {
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
  const turf = night ? 'var(--turf-night)' : 'var(--turf)';
  const stripe = night ? 'var(--turf-night-stripe)' : 'var(--turf-stripe)';

  return (
    <div className={cx('relative h-full w-full overflow-hidden rounded-panel shadow-2 transition-[background] duration-slow', night && 'animate-witch-pulse')}
      style={{ background: turf }}>
      {/* End zones: home defends the left */}
      {[0, 1].map(side => (
        <div
          key={side}
          className="absolute inset-y-0 flex items-center justify-center"
          style={{ left: side === 0 ? 0 : pct(110), width: pct(10), background: color(teams[side]), opacity: night ? 0.8 : 1 }}
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
          backgroundImage: `repeating-linear-gradient(90deg, ${turf} 0 10%, ${stripe} 10% 20%), repeating-linear-gradient(90deg, var(--turf-line) 0 2px, transparent 2px 10%)`,
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
    <div key={keyId} className="pointer-events-none absolute inset-x-0 top-[18%] z-10 flex justify-center">
      <span
        className={cx('toon-sticker uppercase animate-bounce-in', big ? 'text-display' : 'text-h1', side === 0 ? '-rotate-3' : 'rotate-3')}
        style={{ background: bg, color: onColor(bg) }}
      >
        {desc.tag}{big ? '!' : ''}
      </span>
    </div>
  );
}

const SITUATION = {
  witching: { label: 'Witching Hour', icon: '🌙', cls: 'bg-witch text-chalk' },
  upset: { label: 'Upset alert', icon: '🚨', cls: 'bg-negative-solid text-n-0' },
  twominute: { label: 'Two-minute drill', icon: '⏱️', cls: 'bg-warning-solid text-ink' },
  redzone: { label: 'Red zone', icon: '🎯', cls: 'bg-negative-solid text-n-0' },
  goal: { label: 'Goal to go', icon: '🏁', cls: 'bg-ink text-chalk' },
};

function SituationBadge({ id, flash }) {
  const s = SITUATION[id];
  if (!s) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2">
      <span key={`${id}${flash ? 'f' : ''}`}
        className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display uppercase tracking-wide shadow-2',
          flash ? 'animate-bounce-in text-h3' : 'text-label', s.cls)}>
        <span aria-hidden="true">{s.icon}</span>{s.label}
      </span>
    </div>
  );
}

function Spotlight({ who, teamId, desc, line, rosters, align }) {
  const full = who?.playerId ? (rosters?.[teamId] || []).find(p => p.id === who.playerId) : null;
  const style = who?.style ? PLAY_STYLES[who.style] : null;
  const number = full ? characterFor(full)?.number : null;
  const team = TEAM.get(teamId);
  const today = todayLine(line);
  if (!who) return null;
  return (
    <div className={cx('pointer-events-none absolute bottom-3 z-10 flex max-w-[62%] items-center gap-3 rounded-panel bg-surface-raised py-2 pl-2 pr-4 shadow-3',
      align === 'left' ? 'left-3 animate-slide-in-left' : 'right-3 flex-row-reverse pl-4 pr-2 text-right animate-slide-in-right')}
      style={{ borderBottom: `4px solid ${color(team)}` }}>
      {who.playerId
        ? <PlayerFace player={full || { id: who.playerId, age: 26 }} teamId={teamId} size="lg" lazy={false} />
        : <span className="flex size-[88px] items-center justify-center rounded-full font-display text-h1 text-chalk" style={{ background: color(team) }}>{who.pos}</span>}
      <div className="min-w-0">
        <p className="text-micro uppercase text-fg-faint">
          {number != null && <span className="font-display text-label text-fg-secondary">#{number} </span>}
          {who.pos} · {team?.abbreviation}
          {desc.clutch && <span className="ml-1.5 rounded-full bg-info-solid px-1.5 py-0.5 font-bold text-n-0">🧊 Clutch</span>}
          {desc.choke && <span className="ml-1.5 rounded-full bg-negative-solid px-1.5 py-0.5 font-bold text-n-0">Rattled</span>}
        </p>
        <p className="truncate font-display text-h2 uppercase leading-none text-fg">{who.name}</p>
        {style && (
          <p className="mt-0.5 text-label font-semibold text-team-ink">
            <span aria-hidden="true">{style.icon}</span> {style.label}
          </p>
        )}
        {today && <p className="text-label tabular-nums text-fg-secondary">Today: {today}</p>}
      </div>
    </div>
  );
}

function Scorebug({ teams, abbr, score, q, clock, poss, userSide, final, records }) {
  const side = (s) => (
    <div className={cx('flex min-w-0 flex-1 items-center gap-3 px-3 py-2', s === 1 && 'flex-row-reverse text-right')}
      style={{ background: color(teams[s]) }}>
      <TeamCrest team={teams[s]} size="md" decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-h3 uppercase leading-none" style={{ color: onColor(color(teams[s])) }}>
          {teams[s]?.name}{s === userSide && <span className="ml-1.5 text-micro opacity-70">YOU</span>}
        </p>
        {records?.[s] && (
          <p className="text-micro tabular-nums opacity-75" style={{ color: onColor(color(teams[s])) }}>{records[s]}</p>
        )}
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
  const { play, desc, drive, star } = item;
  const side = creditSide(play, desc);
  const style = star?.style ? PLAY_STYLES[star.style] : null;
  return (
    <li className="flex animate-fade-up gap-2 border-b border-line-subtle py-1.5 last:border-b-0">
      <span className="mt-0.5 w-1 shrink-0 self-stretch rounded-full" style={{ background: color(teams[side]) }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx('rounded-full px-1.5 py-0.5 text-micro font-bold uppercase leading-none', TONE_CHIP[desc.tone])}>{desc.tag}</span>
          {desc.clutch && <span className="rounded-full bg-info-solid px-1.5 py-0.5 text-micro font-bold uppercase leading-none text-n-0">🧊 Clutch</span>}
          {desc.witching && !desc.clutch && <span aria-label="Witching Hour" className="text-micro">🌙</span>}
          <span className="text-micro tabular-nums text-fg-faint">{periodLabel(play.q)} {clockText(play.clock)} · {abbr[side]}</span>
        </div>
        <p className="mt-0.5 text-label leading-snug text-fg">{desc.text}</p>
        {(drive || style) && (
          <p className="text-micro text-fg-muted">
            {style && <span>{style.icon} {star.short}, {style.label}{drive ? ' · ' : ''}</span>}
            {drive && <span>Drive: {drive.plays} plays, {drive.yards} yds, {clockText(drive.secs)}</span>}
          </p>
        )}
      </div>
    </li>
  );
}

function LeaderRow({ label, line, text }) {
  if (!line || !text) return null;
  const style = line.style ? PLAY_STYLES[line.style] : null;
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="w-8 shrink-0 text-micro uppercase text-fg-faint">{label}</span>
      <span className="truncate text-label font-semibold text-fg">{line.short}</span>
      {style && <span aria-label={style.label} title={style.label} className="text-micro">{style.icon}</span>}
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

/** Home win probability over game time, with the current odds for both sides. */
function WinProbStrip({ points, teams, abbr, now, overtime, potg, wpNow }) {
  const total = overtime ? 4200 : 3600;
  const X = t => (Math.min(t, total) / total) * 1000;
  const Y = v => 58 - v * 56;
  let path = `M0 ${Y(points.start).toFixed(1)}`;
  for (const p of points.list) {
    if (p.t > now) break;
    path += ` L${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`;
  }
  const quarters = overtime ? [900, 1800, 2700, 3600] : [900, 1800, 2700];
  const home = Math.round(wpNow * 100);
  const potgShown = potg && potg.t <= now;
  return (
    <div className="flex h-full items-center gap-2">
      <div className="flex w-16 shrink-0 flex-col items-end leading-none">
        <span className="font-display text-h3 tabular-nums" style={{ color: color(teams[0]) }}>{home}%</span>
        <span className="text-micro uppercase text-fg-faint">{abbr[0]} win</span>
      </div>
      <div className="relative h-full min-w-0 flex-1">
        <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="h-full w-full" aria-label={`Win probability: ${abbr[0]} ${home}%, ${abbr[1]} ${100 - home}%`} role="img">
          <rect x="0" y="0" width="1000" height="30" style={{ fill: alpha(color(teams[0]), 0.10) }} />
          <rect x="0" y="30" width="1000" height="30" style={{ fill: alpha(color(teams[1]), 0.10) }} />
          {quarters.map(q => <line key={q} x1={X(q)} x2={X(q)} y1="0" y2="60" style={{ stroke: 'var(--border-default)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <line x1="0" x2="1000" y1="30" y2="30" style={{ stroke: 'var(--ink)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.4" strokeDasharray="4 4" />
          <path d={path} fill="none" style={{ stroke: 'var(--text-primary)' }} strokeWidth="4.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d={path} fill="none" style={{ stroke: wpNow >= 0.5 ? color(teams[0]) : color(teams[1]) }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {potgShown && (
          <span className="absolute -translate-x-1/2 -translate-y-1/2 text-label" title="Play of the game"
            style={{ left: `${X(potg.t) / 10}%`, top: `${(Y(potg.v) / 60) * 100}%` }} aria-label="Play of the game">⭐</span>
        )}
      </div>
      <div className="flex w-16 shrink-0 flex-col items-start leading-none">
        <span className="font-display text-h3 tabular-nums" style={{ color: color(teams[1]) }}>{100 - home}%</span>
        <span className="text-micro uppercase text-fg-faint">{abbr[1]} win</span>
      </div>
    </div>
  );
}

function Controls({ paused, speed, onPause, onSpeed, onNext, onSkip, hasNext }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button variant="secondary" onClick={onPause} aria-label={paused ? 'Play' : 'Pause'} title="Space">
        {paused ? '▶ Play' : '❚❚ Pause'}
      </Button>
      <div className="flex overflow-hidden rounded-chip border border-line" role="group" aria-label="Playback speed">
        {SPEEDS.map(s => (
          <button key={s} type="button" onClick={() => onSpeed(s)} aria-pressed={speed === s}
            className={cx('px-2.5 py-1.5 text-label font-semibold tabular-nums transition-colors duration-micro',
              speed === s ? 'bg-ink text-chalk' : 'bg-surface-raised text-fg-secondary hover:bg-surface-hover')}>
            {s}×
          </button>
        ))}
      </div>
      <Button variant="secondary" onClick={onNext} disabled={!hasNext} title="→">Next big play ⏭</Button>
      <Button variant="ghost" onClick={onSkip} title="S">Skip to final</Button>
    </div>
  );
}

const TAG_TONE = {
  gold: 'bg-warning-solid text-ink',
  night: 'bg-ink text-chalk',
  fire: 'bg-negative-solid text-n-0',
  alert: 'bg-info-solid text-n-0',
  plain: 'bg-surface-sunken text-fg-secondary',
};

function ContextChips({ ctx, className }) {
  if (!ctx?.tags?.length) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {ctx.tags.map(t => (
        <span key={t.id} className={cx('rounded-full px-2.5 py-0.5 text-micro font-bold uppercase', TAG_TONE[t.tone] || TAG_TONE.plain)}>{t.label}</span>
      ))}
    </div>
  );
}

function spreadText(ctx, abbr) {
  if (!ctx || !Number.isFinite(ctx.spread)) return null;
  if (ctx.spread === 0) return 'Pick ’em';
  const fav = ctx.spread > 0 ? 0 : 1;
  return `${abbr[fav]} −${Math.abs(ctx.spread)}`;
}

const WATCH_POS = ['QB', 'WR', 'RB', 'TE', 'DL', 'LB', 'CB', 'S'];

function PlayersToWatch({ roster, teamId }) {
  const picks = useMemo(() => (roster || [])
    .filter(p => !p.injured && WATCH_POS.includes(p.position))
    .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
    .slice(0, 2), [roster]);
  if (!picks.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {picks.map(p => {
        const style = playStyleFor(p);
        return (
          <div key={p.id} className="flex items-center gap-2">
            <PlayerFace player={p} teamId={teamId} size="md" lazy={false} />
            <div className="min-w-0">
              <p className="truncate text-label font-bold text-fg">{p.name}</p>
              <p className="text-micro text-fg-muted">{p.position} · {p.ovr} OVR</p>
              {style && <p className="text-micro font-semibold text-team-ink">{style.icon} {style.label}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Intro({ game, teams, abbr, plans, userSide, ctx, rosters, onKickoff }) {
  const plan = plans?.[userSide];
  const w = game.weather;
  const spread = spreadText(ctx, abbr);
  const stage = ctx?.slot ? SLOT_LABEL[ctx.slot] : null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-shell/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl animate-pop-in flex-col items-center gap-3 rounded-panel bg-surface-raised px-6 py-5 shadow-3">
        <p className="text-micro uppercase tracking-widest text-fg-faint">{stage ? `${stage} Football` : 'Tale of the tape'}</p>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
          {[1, 0].map((s, i) => (
            <div key={s} className={cx('flex flex-col gap-2', i === 0 ? 'col-start-1 items-start' : 'col-start-3 items-end text-right')}>
              <div className={cx('flex items-center gap-3', i === 1 && 'flex-row-reverse')}>
                <TeamCrest team={teams[s]} size="xl" />
                <div>
                  <p className="font-display text-h2 uppercase leading-none text-fg">{teams[s]?.name}</p>
                  <p className="text-label tabular-nums text-fg-muted">{ctx?.records?.[s] ?? ''}{s === 0 ? ' · Home' : ' · Away'}</p>
                </div>
              </div>
              <PlayersToWatch roster={rosters?.[s === 0 ? game.homeTeamId : game.awayTeamId]} teamId={s === 0 ? game.homeTeamId : game.awayTeamId} />
            </div>
          ))}
          <div className="col-start-2 row-start-1 flex flex-col items-center gap-1">
            <span className="font-display text-h1 text-fg-faint">@</span>
            {spread && <span className="rounded-chip bg-ink px-2 py-0.5 text-micro font-bold uppercase text-chalk">{spread}</span>}
          </div>
        </div>
        <ContextChips ctx={ctx} className="justify-center" />
        <div className="flex flex-wrap items-center justify-center gap-2 text-label text-fg-secondary">
          {w && <span>{w.icon} {w.type}</span>}
          {plan && <span className="rounded-full bg-team px-2.5 py-0.5 text-micro font-semibold uppercase text-team-on">Game plan: {plan}</span>}
        </div>
        <Button variant="primary" size="lg" onClick={onKickoff}>Kick off ▶</Button>
      </div>
    </div>
  );
}

function FinalCard({ game, teams, abbr, userSide, others, onContinue, form, potg, rosters }) {
  const story = classifyGame(game);
  const stars = threeStars(game);
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
      <div className="flex max-h-full w-full max-w-3xl animate-pop-in flex-col gap-3 overflow-hidden rounded-panel bg-surface-raised p-5 shadow-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cx('toon-sticker text-h2 uppercase', tie ? 'bg-ink text-chalk' : userWon ? 'bg-positive-solid text-n-0' : 'bg-negative-solid text-n-0')}>
            {tie ? 'Tie' : userWon ? 'Victory' : 'Defeat'}
          </span>
          <div className="text-right">
            <p className={cx('font-display text-h2 uppercase leading-none',
              story.tone === 'upset' ? (userWon ? 'text-positive-fg' : 'text-negative-fg') : story.label === 'Witching Hour' ? 'text-witch' : 'text-team-ink')}>{story.label}</p>
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
        {stars.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {stars.map((st, i) => {
              const teamId = st.side === 'home' ? game.homeTeamId : game.awayTeamId;
              const full = (rosters?.[teamId] || []).find(p => p.id === st.player.id);
              const style = full ? playStyleFor(full) : null;
              return (
                <div key={st.player.id} className="flex min-w-0 items-center gap-2 rounded-card bg-surface-sunken px-2 py-1.5">
                  <PlayerFace player={full || st.player} teamId={teamId} size="md" lazy={false} />
                  <div className="min-w-0">
                    <p className="text-micro uppercase text-fg-faint">{'★'.repeat(3 - i)}{'☆'.repeat(i)} {i === 0 ? 'Player of the game' : `${i + 1}${i === 1 ? 'nd' : 'rd'} star`}</p>
                    <p className="truncate text-label font-bold text-fg">{st.player.name} <span className="font-normal text-fg-muted">{st.player.position} · {abbr[st.side === 'home' ? 0 : 1]}</span></p>
                    <p className="truncate text-micro tabular-nums text-fg-secondary">{st.line}</p>
                    {style && <p className="truncate text-micro font-semibold text-team-ink">{style.icon} {style.label}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {potg && (
          <div className="flex items-start gap-2 rounded-card border border-line-subtle px-3 py-2">
            <span aria-hidden="true" className="text-h3">⭐</span>
            <div className="min-w-0 flex-1">
              <p className="text-micro uppercase text-fg-faint">
                Play of the game · {periodLabel(potg.play.q)} {clockText(potg.play.clock)} · swung the odds {Math.round(Math.abs(potg.swing) * 100)}%
              </p>
              <p className="text-label leading-snug text-fg">{potg.desc.text}</p>
            </div>
            {formNotes.length > 0 && (
              <ul className="hidden max-w-[35%] text-right text-micro text-fg-muted md:block">
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
                const up = upsetInfo({ ...g, awayScore: final[0], homeScore: final[1] });
                return (
                  <span key={g.id ?? `${g.awayTeamId}${g.homeTeamId}`} className={cx('rounded-chip px-2 py-0.5 text-micro tabular-nums',
                    up?.upset ? 'bg-negative-bg text-negative-fg' : 'bg-surface-sunken text-fg-secondary')}>
                    <b className={final[0] > final[1] ? 'text-fg' : ''}>{a?.abbreviation} {final[0]}</b>
                    {' – '}
                    <b className={final[1] > final[0] ? 'text-fg' : ''}>{h?.abbreviation} {final[1]}</b>
                    {up?.upset && <b className="ml-1 uppercase">{up.division ? 'Div upset' : 'Upset'}</b>}
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

// ── the broadcast ─────────────────────────────────────────────────────────────

/**
 * @param {object}   game       the user's schedule row (must carry `pbp`)
 * @param {string}   title      "Week 5", "Wild Card"…
 * @param {Array}    others     [{ g, final: [away, home] }] the rest of the slate
 * @param {number}   duration   ms for the game itself at 1× (intro not included)
 * @param {Function} onComplete
 */
export default function GameBroadcast({ game, title, others = [], duration = 42000, onComplete }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const teams = useMemo(() => [TEAM.get(game.homeTeamId), TEAM.get(game.awayTeamId)], [game.homeTeamId, game.awayTeamId]);
  const abbr = useMemo(() => teams.map(t => t?.abbreviation ?? '???'), [teams]);
  const userSide = game.awayTeamId === userTeamId ? 1 : 0;
  const ctx = game.pbp?.ctx || null;

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
    // Running team totals and timeouts left after each play
    const tot = [];
    const run = [{ yards: 0, to: 0, fd: 0 }, { yards: 0, to: 0, fd: 0 }];
    plays.forEach((p, i) => {
      const t = run[p.off];
      if ([KIND.RUN, KIND.PASS, KIND.SCRAMBLE, KIND.SACK, KIND.KNEEL].includes(p.kind)) t.yards += p.yards;
      if (p.flags & FLAG.FIRST) t.fd++;
      if (p.kind === KIND.INT || (p.flags & FLAG.FUMBLE)) t.to++;
      tot[i] = [{ ...run[0] }, { ...run[1] }];
    });
    const margin = (game.homeScore ?? 0) - (game.awayScore ?? 0);
    const wp = winProbSeries(plays, ctx?.spread ?? 0, margin);
    const potgRaw = playOfTheGame(plays, wp);
    const potg = potgRaw ? { ...potgRaw, play: plays[potgRaw.idx], desc: descs[potgRaw.idx], t: elapsedAt(plays[potgRaw.idx].q, plays[potgRaw.idx].clock), v: wp.series[potgRaw.idx] } : null;
    const wpPoints = { start: wp.start, list: plays.map((p, i) => ({ t: elapsedAt(p.q, p.clock), v: wp.series[i] })) };
    const booth = boothCalls(plays, descs, abbr, ctx);
    const stars = plays.map((p, i) => (descs[i].tag ? starOf(p, descs[i]) : null));
    const keySegs = segs.map((s, si) => (!s.brk && descs[s.i]?.key ? si : -1)).filter(si => si >= 0);
    return { plays, descs, segs, driveEnding, driveAt, tot, wp, wpPoints, potg, booth, stars, keySegs };
  }, [game.pbp, game.homeScore, game.awayScore, abbr, ctx]);

  // ── playback clock: virtual ms that the viewer can pause, speed up and jump
  const TOTAL = INTRO_MS + duration;
  const [ms, setMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const vRef = useRef(0);
  const ctl = useRef({ paused: false, speed: 1 });
  useEffect(() => { ctl.current = { paused, speed }; }, [paused, speed]);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = now => {
      const dt = Math.min(250, now - last);
      last = now;
      if (!ctl.current.paused && vRef.current < TOTAL) {
        vRef.current = Math.min(TOTAL, vRef.current + dt * ctl.current.speed);
        setMs(vRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [TOTAL]);
  const jump = useCallback(v => { vRef.current = Math.min(TOTAL, Math.max(vRef.current, v)); setMs(vRef.current); }, [TOTAL]);

  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete?.();
  }, [onComplete]);

  const now = ms;
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

  const nextKey = model.keySegs.find(k => k > si || (k === si && gameP < segs[k].t0 + (segs[k].t1 - segs[k].t0) * 0.3));
  const goNext = useCallback(() => {
    if (nextKey == null) return;
    const s = model.segs[nextKey];
    // Land a beat before the snap so the play is seen, not just its result
    jump(INTRO_MS + s.t0 * duration + 1);
  }, [nextKey, model.segs, jump, duration]);
  const skip = useCallback(() => jump(TOTAL), [jump, TOTAL]);
  const kickoff = useCallback(() => jump(INTRO_MS), [jump]);

  useEffect(() => {
    const onKey = e => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); if (intro) kickoff(); else setPaused(v => !v); }
      else if (e.key === 'ArrowRight' || e.key === 'n') { if (intro) kickoff(); else goNext(); }
      else if (e.key === 's' || e.key === 'S') skip();
      else if (e.key === '1' || e.key === '2' || e.key === '4') setSpeed(Number(e.key));
      else if (e.key === 'Escape' && final) finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, final, kickoff, goNext, skip, finish]);

  const play = plays[idx];
  const f = seg && !seg.brk && !final ? clamp01((gameP - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0)) : 1;
  const landed = f >= 0.45 || !!seg?.brk || final;
  const shownIdx = landed ? idx : idx - 1;

  // Keyed on the play index so the heavy derivations only rerun per snap.
  const live = useMemo(() => {
    const lines = statsThrough(plays, shownIdx);
    const feed = [];
    for (let i = 0; i <= shownIdx && i < plays.length; i++) {
      if (descs[i].key) feed.push({ play: plays[i], desc: descs[i], drive: descs[i].tone === 'score' ? model.driveEnding.get(i) : null, star: model.stars[i], i });
    }
    // The last booth line within a few snaps stays up so it can be read.
    let booth = null;
    for (let i = shownIdx; i >= 0 && i >= shownIdx - 3; i--) { if (model.booth.lines[i]) { booth = model.booth.lines[i]; break; } }
    return { lines, leaders: [leadersFor(lines, 0), leadersFor(lines, 1)], feed: feed.reverse().slice(0, 7), booth };
  }, [plays, descs, shownIdx, model.driveEnding, model.stars, model.booth]);

  // X-Factor zone: activation/deactivation events logged by the engine.
  const xfEvents = useMemo(() => (game.pbp?.xf || []).map(([q, clk, side, id, ev]) => ({ t: elapsedAt(q, clk), side, id, ev })), [game.pbp]);
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
  const star = model.stars[idx];
  const showSpotlight = showCallout && star && f >= 0.4;
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
  const wpNow = final ? (score[0] > score[1] ? 1 : score[0] < score[1] ? 0 : 0.5) : shownIdx >= 0 ? model.wp.series[shownIdx] : model.wp.start;

  // What's going on right now, most important first.
  const night = !intro && !final && (play.flags & FLAG.WITCHING) !== 0;
  const margin = score[0] - score[1];
  const dog = ctx?.favorite == null ? null : 1 - ctx.favorite;
  const upsetLive = dog != null && Math.abs(ctx.spread) >= 3 && play.q >= 4 && (dog === 0 ? margin > 0 : margin < 0);
  const scrim = play.down >= 1 && play.down <= 4;
  const sit = intro || final || seg?.brk ? null
    : night ? 'witching'
    : upsetLive ? 'upset'
    : scrim && (play.q === 2 || play.q === 4) && play.clock <= 120 ? 'twominute'
    : scrim && play.yl + play.togo >= 100 && play.yl >= 90 ? 'goal'
    : scrim && play.yl >= 80 ? 'redzone' : null;
  const sitFlash = sit && model.booth.banners[idx] === sit && f < 0.5;
  const starSide = star ? star.side : null;
  const starTeamId = starSide === 0 ? game.homeTeamId : starSide === 1 ? game.awayTeamId : null;
  const starLine = star ? live.lines.find(l => l.id === star.id) : null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-shell"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      role="dialog" aria-modal="true" aria-label={`${title}: ${abbr[1]} at ${abbr[0]}`}
    >
      <div aria-hidden="true" className={cx('relative h-2.5 shrink-0 border-b-[3px] border-ink transition-colors duration-slow', night ? 'bg-witch' : 'bg-team')} />
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-2.5 px-5 py-3">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cx('toon-sticker text-micro uppercase', !final && !paused && 'animate-pulse')}>{final ? 'Final' : paused ? 'Paused' : 'Live'}</span>
            <h1 className="toon-title truncate font-display text-[clamp(24px,3.2vw,40px)] uppercase leading-none text-team-accent">{title}</h1>
            <ContextChips ctx={ctx} className="hidden xl:flex" />
          </div>
          {!final && !intro && (
            <Controls paused={paused} speed={speed} onPause={() => setPaused(v => !v)} onSpeed={setSpeed}
              onNext={goNext} onSkip={skip} hasNext={nextKey != null} />
          )}
          {intro && <Button variant="ghost" onClick={skip}>Skip to final</Button>}
          {final && <Button variant="ghost" onClick={finish}>Close</Button>}
        </header>

        {inZone.length > 0 && !final && (
          <div className="flex shrink-0 flex-wrap gap-1.5" aria-live="polite">
            {inZone.map(z => <span key={z.p.id} className="xf-chip animate-zone-pulse rounded-full border-2 border-ink px-2.5 py-0.5 text-micro uppercase">⚡ {z.p.name} in the zone · {z.ability?.triggerShort}</span>)}
          </div>
        )}
        <div className="shrink-0">
          <Scorebug teams={teams} abbr={abbr} score={score} q={final ? (game.overtime ? 5 : 4) : play.q} clock={clock}
            poss={play.off} userSide={userSide} final={final} records={ctx?.records} />
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          {/* Field + ticker + rails */}
          <div className="flex min-h-0 min-w-0 flex-[1.6] flex-col gap-2">
            <div className="relative min-h-[140px] flex-1">
              <Field plays={plays} idx={idx} f={f} teams={teams} abbr={abbr} drive={drive} night={night} />
              {sit && <SituationBadge id={sit} flash={sitFlash} />}
              {showCallout && <Callout play={play} desc={desc} teams={teams} keyId={idx} />}
              {zoneFlash && !showSpotlight && (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
                  <span key={lastZone.t} className="xf-chip animate-bounce-in rounded-full border-[3px] border-ink px-4 py-1.5 font-display text-h2 uppercase shadow-2">⚡ Zone · {zoneFlash.p.name.split(' ').slice(-1)[0]} · {zoneFlash.ability?.name}</span>
                </div>
              )}
              {showSpotlight && (
                <Spotlight key={`s${idx}`} who={star} teamId={starTeamId} desc={desc} line={starLine}
                  rosters={rosters} align={starSide === 1 ? 'left' : 'right'} />
              )}
              {seg?.brk && !final && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <span key={seg.brk} className="toon-sticker animate-bounce-in text-h1 uppercase">{seg.brk} · {abbr[1]} {score[1]} – {abbr[0]} {score[0]}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col justify-center gap-0.5 rounded-card bg-ink px-3 py-1.5 text-chalk">
              <div className="flex items-center gap-3">
                <span className="shrink-0 rounded-full px-2 py-0.5 text-micro font-bold uppercase" style={{ background: color(teams[play.off]), color: onColor(color(teams[play.off])) }}>
                  {abbr[play.off]}
                </span>
                <span className="w-28 shrink-0 text-micro uppercase tabular-nums opacity-70">{situation}</span>
                <p className="min-w-0 flex-1 truncate text-label">{intro ? 'Teams take the field…' : seg?.brk ? seg.brk : desc.text}</p>
              </div>
              <p className="min-h-[1.25rem] truncate text-micro italic opacity-80">
                {!intro && live.booth ? <><span aria-hidden="true">🎙️ </span>{live.booth}</> : ' '}
              </p>
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

        <div className="h-14 shrink-0 rounded-card bg-surface-raised px-2 py-1 shadow-1">
          <WinProbStrip points={model.wpPoints} teams={teams} abbr={abbr} now={elapsedNow} overtime={!!game.overtime}
            potg={model.potg} wpNow={wpNow} />
        </div>

        {intro && (
          <Intro game={game} teams={teams} abbr={abbr} plans={game.pbp?.plans} userSide={userSide} ctx={ctx}
            rosters={rosters} onKickoff={kickoff} />
        )}
        {final && (
          <FinalCard game={game} teams={teams} abbr={abbr} userSide={userSide} others={others}
            onContinue={finish} form={game.pbp?.form} potg={model.potg} rosters={rosters} />
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
