// X-Factors in a matchup (Claude-owned): who can take over this game, and the
// weekly-prep counter "Scheme for him" (costs a little coverage elsewhere).
import { useGameStore } from '../../store/gameStore';
import { TEAMS } from '../../data/teams';
import { abilityFor, describeAbility, isActiveXF } from '../../engine/xFactor';
import { Badge, Button, cx } from '../ui';
import PlayerFace from '../PlayerFace';
import { openPlayerCard } from '../player/cardStore';

export function XFactorMatchup({ userTeamId, oppTeamId }) {
    const rosters = useGameStore(s => s.rosters);
    const schemeFor = useGameStore(s => s.frontOffice?.schemeFor);
    const year = useGameStore(s => s.year);
    const week = useGameStore(s => s.week);
    const setScheme = useGameStore(s => s.foSchemeFor);
    const mine = (rosters?.[userTeamId] || []).filter(isActiveXF);
    const theirs = (rosters?.[oppTeamId] || []).filter(isActiveXF);
    if (!mine.length && !theirs.length) return null;
    const focus = schemeFor?.year === year && schemeFor?.week === week ? schemeFor.playerId : null;
    const row = (p, teamId, rival) => {
        const a = abilityFor(p);
        return (
            <div key={p.id} className={cx('flex items-start gap-3 rounded-card border-2 px-3 py-2', focus === p.id ? 'border-ink bg-warning-bg' : 'border-line bg-surface-raised')}>
                <button type="button" onClick={() => openPlayerCard(p, teamId)}><PlayerFace player={p} teamId={teamId} size="sm" /></button>
                <div className="min-w-0 flex-1">
                    <p className="text-label"><strong>{p.name}</strong> <span className="text-fg-muted">{TEAMS.find(t => t.id === teamId)?.abbreviation} {p.position}</span> · <span className="xf-text font-bold">⚡ {a.name}</span></p>
                    <p className="text-micro text-fg-muted">{describeAbility(a)}</p>
                </div>
                {rival && <Button size="sm" variant={focus === p.id ? 'primary' : 'secondary'} onClick={() => setScheme(focus === p.id ? null : p.id)} title="He needs one more event to get in the zone; everyone else finds a little more room.">{focus === p.id ? 'Scheming for him ✓' : 'Scheme for him'}</Button>}
            </div>
        );
    };
    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2"><span className="xf-chip rounded-full border-2 border-ink px-2 text-micro uppercase">⚡ X-Factors</span><span className="text-label text-fg-muted">Players who can take over this game</span></div>
            {theirs.map(p => row(p, oppTeamId, true))}
            {mine.map(p => row(p, userTeamId, false))}
            {focus && <p className="text-micro text-fg-faint">Scheming for one player makes him work harder to get in the zone, but the rest of their offense finds a little more room.</p>}
        </section>
    );
}

/** X-Factor moments from a finished game (game.xf rows: [id, side, activations, zoneTds]). */
export function XFactorMoments({ game }) {
    const rosters = useGameStore(s => s.rosters);
    const rows = (game?.xf || []).map(([id, side, acts, tds]) => {
        const teamId = side === 0 ? game.homeTeamId : game.awayTeamId;
        const p = (rosters?.[teamId] || []).find(x => x.id === id);
        return p ? { p, teamId, acts, tds, a: abilityFor(p) } : null;
    }).filter(Boolean);
    if (!rows.length) return null;
    return (
        <section>
            <h3 className="mb-2 text-micro uppercase text-fg-faint">X-Factor moments</h3>
            <div className="space-y-1.5">
                {rows.map(r => (
                    <div key={r.p.id} className="flex items-center gap-2 rounded-card bg-xfactor-wash px-3 py-2">
                        <span className="xf-chip grid size-6 place-items-center rounded-full border-2 border-ink text-micro" aria-hidden="true">⚡</span>
                        <p className="min-w-0 flex-1 text-label"><strong>{r.p.name}</strong> ({TEAMS.find(t => t.id === r.teamId)?.abbreviation}) got in the zone {r.acts}×{r.tds ? ` · ${r.tds} TD${r.tds === 1 ? '' : 's'} while hot` : ''} · <span className="xf-text font-bold">{r.a.name}</span></p>
                        <Badge>{r.a.triggerShort}</Badge>
                    </div>
                ))}
            </div>
        </section>
    );
}
