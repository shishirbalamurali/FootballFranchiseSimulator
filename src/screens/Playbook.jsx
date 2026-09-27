import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { PLAYBOOKS, calculatePlaybookFit } from '../data/playbooks';
import {
  PageHeader, Card, CardHeader, CardBody, Button, Badge, Meter,
  SegmentedControl, TeamCrest, cx, useToast,
} from '../components/ui';

const SCHEME_TABS = [
  { id: 'all', label: 'All' },
  { id: 'offense', label: 'Offense' },
  { id: 'defense', label: 'Defense' },
  { id: 'balanced', label: 'Balanced' },
];

function matchesTab(pb, tab) {
  const off = (pb.bonuses.passingBoost || 0) + (pb.bonuses.rushingBoost || 0);
  const def = pb.bonuses.defenseBoost || 0;
  if (tab === 'all') return true;
  if (tab === 'offense') return off > def && off >= 12;
  if (tab === 'defense') return def > off && def >= 10;
  if (tab === 'balanced') return Math.abs(off - def) < 8;
  return true;
}

function fitTier(score) {
  if (score >= 80) return { label: 'Elite fit', tone: 'positive', color: 'var(--positive-fg)' };
  if (score >= 60) return { label: 'Good fit',  tone: 'info',     color: 'var(--info-fg)' };
  if (score >= 40) return { label: 'Average',   tone: 'warning',  color: 'var(--warning-fg)' };
  return { label: 'Poor fit', tone: 'negative', color: 'var(--negative-fg)' };
}

function BonusRow({ bonuses }) {
  const items = [
    { label: 'Pass', value: bonuses.passingBoost },
    { label: 'Rush', value: bonuses.rushingBoost },
    { label: 'Def',  value: bonuses.defenseBoost },
  ].filter(b => b.value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(b => (
        <Badge key={b.label} tone={b.value > 0 ? 'positive' : 'negative'}>
          {b.value > 0 ? '+' : ''}{b.value} {b.label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * A tiny schematic of where the scheme puts its weight — pass / rush / defense
 * as three stacked bars. Turns "+13 Pass, +2 Rush" from a stat line into a
 * shape you can compare at a glance.
 */
function SchemeDiagram({ bonuses, accent }) {
  const rows = [
    { label: 'Pass', value: bonuses.passingBoost || 0 },
    { label: 'Rush', value: bonuses.rushingBoost || 0 },
    { label: 'Def',  value: bonuses.defenseBoost || 0 },
  ];
  const span = 18; // bonuses range roughly -5..+15
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      {rows.map(r => {
        const pos = r.value >= 0;
        const width = Math.min(50, (Math.abs(r.value) / span) * 50);
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-micro uppercase text-fg-faint">{r.label}</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-surface-sunken">
              <span className="absolute inset-y-0 left-1/2 w-px bg-fg/20" />
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  width: `${width}%`,
                  left: pos ? '50%' : `${50 - width}%`,
                  backgroundColor: pos ? accent : 'var(--negative-fg)',
                }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-label tabular-nums text-fg-muted">
              {r.value > 0 ? `+${r.value}` : r.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Playbook() {
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const userPlaybookId = useGameStore(s => s.userPlaybookId);
  const setPlaybook = useGameStore(s => s.setPlaybook);
  const [tab, setTab] = useState('all');
  const toast = useToast();

  const teamData = TEAMS.find(t => t.id === userTeamId);
  const roster = useMemo(() => rosters[userTeamId] || [], [rosters, userTeamId]);
  const active = PLAYBOOKS.find(p => p.id === userPlaybookId) || PLAYBOOKS[0];

  const playbooks = useMemo(
    () => PLAYBOOKS
      .filter(pb => matchesTab(pb, tab))
      .map(pb => ({ ...pb, fit: calculatePlaybookFit(pb, roster) }))
      .sort((a, b) => b.fit - a.fit),
    [tab, roster],
  );

  const activeFit = calculatePlaybookFit(active, roster);

  return (
    <div className="min-h-full bg-surface-base">
      <PageHeader
        title="Playbook"
        eyebrow={`${teamData?.location ?? ''} ${teamData?.name ?? ''} · ${PLAYBOOKS.length} schemes`}
        team={teamData}
        actions={
          <SegmentedControl label="Scheme type" value={tab} onChange={setTab} items={SCHEME_TABS} />
        }
      />

      <div className="mx-auto max-w-content px-6 py-6">
        {/* ── Active scheme ── */}
        <Card elevation={2} className="mb-4">
          <div
            className="relative flex flex-wrap items-center gap-6 px-6 py-5"
            style={{ background: `linear-gradient(115deg, color-mix(in srgb, ${active.color} 20%, transparent), transparent 62%)` }}
          >
            <div
              className="grid size-16 shrink-0 place-items-center rounded-panel text-h1"
              style={{ backgroundColor: `color-mix(in srgb, ${active.color} 24%, transparent)` }}
              aria-hidden="true"
            >
              {active.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-micro uppercase text-fg-muted">Active scheme · {active.category}</p>
              <h2 className="font-display text-h1 uppercase text-fg">{active.name}</h2>
              <p className="mt-1 max-w-2xl text-body text-fg-secondary">{active.description}</p>
            </div>
            <div className="w-56 shrink-0">
              <Meter
                label="Roster fit"
                caption={`${fitTier(activeFit).label} · ${activeFit}/100`}
                value={activeFit}
                color={fitTier(activeFit).color}
              />
              <div className="mt-3"><BonusRow bonuses={active.bonuses} /></div>
            </div>
          </div>
        </Card>

        {/* ── Scheme library ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {playbooks.map(pb => {
            const isActive = pb.id === userPlaybookId;
            const tier = fitTier(pb.fit);
            const owner = TEAMS.find(t => t.id === pb.teamId);
            return (
              <Card
                key={pb.id}
                className={cx('transition-colors', isActive && 'ring-1 ring-team')}
              >
                <CardHeader
                  title={pb.name}
                  eyebrow={pb.category}
                  action={owner ? <TeamCrest team={owner} size="sm" decorative /> : null}
                />
                <CardBody className="flex flex-1 flex-col gap-4">
                  <p className="line-clamp-3 text-label text-fg-muted">{pb.description}</p>

                  <SchemeDiagram bonuses={pb.bonuses} accent={pb.color} />

                  {pb.keyPosition && (
                    <p className="text-label text-fg-faint">
                      Keys on <span className="text-fg-secondary">{pb.keyPosition}</span>
                      {pb.keyAttribute ? ` · ${pb.keyAttribute}` : ''}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col gap-3 border-t border-line-subtle pt-3">
                    <Meter
                      label="Roster fit"
                      caption={`${tier.label} · ${pb.fit}`}
                      value={pb.fit}
                      color={tier.color}
                      size="sm"
                    />
                    <Button
                      variant={isActive ? 'secondary' : 'primary'}
                      size="sm"
                      fullWidth
                      disabled={isActive}
                      onClick={() => {
                        setPlaybook(pb.id);
                        toast.success({ title: `${pb.name} installed`, body: 'Your scheme bonuses apply from the next game.' });
                      }}
                    >
                      {isActive ? 'Currently running' : 'Install scheme'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
