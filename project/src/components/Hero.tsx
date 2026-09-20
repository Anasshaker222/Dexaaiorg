import { Play, Sparkles, Zap, Trophy } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center grid-bg overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-gray-300 tracking-wide">
            AI-POWERED GAMING PLATFORM
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl tracking-tight mb-6 animate-slide-up">
          <span className="block neon-text text-white">GAME</span>
          <span className="block bg-gradient-to-r from-cyan-400 via-cyan-300 to-pink-400 bg-clip-text text-transparent animate-gradient">
            CENTER
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          Play multiplayer tactical football. Train against the AI, challenge a real
          opponent online, and climb the leaderboard.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
          <a
            href="#games"
            className="btn-primary px-8 py-3.5 rounded-xl text-base font-semibold flex items-center gap-2 group"
          >
            <Play className="w-5 h-5 fill-current" />
            Start Playing
          </a>
          <a
            href="#leaderboard"
            className="btn-ghost px-8 py-3.5 rounded-xl text-base font-semibold flex items-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Leaderboard
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 md:gap-12 max-w-2xl mx-auto mt-16 animate-slide-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <div className="text-center">
            <div className="font-display font-bold text-2xl md:text-3xl text-cyan-400">1v1</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">Online Matches</div>
          </div>
          <div className="text-center">
            <div className="font-display font-bold text-2xl md:text-3xl text-pink-400">∞</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">Replays</div>
          </div>
          <div className="text-center">
            <div className="font-display font-bold text-2xl md:text-3xl text-green-400">100%</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">Free</div>
          </div>
        </div>
      </div>

      {/* Floating icons */}
      <div className="absolute top-32 left-10 hidden lg:block animate-float" style={{ animationDelay: '0s' }}>
        <div className="glass p-4 rounded-2xl neon-border">
          <Zap className="w-8 h-8 text-cyan-400" />
        </div>
      </div>
      <div className="absolute bottom-32 right-10 hidden lg:block animate-float" style={{ animationDelay: '2s' }}>
        <div className="glass p-4 rounded-2xl neon-border-accent">
          <Trophy className="w-8 h-8 text-pink-400" />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
