import { useLayoutEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { buildTeamTheme } from '../styles/teamStyles';
import { useThemePreview } from '../styles/themePreview';
import { refreshCanvasTokens } from './ui/canvasTokens';

// The ONE place team colours enter the design system. Each franchise gets its
// own paper, ink, lettering, pattern and day/night mode (see teamStyles.js);
// everything downstream just reads the resulting CSS custom properties.

export default function ThemeProvider({ children }) {
  const userTeamId = useGameStore(state => state.userTeamId);
  const previewTeamId = useThemePreview(state => state.previewTeamId);
  const teamId = previewTeamId ?? userTeamId;

  useLayoutEffect(() => {
    const team = TEAMS.find(t => t.id === teamId) ?? null;
    const { mode, vars } = buildTeamTheme(team);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.mode = mode;
    root.dataset.team = team?.id ?? 'none';
    root.style.colorScheme = mode === 'night' ? 'dark' : 'light';
    refreshCanvasTokens();
  }, [teamId]);

  return children;
}
