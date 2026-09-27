// Status-first player card (Claude-owned).
//
// One glance: who he is, the ONE thing that matters about him right now (and
// what to do about it), then three vitals. Everything else is one tab away.
// Replaces the old PlayerModal body; PlayerModal.jsx is a thin wrapper.
import { useMemo, useState } from 'react';
import { TEAMS } from '../../data/teams';
import { useGameStore } from '../../store/gameStore';
import { characterFor, personalityView, moodFor, teamContext, contractStance, roleOf } from '../../engine/character';
import { playerStatus, recentLines } from '../../engine/playerStatus';
import { deadMoney } from '../../engine/contracts';
import { proReport } from '../../engine/scouting';
import { isActiveXF } from '../../engine/xFactor';
import { teamFit, fitLabel, SCHEMES, sideOf } from '../../engine/schemes';
import { playStyleFor } from '../../engine/playStyles';
import PlayerFace from '../PlayerFace';
import { Modal, Tabs, Button, Badge, TeamCrest, PositionTag, EmptyState, Stat, getRarity, cx } from '../ui';
import { OvrRing, StatusPill, Sparkline, AbilityPanel } from './PlayerBits';
import { TONE_VAR, TONE_BG, prettify, keyStats, KEY_ATTRS, attrLabel } from './playerUi';
import { navigate } from './cardStore';

const MOOD_TONE = { good: 'positive', bad: 'negative', mixed: 'warning' };

function AttrRow({ label, value, avg, editable, onCommit }) {
    const [draft, setDraft] = useState(null);
    const r = getRarity(value);
    return (
        <div className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-label text-fg-muted">{label}</span>
            <div className="relative h-2 flex-1 rounded-full bg-surface-sunken">
                <div className="h-full rounded-full transition-[width] duration-base" style={{ width: `${value}%`, backgroundColor: r.color }} />
                {avg != null && <span className="absolute -top-1 h-4 w-0.5 rounded bg-fg-muted" style={{ left: `${avg}%` }} title={`League average ${avg}`} />}
            </div>
            {editable && draft != null ? (
                <input autoFocus type="number" value={draft} aria-label={`${label} rating`}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => { const n = Math.max(0, Math.min(99, Number(draft))); if (!Number.isNaN(n)) onCommit(n); setDraft(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }}
                    className="w-12 rounded-chip border border-team bg-surface-sunken px-1 py-0.5 text-right text-label tabular-nums text-fg" />
            ) : (
                <button type="button" disabled={!editable} onClick={() => setDraft(value)}
                    className={cx('w-12 shrink-0 rounded-chip px-1 py-0.5 text-right text-label font-semibold tabular-nums text-fg', editable && 'hover:bg-surface-hover')}>{value}</button>
            )}
        </div>
    );
}

function Vital({ label, value, sub, children }) {
    return (
        <div className="min-w-0 rounded-card bg-surface-sunken px-3 py-2.5">
            <p className="text-micro uppercase text-fg-faint">{label}</p>
            <div className="flex items-center gap-2">
                <p className="truncate font-display text-h2 leading-tight text-fg">{value}</p>
                {children}
            </div>
            {sub && <p className="truncate text-label text-fg-muted">{sub}</p>}
        </div>
    );
}

// League-average reference lines for the Ratings tab (by position).
function positionAverages(rosters, position) {
    const all = Object.values(rosters || {}).flat().filter(p => p.position === position);
    const out = {};
    for (const p of all) for (const [k, v] of Object.entries(p.attributes?.position || {})) { out[k] = out[k] || [0, 0]; out[k][0] += v; out[k][1]++; }
    return Object.fromEntries(Object.entries(out).map(([k, [sum, n]]) => [k, Math.round(sum / n)]));
}

export function PlayerCardBody({ player, teamId, context = {}, onClose }) {
    const [tab, setTab] = useState('overview');
    const [editMode, setEditMode] = useState(false);
    const s = useGameStore();
    const livePlayer = useMemo(() => {
        const tid = teamId || player?.teamId;
        return (tid && s.rosters[tid]?.find(p => p.id === player.id)) || player;
    }, [s.rosters, teamId, player]);
    const displayTeamId = teamId || player?.teamId || 'FA';
    const team = TEAMS.find(t => t.id === displayTeamId);
    const own = displayTeamId === s.userTeamId;
    const roster = useMemo(() => s.rosters[displayTeamId] || [], [s.rosters, displayTeamId]);
    const ctx = displayTeamId !== 'FA' && s.rosters[displayTeamId] ? teamContext(s, displayTeamId) : null;
    const recent = useMemo(() => (displayTeamId !== 'FA' ? recentLines(s.schedule, displayTeamId, livePlayer.id, 5) : []), [s.schedule, displayTeamId, livePlayer.id]);
    const status = useMemo(() => playerStatus(livePlayer, {
        own, teamId: displayTeamId, roster, injuries: s.injuries, week: s.week, year: s.year, phase: s.phase,
        recent, block: s.frontOffice?.block, tradeRequests: s.frontOffice?.tradeRequests, holdouts: s.frontOffice?.holdouts,
        games: ctx?.games, winPct: ctx?.winPct, context: context.kind, ask: context.ask, projection: context.projection,
    }), [livePlayer, own, displayTeamId, roster, s.injuries, s.week, s.year, s.phase, recent, s.frontOffice, ctx?.games, ctx?.winPct, context.kind, context.ask, context.projection]);
    if (!livePlayer) return null;

    const character = characterFor(livePlayer);
    const view = personalityView(livePlayer, { own, scouted: !!s.scoutedProspects?.[livePlayer.id] });
    const mood = moodFor(livePlayer, ctx);
    const stance = own && ctx ? contractStance(livePlayer, ctx) : null;
    const role = roster.length ? roleOf(livePlayer, roster) : null;
    const xf = isActiveXF(livePlayer);
    const style = playStyleFor(livePlayer);
    const identity = s.frontOffice?.identities?.[s.userTeamId];
    const fit = identity && sideOf(livePlayer.position) ? teamFit(livePlayer, identity) : null;
    const ovrDelta = livePlayer.ovrHistory?.length > 1 ? livePlayer.ovr - livePlayer.ovrHistory.at(-2) : 0;
    const formKey = { QB: 'yards', RB: 'rushYards', WR: 'recYards', TE: 'recYards' }[livePlayer.position] || 'tackles';
    const formValues = recent.map(r => r.line?.[formKey] || 0);
    const c = livePlayer.contract || {};
    const report = !own ? proReport(livePlayer, s.scouting) : null;

    const doAction = (id) => {
        switch (id) {
            case 'extend': onClose?.(); navigate(s.phase === 'offseason' ? 'resign' : 'roster'); break;
            case 'shop': s.foToggleBlock?.(livePlayer.id); break;
            case 'unblock': s.foToggleBlock?.(livePlayer.id); break;
            case 'depth': case 'waivers': onClose?.(); navigate('roster'); break;
            case 'talk': { const item = s.frontOffice?.inbox?.find(i => i.playerId === livePlayer.id && i.kind === 'tradeRequest'); if (item) s.foResolveInbox(item.id, 'talk'); else { onClose?.(); navigate('command'); } break; }
            case 'ability': setTab('overview'); break;
            case 'battle': onClose?.(); navigate('home'); break;
            case 'offer': onClose?.(); navigate('freeAgency'); break;
            default: break;
        }
    };

    const attrs = livePlayer.attributes || {};
    const avgs = tab === 'ratings' ? positionAverages(s.rosters, livePlayer.position) : {};
    const keyAttrs = (KEY_ATTRS[livePlayer.position] || []).map(k => [k, attrs.position?.[k] ?? attrs.universal?.[k]]).filter(([, v]) => v != null);
    const traitsShown = view.traits.slice(0, 2);
    const moreTraits = view.traits.length - traitsShown.length + (view.hiddenTraits || 0);

    return (
        <div className="flex flex-col">
            {/* ── Hero: identity, status band, OVR ── */}
            <div className={cx('status-band relative flex items-stretch gap-4 px-5 py-4', xf ? 'bg-xfactor-wash' : TONE_BG[status.tone] || 'bg-surface-sunken')} style={{ '--band': TONE_VAR[status.tone] }}>
                <PlayerFace player={livePlayer} teamId={displayTeamId} size={96} variant="portrait" lazy={false} label={`${livePlayer.name}, ${livePlayer.position}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <PositionTag position={livePlayer.position} />
                        <span className="font-display text-h3 tabular-nums text-fg-muted">#{character.number}</span>
                        {team && <TeamCrest team={team} size="sm" decorative />}
                        {style && <Badge tone="info" title={style.blurb}>{style.icon} {style.label}</Badge>}
                    </div>
                    <h2 className="break-words font-display text-h2 uppercase leading-none text-fg sm:text-h1">{livePlayer.name}</h2>
                    <p className="truncate text-label text-fg-secondary">
                        {team ? `${team.location} ${team.name}` : context.kind === 'prospect' ? livePlayer.college || 'Prospect' : 'Free agent'} · Age {livePlayer.age} · {character.height} {character.weightLb} lb
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                        <StatusPill status={status.primary} />
                        {status.secondary.map(x => <StatusPill key={x.id} status={x} compact />)}
                    </div>
                    {status.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {status.actions.slice(0, 2).map((a, i) => <Button key={a.id} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => doAction(a.id)}>{a.id === 'shop' && s.frontOffice?.block?.includes(livePlayer.id) ? 'On the block ✓' : a.label}</Button>)}
                        </div>
                    )}
                </div>
                <OvrRing ovr={livePlayer.ovr} player={livePlayer} size="lg" delta={ovrDelta} />
            </div>

            {/* ── Three vitals ── */}
            <div className="grid grid-cols-1 gap-2 px-5 pt-4 sm:grid-cols-3">
                <Vital label="Role" value={context.kind === 'prospect' ? (context.projection || 'Prospect') : role?.starter ? 'Starter' : role && role.rank >= 0 ? `${livePlayer.position}${role.rank + 1}` : context.kind === 'fa' ? 'Unsigned' : '—'}
                    sub={role && role.rank >= 0 ? `${livePlayer.archetype || livePlayer.position}${fit != null && own ? ` · ${fitLabel(fit)}` : ''}` : livePlayer.archetype} />
                <Vital label="Contract" value={context.ask ? `$${context.ask}M ask` : c.salary != null ? `$${c.salary}M` : '—'}
                    sub={c.salary != null && !context.ask ? `${c.yearsLeft ?? 1} yr left${c.type === 'tag' ? ' · tagged' : c.type === 'rookie' ? ' · rookie deal' : ''}` : null} />
                <Vital label="Form" value={formValues.length >= 2 ? `${Math.round(formValues.reduce((a, b) => a + b, 0) / formValues.length)}` : '—'} sub={formValues.length >= 2 ? `${prettify(formKey).toLowerCase()} / game` : 'No recent games'}>
                    <Sparkline values={formValues} />
                </Vital>
            </div>

            <Tabs className="no-scrollbar overflow-x-auto px-5 pt-2" value={tab} onChange={setTab} label="Player details"
                items={[{ id: 'overview', label: 'Overview' }, { id: 'ratings', label: 'Ratings' }, { id: 'career', label: 'Career' }, { id: 'contract', label: 'Contract' }, { id: 'personality', label: 'Personality' }]} />

            <div className="px-5 pb-5 pt-2">
                {tab === 'overview' && (
                    <div className="flex flex-col gap-4">
                        {xf && <AbilityPanel player={livePlayer} rival={!own} />}
                        {keyAttrs.length > 0 && (
                            <section>
                                <h3 className="mb-2 text-micro uppercase text-fg-faint">What he does best</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {keyAttrs.map(([k, v]) => <Stat key={k} size="sm" value={v} label={attrLabel(k)} />)}
                                </div>
                            </section>
                        )}
                        <section>
                            <h3 className="mb-2 text-micro uppercase text-fg-faint">This season</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {keyStats(livePlayer).map(([k, v]) => <Stat key={k} size="sm" value={v} label={k} />)}
                            </div>
                        </section>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={MOOD_TONE[mood.tone]}>{mood.icon} {mood.label}</Badge>
                            {traitsShown.map(t => <Badge key={t.id} tone={MOOD_TONE[t.tone]} title={t.effect}>{t.icon} {t.label}</Badge>)}
                            {moreTraits > 0 && <button type="button" onClick={() => setTab('personality')} className="text-label font-semibold text-team-ink underline-offset-2 hover:underline">+{moreTraits} more</button>}
                        </div>
                        {status.all?.length > 1 && (
                            <ul className="flex flex-col gap-1 text-label text-fg-secondary">
                                {status.all.slice(1).filter(x => x.rank < 10).map(x => <li key={x.id}>{x.icon} {x.headline}</li>)}
                            </ul>
                        )}
                        {report?.trajectory && (
                            <p className="rounded-card bg-surface-sunken px-3 py-2 text-label"><strong>Pro scouting:</strong> {report.trajectory.label}. {report.trajectory.text}</p>
                        )}
                        <p className="text-label italic text-fg-muted">{character.quote}</p>
                    </div>
                )}

                {tab === 'ratings' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <p className="text-label text-fg-muted">Potential <strong className="text-fg">{livePlayer.pot ?? livePlayer.ovr}</strong> · marks show the league average at {livePlayer.position}</p>
                            {displayTeamId !== 'FA' && <Button size="sm" variant="ghost" onClick={() => setEditMode(e => !e)}>{editMode ? 'Done' : 'Edit'}</Button>}
                        </div>
                        {[['Position skills', 'position', attrs.position], ['Physical & mental', 'universal', attrs.universal]].filter(([, , a]) => a && Object.keys(a).length).map(([name, cat, a]) => (
                            <section key={name}>
                                <h3 className="mb-2 text-micro uppercase text-fg-faint">{name}</h3>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(a).filter(([, v]) => v != null).sort(([, x], [, y]) => y - x).map(([k, v]) => (
                                        <AttrRow key={k} label={attrLabel(k)} value={v} avg={cat === 'position' ? avgs[k] : null} editable={editMode} onCommit={n => s.setPlayerAttr(displayTeamId, livePlayer.id, cat, k, n)} />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {identity && sideOf(livePlayer.position) && (
                            <p className="text-label text-fg-muted">Scheme fit with your {SCHEMES[identity[sideOf(livePlayer.position)]]?.name}: <strong className="text-fg">{fit}</strong> ({fitLabel(fit)})</p>
                        )}
                    </div>
                )}

                {tab === 'career' && (
                    <div className="flex flex-col gap-4">
                        {livePlayer.stats?.career && Object.values(livePlayer.stats.career).some(v => typeof v === 'number' && v) ? (
                            <section>
                                <h3 className="mb-2 text-micro uppercase text-fg-faint">Career</h3>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {Object.entries(livePlayer.stats.career).filter(([, v]) => typeof v === 'number' && v).slice(0, 12).map(([k, v]) => <Stat key={k} size="sm" value={v} label={prettify(k)} />)}
                                </div>
                            </section>
                        ) : <EmptyState size="sm" icon="📊" title="No career stats yet" body="They appear once he's played." />}
                        {recent.length > 0 && (
                            <section>
                                <h3 className="mb-2 text-micro uppercase text-fg-faint">Recent games</h3>
                                <ul className="divide-y divide-line-subtle rounded-card bg-surface-sunken">
                                    {recent.map(r => <li key={r.week} className="flex justify-between px-3 py-1.5 text-label"><span>Wk {r.week} vs {TEAMS.find(t => t.id === r.opp)?.abbreviation}</span><span className="tabular-nums text-fg-secondary">{keyStats({ position: livePlayer.position, stats: { season: r.line } }).map(([k, v]) => `${v} ${k}`).join(' · ')}</span></li>)}
                                </ul>
                            </section>
                        )}
                        <section>
                            <h3 className="mb-2 text-micro uppercase text-fg-faint">Path</h3>
                            <p className="text-label text-fg-secondary">
                                {livePlayer.draftPick ? `Drafted #${livePlayer.draftPick} (${livePlayer.draftYear})` : livePlayer.isUndrafted ? 'Undrafted free agent' : 'Veteran'} · {character.college} · Rating path {(livePlayer.ovrHistory || [livePlayer.ovr]).slice(-6).join(' → ')}
                                {livePlayer.scoutedAs ? ` · We graded him ${livePlayer.scoutedAs.lo}–${livePlayer.scoutedAs.hi} on draft day` : ''}
                            </p>
                        </section>
                    </div>
                )}

                {tab === 'contract' && (
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Stat size="sm" value={c.salary != null ? `$${c.salary}M` : '—'} label="Cap hit" />
                            <Stat size="sm" value={c.yearsLeft ?? '—'} label="Years left" />
                            <Stat size="sm" value={`$${c.guaranteed || 0}M`} label="Guaranteed" />
                            <Stat size="sm" value={`$${deadMoney(livePlayer)}M`} label="Dead money if cut" />
                        </div>
                        {c.type && <p className="text-label text-fg-muted">Deal type: {c.type}{c.bonus ? ` · $${c.bonus}M signing bonus` : ''}{c.optionDecided ? ` · 5th-year option ${c.optionDecided}` : ''}</p>}
                        {stance && (
                            <p className={cx('rounded-card px-3 py-2 text-label', stance.willing ? 'bg-surface-sunken text-fg-secondary' : 'bg-negative-bg text-negative-fg')}>
                                {stance.willing ? <>Extension ask: <strong className="text-fg">${stance.ask}M</strong>/yr{stance.notes.length ? ` · ${stance.notes.join(' · ')}` : ''}</> : stance.refusal}
                            </p>
                        )}
                    </div>
                )}

                {tab === 'personality' && (
                    <div className="flex flex-col gap-4">
                        {own && mood && (
                            <section className="rounded-card bg-surface-sunken px-4 py-3">
                                <p className="mb-1 font-display text-h3 uppercase">{mood.icon} {mood.label} <span className="text-label text-fg-muted">{mood.score}/100</span></p>
                                <ul className="flex flex-col gap-0.5">{mood.reasons.map(r => <li key={r.text} className="text-label"><span className={cx('inline-block w-9 font-semibold tabular-nums', r.delta > 0 ? 'text-positive-fg' : 'text-negative-fg')}>{r.delta > 0 ? '+' : ''}{r.delta}</span>{r.text}</li>)}</ul>
                            </section>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {view.traits.map(t => (
                                <div key={t.id} className="flex gap-3 rounded-card border-2 border-line bg-surface-raised px-3 py-2.5">
                                    <span className="text-h2" aria-hidden="true">{t.icon}</span>
                                    <div><p className="font-display text-h3 uppercase">{t.label}</p><p className="text-label text-fg-muted">{t.effect}</p></div>
                                </div>
                            ))}
                            {view.hiddenTraits > 0 && <div className="rounded-card border-2 border-dashed border-line px-3 py-2.5 text-label text-fg-muted">🔒 {view.hiddenTraits} trait{view.hiddenTraits === 1 ? '' : 's'} unknown. Interviews reveal them.</div>}
                        </div>
                        {view.axes && <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{view.axes.map(a => <div key={a.id} className="rounded-card bg-surface-sunken px-3 py-2"><dt className="text-micro uppercase text-fg-faint">{a.label}</dt><dd className="text-label">{a.value} · {a.value >= 50 ? a.high : a.low}</dd></div>)}</dl>}
                        <p className="text-label text-fg-muted">From {character.hometown} · {character.college}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PlayerCard({ player, teamId, context, onClose }) {
    if (!player) return null;
    return (
        <Modal open onClose={onClose} size="lg" bare ariaLabel={`${player.name} player card`}
            footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
            <PlayerCardBody player={player} teamId={teamId} context={context} onClose={onClose} />
        </Modal>
    );
}
