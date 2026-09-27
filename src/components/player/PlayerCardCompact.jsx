// Compact player card: face, name, position, OVR ring, primary status.
// Used by trade chips, the FA shortlist, the draft haul and hub leaders.
import { useGameStore } from '../../store/gameStore';
import { playerStatus } from '../../engine/playerStatus';
import PlayerFace from '../PlayerFace';
import { PositionTag, cx } from '../ui';
import { OvrRing, StatusPill } from './PlayerBits';
import { openPlayerCard } from './cardStore';

export default function PlayerCardCompact({ player, teamId, context = {}, action = null, onClick, className, sub }) {
    const userTeamId = useGameStore(s => s.userTeamId);
    const injuries = useGameStore(s => s.injuries);
    const rosters = useGameStore(s => s.rosters);
    const fo = useGameStore(s => s.frontOffice);
    if (!player) return null;
    const tid = teamId || player.teamId;
    const status = playerStatus(player, { own: tid === userTeamId, roster: rosters?.[tid] || [], injuries, block: fo?.block, tradeRequests: fo?.tradeRequests, holdouts: fo?.holdouts, context: context.kind, ask: context.ask, projection: context.projection });
    return (
        <div className={cx('flex min-w-0 items-center gap-3 rounded-card border-2 border-line bg-surface-raised px-3 py-2', player.xFactor && !player.xFactor.dormant && 'xf-frame', className)}>
            <button type="button" onClick={onClick || (() => openPlayerCard(player, tid, context))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <PlayerFace player={player} teamId={tid || 'FA'} size="sm" />
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-fg"><PositionTag position={player.position} className="shrink-0" /> <span className="truncate">{player.name}</span></p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">{sub ? <span className="truncate text-label text-fg-muted">{sub}</span> : <StatusPill status={status?.primary} className="max-w-full truncate" />}</div>
                </div>
                <OvrRing ovr={player.ovr} player={player} size="sm" />
            </button>
            {action}
        </div>
    );
}
