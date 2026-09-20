import { Brain, Cpu, Zap, Gamepad2 } from 'lucide-react';

const features = [
  {
    icon: Cpu,
    title: 'AI Opponents',
    description: 'Play against intelligent AI that uses algorithms like minimax for optimal strategy. No easy mode — just pure challenge.',
    color: 'cyan',
  },
  {
    icon: Zap,
    title: 'Instant Play',
    description: 'No downloads, no sign-ups, no waiting. Click a game and start playing immediately right in your browser.',
    color: 'pink',
  },
  {
    icon: Brain,
    title: 'Track Progress',
    description: 'Your best scores and records are saved automatically. Beat your personal best and climb the leaderboard.',
    color: 'green',
  },
  {
    icon: Gamepad2,
    title: 'Fully Responsive',
    description: 'Play on desktop, tablet, or phone. Every game supports touch controls and keyboard input.',
    color: 'orange',
  },
];

const colorMap: Record<string, string> = {
  cyan: 'text-cyan-400 bg-cyan-500/10',
  pink: 'text-pink-400 bg-pink-500/10',
  green: 'text-green-400 bg-green-500/10',
  orange: 'text-orange-400 bg-orange-500/10',
};

export default function About() {
  return (
    <section id="about" className="relative py-24 grid-bg">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 blur-[100px]" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-gray-300 tracking-wide">WHY DEXAAI</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
            Built for <span className="text-cyan-400">Gamers</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            DexaAI Game Center brings classic games to life with intelligent AI opponents and a sleek, modern interface.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="glass rounded-2xl p-6 flex gap-4 card-hover border border-slate-700/50 animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[f.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
