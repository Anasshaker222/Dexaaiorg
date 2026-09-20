import { Gamepad2, Github, Twitter, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative border-t border-slate-800/50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-cyan-400" />
            <span className="font-display font-bold text-lg tracking-wider">
              DEXA<span className="text-cyan-400">AI</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#games" className="hover:text-cyan-400 transition-colors">Games</a>
            <a href="#leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboard</a>
            <a href="#about" className="hover:text-cyan-400 transition-colors">About</a>
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            <a href="#" className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:text-cyan-400 transition-colors text-gray-400">
              <Github className="w-4 h-4" />
            </a>
            <a href="#" className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:text-cyan-400 transition-colors text-gray-400">
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2026 DexaAI Game Center. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Built with <Heart className="w-3.5 h-3.5 text-pink-400 fill-current" /> for gamers
          </p>
        </div>
      </div>
    </footer>
  );
}
