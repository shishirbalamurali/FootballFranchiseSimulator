// Staff & coaching tree (Claude-owned): org chart with ratings, schemes and
// budget; your coaching tree as an interactive SVG; the hiring market with
// interviews; and the league's biggest trees.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { STAFF_BRANCHES } from '../../engine/franchiseStaff';
import { coachProfile, COACH_TRAITS, USER_ROLES, treeOf, treePrestige, leagueTrees, staffBudget, staffPayroll, candidateFit, interviewAnswers, INTERVIEW_QUESTIONS } from '../../engine/staffCareers';
import { SCHEMES } from '../../engine/schemes';
import { scoutOf } from '../../engine/scouting';
import { Card, CardHeader, CardBody, Button, Badge, Tabs, Modal, ConfirmModal, Meter, EmptyState, cx, useToast } from '../../components/ui';
import { FOShell, IdentityChips } from '../../components/frontOffice/FOBits';
import PlayerFace from '../../components/PlayerFace';

const team = id => TEAMS.find(t => t.id === id);
const ROLE_LABEL = { HC: 'Head coach', OC: 'Offensive coordinator', DC: 'Defensive coordinator', Assistant: 'Senior assistant', 'QB Coach': 'QB coach', Development: 'Development coach' };
const field = 'h-9 rounded-card border-2 border-line bg-surface-raised px-3 text-label text-fg';

function RatingBar({ label, value }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-micro uppercase text-fg-faint">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full bg-team" style={{ width: `${value}%` }} /></div>
            <span className="w-7 text-right text-label font-bold tabular-nums">{value}</span>
        </div>
    );
}

function CoachCard({ c, role, own, year, onCareer, onFire, successor, onSuccessor, revealTraits }) {
    const s = useGameStore();
    if (!c) return (
        <Card><CardBody className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-h2 uppercase text-fg-muted">{ROLE_LABEL[role]}</p>
            <p className="text-label text-fg-muted">Vacant. Hire from the market.</p>
        </CardBody></Card>
    );
    const p = coachProfile(c, year);
    return (
        <Card className={cx(successor && 'ring-4 ring-team-accent')}>
            <CardBody className="space-y-2.5">
                <div className="flex items-center gap-3">
                    <PlayerFace player={{ id: c.id, age: p.age }} teamId={c.teamId || 'FA'} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="text-micro uppercase text-fg-faint">{ROLE_LABEL[role] || role}{successor ? ' · successor' : ''}</p>
                        <p className="truncate font-display text-h2 uppercase leading-none">{c.name}</p>
                        <p className="text-label text-fg-muted">Age {p.age} · rep {c.reputation}{c.contract ? ` · $${c.contract.salary}M` : ` · ~$${p.salary}M`}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {(role === 'OC' || role === 'HC') && <Badge title={SCHEMES[p.scheme.offense].blurb}>{SCHEMES[p.scheme.offense].icon} {SCHEMES[p.scheme.offense].name}</Badge>}
                    {(role === 'DC' || role === 'HC') && <Badge title={SCHEMES[p.scheme.defense].blurb}>{SCHEMES[p.scheme.defense].icon} {SCHEMES[p.scheme.defense].name}</Badge>}
                    {(own || revealTraits) && p.traits.map(t => <Badge key={t} tone="info" title={COACH_TRAITS[t].text}>{COACH_TRAITS[t].icon} {COACH_TRAITS[t].label}</Badge>)}
                    {c.disgruntled === year && <Badge tone="negative">Disgruntled</Badge>}
                </div>
                <div className="space-y-1">
                    <RatingBar label="Offense" value={p.ratings.offense} />
                    <RatingBar label="Defense" value={p.ratings.defense} />
                    <RatingBar label="Development" value={p.ratings.development} />
                </div>
                {own && role !== 'HC' && c.points > 0 && (
                    <div className="flex flex-wrap gap-1.5">{Object.entries(STAFF_BRANCHES).map(([key, label]) => <Button key={key} size="sm" disabled={(c.skills?.[key] || 0) >= 3} onClick={() => s.upgradeStaff(c.id, key)}>+ {label.split(' ')[0]} ({c.skills?.[key] || 0}/3)</Button>)}</div>
                )}
                <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onCareer(c.id)}>Career</Button>
                    {own && role !== 'HC' && <Button size="sm" variant={successor ? 'accent' : 'ghost'} onClick={onSuccessor}>{successor ? 'Grooming ✓' : 'Groom as successor'}</Button>}
                    {own && role !== 'HC' && <Button size="sm" variant="danger" onClick={() => onFire(c)}>Fire</Button>}
                </div>
            </CardBody>
        </Card>
    );
}

/** Layered tree layout: leaves spaced evenly, parents centred over children. */
function layout(root) {
    const nodes = [], edges = [];
    let leaf = 0;
    const walk = (n, depth) => {
        const kids = n.children.map(k => walk(k, depth + 1));
        const x = kids.length ? (kids[0].x + kids.at(-1).x) / 2 : leaf++;
        const node = { c: n.coach, x, depth };
        nodes.push(node);
        kids.forEach(k => edges.push([node, k]));
        return node;
    };
    walk(root, 0);
    return { nodes, edges, width: Math.max(1, leaf), depth: Math.max(...nodes.map(n => n.depth)) + 1 };
}

function TreeView({ rootId, onCareer }) {
    const coaches = useGameStore(s => s.coachingStaff || []);
    const year = useGameStore(s => s.year);
    const tree = useMemo(() => treeOf(coaches, rootId), [coaches, rootId]);
    if (!tree) return null;
    if (!tree.children.length) return <EmptyState icon="🌳" title="Your tree is a sapling" body="Assistants you hire become your protégés. When they land head jobs elsewhere, your tree grows." />;
    const { nodes, edges, width, depth } = layout(tree);
    const W = Math.max(480, width * 120), H = depth * 110 + 40;
    const X = x => 60 + x * ((W - 120) / Math.max(1, width - 1 || 1));
    const Y = d => 40 + d * 110;
    const ring = c => (c.retired ? 'var(--border-default)' : c.role === 'HC' && c.teamId ? 'var(--team-primary)' : ['OC', 'DC'].includes(c.role) && c.teamId ? 'var(--info-solid)' : c.teamId ? 'var(--positive-solid)' : 'var(--text-faint)');
    return (
        <div className="overflow-x-auto rounded-card border-2 border-line bg-surface-raised">
            <svg width={W} height={H} role="img" aria-label="Your coaching tree">
                {edges.map(([a, b], i) => <path key={i} d={`M${X(a.x)},${Y(a.depth) + 24} C${X(a.x)},${Y(a.depth) + 60} ${X(b.x)},${Y(b.depth) - 60} ${X(b.x)},${Y(b.depth) - 24}`} fill="none" stroke="var(--border-default)" strokeWidth="2.5" />)}
                {nodes.map(n => {
                    const initials = n.c.name.split(' ').map(w => w[0]).join('').slice(0, 2);
                    const t = team(n.c.teamId);
                    return (
                        <g key={n.c.id} transform={`translate(${X(n.x)},${Y(n.depth)})`} className="cursor-pointer" onClick={() => onCareer(n.c.id)}>
                            <title>{`${n.c.name} · ${n.c.retired ? 'Retired' : `${t ? t.abbreviation : 'Available'} ${n.c.role}`} · age ${coachProfile(n.c, year).age}`}</title>
                            <circle r="24" fill="var(--surface-sunken)" stroke={ring(n.c)} strokeWidth="5" />
                            <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fill="var(--text-primary)">{initials}</text>
                            <text textAnchor="middle" y="42" fontSize="11" fill="var(--text-secondary)">{n.c.name.split(' ').slice(-1)[0]}</text>
                            <text textAnchor="middle" y="55" fontSize="10" fill="var(--text-faint)">{n.c.retired ? 'retired' : `${t?.abbreviation || 'free'} ${n.c.role}`}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export default function Staff() {
    const s = useGameStore();
    const { success, error } = useToast();
    const [tab, setTab] = useState('org');
    const [career, setCareer] = useState(null);
    const [firing, setFiring] = useState(null);
    const [hireRole, setHireRole] = useState('OC');
    const [interview, setInterview] = useState(null);
    const year = s.year;
    const staff = (s.coachingStaff || []).filter(c => c.teamId === s.userTeamId);
    const hc = staff.find(c => c.role === 'HC');
    const budget = staffBudget(s.owner?.trust ?? 60);
    const payroll = staffPayroll(s.coachingStaff || [], s.userTeamId, year, (s.scouting?.scouts || []).map(scoutOf));
    const market = (s.coachingStaff || []).filter(c => !c.teamId && !c.retired).sort((a, b) => (b.reputation || 0) - (a.reputation || 0)).slice(0, 30);
    const roster = s.rosters[s.userTeamId] || [];
    const trees = useMemo(() => leagueTrees(s.coachingStaff || [], 5), [s.coachingStaff]);
    const careerCoach = (s.coachingStaff || []).find(c => c.id === career);
    const interviewed = id => s.frontOffice?.interviewed?.[id] === year;
    return (
        <FOShell title="Staff & Tree" eyebrow="Coaches shape your schemes, your players and your legacy"
            actions={<div className="paper-scope text-right text-label"><p className="text-micro uppercase text-fg-faint">Tree prestige</p><p className="font-display text-h1">{hc ? treePrestige(s.coachingStaff, hc.id) : 0}</p></div>}>
            <Card><CardBody className="flex flex-wrap items-center gap-4">
                <Meter className="min-w-[240px] flex-1" value={payroll} max={budget} label="Staff budget (coaches + scouts)" caption={`$${payroll}M of $${budget}M`} color={payroll > budget ? 'var(--negative-solid)' : 'var(--team-primary)'} />
                <IdentityChips teamId={s.userTeamId} />
            </CardBody></Card>
            <Tabs value={tab} onChange={setTab} label="Staff sections" items={[{ id: 'org', label: 'Org chart' }, { id: 'tree', label: 'Your tree' }, { id: 'market', label: 'Market & interviews' }, { id: 'league', label: 'League trees' }]} />
            {tab === 'org' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {['HC', ...USER_ROLES].map(role => <CoachCard key={role} role={role} c={staff.find(c => c.role === role)} own year={year} onCareer={setCareer} onFire={setFiring} successor={s.frontOffice?.successorId === staff.find(c => c.role === role)?.id} onSuccessor={() => s.foSetSuccessor(staff.find(c => c.role === role)?.id)} />)}
                </div>
            )}
            {tab === 'tree' && hc && <TreeView rootId={hc.id} onCareer={setCareer} />}
            {tab === 'market' && (
                <Card>
                    <CardHeader title="Available coaches" eyebrow={`${5 - Object.values(s.frontOffice?.interviewed || {}).filter(y => y === year).length} interviews left this year`} action={<label className="text-label">Hire as <select className={field} value={hireRole} onChange={e => setHireRole(e.target.value)}>{USER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>} />
                    <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {market.map(c => {
                            const p = coachProfile({ ...c, role: hireRole }, year);
                            const fit = candidateFit(c, hireRole, roster, year);
                            return (
                                <div key={c.id} className="space-y-2 rounded-card border-2 border-line bg-surface-raised p-3">
                                    <div className="flex items-center gap-2">
                                        <PlayerFace player={{ id: c.id, age: p.age }} teamId="FA" size="sm" />
                                        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-micro text-fg-muted">Age {p.age} · {c.history?.some(h => h.role === 'HC') ? 'Former HC' : c.role} · rep {c.reputation} · ${p.salary}M</p></div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {hireRole === 'OC' && <Badge>{SCHEMES[p.scheme.offense].icon} {SCHEMES[p.scheme.offense].name}</Badge>}
                                        {hireRole === 'DC' && <Badge>{SCHEMES[p.scheme.defense].icon} {SCHEMES[p.scheme.defense].name}</Badge>}
                                        {fit != null && <Badge tone={fit >= 0.5 ? 'positive' : 'warning'}>{Math.round(fit * 100)}% of starters fit</Badge>}
                                        {interviewed(c.id) && p.traits.map(t => <Badge key={t} tone="info">{COACH_TRAITS[t].icon} {COACH_TRAITS[t].label}</Badge>)}
                                    </div>
                                    <p className="text-label text-fg-secondary">O {p.ratings.offense} · D {p.ratings.defense} · Dev {p.ratings.development}</p>
                                    <div className="flex gap-1.5">
                                        <Button size="sm" onClick={() => { const r = s.foInterviewCoach(c.id); if (r.ok) setInterview(c.id); else error({ title: 'No more interviews', body: r.reason }); }}>{interviewed(c.id) ? 'Interview notes' : 'Interview'}</Button>
                                        <Button size="sm" variant="primary" onClick={() => { const r = s.foHireCoach(c.id, hireRole); if (r.ok) success({ title: `${c.name} hired`, body: ROLE_LABEL[hireRole] }); else error({ title: 'Can\'t hire', body: r.reason }); }}>Hire</Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardBody>
                </Card>
            )}
            {tab === 'league' && (
                <Card>
                    <CardHeader title="The league's biggest trees" />
                    <CardBody className="space-y-2">
                        {trees.map(t => <button key={t.root.id} type="button" onClick={() => setCareer(t.root.id)} className="flex w-full items-center gap-3 rounded-card px-2 py-1.5 text-left hover:bg-surface-hover"><span className="font-semibold">{t.root.name}</span><span className="text-label text-fg-muted">{t.size} protégés · {t.headCoaches} head coaches</span><Badge className="ml-auto">Prestige {t.prestige}</Badge></button>)}
                        {!trees.length && <p className="text-label text-fg-muted">Trees grow as coaches move around the league.</p>}
                    </CardBody>
                </Card>
            )}
            <ConfirmModal open={!!firing} onClose={() => setFiring(null)} onConfirm={() => { s.fireStaff(firing.id); s.foRefreshIdentities(); }} title={`Fire ${firing?.name}?`} body="He returns to the market. Your scheme on that side of the ball changes when you hire a replacement." confirmLabel="Fire coach" destructive />
            <Modal open={!!careerCoach} onClose={() => setCareer(null)} title={careerCoach?.name} eyebrow={careerCoach ? `Age ${coachProfile(careerCoach, year).age}${careerCoach.retired ? ' · retired' : ''}` : ''}>
                {careerCoach && <div className="space-y-2">
                    {careerCoach.history.map((h, i) => <p key={i} className="text-label"><strong>{h.year}</strong> · {h.event} · {team(h.teamId)?.name || '—'} {h.role}</p>)}
                    <h3 className="pt-2 text-micro uppercase text-fg-faint">Protégés</h3>
                    {(s.coachingStaff || []).filter(c => c.mentorId === careerCoach.id).map(c => <p key={c.id} className="text-label">{c.name} → {c.retired ? 'retired' : `${team(c.teamId)?.name || 'available'} ${c.role}`}</p>)}
                </div>}
            </Modal>
            <Modal open={!!interview} onClose={() => setInterview(null)} title="Interview" eyebrow={(s.coachingStaff || []).find(c => c.id === interview)?.name}>
                {interview && <div className="space-y-3">{interviewAnswers((s.coachingStaff || []).find(c => c.id === interview), year).map((a, i) => <div key={i}><p className="text-label font-semibold">“{INTERVIEW_QUESTIONS[i]}”</p><p className="text-label italic text-fg-secondary">{a.answer}</p><Badge tone="info" className="mt-1">{a.trait.icon} {a.trait.label}</Badge></div>)}</div>}
            </Modal>
        </FOShell>
    );
}
