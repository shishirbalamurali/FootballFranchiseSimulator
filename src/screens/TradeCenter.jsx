import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { pickKey } from '../engine/draftExperience';
import {
  getPlayerValue, getPickValue, capHitStr, getCapUsed, getTopNeeds,
  evaluateOffer, TRADE_DEADLINE_WEEK,
} from './tradeLogic';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Badge, Modal, Meter,
  TeamCrest, PositionTag, RarityChip, Stat, EmptyState, DataTable,
  cx, useToast, IconSwap,
} from '../components/ui';
import PlayerIdentity from '../components/PlayerIdentity';
import { reputationMultiplier, tradeFallout } from '../engine/character';

// Trade value with reputation: the league pays up for captains and clutch
// players, and marks down hotheads and divas. Only public traits count.
const valueOf = (p) => Math.round(getPlayerValue(p) * reputationMultiplier(p));

const CAP_LIMIT = 200;

// ── An asset chip in a trade slot ───────────────────────────────────────────
function AssetChip({ label, sub, value, onRemove, crest }) {
  return (
    <li className="flex items-center gap-2.5 rounded-card border border-line-subtle bg-surface-sunken px-3 py-2">
      {crest}
      <div className="min-w-0 flex-1">
        <p className="truncate text-label font-semibold text-fg">{label}</p>
        <p className="truncate text-label text-fg-muted">{sub}</p>
      </div>
      <span className="shrink-0 text-label tabular-nums text-fg-faint">{Math.round(value)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} from the trade`}
        className="shrink-0 text-fg-faint transition-colors hover:text-negative-fg"
      >
        ✕
      </button>
    </li>
  );
}

// ── One side of the deal ────────────────────────────────────────────────────
function TradeSide({ title, team, players, picks, onAdd, onRemovePlayer, onRemovePick, disabled, value }) {
  const empty = !players.length && !picks.length;
  return (
    <Card className="flex-1">
      <CardHeader
        title={title}
        eyebrow={team ? `${team.location} ${team.name}` : 'Pick a team'}
        action={team ? <TeamCrest team={team} size="sm" decorative /> : null}
      />
      <CardBody className="flex flex-1 flex-col gap-3">
        {empty ? (
          <div className="grid flex-1 place-items-center rounded-card border border-dashed border-line-subtle py-8">
            <p className="text-label text-fg-faint">Nothing offered yet</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map(p => (
              <AssetChip
                key={p.id}
                label={p.name}
                sub={`${p.position} · ${p.ovr} OVR · ${capHitStr(p)}`}
                value={valueOf(p)}
                onRemove={() => onRemovePlayer(p)}
                crest={<PositionTag position={p.position} />}
              />
            ))}
            {picks.map(pk => (
              <AssetChip
                key={pickKey(pk)}
                label={`Round ${pk.round} pick`}
                sub={pk.year ? `${pk.year} draft` : 'Next draft'}
                value={getPickValue(pk.round, pk.pickNum ?? 16)}
                onRemove={() => onRemovePick(pk)}
                crest={<Badge tone="info">PICK</Badge>}
              />
            ))}
          </ul>
        )}
      </CardBody>
      <div className="flex items-center gap-3 border-t border-line-subtle px-4 py-3">
        <Button variant="secondary" size="sm" onClick={onAdd} disabled={disabled}>
          Add asset
        </Button>
        <span className="ml-auto text-label tabular-nums text-fg-muted">
          Value {Math.round(value)}
        </span>
      </div>
    </Card>
  );
}

export default function TradeCenter() {
  const userTeamId = useGameStore(s => s.userTeamId);
  const standings = useGameStore(s => s.standings);
  const rosters = useGameStore(s => s.rosters);
  const draftPickOwners = useGameStore(s => s.draftPickOwners);
  const teamRatings = useGameStore(s => s.teamRatings);
  const executeTrade = useGameStore(s => s.executeTrade);
  const applyTradeFallout = useGameStore(s => s.applyTradeFallout);
  const week = useGameStore(s => s.week);
  const phase = useGameStore(s => s.phase);
  const toast = useToast();

  const [cpuId, setCpuId] = useState(null);
  const [myPlayers, setMyPlayers] = useState([]);
  const [myPicks, setMyPicks] = useState([]);
  const [theirPlayers, setTheirPlayers] = useState([]);
  const [theirPicks, setTheirPicks] = useState([]);
  const [picker, setPicker] = useState(null);       // 'mine' | 'theirs'
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [verdict, setVerdict] = useState(null);

  const deadlinePassed = phase === 'regular' && week > TRADE_DEADLINE_WEEK;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const cpuTeam = TEAMS.find(t => t.id === cpuId);

  const myRoster = useMemo(() => [...(rosters[userTeamId] || [])].sort((a, b) => b.ovr - a.ovr), [rosters, userTeamId]);
  const cpuRoster = useMemo(() => (cpuId ? [...(rosters[cpuId] || [])].sort((a, b) => b.ovr - a.ovr) : []), [rosters, cpuId]);
  const myPicksOwned = useMemo(() => [...(draftPickOwners?.[userTeamId] || [])].sort((a, b) => a.round - b.round), [draftPickOwners, userTeamId]);
  const cpuPicksOwned = useMemo(() => (cpuId ? [...(draftPickOwners?.[cpuId] || [])].sort((a, b) => a.round - b.round) : []), [draftPickOwners, cpuId]);

  const myValue = useMemo(
    () => myPlayers.reduce((s, p) => s + valueOf(p), 0)
        + myPicks.reduce((s, pk) => s + getPickValue(pk.round, pk.pickNum ?? 16), 0),
    [myPlayers, myPicks]);
  const theirValue = useMemo(
    () => theirPlayers.reduce((s, p) => s + valueOf(p), 0)
        + theirPicks.reduce((s, pk) => s + getPickValue(pk.round, pk.pickNum ?? 16), 0),
    [theirPlayers, theirPicks]);

  const hasItems = myPlayers.length + myPicks.length + theirPlayers.length + theirPicks.length > 0;
  // What this deal does to the locker room you keep, shown before you commit.
  const fallout = useMemo(() => tradeFallout(myPlayers), [myPlayers]);
  const totalValue = myValue + theirValue;
  const balance = totalValue > 0 ? (myValue / totalValue) * 100 : 0;

  // "Will they take it?" — the emotional centre of the screen.
  const likelihood = useMemo(() => {
    if (!cpuId || !hasItems) return null;
    const ratio = myValue / Math.max(1, theirValue * 0.9);
    if (ratio >= 1.05) return { label: 'They will take this', tone: 'positive', pct: 92 };
    if (ratio >= 0.9)  return { label: 'Likely accepted',     tone: 'positive', pct: 74 };
    if (ratio >= 0.72) return { label: 'Close — needs a sweetener', tone: 'warning', pct: 45 };
    if (ratio >= 0.5)  return { label: 'They will say no',    tone: 'negative', pct: 20 };
    return { label: 'They will laugh at this', tone: 'negative', pct: 6 };
  }, [cpuId, hasItems, myValue, theirValue]);

  const cpuNeeds = useMemo(() => (cpuRoster.length ? getTopNeeds(cpuRoster).slice(0, 4) : []), [cpuRoster]);
  const myCapUsed = Math.round(getCapUsed(myRoster));

  const filteredTeams = useMemo(() => {
    const q = teamSearch.toLowerCase();
    return TEAMS.filter(t => t.id !== userTeamId)
      .filter(t => !q || `${t.location} ${t.name} ${t.abbreviation}`.toLowerCase().includes(q));
  }, [teamSearch, userTeamId]);

  const clearTrade = () => {
    setMyPlayers([]); setMyPicks([]); setTheirPlayers([]); setTheirPicks([]); setVerdict(null);
  };

  const submitTrade = () => {
    if (!cpuId || !hasItems) return;
    const result = evaluateOffer({
      offerValue: myValue, receiveValue: theirValue,
      cpuTeamId: cpuId, cpuRoster,
      theirPlayerIds: theirPlayers.map(p => p.id),
      myPlayerIds: myPlayers.map(p => p.id),
      userRoster: myRoster, teamRatings,
    });

    if (result.result === 'accepted') {
      const executed = executeTrade(
        myPlayers.map(p => p.id), myPicks, cpuId,
        theirPlayers.map(p => p.id), theirPicks,
      );
      if (executed === false) {
        setVerdict({ outcome: 'rejected', reason: 'The deadline passed or an asset is no longer available.' });
        return;
      }
      applyTradeFallout?.(myPlayers);
      toast.success({ title: 'Trade accepted', body: `${cpuTeam?.location} agreed to the deal.` });
      setVerdict({ outcome: 'accepted', reason: result.reason });
      clearTrade();
    } else {
      setVerdict({ outcome: 'rejected', reason: result.reason });
    }
  };

  const pickerIsMine = picker === 'mine';
  const pickerRoster = pickerIsMine ? myRoster : cpuRoster;
  const pickerPicks = pickerIsMine ? myPicksOwned : cpuPicksOwned;
  const pickerSelectedIds = new Set((pickerIsMine ? myPlayers : theirPlayers).map(p => p.id));
  const pickerSelectedPicks = new Set((pickerIsMine ? myPicks : theirPicks).map(pickKey));

  const togglePlayer = (p) => {
    const setter = pickerIsMine ? setMyPlayers : setTheirPlayers;
    setter(list => (list.some(x => x.id === p.id) ? list.filter(x => x.id !== p.id) : [...list, p]));
    setVerdict(null);
  };
  const togglePick = (pk) => {
    const setter = pickerIsMine ? setMyPicks : setTheirPicks;
    setter(list => (list.some(x => pickKey(x) === pickKey(pk)) ? list.filter(x => pickKey(x) !== pickKey(pk)) : [...list, pk]));
    setVerdict(null);
  };

  const choosePartner = (id) => {
    setCpuId(id); setTheirPlayers([]); setTheirPicks([]); setVerdict(null); setTeamPickerOpen(false);
  };
  const teamButtons = filteredTeams.map(t => {
    const st = standings?.[t.id];
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => choosePartner(t.id)}
        className={cx(
          'flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-left transition-colors',
          t.id === cpuId ? 'border-team bg-team-16' : 'border-line-subtle hover:bg-surface-hover',
        )}
      >
        <TeamCrest team={t} size="sm" decorative />
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-fg">{t.location}</p>
          <p className="truncate text-label tabular-nums text-fg-muted">{t.abbreviation}{st ? ` · ${st.wins}-${st.losses}` : ''}</p>
        </div>
      </button>
    );
  });

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Trade center"
        eyebrow={
          deadlinePassed
            ? 'Trade deadline has passed'
            : phase === 'regular'
              ? `Deadline after week ${TRADE_DEADLINE_WEEK} · ${TRADE_DEADLINE_WEEK - week + 1} weeks left`
              : 'Offseason trading open'
        }
        team={userTeam}
        actions={
          <div className="flex items-center gap-3">
            <Stat size="sm" value={`$${CAP_LIMIT - myCapUsed}M`} label="Your cap space" align="right" />
            {hasItems && <Button variant="ghost" size="sm" onClick={clearTrade}>Clear</Button>}
          </div>
        }
      />

      <div className="mx-auto max-w-content px-6 py-6">
        {deadlinePassed && (
          <Card className="mb-4">
            <CardBody>
              <p className="text-label text-warning-fg">
                The trade deadline passed in week {TRADE_DEADLINE_WEEK}. Trading reopens in the offseason.
              </p>
            </CardBody>
          </Card>
        )}

        {/* ── Partner ── */}
        {cpuTeam && (
        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center gap-4">
            <TeamCrest team={userTeam} size="md" />
            <div className="min-w-0">
              <p className="text-micro uppercase text-fg-faint">Your franchise</p>
              <p className="text-h3 text-fg">{userTeam?.location} {userTeam?.name}</p>
            </div>

            <IconSwap size={22} className="mx-2 shrink-0 text-fg-faint" />

            {cpuTeam ? (
              <>
                <TeamCrest team={cpuTeam} size="md" />
                <div className="min-w-0">
                  <p className="text-micro uppercase text-fg-faint">Trading with</p>
                  <p className="text-h3 text-fg">{cpuTeam.location} {cpuTeam.name}</p>
                </div>
              </>
            ) : (
              <p className="text-label text-fg-muted">No trade partner selected</p>
            )}

            <div className="ml-auto flex items-center gap-2">
              {cpuNeeds.length > 0 && (
                <div className="hidden items-center gap-1.5 md:flex">
                  <span className="text-micro uppercase text-fg-faint">They need</span>
                  {cpuNeeds.map(n => <Badge key={n.pos} tone="info">{n.pos}</Badge>)}
                </div>
              )}
              <Button variant="secondary" onClick={() => setTeamPickerOpen(true)}>
                {cpuTeam ? 'Change team' : 'Choose a team'}
              </Button>
            </div>
          </CardBody>
        </Card>
        )}

        {/* No partner yet: pick one right here instead of opening a modal
            over an empty builder. */}
        {!cpuTeam && (
          <Card className="mb-4">
            <CardHeader title="Pick a trade partner" eyebrow="31 clubs"
              action={
                <input
                  type="search"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Search teams…"
                  aria-label="Search teams"
                  className="h-9 w-56 rounded-card border border-line bg-surface-sunken px-3 text-label text-fg placeholder:text-fg-faint"
                />
              } />
            <CardBody className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">{teamButtons}</CardBody>
          </Card>
        )}

        {/* ── Builder ── */}
        {cpuTeam && <>
        <div className="flex flex-col gap-4 lg:flex-row">
          <TradeSide
            title="You send"
            team={userTeam}
            players={myPlayers}
            picks={myPicks}
            value={myValue}
            disabled={deadlinePassed}
            onAdd={() => setPicker('mine')}
            onRemovePlayer={p => { setMyPlayers(l => l.filter(x => x.id !== p.id)); setVerdict(null); }}
            onRemovePick={pk => { setMyPicks(l => l.filter(x => pickKey(x) !== pickKey(pk))); setVerdict(null); }}
          />
          <TradeSide
            title="You receive"
            team={cpuTeam}
            players={theirPlayers}
            picks={theirPicks}
            value={theirValue}
            disabled={deadlinePassed || !cpuId}
            onAdd={() => setPicker('theirs')}
            onRemovePlayer={p => { setTheirPlayers(l => l.filter(x => x.id !== p.id)); setVerdict(null); }}
            onRemovePick={pk => { setTheirPicks(l => l.filter(x => pickKey(x) !== pickKey(pk))); setVerdict(null); }}
          />
        </div>

        {/* ── Verdict: the emotional centrepiece ── */}
        <Card className="mt-4" elevation={2}>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-micro uppercase text-fg-faint">Trade balance</p>
                <p className="font-display text-h2 text-fg">
                  {likelihood ? likelihood.label : 'Build an offer to see how they react'}
                </p>
              </div>
              {likelihood && (
                <Badge tone={likelihood.tone}>{likelihood.pct}% likely</Badge>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-label tabular-nums">
                <span className="text-fg-secondary">You send {Math.round(myValue)}</span>
                <span className="text-fg-secondary">{Math.round(theirValue)} you receive</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                {totalValue > 0 && (
                  <>
                    <div className="h-full transition-[width] duration-slow ease-out"
                         style={{ width: `${balance}%`, backgroundColor: userTeam?.theme?.primary }} />
                    <div className="h-full flex-1"
                         style={{ backgroundColor: cpuTeam?.theme?.primary ?? 'var(--n-700)' }} />
                  </>
                )}
              </div>
            </div>

            {fallout.notes.length > 0 && (
              <div className={cx('rounded-card px-3.5 py-2.5 text-label',
                fallout.moraleDelta < 0 ? 'bg-warning-bg text-warning-fg' : 'bg-positive-bg text-positive-fg')}>
                <p className="font-semibold">
                  Locker room: team morale {fallout.moraleDelta > 0 ? '+' : ''}{fallout.moraleDelta}
                </p>
                <ul className="mt-0.5">
                  {fallout.notes.map(n => <li key={n.text}>{n.text}</li>)}
                </ul>
              </div>
            )}

            {verdict && (
              <div className={cx(
                'rounded-card border px-4 py-3',
                verdict.outcome === 'accepted'
                  ? 'border-positive-border bg-positive-bg'
                  : 'border-negative-border bg-negative-bg',
              )}>
                <p className={cx('text-label font-semibold',
                  verdict.outcome === 'accepted' ? 'text-positive-fg' : 'text-negative-fg')}>
                  {verdict.outcome === 'accepted' ? 'Trade accepted' : 'Offer rejected'}
                </p>
                {/* The reason is the difference between a negotiation and a black box. */}
                <p className="mt-0.5 text-label text-fg-secondary">{verdict.reason}</p>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!cpuId || !hasItems || deadlinePassed}
              onClick={submitTrade}
            >
              Propose trade
            </Button>
          </CardBody>
        </Card>
        </>}
      </div>

      {/* ── Team picker ── */}
      <Modal
        open={teamPickerOpen}
        onClose={() => setTeamPickerOpen(false)}
        title="Choose a trade partner"
        size="lg"
      >
        <input
          type="search"
          value={teamSearch}
          onChange={e => setTeamSearch(e.target.value)}
          placeholder="Search teams…"
          aria-label="Search teams"
          className="mb-4 h-10 w-full rounded-card border border-line bg-surface-sunken px-3 text-label text-fg placeholder:text-fg-faint"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{teamButtons}</div>
      </Modal>

      {/* ── Asset picker ── */}
      <Modal
        open={!!picker}
        onClose={() => setPicker(null)}
        size="xl"
        eyebrow={pickerIsMine ? 'Your assets' : `${cpuTeam?.location ?? ''} assets`}
        title="Add to the trade"
        footer={<Button variant="primary" onClick={() => setPicker(null)}>Done</Button>}
      >
        <div className="flex flex-col gap-5">
          {pickerPicks.length > 0 && (
            <div>
              <p className="mb-2 text-micro uppercase text-fg-faint">Draft picks</p>
              <div className="flex flex-wrap gap-2">
                {pickerPicks.map(pk => {
                  const on = pickerSelectedPicks.has(pickKey(pk));
                  return (
                    <button
                      key={pickKey(pk)}
                      type="button"
                      onClick={() => togglePick(pk)}
                      className={cx(
                        'rounded-card border px-3 py-2 text-label transition-colors',
                        on ? 'border-team bg-team-16 text-fg' : 'border-line-subtle text-fg-secondary hover:bg-surface-hover',
                      )}
                    >
                      Round {pk.round}
                      <span className="ml-2 tabular-nums text-fg-faint">
                        {Math.round(getPickValue(pk.round, pk.pickNum ?? 16))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-micro uppercase text-fg-faint">Players</p>
            {pickerRoster.length ? (
              <DataTable
                rows={pickerRoster}
                caption="Available players"
                initialSort={{ id: 'ovr', dir: 'desc' }}
                onRowClick={togglePlayer}
                highlightRow={p => pickerSelectedIds.has(p.id)}
                dense
                columns={[
                  { id: 'pos', header: 'Pos', width: '62px', accessor: p => p.position, cell: p => <PositionTag position={p.position} /> },
                  { id: 'name', header: 'Player', accessor: p => p.name, cell: p => <PlayerIdentity player={p} teamId={pickerIsMine ? userTeamId : cpuId} own={pickerIsMine} size="xs" /> },
                  { id: 'age', header: 'Age', accessor: p => p.age, numeric: true, align: 'right', width: '58px' },
                  { id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '126px', cell: p => <RarityChip ovr={p.ovr} /> },
                  { id: 'cap', header: 'Cap hit', accessor: p => p.contract?.salary ?? 2, numeric: true, align: 'right', width: '88px', cell: p => capHitStr(p) },
                  { id: 'value', header: 'Value', accessor: p => valueOf(p), numeric: true, align: 'right', width: '80px',
                    cell: p => <span className="tabular-nums">{valueOf(p)}</span> },
                  { id: 'sel', header: '', sortable: false, align: 'right', width: '48px',
                    cell: p => (pickerSelectedIds.has(p.id) ? <Badge tone="team">In</Badge> : null) },
                ]}
              />
            ) : (
              <EmptyState size="sm" icon="👥" title="No players available" />
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
