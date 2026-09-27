// Kept for existing callers: the player card now lives in components/player.
import PlayerCard from './player/PlayerCard';

export default function PlayerModal({ player, teamId, onClose, context }) {
    return <PlayerCard player={player} teamId={teamId} context={context} onClose={onClose} />;
}
