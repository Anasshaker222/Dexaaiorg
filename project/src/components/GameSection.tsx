import { useState } from 'react';
import { X, Cpu, Brain, Zap, Grid3x3, Crosshair, Car, Goal, Gamepad, Blocks, Disc, Hammer, Rocket, Bomb, Bird, Box, Map as MapIcon, ArrowUpCircle, Flag, Target, Swords } from 'lucide-react';
import TicTacToe from './games/TicTacToe';
import MemoryMatch from './games/MemoryMatch';
import ReactionTime from './games/ReactionTime';
import Game2048 from './games/Game2048';
import FiringRange from './games/FiringRange';
import RacingGame from './games/RacingGame';
import FootballGame from './games/FootballGame';
import FootballTactics from './games/FootballTactics';
import SnakeGame from './games/SnakeGame';
import BrickBreaker from './games/BrickBreaker';
import PongGame from './games/PongGame';
import WhackAMole from './games/WhackAMole';
import SpaceInvaders from './games/SpaceInvaders';
import TetrisGame from './games/TetrisGame';
import Minesweeper from './games/Minesweeper';
import FlappyBird from './games/FlappyBird';
import TunnelRush3D from './games/TunnelRush3D';
import AsteroidBlaster3D from './games/AsteroidBlaster3D';
import MazeEscape3D from './games/MazeEscape3D';
import SkyJump3D from './games/SkyJump3D';
import DriftRacer3D from './games/DriftRacer3D';
import TargetDome3D from './games/TargetDome3D';

type GameId = 'tictactoe' | 'memory' | 'reaction' | '2048' | 'firing' | 'racing' | 'football' | 'tactics' | 'snake' | 'brick' | 'pong' | 'whack' | 'invaders' | 'tetris' | 'mines' | 'flappy' | 'tunnel3d' | 'asteroid3d' | 'maze3d' | 'skyjump3d' | 'drift3d' | 'targetdome3d';

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
    id: 'tictactoe',
    title: 'Tic-Tac-Toe AI',
    description: 'Challenge an unbeatable AI opponent using the minimax algorithm. Can you force a tie?',
    icon: Grid3x3,
    color: 'cyan',
    tag: 'Strategy',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    description: 'Test your memory by finding matching pairs of cards. Fewer moves means a better score.',
    icon: Brain,
    color: 'pink',
    tag: 'Memory',
  },
  {
    id: 'reaction',
    title: 'Reaction Time',
    description: 'How fast are your reflexes? Click the instant the screen turns green and beat your record.',
    icon: Zap,
    color: 'green',
    tag: 'Reflex',
  },
  {
    id: '2048',
    title: '2048',
    description: 'Slide and merge tiles to reach the elusive 2048 tile. Simple to learn, hard to master.',
    icon: Cpu,
    color: 'orange',
    tag: 'Puzzle',
  },
  {
    id: 'firing',
    title: 'Firing Range',
    description: 'Test your aim! Click moving targets in 30 seconds. Chain hits for combo multipliers and beat your high score.',
    icon: Crosshair,
    color: 'cyan',
    tag: 'Shooting',
  },
  {
    id: 'racing',
    title: 'Neon Racer',
    description: 'Speed down a neon highway dodging traffic. Switch lanes to avoid cars. How far can you drive?',
    icon: Car,
    color: 'green',
    tag: 'Racing',
  },
  {
    id: 'football',
    title: 'Penalty Shootout',
    description: 'Take 5 penalty kicks against an AI goalkeeper. Aim for the corners and score as many goals as you can.',
    icon: Goal,
    color: 'pink',
    tag: 'Sports',
  },
  {
    id: 'tactics',
    title: 'Football Tactics',
    description: 'Turn-based tactical football. Move, pass, shoot and tackle — play a training match vs AI or challenge a real opponent online.',
    icon: Swords,
    color: 'green',
    tag: 'Multiplayer',
  },
  {
    id: 'snake',
    title: 'Neon Snake',
    description: "Eat glowing dots to grow longer. Don't hit the walls or yourself! Speed increases as you score.",
    icon: Gamepad,
    color: 'green',
    tag: 'Arcade',
  },
  {
    id: 'brick',
    title: 'Brick Breaker',
    description: "Bounce the ball to smash all the bricks. Move the paddle with your mouse or finger. Don't let it drop!",
    icon: Blocks,
    color: 'orange',
    tag: 'Arcade',
  },
  {
    id: 'pong',
    title: 'Pong vs AI',
    description: 'Classic Pong against an AI opponent. First to 7 points wins. Mouse, touch, or arrow keys to control.',
    icon: Disc,
    color: 'cyan',
    tag: 'Arcade',
  },
  {
    id: 'whack',
    title: 'Whack-a-Mole',
    description: 'Tap the moles as they pop up for points. But watch out for bombs! 30-second rounds of fast reflexes.',
    icon: Hammer,
    color: 'pink',
    tag: 'Reflex',
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    description: 'Defend Earth from waves of pixel-art alien invaders. Shoot them all before they reach the bottom!',
    icon: Rocket,
    color: 'cyan',
    tag: 'Arcade',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description: 'The classic block-stacking game. Rotate and drop pieces to clear lines. Speed increases as you go.',
    icon: Grid3x3,
    color: 'orange',
    tag: 'Puzzle',
  },
  {
    id: 'mines',
    title: 'Minesweeper',
    description: 'Reveal tiles to find numbers, flag the mines. Clear all safe tiles without hitting a bomb to win.',
    icon: Bomb,
    color: 'green',
    tag: 'Puzzle',
  },
  {
    id: 'flappy',
    title: 'Flappy Bird',
    description: 'Tap to flap and fly through neon pipes. Simple to learn, brutally hard to master. How far can you get?',
    icon: Bird,
    color: 'pink',
    tag: 'Arcade',
  },
  {
    id: 'tunnel3d',
    title: 'Tunnel Rush 3D',
    description: 'Race through a neon 3D tunnel, switching lanes and jumping to dodge blocks. How far can you survive?',
    icon: Zap,
    color: 'cyan',
    tag: '3D Runner',
  },
  {
    id: 'asteroid3d',
    title: 'Asteroid Blaster 3D',
    description: 'Pilot your ship through a real 3D starfield and blast incoming asteroids before they crash into you.',
    icon: Box,
    color: 'pink',
    tag: '3D Shooter',
  },
  {
    id: 'maze3d',
    title: 'Maze Escape 3D',
    description: 'Walk through a fully 3D first-person maze and find the glowing exit as fast as possible.',
    icon: MapIcon,
    color: 'green',
    tag: '3D Maze',
  },
  {
    id: 'skyjump3d',
    title: 'Sky Jump 3D',
    description: 'Auto-bounce between platforms rising into the sky. Steer left and right and see how high you can climb.',
    icon: ArrowUpCircle,
    color: 'orange',
    tag: '3D Platformer',
  },
  {
    id: 'drift3d',
    title: 'Drift Racer 3D',
    description: 'Race a real 3D car around a neon circuit for three laps. Stay on the track and post your fastest time.',
    icon: Flag,
    color: 'cyan',
    tag: '3D Racing',
  },
  {
    id: 'targetdome3d',
    title: 'Target Dome 3D',
    description: 'Look around a full 3D dome and blast glowing targets before they fade. 30 seconds to rack up the highest score.',
    icon: Target,
    color: 'pink',
    tag: '3D Shooter',
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
            <span className="text-xs font-medium text-gray-300 tracking-wide">PLAYABLE GAMES</span>
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
            Choose Your <span className="text-cyan-400">Challenge</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Twenty-one fully playable games — including six real 3D games — each with AI opponents or score tracking. No downloads, no sign-ups — just play.
          </p>
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              {activeGame === 'tictactoe' && <TicTacToe />}
              {activeGame === 'memory' && <MemoryMatch />}
              {activeGame === 'reaction' && <ReactionTime />}
              {activeGame === '2048' && <Game2048 />}
              {activeGame === 'firing' && <FiringRange />}
              {activeGame === 'racing' && <RacingGame />}
              {activeGame === 'football' && <FootballGame />}
              {activeGame === 'tactics' && <FootballTactics />}
              {activeGame === 'snake' && <SnakeGame />}
              {activeGame === 'brick' && <BrickBreaker />}
              {activeGame === 'pong' && <PongGame />}
              {activeGame === 'whack' && <WhackAMole />}
              {activeGame === 'invaders' && <SpaceInvaders />}
              {activeGame === 'tetris' && <TetrisGame />}
              {activeGame === 'mines' && <Minesweeper />}
              {activeGame === 'flappy' && <FlappyBird />}
              {activeGame === 'tunnel3d' && <TunnelRush3D />}
              {activeGame === 'asteroid3d' && <AsteroidBlaster3D />}
              {activeGame === 'maze3d' && <MazeEscape3D />}
              {activeGame === 'skyjump3d' && <SkyJump3D />}
              {activeGame === 'drift3d' && <DriftRacer3D />}
              {activeGame === 'targetdome3d' && <TargetDome3D />}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
