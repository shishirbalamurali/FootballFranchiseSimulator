import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { ASSISTANT_DEFAULTS, assistantPlan } from '../engine/frontOfficeAssistant';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, Modal, ConfirmModal, EmptyState } from '../components/ui';

const field = 'rounded-card border-2 border-line bg-surface-raised px-3 py-2 text-fg';
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
