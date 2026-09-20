import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Zap, Trophy } from 'lucide-react';

type GameState = 'idle' | 'waiting' | 'ready' | 'result' | 'tooSoon';

export default function ReactionTime() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('reaction-best');
    if (stored) setBestTime(parseInt(stored));
  }, []);

  const startTest = useCallback(() => {
    setGameState('waiting');
    setReactionTime(null);
    const delay = 1500 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      setGameState('ready');
      startTimeRef.current = performance.now();
    }, delay);
  }, []);

  const handleClick = useCallback(() => {
    if (gameState === 'idle' || gameState === 'result' || gameState === 'tooSoon') {
      startTest();
    } else if (gameState === 'waiting') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setGameState('tooSoon');
    } else if (gameState === 'ready') {
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setReactionTime(elapsed);
      setGameState('result');
      setAttempts((prev) => [elapsed, ...prev].slice(0, 5));
      if (bestTime === null || elapsed < bestTime) {
        setBestTime(elapsed);
        localStorage.setItem('reaction-best', elapsed.toString());
      }
    }
  }, [gameState, startTest, bestTime]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getRating = (ms: number) => {
    if (ms < 200) return { label: 'Lightning!', color: 'text-cyan-400' };
    if (ms < 250) return { label: 'Excellent', color: 'text-green-400' };
    if (ms < 300) return { label: 'Good', color: 'text-yellow-400' };
    if (ms < 400) return { label: 'Average', color: 'text-orange-400' };
    return { label: 'Slow', color: 'text-pink-400' };
  };

  const bgClass =
    gameState === 'waiting'
      ? 'from-red-900/40 to-red-950/40 border-red-700/30'
      : gameState === 'ready'
      ? 'from-green-900/40 to-green-950/40 border-green-500/50 neon-border'
      : gameState === 'tooSoon'
      ? 'from-orange-900/40 to-orange-950/40 border-orange-600/30'
      : 'from-slate-800/40 to-slate-900/40 border-slate-700/50';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Stats */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-cyan-400">
            {bestTime !== null ? `${bestTime}ms` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Last:</span>
          <span className="font-display font-bold text-pink-400">
            {reactionTime !== null ? `${reactionTime}ms` : '—'}
          </span>
        </div>
      </div>

      {/* Click area */}
      <button
        onClick={handleClick}
        className={`w-full max-w-sm h-56 rounded-2xl border bg-gradient-to-br ${bgClass} flex flex-col items-center justify-center transition-all duration-300 cursor-pointer select-none`}
      >
        {gameState === 'idle' && (
          <>
            <Zap className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white">Click to Start</div>
            <div className="text-sm text-gray-400 mt-1">Test your reflexes</div>
          </>
        )}
        {gameState === 'waiting' && (
          <>
            <div className="w-12 h-12 border-4 border-red-500/50 rounded-full animate-spin mb-3" />
            <div className="font-display font-bold text-xl text-red-400">Wait for green...</div>
            <div className="text-sm text-gray-500 mt-1">Don't click yet!</div>
          </>
        )}
        {gameState === 'ready' && (
          <>
            <Zap className="w-12 h-12 text-green-400 mb-3 animate-pulse" />
            <div className="font-display font-bold text-2xl text-green-400 neon-text">CLICK NOW!</div>
          </>
        )}
        {gameState === 'result' && reactionTime !== null && (
          <>
            <div className="font-display font-black text-4xl text-white mb-2">{reactionTime}ms</div>
            <div className={`font-display font-bold text-lg ${getRating(reactionTime).color}`}>
              {getRating(reactionTime).label}
            </div>
            <div className="text-sm text-gray-500 mt-2">Click to try again</div>
          </>
        )}
        {gameState === 'tooSoon' && (
          <>
            <div className="font-display font-bold text-xl text-orange-400 mb-2">Too Soon!</div>
            <div className="text-sm text-gray-400">Wait for the green signal</div>
            <div className="text-sm text-gray-500 mt-2">Click to retry</div>
          </>
        )}
      </button>

      {/* Recent attempts */}
      {attempts.length > 0 && (
        <div className="mt-6 w-full max-w-sm">
          <div className="text-xs text-gray-500 mb-2 text-center">Recent Attempts</div>
          <div className="flex justify-center gap-2 flex-wrap">
            {attempts.map((t, i) => (
              <div
                key={i}
                className="glass px-3 py-1.5 rounded-lg text-sm font-display font-bold"
              >
                <span className={i === 0 ? 'text-cyan-400' : 'text-gray-400'}>{t}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setBestTime(null);
          setAttempts([]);
          setReactionTime(null);
          setGameState('idle');
          localStorage.removeItem('reaction-best');
        }}
        className="mt-6 btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Reset Scores
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Wait for the screen to turn green, then click as fast as you can. The AI tracks your best time.
      </p>
    </div>
  );
}
