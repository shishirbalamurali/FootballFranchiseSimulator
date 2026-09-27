import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { getRosterBadge } from './freeAgencyLogic';
import {
  FA_DAYS, DAY_LABELS, SALARY_CAP, askOf, preferredYears, assessOffer, offerBudget, marketSuitors,
} from '../engine/faMarket';
import { ROSTER_LIMIT, POSITION_MINIMUMS } from '../engine/player';
import { rookieReserve } from '../engine/cpuRosterManagement';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Badge, Meter, Stat, ConfirmModal,
  FilterChips, SegmentedControl, PositionTag, RarityChip, EmptyState, TeamCrest,
  DataTable, cx, useToast, IconArrowRight,
} from '../components/ui';
import PlayerFace from '../components/PlayerFace';
import { PlayerNameLine, ReputationBadges } from '../components/PlayerIdentity';

// Free agency is a four-day market. Offers go out, then the day resolves all
// at once: players weigh your offer against rival suitors, rival clubs sign
// who they can afford, and whoever is left gets cheaper. Outside the offseason
// market the leftovers simply sign at their ask.

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
const TEAM_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
const money = v => `$${Math.round(v * 10) / 10}M`;

const VERDICT_TONE = {
  'Very likely': 'var(--positive-fg)',
  Likely: 'var(--positive-fg)',
  'Toss-up': 'var(--warning-fg)',
  Unlikely: 'var(--negative-fg)',
  'Won’t consider': 'var(--negative-fg)',
};

function heat(count) {
  if (count >= 5) return { label: 'Hot', tone: 'negative' };
  if (count >= 2) return { label: 'Warm', tone: 'warning' };
  if (count === 1) return { label: '1 club', tone: 'info' };
  return { label: 'Quiet', tone: 'neutral' };
}

// ── Market day stepper ───────────────────────────────────────────────────────
function DayStepper({ day, closed }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Free agency calendar">
      {DAY_LABELS.map((label, i) => {
        const done = closed || i < day;
        const current = !closed && i === day;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cx(
                'flex items-center gap-2 rounded-full px-3 py-1 text-label toon-outline',
                current ? 'bg-team text-team-on font-bold' : done ? 'bg-surface-sunken text-fg-muted' : 'bg-surface-raised text-fg-secondary',
              )}
              aria-current={current ? 'step' : undefined}
            >
              <span className="tabular-nums">{done ? '✓' : i + 1}</span>
              {label}
            </span>
            {i < DAY_LABELS.length - 1 && <span aria-hidden="true" className="h-0.5 w-4 bg-line" />}
          </li>
        );
      })}
      <li className="ml-2 text-label text-fg-muted">
        {closed ? 'Market closed. Rival clubs fill out their depth before the draft.' : 'Offers resolve when the day ends.'}
      </li>
    </ol>
  );
}

// ── Offer builder (remounted per player via key) ─────────────────────────────
function OfferBuilder({ fa, existing, floor, suitorCount, budget, userTeamId, userRoster, standings, onPlace, onWithdraw }) {
  const ask = askOf(fa);
  const pref = preferredYears(fa);
  const [salary, setSalary] = useState(existing?.salary ?? Math.max(ask, Math.ceil(floor || 0)));
  const [years, setYears] = useState(existing?.years ?? pref);
  const read = assessOffer(fa, { salary, years }, { userTeamId, userRoster, standings, suitorCount, floor });
  const maxSalary = Math.max(5, Math.round(ask * 2), Math.ceil((floor || 0) * 1.5));
  const overBudget = salary > budget.space;
  const noSpot = !existing && budget.openSpots <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-6 rounded-card bg-surface-sunken px-4 py-3">
        <Stat size="sm" value={money(ask)} label={ask < (fa.openingAsk ?? ask) ? `Ask (was ${money(fa.openingAsk)})` : 'Asking'} />
        <Stat size="sm" value={`${pref} yr${pref === 1 ? '' : 's'}`} label="Wants" />
        <Stat size="sm" value={suitorCount} label="Rival suitors" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between text-label text-fg-secondary">
          Annual salary
          <span className="flex items-center gap-2">
            <Button size="sm" variant="ghost" aria-label="Lower salary" onClick={() => setSalary(v => Math.max(1, v - 1))}>−</Button>
            <span className="w-16 text-center text-h3 tabular-nums text-fg">{money(salary)}</span>
            <Button size="sm" variant="ghost" aria-label="Raise salary" onClick={() => setSalary(v => Math.min(maxSalary, v + 1))}>+</Button>
          </span>
        </span>
        <input
          type="range" min={1} max={maxSalary} value={salary}
          onChange={e => setSalary(Number(e.target.value))}
          aria-label="Annual salary"
          className="w-full accent-[var(--team-primary)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label text-fg-secondary">Contract length</span>
        <SegmentedControl
          size="sm" label="Contract length" value={String(years)} onChange={v => setYears(Number(v))}
          items={[1, 2, 3, 4, 5, 6].map(y => ({ id: String(y), label: y === pref ? `${y}★` : String(y) }))}
        />
      </div>

      <div>
        <Meter
          label="Chance he signs with you"
          caption={read.verdict}
          value={Math.round(read.chance * 100)}
          color={VERDICT_TONE[read.verdict]}
        />
        {read.reason && <p className="mt-1.5 text-label text-fg-muted">{read.reason}</p>}
      </div>

      <div className="flex items-center gap-3">
        <p className="flex-1 text-label text-fg-muted">
          Total <span className="tabular-nums text-fg">{money(salary * years)}</span>
          {overBudget && <span className="text-negative-fg"> · only {money(budget.space)} free</span>}
          {noSpot && <span className="text-negative-fg"> · roster full</span>}
        </p>
        {existing && <Button variant="ghost" size="sm" onClick={onWithdraw}>Withdraw</Button>}
        <Button
          variant="primary"
          disabled={overBudget || noSpot || read.chance === 0}
          onClick={() => onPlace(salary, years)}
        >
          {existing ? 'Update offer' : 'Place offer'}
        </Button>
      </div>
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function PlayerPanel({ fa, children, watched, onWatch }) {
  return (
    <Card>
      <div
        className="flex items-center gap-4 px-5 py-5"
        style={{ background: 'linear-gradient(135deg, var(--team-tint-16), transparent 70%)' }}
      >
        <PlayerFace player={fa} teamId="FA" size="lg" variant="portrait" lazy={false} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <PositionTag position={fa.position} />
            <span className="text-label text-fg-muted">Age {fa.age}</span>
            {fa.isUndrafted && <Badge tone="info">Undrafted rookie</Badge>}
          </div>
          <p className="truncate font-display text-h1 uppercase text-fg">{fa.name}</p>
          <p className="truncate text-label text-fg-muted">{fa.archetype || fa.note}</p>
          <ReputationBadges player={fa} className="mt-2" />
        </div>
        <RarityChip ovr={fa.ovr} />
      </div>
      <CardBody className="flex flex-col gap-4">
        {fa.attributes?.position && Object.keys(fa.attributes.position).length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(fa.attributes.position)
              .sort(([, a], [, b]) => b - a).slice(0, 4)
              .map(([k, v]) => (
                <Meter key={k} size="sm" value={v} caption={v} label={k.replace(/([A-Z])/g, ' $1').trim()} />
              ))}
          </div>
        )}
        {children}
      </CardBody>
      <div className="border-t border-line-subtle px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onWatch}>{watched ? '★ Watching' : '☆ Watch'}</Button>
      </div>
    </Card>
  );
}

// ── Market wire ──────────────────────────────────────────────────────────────
function MarketWire({ log, userTeamId }) {
  const [showRivals, setShowRivals] = useState(true);
  const entries = (log || []).filter(e => showRivals || e.kind !== 'rival').slice(0, 60);
  if (!log?.length) return null;
  return (
    <Card>
      <CardHeader
        title="Market wire"
        action={
          <Button variant="ghost" size="sm" onClick={() => setShowRivals(v => !v)}>
            {showRivals ? 'Only my moves' : 'Show rival moves'}
          </Button>
        }
      />
      <ul className="max-h-[360px] divide-y divide-line-subtle overflow-y-auto">
        {entries.map((e, i) => {
          const team = e.teamId ? TEAM_BY_ID.get(e.teamId) : null;
          const mine = e.kind === 'user' || e.teamId === userTeamId;
          return (
            <li key={`${e.playerId}-${e.kind}-${i}`} className="flex items-center gap-3 px-4 py-2">
              <span className="w-10 shrink-0 text-micro uppercase text-fg-faint">Day {e.day}</span>
              {team ? <TeamCrest team={team} size={24} decorative /> : <span className="size-6 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-label text-fg">
                  <span className="text-fg-muted">{e.position}</span> {e.name} <span className="tabular-nums text-fg-muted">{e.ovr}</span>
                </p>
                <p className={cx('truncate text-micro', e.kind === 'rejected' ? 'text-negative-fg' : mine ? 'text-positive-fg' : 'text-fg-muted')}>
                  {e.kind === 'rejected'
                    ? e.text
                    : `${mine ? 'Signed with you' : `Signed with ${team?.abbreviation ?? 'a rival'}`} · ${money(e.salary)} × ${e.years}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function FreeAgency({ onNavigate }) {
  const phase = useGameStore(s => s.phase);
  const freeAgents = useGameStore(s => s.freeAgents);
  const rosters = useGameStore(s => s.rosters);
  const standings = useGameStore(s => s.standings);
  const userTeamId = useGameStore(s => s.userTeamId);
  const draftPickOwners = useGameStore(s => s.draftPickOwners);
  const market = useGameStore(s => s.faMarket);
  const faWatchlistRaw = useGameStore(s => s.faWatchlist);
  const toggleFAWatchlist = useGameStore(s => s.toggleFAWatchlist);
  const openFAMarket = useGameStore(s => s.openFAMarket);
  const placeFAOffer = useGameStore(s => s.placeFAOffer);
  const withdrawFAOffer = useGameStore(s => s.withdrawFAOffer);
  const advanceFADay = useGameStore(s => s.advanceFADay);
  const quickSignFA = useGameStore(s => s.quickSignFA);
  const toast = useToast();

  const [posFilter, setPosFilter] = useState('All');
  const [viewMode, setViewMode] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(null); // 'day' | 'draft'
  const [confirmDraft, setConfirmDraft] = useState(false);

  const isMarket = phase === 'freeAgency';
  useEffect(() => { if (isMarket) openFAMarket(); }, [isMarket, openFAMarket]);
  const liveMarket = isMarket && market && !market.closed ? market : null;
  const offers = useMemo(() => liveMarket?.offers || {}, [liveMarket]);
  const floors = market?.floors || {};

  const userTeam = TEAM_BY_ID.get(userTeamId);
  const faWatchlist = useMemo(() => faWatchlistRaw || [], [faWatchlistRaw]);
  const userRoster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const pool = useMemo(() => freeAgents || [], [freeAgents]);
  const budget = useMemo(() => offerBudget({ userRoster, offers, pool }), [userRoster, offers, pool]);
  const rookieCost = isMarket ? rookieReserve(draftPickOwners?.[userTeamId] || []) : 0;

  const suitors = useMemo(
    () => marketSuitors(pool, { rosters, userTeamId, draftPickOwners, standings }),
    [pool, rosters, userTeamId, draftPickOwners, standings],
  );

  const teamNeeds = useMemo(() => {
    const counts = {};
    userRoster.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1; });
    return Object.keys(POSITION_MINIMUMS).filter(pos => (counts[pos] || 0) < POSITION_MINIMUMS[pos]);
  }, [userRoster]);

  const offerCount = Object.keys(offers).length;
  const formerCount = pool.filter(fa => fa.previousTeamId === userTeamId).length;

  const list = useMemo(() => {
    let l = pool;
    if (viewMode === 'watchlist') l = l.filter(fa => faWatchlist.includes(fa.id));
    else if (viewMode === 'needs') l = l.filter(fa => teamNeeds.includes(fa.position));
    else if (viewMode === 'former') l = l.filter(fa => fa.previousTeamId === userTeamId);
    else if (viewMode === 'offers') l = l.filter(fa => offers[fa.id]);
    if (posFilter !== 'All') l = l.filter(fa => fa.position === posFilter);
    return l;
  }, [pool, viewMode, faWatchlist, teamNeeds, userTeamId, offers, posFilter]);

  const selected = list.find(fa => fa.id === selectedId) ?? list[0] ?? null;

  const place = (fa, salary, years) => {
    const r = placeFAOffer(fa.id, salary, years);
    if (r.ok) toast.success({ title: `Offer out to ${fa.name}`, body: `${money(salary)} × ${years} yrs. He answers when the day ends.` });
    else toast.error({ title: 'Offer not placed', body: r.reason });
  };

  const quickSign = (fa) => {
    const r = quickSignFA(fa.id);
    if (r.ok) toast.success({ title: `${fa.name} signed`, body: `${money(r.salary)} × ${r.years} yrs.` });
    else toast.error({ title: 'Can’t sign', body: r.reason });
  };

  const endDay = () => {
    setBusy('day');
    // Let the button paint its loading state before the synchronous resolve.
    setTimeout(() => {
      const r = advanceFADay();
      setBusy(null);
      if (!r) return;
      r.signed.forEach(sg => toast.success({ title: `${sg.player.name} signed`, body: `${money(sg.contract.salary)} × ${sg.contract.years} yrs.` }));
      r.rejected.forEach(rj => toast.error({ title: `${rj.player.name} said no`, body: rj.text }));
      toast.info(`${r.closed ? 'Market closed' : `Day ${r.day} done`}: rivals made ${r.rivalSignings} signing${r.rivalSignings === 1 ? '' : 's'}.`);
    }, 30);
  };

  const goToDraft = (confirmed = false) => {
    if (offerCount && !confirmed) { setConfirmDraft(true); return; }
    setConfirmDraft(false);
    setBusy('draft');
    setTimeout(() => {
      const results = useGameStore.getState().finishFreeAgency();
      const signed = results.flatMap(r => r.signed);
      if (signed.length) toast.success({ title: `Signed ${signed.length} player${signed.length === 1 ? '' : 's'}`, body: signed.map(sg => sg.player.name).join(', ') });
      useGameStore.getState().startDraft();
      setBusy(null);
      onNavigate('draft');
    }, 30);
  };

  const capSpace = budget.space;
  const actionFor = (fa) => {
    if (!isMarket) return <Button variant="secondary" size="sm" disabled={askOf(fa) > capSpace || budget.openSpots <= 0} onClick={(e) => { e.stopPropagation(); quickSign(fa); }}>Sign</Button>;
    if (!liveMarket) return null;
    return (
      <Button variant={offers[fa.id] ? 'primary' : 'secondary'} size="sm" onClick={(e) => { e.stopPropagation(); setSelectedId(fa.id); }}>
        {offers[fa.id] ? 'Edit' : 'Offer'}
      </Button>
    );
  };

  const headerActions = (
    <div className="flex items-center gap-4">
      <Stat size="sm" align="right" label={offerCount ? `Cap space (${money(budget.committed)} offered)` : 'Cap space'} value={money(capSpace)}
            tone={capSpace < 0 ? 'var(--negative-fg)' : undefined} />
      <Stat size="sm" align="right" label="Roster" value={`${budget.rosterSize}/${ROSTER_LIMIT}`}
            tone={budget.rosterSize > ROSTER_LIMIT ? 'var(--negative-fg)' : undefined} />
      {isMarket && liveMarket && (
        <>
          <Button variant="secondary" onClick={() => goToDraft()} loading={busy === 'draft'} disabled={!!busy}>Skip to draft</Button>
          <Button variant="primary" onClick={endDay} loading={busy === 'day'} disabled={!!busy}>
            {liveMarket.day === FA_DAYS - 1 ? 'Close the market' : `End ${DAY_LABELS[liveMarket.day].toLowerCase()}`}
          </Button>
        </>
      )}
      {isMarket && !liveMarket && (
        <Button variant="primary" iconRight={<IconArrowRight size={16} />} onClick={() => goToDraft()} loading={busy === 'draft'} disabled={!!busy}>
          Go to the draft
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Free agency"
        eyebrow={isMarket
          ? `${pool.length} available · ${userTeam?.location ?? ''}`
          : `${pool.length} unsigned · they sign at their ask`}
        team={userTeam}
        actions={headerActions}
      />

      <div className="mx-auto flex max-w-content flex-col gap-4 px-6 py-6">
        {isMarket && market && (
          <div className="flex flex-wrap items-center gap-3">
            <DayStepper day={market.day} closed={market.closed} />
          </div>
        )}
        {isMarket && rookieCost > 0 && capSpace - rookieCost < 0 && (
          <p className="rounded-card bg-surface-sunken px-4 py-2 text-label text-warning-fg">
            Your draft class will cost about {money(rookieCost)}. After these offers you’d be {money(rookieCost - capSpace)} over the {money(SALARY_CAP)} cap.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* ── Pool ── */}
          <Card className="lg:col-span-7">
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-raised px-4 py-3">
              <SegmentedControl
                label="Pool"
                value={viewMode}
                onChange={setViewMode}
                items={[
                  { id: 'all', label: `All ${pool.length}` },
                  { id: 'needs', label: `Needs ${teamNeeds.length}` },
                  ...(formerCount ? [{ id: 'former', label: `Yours ${formerCount}` }] : []),
                  ...(liveMarket ? [{ id: 'offers', label: `Offers ${offerCount}` }] : []),
                  { id: 'watchlist', label: `★ ${faWatchlist.length}` },
                ]}
              />
              <FilterChips
                className="w-full"
                items={POSITIONS.map(p => ({ id: p, label: p }))}
                value={posFilter}
                onChange={setPosFilter}
              />
            </div>

            {list.length === 0 ? (
              <EmptyState
                icon={viewMode === 'watchlist' ? '★' : '📋'}
                title={viewMode === 'watchlist' ? 'Your watchlist is empty'
                  : viewMode === 'offers' ? 'No offers out yet'
                  : pool.length === 0 ? 'No free agents left' : 'Nothing at this filter'}
                body={viewMode === 'offers' ? 'Pick a player and place an offer. Offers resolve when the day ends.' : 'Try a different position or pool.'}
                action="Show all"
                onAction={() => { setViewMode('all'); setPosFilter('All'); }}
              />
            ) : (
              <DataTable
                rows={list}
                caption="Free agent pool"
                initialSort={{ id: 'ovr', dir: 'desc' }}
                onRowClick={fa => setSelectedId(fa.id)}
                highlightRow={fa => fa.id === selected?.id}
                columns={[
                  { id: 'pos', header: 'Pos', width: '62px', accessor: fa => fa.position, cell: fa => <PositionTag position={fa.position} /> },
                  {
                    id: 'name', header: 'Player', accessor: fa => fa.name,
                    cell: fa => {
                      const badge = getRosterBadge(fa, userRoster);
                      return (
                        <div className="flex min-w-0 items-center gap-2.5">
                          <PlayerFace player={fa} teamId="FA" size="sm" />
                          <div className="min-w-0">
                          <PlayerNameLine player={fa} />
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={badge.tone}>{badge.label}</Badge>
                            {offers[fa.id] && <Badge tone="positive">Offer {money(offers[fa.id].salary)}</Badge>}
                            {floors[fa.id] && !offers[fa.id] && <Badge tone="negative">Said no</Badge>}
                            {fa.previousTeamId === userTeamId && <Badge tone="info">Yours</Badge>}
                          </div>
                          </div>
                        </div>
                      );
                    },
                  },
                  { id: 'age', header: 'Age', accessor: fa => fa.age, numeric: true, align: 'right', width: '56px' },
                  { id: 'ovr', header: 'Rating', accessor: fa => fa.ovr, numeric: true, align: 'right', width: '120px', cell: fa => <RarityChip ovr={fa.ovr} /> },
                  {
                    id: 'ask', header: 'Ask', accessor: fa => askOf(fa), numeric: true, align: 'right', width: '84px',
                    cell: fa => (
                      <span className={cx('tabular-nums', askOf(fa) > capSpace ? 'text-negative-fg' : askOf(fa) < (fa.openingAsk ?? askOf(fa)) ? 'text-positive-fg' : 'text-fg')}>
                        {askOf(fa) < (fa.openingAsk ?? askOf(fa)) && <span aria-label="price dropped">↓</span>}{money(askOf(fa))}
                      </span>
                    ),
                  },
                  ...(isMarket ? [{
                    id: 'market', header: 'Market', accessor: fa => suitors[fa.id]?.length || 0, numeric: true, align: 'right', width: '84px',
                    cell: fa => { const h = heat(suitors[fa.id]?.length || 0); return <Badge tone={h.tone}>{h.label}</Badge>; },
                  }] : []),
                  { id: 'act', header: '', sortable: false, align: 'right', width: '84px', cell: actionFor },
                ]}
              />
            )}
          </Card>

          {/* ── Detail + offers + wire ── */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {selected ? (
              <PlayerPanel fa={selected} watched={faWatchlist.includes(selected.id)} onWatch={() => toggleFAWatchlist(selected.id)}>
                {liveMarket ? (
                  <OfferBuilder
                    key={`${selected.id}-${liveMarket.day}`}
                    fa={selected}
                    existing={offers[selected.id]}
                    floor={floors[selected.id]}
                    suitorCount={suitors[selected.id]?.length || 0}
                    budget={offerBudget({ userRoster, offers, pool, exceptId: selected.id })}
                    userTeamId={userTeamId}
                    userRoster={userRoster}
                    standings={standings}
                    onPlace={(salary, years) => place(selected, salary, years)}
                    onWithdraw={() => withdrawFAOffer(selected.id)}
                  />
                ) : isMarket ? (
                  <p className="text-label text-fg-muted">The market has closed. Unsigned players can be signed at their ask once the season starts.</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="flex-1 text-label text-fg-muted">Signs today for {money(askOf(selected))} × {preferredYears(selected)} yrs.</p>
                    <Button variant="primary" disabled={askOf(selected) > capSpace || budget.openSpots <= 0} onClick={() => quickSign(selected)}>
                      {askOf(selected) > capSpace ? 'No cap space' : budget.openSpots <= 0 ? 'Roster full' : 'Sign him'}
                    </Button>
                  </div>
                )}
              </PlayerPanel>
            ) : (
              <Card><EmptyState icon="👤" title="Select a free agent" body="Pick someone from the pool to see their profile." /></Card>
            )}

            {offerCount > 0 && (
              <Card>
                <CardHeader title={`Your offers · ${offerCount}`} eyebrow={`${money(budget.committed)} a year committed`} />
                <ul className="divide-y divide-line-subtle">
                  {pool.filter(fa => offers[fa.id]).map(fa => {
                    const read = assessOffer(fa, offers[fa.id], { userTeamId, userRoster, standings, suitorCount: suitors[fa.id]?.length || 0, floor: floors[fa.id] });
                    return (
                      <li key={fa.id} className="flex items-center gap-3 px-4 py-2">
                        <PositionTag position={fa.position} />
                        <button className="min-w-0 flex-1 truncate text-left text-label text-fg hover:underline" onClick={() => setSelectedId(fa.id)}>
                          {fa.name} <span className="tabular-nums text-fg-muted">{fa.ovr}</span>
                        </button>
                        <span className="text-label tabular-nums text-fg-secondary">{money(offers[fa.id].salary)} × {offers[fa.id].years}</span>
                        <span className="w-20 text-right text-micro" style={{ color: VERDICT_TONE[read.verdict] }}>{read.verdict}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {isMarket && <MarketWire log={market?.log} userTeamId={userTeamId} />}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDraft}
        onClose={() => setConfirmDraft(false)}
        onConfirm={() => goToDraft(true)}
        title="Skip to the draft?"
        body={`Your ${offerCount} pending offer${offerCount === 1 ? '' : 's'} will be answered as the remaining market days play out. Rival clubs keep signing too.`}
        confirmLabel="Play out the market"
      />
    </div>
  );
}
