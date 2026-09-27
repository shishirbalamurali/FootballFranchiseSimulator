// Renders whichever player card is open (see cardStore.openPlayerCard).
import PlayerCard from './PlayerCard';
import { usePlayerCard } from './cardStore';

export default function PlayerCardHost() {
    const card = usePlayerCard(s => s.card);
    const close = usePlayerCard(s => s.close);
    if (!card) return null;
    return <PlayerCard player={card.player} teamId={card.teamId} context={card.context} onClose={close} />;
}
