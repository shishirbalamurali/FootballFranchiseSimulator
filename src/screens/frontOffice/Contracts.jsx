// Contracts (Claude-owned): the re-sign & tag window in the offseason,
// walk-year extensions in season, and a five-year cap chart all year.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { contractStance, teamContext } from '../../engine/character';
import { askingSalary } from '../../engine/progression';
import { tagPrice, TENDERS, isRestricted, deadMoney } from '../../engine/contracts';
import { capYear } from '../../store/frontOfficeSlice';
import { Card, CardHeader, CardBody, Button, Badge, EmptyState, Modal, cx, useToast } from '../../components/ui';
import { FOShell, CapStrip, StageStepper } from '../../components/frontOffice/FOBits';
import PlayerCardCompact from '../../components/player/PlayerCardCompact';

const REC = {
    resign: { label: 'Re-sign', tone: 'positive' }, tender: { label: 'Tender', tone: 'info' },
    market: { label: 'Test the market', tone: 'warning' }, release: { label: 'Let go', tone: 'neutral' },
};

function OfferEditor({ player, stance, onClose, onSubmit }) {
    const [years, setYears] = useState(player.age <= 27 ? 4 : player.age <= 30 ? 3 : 1);
    const [salary, setSalary] = useState(stance.ask);
    const [g, setG] = useState(0.3);
    return (
        <Modal open onClose={onClose} title={`Re-sign ${player.name}`} eyebrow={`Asks $${stance.ask}M/yr`} size="md"
            footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSubmit({ salary, years, guaranteePct: g })}>Offer ${salary}M × {years}</Button></>}>
            <div className="space-y-4">
                <label className="block"><span className="text-micro uppercase text-fg-faint">Salary per year: ${salary}M</span>
                    <input type="range" min={Math.max(1, Math.round(stance.ask * 0.7))} max={Math.round(stance.ask * 1.4) + 1} value={salary} onChange={e => setSalary(Number(e.target.value))} className="w-full" /></label>
                <label className="block"><span className="text-micro uppercase text-fg-faint">Years: {years}</span>
                    <input type="range" min={1} max={6} value={years} onChange={e => setYears(Number(e.target.value))} className="w-full" /></label>
                <label className="block"><span className="text-micro uppercase text-fg-faint">Guaranteed: {Math.round(g * 100)}% (${Math.round(salary * years * g)}M)</span>
                    <input type="range" min={0} max={100} step={5} value={Math.round(g * 100)} onChange={e => setG(Number(e.target.value) / 100)} className="w-full" /></label>
                <p className="text-label text-fg-muted">Guarantees make security-minded players accept a little less, but become dead money if you cut him. {stance.notes.join(' · ')}</p>
            </div>
        </Modal>
    );
}

function CapChart({ roster, deadCap, startYear }) {
    const years = [0, 1, 2, 3, 4].map(i => startYear + i);
    const rows = years.map((y, i) => {
        const players = roster.filter(p => (p.contract?.yearsLeft ?? 1) > i);
        const total = players.reduce((n, p) => n + (p.contract?.salary || 0), 0);
        const top = [...players].sort((a, b) => (b.contract?.salary || 0) - (a.contract?.salary || 0)).slice(0, 3);
        return { y, total, dead: deadCap?.[y] || 0, top, count: players.length };
    });
    return (
        <div className="space-y-2">
            {rows.map(r => (
                <div key={r.y} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-label font-bold tabular-nums">{r.y}</span>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-surface-sunken shadow-[0_0_0_2px_var(--ink)]">
                        <div className="absolute inset-y-0 left-0 bg-team" style={{ width: `${Math.min(100, r.total / 2)}%` }} />
                        {r.dead > 0 && <div className="absolute inset-y-0 bg-negative-solid" style={{ left: `${Math.min(100, r.total / 2)}%`, width: `${Math.min(100, r.dead / 2)}%` }} title={`Dead money $${r.dead}M`} />}
                        <span className="absolute inset-0 flex items-center px-3 text-micro text-fg">${r.total.toFixed(0)}M committed · {r.count} players{r.dead ? ` · $${r.dead}M dead` : ''}</span>
                    </div>
                    <span className="hidden w-56 shrink-0 truncate text-label text-fg-muted md:block">{r.top.map(p => `${p.name.split(' ').slice(-1)[0]} $${p.contract?.salary}M`).join(', ')}</span>
                </div>
            ))}
        </div>
    );
}

export default function Contracts({ onNavigate }) {
    const s = useGameStore();
    const { error, success } = useToast();
    const [editing, setEditing] = useState(null);
    const roster = useMemo(() => s.rosters[s.userTeamId] || [], [s.rosters, s.userTeamId]);
    const offseason = s.phase === 'offseason';
    const advice = offseason ? s.foResignAdvice() : [];
    const ctx = teamContext(s, s.userTeamId);
    const walkYear = roster.filter(p => (p.contract?.yearsLeft ?? 2) <= 1 && p.ovr >= 65).sort((a, b) => b.ovr - a.ovr);
    const tagged = Object.keys(s.frontOffice?.tagged || {}).length > 0;
    const run = (fn, ok) => { const r = fn(); if (r?.ok === false) error({ title: 'Not done', body: r.reason }); else success({ title: ok }); };

    return (
        <FOShell title="Contracts" eyebrow={offseason ? 'Re-sign & tag window' : 'Extensions and the five-year cap'}
            actions={offseason ? <Button variant="primary" onClick={() => { s.foApplyResignRecommendations(); s.foCompleteStage('resign'); onNavigate('command'); }}>Apply recommendations</Button> : null}>
            <StageStepper onNavigate={onNavigate} />
            <CapStrip />
            {offseason && (
                <Card>
                    <CardHeader eyebrow={`${advice.length} expiring`} title="Your free agents-to-be" action={tagged ? <Badge tone="info">Tag used</Badge> : <Badge>1 franchise tag available</Badge>} />
                    <CardBody className="space-y-2">
                        {!advice.length && <EmptyState size="sm" icon="✍️" title="No expiring contracts" body="Everyone is signed through next season." />}
                        {advice.map(({ player: p, stance, rec }) => (
                            <div key={p.id} className="grid items-center gap-2 rounded-card border-2 border-line bg-surface-raised p-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                                <PlayerCardCompact player={p} teamId="FA" className="border-0 p-0" sub={`${p.age} yrs · asks $${stance.ask}M · market ~$${askingSalary(p)}M${isRestricted(p) ? ' · restricted' : ''}`} />
                                <Badge tone={REC[rec].tone}>Scouts say: {REC[rec].label}</Badge>
                                <div className="flex flex-wrap gap-1.5">
                                    <Button size="sm" variant={rec === 'resign' ? 'primary' : 'secondary'} disabled={!stance.willing} onClick={() => setEditing({ p, stance })}>Re-sign</Button>
                                    <Button size="sm" disabled={tagged} onClick={() => run(() => s.foTag(p.id), `${p.name} tagged at $${tagPrice(s.rosters, p.position)}M`)}>Tag ${tagPrice(s.rosters, p.position)}M</Button>
                                    {isRestricted(p) && <Button size="sm" onClick={() => run(() => s.foTender(p.id, 'second'), `${p.name} tendered`)}>Tender ${TENDERS.second.price(p)}M</Button>}
                                </div>
                            </div>
                        ))}
                        {advice.length > 0 && <p className="text-label text-fg-muted">Anyone you don't sign now goes to the open market, where you can still bid — against everyone else.</p>}
                    </CardBody>
                </Card>
            )}
            {!offseason && (
                <Card>
                    <CardHeader eyebrow="Walk year" title="Extend before they hit the market" />
                    <CardBody className="space-y-2">
                        {!walkYear.length && <p className="text-label text-fg-muted">No contributors in a walk year.</p>}
                        {walkYear.map(p => {
                            const st = contractStance(p, ctx);
                            return (
                                <div key={p.id} className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                    <PlayerCardCompact player={p} teamId={s.userTeamId} sub={st.willing ? `Asks $${st.ask}M/yr · ${st.notes[0] || 'open to talks'}` : 'Won\'t talk extension'} />
                                    <Button size="sm" variant="primary" disabled={!st.willing} onClick={() => { const r = s.resignPlayer(s.userTeamId, p.id, st.ask, p.age <= 28 ? 4 : 2); r.accepted ? success({ title: `${p.name} extended` }) : error({ title: 'No deal', body: r.reason }); }}>Extend at ${st.ask}M</Button>
                                </div>
                            );
                        })}
                    </CardBody>
                </Card>
            )}
            <Card>
                <CardHeader eyebrow="Five-year view" title="Cap commitments" />
                <CardBody><CapChart roster={roster} deadCap={s.frontOffice?.deadCap} startYear={capYear(s)} /></CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="Dead money" title="If you cut them today" />
                <CardBody>
                    {(() => {
                        const hurt = roster.map(p => ({ p, d: deadMoney(p) })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 8);
                        return hurt.length ? <ul className="grid gap-1 sm:grid-cols-2">{hurt.map(({ p, d }) => <li key={p.id} className={cx('text-label')}>{p.name} ({p.position}) — <strong className="text-negative-fg">${d}M</strong></li>)}</ul> : <p className="text-label text-fg-muted">No guaranteed money on the books. Cutting anyone is free.</p>;
                    })()}
                </CardBody>
            </Card>
            {editing && <OfferEditor player={editing.p} stance={editing.stance} onClose={() => setEditing(null)} onSubmit={offer => { const r = s.foResign(editing.p.id, offer); if (r.ok) { success({ title: `${editing.p.name} re-signed` }); setEditing(null); } else error({ title: 'He said no', body: r.reason }); }} />}
        </FOShell>
    );
}
