import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeProvider from './components/ThemeProvider';
import TeamSelect from './screens/TeamSelect';
import HomeHub from './screens/HomeHub';
import Standings from './screens/Standings';
import Roster from './screens/Roster';
import Draft from './screens/Draft';
import Schedule from './screens/Schedule';
import Stats from './screens/Stats';
import Playoffs from './screens/Playoffs';
import Awards from './screens/Awards';
import ErrorBoundary from './components/ErrorBoundary';
import { useGameStore } from './store/gameStore';

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.3, ease: 'easeInOut' }}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

const BackButton = ({ onClick }) => (
  <button
    className="btn-retro fixed top-6 left-6 z-50 flex items-center gap-2 text-sm"
    onClick={onClick}
  >
    <span>←</span>
    <span>Back</span>
  </button>
);

export default function App() {
  const initialized = useGameStore(state => state.initialized);
  const userTeamId = useGameStore(state => state.userTeamId);
  const [currentScreen, setCurrentScreen] = useState('home');

  if (!initialized) {
    return (
      <ErrorBoundary>
        <TeamSelect onTeamSelected={() => setCurrentScreen('home')} />
      </ErrorBoundary>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeHub onNavigate={setCurrentScreen} />;
      case 'standings':
        return (
          <>
            <BackButton onClick={() => setCurrentScreen('home')} />
            <Standings />
          </>
        );
      case 'roster':
        return (
          <>
            <BackButton onClick={() => setCurrentScreen('home')} />
            <Roster />
          </>
        );
      case 'draft':
        return (
          <>
            <BackButton onClick={() => setCurrentScreen('home')} />
            <Draft />
          </>
        );
      case 'schedule':
        return (
          <>
            <BackButton onClick={() => setCurrentScreen('home')} />
            <Schedule />
          </>
        );
      case 'stats':
        return (
          <>
            <BackButton onClick={() => setCurrentScreen('home')} />
            <Stats />
          </>
        );
      case 'awards':
        return <Awards onBack={() => setCurrentScreen('home')} />;
      case 'playoffs':
        return <Playoffs
          onBack={() => setCurrentScreen('home')}
          onStartOffseason={() => {
            useGameStore.getState().startDraft();
            setCurrentScreen('home');
          }}
        />;
      default:
        return <HomeHub onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="min-h-screen w-screen bg-paper text-ink">
          <AnimatePresence mode="wait">
            <motion.div key={currentScreen} className="h-full w-full">
              <PageTransition>{renderScreen()}</PageTransition>
            </motion.div>
          </AnimatePresence>
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
