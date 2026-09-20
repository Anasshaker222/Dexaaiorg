import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Target, Crosshair, Trophy } from 'lucide-react';

type TargetObj = {
  x: number;
  y: number;
  r: number;
  speed: number;
  dir: number;
  hit: boolean;
  hitTime: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

const COLORS = ['#00f0ff', '#ff2e93', '#00ff88', '#ffaa00', '#ff3355'];
const CANVAS_W = 400;
const CANVAS_H = 400;

export default function FiringRange() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const targetsRef = useRef<TargetObj[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('firing-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const spawnTarget = useCallback(() => {
    const r = 18 + Math.random() * 22;
    targetsRef.current.push({
      x: r + Math.random() * (CANVAS_W - 2 * r),
      y: r + Math.random() * (CANVAS_H - 2 * r),
      r,
      speed: 0.5 + Math.random() * 1.5,
      dir: Math.random() * Math.PI * 2,
      hit: false,
      hitTime: 0,
    });
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setCombo(0);
    setTimeLeft(30);
    setGameState('playing');
    targetsRef.current = [];
    particlesRef.current = [];
    comboRef.current = 0;
    scoreRef.current = 0;
    lastSpawnRef.current = performance.now();
    for (let i = 0; i < 3; i++) spawnTarget();
  }, [spawnTarget]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      // Spawn
      if (now - lastSpawnRef.current > 800) {
        if (targetsRef.current.length < 6) spawnTarget();
        lastSpawnRef.current = now;
      }

      // Update targets
      targetsRef.current.forEach((t) => {
        if (t.hit) {
          t.hitTime++;
          return;
        }
        t.x += Math.cos(t.dir) * t.speed;
        t.y += Math.sin(t.dir) * t.speed;
        if (t.x < t.r || t.x > CANVAS_W - t.r) t.dir = Math.PI - t.dir;
        if (t.y < t.r || t.y > CANVAS_H - t.r) t.dir = -t.dir;
        t.x = Math.max(t.r, Math.min(CANVAS_W - t.r, t.x));
        t.y = Math.max(t.r, Math.min(CANVAS_H - t.r, t.y));
      });

      // Remove old hits
      targetsRef.current = targetsRef.current.filter((t) => !(t.hit && t.hitTime > 20));

      // Update particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // Draw
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid
      ctx.strokeStyle = 'rgba(0,240,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_W; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_W, i);
        ctx.stroke();
      }

      // Draw targets
      targetsRef.current.forEach((t) => {
        if (t.hit) {
          ctx.globalAlpha = 1 - t.hitTime / 20;
        }
        const color = COLORS[0];
        // Rings
        for (let ring = 3; ring >= 0; ring--) {
          const ringR = t.r * (ring + 1) / 4;
          ctx.beginPath();
          ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2);
          ctx.fillStyle = ring % 2 === 0 ? color : '#fff';
          ctx.globalAlpha = (t.hit ? (1 - t.hitTime / 20) : 1) * (ring === 0 ? 1 : 0.85);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Draw particles
      particlesRef.current.forEach((p) => {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, spawnTarget]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('firing-best', scoreRef.current.toString());
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, bestScore]);

  const handleShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    let hitAny = false;
    targetsRef.current.forEach((t) => {
      if (t.hit) return;
      const dist = Math.hypot(x - t.x, y - t.y);
      if (dist <= t.r) {
        t.hit = true;
        t.hitTime = 0;
        hitAny = true;
        comboRef.current++;
        const points = Math.round((50 + (40 - t.r) * 3) * (1 + comboRef.current * 0.1));
        scoreRef.current += points;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        // Particles
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          particlesRef.current.push({
            x: t.x,
            y: t.y,
            vx: Math.cos(angle) * (2 + Math.random() * 3),
            vy: Math.sin(angle) * (2 + Math.random() * 3) - 1,
            life: 30,
            color,
          });
        }
      }
    });

    if (!hitAny) {
      comboRef.current = 0;
      setCombo(0);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* HUD */}
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Score</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Time</div>
          <div className={`font-display font-bold text-lg ${timeLeft <= 5 ? 'text-red-400' : 'text-yellow-400'}`}>
            {timeLeft}s
          </div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Combo</div>
          <div className="font-display font-bold text-lg text-pink-400">x{combo}</div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleShoot}
          className="rounded-2xl border border-slate-700/50 cursor-crosshair touch-none"
          style={{ maxWidth: '100%', maxHeight: '400px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Crosshair className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Firing Range</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Click targets to score points. Smaller targets = more points. Build combos for bonus multipliers!
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              Start Shooting
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Time's Up!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">{bestScore}</span>
        </div>
        {gameState === 'playing' && (
          <button
            onClick={() => { setGameState('idle'); }}
            className="btn-ghost px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Quit
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Click the targets as fast as you can. Chain hits for combo multipliers. 30-second rounds.
      </p>
    </div>
  );
}
