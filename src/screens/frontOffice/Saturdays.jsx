// Saturdays (Claude-owned): the college season, your prospects, storylines,
// the Heisman race and schools. Replaces Campus Watch.
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { SCHOOLS, CONFERENCES, pollFor, standingsFor, heismanRace, stockOf, eventText, storyLabel, schoolGames, weekGames, schoolByName, confOf, STORY_MARK } from '../../engine/collegeSeason';
import { userView, knowledgeOf } from '../../engine/scouting';
import { Card, CardHeader, CardBody, Button, Badge, Tabs, EmptyState, Modal, PositionTag, cx, useToast } from '../../components/ui';
import { FOShell } from '../../components/frontOffice/FOBits';
import { RangeBar } from '../../components/player/PlayerBits';

const field = 'h-9 rounded-card border-2 border-line bg-surface-raised px-3 text-label text-fg';
const CLASS_NAMES = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
const schoolSwatch = name => ({ background: `hsl(${schoolByName(name)?.hue ?? 0} 55% 42%)` });

function Stock({ n }) {
    if (!n) return <span className="text-fg-faint">—</span>;
    return <span className={cx('font-bold tabular-nums', n > 0 ? 'text-positive-fg' : 'text-negative-fg')}>{n > 0 ? '▲' : '▼'}{Math.abs(n)}</span>;
}
function SchoolName({ name, className }) {
    return <span className={cx('inline-flex items-center gap-1.5', className)}><span className="inline-block size-2.5 rounded-full border border-ink" style={schoolSwatch(name)} aria-hidden="true" />{name}</span>;
}

function ProspectModal({ p, onClose }) {
    const s = useGameStore();
    const v = userView({ ...p, ovr: p.readyOvr, pot: p.ceiling, college: p.school }, s.scouting, s.userTeamId);
    const following = s.collegeWatchlist?.includes(p.id);
    return (
        <Modal open onClose={onClose} size="lg" title={p.name} eyebrow={`${p.position} · ${p.school} · ${CLASS_NAMES[Math.max(0, Math.min(3, s.year - p.entryYear))]} · ${p.draftYear} draft`}
            footer={<><Button variant="ghost" onClick={() => s.toggleCollegeWatch(p.id)}>{following ? 'Unfollow' : 'Follow'}</Button><Button variant="primary" onClick={() => s.foToggleBoard(p.id)}>{s.scouting?.board?.order?.includes(p.id) ? 'On your board ✓' : 'Add to Big Board'}</Button></>}>
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2"><Badge>{p.tier} recruit</Badge>{storyLabel(p) && <Badge tone="info">{storyLabel(p)}</Badge>}<span className="text-label">Stock <Stock n={stockOf(p, s.year)} /></span></div>
                <div><p className="mb-1 text-micro uppercase text-fg-faint">Our read · {v.k}% known</p><RangeBar lo={v.lo} hi={v.hi} mark={v.ovr} /><p className="mt-1 text-label text-fg-muted">{v.lo}–{v.hi} today, ceiling {v.potLo}–{v.potHi}</p></div>
                <section><h3 className="mb-2 text-micro uppercase text-fg-faint">His story</h3>
                    <ol className="space-y-1.5 border-l-2 border-line pl-3">{p.events.map((e, i) => <li key={i} className={cx('text-label', e.text.startsWith(STORY_MARK) && 'font-semibold')}><strong>{e.year}</strong> · {eventText(p, e)}</li>)}</ol>
                </section>
                <section><h3 className="mb-2 text-micro uppercase text-fg-faint">Production</h3>
                    {p.seasons.filter(r => r.games).length ? p.seasons.filter(r => r.games).map(r => <p key={r.year} className="text-label"><strong>{r.year}</strong> · {r.games} games · {Object.entries(r.stats).map(([k, val]) => `${val} ${k.replace('_', ' ').toLowerCase()}`).join(' · ')}</p>) : <p className="text-label text-fg-muted">No college snaps yet.</p>}
                </section>
            </div>
        </Modal>
    );
}

function ThisWeek({ onOpen }) {
    const s = useGameStore();
    const { success, error } = useToast();
    const pipelineRaw = useGameStore(st => st.collegePipeline);
    const pipeline = useMemo(() => pipelineRaw || [], [pipelineRaw]);
    const poll = useMemo(() => pollFor(s.college, pipeline, s.year), [s.college, pipeline, s.year]);
    const ranked = new Map(poll.map(r => [r.idx, r.rank]));
    const heisman = useMemo(() => heismanRace(pipeline, s.college, s.year, 6), [pipeline, s.college, s.year]);
    const followed = useMemo(() => {
        const ids = new Set([...(s.collegeWatchlist || []), ...(s.scouting?.board?.order || [])]);
        return pipeline.filter(p => ids.has(p.id)).slice(0, 12);
    }, [pipeline, s.collegeWatchlist, s.scouting]);
    const week = s.phase === 'regular' ? Math.min(12, s.week) : null;
    const games = week ? weekGames(s.year, week) : [];
    const board = new Set(s.scouting?.board?.order || []);
    const marquee = games.map(([h, a]) => {
        const names = [SCHOOLS[h].name, SCHOOLS[a].name];
        const talent = pipeline.filter(p => names.includes(p.school) && p.draftYear <= s.year + 2);
        return { h, a, score: (ranked.has(h) ? 30 - ranked.get(h) : 0) + (ranked.has(a) ? 30 - ranked.get(a) : 0) + talent.filter(p => board.has(p.id)).length * 10 + talent.length, onBoard: talent.filter(p => board.has(p.id)).length };
    }).sort((x, y) => y.score - x.score).slice(0, 4);
    const attended = s.frontOffice?.attended?.[`${s.year}-${s.week}`];
    const lastWeek = Object.keys(s.college?.results || {}).map(Number).sort((a, b) => b - a)[0];
    const last = lastWeek ? s.college.results[lastWeek] : [];
    return (
        <div className="space-y-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Top 25">
                {poll.length ? poll.map(r => (
                    <div key={r.idx} className="min-w-[132px] rounded-card border-2 border-line bg-surface-raised px-2.5 py-1.5">
                        <p className="text-micro uppercase text-fg-faint">#{r.rank} · {r.w}-{r.l}</p>
                        <SchoolName name={SCHOOLS[r.idx].name} className="text-label font-bold" />
                    </div>
                )) : <p className="text-label text-fg-muted">The Top 25 appears after week one.</p>}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader eyebrow="Your prospects" title="Players you follow" />
                    <CardBody className="space-y-1.5">
                        {!followed.length && <EmptyState size="sm" icon="👀" title="Follow some prospects" body="Follow players in Classes or add them to your Big Board; their Saturdays show up here." />}
                        {followed.map(p => {
                            const row = p.seasons.find(r => r.year === s.year);
                            const latest = [...p.events].reverse().find(e => e.year === s.year);
                            return (
                                <button key={p.id} type="button" onClick={() => onOpen(p)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-card px-2 py-1.5 text-left hover:bg-surface-hover">
                                    <PositionTag position={p.position} />
                                    <span className="min-w-0"><span className="block truncate font-semibold">{p.name} <span className="text-label font-normal text-fg-muted">· {p.school}</span></span>
                                        <span className="block truncate text-label text-fg-muted">{row?.games ? `${row.games} g · ${Object.entries(row.stats).slice(0, 3).map(([k, val]) => `${val} ${k.replace('_', ' ').toLowerCase()}`).join(' · ')}` : 'Not playing this season'}{latest ? ` — ${eventText(p, latest)}` : ''}</span></span>
                                    <Stock n={stockOf(p, s.year)} />
                                </button>
                            );
                        })}
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader eyebrow="Heisman watch" title="The ladder" />
                    <CardBody className="space-y-1">
                        {heisman.length ? heisman.map((h, i) => <button key={h.id} type="button" onClick={() => onOpen(pipeline.find(p => p.id === h.id))} className="flex w-full items-center gap-2 text-left text-label hover:underline"><strong className="w-5 tabular-nums">{i + 1}</strong><span className="truncate">{h.name}</span><span className="ml-auto text-fg-muted">{h.position} · {h.school}</span></button>) : <p className="text-label text-fg-muted">The race starts in week one.</p>}
                        {s.college?.heisman && <p className="mt-2 text-label font-bold">🏆 Winner: {pipeline.find(p => p.id === s.college.heisman)?.name}</p>}
                    </CardBody>
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader eyebrow={week ? `Week ${week}` : 'Off week'} title="This Saturday" />
                    <CardBody className="space-y-2">
                        {!week && <p className="text-label text-fg-muted">No college games right now.</p>}
                        {attended && <p className="text-label text-positive-fg">You were at {SCHOOLS[attended[1]].name} at {SCHOOLS[attended[0]].name} this week.</p>}
                        {marquee.map(m => (
                            <div key={`${m.h}-${m.a}`} className="flex items-center gap-2 rounded-card bg-surface-sunken px-2.5 py-2">
                                <span className="min-w-0 flex-1 truncate text-label">{ranked.has(m.a) ? `#${ranked.get(m.a)} ` : ''}<SchoolName name={SCHOOLS[m.a].name} /> at {ranked.has(m.h) ? `#${ranked.get(m.h)} ` : ''}<SchoolName name={SCHOOLS[m.h].name} />{m.onBoard ? <Badge className="ml-1" tone="info">{m.onBoard} on your board</Badge> : null}</span>
                                <Button size="sm" disabled={!!attended} onClick={() => { const r = s.foAttendGame(m.h, m.a); if (r.ok) success({ title: 'You were in the stands', body: `Better reads on ${r.players.map(p => p.name).join(', ') || 'the rosters'}.` }); else error({ title: 'Not this week', body: r.reason }); }}>Attend</Button>
                            </div>
                        ))}
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader eyebrow={lastWeek ? `Week ${lastWeek} results` : 'Results'} title="Around college football" />
                    <CardBody className="grid gap-1 sm:grid-cols-2">
                        {(last || []).filter(g => ranked.has(g[0]) || ranked.has(g[1])).slice(0, 12).map((g, i) => (
                            <p key={i} className="text-label tabular-nums"><span className={g[3] > g[2] ? 'font-bold' : ''}>{SCHOOLS[g[1]].name} {g[3]}</span> @ <span className={g[2] > g[3] ? 'font-bold' : ''}>{SCHOOLS[g[0]].name} {g[2]}</span></p>
                        ))}
                        {!last?.length && <p className="text-label text-fg-muted">No games played yet.</p>}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

function Classes({ onOpen }) {
    const s = useGameStore();
    const [year, setYear] = useState(String(s.year + 1));
    const [pos, setPos] = useState('ALL');
    const [q, setQ] = useState('');
    const [following, setFollowing] = useState(false);
    const [limit, setLimit] = useState(60);
    const pipelineRaw = useGameStore(st => st.collegePipeline);
    const pipeline = useMemo(() => pipelineRaw || [], [pipelineRaw]);
    const years = [...new Set(pipeline.map(p => p.draftYear))].sort();
    const rows = useMemo(() => pipeline
        .filter(p => (year === 'all' || p.draftYear === Number(year)) && (pos === 'ALL' || p.position === pos) && (!following || s.collegeWatchlist?.includes(p.id)) && (!q || `${p.name} ${p.school}`.toLowerCase().includes(q.toLowerCase())))
        .map(p => ({ p, v: userView({ ...p, ovr: p.readyOvr, pot: p.ceiling, college: p.school }, s.scouting, s.userTeamId), stock: stockOf(p, s.year) }))
        .sort((a, b) => b.v.grade - a.v.grade), [pipeline, year, pos, following, q, s.collegeWatchlist, s.scouting, s.userTeamId, s.year]);
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <select className={field} value={year} onChange={e => setYear(e.target.value)} aria-label="Draft class">{years.map(y => <option key={y} value={y}>{y} class</option>)}<option value="all">All classes</option></select>
                <select className={field} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position">{['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].map(x => <option key={x}>{x}</option>)}</select>
                <input className={cx(field, 'min-w-0 flex-1')} placeholder="Name or school" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
                <label className="flex items-center gap-2 text-label"><input type="checkbox" checked={following} onChange={e => setFollowing(e.target.checked)} /> Following</label>
            </div>
            <div className="overflow-x-auto rounded-card border-2 border-ink">
                <table className="w-full min-w-[760px] text-label">
                    <thead className="bg-surface-sunken text-micro uppercase text-fg-faint"><tr><th className="px-2 py-2 text-left">Player</th><th className="px-2 text-left">School</th><th>Class</th><th>Recruit</th><th>Stock</th><th className="px-2 text-left">Our read</th><th>Known</th><th /></tr></thead>
                    <tbody>
                        {rows.slice(0, limit).map(({ p, v, stock }) => (
                            <tr key={p.id} className="border-t border-line-subtle">
                                <td className="px-2 py-1.5"><button type="button" onClick={() => onOpen(p)} className="flex items-center gap-2 text-left"><PositionTag position={p.position} /><span className="font-semibold">{p.name}</span>{storyLabel(p) && <span className="text-micro text-info-fg">{storyLabel(p)}</span>}</button></td>
                                <td className="px-2"><SchoolName name={p.school} /></td>
                                <td className="px-2 text-center">{CLASS_NAMES[Math.max(0, Math.min(3, s.year - p.entryYear))]?.slice(0, 2)}</td>
                                <td className="px-2 text-center">{p.tier}</td>
                                <td className="px-2 text-center"><Stock n={stock} /></td>
                                <td className="w-44 px-2"><RangeBar lo={v.lo} hi={v.hi} mark={v.ovr} /></td>
                                <td className="px-2 text-center tabular-nums">{knowledgeOf(s.scouting, p.id)}%</td>
                                <td className="px-2 text-right"><Button size="sm" variant={s.collegeWatchlist?.includes(p.id) ? 'accent' : 'secondary'} onClick={() => s.toggleCollegeWatch(p.id)}>{s.collegeWatchlist?.includes(p.id) ? 'Following' : 'Follow'}</Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length > limit && <Button onClick={() => setLimit(l => l + 60)}>Show more ({rows.length - limit})</Button>}
        </div>
    );
}

function Schools({ onOpen }) {
    const s = useGameStore();
    const [conf, setConf] = useState(CONFERENCES[0].id);
    const [school, setSchool] = useState(null);
    const table = useMemo(() => standingsFor(s.college).filter(r => r.conf === conf).sort((a, b) => (b.cw - b.cl) - (a.cw - a.cl) || (b.w - b.l) - (a.w - a.l)), [s.college, conf]);
    const sch = school != null ? SCHOOLS[school] : null;
    const roster = sch ? (s.collegePipeline || []).filter(p => p.school === sch.name && s.year < p.draftYear).sort((a, b) => a.draftYear - b.draftYear || b.readyOvr - a.readyOvr) : [];
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
                <CardHeader title="Standings" action={<select className={field} value={conf} onChange={e => { setConf(e.target.value); setSchool(null); }} aria-label="Conference">{CONFERENCES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>} />
                <CardBody padded={false}>
                    <table className="w-full text-label">
                        <thead className="bg-surface-sunken text-micro uppercase text-fg-faint"><tr><th className="px-3 py-2 text-left">School</th><th>Conf</th><th>Overall</th><th>Pts</th></tr></thead>
                        <tbody>{table.map(r => <tr key={r.idx} className={cx('border-t border-line-subtle', school === r.idx && 'bg-team-8')}><td className="px-3 py-1.5"><button type="button" onClick={() => setSchool(r.idx)} className="font-semibold hover:underline"><SchoolName name={r.name} /> <span className="font-normal text-fg-muted">{SCHOOLS[r.idx].mascot}</span></button>{s.college?.confChamps?.[conf] === r.idx && ' 🏆'}</td><td className="text-center tabular-nums">{r.cw}-{r.cl}</td><td className="text-center tabular-nums">{r.w}-{r.l}</td><td className="text-center tabular-nums">{r.pf}-{r.pa}</td></tr>)}</tbody>
                    </table>
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow={sch ? `${confOf(sch.conf)?.name} · ${sch.region} · prestige ${sch.prestige}` : 'Pick a school'} title={sch ? `${sch.name} ${sch.mascot}` : 'School'} />
                <CardBody className="space-y-3">
                    {!sch && <p className="text-label text-fg-muted">Click a school to see its schedule and draft prospects.</p>}
                    {sch && <div className="grid gap-1 sm:grid-cols-2">{schoolGames(s.college, sch.idx).map(g => { const home = g.home === sch.idx, us = home ? g.hs : g.as, them = home ? g.as : g.hs, opp = SCHOOLS[home ? g.away : g.home].name; return <p key={`${g.week}-${g.home}`} className="text-label tabular-nums"><span className={us > them ? 'font-bold text-positive-fg' : 'text-negative-fg'}>{us > them ? 'W' : 'L'}</span> {us}-{them} {home ? 'vs' : '@'} {opp}{g.label ? <span className="text-fg-muted"> · {g.label}</span> : ''}</p>; })}</div>}
                    {roster.length > 0 && <div><p className="mb-1 text-micro uppercase text-fg-faint">Pro prospects</p>{roster.slice(0, 12).map(p => <button key={p.id} type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-2 py-0.5 text-left text-label hover:underline"><PositionTag position={p.position} /> {p.name} <span className="ml-auto text-fg-muted">{p.draftYear} · {p.tier}</span></button>)}</div>}
                </CardBody>
            </Card>
        </div>
    );
}

function Storylines({ onOpen }) {
    const s = useGameStore();
    const followed = new Set([...(s.collegeWatchlist || []), ...(s.scouting?.board?.order || [])]);
    const beats = (s.collegePipeline || []).flatMap(p => p.events.filter(e => e.text.startsWith(STORY_MARK) && e.year >= s.year - 1).map(e => ({ p, e })))
        .sort((a, b) => (followed.has(b.p.id) ? 1 : 0) - (followed.has(a.p.id) ? 1 : 0) || b.e.year - a.e.year || b.e.week - a.e.week).slice(0, 60);
    const history = s.frontOffice?.collegeHistory || [];
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
                <CardHeader eyebrow="Storylines" title="Around the country" />
                <CardBody className="space-y-2">
                    {!beats.length && <p className="text-label text-fg-muted">Stories unfold as the season plays.</p>}
                    {beats.map(({ p, e }, i) => (
                        <button key={i} type="button" onClick={() => onOpen(p)} className={cx('block w-full rounded-card px-3 py-2 text-left hover:bg-surface-hover', followed.has(p.id) && 'bg-team-8')}>
                            <p className="text-micro uppercase text-fg-faint">{storyLabel(p)} · {e.year} week {e.week}{followed.has(p.id) ? ' · following' : ''}</p>
                            <p className="text-label"><strong>{p.name}</strong> ({p.position}, {p.school}): {eventText(p, e)}</p>
                        </button>
                    ))}
                </CardBody>
            </Card>
            <Card>
                <CardHeader eyebrow="History" title="Champions & Heismans" />
                <CardBody className="space-y-1.5">
                    {history.length ? history.map(h => <p key={h.year} className="text-label"><strong>{h.year}</strong> · 🏆 {h.champion || '—'}{h.heisman ? ` · Heisman: ${h.heisman.name} (${h.heisman.school})` : ''}</p>) : <p className="text-label text-fg-muted">Your first college season is under way.</p>}
                </CardBody>
            </Card>
        </div>
    );
}

export default function Saturdays() {
    const [tab, setTab] = useState('week');
    const [open, setOpen] = useState(null);
    const s = useGameStore();
    return (
        <FOShell title="Saturdays" eyebrow={`${s.year} college season · ${SCHOOLS.length} schools, ${CONFERENCES.length} conferences`}>
            <Tabs value={tab} onChange={setTab} label="Saturdays sections" items={[{ id: 'week', label: 'This week' }, { id: 'classes', label: 'Classes' }, { id: 'schools', label: 'Schools' }, { id: 'stories', label: 'Storylines' }]} />
            {tab === 'week' && <ThisWeek onOpen={setOpen} />}
            {tab === 'classes' && <Classes onOpen={setOpen} />}
            {tab === 'schools' && <Schools onOpen={setOpen} />}
            {tab === 'stories' && <Storylines onOpen={setOpen} />}
            {open && <ProspectModal p={open} onClose={() => setOpen(null)} />}
        </FOShell>
    );
}
