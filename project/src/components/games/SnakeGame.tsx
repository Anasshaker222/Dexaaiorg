import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Gamepad } from 'lucide-react';

const GRID = 20;
const CELL = 18;
const CANVAS_W = GRID * CELL;
const CANVAS_H = GRID * CELL;

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Dir>('right');
  const nextDirRef = useRef<Dir>('right');
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const animRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const speedRef = useRef(120);

  useEffect(() => {
    const stored = localStorage.getItem('snake-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const spawnFood = useCallback(() => {
    let f: Point;
    do {
      f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snakeRef.current.some((s) => s.x === f.x && s.y === f.y));
    foodRef.current = f;
  }, []);

  const startGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = 'right';
    nextDirRef.current = 'right';
    scoreRef.current = 0;
    speedRef.current = 120;
    setScore(0);
    spawnFood();
    setGameState('playing');
  }, [spawnFood]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const map: Record<string, Dir> = {
        ArrowUp: 'up', w: 'up',
        ArrowDown: 'down', s: 'down',
        ArrowLeft: 'left', a: 'left',
        ArrowRight: 'right', d: 'right',
      };
      const newDir = map[e.key];
      if (!newDir) return;
      e.preventDefault();
      const opposites: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (newDir !== opposites[dirRef.current]) {
        nextDirRef.current = newDir;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState]);

  // Touch
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    const opposites: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    let newDir: Dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      newDir = dx > 0 ? 'right' : 'left';
    } else {
      newDir = dy > 0 ? 'down' : 'up';
    }
    if (newDir !== opposites[dirRef.current]) {
      nextDirRef.current = newDir;
    }
    touchStartRef.current = null;
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      if (now - lastMoveRef.current >= speedRef.current) {
        lastMoveRef.current = now;
        dirRef.current = nextDirRef.current;
        const snake = snakeRef.current;
        const head = snake[0];
        const dir = dirRef.current;
        const newHead: Point = {
          x: head.x + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0),
          y: head.y + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0),
        };

        // Wall collision
        if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('snake-best', scoreRef.current.toString());
          }
          return;
        }

        // Self collision
        if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('snake-best', scoreRef.current.toString());
          }
          return;
        }

        snake.unshift(newHead);

        // Food
        if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
          scoreRef.current += 10;
          setScore(scoreRef.current);
          if (scoreRef.current % 50 === 0 && speedRef.current > 60) {
            speedRef.current -= 8;
          }
          spawnFood();
        } else {
          snake.pop();
        }
      }

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid
      ctx.strokeStyle = 'rgba(0,240,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, CANVAS_H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(CANVAS_W, i * CELL);
        ctx.stroke();
      }

      // Food
      const food = foodRef.current;
      ctx.fillStyle = '#ff2e93';
      ctx.shadowColor = '#ff2e93';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Snake
      snakeRef.current.forEach((s, i) => {
        const isHead = i === 0;
        ctx.fillStyle = isHead ? '#00f0ff' : `rgba(0,${Math.floor(240 - i * 4)},${Math.floor(255 - i * 4)},0.85)`;
        if (isHead) {
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, bestScore, spawnFood]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Length</div>
          <div className="font-display font-bold text-lg text-green-400">{Math.floor(score / 10) + 1}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="rounded-2xl border border-slate-700/50 touch-none"
          style={{ maxWidth: '100%', maxHeight: '360px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Gamepad className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Neon Snake</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Eat the glowing dots to grow. Don't hit the walls or yourself! Arrow keys or swipe to control.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Game
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Game Over</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">{bestScore}</span>
        </div>
        {gameState === 'playing' && (
          <div className="flex gap-2">
            <button onClick={() => nextDirRef.current = 'up'} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">↑</button>
            <div className="flex gap-2">
              <button onClick={() => nextDirRef.current = 'left'} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">←</button>
              <button onClick={() => nextDirRef.current = 'down'} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">↓</button>
              <button onClick={() => nextDirRef.current = 'right'} className="btn-ghost w-10 h-10 rounded-lg flex items-center justify-center text-lg">→</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Arrow keys or swipe to move. Eat dots to grow — speed increases as you score!
      </p>
    </div>
  );
}
