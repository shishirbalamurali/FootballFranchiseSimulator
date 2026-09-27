import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { pickKey, pickValue } from '../engine/draftExperience';
export default function DraftTradeDesk() {
    const order = useGameStore(s => s.draftOrder), index = useGameStore(s => s.currentPickIndex);
    const user = useGameStore(s => s.userTeamId), history = useGameStore(s => s.tradeHistory);
    const trade = useGameStore(s => s.tradeDraftPicks);
    const [open, setOpen] = useState(false), [partner, setPartner] = useState('');
    const [give, setGive] = useState([]), [receive, setReceive] = useState([]), [message, setMessage] = useState('');
    const available = order.slice(index);
    const toggle = (pick, selected, setter) => setter(selected.some(p => pickKey(p) === pickKey(pick)) ? selected.filter(p => pickKey(p) !== pickKey(pick)) : [...selected, pick]);
    const value = picks => picks.reduce((sum, p) => sum + pickValue(p.pickNumber), 0);
    return <div className="draft-trade-desk">
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <div><strong className="font-display text-h2 uppercase">Draft wire</strong><p className="text-label text-fg-muted">{history?.[0]?.text || 'Explore a move up, or build capital by trading back.'}</p></div>
            <button className="draft-action" onClick={() => { setOpen(!open); useGameStore.getState().toggleDraftTimer(false); }}> {open ? 'Close trade desk' : 'Open trade desk'} </button>
        </div>
        {open && <div className="mt-4">
            <label className="text-sm font-bold">Trade partner <select className="ml-2 h-9 px-2 text-label" value={partner} onChange={e => { setPartner(e.target.value); setGive([]); setReceive([]); setMessage(''); }}><option value="">Select a team</option>{TEAMS.filter(t => t.id !== user && available.some(p => p.teamId === t.id)).map(t => <option key={t.id} value={t.id}>{t.location} {t.name}</option>)}</select></label>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">{[[user, give, setGive, 'You send'], [partner, receive, setReceive, 'You receive']].map(([team, selected, setter, label]) => <fieldset key={label}><legend className="text-xs font-bold mb-2">{label} · {value(selected)} value</legend><div className="flex flex-wrap gap-2">{available.filter(p => p.teamId === team).map(p => <button key={pickKey(p)} aria-pressed={selected.some(s => pickKey(s) === pickKey(p))} className={`pick-chip ${selected.some(s => pickKey(s) === pickKey(p)) ? 'selected' : ''}`} onClick={() => toggle(p, selected, setter)}>#{p.pickNumber} · R{p.round} · {p.originalTeamId.toUpperCase()}</button>)}</div></fieldset>)}</div>
            <p className="text-xs my-3">CPU asks for a 3% premium. Values are a game trade model. Clock stays paused while you negotiate.</p>
            <button className="draft-action" disabled={!give.length || !receive.length} onClick={() => { const result = trade(partner, give, receive); setMessage(result.message); if (result.success) { setGive([]); setReceive([]); } }}>Propose trade</button>
            <p role="status" className="text-sm mt-2">{message}</p>
            <details className="mt-3 text-xs"><summary>League transaction history</summary>{history?.slice(0, 12).map(h => <p className="py-2" key={h.id}>{h.text}</p>)}</details>
        </div>}
    </div>;
}
