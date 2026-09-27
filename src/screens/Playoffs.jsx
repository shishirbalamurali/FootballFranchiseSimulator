import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import WeekLoadingScreen from '../components/WeekLoadingScreen';
import GameBroadcast from '../components/GameBroadcast';
import { usePreference, SIM_SPEEDS } from '../components/preferences';
import {
  Card, CardHeader, CardBody, Button, Badge, TeamCrest, Modal, Stat,
  EmptyState, cx, IconArrowRight, IconFastForward,
} from '../components/ui';

const ROUND_NAMES = ['', 'Wild card', 'Divisional', 'Conference', 'Super Bowl'];

function getRoundGames(bracket) {
  if (!bracket) return [];
  const { round, afc, nfc, sb } = bracket;
  if (round === 1) return [...afc.wc, ...nfc.wc];
  if (round === 2) return [...afc.div, ...nfc.div];
  if (round === 3) return [...afc.conf, ...nfc.conf];
  if (round === 4) return sb ? [sb] : [];
  return [];
}

function MatchupSide({ team, score, played, won, record, seed, size }) {
  return (
    <div className={cx('flex items-center gap-2 px-3 py-2', played && !won && 'opacity-45')}>
      {seed && <span className="w-3 shrink-0 text-micro tabular-nums text-fg-faint">{seed}</span>}
      <TeamCrest team={team} size="xs" decorative />
      <span className={cx('min-w-0 flex-1 truncate text-label', won ? 'font-bold text-fg' : 'text-fg-secondary')}>
        {team?.abbreviation ?? '—'}
      </span>
      <span className="shrink-0 text-label tabular-nums text-fg-faint">{record}</span>
      <span className={cx('w-6 shrink-0 text-right font-display tabular-nums',
        size === 'lg' ? 'text-h2' : 'text-h3', won ? 'text-fg' : 'text-fg-muted')}>
        {score ?? ''}
      </span>
    </div>
  );
}

// ── One matchup ─────────────────────────────────────────────────────────────
function Matchup({ matchup, userTeamId, standings, seedOf, size = 'md' }) {
  if (!matchup) {
    return (
      <div className={cx(
        'grid place-items-center rounded-card border border-dashed border-line-subtle',
        size === 'lg' ? 'h-[92px] w-64' : 'h-[76px] w-full',
      )}>
        <span className="text-micro uppercase text-fg-faint">To be decided</span>
      </div>
    );
  }
  const home = TEAMS.find(t => t.id === matchup.homeTeamId);
  const away = TEAMS.find(t => t.id === matchup.awayTeamId);
  const rec = (id) => { const s = standings[id]; return s ? `${s.wins}-${s.losses}` : ''; };
  const won = (id) => matchup.played && matchup.winnerId === id;
  const involvesUser = matchup.homeTeamId === userTeamId || matchup.awayTeamId === userTeamId;

  return (
    <div className={cx(
      'overflow-hidden rounded-card border bg-surface-raised',
      involvesUser ? 'border-team' : 'border-line-subtle',
      size === 'lg' ? 'w-64' : 'w-full',
    )}>
      <MatchupSide team={away} score={matchup.awayScore} played={matchup.played}
                   won={won(away?.id)} record={rec(away?.id)} seed={seedOf?.(away?.id)} size={size} />
      <div className="mx-3 h-px bg-line-subtle" />
      <MatchupSide team={home} score={matchup.homeScore} played={matchup.played}
                   won={won(home?.id)} record={rec(home?.id)} seed={seedOf?.(home?.id)} size={size} />
    </div>
  );
}

function BracketColumn({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="mb-2 text-micro uppercase text-fg-faint">{label}</p>
      {/* justify-around spaces later rounds between the games that feed them */}
      <div className="flex flex-1 flex-col justify-around gap-3">{children}</div>
    </div>
  );
}

// ── One conference, flowing left to right toward the Super Bowl ─────────────
// The old layout mirrored the NFC against the AFC, about 1,760px wide, so it
// scrolled sideways on every laptop. Stacked rows fit.
function ConferenceBracket({ name, data, userTeamId, standings }) {
  const seedOf = (id) => {
    const i = data.seeds?.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };
  const byeTeam = TEAMS.find(t => t.id === data.seeds?.[0]);

  return (
    <Card as="section" aria-label={`${name} bracket`}>
      <CardHeader title={name} eyebrow="Conference bracket" />
      <CardBody className="grid grid-cols-3 gap-4">
        <BracketColumn label="Wild card">
          {data.wc.map((m, i) => (
            <Matchup key={i} matchup={m} userTeamId={userTeamId} standings={standings} seedOf={seedOf} />
          ))}
          {byeTeam && (
            <div className="flex items-center gap-2 rounded-card border border-dashed border-line-subtle px-3 py-2">
              <span className="w-3 text-micro tabular-nums text-fg-faint">1</span>
              <TeamCrest team={byeTeam} size="xs" decorative />
              <span className="flex-1 truncate text-label text-fg-secondary">{byeTeam.abbreviation}</span>
              <Badge tone="warning">Bye</Badge>
            </div>
          )}
        </BracketColumn>

        <BracketColumn label="Divisional">
          {(data.div.length ? data.div : [null, null]).map((m, i) => (
            <Matchup key={i} matchup={m} userTeamId={userTeamId} standings={standings} seedOf={seedOf} />
          ))}
        </BracketColumn>

        <BracketColumn label="Championship">
          {(data.conf.length ? data.conf : [null]).map((m, i) => (
            <Matchup key={i} matchup={m} userTeamId={userTeamId} standings={standings} seedOf={seedOf} />
          ))}
        </BracketColumn>
      </CardBody>
    </Card>
  );
}

export default function Playoffs({ onBack, onStartOffseason }) {
  const playoffBracket = useGameStore(s => s.playoffBracket);
  const standings = useGameStore(s => s.standings) || {};
  const simPlayoffRound = useGameStore(s => s.simPlayoffRound);
  const concludeSeason = useGameStore(s => s.concludeSeason);
  const userTeamId = useGameStore(s => s.userTeamId);
  const seasonRecap = useGameStore(s => s.seasonRecap);

  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const [showRecap, setShowRecap] = useState(false);
  // The round is simulated up front so the loading scoreboard shows the real
  // results — it used to animate invented scores that contradicted the bracket.
  const [roundRun, setRoundRun] = useState(null); // { games, scores, result, simAll, watch }
  const simLoading = !!roundRun;
  const simSpeed = usePreference('simSpeed');

  const playRound = (simAll, watch = false) => {
    const before = useGameStore.getState().playoffBracket;
    const games = getRoundGames(before);
    const label = ROUND_NAMES[before?.round] || 'Playoffs';
    const result = simPlayoffRound();
    if (!result) return;
    const b = useGameStore.getState().playoffBracket;
    const all = [...b.afc.wc, ...b.nfc.wc, ...b.afc.div, ...b.nfc.div, ...b.afc.conf, ...b.nfc.conf, b.sb].filter(Boolean);
    const played = games.map(g => all.find(m => m.id === g.id) || g);
    setRoundRun({ games: played, scores: played.map(m => [m.awayScore, m.homeScore]), result, simAll, round: before.round, label, watch });
  };

  const handleSimRoundComplete = () => {
    const run = roundRun;
    setRoundRun(null);
    if (!run) return;
    if (run.result.seasonOver) {
      concludeSeason();
      setTimeout(() => setShowRecap(true), 400);
    } else if (run.simAll && run.result.newRound <= 4) {
      setTimeout(() => playRound(true), 600);
    }
  };

  if (!playoffBracket) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-base p-6">
        <Card className="max-w-md">
          <EmptyState
            icon="🏆"
            title="The playoffs haven't started"
            body="Finish the regular season to set the bracket."
            action="Back to hub"
            onAction={onBack}
          />
        </Card>
      </div>
    );
  }

  const round = playoffBracket.round;
  const roundLabel = round <= 4 ? ROUND_NAMES[round] : 'Complete';
  const isComplete = round > 4 || (round === 4 && playoffBracket.sb?.played);
  const currentGames = getRoundGames(playoffBracket);
  const userAlive = currentGames.some(g =>
    (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) && (!g.played || g.winnerId === userTeamId));
  const userInRound = currentGames.some(g => !g.played && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
  const watchGame = roundRun?.watch && SIM_SPEEDS[simSpeed]
    ? roundRun.games.find(g => (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) && g.pbp) : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-shell">
      {/* ── Immersive header: slim back bar, not a vanished nav ── */}
      <header className="shrink-0 border-b border-line-subtle bg-surface-base">
        <div className="mx-auto flex max-w-content items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}>← Hub</Button>
          <div className="min-w-0 flex-1">
            <p className="text-micro uppercase text-fg-muted">Postseason</p>
            <h1 className="font-display text-h1 uppercase text-fg">{roundLabel}</h1>
          </div>
          {userAlive && <Badge tone="team">{userTeam?.abbreviation} still alive</Badge>}
          {!isComplete && (
            <div className="flex items-center gap-2">
              {userInRound && (
                <Button variant="primary" size="lg" icon={<IconArrowRight size={16} />} onClick={() => playRound(false, true)}>
                  Watch our game
                </Button>
              )}
              <Button
                variant={userInRound ? 'secondary' : 'primary'} size="lg"
                icon={userInRound ? undefined : <IconArrowRight size={16} />}
                onClick={() => playRound(false)}
              >
                {userInRound ? 'Sim all games' : `Play ${roundLabel}`}
              </Button>
              <Button
                variant="ghost" size="sm"
                icon={<IconFastForward size={14} />}
                onClick={() => playRound(true)}
              >
                Sim to the end
              </Button>
            </div>
          )}
          {isComplete && (
            <Button variant="primary" size="lg" iconRight={<IconArrowRight size={16} />}
                    onClick={() => setShowRecap(true)}>
              Season recap
            </Button>
          )}
        </div>
      </header>

      {/* ── Bracket ── */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-4 xl:grid-cols-[1fr_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <ConferenceBracket name="AFC" data={playoffBracket.afc} userTeamId={userTeamId} standings={standings} />
            <ConferenceBracket name="NFC" data={playoffBracket.nfc} userTeamId={userTeamId} standings={standings} />
          </div>

          {/* Super Bowl, centred between the two conference rows */}
          <Card className="flex flex-col items-center gap-3 px-4 py-6 text-center" elevation={2}>
            <span className="text-display" aria-hidden="true">🏆</span>
            <p className="font-display text-h2 uppercase text-fg">Super Bowl</p>
            <Matchup
              matchup={playoffBracket.sb}
              userTeamId={userTeamId}
              standings={standings}
              size="lg"
            />
            {playoffBracket.sb?.played && (
              <Badge tone="warning">
                {TEAMS.find(t => t.id === playoffBracket.sb.winnerId)?.name} win
              </Badge>
            )}
          </Card>
        </div>
      </div>

      {/* ── Round simulation ── */}
      <AnimatePresence>
        {simLoading && watchGame && (
          <GameBroadcast
            game={watchGame}
            title={roundRun.label}
            others={roundRun.games.map((g, i) => ({ g, final: roundRun.scores[i] })).filter(({ g }) => g !== watchGame)}
            duration={SIM_SPEEDS[simSpeed].broadcast}
            onComplete={handleSimRoundComplete}
          />
        )}
        {simLoading && !watchGame && (
          <WeekLoadingScreen
            week={roundRun.round}
            labelOverride={roundRun.label}
            theme={userTeam?.theme}
            onComplete={handleSimRoundComplete}
            games={roundRun.games}
            realScores={roundRun.scores}
            teamRatings={useGameStore.getState().teamRatings}
          />
        )}
      </AnimatePresence>

      {/* ── Season recap ── */}
      <Modal
        open={showRecap && !!seasonRecap}
        onClose={() => setShowRecap(false)}
        size="lg"
        eyebrow={`${seasonRecap?.year ?? ''} season`}
        title="Season complete"
        footer={
          <Button
            variant="primary" size="lg" fullWidth
            iconRight={<IconArrowRight size={16} />}
            onClick={() => { setShowRecap(false); onStartOffseason?.(); }}
          >
            Begin the offseason
          </Button>
        }
      >
        {seasonRecap && (
          <div className="flex flex-col gap-5">
            <div
              className="flex flex-col items-center gap-3 rounded-panel px-6 py-8 text-center"
              style={{ background: 'linear-gradient(160deg, var(--rarity-gold-wash), transparent 70%)' }}
            >
              <span className="text-display" aria-hidden="true">🏆</span>
              <p className="text-micro uppercase text-fg-muted">Champions</p>
              <p className="font-display text-display uppercase text-fg">
                {seasonRecap.champion?.location} {seasonRecap.champion?.name}
              </p>
              {seasonRecap.champion?.id === userTeamId && (
                <Badge tone="warning">That is your franchise</Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'League MVP', player: seasonRecap.awards?.mvp },
                { label: 'Offensive POY', player: seasonRecap.awards?.opoy },
                { label: 'Defensive POY', player: seasonRecap.awards?.dpoy },
              ].map(({ label, player }) => (
                <div key={label} className="rounded-card border border-line-subtle px-4 py-3 text-center">
                  <p className="mb-1 text-micro uppercase text-fg-faint">{label}</p>
                  <p className="truncate text-h3 text-fg">{player?.name ?? '—'}</p>
                  <p className="truncate text-label text-fg-muted">
                    {player?.position}{player?.teamLocation ? ` · ${player.teamLocation}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
