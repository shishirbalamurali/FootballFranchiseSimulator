import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  Modal, Button, Badge, Tabs, FilterChips, DataTable, PositionTag,
  RarityChip, ConfirmModal, Stat, EmptyState, useToast,
} from './ui';

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
const ROSTER_LIMIT = 60;
const CAP_TOTAL = 200;

export default function WaiverWireModal({ onClose }) {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const waiverWireRaw = useGameStore(s => s.waiverWire);
  const signFromWaivers = useGameStore(s => s.signFromWaivers);
  const cutPlayer = useGameStore(s => s.cutPlayer);
  const toast = useToast();

  const [posFilter, setPosFilter] = useState('All');
  const [tab, setTab] = useState('wire');
  const [confirmCut, setConfirmCut] = useState(null);

  const waiverWire = useMemo(() => waiverWireRaw || [], [waiverWireRaw]);
  const userRoster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const capUsed = Math.round(userRoster.reduce((sum, p) => sum + (p.contract?.salary || 2), 0));
  const capSpace = Math.max(0, CAP_TOTAL - capUsed);
  const rosterFull = userRoster.length >= ROSTER_LIMIT;

  const wire = useMemo(
    () => waiverWire.filter(p => posFilter === 'All' || p.position === posFilter),
    [waiverWire, posFilter]);
  const mine = useMemo(
    () => [...userRoster].filter(p => posFilter === 'All' || p.position === posFilter)
      .sort((a, b) => b.ovr - a.ovr),
    [userRoster, posFilter]);

  const handleSign = (player) => {
    if (rosterFull) {
      toast.warn({ title: 'Roster is full', body: `Release someone first — the limit is ${ROSTER_LIMIT}.` });
      return;
    }
    if (signFromWaivers(player.id)) {
      toast.success({ title: `${player.name} claimed`, body: `${player.position} · ${player.ovr} OVR added to your roster.` });
    } else {
      toast.error(`${player.name} could not be claimed.`);
    }
  };

  const baseCols = [
    { id: 'pos', header: 'Pos', width: '62px', accessor: p => p.position, cell: p => <PositionTag position={p.position} /> },
    { id: 'name', header: 'Player', accessor: p => p.name, cell: p => <span className="font-semibold text-fg">{p.name}</span> },
    { id: 'age', header: 'Age', accessor: p => p.age, numeric: true, align: 'right', width: '58px' },
    { id: 'ovr', header: 'Rating', accessor: p => p.ovr, numeric: true, align: 'right', width: '126px', cell: p => <RarityChip ovr={p.ovr} /> },
  ];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        eyebrow="Weekly transactions"
        title="Waiver wire"
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        <div className="mb-4 flex flex-wrap items-center gap-6 rounded-card bg-surface-sunken px-4 py-3">
          <Stat size="sm" value={`${userRoster.length}/${ROSTER_LIMIT}`} label="Roster spots"
                tone={rosterFull ? 'var(--negative-fg)' : undefined} />
          <Stat size="sm" value={`$${capSpace}M`} label="Cap space" />
          <Stat size="sm" value={waiverWire.length} label="On waivers" />
          {rosterFull && <Badge tone="warning">Release a player before claiming</Badge>}
        </div>

        <Tabs
          className="mb-3"
          value={tab}
          onChange={setTab}
          label="Waiver views"
          items={[
            { id: 'wire', label: 'Available', count: waiverWire.length },
            { id: 'roster', label: 'Your roster', count: userRoster.length },
          ]}
        />

        <FilterChips
          className="mb-3"
          items={POSITIONS.map(p => ({ id: p, label: p }))}
          value={posFilter}
          onChange={setPosFilter}
        />

        {tab === 'wire' ? (
          wire.length ? (
            <DataTable
              rows={wire}
              caption="Players available on waivers"
              initialSort={{ id: 'ovr', dir: 'desc' }}
              dense
              columns={[
                ...baseCols,
                {
                  id: 'act', header: '', sortable: false, align: 'right', width: '92px',
                  cell: p => (
                    <Button variant="secondary" size="sm" disabled={rosterFull}
                            onClick={() => handleSign(p)}>
                      Claim
                    </Button>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState icon="📝" title="Nobody on waivers" body="Players appear here when other teams release them." />
          )
        ) : (
          <DataTable
            rows={mine}
            caption="Your roster"
            initialSort={{ id: 'ovr', dir: 'desc' }}
            dense
            columns={[
              ...baseCols,
              {
                id: 'act', header: '', sortable: false, align: 'right', width: '96px',
                cell: p => (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmCut(p)}>Release</Button>
                ),
              },
            ]}
          />
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmCut}
        onClose={() => setConfirmCut(null)}
        onConfirm={() => {
          cutPlayer(confirmCut.id);
          toast.warn(`${confirmCut.name} released.`);
        }}
        destructive
        title={`Release ${confirmCut?.name ?? ''}?`}
        body={confirmCut ? `${confirmCut.position} · ${confirmCut.ovr} OVR. They go on waivers and any team can claim them.` : ''}
        confirmLabel="Release"
      />
    </>
  );
}
