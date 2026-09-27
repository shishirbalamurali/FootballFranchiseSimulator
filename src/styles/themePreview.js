import { create } from 'zustand';

// Lets a screen temporarily dress the whole app in another team's colours —
// TeamSelect uses it so hovering a franchise previews its identity live.
export const useThemePreview = create(set => ({
  previewTeamId: null,
  setPreviewTeamId: (previewTeamId) => set({ previewTeamId }),
}));

// Dev-only: `__previewTeam('bears')` from the console to audit a theme.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__previewTeam = (id) => useThemePreview.getState().setPreviewTeamId(id);
}
