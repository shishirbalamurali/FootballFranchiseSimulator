// The front-office phone (Claude-owned): one queue for trade calls, agents,
// scouts, coaching news and player decisions. A nav button with a badge opens
// a drawer; the Command Center embeds the same list.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { KINDS } from '../../engine/inbox';
import { TEAMS } from '../../data/teams';
import { Button, TeamCrest, EmptyState, useToast, cx } from '../ui';
import { openPlayerCard } from '../player/cardStore';

function findPlayer(s, id) {
    for (const [teamId, roster] of Object.entries(s.rosters || {})) {
        const p = roster.find(x => x.id === id);
        if (p) return { p, teamId };
    }
    const fa = (s.freeAgents || []).find(x => x.id === id);
    return fa ? { p: fa, teamId: 'FA' } : null;
}

export function InboxList({ limit = 40, compact = false, emptyText = 'Nothing waiting on you. The phone is quiet.' }) {
    const inbox = useGameStore(s => s.frontOffice?.inbox || []);
    const resolve = useGameStore(s => s.foResolveInbox);
    const dismiss = useGameStore(s => s.foDismissInbox);
    const { error, success } = useToast();
    if (!inbox.length) return <EmptyState size="sm" icon="☎️" title="All clear" body={emptyText} />;
    const act = (item, actionId) => {
        const r = resolve(item.id, actionId);
        if (r && r.ok === false) error({ title: 'Not done', body: r.reason });
        else if (r?.message) success({ title: 'Done', body: r.message });
    };
    return (
        <ul className="flex flex-col gap-2">
            {inbox.slice(0, limit).map(item => {
                const k = KINDS[item.kind] || KINDS.news;
                const team = item.teamId && TEAMS.find(t => t.id === item.teamId);
                return (
                    <li key={item.id} className={cx('rounded-card border-2 bg-surface-raised px-3 py-2.5', item.priority === 1 ? 'border-ink shadow-1' : 'border-line')}>
                        <div className="flex items-start gap-2.5">
                            {team ? <TeamCrest team={team} size="sm" decorative /> : <span className="text-h2 leading-none" aria-hidden="true">{k.icon}</span>}
                            <div className="min-w-0 flex-1">
                                <p className="text-micro uppercase text-fg-faint">{k.label}{item.created ? ` · Wk ${item.created.week}` : ''}</p>
                                <p className="font-semibold leading-tight text-fg">{item.title}</p>
                                {!compact && <p className="mt-0.5 text-label text-fg-secondary">{item.body}</p>}
                            </div>
                            <button type="button" onClick={() => dismiss(item.id)} className="shrink-0 rounded-chip px-1.5 text-label text-fg-faint hover:bg-surface-hover" aria-label="Dismiss">✕</button>
                        </div>
                        {(item.actions?.length > 0 || item.playerId) && (
                            <div className="mt-2 flex flex-wrap gap-2 pl-8">
                                {item.actions?.map((a, i) => (
                                    <Button key={a.id} size="sm" variant={a.tone === 'danger' ? 'danger' : i === 0 ? 'primary' : 'secondary'}
                                        onClick={() => (a.id === 'view' && item.playerId ? (() => { const f = findPlayer(useGameStore.getState(), item.playerId); if (f) openPlayerCard(f.p, f.teamId); dismiss(item.id); })() : act(item, a.id))}>
                                        {a.label}
                                    </Button>
                                ))}
                                {item.playerId && !item.actions?.some(a => a.id === 'view') && (
                                    <Button size="sm" variant="ghost" onClick={() => { const f = findPlayer(useGameStore.getState(), item.playerId); if (f) openPlayerCard(f.p, f.teamId); }}>Player card</Button>
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/** Nav button + drawer. */
export default function PhoneButton() {
    const [open, setOpen] = useState(false);
    const count = useGameStore(s => (s.frontOffice?.inbox || []).filter(i => i.actions?.length).length);
    const total = useGameStore(s => (s.frontOffice?.inbox || []).length);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label={`Front-office phone, ${count} decisions waiting`}
                className="relative grid size-10 shrink-0 place-items-center rounded-full text-h2 text-nav-fg hover:bg-surface-hover">
                <span aria-hidden="true">☎️</span>
                {total > 0 && <span className={cx('absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink px-1 text-micro', count ? 'bg-negative-solid text-n-0' : 'bg-surface-raised text-fg')}>{count || total}</span>}
            </button>
            {open && createPortal(
                <div className="toon-backdrop fixed inset-0 z-[90] flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
                    <aside role="dialog" aria-label="Front-office phone" className="flex h-full w-full max-w-md flex-col bg-surface-base shadow-3 animate-fade-up">
                        <header className="flex items-center gap-3 border-b-[3px] border-ink bg-surface-raised px-4 py-3">
                            <span className="text-h1" aria-hidden="true">☎️</span>
                            <div className="flex-1"><p className="text-micro uppercase text-fg-faint">Front office</p><h2 className="font-display text-h1 uppercase leading-none">The Phone</h2></div>
                            <Button size="sm" onClick={() => setOpen(false)} aria-label="Close phone">✕</Button>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4"><InboxList /></div>
                    </aside>
                </div>, document.body)}
        </>
    );
}
