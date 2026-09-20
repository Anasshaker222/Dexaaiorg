import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react';

type Entry = {
  rank: number;
  player: string;
  game: string;
  score: string;
  badge: 'gold' | 'silver' | 'bronze' | null;
};

const entries: Entry[] = [
  { rank: 1, player: 'NeuralNinja', game: '2048', score: '48,392', badge: 'gold' },
  { rank: 2, player: 'TriggerHappy', game: 'Firing Range', score: '3,840 pts', badge: 'silver' },
  { rank: 3, player: 'SpeedDemon', game: 'Neon Racer', score: '2,840m', badge: 'bronze' },
  { rank: 4, player: 'PixelMaster', game: 'Memory Match', score: '12 moves', badge: null },
  { rank: 5, player: 'QuickDraw', game: 'Reaction Time', score: '156ms', badge: null },
  { rank: 6, player: 'Striker99', game: 'Penalty Shootout', score: '5/5 goals', badge: null },
  { rank: 7, player: 'SnakeCharmer', game: 'Neon Snake', score: '420 pts', badge: null },
  { rank: 8, player: 'WallSmasher', game: 'Brick Breaker', score: '1,200 pts', badge: null },
  { rank: 9, player: 'PongMaster', game: 'Pong vs AI', score: '7-0 sweep', badge: null },
  { rank: 10, player: 'MoleHunter', game: 'Whack-a-Mole', score: '580 pts', badge: null },
  { rank: 11, player: 'StarDefender', game: 'Space Invaders', score: '2,400 pts', badge: null },
  { rank: 12, player: 'BlockStacker', game: 'Tetris', score: '8,900 pts', badge: null },
  { rank: 13, player: 'SafeSweeper', game: 'Minesweeper', score: '28s', badge: null },
  { rank: 14, player: 'FlappyKing', game: 'Flappy Bird', score: '47 pipes', badge: null },
];

const badgeStyles: Record<string, { icon: typeof Crown; color: string }> = {
  gold: { icon: Crown, color: 'text-yellow-400' },
  silver: { icon: Medal, color: 'text-gray-300' },
  bronze: { icon: Medal, color: 'text-orange-400' },
};

export default function Leaderboard() {
  return (
    <section id="leaderboard" className="relative py-24">
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-pink-500/5 blur-[100px]" />

      <div className="relative max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4">
            <Trophy className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-medium text-gray-300 tracking-wide">TOP PLAYERS</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
            Global <span className="text-pink-400">Leaderboard</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Compete for the top spots. Your best scores are saved locally — challenge yourself to climb the ranks.
          </p>
        </div>

        {/* Podium */}
        <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
          {[1, 0, 2].map((idx) => {
            const e = entries[idx];
            const styles = badgeStyles[e.badge || 'gold'];
            const Icon = styles.icon;
            const heightClass = idx === 0 ? 'md:translate-y-0' : 'md:translate-y-6';
            return (
              <div
                key={e.rank}
                className={`glass rounded-2xl p-4 md:p-6 text-center border border-slate-700/50 card-hover ${heightClass} ${
                  idx === 0 ? 'order-2 md:scale-110 neon-border-accent' : idx === 1 ? 'order-1' : 'order-3'
                }`}
              >
                <Icon className={`w-8 h-8 ${styles.color} mx-auto mb-2`} />
                <div className="font-display font-bold text-sm text-white truncate">{e.player}</div>
                <div className="text-xs text-gray-500 mt-1">{e.game}</div>
                <div className={`font-display font-bold text-lg ${styles.color} mt-2`}>{e.score}</div>
                <div className="text-xs text-gray-600 mt-1">#{e.rank}</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="glass rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-700/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-3">Game</div>
            <div className="col-span-3 text-right">Score</div>
          </div>
          {entries.map((e, i) => (
            <div
              key={e.rank}
              className={`grid grid-cols-12 gap-2 px-6 py-3.5 items-center transition-colors hover:bg-slate-800/30 ${
                i !== entries.length - 1 ? 'border-b border-slate-800/50' : ''
              }`}
            >
              <div className="col-span-1">
                <span className={`font-display font-bold ${e.rank <= 3 ? badgeStyles[e.badge || 'gold'].color : 'text-gray-500'}`}>
                  #{e.rank}
                </span>
              </div>
              <div className="col-span-5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-gray-300">
                  {e.player[0]}
                </div>
                <span className="text-sm text-white font-medium">{e.player}</span>
              </div>
              <div className="col-span-3 text-sm text-gray-400">{e.game}</div>
              <div className="col-span-3 text-right">
                <span className="font-display font-bold text-sm text-cyan-400">{e.score}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500">
          <TrendingUp className="w-4 h-4" />
          <span>Scores update in real-time as you play</span>
        </div>
      </div>
    </section>
  );
}
