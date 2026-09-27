// UI-only stores for the front office (Claude-owned). Not persisted.
//   usePlayerCard — open any player's card from anywhere (PlayerCardHost renders it)
//   useNav        — lets deep components navigate (App registers `go`)
import { create } from 'zustand';

export const usePlayerCard = create(set => ({
    card: null, // { player, teamId, context }
    open: (player, teamId, context = {}) => set({ card: player ? { player, teamId, context } : null }),
    close: () => set({ card: null }),
}));

export const useNav = create(set => ({
    go: null,
    register: go => set({ go }),
}));

export const openPlayerCard = (player, teamId, context) => usePlayerCard.getState().open(player, teamId, context);
export const navigate = screen => useNav.getState().go?.(screen);
