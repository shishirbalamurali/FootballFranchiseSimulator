import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { ASSISTANT_DEFAULTS, assistantPlan } from '../engine/frontOfficeAssistant';
import { STAFF_BRANCHES, STAFF_ROLES, staffBonuses } from '../engine/franchiseStaff';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, Modal, ConfirmModal, EmptyState } from '../components/ui';

const field = 'rounded-card border-2 border-line bg-surface-raised px-3 py-2 text-fg';
const teamName = id => TEAMS.find(t => t.id === id)?.name || 'Available';
function useFranchise() {
    const state = useGameStore();
    useEffect(() => { useGameStore.getState().ensureFranchiseSystems(); }, []);
    return state;
}
function Shell({ title, eyebrow, children }) {
    const id = useGameStore(s => s.userTeamId);
    return <><PageHeader title={title} eyebrow={eyebrow} team={TEAMS.find(t => t.id === id)} /><main className="mx-auto max-w-content space-y-6 p-4 sm:p-6">{children}</main></>;
}
export function Assistants() {
    const s = useFranchise();
    const settings = { ...ASSISTANT_DEFAULTS, ...s.assistantSettings };
    const roster = s.rosters[s.userTeamId] || [];
    const plan = assistantPlan(roster, settings);
    const [query, setQuery] = useState('');
    const [apply, setApply] = useState(false);
    const patch = s.setAssistantSettings;
    return <Shell title="Your front office" eyebrow="Delegate the paperwork. Keep the decisions.">
        <div className="grid gap-4 md:grid-cols-3">{[['Cap room now', `$${(200-plan.capBefore).toFixed(1)}M`], ['After assistant plan', `$${(200-plan.capAfter).toFixed(1)}M`], ['Reserved for flexibility', `$${settings.reserve}M`]].map(([label,value]) => <Card key={label}><CardBody><p className="text-label text-fg-muted">{label}</p><p className="font-display text-h1">{value}</p></CardBody></Card>)}</div>
        <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader title="Choose what to delegate" /><CardBody className="space-y-5">
            <p className="text-body text-fg-muted">Both assistants start off. Enabled assistants act before each weekly simulation and before contracts expire at season end. You can turn them off at any time.</p>
            {[['contracts','Contract assistant','Renew expiring contributors at their asking price, within your limits.'],['cap','Cap assistant','Release unprotected depth to restore your reserve. Never releases positional starters or cuts below 46 players.']].map(([key,title,description]) => <label key={key} className="flex gap-3 rounded-card bg-surface-sunken p-3"><input type="checkbox" className="mt-1 size-5" checked={settings[key]} onChange={e => patch({ [key]: e.target.checked })} /><span><strong>{title}</strong><span className="block text-label text-fg-muted">{description}</span></span></label>)}
            <div className="grid gap-3 sm:grid-cols-3">{[['reserve','Cap reserve ($M)',0,50],['maxSalary','Max annual offer ($M)',1,50],['maxYears','Max contract years',2,3]].map(([key,label,min,max]) => <label key={key} className="text-label">{label}<input aria-label={label} type="number" min={min} max={max} className={`${field} mt-1 w-full`} value={settings[key]} onChange={e => patch({ [key]: e.target.value })} /></label>)}</div>
            <p className="text-label text-fg-muted">Extensions use the game's current salary model: the negotiated salary replaces the current cap charge. These assistants do not restructure bonuses or move money into future years.</p>
        </CardBody></Card><Card><CardHeader title="Next assistant actions" /><CardBody className="space-y-3">
            {!settings.cap && !settings.contracts && <p>Enable a task to preview its recommendations.</p>}
            {plan.actions.map(a => <div key={`${a.type}-${a.playerId}`} className="border-b border-line pb-2"><strong>{a.type === 'extend' ? 'Renew' : 'Release'} {a.name}</strong><p className="text-label">{a.type === 'extend' ? `$${a.salary}M × ${a.years} years` : `$${a.salary}M cap savings`}</p><p className="text-label text-fg-muted">{a.reason}</p></div>)}
            {plan.notices.map((n,i) => <p key={i} className="text-label text-warning-fg">{n}</p>)}
            {!plan.actions.length && (settings.cap || settings.contracts) && <p>No safe transactions are needed within your limits.</p>}
            <Button variant="primary" disabled={!plan.actions.length || s.phase === 'draft'} onClick={() => setApply(true)}>Apply this plan now</Button>
            {s.phase === 'draft' && <p className="text-label">Assistant transactions pause during the draft.</p>}
        </CardBody></Card></div>
        <Card><CardHeader title="Players only you can manage" /><CardBody><p className="mb-3 text-label text-fg-muted">Checked players are excluded from both renewals and releases.</p><input className={`${field} mb-3 w-full`} placeholder="Find a player to protect" aria-label="Find a player to protect" value={query} onChange={e => setQuery(e.target.value)} /><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{roster.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => <label key={p.id} className="flex items-center gap-2 text-label"><input type="checkbox" checked={settings.protectedIds.includes(p.id)} onChange={() => patch({ protectedIds: settings.protectedIds.includes(p.id) ? settings.protectedIds.filter(id => id !== p.id) : [...settings.protectedIds,p.id] })} />{p.name} · {p.position} · {p.ovr}</label>)}</div></CardBody></Card>
        <Card><CardHeader title="Assistant reports" /><CardBody>{!s.assistantLog.length && <p className="text-fg-muted">Completed work and decisions left for you will appear here.</p>}{s.assistantLog.map((entry,i) => <div key={i} className="mb-4"><strong>{entry.year} · {entry.phase} · Week {entry.week}</strong>{[...entry.reports,...entry.notices].map((text,j) => <p key={j} className="text-label">{text}</p>)}</div>)}</CardBody></Card>
        <ConfirmModal open={apply} onClose={() => setApply(false)} onConfirm={s.runAssistants} title="Apply assistant plan?" body={`Execute ${plan.actions.length} listed transactions under your current limits. Releases remove players from your roster.`} confirmLabel="Apply plan" />
    </Shell>;
}
export function CoachingStaff() {
    const s = useFranchise();
    const [viewTeam, setViewTeam] = useState(s.userTeamId);
    const [hireRole, setHireRole] = useState('OC');
    const [firing, setFiring] = useState(null);
    const [message, setMessage] = useState('');
    const [career, setCareer] = useState(null);
    const staff = s.coachingStaff.filter(c => c.teamId === viewTeam);
    const market = s.coachingStaff.filter(c => !c.teamId).sort((a,b) => b.reputation-a.reputation);
    const bonuses = staffBonuses(s.coachingStaff, viewTeam);
    return <Shell title="Coaching tree" eyebrow="Build a staff. Build a legacy.">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-body text-fg-muted">Coordinators shape your offense and defense. Every completed season earns skill points; winning raises reputation. Successful assistants can leave for head-coach vacancies.</p><select className={field} aria-label="View coaching staff" value={viewTeam} onChange={e => setViewTeam(e.target.value)}>{TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="rounded-card bg-surface-sunken p-4 text-label">Game-day impact: passing +{bonuses.passingBoost.toFixed(1)} · rushing +{bonuses.rushingBoost.toFixed(1)} · defense +{bonuses.defenseBoost.toFixed(1)} · morale +{bonuses.moraleBoost.toFixed(1)}. Applied in the regular season and playoffs.</div>
        <div className="grid gap-5 md:grid-cols-2">{STAFF_ROLES.map(role => { const c = staff.find(coach => coach.role === role); return <Card key={role}><CardHeader title={role === 'Assistant' ? 'Senior assistant' : role} eyebrow={c ? `${c.reputation} reputation · ${c.points} skill points` : 'Vacant'} /><CardBody className="space-y-3">{!c ? <p>No coach hired. This role provides no game-day contribution.</p> : <><h3 className="font-display text-h2">{c.name}</h3><p className="text-label text-fg-muted">Mentor: {s.coachingStaff.find(x => x.id === c.mentorId)?.name || 'Independent coaching roots'}</p><div className="space-y-2">{Object.entries(STAFF_BRANCHES).map(([key,label]) => <div key={key} className="flex items-center justify-between gap-2"><span className="text-label">{label} · {c.skills[key] || 0}/3</span><Button size="sm" aria-label={`Develop ${c.name}: ${label}`} disabled={viewTeam !== s.userTeamId || c.points < 1 || c.skills[key] >= 3} onClick={() => s.upgradeStaff(c.id,key)}>Develop</Button></div>)}</div><p className="text-label text-fg-muted">Each rank adds +0.35 to its game-day category. Offensive ranks improve passing and rushing.</p><div className="flex gap-2"><Button size="sm" onClick={() => setCareer(c.id)}>Career & protégés</Button>{viewTeam === s.userTeamId && role !== 'HC' && <Button size="sm" variant="danger" onClick={() => setFiring(c)}>Fire</Button>}</div></>}</CardBody></Card>; })}</div>
        <Card><CardHeader title="Coaching market" eyebrow="Former head coaches can join as coordinators or assistants" /><CardBody><div className="mb-4 flex flex-wrap items-center gap-3"><label>Hire for <select className={field} value={hireRole} onChange={e => setHireRole(e.target.value)}>{STAFF_ROLES.slice(1).map(role => <option key={role}>{role}</option>)}</select></label><p className="text-label text-fg-muted">Hires are for your team. Fire the incumbent to open a position. Staff salaries are outside the player cap.</p></div><p role="status" className="mb-2 text-label">{message}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{market.map(c => <div key={c.id} className="rounded-card bg-surface-sunken p-3"><strong>{c.name}</strong><p className="mb-2 text-label">{c.role === 'HC' ? 'Head-coach experience' : c.role} · Reputation {c.reputation}</p><div className="flex gap-2"><Button size="sm" onClick={() => { const result = s.hireStaff(c.id,hireRole); setMessage(result.ok ? `${c.name} hired as ${hireRole}.` : result.reason); }}>Hire {hireRole}</Button><Button size="sm" variant="ghost" onClick={() => setCareer(c.id)}>Career</Button></div></div>)}</div></CardBody></Card>
        <p className="text-label text-fg-muted">CPU head coaches are fired after four or fewer wins, or two consecutive seasons with six or fewer wins. Your head coach stays under your control. The hiring carousel runs after the championship.</p>
        <ConfirmModal open={!!firing} onClose={() => setFiring(null)} onConfirm={() => s.fireStaff(firing.id)} title={`Fire ${firing?.name}?`} body="The coach returns to the hiring market. Their role stays vacant until you appoint a replacement." confirmLabel="Fire coach" destructive />
        <Modal open={!!career} onClose={() => setCareer(null)} title={s.coachingStaff.find(c => c.id === career)?.name || 'Coaching career'}><div className="space-y-3">{s.coachingStaff.find(c => c.id === career)?.history.map((h,i) => <p key={i}>{h.year} · {h.event} · {teamName(h.teamId)} {h.role}</p>)}<h3 className="font-bold">Coaching tree</h3>{s.coachingStaff.filter(c => c.mentorId === career).map(c => <p key={c.id}>{c.name} → {teamName(c.teamId)} {c.role}</p>)}{!s.coachingStaff.some(c => c.mentorId === career) && <p className="text-fg-muted">No protégés yet.</p>}</div></Modal>
    </Shell>;
}
export function CollegeWatch() {
    const s = useFranchise();
    const [year, setYear] = useState('all');
    const [search, setSearch] = useState('');
    const [watched, setWatched] = useState(false);
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState(null);
    const rows = useMemo(() => s.collegePipeline.filter(p => (year === 'all' || p.draftYear === Number(year)) && (!watched || s.collegeWatchlist.includes(p.id)) && `${p.name} ${p.position} ${p.school} ${p.tier}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => ({Generational:3,Elite:2,Good:1,Normal:0}[b.tier] - {Generational:3,Elite:2,Good:1,Normal:0}[a.tier]) || a.name.localeCompare(b.name)), [s.collegePipeline,s.collegeWatchlist,year,watched,search]);
    const currentPage = Math.min(page, Math.max(0,Math.ceil(rows.length/24)-1));
    const prospect = [...s.collegePipeline, ...(s.collegeAlumni || [])].find(p => p.id === selected);
    const alumni = (s.collegeAlumni || []).filter(p => s.collegeWatchlist.includes(p.id));
    return <Shell title="Campus watch" eyebrow="Meet your next franchise player before draft night">
        <p className="max-w-3xl text-body text-fg-muted">Follow four recruiting classes from arrival on campus to the draft. Recruiting projections range from normal to generational; most recruits are normal. These labels describe upside, not guaranteed professional success. College production updates as you advance the season.</p>
        <div className="flex flex-wrap gap-3"><input className={`${field} min-w-0 flex-1`} aria-label="Search college players" placeholder="Name, school, position or recruiting tier" value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /><select className={field} aria-label="Draft class year" value={year} onChange={e => {setYear(e.target.value);setPage(0);}}><option value="all">All classes</option>{[...new Set(s.collegePipeline.map(p => p.draftYear))].sort().map(y => <option key={y} value={y}>{y} draft class</option>)}</select><label className="flex items-center gap-2"><input type="checkbox" checked={watched} onChange={e => {setWatched(e.target.checked);setPage(0);}} />My watchlist</label></div>
        <p className="text-label text-fg-muted">{rows.length} players · Seniors enter the next draft; incoming freshmen are four years away.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rows.slice(currentPage*24,currentPage*24+24).map(p => <Card key={p.id}><CardHeader title={p.name} eyebrow={`${p.position} · ${p.school}`} /><CardBody className="space-y-3"><div className="flex flex-wrap gap-2"><Badge>{p.tier} recruit</Badge><Badge>{['Freshman','Sophomore','Junior','Senior'][Math.max(0,Math.min(3,s.year-p.entryYear))]}</Badge></div><p className="text-label">{p.draftYear} draft · {p.arc}</p><p className="text-label text-fg-muted">{p.events.at(-1)?.text}</p><div className="flex gap-2"><Button size="sm" onClick={() => setSelected(p.id)}>College career</Button><Button size="sm" variant={s.collegeWatchlist.includes(p.id) ? 'accent' : 'secondary'} onClick={() => s.toggleCollegeWatch(p.id)}>{s.collegeWatchlist.includes(p.id) ? 'Following' : 'Follow'}</Button></div></CardBody></Card>)}</div>
        {!rows.length && <p>No players match these filters.</p>}
        <div className="flex items-center justify-center gap-4"><Button disabled={currentPage === 0} onClick={() => setPage(currentPage-1)}>Previous</Button><span>Page {currentPage+1} / {Math.max(1,Math.ceil(rows.length/24))}</span><Button disabled={(currentPage+1)*24 >= rows.length} onClick={() => setPage(currentPage+1)}>Next</Button></div>
        {alumni.length > 0 && <Card><CardHeader title="Your watchlist made it to the league" /><CardBody>{alumni.map(p => <div key={p.id} className="mb-3 flex flex-wrap items-center justify-between gap-2"><p>{p.name} · {p.school} · {p.draftYear} draft · {p.tier} recruit</p><Button size="sm" onClick={() => setSelected(p.id)}>College career</Button></div>)}</CardBody></Card>}
        <Modal open={!!prospect} onClose={() => setSelected(null)} title={prospect?.name || 'College career'} size="lg">{prospect && <div className="space-y-5"><p>{prospect.position} · {prospect.school} · {prospect.tier} recruiting projection · Draft {prospect.draftYear}</p><div><h3 className="font-bold">Production so far</h3>{prospect.seasons.filter(row => row.games > 0).map(row => <div key={row.year} className="border-b border-line py-3"><strong>{row.year} · {row.games} games</strong><p className="text-label">{Object.entries(row.stats).map(([k,v]) => `${k}: ${v}`).join(' · ')}</p></div>)}{!prospect.seasons.some(row => row.games > 0) && <p className="text-fg-muted">New arrival. Advance the season to see his first college production.</p>}</div><div><h3 className="font-bold">His story</h3>{prospect.events.map((e,i) => <p key={i} className="mt-3 text-body"><strong>{e.year} · </strong>{e.text}</p>)}</div></div>}</Modal>
    </Shell>;
}
export function FranchiseJournal() {
    const s = useFranchise();
    const college = [...s.collegePipeline, ...(s.collegeAlumni || [])].filter(p => s.collegeWatchlist.includes(p.id)).flatMap(p => p.events.map(e => ({ ...e, kind: 'College', text: `${p.name} · ${p.school}: ${e.text}` })));
    const stories = [...s.franchiseStories.filter(e => e.kind !== 'College'), ...college].sort((a,b) => b.year-a.year || (b.week || 19)-(a.week || 19));
    // One timeline card instead of a separate card per one-line entry.
    return <Shell title="Franchise journal" eyebrow="The people behind the seasons">
        <p className="text-body text-fg-muted">Coaching careers and the college players you follow build a shared history. Follow prospects in Campus Watch to add their journeys here.</p>
        {!stories.length
            ? <Card><EmptyState icon="📖" title="Your story is just starting" body="Hire a coach, follow a recruit, or finish a season." /></Card>
            : <Card><ol className="divide-y divide-line-subtle">{stories.slice(0,100).map((e,i) => (
                <li key={i} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-3">
                    <div><p className="font-display text-h3 tabular-nums text-fg">{e.year}{e.week ? ` · W${e.week}` : ''}</p><Badge tone={e.kind === 'College' ? 'info' : 'neutral'}>{e.kind}</Badge></div>
                    <p className="text-body text-fg-secondary">{e.text}</p>
                </li>))}</ol></Card>}
    </Shell>;
}
