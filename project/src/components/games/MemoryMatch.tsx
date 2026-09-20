import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Clock, Trophy } from 'lucide-react';

type Card = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

const EMOJIS = ['🚀', '🎮', '🎯', '⚡', '🔥', '💎', '🤖', '🌟'];

function shuffleCards(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  const shuffled = pairs
    .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5)
    .map((c, i) => ({ ...c, id: i }));
  return shuffled;
}

export default function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>(shuffleCards);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const won = matchedPairs === EMOJIS.length;

  // Load best score
  useEffect(() => {
    const stored = localStorage.getItem('memory-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const reset = useCallback(() => {
    setCards(shuffleCards());
    setFlippedIndices([]);
    setMoves(0);
    setMatchedPairs(0);
    setLocked(false);
  }, []);

  // Check match when two are flipped
  useEffect(() => {
    if (flippedIndices.length === 2) {
      setLocked(true);
      const [a, b] = flippedIndices;
      if (cards[a].emoji === cards[b].emoji) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === a || i === b ? { ...c, matched: true } : c
            )
          );
          setMatchedPairs((m) => m + 1);
          setFlippedIndices([]);
          setLocked(false);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === a || i === b ? { ...c, flipped: false } : c
            )
          );
          setFlippedIndices([]);
          setLocked(false);
        }, 900);
      }
      setMoves((m) => m + 1);
    }
  }, [flippedIndices, cards]);

  // Save best score on win
  useEffect(() => {
    if (won) {
      if (bestScore === null || moves < bestScore) {
        setBestScore(moves);
        localStorage.setItem('memory-best', moves.toString());
      }
    }
  }, [won, moves, bestScore]);

  const handleClick = (index: number) => {
    if (locked || cards[index].flipped || cards[index].matched) return;
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, flipped: true } : c))
    );
    setFlippedIndices((prev) => [...prev, index]);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Stats */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-gray-400">Moves:</span>
          <span className="font-display font-bold text-cyan-400">{moves}</span>
        </div>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">
            {bestScore !== null ? bestScore : '—'}
          </span>
        </div>
      </div>

      {/* Win banner */}
      {won && (
        <div className="mb-6 px-6 py-3 rounded-xl glass neon-border animate-scale-in text-center">
          <div className="font-display font-bold text-lg text-green-400">
            Cleared in {moves} moves!
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => handleClick(i)}
            disabled={card.matched || card.flipped || locked}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center text-3xl transition-all duration-300 ${
              card.matched
                ? 'bg-green-500/15 border border-green-500/30 scale-95 opacity-60'
                : card.flipped
                ? 'glass neon-border'
                : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-cyan-500/50 hover:scale-105 cursor-pointer'
            }`}
          >
            {card.flipped || card.matched ? (
              <span className="tile-pop">{card.emoji}</span>
            ) : (
              <span className="text-2xl text-gray-600">?</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={reset}
        className="btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        New Game
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Flip cards to find matching pairs. Fewer moves = better score!
      </p>
    </div>
  );
}
