import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Bird } from 'lucide-react';

const CANVAS_W = 360;
const CANVAS_H = 480;
const BIRD_X = 80;
const BIRD_R = 14;
const PIPE_W = 60;
const PIPE_GAP = 150;
const PIPE_SPEED = 2.5;
const GRAVITY = 0.45;
const JUMP_V = -7.5;

type Pipe = { x: number; gapY: number; passed: boolean };

export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const birdYRef = useRef(CANVAS_H / 2);
  const birdVRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const animRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const rotationRef = useRef(0);
  const starFieldRef = useRef<{ x: number; y: number; speed: number }[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('flappy-best');
    if (stored) setBestScore(parseInt(stored));
    // Init stars
    starFieldRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      speed: 0.3 + Math.random() * 1.5,
    }));
  }, []);

  const startGame = useCallback(() => {
    birdYRef.current = CANVAS_H / 2;
    birdVRef.current = 0;
    pipesRef.current = [
      { x: CANVAS_W + 50, gapY: 150 + Math.random() * 180, passed: false },
    ];
    scoreRef.current = 0;
    rotationRef.current = 0;
    setScore(0);
    setGameState('playing');
  }, []);

  const flap = useCallback(() => {
    if (gameState === 'idle') {
      startGame();
      return;
    }
    if (gameState === 'playing') {
      birdVRef.current = JUMP_V;
    }
  }, [gameState, startGame]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flap]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      // Physics
      birdVRef.current += GRAVITY;
      birdYRef.current += birdVRef.current;
      rotationRef.current = Math.max(-0.4, Math.min(1.2, birdVRef.current * 0.08));

      // Move pipes
      pipesRef.current.forEach((p) => {
        p.x -= PIPE_SPEED;
        if (!p.passed && p.x + PIPE_W < BIRD_X) {
          p.passed = true;
          scoreRef.current++;
          setScore(scoreRef.current);
        }
      });

      // Remove off-screen pipes
      pipesRef.current = pipesRef.current.filter((p) => p.x > -PIPE_W);

      // Spawn new pipe
      if (pipesRef.current.length === 0 || pipesRef.current[pipesRef.current.length - 1].x < CANVAS_W - 180) {
        pipesRef.current.push({
          x: CANVAS_W,
          gapY: 120 + Math.random() * 200,
          passed: false,
        });
      }

      // Collision: ground/ceiling
      if (birdYRef.current > CANVAS_H - BIRD_R - 4 || birdYRef.current < BIRD_R) {
        setGameState('over');
        if (scoreRef.current > bestScore) {
          setBestScore(scoreRef.current);
          localStorage.setItem('flappy-best', scoreRef.current.toString());
        }
        return;
      }

      // Collision: pipes
      for (const p of pipesRef.current) {
        if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
          if (birdYRef.current - BIRD_R < p.gapY || birdYRef.current + BIRD_R > p.gapY + PIPE_GAP) {
            setGameState('over');
            if (scoreRef.current > bestScore) {
              setBestScore(scoreRef.current);
              localStorage.setItem('flappy-best', scoreRef.current.toString());
            }
            return;
          }
        }
      }

      // Move stars
      starFieldRef.current.forEach((s) => {
        s.x -= s.speed;
        if (s.x < 0) {
          s.x = CANVAS_W;
          s.y = Math.random() * CANVAS_H;
        }
      });

      // === DRAW ===
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#0a0a2e');
      grad.addColorStop(0.5, '#0d1a3e');
      grad.addColorStop(1, '#0a1a2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      starFieldRef.current.forEach((s) => {
        ctx.fillRect(s.x, s.y, 1.5, 1.5);
      });

      // Pipes
      pipesRef.current.forEach((p) => {
        // Top pipe
        const topH = p.gapY;
        const grad1 = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad1.addColorStop(0, '#00cc66');
        grad1.addColorStop(0.5, '#00ff88');
        grad1.addColorStop(1, '#00aa55');
        ctx.fillStyle = grad1;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x, 0, PIPE_W, topH);
        // Cap
        ctx.fillRect(p.x - 4, topH - 20, PIPE_W + 8, 20);

        // Bottom pipe
        const botY = p.gapY + PIPE_GAP;
        const botH = CANVAS_H - botY;
        ctx.fillRect(p.x, botY, PIPE_W, botH);
        ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 20);
        ctx.shadowBlur = 0;
      });

      // Bird
      ctx.save();
      ctx.translate(BIRD_X, birdYRef.current);
      ctx.rotate(rotationRef.current);
      // Body
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      // Wing
      ctx.fillStyle = '#ff9900';
      ctx.beginPath();
      ctx.ellipse(-2, 2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(7, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, -1);
      ctx.lineTo(BIRD_R + 6, 0);
      ctx.lineTo(BIRD_R - 2, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Ground
      ctx.fillStyle = '#0d2f1d';
      ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, bestScore]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={flap}
          onTouchStart={(e) => { e.preventDefault(); flap(); }}
          className="rounded-2xl border border-slate-700/50 cursor-pointer touch-none"
          style={{ maxWidth: '100%', maxHeight: '480px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Bird className="w-12 h-12 text-yellow-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Flappy Bird</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Tap, click, or press space to flap. Fly through the pipes without crashing. How far can you get?
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Start Flying
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Crashed!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg mt-5">
        <Trophy className="w-4 h-4 text-pink-400" />
        <span className="text-sm text-gray-400">Best:</span>
        <span className="font-display font-bold text-pink-400">{bestScore}</span>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Click, tap, or press space to flap. Fly through the gaps — don't touch the pipes!
      </p>
    </div>
  );
}
