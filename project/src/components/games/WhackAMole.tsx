import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Hammer } from 'lucide-react';

const CANVAS_W = 400;
const CANVAS_H = 360;
const GRID_COLS = 3;
const GRID_ROWS = 3;
const HOLE_W = 100;
const HOLE_H = 80;
const HOLE_GAP = 16;
const GRID_OFFSET_X = (CANVAS_W - (GRID_COLS * HOLE_W + (GRID_COLS - 1) * HOLE_GAP)) / 2;
const GRID_OFFSET_Y = 30;

type MoleState = 'hidden' | 'up' | 'hit';

type Hole = {
  x: number;
  y: number;
  mole: MoleState;
  moleTimer: number;
  type: 'mole' | 'bomb';
};

export default function WhackAMole() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const holesRef = useRef<Hole[]>([]);
  const animRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('whack-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const initHoles = useCallback(() => {
    const holes: Hole[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        holes.push({
          x: GRID_OFFSET_X + c * (HOLE_W + HOLE_GAP),
          y: GRID_OFFSET_Y + r * (HOLE_H + HOLE_GAP),
          mole: 'hidden',
          moleTimer: 0,
          type: 'mole',
        });
      }
    }
    holesRef.current = holes;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(30);
    initHoles();
    lastSpawnRef.current = 0;
    setGameState('playing');
  }, [initHoles]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('whack-best', scoreRef.current.toString());
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, bestScore]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      // Spawn moles
      if (now - lastSpawnRef.current > 700) {
        const hidden = holesRef.current.filter((h) => h.mole === 'hidden');
        if (hidden.length > 0 && Math.random() < 0.7) {
          const h = hidden[Math.floor(Math.random() * hidden.length)];
          h.mole = 'up';
          h.moleTimer = 0;
          h.type = Math.random() < 0.15 ? 'bomb' : 'mole';
        }
        lastSpawnRef.current = now;
      }

      // Update moles
      holesRef.current.forEach((h) => {
        if (h.mole === 'up') {
          h.moleTimer++;
          if (h.moleTimer > 80) {
            h.mole = 'hidden';
          }
        } else if (h.mole === 'hit') {
          h.moleTimer++;
          if (h.moleTimer > 15) {
            h.mole = 'hidden';
          }
        }
      });

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#0d2f1d');
      grad.addColorStop(1, '#0a1a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Holes
      holesRef.current.forEach((h) => {
        // Hole
        ctx.fillStyle = '#1a0d05';
        ctx.beginPath();
        ctx.ellipse(h.x + HOLE_W / 2, h.y + HOLE_H / 2 + 10, HOLE_W / 2, HOLE_H / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Mole
        if (h.mole === 'up' || h.mole === 'hit') {
          const popUp = h.mole === 'hit' ? Math.max(0, 1 - h.moleTimer / 15) : Math.min(1, h.moleTimer / 10);
          const moleY = h.y + HOLE_H / 2 + 10 - (HOLE_H * 0.5) * popUp;

          if (h.type === 'bomb') {
            // Bomb
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2, moleY, 22, 0, Math.PI * 2);
            ctx.fill();
            // Fuse
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(h.x + HOLE_W / 2, moleY - 22);
            ctx.lineTo(h.x + HOLE_W / 2 + 8, moleY - 32);
            ctx.stroke();
            // Spark
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2 + 8, moleY - 32, 4, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2 - 7, moleY - 3, 3, 0, Math.PI * 2);
            ctx.arc(h.x + HOLE_W / 2 + 7, moleY - 3, 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Mole body
            const moleColor = h.mole === 'hit' ? '#ff3355' : '#8B4513';
            ctx.fillStyle = moleColor;
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2, moleY, 22, 0, Math.PI * 2);
            ctx.fill();
            // Ears
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2 - 15, moleY - 15, 7, 0, Math.PI * 2);
            ctx.arc(h.x + HOLE_W / 2 + 15, moleY - 15, 7, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2 - 7, moleY - 3, 5, 0, Math.PI * 2);
            ctx.arc(h.x + HOLE_W / 2 + 7, moleY - 3, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2 - 7, moleY - 3, 2.5, 0, Math.PI * 2);
            ctx.arc(h.x + HOLE_W / 2 + 7, moleY - 3, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Nose
            ctx.fillStyle = '#ff6699';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2, moleY + 5, 3, 0, Math.PI * 2);
            ctx.fill();
            // Teeth
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(h.x + HOLE_W / 2 - 4, moleY + 8, 3, 5);
            ctx.fillRect(h.x + HOLE_W / 2 + 1, moleY + 8, 3, 5);
          }

          // Hit effect
          if (h.mole === 'hit') {
            ctx.fillStyle = 'rgba(255,255,0,0.3)';
            ctx.beginPath();
            ctx.arc(h.x + HOLE_W / 2, moleY, 30, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    holesRef.current.forEach((h) => {
      if (h.mole !== 'up') return;
      const cx = h.x + HOLE_W / 2;
      const cy = h.y + HOLE_H / 2;
      if (Math.abs(x - cx) < 30 && Math.abs(y - cy) < 35) {
        h.mole = 'hit';
        h.moleTimer = 0;
        if (h.type === 'bomb') {
          scoreRef.current = Math.max(0, scoreRef.current - 5);
          setScore(scoreRef.current);
        } else {
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }
      }
    });
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className={`font-display font-bold text-lg ${timeLeft <= 5 ? 'text-red-400' : 'text-yellow-400'}`}>
            {timeLeft}s
          </div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleClick}
          className="rounded-2xl border border-slate-700/50 cursor-pointer touch-none"
          style={{ maxWidth: '100%', maxHeight: '360px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Hammer className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Whack-a-Mole</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Click the moles as they pop up! +10 points each. But avoid the bombs — they cost you 5 points. 30-second rounds.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Whacking
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Time's Up!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg mt-5">
        <Trophy className="w-4 h-4 text-pink-400" />
        <span className="text-sm text-gray-400">Best:</span>
        <span className="font-display font-bold text-pink-400">{bestScore}</span>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Tap moles for +10 points. Avoid bombs (-5). How many can you whack in 30 seconds?
      </p>
    </div>
  );
}
