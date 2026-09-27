// Big Board (Claude-owned): your staff's read on the next class, the range
// bars that tighten as scouts work, tiers, visits, interviews, the combine,
// and the scouting department itself.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { userView, consensus, knowledgeOf, scoutOpinions, roundLabel, medicalOf, measurables, percentile, sleepers, proComp, scoutOf, ASSIGNMENTS, INTERVIEW_SLOTS, VISIT_SLOTS, projectedRound } from '../../engine/scouting';
import { REGIONS, biasInfo, SCOUT_ROLES } from '../../engine/people';
import { eventText, storyLabel, classForecast, regionOfSchool } from '../../engine/collegeSeason';
import { calculatePositionNeeds } from '../../engine/draft';
import { teamFit } from '../../engine/schemes';
import { hasXFPotential } from '../../engine/xFactor';
import { personalityView } from '../../engine/character';
import { staffBudget, staffPayroll } from '../../engine/staffCareers';
import { Card, CardHeader, CardBody, Button, Badge, Tabs, SegmentedControl, EmptyState, Modal, PositionTag, cx, useToast } from '../../components/ui';
import { FOShell, StageStepper } from '../../components/frontOffice/FOBits';
import { RangeBar } from '../../components/player/PlayerBits';
import PlayerFace from '../../components/PlayerFace';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
const TIERS = [
    { id: 'blue', label: 'Blue', cls: 'bg-info-solid text-n-0' },
    { id: 'red', label: 'Red', cls: 'bg-negative-solid text-n-0' },
    { id: 'green', label: 'Green', cls: 'bg-positive-solid text-n-0' },
    { id: 'dnd', label: 'Do not draft', cls: 'bg-fg text-fg-inverse' },
];
const field = 'h-9 rounded-card border-2 border-line bg-surface-raised px-3 text-label text-fg';

/** Prospects for the next draft: the real class if it exists, else pipeline rows. */
function useProspects() {
    const draftClass = useGameStore(s => s.draftClass);
    const pipeline = useGameStore(s => s.collegePipeline);
    const year = useGameStore(s => s.year);
    return useMemo(() => {
        if (draftClass?.length) return { list: draftClass, real: true };
        const dy = year + 1;
        return { list: (pipeline || []).filter(p => p.draftYear === dy).map(p => ({ ...p, ovr: p.readyOvr, pot: p.ceiling, college: p.school, collegeRecruitTier: p.tier, age: 21 })), real: false };
    }, [draftClass, pipeline, year]);
}

function ProspectDrawer({ p, onClose, real }) {
    const s = useGameStore();
    const { error } = useToast();
    const v = userView(p, s.scouting, s.userTeamId);
    const ops = scoutOpinions(p, s.scouting, s.userTeamId);
    const pipe = (s.collegePipeline || []).find(x => x.id === (p.collegeId || p.id));
    const interviewed = s.scouting?.interviews?.includes(p.id);
    const view = real ? personalityView(p, { scouted: interviewed }) : null;
    const comp = real ? proComp(p, s.rosters) : null;
    const meas = real ? measurables(p) : null;
    const med = real && s.scouting?.combineYear === s.year ? medicalOf(p) : null;
    const act = r => { if (r?.ok === false) error({ title: 'Not done', body: r.reason }); };
    return (
        <Modal open onClose={onClose} size="lg" title={p.name} eyebrow={`${p.position} · ${p.college || p.school}${storyLabel(pipe || p) ? ` · ${storyLabel(pipe || p)}` : ''}`}
            footer={<>
                <Button variant="ghost" onClick={() => s.foToggleBoard(p.id)}>{s.scouting?.board?.order?.includes(p.id) ? 'Remove from board' : 'Add to board'}</Button>
                {real && <Button onClick={() => act(s.foInterview(p.id))} disabled={interviewed}>{interviewed ? 'Interviewed' : `Interview (${INTERVIEW_SLOTS - (s.scouting?.interviews?.length || 0)} left)`}</Button>}
                <Button variant="primary" onClick={() => act(s.foVisit(p.id))} disabled={s.scouting?.visits?.includes(p.id)}>{s.scouting?.visits?.includes(p.id) ? 'Visited' : `Private workout (${VISIT_SLOTS - (s.scouting?.visits?.length || 0)} left)`}</Button>
            </>}>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <PlayerFace player={p} teamId="FA" size={72} lazy={false} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between"><p className="text-micro uppercase text-fg-faint">Our grade · {v.k}% known</p><p className="font-display text-h1 tabular-nums">{v.lo}–{v.hi}</p></div>
                        <RangeBar lo={v.lo} hi={v.hi} mark={v.ovr} />
                        <p className="mt-1 text-label text-fg-muted">Ceiling {v.potLo}–{v.potHi} · projected {roundLabel(projectedRound(v.grade))} round{hasXFPotential(p) && v.k >= 50 ? ' · ⚡ X-Factor potential' : ''}</p>
                    </div>
                </div>
                <section>
                    <h3 className="mb-2 text-micro uppercase text-fg-faint">The war room</h3>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {ops.map(o => (
                            <div key={o.scout.id} className="rounded-card bg-surface-sunken p-2.5">
                                <p className="text-label font-bold">{o.scout.name}</p>
                                <p className="text-micro uppercase text-fg-faint">{SCOUT_ROLES[o.scout.role]}{o.scout.region ? ` · ${o.scout.region}` : ''}</p>
                                <p className="mt-1 font-display text-h2">{roundLabel(o.round)} round</p>
                                <p className="text-label italic text-fg-secondary">“{o.quote}”</p>
                                {o.bias.id !== 'none' && <p className="text-micro text-fg-faint">{o.bias.label}</p>}
                            </div>
                        ))}
                    </div>
                </section>
                {meas && (
                    <section>
                        <h3 className="mb-2 text-micro uppercase text-fg-faint">Combine</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {[['40', meas.forty], ['Vertical', `${meas.vertical}"`], ['Bench', meas.bench], ['Shuttle', meas.shuttle]].map(([k, val]) => <div key={k} className="rounded-card bg-surface-sunken px-2.5 py-2"><p className="text-micro uppercase text-fg-faint">{k}</p><p className="font-display text-h2">{val}</p></div>)}
                            {med && <div className="rounded-card bg-surface-sunken px-2.5 py-2"><p className="text-micro uppercase text-fg-faint">Medical</p><Badge tone={med.tone}>{med.label}</Badge></div>}
                        </div>
                    </section>
                )}
                {view && (
                    <section>
                        <h3 className="mb-2 text-micro uppercase text-fg-faint">Character {interviewed ? '(interviewed)' : '(public)'}</h3>
                        <div className="flex flex-wrap gap-1.5">{view.traits.map(t => <Badge key={t.id} title={t.effect}>{t.icon} {t.label}</Badge>)}{view.hiddenTraits > 0 && <Badge>🔒 +{view.hiddenTraits} unknown</Badge>}{!view.traits.length && !view.hiddenTraits && <Badge>Even-keeled</Badge>}</div>
                    </section>
                )}
                {comp && <p className="text-label">Pro comp: plays like <strong>{comp.name}</strong> ({TEAMS.find(t => t.id === comp.teamId)?.abbreviation}).</p>}
                {pipe && (
                    <section>
                        <h3 className="mb-2 text-micro uppercase text-fg-faint">College story</h3>
                        <ol className="space-y-1.5 border-l-2 border-line pl-3">
                            {pipe.events.map((e, i) => <li key={i} className="text-label"><strong>{e.year}</strong> · {eventText(pipe, e)}</li>)}
                        </ol>
                        <div className="mt-2 space-y-1">
                            {pipe.seasons.filter(r => r.games).map(r => <p key={r.year} className="text-label text-fg-secondary"><strong>{r.year}</strong> · {r.games} g · {Object.entries(r.stats).map(([k, val]) => `${val} ${k.replace('_', ' ').toLowerCase()}`).join(' · ')}</p>)}
                        </div>
                    </section>
                )}
            </div>
        </Modal>
    );
}

function BoardTab({ prospects, real }) {
    const s = useGameStore();
    const [pos, setPos] = useState('ALL');
    const [view, setView] = useState('all');
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(80);
    const [open, setOpen] = useState(null);
    const ids = useMemo(() => TEAMS.map(t => t.id).filter(id => id !== s.userTeamId), [s.userTeamId]);
    const cons = useMemo(() => consensus(prospects, ids), [prospects, ids]);
    const needs = useMemo(() => calculatePositionNeeds(s.rosters[s.userTeamId] || []), [s.rosters, s.userTeamId]);
    // Rank positions by need: the top three show as ●●● / ●●○ / ●○○.
    const needRank = useMemo(() => Object.fromEntries(Object.entries(needs).sort((a, b) => b[1] - a[1]).map(([pos], i) => [pos, i])), [needs]);
    const identity = s.frontOffice?.identities?.[s.userTeamId];
    const board = s.scouting?.board || { order: [], tiers: {} };
    const sleeperIds = useMemo(() => new Set(sleepers(prospects, s.scouting, s.userTeamId, cons)), [prospects, s.scouting, s.userTeamId, cons]);
    const rows = useMemo(() => {
        const base = prospects.map(p => {
            const v = userView(p, s.scouting, s.userTeamId);
            const c = cons.get(p.id);
            return { p, v, c, gap: v.grade - (c?.grade || v.grade), fit: identity && p.attributes ? teamFit(p, identity) : null, need: needRank[p.position] ?? 9, onBoard: board.order.indexOf(p.id) };
        });
        let list = base.filter(r => (pos === 'ALL' || r.p.position === pos) && (!q || `${r.p.name} ${r.p.college || r.p.school}`.toLowerCase().includes(q.toLowerCase())));
        if (view === 'board') list = list.filter(r => r.onBoard >= 0).sort((a, b) => a.onBoard - b.onBoard);
        else if (view === 'disagree') list = list.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 60);
        else list = list.sort((a, b) => (a.onBoard >= 0 ? a.onBoard : 999) - (b.onBoard >= 0 ? b.onBoard : 999) || b.v.grade - a.v.grade);
        return list;
    }, [prospects, s.scouting, s.userTeamId, cons, identity, needRank, board.order, pos, q, view]);
    const move = (id, dir) => {
        const order = [...board.order];
        const i = order.indexOf(id), j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return;
        [order[i], order[j]] = [order[j], order[i]];
        s.foSetBoard(order);
    };
    const forecast = classForecast(s.collegePipeline || [], s.year + 1);
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl value={view} onChange={setView} items={[{ id: 'all', label: 'Everyone' }, { id: 'board', label: `My board (${board.order.length})` }, { id: 'disagree', label: 'Where we disagree' }]} />
                <select className={field} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position">{POSITIONS.map(x => <option key={x}>{x}</option>)}</select>
                <input className={cx(field, 'min-w-0 flex-1')} placeholder="Search name or school" value={q} onChange={e => setQ(e.target.value)} aria-label="Search prospects" />
                <Badge tone="info">{forecast.label}: {forecast.blueChips} blue-chip talents</Badge>
            </div>
            {!real && <p className="text-label text-fg-muted">The class isn't official until the combine; these are next year's seniors and declared juniors, graded from college tape.</p>}
            <div className="overflow-x-auto rounded-card border-2 border-ink">
                <table className="w-full min-w-[860px] text-label">
                    <thead className="bg-surface-sunken text-micro uppercase text-fg-faint">
                        <tr><th className="px-2 py-2 text-left">#</th><th className="px-2 text-left">Prospect</th><th className="px-2 text-left">Our grade</th><th className="px-2">Known</th><th className="px-2">Fit</th><th className="px-2">Need</th><th className="px-2">Consensus</th><th className="px-2 text-left">Flags</th><th className="px-2 text-right">Board</th></tr>
                    </thead>
                    <tbody>
                        {rows.slice(0, limit).map((r, i) => {
                            const tier = TIERS.find(t => t.id === board.tiers?.[r.p.id]);
                            return (
                                <tr key={r.p.id} className={cx('border-t border-line-subtle', r.onBoard >= 0 && 'bg-team-8')}>
                                    <td className="px-2 py-1.5 tabular-nums text-fg-muted">{r.onBoard >= 0 ? r.onBoard + 1 : i + 1}</td>
                                    <td className="px-2"><button type="button" onClick={() => setOpen(r.p)} className="flex min-w-0 items-center gap-2 text-left"><PositionTag position={r.p.position} /><span className="min-w-0"><span className="block truncate font-semibold text-fg">{r.p.name}</span><span className="block truncate text-micro text-fg-faint">{r.p.college || r.p.school}{r.p.collegeRecruitTier && r.p.collegeRecruitTier !== 'Normal' ? ` · ${r.p.collegeRecruitTier}` : ''}</span></span></button></td>
                                    <td className="w-56 px-2"><div className="flex items-center gap-2"><RangeBar className="flex-1" lo={r.v.lo} hi={r.v.hi} mark={r.v.ovr} label={`OVR ${r.v.lo}–${r.v.hi}, ceiling ${r.v.potLo}–${r.v.potHi}`} /><span className="w-14 text-right text-micro tabular-nums text-fg-muted">{r.v.lo}–{r.v.hi}</span><span className="w-8 text-right font-bold tabular-nums" title="Our draft grade">{r.v.grade}</span></div></td>
                                    <td className="px-2 text-center tabular-nums">{knowledgeOf(s.scouting, r.p.id)}%</td>
                                    <td className="px-2 text-center tabular-nums">{r.fit ?? '—'}</td>
                                    <td className="px-2 text-center" title={`#${r.need + 1} need`}>{r.need === 0 ? '●●●' : r.need === 1 ? '●●○' : r.need === 2 ? '●○○' : '○○○'}</td>
                                    <td className="px-2 text-center tabular-nums" title={`Projected picks ${r.c?.lo}–${r.c?.hi}`}>#{r.c?.rank}<span className={cx('ml-1 text-micro', r.gap > 2 ? 'text-positive-fg' : r.gap < -2 ? 'text-negative-fg' : 'text-fg-faint')}>{r.gap > 0 ? '+' : ''}{Math.round(r.gap)}</span></td>
                                    <td className="px-2"><div className="flex flex-wrap gap-1">{sleeperIds.has(r.p.id) && <Badge tone="positive">Sleeper</Badge>}{hasXFPotential(r.p) && r.v.k >= 50 && <Badge tone="solid">⚡ XF pot.</Badge>}{real && s.scouting?.combineYear === s.year && medicalOf(r.p).id !== 'clean' && <Badge tone={medicalOf(r.p).tone}>🩺 {medicalOf(r.p).label}</Badge>}{s.scouting?.visits?.includes(r.p.id) && <Badge>Visited</Badge>}{tier && <span className={cx('rounded-full px-2 text-micro', tier.cls)}>{tier.label}</span>}</div></td>
                                    <td className="px-2 text-right"><div className="flex justify-end gap-1">
                                        {r.onBoard >= 0 && <><Button size="sm" variant="ghost" onClick={() => move(r.p.id, -1)} aria-label="Move up">↑</Button><Button size="sm" variant="ghost" onClick={() => move(r.p.id, 1)} aria-label="Move down">↓</Button></>}
                                        <select className="h-8 w-24 rounded-chip border-2 border-line bg-surface-raised px-1 text-micro" value={board.tiers?.[r.p.id] || ''} onChange={e => s.foSetTier(r.p.id, e.target.value || null)} aria-label="Tier"><option value="">Tier</option>{TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                                        <Button size="sm" variant={r.onBoard >= 0 ? 'secondary' : 'accent'} onClick={() => s.foToggleBoard(r.p.id)}>{r.onBoard >= 0 ? '★' : '☆'}</Button>
                                    </div></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {rows.length > limit && <Button onClick={() => setLimit(l => l + 80)}>Show more ({rows.length - limit})</Button>}
            {!rows.length && <EmptyState size="sm" icon="🔎" title="No prospects match" body="Clear a filter or add players to your board." />}
            {open && <ProspectDrawer p={open} real={real} onClose={() => setOpen(null)} />}
        </div>
    );
}

function OfficeTab({ prospects }) {
    const s = useGameStore();
    const { error, success } = useToast();
    const scouts = (s.scouting?.scouts || []).map(scoutOf);
    const board = s.scouting?.board?.order || [];
    const byId = new Map(prospects.map(p => [p.id, p]));
    const proTargets = useMemo(() => Object.entries(s.rosters).filter(([t]) => t !== s.userTeamId).flatMap(([t, r]) => r.map(p => ({ ...p, teamId: t }))).sort((a, b) => b.ovr - a.ovr).slice(0, 40), [s.rosters, s.userTeamId]);
    const [role, setRole] = useState('area');
    const [region, setRegion] = useState(REGIONS[0]);
    const budget = staffBudget(s.owner?.trust ?? 60);
    const payroll = staffPayroll(s.coachingStaff || [], s.userTeamId, s.year, scouts);
    const set = (sc, value) => {
        const [type, target] = value.split('|');
        if (!type) return s.foAssignScout(sc.id, undefined);
        s.foAssignScout(sc.id, { type, target: target || (type === 'region' ? sc.region : undefined) });
    };
    return (
        <div className="space-y-4">
            <p className="text-label text-fg-muted">Each scout gets one assignment a week. Leave it on auto and they work from your board. Staff budget ${payroll}M of ${budget}M (shared with coaches).</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scouts.map(sc => {
                    const a = s.scouting.assignments?.[sc.id];
                    const hr = s.scouting.hitRates?.[sc.id];
                    return (
                        <Card key={sc.id}>
                            <CardBody className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <PlayerFace player={{ id: sc.id, age: sc.age }} teamId={s.userTeamId} size="md" />
                                    <div className="min-w-0 flex-1"><p className="truncate font-display text-h2 uppercase">{sc.name}</p><p className="text-label text-fg-muted">{SCOUT_ROLES[sc.role]}{sc.region ? ` · ${sc.region}` : ''} · ${sc.salary}M</p></div>
                                    {sc.role !== 'director' && <Button size="sm" variant="ghost" onClick={() => s.foFireScout(sc.id)}>Fire</Button>}
                                </div>
                                <div className="flex flex-wrap gap-1.5"><Badge>👁 Eye {sc.eye}</Badge><Badge title={biasInfo(sc.bias).text}>{biasInfo(sc.bias).label}</Badge><Badge tone={hr && hr.hits >= hr.misses ? 'positive' : 'neutral'}>Hits {hr ? `${hr.hits}/${hr.hits + hr.misses}` : '—'}</Badge></div>
                                <select className={cx(field, 'w-full')} value={a ? `${a.type}|${a.target || ''}` : ''} onChange={e => set(sc, e.target.value)} aria-label={`Assignment for ${sc.name}`}>
                                    <option value="">Auto (from my board)</option>
                                    <option value={`region|${sc.region || REGIONS[0]}`}>Cover {sc.region || 'a region'}</option>
                                    {REGIONS.filter(r => r !== sc.region).map(r => <option key={r} value={`region|${r}`}>Cover {r}</option>)}
                                    {board.slice(0, 25).map(id => byId.get(id) && <option key={id} value={`${sc.role === 'director' ? 'crosscheck' : 'watch'}|${id}`}>{sc.role === 'director' ? 'Cross-check' : 'Watch'} {byId.get(id).name}</option>)}
                                    {proTargets.map(p => <option key={p.id} value={`pro|${p.id}`}>Pro: {p.name} ({TEAMS.find(t => t.id === p.teamId)?.abbreviation} {p.position})</option>)}
                                </select>
                                {a && <p className="text-micro text-fg-faint">{ASSIGNMENTS[a.type]?.blurb}</p>}
                            </CardBody>
                        </Card>
                    );
                })}
            </div>
            <Card>
                <CardHeader title="Hire a scout" />
                <CardBody className="flex flex-wrap items-center gap-2">
                    <select className={field} value={role} onChange={e => setRole(e.target.value)} aria-label="Role"><option value="area">Area scout</option><option value="national">National scout</option></select>
                    {role === 'area' && <select className={field} value={region} onChange={e => setRegion(e.target.value)} aria-label="Region">{REGIONS.map(r => <option key={r}>{r}</option>)}</select>}
                    <Button variant="primary" onClick={() => { const r = s.foHireScout(role, role === 'area' ? region : null); if (r.ok) success({ title: `Hired ${r.scout.name}` }); else error({ title: 'Can\'t hire', body: r.reason }); }}>Hire</Button>
                    <span className="text-label text-fg-muted">Scouts' eye and bias are revealed once hired. Regions: {REGIONS.map(r => `${r} (${prospects.filter(p => regionOfSchool(p.college || p.school) === r).length})`).join(', ')}.</span>
                </CardBody>
            </Card>
        </div>
    );
}

function CombineTab({ prospects }) {
    const s = useGameStore();
    const [pos, setPos] = useState('WR');
    if (s.scouting?.combineYear !== s.year) return <EmptyState icon="⏱️" title="The combine hasn't happened yet" body="It runs as an offseason stage. Measurables and medicals become public for every team." action="Run the combine" onAction={() => s.foRunCombine()} />;
    const group = prospects.filter(p => p.position === pos).map(p => ({ p, m: measurables(p) }));
    const all = { forty: group.map(x => x.m.forty), vertical: group.map(x => x.m.vertical), bench: group.map(x => x.m.bench), shuttle: group.map(x => x.m.shuttle) };
    return (
        <div className="space-y-3">
            <select className={field} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position">{POSITIONS.slice(1).map(x => <option key={x}>{x}</option>)}</select>
            <div className="overflow-x-auto rounded-card border-2 border-ink">
                <table className="w-full min-w-[640px] text-label">
                    <thead className="bg-surface-sunken text-micro uppercase text-fg-faint"><tr><th className="px-2 py-2 text-left">Prospect</th><th>40</th><th>Vert</th><th>Bench</th><th>Shuttle</th><th>Medical</th></tr></thead>
                    <tbody>
                        {group.sort((a, b) => Number(a.m.forty) - Number(b.m.forty)).map(({ p, m }) => {
                            const med = medicalOf(p);
                            const cell = (v, arr, low) => { const pc = percentile(v, arr, low); return <td className={cx('px-2 text-center tabular-nums', pc >= 80 ? 'font-bold text-positive-fg' : pc <= 20 ? 'text-negative-fg' : '')}>{v}</td>; };
                            return <tr key={p.id} className="border-t border-line-subtle"><td className="px-2 py-1.5 font-semibold">{p.name}</td>{cell(m.forty, all.forty, true)}{cell(m.vertical, all.vertical)}{cell(m.bench, all.bench)}{cell(m.shuttle, all.shuttle, true)}<td className="px-2 text-center"><Badge tone={med.tone}>{med.label}</Badge></td></tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function BigBoard({ onNavigate }) {
    const s = useGameStore();
    const [tab, setTab] = useState('board');
    const { list, real } = useProspects();
    return (
        <FOShell title="Big Board" eyebrow={`${s.year + 1} draft class · ${list.length} prospects`} wide
            actions={<Button variant="primary" onClick={() => s.foSetBoard(list.map(p => ({ p, g: userView(p, s.scouting, s.userTeamId).grade })).sort((a, b) => b.g - a.g).slice(0, 60).map(x => x.p.id))}>Auto-rank top 60</Button>}>
            <StageStepper onNavigate={onNavigate} />
            <Tabs value={tab} onChange={setTab} label="Big board sections" items={[{ id: 'board', label: 'Board' }, { id: 'office', label: 'Scouting office' }, { id: 'combine', label: 'Combine' }]} />
            {tab === 'board' && <BoardTab prospects={list} real={real} />}
            {tab === 'office' && <OfficeTab prospects={list} />}
            {tab === 'combine' && <CombineTab prospects={list} />}
        </FOShell>
    );
}
