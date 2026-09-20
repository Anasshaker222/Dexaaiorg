import { useState } from 'react';
import { X, Cpu, Swords } from 'lucide-react';
import FootballTactics from './games/FootballTactics';

type GameId = 'tactics';

type GameMeta = {
  id: GameId;
  title: string;
  description: string;
  icon: typeof Cpu;
  color: string;
  tag: string;
};

const GAMES: GameMeta[] = [
  {
    id: 'tactics',
    title: 'Football Tactics',
    description: 'Turn-based tactical football. Move, pass, shoot and tackle — play a training match vs AI or challenge a real opponent online.',
    icon: Swords,
    color: 'green',
    tag: 'Multiplayer',
  },
];

const colorMap: Record<string, { text: string; border: string; bg: string; glow: string }> = {
  cyan: { text: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', glow: 'shadow-cyan-500/20' },
  pink: { text: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10', glow: 'shadow-pink-500/20' },
  green: { text: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10', glow: 'shadow-green-500/20' },
  orange: { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/20' },
};

export default function GameSection() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const activeMeta = GAMES.find((g) => g.id === activeGame);

  return (
    <section id="games" className="relative py-24 grid-bg">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-cyan-500/5 blur-[100px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-gray-300 tracking-wide">PLAYABLE GAME</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
            Choose Your <span className="text-cyan-400">Challenge</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Multiplayer tactical football — play against the AI or face a real opponent online. No downloads, no sign-ups — just play.
          </p>
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 max-w-md mx-auto gap-6">
          {GAMES.map((game, i) => {
            const colors = colorMap[game.color];
            const Icon = game.icon;
            return (
              <button
                key={game.id}
                onClick={() => setActiveGame(game.id)}
                className={`card-hover glass rounded-2xl p-6 text-left border ${colors.border} hover:shadow-2xl ${colors.glow} animate-slide-up group cursor-pointer`}
                style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
              >
                <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${colors.text}`} />
                </div>
                <div className={`text-xs font-semibold ${colors.text} mb-2`}>{game.tag}</div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{game.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{game.description}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                  <span>Play Now</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game modal */}
      {activeGame && activeMeta && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveGame(null)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative glass rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in border border-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setActiveGame(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            <div className="flex items-center gap-3 mb-6 pr-12">
              <div className={`w-12 h-12 rounded-xl ${colorMap[activeMeta.color].bg} flex items-center justify-center`}>
                <activeMeta.icon className={`w-6 h-6 ${colorMap[activeMeta.color].text}`} />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white">{activeMeta.title}</h3>
                <p className="text-sm text-gray-400">{activeMeta.description}</p>
              </div>
            </div>

            {/* Game content */}
            <div className="flex justify-center">
              {activeGame === 'tactics' && <FootballTactics />}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
