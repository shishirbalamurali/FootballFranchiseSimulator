import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';
import { TeamCrest, Button, cx, alpha, onColor } from './ui';
import { buildScoringTimeline, scoreAt, freshPlay, periodAt } from './scoringPlays';
import { classifyGame } from '../engine/gameStory';
import { usePreference, SIM_SPEEDS } from './preferences';

// "Sim all games": the league scoreboard. Every game gets the same tile —
// the user's included, marked with a ring — and scores tick up along each
// game's real scoring sequence. No play-by-play here; that's what "Watch our
// game" is for. At the whistle each tile names the kind of game it was
// (comeback, shootout, rout…) and the board picks the week's standouts.
// Rules: fits the viewport and never scrolls; always skippable; the user's
// game is the last to go final.

const TEAM = new Map(TEAMS.map(t => [t.id, t]));
const clamp01 = v => Math.min(1, Math.max(0, v));
const teamColor = team => team?.theme?.primary ?? 'var(--ink)';
const FLASH = 0.09;

/** Other games finish staggered across the back half; the user's game is last. */
const tileEnd = (i, n) => (n <= 1 ? 1 : 0.7 + 0.28 * (i / (n - 1)));
const boardColumns = n => (n <= 2 ? Math.max(1, n) : n <= 4 ? 2 : n <= 9 ? 3 : 4);

const TONE_CHIP = {
  drama: 'bg-warning-solid text-ink',
  fire: 'bg-negative-solid text-n-0',
  ice: 'bg-info-solid text-n-0',
  rout: 'bg-ink text-chalk',
  upset: 'bg-negative-solid text-n-0',
  witch: 'bg-witch text-chalk',
  plain: 'bg-surface-sunken text-fg-secondary',
};
const SLOT_SHORT = { TNF: 'TNF', SNF: 'SNF', MNF: 'MNF' };

/** Favorite and line from the stored game context, e.g. "BUF −6.5". */
function lineText(g, away, home) {
  const s = g.ctx?.s;
  if (!Number.isFinite(s) || s === 0) return null;
  return `${(s > 0 ? home : away)?.abbreviation ?? ''} −${Math.abs(s)}`;
}

function Tile({ row, p, big, isUser, standings }) {
  const { g, tl, hasScore, story } = row;
  const away = TEAM.get(g.awayTeamId), home = TEAM.get(g.homeTeamId);
  const [a, h] = hasScore ? scoreAt(tl, p) : [null, null];
  const done = hasScore && p >= 1;
  const fresh = hasScore && p < 1 ? freshPlay(tl, p, FLASH) : null;
  const { label, clock } = hasScore ? periodAt(tl, p) : { label: '—', clock: null };
  const rec = id => {
    const s = standings?.[id];
    return s ? `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ''}` : '';
  };
  const share = hasScore && (a + h) > 0 ? h / (a + h) : 0.5;
  // Live upset alert: the underdog leads in the fourth quarter or overtime.
  const spread = g.ctx?.s;
  const dogLeads = Number.isFinite(spread) && Math.abs(spread) >= 3 && a !== h && (spread > 0 ? a > h : h > a);
  const upsetLive = hasScore && !done && dogLeads && (label === 'Q4' || label === 'OT');
  const storyTone = story && (story.label === 'Witching Hour' ? 'witch' : story.tone);
  const lineTxt = lineText(g, away, home);

  const line = (team, score, side, lost) => (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: teamColor(team) }} />
      <TeamCrest team={team} size={big ? 'md' : 'sm'} decorative />
      <div className="min-w-0 flex-1">
        <p className={cx('truncate font-display uppercase leading-none', big ? 'text-h2' : 'text-h3', lost ? 'text-fg-faint' : 'text-fg')}>
          {team?.abbreviation ?? '???'}
        </p>
        {big && <p className="truncate text-micro text-fg-faint">{team?.name}</p>}
      </div>
      <span className="shrink-0 text-micro tabular-nums text-fg-faint">{rec(team?.id)}</span>
      <span
        className={cx('min-w-[2.4ch] shrink-0 rounded-chip px-1 text-right font-display leading-none tabular-nums',
          big ? 'text-h1' : 'text-h2',
          lost ? 'text-fg-faint' : 'text-fg')}
        // A fresh score lights up in the scoring team's colours
        style={fresh?.side === side ? { background: teamColor(team), color: onColor(teamColor(team)) } : undefined}
      >
        {score ?? '–'}
      </span>
    </div>
  );

  return (
    <div className={cx(
      'relative flex min-h-0 flex-col justify-between gap-1.5 overflow-hidden rounded-card bg-surface-raised px-3 py-2 shadow-1 transition-shadow',
      isUser && 'ring-[3px] ring-team ring-offset-2 ring-offset-surface-shell',
      done && 'shadow-2',
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx('rounded-full px-2 py-0.5 text-micro font-semibold uppercase tabular-nums leading-none',
          done ? 'bg-ink text-chalk' : label === 'OT' ? 'bg-warning-bg text-warning-fg' : 'bg-negative-bg text-negative-fg')}>
          {label}{!done && clock ? ` · ${clock}` : ''}
        </span>
        {!done && (g.ctx?.t || g.ctx?.d || lineTxt) && !upsetLive && (
          <span className="flex min-w-0 items-center gap-1 truncate text-micro font-semibold uppercase tabular-nums text-fg-faint">
            {g.ctx?.t && <span className="rounded-full bg-ink px-1.5 text-chalk">{SLOT_SHORT[g.ctx.t]}</span>}
            {g.ctx?.d && <span className="rounded-full bg-surface-sunken px-1.5 text-fg-secondary">Div</span>}
            {lineTxt && <span>{lineTxt}</span>}
          </span>
        )}
        {upsetLive && <span className="animate-pulse rounded-full bg-negative-solid px-2 py-0.5 text-micro font-bold uppercase leading-none text-n-0">🚨 Upset alert</span>}
        {isUser && !done && !upsetLive && <span className="text-micro font-semibold uppercase text-team-ink">Your game</span>}
        {done && story && (
          <span className={cx('truncate rounded-full px-2 py-0.5 text-micro font-bold uppercase leading-none', TONE_CHIP[storyTone])}>
            {story.label === 'Witching Hour' ? '🌙 ' : ''}{story.label}
          </span>
        )}
      </div>
      {line(away, a, 'away', done && a < h)}
      {line(home, h, 'home', done && h < a)}
      {/* Share of the points on the board, in team colours */}
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="transition-[width] duration-slow" style={{ width: `${(1 - share) * 100}%`, background: alpha(teamColor(away), 0.9) }} />
        <div className="flex-1 transition-[width] duration-slow" style={{ background: alpha(teamColor(home), 0.9) }} />
      </div>
    </div>
  );
}

/** The week's standouts once everything is final. */
function Standouts({ rows }) {
  const done = rows.filter(r => r.hasScore);
  if (!done.length) return null;
  const pick = (score) => done.reduce((best, r) => (score(r) > score(best) ? r : best), done[0]);
  const total = r => r.g.homeScore + r.g.awayScore;
  const margin = r => Math.abs(r.g.homeScore - r.g.awayScore);
  const txt = r => {
    const a = TEAM.get(r.g.awayTeamId), h = TEAM.get(r.g.homeTeamId);
    return `${a?.abbreviation} ${r.g.awayScore} – ${h?.abbreviation} ${r.g.homeScore}`;
  };
  const items = [];
  // The biggest favorite to go down.
  const upsets = done.filter(r => r.story?.upset && Number.isFinite(r.g.ctx?.s));
  if (upsets.length) {
    const u = upsets.reduce((best, r) => (Math.abs(r.g.ctx.s) > Math.abs(best.g.ctx.s) ? r : best), upsets[0]);
    items.push([`${u.g.ctx.d ? 'Division upset' : 'Upset'} of the week`, `${txt(u)} (+${Math.abs(u.g.ctx.s)})`]);
  }
  const comeback = pick(r => r.story?.maxDeficit || 0);
  if ((comeback.story?.maxDeficit || 0) >= 10) items.push(['Biggest comeback', `${txt(comeback)} (down ${comeback.story.maxDeficit})`]);
  const shoot = pick(total);
  items.push(['Most points', txt(shoot)]);
  const close = pick(r => -margin(r) + (r.g.overtime ? 5 : 0));
  items.push([close.g.overtime ? 'Overtime' : 'Closest finish', txt(close)]);
  const rout = pick(margin);
  if (margin(rout) >= 17) items.push(['Biggest rout', txt(rout)]);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {items.slice(0, 4).map(([k, v]) => (
        <span key={k} className="rounded-card bg-surface-raised px-3 py-1 shadow-1">
          <span className="mr-1.5 text-micro uppercase text-fg-faint">{k}</span>
          <span className="text-label font-semibold tabular-nums text-fg">{v}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * @param {number}   week
 * @param {Array}    games        schedule rows for the week being shown
 * @param {Array}    realScores   [[away, home] | null] aligned with games
 * @param {string}   labelOverride  e.g. "Wild Card" for playoff rounds
 * @param {Array}    stretch      multi-week sims: [{ week, result: 'W'|'L'|'T', score }]
 * @param {Function} onComplete
 */
export default function WeekLoadingScreen(props) {
  const speed = usePreference('simSpeed');
  const timing = SIM_SPEEDS[speed];
  if (!timing) return <InstantResult onComplete={props.onComplete} />;
  // Keyed so a speed change mid-sim restarts cleanly instead of jumping.
  return <SimBoard key={speed} {...props} timing={timing} />;
}

/** Instant speed: no scoreboard, straight to the result. */
function InstantResult({ onComplete }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onComplete?.();
  }, [onComplete]);
  return null;
}

function SimBoard({ week, games = [], realScores = null, labelOverride, stretch = null, onComplete, timing }) {
  const { intro: INTRO, game: GAME, hold: HOLD } = timing;
  const TOTAL = INTRO + GAME;
  const userTeamId = useGameStore(s => s.userTeamId);
  const standings = useGameStore(s => s.standings);
  const [t, setT] = useState(0);
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const next = Math.min(1, (now - start) / TOTAL);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF is throttled in hidden tabs; a timer guarantees the screen still ends.
    const failsafe = setTimeout(() => setT(1), TOTAL + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(failsafe); };
  }, [TOTAL]);

  const finished = t >= 1;
  useEffect(() => {
    if (!finished) return undefined;
    const timer = setTimeout(finish, HOLD + 4500);
    return () => clearTimeout(timer);
  }, [finished, finish, HOLD]);

  const gameP = clamp01((t - INTRO / TOTAL) / (GAME / TOTAL));
  const kickoff = t < INTRO / TOTAL;

  // The user's game goes last; everyone else keeps schedule order.
  const rows = useMemo(() => {
    const list = games.map((g, i) => {
      const final = realScores?.[i] || null;
      const hasScore = !!final;
      const row = hasScore ? { ...g, awayScore: final[0], homeScore: final[1] } : g;
      return {
        g: row, hasScore,
        tl: buildScoringTimeline(row, final?.[0], final?.[1]),
        story: hasScore ? classifyGame(row) : null,
        isUser: g.homeTeamId === userTeamId || g.awayTeamId === userTeamId,
      };
    });
    return [...list.filter(r => !r.isUser), ...list.filter(r => r.isUser)];
  }, [games, realScores, userTeamId]);

  const n = rows.length;
  const progressOf = i => (kickoff ? 0 : clamp01(gameP / tileEnd(i, n)));
  const finalsIn = rows.filter((r, i) => r.hasScore && progressOf(i) >= 1).length;
  const title = labelOverride || (stretch?.length > 1 ? `Weeks ${stretch[0].week}–${stretch.at(-1).week}` : `Week ${week}`);
  const big = n <= 6;
  // Display order on the grid is schedule order with the user's game first,
  // so it is easy to find; the timing order above still ends on it.
  const display = useMemo(() => {
    const idx = rows.map((r, i) => ({ r, i }));
    return [...idx.filter(x => x.r.isUser), ...idx.filter(x => !x.r.isUser)];
  }, [rows]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Scoreboard: ${title}`}
    >
      <div aria-hidden="true" className="relative h-2.5 shrink-0 border-b-[3px] border-ink bg-team" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 px-5 py-3">
        <header className="flex shrink-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="toon-sticker inline-block text-micro uppercase">
                {labelOverride ? 'Playoffs' : 'Around the league'}
              </span>
              <span className="text-micro uppercase tabular-nums text-fg-faint">
                {kickoff ? 'Kickoff' : `${finalsIn}/${n} final`}
              </span>
            </div>
            <h1 className="toon-title truncate font-display text-[clamp(30px,4.6vw,58px)] uppercase leading-none text-team-accent">
              {title}
            </h1>
          </div>
          <Button variant={finished ? 'primary' : 'secondary'} onClick={finish}>{finished ? 'Continue →' : 'Skip'}</Button>
        </header>

        {stretch?.length > 1 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {stretch.map(s => (
              <span key={s.week} className={cx('rounded-full px-2.5 py-0.5 text-micro font-semibold tabular-nums shadow-1',
                s.result === 'W' ? 'bg-positive-bg text-positive-fg' : s.result === 'L' ? 'bg-negative-bg text-negative-fg' : 'bg-surface-raised text-fg-muted')}>
                Wk {s.week} · {s.result ? `${s.result} ${s.score}` : 'Bye'}
              </span>
            ))}
          </div>
        )}

        {/* auto-rows-fr + min-h-0: the board shrinks to the space left instead of scrolling */}
        <div
          className={cx('grid min-h-0 flex-1 gap-2.5 overflow-hidden', big ? 'auto-rows-[minmax(0,200px)] content-center' : 'auto-rows-fr')}
          style={{ gridTemplateColumns: `repeat(${boardColumns(n)}, minmax(0, 1fr))` }}
        >
          {display.map(({ r, i }) => (
            <Tile key={r.g.id ?? i} row={r} p={progressOf(i)} big={big} isUser={r.isUser} standings={standings} />
          ))}
        </div>

        {finished ? <Standouts rows={rows} /> : (
          <div className="relative h-3.5 shrink-0 overflow-hidden rounded-full bg-surface-raised shadow-1">
            <div
              className="toon-stripes h-full animate-stripe-slide border-r-[3px] border-ink bg-team transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.round(t * 100)}%` }}
            />
            {[0.25, 0.5, 0.75].map(q => (
              <span key={q} aria-hidden="true" className="absolute inset-y-0 w-px bg-ink opacity-30"
                style={{ left: `${(INTRO / TOTAL + q * (GAME / TOTAL)) * 100}%` }} />
            ))}
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
