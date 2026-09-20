import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Flag, Car, Trophy } from 'lucide-react';

const CANVAS_W = 360;
const CANVAS_H = 480;
const ROAD_W = 240;
const ROAD_X = (CANVAS_W - ROAD_W) / 2;
const CAR_W = 38;
const CAR_H = 64;
const LANE_COUNT = 3;
const LANE_W = ROAD_W / LANE_COUNT;
const LANE_X = [ROAD_X + LANE_W * 0.5, ROAD_X + LANE_W * 1.5, ROAD_X + LANE_W * 2.5];

type EnemyCar = {
  lane: number;
  y: number;
  color: string;
};

type RoadMarking = {
  y: number;
};

const ENEMY_COLORS = ['#ff3355', '#ffaa00', '#ff2e93', '#aa55ff', '#ff6600'];

export default function RacingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [bestScore, setBestScore] = useState(0);
  const [speed, setSpeed] = useState(3);

  const playerLaneRef = useRef(1);
  const enemiesRef = useRef<EnemyCar[]>([]);
  const markingsRef = useRef<RoadMarking[]>([]);
  const animRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const speedRef = useRef(3);
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem('racing-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  // Init road markings
  const initMarkings = useCallback(() => {
    markingsRef.current = [];
    for (let y = 0; y < CANVAS_H; y += 60) {
      markingsRef.current.push({ y });
    }
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setSpeed(3);
    setGameState('playing');
    playerLaneRef.current = 1;
    enemiesRef.current = [];
    scoreRef.current = 0;
    speedRef.current = 3;
    initMarkings();
  }, [initMarkings]);

  // Keyboard
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (gameState === 'playing') {
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          playerLaneRef.current = Math.max(0, playerLaneRef.current - 1);
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
          playerLaneRef.current = Math.min(LANE_COUNT - 1, playerLaneRef.current + 1);
        }
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [gameState]);

  // Touch / click to move
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.5) {
      playerLaneRef.current = Math.max(0, playerLaneRef.current - 1);
    } else {
      playerLaneRef.current = Math.min(LANE_COUNT - 1, playerLaneRef.current + 1);
    }
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastSpawn = 0;

    const drawCar = (cx: number, cy: number, color: string, isPlayer: boolean) => {
      const x = cx - CAR_W / 2;
      const y = cy - CAR_H / 2;
      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, CAR_W, CAR_H, 8);
      ctx.fill();
      // Windshield
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 10, CAR_W - 12, 16, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 6, y + CAR_H - 26, CAR_W - 12, 16, 4);
      ctx.fill();
      // Headlights
      if (isPlayer) {
        ctx.fillStyle = '#ffffaa';
        ctx.beginPath();
        ctx.arc(x + 8, y + 4, 4, 0, Math.PI * 2);
        ctx.arc(x + CAR_W - 8, y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Tail lights for enemy (facing down)
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(x + 8, y + CAR_H - 4, 3, 0, Math.PI * 2);
        ctx.arc(x + CAR_W - 8, y + CAR_H - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const sp = speedRef.current;

      // Move road markings
      markingsRef.current.forEach((m) => {
        m.y += sp * 1.5;
        if (m.y > CANVAS_H) m.y -= CANVAS_H;
      });

      // Spawn enemies
      if (now - lastSpawn > Math.max(600, 1400 - scoreRef.current * 3)) {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        // Avoid spawning on top of another car
        const tooClose = enemiesRef.current.some((e) => e.lane === lane && e.y < 120);
        if (!tooClose) {
          enemiesRef.current.push({
            lane,
            y: -CAR_H,
            color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
          });
        }
        lastSpawn = now;
      }

      // Move enemies
      enemiesRef.current.forEach((e) => {
        e.y += sp * 1.2;
      });

      // Remove off-screen
      enemiesRef.current = enemiesRef.current.filter((e) => e.y < CANVAS_H + CAR_H);

      // Collision check
      const playerX = LANE_X[playerLaneRef.current];
      const playerY = CANVAS_H - 80;
      enemiesRef.current.forEach((e) => {
        const ex = LANE_X[e.lane];
        const dx = Math.abs(playerX - ex);
        const dy = Math.abs(playerY - e.y);
        if (dx < CAR_W * 0.8 && dy < CAR_H * 0.8) {
          setGameState('over');
          if (scoreRef.current > bestScore) {
            setBestScore(scoreRef.current);
            localStorage.setItem('racing-best', scoreRef.current.toString());
          }
        }
      });

      // Score
      scoreRef.current += 1;
      if (scoreRef.current % 200 === 0) {
        speedRef.current = Math.min(8, speedRef.current + 0.5);
        setSpeed(speedRef.current);
      }
      setScore(scoreRef.current);

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grass
      ctx.fillStyle = '#0d1f0d';
      ctx.fillRect(0, 0, ROAD_X, CANVAS_H);
      ctx.fillRect(ROAD_X + ROAD_W, 0, CANVAS_W - ROAD_X - ROAD_W, CANVAS_H);

      // Road
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(ROAD_X, 0, ROAD_W, CANVAS_H);

      // Road edges
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ROAD_X, 0);
      ctx.lineTo(ROAD_X, CANVAS_H);
      ctx.moveTo(ROAD_X + ROAD_W, 0);
      ctx.lineTo(ROAD_X + ROAD_W, CANVAS_H);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Lane markings
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 30]);
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = ROAD_X + LANE_W * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw enemy cars
      enemiesRef.current.forEach((e) => {
        drawCar(LANE_X[e.lane], e.y + CAR_H / 2, e.color, false);
      });

      // Draw player car
      drawCar(playerX, playerY, '#00f0ff', true);

      // Speed lines effect
      ctx.strokeStyle = 'rgba(0,240,255,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const lineY = (now * 0.3 + i * 100) % CANVAS_H;
        ctx.beginPath();
        ctx.moveTo(ROAD_X + 10, lineY);
        ctx.lineTo(ROAD_X + ROAD_W - 10, lineY);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, bestScore]);

  return (
    <div className="flex flex-col items-center">
      {/* HUD */}
      <div className="flex items-center gap-3 mb-5">
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Distance</div>
          <div className="font-display font-bold text-lg text-cyan-400">{score}m</div>
        </div>
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Speed</div>
          <div className="font-display font-bold text-lg text-green-400">{Math.round(speed * 30)}km/h</div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleCanvasClick}
          className="rounded-2xl border border-slate-700/50 cursor-pointer touch-none"
          style={{ maxWidth: '100%', maxHeight: '480px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Car className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Neon Racer</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Dodge traffic on a neon highway. Use arrow keys or tap left/right side of the road to switch lanes. Speed increases as you go!
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Start Race
            </button>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className="w-10 h-10 text-cyan-400 mb-2" />
            <div className="font-display font-bold text-xl text-white mb-1">Crashed!</div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}m</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}m</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Race Again
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-5">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <Trophy className="w-4 h-4 text-pink-400" />
          <span className="text-sm text-gray-400">Best:</span>
          <span className="font-display font-bold text-pink-400">{bestScore}m</span>
        </div>
        {gameState === 'playing' && (
          <div className="flex gap-2">
            <button
              onClick={() => playerLaneRef.current = Math.max(0, playerLaneRef.current - 1)}
              className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl"
            >
              ←
            </button>
            <button
              onClick={() => playerLaneRef.current = Math.min(LANE_COUNT - 1, playerLaneRef.current + 1)}
              className="btn-ghost w-12 h-12 rounded-lg flex items-center justify-center text-xl"
            >
              →
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        Arrow keys or tap left/right to change lanes. Avoid the cars. How far can you drive?
      </p>
    </div>
  );
}
