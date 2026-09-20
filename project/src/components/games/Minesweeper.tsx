import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trophy, Bomb, Flag } from 'lucide-react';

const ROWS = 10;
const COLS = 10;
const MINES = 15;

type Cell = {
  isMine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

const NUM_COLORS = [
  '', '#00f0ff', '#00ff88', '#ff3355', '#aa55ff',
  '#ffaa00', '#00ccff', '#ff2e93', '#ffffff',
];

function createGrid(): Cell[][] {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }))
  );

  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!grid[r][c].isMine) {
      grid[r][c].isMine = true;
      placed++;
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].isMine) {
            count++;
          }
        }
      }
      grid[r][c].adjacent = count;
    }
  }

  return grid;
}

export default function Minesweeper() {
  const [grid, setGrid] = useState<Cell[][]>(createGrid);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [flags, setFlags] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('mines-best');
    if (stored) setBestTime(parseInt(stored));
  }, []);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing' || startTime === null) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, startTime]);

  const reset = useCallback(() => {
    setGrid(createGrid());
    setGameState('playing');
    setFlags(0);
    setStartTime(null);
    setElapsed(0);
  }, []);

  const reveal = useCallback((r: number, c: number) => {
    if (gameState !== 'playing') return;
    if (startTime === null) setStartTime(Date.now());

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      if (next[r][c].revealed || next[r][c].flagged) return prev;

      if (next[r][c].isMine) {
        // Reveal all mines
        next.forEach((row) => row.forEach((cell) => {
          if (cell.isMine) cell.revealed = true;
        }));
        setGameState('lost');
        return next;
      }

      // Flood reveal
      const stack: [number, number][] = [[r, c]];
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) continue;
        if (next[cr][cc].revealed || next[cr][cc].flagged) continue;
        next[cr][cc].revealed = true;
        if (next[cr][cc].adjacent === 0 && !next[cr][cc].isMine) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              stack.push([cr + dr, cc + dc]);
            }
          }
        }
      }

      // Check win
      const unrevealed = next.flat().filter((cell) => !cell.revealed && !cell.isMine).length;
      if (unrevealed === 0) {
        setGameState('won');
        const time = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
        if (bestTime === null || time < bestTime) {
          setBestTime(time);
          localStorage.setItem('mines-best', time.toString());
        }
      }

      return next;
    });
  }, [gameState, startTime, bestTime]);

  const toggleFlag = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      if (next[r][c].revealed) return prev;
      next[r][c].flagged = !next[r][c].flagged;
      const flagCount = next.flat().filter((cell) => cell.flagged).length;
      setFlags(flagCount);
      return next;
    });
  }, [gameState]);

  return (
    <div className="flex flex-col items-center">
      {/* HUD */}
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Mines</div>
          <div className="font-display font-bold text-lg text-pink-400">{MINES - flags}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className="font-display font-bold text-lg text-cyan-400">{elapsed}s</div>
        </div>
      </div>

      {/* Win/Lost banner */}
      {gameState !== 'playing' && (
        <div className={`mb-4 px-6 py-2 rounded-xl glass animate-scale-in text-center ${
          gameState === 'won' ? 'neon-border' : 'neon-border-accent'
        }`}>
          <div className={`font-display font-bold text-lg ${gameState === 'won' ? 'text-green-400' : 'text-pink-400'}`}>
            {gameState === 'won' ? `Cleared in ${elapsed}s!` : 'Boom! You hit a mine.'}
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        className="grid gap-0.5 mb-5 p-2 rounded-2xl glass border border-slate-700/50"
        style={{ gridTemplateColumns: `repeat(${COLS}, 28px)` }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => reveal(r, c)}
              onContextMenu={(e) => toggleFlag(e, r, c)}
              disabled={gameState !== 'playing'}
              className={`w-7 h-7 rounded flex items-center justify-center text-sm font-display font-bold transition-all ${
                cell.revealed
                  ? cell.isMine
                    ? 'bg-red-500/30 border border-red-500/50'
                    : 'bg-slate-800/60 border border-slate-700/30'
                  : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 hover:border-cyan-500/50 hover:scale-105 cursor-pointer'
              }`}
              style={{ color: cell.revealed && !cell.isMine ? NUM_COLORS[cell.adjacent] : undefined }}
            >
              {cell.revealed ? (
                cell.isMine ? (
                  <Bomb className="w-4 h-4 text-red-400" />
                ) : cell.adjacent > 0 ? (
                  cell.adjacent
                ) : ''
              ) : cell.flagged ? (
                <Flag className="w-3.5 h-3.5 text-yellow-400 fill-current" />
              ) : ''}
            </button>
          ))
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Game
        </button>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">
            {bestTime !== null ? `${bestTime}s` : '—'}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Click to reveal tiles. Right-click (or long-press on mobile) to flag mines. Clear all safe tiles to win!
      </p>
    </div>
  );
}
