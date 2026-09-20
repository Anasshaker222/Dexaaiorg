import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';

type Grid = number[][];

const SIZE = 4;

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandomTile(grid: Grid): Grid {
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map((row) => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
}

function initGrid(): Grid {
  return addRandomTile(addRandomTile(emptyGrid()));
}

function slide(row: number[]): { row: number[]; gained: number } {
  const filtered = row.filter((v) => v !== 0);
  let gained = 0;
  const result: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);
      gained += merged;
      i += 2;
    } else {
      result.push(filtered[i]);
      i++;
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, gained };
}

function rotateCW(grid: Grid): Grid {
  const n = SIZE;
  const result = emptyGrid();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[c][n - 1 - r] = grid[r][c];
    }
  }
  return result;
}

function rotateCCW(grid: Grid): Grid {
  const n = SIZE;
  const result = emptyGrid();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[n - 1 - c][r] = grid[r][c];
    }
  }
  return result;
}

type Direction = 'left' | 'right' | 'up' | 'down';

function move(grid: Grid, dir: Direction): { grid: Grid; gained: number; moved: boolean } {
  let working = grid.map((row) => [...row]);
  if (dir === 'up') working = rotateCCW(working);
  if (dir === 'down') working = rotateCW(working);

  let gained = 0;
  const newRows = working.map((row) => {
    const { row: newRow, gained: g } = slide(row);
    gained += g;
    return newRow;
  });

  let result = newRows;
  if (dir === 'up') result = rotateCW(result);
  if (dir === 'down') result = rotateCCW(result);

  const moved = JSON.stringify(result) !== JSON.stringify(grid);
  return { grid: result, gained, moved };
}

function canMove(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

const TILE_COLORS: Record<number, string> = {
  0: 'bg-slate-800/50 text-transparent',
  2: 'bg-slate-700 text-slate-100',
  4: 'bg-slate-600 text-slate-100',
  8: 'bg-orange-600 text-white',
  16: 'bg-orange-500 text-white',
  32: 'bg-red-500 text-white',
  64: 'bg-red-600 text-white',
  128: 'bg-yellow-600 text-white',
  256: 'bg-yellow-500 text-white',
  512: 'bg-cyan-600 text-white',
  1024: 'bg-cyan-500 text-white',
  2048: 'bg-gradient-to-br from-cyan-400 to-pink-500 text-white',
};

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(initGrid);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('2048-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const reset = useCallback(() => {
    setGrid(initGrid());
    setScore(0);
    setGameOver(false);
    setWon(false);
  }, []);

  const handleMove = useCallback(
    (dir: Direction) => {
      if (gameOver) return;
      setGrid((prev) => {
        const { grid: newGrid, gained, moved } = move(prev, dir);
        if (!moved) return prev;
        const withRandom = addRandomTile(newGrid);
        setScore((s) => {
          const newScore = s + gained;
          if (newScore > bestScore) {
            setBestScore(newScore);
            localStorage.setItem('2048-best', newScore.toString());
          }
          return newScore;
        });
        if (!won && withRandom.some((row) => row.includes(2048))) {
          setWon(true);
        }
        if (!canMove(withRandom)) {
          setGameOver(true);
        }
        return withRandom;
      });
    },
    [gameOver, won, bestScore]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        a: 'left',
        d: 'right',
        w: 'up',
        s: 'down',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleMove]);

  // Touch support
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
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? 'right' : 'left');
    } else {
      handleMove(dy > 0 ? 'down' : 'up');
    }
    touchStartRef.current = null;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Score */}
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Best</div>
          <div className="font-display font-bold text-lg text-pink-400">{bestScore}</div>
        </div>
      </div>

      {/* Win banner */}
      {won && !gameOver && (
        <div className="mb-4 px-6 py-2 rounded-xl glass neon-border animate-scale-in text-center">
          <div className="font-display font-bold text-green-400">You hit 2048! Keep going!</div>
        </div>
      )}

      {/* Board */}
      <div
        className="relative p-3 rounded-2xl glass mb-5 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2.5">
          {grid.flat().map((value, i) => (
            <div
              key={i}
              className={`w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center font-display font-bold transition-all duration-150 ${
                TILE_COLORS[value] || 'bg-pink-600 text-white'
              } ${value > 0 ? 'tile-pop' : ''} ${value >= 1024 ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}
            >
              {value > 0 ? value : ''}
            </div>
          ))}
        </div>

        {gameOver && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-pink-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Game Over</div>
            <div className="text-sm text-gray-400 mb-4">Score: {score}</div>
            <button
              onClick={reset}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => handleMove('up')}
          className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl"
        >
          ↑
        </button>
        <div className="flex gap-2">
          <button onClick={() => handleMove('left')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">←</button>
          <button onClick={() => handleMove('down')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">↓</button>
          <button onClick={() => handleMove('right')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">→</button>
        </div>
      </div>

      <button
        onClick={reset}
        className="mt-5 btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        New Game
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Use arrow keys or swipe to combine tiles. Reach 2048 to win!
      </p>
    </div>
  );
}
