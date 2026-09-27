import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { POSITIONS } from '../engine/player';
import { TEAMS } from '../data/teams';
import PlayerModal from '../components/PlayerModal';
import { playerStatus } from '../engine/playerStatus'; // CLAUDE: status-first rows
import { isActiveXF } from '../engine/xFactor';
import { StatusPill } from '../components/player/PlayerBits';
import PlayerFace from '../components/PlayerFace';
import { characterFor, TRAITS, teamContext, moodFor, contractStance } from '../engine/character';
import {
  PageHeader, Card, CardHeader, CardBody, Button, DataTable, Tabs,
  SegmentedControl, FilterChips, Badge, PositionTag, RarityChip, Meter,
  Modal, ConfirmModal, EmptyState, Stat, getRarity, rarityFrame, cx,
  useToast,
} from '../components/ui';

const DEPTH_GROUPS = [
  { label: 'Quarterback',      positions: ['QB'] },
  { label: 'Running back',     positions: ['RB', 'FB'] },
  { label: 'Wide receiver',    positions: ['WR'] },
  { label: 'Tight end',        positions: ['TE'] },
  { label: 'Offensive line',   positions: ['OL', 'OT', 'OG', 'C', 'LT', 'RT', 'G', 'T'] },
  { label: 'Defensive line',   positions: ['DL', 'DE', 'DT', 'NT'] },
  { label: 'Linebacker',       positions: ['LB', 'MLB', 'OLB', 'LOLB', 'ROLB'] },
  { label: 'Cornerback',       positions: ['CB'] },
  { label: 'Safety',           positions: ['S', 'FS', 'SS'] },
  { label: 'Kicker / punter',  positions: ['K', 'P'] },
];

const CAP_TOTAL = 200;

// Starters per group, used to grade each unit by its first-teamers.
const STARTERS = { Quarterback: 1, 'Running back': 1, 'Wide receiver': 3, 'Tight end': 1, 'Offensive line': 5,
  'Defensive line': 4, Linebacker: 3, Cornerback: 2, Safety: 2, 'Kicker / punter': 2 };

/** Right-hand rail for the roster table: cap, unit strength, expiring deals. */
function RosterRail({ roster, capUsed, capSpace, overCap, expiring, onContracts, onOpen }) {
  const units = DEPTH_GROUPS.map(g => {
    const players = roster.filter(p => g.positions.includes(p.position)).sort((a, b) => b.ovr - a.ovr);
    const starters = players.slice(0, STARTERS[g.label] || 1);
    const avg = starters.length ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / starters.length) : 0;
    return { label: g.label, count: players.length, avg };
  }).filter(u => u.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Salary cap" eyebrow={`$${capUsed}M of $${CAP_TOTAL}M used`} />
        <CardBody className="flex flex-col gap-3">
          <Stat value={overCap ? `-$${Math.abs(capSpace)}M` : `$${capSpace}M`} label={overCap ? 'Over the cap' : 'Cap space'}
                tone={overCap ? 'var(--negative-fg)' : 'var(--positive-fg)'} />
          <Meter value={Math.min(capUsed, CAP_TOTAL)} max={CAP_TOTAL}
                 color={overCap ? 'var(--negative-fg)' : 'var(--team-primary)'} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Unit strength" eyebrow="Starters' average rating" />
        <ul className="px-4 pb-3">
          {units.map(u => (
            <li key={u.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-line-subtle py-2 last:border-0">
              <span className="text-label font-semibold text-fg">{u.label}</span>
              <span className="text-label tabular-nums text-fg-muted">{u.avg} <span className="text-fg-faint">· {u.count}</span></span>
              <Meter className="col-span-2 mt-1" size="sm" value={Math.max(0, u.avg - 50)} max={49} />
            </li>
          ))}
        </ul>
      </Card>

      {expiring.length > 0 && (
        <Card>
          <CardHeader title="Expiring deals" eyebrow={`${expiring.length} after this season`}
            action={<Button variant="ghost" size="sm" onClick={onContracts}>Contracts</Button>} />
          <ul>
            {expiring.slice(0, 5).map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p)}
                  className="flex w-full items-center gap-3 border-b border-line-subtle px-4 py-2 text-left transition-colors last:border-0 hover:bg-surface-hover">
                  <PositionTag position={p.position} />
                  <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg">{p.name}</span>
                  <RarityChip ovr={p.ovr} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
// Your own players' traits as a compact icon run next to their name.
function TraitIcons({ player }) {
  const traits = characterFor(player)?.traits ?? [];
  if (!traits.length) return null;
  return (
    <span className="shrink-0 text-label leading-none" title={traits.map(t => TRAITS[t].label).join(' · ')}>
      {traits.map(t => TRAITS[t].icon).join('')}
    </span>
  );
}

// Only flag a problem: a happy locker room shouldn't be a wall of emoji.
function UnhappyFlag({ player, ctx }) {
  const mood = moodFor(player, ctx);
  if (mood.score >= 48) return null;
  return (
    <span className="shrink-0 text-label leading-none" title={`${mood.label}: ${mood.reasons[0]?.text ?? ''}`}>
      {mood.icon}
    </span>
  );
}

function StanceNote({ stance }) {
  const { mood } = stance;
  return (
    <div className={cx('rounded-card px-4 py-3 text-label', stance.willing ? 'bg-surface-sunken text-fg-secondary' : 'bg-negative-bg text-negative-fg')}>
      <p className="mb-1 font-semibold">
        {mood.icon} {mood.label}{mood.reasons[0] ? ` — ${mood.reasons[0].text.toLowerCase()}` : ''}
      </p>
      {stance.willing
        ? <p>{stance.notes.length ? stance.notes.join(' · ') : 'No strong feelings about the money.'}</p>
        : <p>{stance.refusal}</p>}
    </div>
  );
}

const salaryOf = (p) => p.contract?.salary || p.salary || 2;
const yearsOf = (p) => p.contract?.yearsLeft ?? p.contract?.years ?? 1;

// ── Player card (grid view) ─────────────────────────────────────────────────
function PlayerTile({ player, onOpen, selected, onSelect }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rarity = getRarity(player.ovr);
  const attrs = Object.entries(player.attributes?.position || {})
    .sort(([, a], [, b]) => b - a).slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => (onSelect ? onSelect(player) : onOpen(player))}
      className={cx(
        'group relative flex flex-col gap-3 overflow-hidden rounded-panel border bg-surface-raised p-4 text-left',
        'transition-[transform,border-color] duration-micro hover:-translate-y-0.5',
        selected && 'ring-2 ring-team',
      )}
      style={rarityFrame(player.ovr)}
    >
      <div className="flex items-start gap-3">
        <PlayerFace player={player} teamId={userTeamId} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-h3 text-fg">{player.name}</span>
            <TraitIcons player={player} />
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <PositionTag position={player.position} />
            <span className="truncate text-label text-fg-muted">{player.archetype}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-h1 leading-none tabular-nums" style={{ color: rarity.color }}>
            {player.ovr}
          </p>
          <p className="mt-0.5 text-micro uppercase" style={{ color: rarity.color }}>{rarity.label}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {attrs.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-label text-fg-muted">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: rarity.color }} />
            </div>
            <span className="w-6 shrink-0 text-right text-label tabular-nums text-fg-secondary">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle pt-2.5">
        <span className="text-label text-fg-muted">Age {player.age}</span>
        <span className="text-label tabular-nums text-fg-secondary">
          ${salaryOf(player)}M · {yearsOf(player)}yr
        </span>
      </div>
    </button>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function Roster() {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const cutPlayer = useGameStore(s => s.cutPlayer);
  const resignPlayer = useGameStore(s => s.resignPlayer);
  const toast = useToast();
  const rosterInjuries = useGameStore(s => s.injuries); // CLAUDE
  const rosterWeek = useGameStore(s => s.week);
  const rosterFO = useGameStore(s => s.frontOffice);

  const [view, setView] = useState('roster');
  const [density, setDensity] = useState('table');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cuttingPlayer, setCuttingPlayer] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [resignTarget, setResignTarget] = useState(null);
  const [resignSalary, setResignSalary] = useState(5);
  const [resignYears, setResignYears] = useState(2);

  const roster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const teamData = TEAMS.find(t => t.id === userTeamId);
  const standings = useGameStore(s => s.standings);
  // The same stance the store's resignPlayer negotiates against: market price
  // read through his personality and his mood here.
  const teamCtx = useMemo(() => teamContext({ rosters, standings }, userTeamId), [rosters, standings, userTeamId]);
  const stanceOf = (p) => contractStance(p, teamCtx);

  const capUsed = Math.round(roster.reduce((s, p) => s + salaryOf(p), 0));
  const capSpace = CAP_TOTAL - capUsed;
  const overCap = capSpace < 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter(p => positionFilter === 'ALL' || p.position === positionFilter)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q));
  }, [roster, positionFilter, query]);

  const positionChips = useMemo(() => {
    const present = new Set(roster.map(p => p.position));
    return [
      { id: 'ALL', label: `All ${roster.length}` },
      ...Object.values(POSITIONS).filter(p => present.has(p)).map(p => ({ id: p, label: p })),
    ];
  }, [roster]);

  const openResign = (p) => {
    setResignTarget(p);
    setResignSalary(stanceOf(p).ask);
    setResignYears(2);
  };

  const statusById = useMemo(() => Object.fromEntries(roster.map(p => [p.id, playerStatus(p, { own: true, roster, injuries: rosterInjuries, week: rosterWeek, block: rosterFO?.block, tradeRequests: rosterFO?.tradeRequests, holdouts: rosterFO?.holdouts })])), [roster, rosterInjuries, rosterWeek, rosterFO]);

  const columns = [
    {
      id: 'position', header: 'Pos', width: '64px', accessor: p => p.position,
      cell: p => <PositionTag position={p.position} />,
    },
    {
      id: 'name', header: 'Player', accessor: p => p.name,
      cell: p => (
        <div className="flex min-w-0 items-center gap-2.5">
          <PlayerFace player={p} teamId={userTeamId} size="sm" />
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold text-fg">{p.name}</span>
              {isActiveXF(p) && <span className="xf-chip rounded-full border border-ink px-1 text-micro" title="X-Factor">⚡</span>}
              <TraitIcons player={p} />
              <UnhappyFlag player={p} ctx={teamCtx} />
            </p>
            {statusById[p.id]?.primary.rank < 10
              ? <StatusPill status={statusById[p.id].primary} className="mt-0.5 max-w-full truncate" />
              : <p className="truncate text-label text-fg-muted">#{characterFor(p).number} · {p.archetype}</p>}
          </div>
        </div>
      ),
    },
    {
      id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '132px',
      cell: p => <RarityChip ovr={p.ovr} />,
    },
    { id: 'pot', header: 'Pot', accessor: p => p.pot ?? p.ovr, numeric: true, align: 'right', width: '60px' },
    { id: 'age', header: 'Age', accessor: p => p.age, numeric: true, align: 'right', width: '60px' },
    {
      id: 'salary', header: 'Cap hit', accessor: p => salaryOf(p), numeric: true, align: 'right', width: '92px',
      cell: p => <span className="tabular-nums">${salaryOf(p)}M</span>,
    },
    {
      id: 'years', header: 'Years', accessor: p => yearsOf(p), numeric: true, align: 'right', width: '84px',
      cell: p => (
        <span className={cx('tabular-nums', yearsOf(p) <= 1 && 'text-warning-fg')}>
          {yearsOf(p)}yr
        </span>
      ),
    },
    {
      id: 'actions', header: '', sortable: false, align: 'right', width: '92px',
      cell: p => (
        <Button
          variant="ghost" size="sm"
          onClick={(e) => { e.stopPropagation(); setCuttingPlayer(p); }}
        >
          Release
        </Button>
      ),
    },
  ];

  const expiring = useMemo(
    () => [...roster].filter(p => yearsOf(p) <= 1).sort((a, b) => b.ovr - a.ovr),
    [roster],
  );
  const signed = useMemo(
    () => [...roster].filter(p => yearsOf(p) > 1).sort((a, b) => yearsOf(a) - yearsOf(b)),
    [roster],
  );

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Roster"
        eyebrow={`${teamData?.location ?? ''} · ${roster.length} players`}
        team={teamData}
        actions={
          <div className="text-right">
            <p className={cx('font-display text-h2 tabular-nums', overCap ? 'text-negative-fg' : 'text-fg')}>
              {overCap ? `-$${Math.abs(capSpace)}M` : `$${capSpace}M`}
            </p>
            <p className="text-micro uppercase text-fg-muted">{overCap ? 'Over cap' : 'Cap space'}</p>
          </div>
        }
        tabs={
          <Tabs
            value={view}
            onChange={setView}
            label="Roster views"
            items={[
              { id: 'roster', label: 'Roster', count: roster.length },
              { id: 'depth', label: 'Depth chart' },
              { id: 'contracts', label: 'Contracts', count: expiring.length || undefined },
              { id: 'compare', label: 'Compare' },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-content px-6 py-5">
        {/* ── ROSTER ── */}
        {view === 'roster' && (
          <div className="grid grid-cols-12 items-start gap-4">
          <Card className="col-span-12 min-w-0 xl:col-span-9">
            {/* Sticky controls — the old filter row scrolled away with the page */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-raised px-4 py-3">
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search players…"
                aria-label="Search players"
                className="h-9 w-56 rounded-card border border-line bg-surface-sunken px-3 text-label text-fg placeholder:text-fg-faint"
              />
              <FilterChips items={positionChips} value={positionFilter} onChange={setPositionFilter} />
              <div className="ml-auto flex items-center gap-3">
                <span className="text-label text-fg-muted">{filtered.length} shown</span>
                <SegmentedControl
                  size="sm"
                  label="Layout"
                  value={density}
                  onChange={setDensity}
                  items={[{ id: 'table', label: 'Table' }, { id: 'cards', label: 'Cards' }]}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No players match"
                body="Try a different position or clear the search."
                action="Clear filters"
                onAction={() => { setPositionFilter('ALL'); setQuery(''); }}
              />
            ) : density === 'table' ? (
              <DataTable
                rows={filtered}
                columns={columns}
                caption="Team roster"
                initialSort={{ id: 'ovr', dir: 'desc' }}
                onRowClick={setSelectedPlayer}
              />
            ) : (
              <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {[...filtered].sort((a, b) => b.ovr - a.ovr).map(p => (
                  <PlayerTile key={p.id} player={p} onOpen={setSelectedPlayer} />
                ))}
              </CardBody>
            )}
          </Card>
          <aside className="col-span-12 xl:col-span-3">
            <RosterRail
              roster={roster} capUsed={capUsed} capSpace={capSpace} overCap={overCap}
              expiring={expiring} onContracts={() => setView('contracts')} onOpen={setSelectedPlayer}
            />
          </aside>
          </div>
        )}

        {/* ── DEPTH CHART ── */}
        {view === 'depth' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {DEPTH_GROUPS.map(group => {
              const players = roster
                .filter(p => group.positions.includes(p.position))
                .sort((a, b) => b.ovr - a.ovr);
              if (!players.length) return null;
              const shown = players.slice(0, 3);
              const rest = players.length - shown.length;
              const labels = ['Starter', 'Backup', '3rd string'];
              return (
                <Card key={group.label}>
                  <CardHeader title={group.label} eyebrow={`${players.length} on roster`} />
                  <ul>
                    {shown.map((p, i) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayer(p)}
                          className="flex w-full items-center gap-3 border-b border-line-subtle px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-surface-hover"
                        >
                          <Badge tone={i === 0 ? 'team' : 'neutral'} className="w-20 justify-center">
                            {labels[i]}
                          </Badge>
                          <PlayerFace player={p} teamId={userTeamId} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg">{p.name}</span>
                          <TraitIcons player={p} />
                          <span className="text-label text-fg-muted">Age {p.age}</span>
                          <RarityChip ovr={p.ovr} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {rest > 0 && (
                    <p className="px-4 py-2 text-label text-fg-faint">+{rest} more at this group</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── CONTRACTS ── */}
        {view === 'contracts' && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardBody className="flex items-center gap-8">
                <Stat value={`$${capUsed}M`} label="Cap used" />
                <Stat value={overCap ? `-$${Math.abs(capSpace)}M` : `$${capSpace}M`} label={overCap ? 'Over cap' : 'Cap space'}
                      tone={overCap ? 'var(--negative-fg)' : 'var(--positive-fg)'} />
                <Stat value={expiring.length} label="Expiring" />
                <div className="ml-auto w-64">
                  <Meter value={Math.min(capUsed, CAP_TOTAL)} max={CAP_TOTAL}
                         caption={`$${capUsed}M / $${CAP_TOTAL}M`}
                         color={overCap ? 'var(--negative-fg)' : 'var(--team-primary)'} />
                </div>
              </CardBody>
            </Card>

            {expiring.length > 0 && (
              <Card>
                <CardHeader title="Expiring this offseason" eyebrow="Re-sign or lose them" />
                <DataTable
                  rows={expiring}
                  caption="Expiring contracts"
                  initialSort={{ id: 'ovr', dir: 'desc' }}
                  onRowClick={setSelectedPlayer}
                  columns={[
                    { id: 'position', header: 'Pos', width: '64px', accessor: p => p.position, cell: p => <PositionTag position={p.position} /> },
                    { id: 'name', header: 'Player', accessor: p => p.name, cell: p => <span className="font-semibold text-fg">{p.name}</span> },
                    { id: 'age', header: 'Age', accessor: p => p.age, numeric: true, align: 'right', width: '60px' },
                    { id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '132px', cell: p => <RarityChip ovr={p.ovr} /> },
                    { id: 'salary', header: 'Current', accessor: p => salaryOf(p), numeric: true, align: 'right', width: '90px', cell: p => <span className="tabular-nums">${salaryOf(p)}M</span> },
                    { id: 'market', header: 'His ask', accessor: p => stanceOf(p).ask, numeric: true, align: 'right', width: '96px',
                      cell: p => { const st = stanceOf(p); return st.willing
                        ? <span className="tabular-nums text-warning-fg" title={st.notes.join(' · ')}>~${st.ask}M</span>
                        : <span className="text-negative-fg" title={st.refusal}>Won't talk</span>; } },
                    { id: 'actions', header: '', sortable: false, align: 'right', width: '104px',
                      cell: p => <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openResign(p); }}>Re-sign</Button> },
                  ]}
                />
              </Card>
            )}

            <Card>
              <CardHeader title="Under contract" eyebrow={`${signed.length} players`} />
              <DataTable
                rows={signed}
                caption="Players under contract"
                initialSort={{ id: 'years', dir: 'asc' }}
                onRowClick={setSelectedPlayer}
                columns={[
                  { id: 'position', header: 'Pos', width: '64px', accessor: p => p.position, cell: p => <PositionTag position={p.position} /> },
                  { id: 'name', header: 'Player', accessor: p => p.name, cell: p => <span className="font-semibold text-fg">{p.name}</span> },
                  { id: 'age', header: 'Age', accessor: p => p.age, numeric: true, align: 'right', width: '60px' },
                  { id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '132px', cell: p => <RarityChip ovr={p.ovr} /> },
                  { id: 'salary', header: 'Cap hit', accessor: p => salaryOf(p), numeric: true, align: 'right', width: '90px', cell: p => <span className="tabular-nums">${salaryOf(p)}M</span> },
                  { id: 'years', header: 'Years left', accessor: p => yearsOf(p), numeric: true, align: 'right', width: '96px', cell: p => <span className="tabular-nums">{yearsOf(p)}yr</span> },
                ]}
              />
            </Card>
          </div>
        )}

        {/* ── COMPARE ── */}
        {view === 'compare' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[{ slot: compareA, set: setCompareA, label: 'Player A' },
                { slot: compareB, set: setCompareB, label: 'Player B' }].map(({ slot, set, label }) => (
                <Card key={label}>
                  <CardHeader title={label} />
                  <CardBody>
                    {slot ? (
                      <div className="flex items-center gap-3">
                        <PositionTag position={slot.position} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-h3 text-fg">{slot.name}</p>
                          <p className="text-label text-fg-muted">Age {slot.age} · ${salaryOf(slot)}M</p>
                        </div>
                        <RarityChip ovr={slot.ovr} />
                        <Button variant="ghost" size="sm" onClick={() => set(null)} aria-label={`Clear ${label}`}>✕</Button>
                      </div>
                    ) : (
                      <p className="text-label text-fg-faint">Pick a player below.</p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>

            {compareA && compareB && (
              <Card>
                <CardHeader title="Head to head" />
                <ul>
                  {[
                    ['Overall', compareA.ovr, compareB.ovr],
                    ['Potential', compareA.pot, compareB.pot],
                    ['Age', compareA.age, compareB.age, true],
                    ['Speed', compareA.combine?.speed, compareB.combine?.speed],
                    ['Strength', compareA.combine?.strength, compareB.combine?.strength],
                    ['Agility', compareA.combine?.agility, compareB.combine?.agility],
                    ['Cap hit', salaryOf(compareA), salaryOf(compareB), true],
                  ].map(([label, a, b, lowerBetter]) => {
                    if (a == null || b == null) return null;
                    const aWins = lowerBetter ? a < b : a > b;
                    const bWins = lowerBetter ? b < a : b > a;
                    const fmt = v => (label === 'Cap hit' ? `$${v}M` : v);
                    return (
                      <li key={label} className="flex items-center border-b border-line-subtle px-4 py-2.5 last:border-0">
                        <span className={cx('w-24 text-label tabular-nums', aWins ? 'font-bold text-positive-fg' : 'text-fg-secondary')}>{fmt(a)}</span>
                        <span className="flex-1 text-center text-micro uppercase text-fg-faint">{label}</span>
                        <span className={cx('w-24 text-right text-label tabular-nums', bWins ? 'font-bold text-positive-fg' : 'text-fg-secondary')}>{fmt(b)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <Card>
              <CardHeader title="Pick players" eyebrow="Click to add or remove" />
              <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {[...roster].sort((a, b) => b.ovr - a.ovr).map(p => (
                  <PlayerTile
                    key={p.id}
                    player={p}
                    onOpen={setSelectedPlayer}
                    selected={p.id === compareA?.id || p.id === compareB?.id}
                    onSelect={(pl) => {
                      if (pl.id === compareA?.id) return setCompareA(null);
                      if (pl.id === compareB?.id) return setCompareB(null);
                      if (!compareA) return setCompareA(pl);
                      if (!compareB) return setCompareB(pl);
                      return setCompareA(pl);
                    }}
                  />
                ))}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* ── Overlays ── */}
      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          teamId={userTeamId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      <ConfirmModal
        open={!!cuttingPlayer}
        onClose={() => setCuttingPlayer(null)}
        onConfirm={() => {
          cutPlayer(cuttingPlayer.id);
          toast.warn(`${cuttingPlayer.name} released — $${salaryOf(cuttingPlayer)}M off the books.`);
        }}
        destructive
        title={`Release ${cuttingPlayer?.name ?? ''}?`}
        body={cuttingPlayer
          ? `${cuttingPlayer.position} · ${cuttingPlayer.ovr} OVR · $${salaryOf(cuttingPlayer)}M. They go to the waiver wire and any team can claim them.`
          : ''}
        confirmLabel="Release player"
      />

      <Modal
        open={!!resignTarget}
        onClose={() => setResignTarget(null)}
        eyebrow="Contract extension"
        title={resignTarget ? `Re-sign ${resignTarget.name}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResignTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!!resignTarget && !stanceOf(resignTarget).willing}
              onClick={() => {
                const result = resignPlayer(userTeamId, resignTarget.id, resignSalary, resignYears);
                if (!result?.accepted) {
                  toast.error(result?.reason || `${resignTarget.name} turned the offer down.`);
                  return;
                }
                toast.success(`${resignTarget.name} re-signed for ${resignYears} years at $${resignSalary}M.`);
                setResignTarget(null);
              }}
            >
              Offer ${resignSalary}M × {resignYears}yr
            </Button>
          </>
        }
      >
        {resignTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <PlayerFace player={resignTarget} teamId={userTeamId} size="md" />
              <PositionTag position={resignTarget.position} />
              <span className="flex-1 text-h3 text-fg">{resignTarget.name}</span>
              <RarityChip ovr={resignTarget.ovr} />
            </div>
            <StanceNote stance={stanceOf(resignTarget)} />

            <label className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between text-label text-fg-secondary">
                Annual salary
                <span className="tabular-nums text-fg">${resignSalary}M</span>
              </span>
              <input
                type="range" min={1} max={60} value={resignSalary}
                onChange={e => setResignSalary(Number(e.target.value))}
                className="w-full accent-[var(--team-primary)]"
              />
              <span className="text-label text-fg-faint">
                Asking about ${stanceOf(resignTarget).ask}M a year. 1–2 year deals get a 10% discount; 5+ years costs 10% more.
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between text-label text-fg-secondary">
                Contract length
                <span className="tabular-nums text-fg">{resignYears} years</span>
              </span>
              <input
                type="range" min={1} max={6} value={resignYears}
                onChange={e => setResignYears(Number(e.target.value))}
                className="w-full accent-[var(--team-primary)]"
              />
            </label>

            <div className="rounded-card bg-surface-sunken px-4 py-3">
              <p className="text-label text-fg-muted">
                Total commitment
                <span className="ml-2 tabular-nums text-fg">${resignSalary * resignYears}M</span>
                <span className="ml-2">over {resignYears} years.</span>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
