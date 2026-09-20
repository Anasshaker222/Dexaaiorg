import { useState, useEffect } from 'react';
import { RotateCcw, Cpu, User, Trophy } from 'lucide-react';

type Cell = 'X' | 'O' | null;

const WINNING_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Cell[]): { winner: Cell; line: number[] | null } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

function isBoardFull(board: Cell[]): boolean {
  return board.every((c) => c !== null);
}

// Minimax AI — optimal play for 'O'
function minimax(board: Cell[], isMaximizing: boolean): number {
  const { winner } = checkWinner(board);
  if (winner === 'O') return 10;
  if (winner === 'X') return -10;
  if (isBoardFull(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function getBestMove(board: Cell[]): number {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      const score = minimax(board, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [scores, setScores] = useState({ wins: 0, losses: 0, ties: 0 });
  const { winner, line } = checkWinner(board);
  const draw = !winner && isBoardFull(board);
  const gameOver = !!winner || draw;

  // AI move
  useEffect(() => {
    if (!isPlayerTurn && !gameOver) {
      const timer = setTimeout(() => {
        const move = getBestMove([...board]);
        if (move >= 0) {
          setBoard((prev) => {
            const next = [...prev];
            next[move] = 'O';
            return next;
          });
          setIsPlayerTurn(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, board, gameOver]);

  // Update scores on game end
  useEffect(() => {
    if (winner === 'X') {
      setScores((s) => ({ ...s, wins: s.wins + 1 }));
    } else if (winner === 'O') {
      setScores((s) => ({ ...s, losses: s.losses + 1 }));
    } else if (draw) {
      setScores((s) => ({ ...s, ties: s.ties + 1 }));
    }
  }, [winner, draw]);

  const handleClick = (i: number) => {
    if (board[i] || !isPlayerTurn || gameOver) return;
    const next = [...board];
    next[i] = 'X';
    setBoard(next);
    setIsPlayerTurn(false);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
  };

  const statusText = winner === 'X'
    ? 'You Win!'
    : winner === 'O'
    ? 'AI Wins!'
    : draw
    ? "It's a Tie!"
    : isPlayerTurn
    ? 'Your Turn'
    : 'AI Thinking...';

  const statusColor = winner === 'X' ? 'text-green-400' : winner === 'O' ? 'text-pink-400' : draw ? 'text-yellow-400' : 'text-cyan-400';

  return (
    <div className="flex flex-col items-center">
      {/* Score bar */}
      <div className="flex items-center gap-6 mb-6 w-full justify-center">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          <div className="text-center">
            <div className="text-xs text-gray-500">You</div>
            <div className="font-display font-bold text-lg text-cyan-400">{scores.wins}</div>
          </div>
        </div>
        <div className="text-gray-600">|</div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Ties</div>
          <div className="font-display font-bold text-lg text-yellow-400">{scores.ties}</div>
        </div>
        <div className="text-gray-600">|</div>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-xs text-gray-500">AI</div>
            <div className="font-display font-bold text-lg text-pink-400">{scores.losses}</div>
          </div>
          <Cpu className="w-5 h-5 text-pink-400" />
        </div>
      </div>

      {/* Status */}
      <div className={`font-display font-bold text-xl mb-6 ${statusColor} transition-all`}>
        {gameOver && winner && <Trophy className="w-5 h-5 inline mr-2" />}
        {statusText}
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!cell || !isPlayerTurn || gameOver}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-xl glass flex items-center justify-center text-4xl font-display font-bold transition-all duration-200 ${
              line?.includes(i) ? 'neon-border bg-cyan-500/10' : ''
            } ${
              cell === 'X' ? 'text-cyan-400' : cell === 'O' ? 'text-pink-400' : 'hover:border-cyan-500/50'
            } ${!cell && isPlayerTurn && !gameOver ? 'hover:scale-105 cursor-pointer' : ''}`}
          >
            {cell && <span className="tile-pop inline-block">{cell}</span>}
          </button>
        ))}
      </div>

      <button
        onClick={reset}
        className="btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        New Round
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        The AI uses the minimax algorithm — it plays optimally. Can you force a tie?
      </p>
    </div>
  );
}
