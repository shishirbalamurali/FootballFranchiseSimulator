import { useMemo } from 'react';
import { XFactorMoments } from '../../components/frontOffice/XFactorMatchup'; // CLAUDE
import { TEAMS } from '../../data/teams';
import { getTopPerformers } from './hubData';
import { WeeklyGameReview } from '../../components/WeeklyPreparation';
import { readPbp, describePlay, classifyGame, periodLabel, clockText, creditSide } from '../../engine/gameStory';
import {
  Modal, Button, Badge, TeamCrest, PositionTag, Stat, cx, scoreToGrade,
} from '../../components/ui';

// Summarize a standout performance from aggregate game stats.
function getPlayOfTheGame(game, userTeamId, rosters) {
    const userIsHome = game.homeTeamId === userTeamId;
    const stats = userIsHome ? game.playerStats?.home : game.playerStats?.away;
    if (!stats) return null;
    const roster = rosters[userTeamId] || [];
    let best = null, bestScore = 0;
    Object.entries(stats).forEach(([pid, s]) => {
        const p = roster.find(pl => pl.id === pid);
        if (!p) return;
        if (p.position === 'QB' && (s.yards || 0) > 250 && (s.yards || 0) > bestScore) {
            best = { text: `${p.name} shredded the defense for ${s.yards} yards and ${s.tds || 0} touchdowns.`, icon: '🎯' };
            bestScore = s.yards;
        }
        if (['RB','FB'].includes(p.position) && ((s.rushYards||s.yards||0) > 100) && (s.rushYards||s.yards||0) > bestScore) {
            best = { text: `${p.name} dominated on the ground with ${s.rushYards||s.yards} rushing yards.`, icon: '🏃' };
            bestScore = s.rushYards || s.yards;
        }
        if (['WR','TE'].includes(p.position) && (s.recYards||0) > 80 && (s.recYards||0) > bestScore) {
            best = { text: `${p.name} torched the secondary for ${s.recYards} yards on ${s.receptions || 0} receptions.`, icon: '⚡' };
            bestScore = s.recYards;
        }
        if (['DL', 'DE', 'DT', 'LB', 'MLB', 'OLB', 'CB', 'S', 'FS', 'SS'].includes(p.position) && (s.sacks||0) >= 2) {
            best = { text: `${p.name} was a menace with ${s.sacks} sacks and ${s.tackles || 0} tackles.`, icon: '💥' };
            bestScore = 9999;
        }
    });
    return best;
}

// Grade a player based on their game stats
function gradePlayer(player, stats, isWin) {
    let score = 50; // baseline
    const pos = player.position;

    if (pos === 'QB') {
        const yds = stats.yards || 0;
        const tds = stats.tds || 0;
        const ints = stats.ints || 0;
        const cmp = stats.completions || 0;
        const att = stats.attempts || 1;
        const cmpPct = cmp / att;
        score = 50 + (yds - 250) * 0.04 + (tds - 1) * 8 - ints * 10 + (cmpPct - 0.62) * 80;
    } else if (['RB', 'FB'].includes(pos)) {
        const yds = stats.rushYards || 0;
        const tds = stats.rushTds || 0;
        const rec = stats.receptions || 0;
        score = 50 + (yds - 60) * 0.06 + (tds - 0.5) * 8 + rec * 1.5;
    } else if (['WR', 'TE'].includes(pos)) {
        const yds = stats.recYards || 0;
        const tds = stats.recTds || 0;
        const rec = stats.receptions || 0;
        score = 50 + (yds - 50) * 0.08 + (tds - 0.3) * 10 + (rec - 3) * 2;
    } else if (['DL', 'DE', 'DT'].includes(pos)) {
        score = 50 + (stats.sacks || 0) * 12 + (stats.tackles || 0) * 1.5 + (stats.tfl || 0) * 5;
    } else if (['LB', 'MLB', 'OLB'].includes(pos)) {
        score = 50 + (stats.tackles || 0) * 2.2 + (stats.sacks || 0) * 10 + (stats.tfl || 0) * 4 + (stats.ints || 0) * 12;
    } else if (['CB', 'S', 'FS', 'SS'].includes(pos)) {
        score = 50 + (stats.tackles || 0) * 1.8 + (stats.ints || 0) * 15 + (stats.pd || 0) * 5;
    } else {
        score = 60; // OL/K — assume solid
    }

    if (isWin) score += 4;

    score = Math.max(0, Math.min(100, score));
    return scoreToGrade(score);
}

const STORY_TONE = { drama: 'warning', fire: 'negative', ice: 'info', rout: 'neutral', plain: 'neutral' };
const PLAY_RANK = { score: 3, turnover: 3, defense: 2, big: 2, plain: 0 };

/** Line score by quarter, story tags, and the plays that decided it. */
function GameStory({ game, teams }) {
  const story = useMemo(() => classifyGame(game), [game]);
  const keyPlays = useMemo(() => {
    const abbr = [teams.home?.abbreviation ?? 'HOME', teams.away?.abbreviation ?? 'AWAY'];
    const plays = readPbp(game.pbp);
    const picked = plays
      .map(p => ({ p, d: describePlay(p, abbr) }))
      .filter(({ d }) => d.key && (PLAY_RANK[d.tone] ?? 0) >= 2 && d.tag !== 'PASS BREAKUP');
    // Every score and turnover, then the biggest defensive and chunk plays, in game order
    const must = picked.filter(x => PLAY_RANK[x.d.tone] === 3);
    const rest = picked.filter(x => PLAY_RANK[x.d.tone] === 2).slice(0, Math.max(0, 10 - must.length));
    return [...must, ...rest].sort((a, b) => a.p.idx - b.p.idx).slice(0, 12);
  }, [game.pbp, teams]);
  const q = game.quarters;
  const cols = q ? q[0].map((_, i) => (i < 4 ? `Q${i + 1}` : 'OT')) : [];
  const rowFor = (team, side) => (
    <tr key={side} className="border-b border-line-subtle last:border-0">
      <td className="py-1 pr-3"><span className="flex items-center gap-2"><TeamCrest team={team} size="xs" decorative /><span className="text-label font-semibold text-fg">{team?.abbreviation}</span></span></td>
      {q[side === 'home' ? 0 : 1].map((v, i) => <td key={i} className="px-2 text-center text-label tabular-nums text-fg-secondary">{v}</td>)}
      <td className="pl-3 text-right font-display text-h3 tabular-nums text-fg">{side === 'home' ? game.homeScore : game.awayScore}</td>
    </tr>
  );
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-micro uppercase text-fg-faint">Game story</h3>
        {story.tags.map(t => <Badge key={t} tone={t === story.label ? STORY_TONE[story.tone] : 'neutral'}>{t}</Badge>)}
        {story.blurb && <span className="text-label text-fg-muted">{story.blurb}</span>}
      </div>
      {q && (
        <table className="w-full">
          <thead>
            <tr className="text-micro uppercase text-fg-faint">
              <th className="pb-1 text-left font-normal" />
              {cols.map(c => <th key={c} className="px-2 pb-1 font-normal">{c}</th>)}
              <th className="pb-1 pl-3 text-right font-normal">T</th>
            </tr>
          </thead>
          <tbody>{rowFor(teams.away, 'away')}{rowFor(teams.home, 'home')}</tbody>
        </table>
      )}
      {keyPlays.length > 0 && (
        <ol className="flex flex-col">
          {keyPlays.map(({ p, d }) => {
            const team = creditSide(p, d) === 0 ? teams.home : teams.away;
            return (
              <li key={p.idx} className="flex gap-2.5 border-b border-line-subtle py-1.5 last:border-0">
                <span className="w-1 shrink-0 rounded-full" style={{ background: team?.theme?.primary }} />
                <span className="w-16 shrink-0 text-micro tabular-nums text-fg-faint">{periodLabel(p.q)} {clockText(p.clock)}</span>
                <span className="min-w-0 flex-1 text-label text-fg-secondary">
                  <b className="mr-1.5 text-micro uppercase text-fg">{d.tag}</b>{d.text}
                </span>
                <span className="shrink-0 text-micro tabular-nums text-fg-faint">{p.as}–{p.hs}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── Enhanced Game Summary Modal ──
function GameSummaryModal({ game, userTeamId, teamData, rosters, objectives, completedObjectives, onClose }) {
  const isWin = game.winnerId === userTeamId;
  const isTie = game.winnerId === null;
  const userIsHome = game.homeTeamId === userTeamId;
  const userScore = userIsHome ? game.homeScore : game.awayScore;
  const oppScore = userIsHome ? game.awayScore : game.homeScore;
  const oppTeam = TEAMS.find(t => t.id === (userIsHome ? game.awayTeamId : game.homeTeamId));

  const resultTone = isWin ? 'positive' : isTie ? 'warning' : 'negative';
  const resultColor = `var(--${resultTone}-fg)`;
  const resultLabel = isWin ? 'Victory' : isTie ? 'Tie game' : 'Defeat';

  const { topQB, topRB, topWR } = getTopPerformers(game, userTeamId, rosters);
  const performers = [topQB, topRB, topWR].filter(Boolean);
  const playOfGame = getPlayOfTheGame(game, userTeamId, rosters);

  const userStats = userIsHome ? game.playerStats?.home : game.playerStats?.away;
  const playerGrades = useMemo(() => {
    if (!userStats) return [];
    const roster = rosters[userTeamId] || [];
    const keyPositions = ['QB', 'RB', 'WR', 'TE', 'LB', 'CB', 'DL', 'DE', 'DT', 'S'];
    const seen = new Set();
    const graded = [];
    keyPositions.forEach(pos => {
      roster
        .filter(p => p.position === pos && userStats[p.id])
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, pos === 'WR' ? 2 : 1)
        .forEach(p => {
          if (seen.has(p.id)) return;
          seen.add(p.id);
          graded.push({ player: p, grade: gradePlayer(p, userStats[p.id], isWin) });
        });
    });
    const order = { 'A+': 0, A: 1, 'B+': 2, B: 3, 'C+': 4, C: 5, D: 6, F: 7 };
    return graded.sort((a, b) => (order[a.grade.letter] ?? 8) - (order[b.grade.letter] ?? 8));
  }, [userStats, rosters, userTeamId, isWin]);

  const myStats = userIsHome ? game.stats?.home : game.stats?.away;
  const theirStats = userIsHome ? game.stats?.away : game.stats?.home;
  const statRows = myStats && theirStats
    ? [
        ['Total yards', myStats.totalYards ?? myStats.yards, theirStats.totalYards ?? theirStats.yards],
        ['Passing yards', myStats.passYards, theirStats.passYards],
        ['Rushing yards', myStats.rushYards, theirStats.rushYards],
        ['First downs', myStats.firstDowns, theirStats.firstDowns],
        ['Sacks taken', myStats.sacks, theirStats.sacks, true],
        ['Turnovers', myStats.turnovers, theirStats.turnovers, true],
      ].filter(r => r[1] != null && r[2] != null)
    : [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      eyebrow={`Week ${game.week ?? ''} final`}
      title={resultLabel}
      footer={<Button variant="primary" size="lg" fullWidth onClick={onClose}>Continue</Button>}
    >
      <div className="flex flex-col gap-6">
        {/* ── Scoreline ── */}
        <div
          className="flex items-center justify-center gap-8 rounded-panel px-6 py-6"
          style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${resultColor} 16%, transparent), transparent 66%)` }}
        >
          <div className="flex flex-col items-center gap-2">
            <TeamCrest team={teamData} size="lg" />
            <span className="text-micro uppercase text-fg-muted">{teamData?.abbreviation}</span>
          </div>
          <div className="text-center">
            <p className="font-display text-hero leading-none tabular-nums" style={{ color: resultColor }}>
              {userScore}<span className="mx-3 text-fg-faint">–</span>{oppScore}
            </p>
            <Badge tone={resultTone} className="mt-2">{resultLabel}</Badge>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TeamCrest team={oppTeam} size="lg" />
            <span className="text-micro uppercase text-fg-muted">{oppTeam?.abbreviation}</span>
          </div>
        </div>

        {(game.quarters || game.pbp) && (
          <GameStory
            game={game}
            teams={{
              home: TEAMS.find(t => t.id === game.homeTeamId),
              away: TEAMS.find(t => t.id === game.awayTeamId),
            }}
          />
        )}

        <XFactorMoments game={game} />

        <WeeklyGameReview review={game.weeklyReview} userTeamId={userTeamId} />

        {playOfGame && (
          <div className="rounded-card bg-surface-sunken px-4 py-3">
            <p className="mb-1 text-micro uppercase text-fg-faint">Standout performance</p>
            <p className="text-body text-fg-secondary">
              <span aria-hidden="true" className="mr-1.5">{playOfGame.icon}</span>
              {playOfGame.text}
            </p>
          </div>
        )}

        {/* ── Objectives ── */}
        {objectives?.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-micro uppercase text-fg-faint">
              Objectives · {completedObjectives.length} of {objectives.length}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {objectives.map(o => {
                const done = completedObjectives.includes(o.id);
                return (
                  <li key={o.id} className="flex items-center gap-3">
                    <span className={cx(
                      'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                      done ? 'border-positive-fg bg-positive-fg text-n-950' : 'border-line text-transparent',
                    )}>✓</span>
                    <span className={cx('text-label', done ? 'text-fg-muted line-through' : 'text-fg')}>
                      {o.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Team stats ── */}
        {statRows.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Team stats</h3>
            <ul>
              {statRows.map(([label, mine, theirs, lowerBetter]) => {
                const iWin = lowerBetter ? mine < theirs : mine > theirs;
                return (
                  <li key={label} className="flex items-center border-b border-line-subtle py-2 last:border-0">
                    <span className={cx('w-20 text-label tabular-nums', iWin ? 'font-bold text-positive-fg' : 'text-fg-secondary')}>{mine}</span>
                    <span className="flex-1 text-center text-micro uppercase text-fg-faint">{label}</span>
                    <span className={cx('w-20 text-right text-label tabular-nums', !iWin && mine !== theirs ? 'font-bold text-fg' : 'text-fg-secondary')}>{theirs}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Top performers ── */}
        {performers.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Top performers</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {performers.map(p => (
                <div key={p.id} className="rounded-card border border-line-subtle px-3 py-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <PositionTag position={p.position} />
                    <span className="truncate text-label font-semibold text-fg">{p.name}</span>
                  </div>
                  <p className="text-label tabular-nums text-fg-muted">
                    {p.position === 'QB' && `${p.gs.yards ?? 0} yds · ${p.gs.tds ?? 0} TD`}
                    {['RB', 'FB'].includes(p.position) && `${p.gs.rushYards ?? p.gs.yards ?? 0} rush yds · ${p.gs.rushTds ?? p.gs.tds ?? 0} TD`}
                    {['WR', 'TE'].includes(p.position) && `${p.gs.receptions ?? 0} rec · ${p.gs.recYards ?? 0} yds`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Player grades ── */}
        {playerGrades.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Player grades</h3>
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {playerGrades.slice(0, 10).map(({ player, grade }) => (
                <li key={player.id} className="flex items-center gap-3 border-b border-line-subtle py-2">
                  <PositionTag position={player.position} />
                  <span className="min-w-0 flex-1 truncate text-label text-fg-secondary">{player.name}</span>
                  <span className="font-display text-h3" style={{ color: grade.color }}>{grade.letter}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default GameSummaryModal;
