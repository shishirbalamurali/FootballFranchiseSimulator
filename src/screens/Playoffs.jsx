import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';

export default function Playoffs({ onBack, onStartOffseason }) {
    const playoffBracket = useGameStore(state => state.playoffBracket);
    const userTeamId = useGameStore(state => state.userTeamId);
    const seasonRecap = useGameStore(state => state.seasonRecap);
    const concludeSeason = useGameStore(state => state.concludeSeason);
    const userTeam = TEAMS.find(t => t.id === userTeamId);
    const theme = userTeam?.theme || {};

    const [simResult, setSimResult] = useState(null); // { match, winner }
    const [showRecap, setShowRecap] = useState(false);
    const [isSimulatingRound, setIsSimulatingRound] = useState(false);

    // Initial round state to detect round changes
    const [currentRound, setCurrentRound] = useState(playoffBracket?.round);

    useEffect(() => {
        if (playoffBracket?.round !== currentRound) {
            setIsSimulatingRound(false); // Stop sim if round advanced
            setCurrentRound(playoffBracket?.round);
        }
    }, [playoffBracket?.round, currentRound]);

    useEffect(() => {
        if (isSimulatingRound && !simResult && !showRecap) {
            const timeout = setTimeout(() => {
                handleSimNext();
            }, 800); // Small delay between games
            return () => clearTimeout(timeout);
        }
    }, [isSimulatingRound, simResult, showRecap]);

    // Helper for text contrast (reusing logic)
    const getContrastColor = (hexColor) => {
        if (!hexColor) return '#ffffff';
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    };

    const handleSimNext = () => {
        const result = useGameStore.getState().simulateNextPlayoffGame();

        if (result) {
            const { playedGame, seasonOver } = result;
            // specific match result for popup
            const home = TEAMS.find(t => t.id === playedGame.homeTeamId);
            const away = TEAMS.find(t => t.id === playedGame.awayTeamId);
            const winnerId = playedGame.homeScore > playedGame.awayScore ? home.id : away.id;

            setSimResult({
                game: playedGame,
                home,
                away,
                winnerId
            });

            if (seasonOver) {
                setIsSimulatingRound(false);
                // Calculate awards immediately but show recap after popup closes
                useGameStore.getState().concludeSeason();
                setTimeout(() => {
                    setSimResult(null);
                    setShowRecap(true);
                }, 3000);
            } else {
                // Auto close popup
                setTimeout(() => setSimResult(null), 2000);
            }
        } else {
            // No more games in this round?
            setIsSimulatingRound(false);
        }
    };

    const handleStartSimRound = () => {
        setIsSimulatingRound(true);
    };

    if (!playoffBracket) {
        return (
            <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-paper">
                <div className="retro-card p-8 text-center border-4 border-ink">
                    <h1 className="text-3xl font-bold text-ink mb-4">Playoffs Not Started</h1>
                    <Button onClick={onBack} variant="primary">Back</Button>
                </div>
            </div>
        );
    }

    const MatchupCard = ({ title, matchup, compact = false }) => {
        if (!matchup) return <div className="h-20 w-48 bg-gray-200/50 rounded border-2 border-dashed border-gray-400 opacity-50"></div>;

        const home = TEAMS.find(t => t.id === matchup.homeTeamId);
        const away = TEAMS.find(t => t.id === matchup.awayTeamId);

        const standings = useGameStore.getState().standings || {};
        const getRecord = (id) => {
            const s = standings[id];
            if (!s) return '';
            return `(${s.wins}-${s.losses})`;
        };

        const isWinner = (id) => matchup.played && matchup.winnerId === id;

        // Ensure colors are strings
        const homeColor = home?.theme?.primary || '#333333';
        const awayColor = away?.theme?.primary || '#333333';

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-48 retro-card p-0 overflow-hidden border-2 mb-2 relative shadow-md transition-transform hover:scale-105 z-10"
                style={{ borderColor: theme.ink }}
            >
                {/* Header */}
                <div className="bg-ink text-paper text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider flex justify-between items-center">
                    <span>{title}</span>
                </div>

                {/* Away Team */}
                <div className={`flex justify-between items-center px-3 py-2 ${isWinner(away?.id) ? 'bg-yellow-100' : 'bg-white'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-sm shadow-sm" style={{ backgroundColor: awayColor }}></div>
                        <div className="flex flex-col leading-tight">
                            <span className={`font-bold text-sm truncate ${isWinner(away?.id) ? 'text-ink' : 'text-gray-600'}`}>{away?.abbreviation || away?.location.substring(0, 3).toUpperCase()}</span>
                            <span className="text-[9px] font-bold text-gray-400">{getRecord(away?.id)}</span>
                        </div>
                    </div>
                    <span className={`font-black text-lg ${isWinner(away?.id) ? 'text-ink' : 'text-gray-400'}`}>{matchup.awayScore ?? ''}</span>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 mx-2"></div>

                {/* Home Team */}
                <div className={`flex justify-between items-center px-3 py-2 ${isWinner(home?.id) ? 'bg-yellow-100' : 'bg-white'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-sm shadow-sm" style={{ backgroundColor: homeColor }}></div>
                        <div className="flex flex-col leading-tight">
                            <span className={`font-bold text-sm truncate ${isWinner(home?.id) ? 'text-ink' : 'text-gray-600'}`}>{home?.abbreviation || home?.location.substring(0, 3).toUpperCase()}</span>
                            <span className="text-[9px] font-bold text-gray-400">{getRecord(home?.id)}</span>
                        </div>
                    </div>
                    <span className={`font-black text-lg ${isWinner(home?.id) ? 'text-ink' : 'text-gray-400'}`}>{matchup.homeScore ?? ''}</span>
                </div>
            </motion.div>
        );
    };

    const ConferenceBracket = ({ name, data, align = 'left' }) => {
        // Alignment logic: if 'left' (AFC), flow moves Right. if 'right' (NFC), flow moves Left.
        // We handle this by flexible justification.

        return (
            <div className={`flex flex-col ${align === 'right' ? 'items-start' : 'items-end'}`}>
                <h2 className={`text-4xl font-black text-ink uppercase italic mb-8 px-8 py-2 bg-yellow-400 border-4 border-ink rotate-[-2deg] shadow-retro text-center self-center`}>
                    {name}
                </h2>

                <div className={`flex items-center gap-8 ${align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>

                    {/* Wild Card Round */}
                    <div className="flex flex-col gap-8 justify-center min-h-[500px]">
                        <h3 className="text-gray-500 font-bold uppercase text-xs text-center mb-1 bg-white/80 rounded py-1 border border-gray-300">Wild Card</h3>
                        <div className="flex flex-col gap-6">
                            {data.wc.map((m, i) => <MatchupCard key={i} title={'Wild Card'} matchup={m} />)}
                        </div>

                        {/* Bye Box */}
                        <div className="mt-4 flex flex-col items-center opacity-75">
                            <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Top Seed Bye</div>
                            <div className="bg-white border-2 border-dashed border-gray-400 px-4 py-2 rounded text-sm font-bold text-gray-700">
                                {TEAMS.find(t => t.id === data.seeds[0])?.location}
                            </div>
                        </div>
                    </div>

                    {/* Connector Lines would go here ideally */}

                    {/* Div Round */}
                    <div className="flex flex-col gap-16 justify-center min-h-[500px]">
                        <h3 className="text-gray-500 font-bold uppercase text-xs text-center mb-1 bg-white/80 rounded py-1 border border-gray-300">Divisional</h3>
                        <div className="flex flex-col gap-12">
                            {data.div.length > 0 ? (
                                data.div.map((m, i) => <MatchupCard key={i} title={'Divisional'} matchup={m} />)
                            ) : (
                                <>
                                    <MatchupCard title="Divisional" />
                                    <MatchupCard title="Divisional" />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Conf Round */}
                    <div className="flex flex-col gap-6 justify-center min-h-[500px]">
                        <h3 className="text-gray-500 font-bold uppercase text-xs text-center mb-1 bg-white/80 rounded py-1 border border-gray-300">Conference</h3>
                        <div className="flex flex-col justify-center h-full">
                            {data.conf.length > 0 ? (
                                data.conf.map((m, i) => <MatchupCard key={i} title={'Championship'} matchup={m} />)
                            ) : (
                                <MatchupCard title="Championship" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className="min-h-screen p-4 pt-8 bg-paper pattern-dots overflow-x-auto relative"
            style={{ '--color-primary': theme.primary }}
        >
            {/* MATCHUP RESULT POPUP */}
            <AnimatePresence>
                {simResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setSimResult(null)}
                    >
                        <div className="bg-white border-4 border-ink p-8 rounded-lg shadow-retro max-w-lg w-full text-center" onClick={e => e.stopPropagation()}>
                            <h2 className="text-2xl font-black text-ink uppercase mb-6 border-b-2 border-gray-200 pb-2">Result</h2>
                            <div className="flex justify-between items-center gap-8">
                                <div className={`flex flex-col items-center gap-2 ${simResult.game.homeScore > simResult.game.awayScore ? 'scale-110' : 'opacity-75 grayscale'}`}>
                                    <div className="w-16 h-16 rounded shadow-md" style={{ backgroundColor: simResult.home.theme.primary }}></div>
                                    <span className="font-bold text-xl">{simResult.home.location}</span>
                                    <span className="text-6xl font-black">{simResult.game.homeScore}</span>
                                </div>
                                <div className="text-4xl font-bold text-gray-300">VS</div>
                                <div className={`flex flex-col items-center gap-2 ${simResult.game.awayScore > simResult.game.homeScore ? 'scale-110' : 'opacity-75 grayscale'}`}>
                                    <div className="w-16 h-16 rounded shadow-md" style={{ backgroundColor: simResult.away.theme.primary }}></div>
                                    <span className="font-bold text-xl">{simResult.away.location}</span>
                                    <span className="text-6xl font-black">{simResult.game.awayScore}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SEASON RECAP MODAL */}
            <AnimatePresence>
                {showRecap && seasonRecap && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
                    >
                        <div className="bg-paper border-4 border-ink p-8 rounded-lg shadow-retro max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-8">
                                <h1 className="text-6xl font-black text-ink italic drop-shadow-retro mb-2 text-yellow-500 outline-text">SEASON RECAP</h1>
                                <p className="text-xl font-bold text-gray-500">Year {seasonRecap.year} Complete</p>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                {/* Champion */}
                                <div className="col-span-2 bg-yellow-100 border-4 border-ink p-6 rounded flex items-center justify-center gap-8 shadow-sm">
                                    <div className="text-center">
                                        <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Super Bowl Champion</div>
                                        <div className="text-5xl font-black text-ink">{seasonRecap.champion.location}</div>
                                        <div className="text-2xl font-bold text-ink/70">{seasonRecap.champion.nickname}</div>
                                    </div>
                                    <div className="text-8xl">🏆</div>
                                </div>

                                {/* MVP */}
                                <div className="retro-card p-6 border-2 border-ink bg-white">
                                    <div className="text-xs font-bold uppercase bg-blue-100 text-blue-800 px-2 py-1 inline-block mb-2 rounded">League MVP</div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-200 rounded-full border-2 border-gray-400"></div>
                                        <div>
                                            <div className="text-2xl font-black">{seasonRecap.awards.mvp?.name}</div>
                                            <div className="text-sm font-bold text-gray-500">{seasonRecap.awards.mvp?.position} • {seasonRecap.awards.mvp?.teamLocation}</div>
                                        </div>
                                    </div>
                                    {/* Quick Stats */}
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold bg-gray-50 p-2 rounded">
                                        {seasonRecap.awards.mvp.position === 'QB' && (
                                            <>
                                                <div>
                                                    <div className="text-gray-400">YDS</div>
                                                    <div>{seasonRecap.awards.mvp.stats.season.passingYards}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">TD</div>
                                                    <div>{seasonRecap.awards.mvp.stats.season.passingTDs}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">INT</div>
                                                    <div>{seasonRecap.awards.mvp.stats.season.interceptions}</div>
                                                </div>
                                            </>
                                        )}
                                        {/* Add logic for other positions if needed */}
                                    </div>
                                </div>

                                {/* OPOY & DPOY Small Cards */}
                                <div className="space-y-4">
                                    <div className="retro-card p-4 border-2 border-ink bg-white flex justify-between items-center">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase text-gray-500">Offensive Player of the Year</div>
                                            <div className="font-black text-lg">{seasonRecap.awards.opoy?.name}</div>
                                            <div className="text-xs text-gray-500">{seasonRecap.awards.opoy?.position} • {seasonRecap.awards.opoy?.teamLocation}</div>
                                        </div>
                                        <div className="text-2xl">🏈</div>
                                    </div>

                                    <div className="retro-card p-4 border-2 border-ink bg-white flex justify-between items-center">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase text-gray-500">Defensive Player of the Year</div>
                                            <div className="font-black text-lg">{seasonRecap.awards.dpoy?.name}</div>
                                            <div className="text-xs text-gray-500">{seasonRecap.awards.dpoy?.position} • {seasonRecap.awards.dpoy?.teamLocation}</div>
                                        </div>
                                        <div className="text-2xl">🛡️</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <Button
                                    className="px-8 py-4 text-xl bg-ink text-white hover:bg-gray-800"
                                    onClick={() => {
                                        setShowRecap(false);
                                        if (onStartOffseason) onStartOffseason();
                                    }}
                                >
                                    Start Offseason
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="min-w-[1400px] mx-auto">
                {/* Header */}
                <div className="flex justify-between items-start mb-8 relative z-50">
                    <Button
                        onClick={onBack}
                        className="text-lg px-6 py-2 border-2"
                        style={{
                            background: theme.secondary,
                            borderColor: theme.accent,
                            color: getContrastColor(theme.secondary)
                        }}
                    >
                        ← Hub
                    </Button>

                    <div className="text-center absolute left-1/2 transform -translate-x-1/2 top-0">
                        <h1 className="text-7xl font-black text-ink italic drop-shadow-retro outline-text text-white" style={{ textShadow: `4px 4px 0px ${theme.primary}` }}>
                            PLAYOFFS
                        </h1>
                        <div className="text-xl font-bold bg-white border-2 border-ink inline-block px-4 py-1 -mt-2 transform rotate-2 shadow-sm">
                            Road to the Super Bowl
                        </div>
                    </div>

                    <Button
                        onClick={handleStartSimRound}
                        disabled={isSimulatingRound}
                        className="text-lg px-6 py-2 border-2 animate-pulse hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: '#22c55e', // Green
                            borderColor: theme.accent,
                            color: '#000'
                        }}
                    >
                        {isSimulatingRound ? 'Simulating...' : 'Sim Round'}
                    </Button>
                </div>

                {/* Main Tournament Grid */}
                <div className="flex justify-center items-stretch gap-8">
                    {/* LEFT SIDE - AFC (Align Left means flowing to the right) */}
                    {/* Wait, if AFC is on Left, we want flow: WC -> Div -> Conf -> Center. */}
                    {/* My ConferenceBracket logic: 'flex-row' means WC Left, Conf Right. Matches Left side of screen. */}
                    <div className="flex-1 flex justify-end">
                        <ConferenceBracket name="AFC" data={playoffBracket.afc} align="left" />
                    </div>

                    {/* CENTER - SUPER BOWL */}
                    <div className="flex flex-col items-center justify-center gap-8 w-64 z-10">
                        {/* Trophy Icon or something? */}
                        <div className="w-px h-full bg-gray-300 absolute top-32 bottom-0 z-0"></div>
                        <div className="bg-white border-4 border-ink p-4 rounded-full z-10 shadow-retro mb-4">
                            <div className="text-4xl">🏆</div>
                        </div>

                        <div className="scale-125 z-10">
                            <h3 className="text-ink font-black uppercase text-sm text-center mb-2 bg-yellow-400 border-2 border-ink px-2 py-1 transform -rotate-2">Super Bowl</h3>
                            {playoffBracket.sb ? (
                                <MatchupCard title="Super Bowl" matchup={playoffBracket.sb} />
                            ) : (
                                <div className="w-56 h-32 retro-card flex flex-col items-center justify-center border-4 border-ink bg-gray-100">
                                    <span className="font-bold text-gray-500 text-2xl font-heading opacity-50">TBD</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE - NFC (Align Right means flowing to the left) */}
                    {/* ConferenceBracket logic: 'flex-row-reverse' means WC Right, Conf Left. Matches Right side of screen. */}
                    <div className="flex-1 flex justify-start">
                        <ConferenceBracket name="NFC" data={playoffBracket.nfc} align="right" />
                    </div>
                </div>
            </div>
        </div>
    );
}
