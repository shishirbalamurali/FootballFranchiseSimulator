import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';

export default function ThemeProvider({ children }) {
    const userTeamId = useGameStore(state => state.userTeamId);
    const teams = useGameStore(state => state.teams);

    // Get user team's theme
    const getUserTheme = () => {
        if (!userTeamId) return null;

        const team = TEAMS.find(t => t.id === userTeamId);
        return team?.theme;
    };

    const theme = getUserTheme();

    // Apply theme to CSS variables
    useEffect(() => {
        if (theme) {
            const root = document.documentElement;
            root.style.setProperty('--color-primary', theme.primary);
            root.style.setProperty('--color-secondary', theme.secondary);
            root.style.setProperty('--color-accent', theme.accent);
            root.style.setProperty('--color-bg-a', theme.bgA);
            root.style.setProperty('--color-bg-b', theme.bgB);

            // Set pattern overlay based on type
            const patterns = {
                dots: `radial-gradient(circle, ${theme.primary} 1px, transparent 1px)`,
                stripes: `repeating-linear-gradient(45deg, ${theme.primary}, ${theme.primary} 2px, transparent 2px, transparent 8px)`,
                paper: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)`
            };
            root.style.setProperty('--pattern-overlay', patterns[theme.pattern] || patterns.dots);
        }
    }, [theme]);

    return (
        <motion.div
            className="min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {children}
        </motion.div>
    );
}
