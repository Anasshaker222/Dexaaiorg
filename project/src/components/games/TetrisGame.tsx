import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Grid3x3 } from 'lucide-react';

const COLS = 10;
const ROWS = 18;
const CELL = 22;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

type Cell = { filled: boolean; color: string };
type Piece = {
  shape: number[][];
  x: number;
  y: number;
  color: string;
};

const SHAPES: { shape: number[][]; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#00f0ff' }, // I
  { shape: [[1, 1], [1, 1]], color: '#ffcc00' }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#aa55ff' }, // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00ff88' }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff3355' }, // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#ff8800' }, // L
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff2e93' }, // J
];

function randomPiece(): Piece {
  const { shape, color } = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { shape: shape.map((r) => [...r]), x: Math.floor(COLS / 2) - 1, y: 0, color };
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const gridRef = useRef<Cell[][]>([]);
  const pieceRef = useRef<Piece | null>(null);
  const animRef = useRef<number>(0);
  const dropTimerRef = useRef(0);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastMoveRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('tetris-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const initGrid = useCallback(() => {
    gridRef.current = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ filled: false, color: '' }))
    );
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    linesRef.current = 0;
    setScore(0);
    setLines(0);
    initGrid();
    pieceRef.current = randomPiece();
    dropTimerRef.current = 0;
    setGameState('playing');
  }, [initGrid]);

  const isValid = useCallback((piece: Piece, grid: Cell[][]) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[0].length; c++) {
        if (!piece.shape[r][c]) continue;
        const gx = piece.x + c;
        const gy = piece.y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
        if (gy >= 0 && grid[gy][gx].filled) return false;
      }
    }
    return true;
  }, []);

  const lockPiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece) return;
    const grid = gridRef.current;
    piece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          const gy = piece.y + r;
          const gx = piece.x + c;
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
            grid[gy][gx] = { filled: true, color: piece.color };
          }
        }
      });
    });

    // Clear lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((c) => c.filled)) {
        grid.splice(r, 1);
        grid.unshift(Array.from({ length: COLS }, () => ({ filled: false, color: '' })));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] || 0;
      scoreRef.current += points;
      linesRef.current += cleared;
      setScore(scoreRef.current);
      setLines(linesRef.current);
    }

    // New piece
    const newPiece = randomPiece();
    if (!isValid(newPiece, grid)) {
      setGameState('over');
      if (scoreRef.current > bestScore) {
        setBestScore(scoreRef.current);
        localStorage.setItem('tetris-best', scoreRef.current.toString());
      }
      return;
    }
    pieceRef.current = newPiece;
  }, [isValid, bestScore]);

  // Keyboard
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const now = performance.now();
      keysRef.current[e.key] = true;
      const piece = pieceRef.current;
      if (!piece) return;
      const grid = gridRef.current;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        const test = { ...piece, x: piece.x - 1 };
        if (isValid(test, grid)) piece.x--;
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        const test = { ...piece, x: piece.x + 1 };
        if (isValid(test, grid)) piece.x++;
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        const test = { ...piece, y: piece.y + 1 };
        if (isValid(test, grid)) piece.y--;
        else lockPiece();
      } else if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        const rotated = rotate(piece.shape);
        const test = { ...piece, shape: rotated };
        if (isValid(test, grid)) piece.shape = rotated;
      } else if (e.key === ' ') {
        e.preventDefault();
        let dropPiece = { ...piece };
        while (isValid({ ...dropPiece, y: dropPiece.y + 1 }, grid)) {
          dropPiece.y++;
        }
        piece.y = dropPiece.y;
        lockPiece();
      }
    };
    const handleUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [gameState, isValid, lockPiece]);

  // Touch controls via buttons
  const movePiece = useCallback((dir: 'left' | 'right' | 'down' | 'rotate' | 'drop') => {
    if (gameState !== 'playing') return;
    const piece = pieceRef.current;
    if (!piece) return;
    const grid = gridRef.current;
    if (dir === 'left') {
      const test = { ...piece, x: piece.x - 1 };
      if (isValid(test, grid)) piece.x--;
    } else if (dir === 'right') {
      const test = { ...piece, x: piece.x + 1 };
      if (isValid(test, grid)) piece.x++;
    } else if (dir === 'down') {
      const test = { ...piece, y: piece.y + 1 };
      if (isValid(test, grid)) piece.y++;
      else lockPiece();
    } else if (dir === 'rotate') {
      const rotated = rotate(piece.shape);
      const test = { ...piece, shape: rotated };
      if (isValid(test, grid)) piece.shape = rotated;
    } else if (dir === 'drop') {
      while (isValid({ ...piece, y: piece.y + 1 }, grid)) piece.y++;
      lockPiece();
    }
  }, [gameState, isValid, lockPiece]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      const dropSpeed = Math.max(200, 800 - linesRef.current * 30);
      if (now - dropTimerRef.current >= dropSpeed) {
        dropTimerRef.current = now;
        const piece = pieceRef.current;
        if (piece) {
          const test = { ...piece, y: piece.y + 1 };
          if (isValid(test, gridRef.current)) {
            piece.y++;
          } else {
            lockPiece();
          }
        }
      }

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid lines
      ctx.strokeStyle = 'rgba(0,240,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, CANVAS_H);
        ctx.stroke();
      }
      for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(CANVAS_W, i * CELL);
        ctx.stroke();
      }

      // Locked cells
      gridRef.current.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell.filled) {
            ctx.fillStyle = cell.color;
            ctx.shadowColor = cell.color;
            ctx.shadowBlur = 4;
            ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
            ctx.shadowBlur = 0;
          }
        });
      });

      // Current piece
      const piece = pieceRef.current;
      if (piece) {
        ctx.fillStyle = piece.color;
        ctx.shadowColor = piece.color;
        ctx.shadowBlur = 6;
        piece.shape.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (cell) {
              ctx.fillRect((piece.x + c) * CELL + 1, (piece.y + r) * CELL + 1, CELL - 2, CELL - 2);
            }
          });
        });
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, isValid, lockPiece]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Lines</div>
          <div className="font-display font-bold text-lg text-green-400">{lines}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-2xl border border-slate-700/50"
          style={{ maxWidth: '100%', maxHeight: '396px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Grid3x3 className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Tetris</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              The classic block-stacking game. Rotate and drop pieces to clear lines. Arrow keys or buttons to play.
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

      {gameState === 'playing' && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <button onClick={() => movePiece('rotate')} className="btn-ghost w-12 h-10 rounded-lg flex items-center justify-center text-sm font-bold">
            ROTATE
          </button>
          <div className="flex gap-2">
            <button onClick={() => movePiece('left')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">←</button>
            <button onClick={() => movePiece('down')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">↓</button>
            <button onClick={() => movePiece('right')} className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl">→</button>
          </div>
          <button onClick={() => movePiece('drop')} className="btn-ghost w-40 h-10 rounded-lg flex items-center justify-center text-sm font-bold">
            DROP
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg mt-4">
        <Trophy className="w-4 h-4 text-pink-400" />
        <span className="text-sm text-gray-400">Best:</span>
        <span className="font-display font-bold text-pink-400">{bestScore}</span>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Arrow keys to move and rotate, space to hard drop. Clear lines to score!
      </p>
    </div>
  );
}
