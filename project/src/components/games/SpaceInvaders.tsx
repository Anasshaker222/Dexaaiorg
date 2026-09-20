import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Rocket } from 'lucide-react';

const CANVAS_W = 360;
const CANVAS_H = 420;
const PLAYER_W = 32;
const PLAYER_H = 24;
const ENEMY_W = 28;
const ENEMY_H = 20;
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;
const ENEMY_GAP_X = 40;
const ENEMY_GAP_Y = 36;
const ENEMY_OFFSET_X = (CANVAS_W - ENEMY_COLS * ENEMY_GAP_X) / 2;
const ENEMY_OFFSET_Y = 40;

type Enemy = { x: number; y: number; alive: boolean };
type Bullet = { x: number; y: number; vy: number; fromPlayer: boolean };

export default function SpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over' | 'won'>('idle');
  const [bestScore, setBestScore] = useState(0);

  const playerXRef = useRef(CANVAS_W / 2);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyDirRef = useRef(1);
  const enemyMoveTimerRef = useRef(0);
  const animRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastShotRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('invaders-best');
    if (stored) setBestScore(parseInt(stored));
  }, []);

  const initEnemies = useCallback(() => {
    const enemies: Enemy[] = [];
    for (let r = 0; r < ENEMY_ROWS; r++) {
      for (let c = 0; c < ENEMY_COLS; c++) {
        enemies.push({
          x: ENEMY_OFFSET_X + c * ENEMY_GAP_X,
          y: ENEMY_OFFSET_Y + r * ENEMY_GAP_Y,
          alive: true,
        });
      }
    }
    enemiesRef.current = enemies;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    playerXRef.current = CANVAS_W / 2;
    bulletsRef.current = [];
    enemyDirRef.current = 1;
    enemyMoveTimerRef.current = 0;
    initEnemies();
    setGameState('playing');
  }, [initEnemies]);

  // Keyboard
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(e.key)) e.preventDefault();
    };
    const handleUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  // Touch
  const touchStartRef = useRef<{ x: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX };
    // Also shoot
    const now = performance.now();
    if (now - lastShotRef.current > 300) {
      bulletsRef.current.push({ x: playerXRef.current, y: CANVAS_H - 50, vy: -6, fromPlayer: true });
      lastShotRef.current = now;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
    playerXRef.current = Math.max(PLAYER_W / 2, Math.min(CANVAS_W - PLAYER_W / 2, x));
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      // Player movement
      if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
        playerXRef.current = Math.max(PLAYER_W / 2, playerXRef.current - 4);
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
        playerXRef.current = Math.min(CANVAS_W - PLAYER_W / 2, playerXRef.current + 4);
      }
      if (keysRef.current[' '] && now - lastShotRef.current > 350) {
        bulletsRef.current.push({ x: playerXRef.current, y: CANVAS_H - 50, vy: -6, fromPlayer: true });
        lastShotRef.current = now;
      }

      // Enemy movement
      enemyMoveTimerRef.current++;
      const moveInterval = Math.max(10, 40 - scoreRef.current * 0.3);
      if (enemyMoveTimerRef.current >= moveInterval) {
        enemyMoveTimerRef.current = 0;
        let hitEdge = false;
        enemiesRef.current.forEach((e) => {
          if (!e.alive) return;
          e.x += enemyDirRef.current * 8;
          if (e.x <= 4 || e.x >= CANVAS_W - ENEMY_W - 4) hitEdge = true;
        });
        if (hitEdge) {
          enemyDirRef.current *= -1;
          enemiesRef.current.forEach((e) => { e.y += 16; });
        }
      }

      // Enemy shooting
      if (Math.random() < 0.02) {
        const aliveEnemies = enemiesRef.current.filter((e) => e.alive);
        if (aliveEnemies.length > 0) {
          const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          bulletsRef.current.push({ x: shooter.x + ENEMY_W / 2, y: shooter.y + ENEMY_H, vy: 4, fromPlayer: false });
        }
      }

      // Move bullets
      bulletsRef.current.forEach((b) => { b.y += b.vy; });
      bulletsRef.current = bulletsRef.current.filter((b) => b.y > -10 && b.y < CANVAS_H + 10);

      // Collisions
      bulletsRef.current.forEach((b) => {
        if (b.fromPlayer) {
          enemiesRef.current.forEach((e) => {
            if (!e.alive) return;
            if (b.x > e.x && b.x < e.x + ENEMY_W && b.y > e.y && b.y < e.y + ENEMY_H) {
              e.alive = false;
              b.y = -100;
              scoreRef.current += 10;
              setScore(scoreRef.current);
            }
          });
        } else {
          // Enemy bullet vs player
          if (Math.abs(b.x - playerXRef.current) < PLAYER_W / 2 &&
              b.y > CANVAS_H - 50 && b.y < CANVAS_H - 26) {
            b.y = CANVAS_H + 100;
            livesRef.current--;
            setLives(livesRef.current);
            if (livesRef.current <= 0) {
              setGameState('over');
              if (scoreRef.current > bestScore) {
                setBestScore(scoreRef.current);
                localStorage.setItem('invaders-best', scoreRef.current.toString());
              }
              return;
            }
          }
        }
      });

      // Check win
      const aliveCount = enemiesRef.current.filter((e) => e.alive).length;
      if (aliveCount === 0) {
        setGameState('won');
        if (scoreRef.current > bestScore) {
          setBestScore(scoreRef.current);
          localStorage.setItem('invaders-best', scoreRef.current.toString());
        }
        return;
      }

      // Check enemies reaching bottom
      const lowestEnemy = Math.max(...enemiesRef.current.filter((e) => e.alive).map((e) => e.y));
      if (lowestEnemy > CANVAS_H - 60) {
        setGameState('over');
        if (scoreRef.current > bestScore) {
          setBestScore(scoreRef.current);
          localStorage.setItem('invaders-best', scoreRef.current.toString());
        }
        return;
      }

      // === DRAW ===
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 37) % CANVAS_W;
        const sy = (i * 53 + now * 0.02) % CANVAS_H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Enemies
      enemiesRef.current.forEach((e) => {
        if (!e.alive) return;
        ctx.fillStyle = '#ff2e93';
        ctx.shadowColor = '#ff2e93';
        ctx.shadowBlur = 6;
        // Pixel-art style invader
        const px = 4;
        const pattern = [
          [0,1,0,0,0,0,1,0],
          [0,0,1,0,0,1,0,0],
          [0,1,1,1,1,1,1,0],
          [1,1,0,1,1,0,1,1],
          [1,1,1,1,1,1,1,1],
          [0,1,0,0,0,0,1,0],
        ];
        pattern.forEach((row, ry) => {
          row.forEach((cell, rx) => {
            if (cell) ctx.fillRect(e.x + rx * px, e.y + ry * px, px, px);
          });
        });
        ctx.shadowBlur = 0;
      });

      // Player ship
      const px2 = 4;
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      const playerPattern = [
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
      ];
      const pStartX = playerXRef.current - 16;
      const pStartY = CANVAS_H - 46;
      playerPattern.forEach((row, ry) => {
        row.forEach((cell, rx) => {
          if (cell) ctx.fillRect(pStartX + rx * px2, pStartY + ry * px2, px2, px2);
        });
      });
      ctx.shadowBlur = 0;

      // Bullets
      bulletsRef.current.forEach((b) => {
        ctx.fillStyle = b.fromPlayer ? '#00f0ff' : '#ff3355';
        ctx.shadowColor = b.fromPlayer ? '#00f0ff' : '#ff3355';
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
        ctx.shadowBlur = 0;
      });

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
        <div className="glass px-4 py-2 rounded-lg text-center">
          <div className="text-sm text-gray-400">Lives</div>
          <div className="font-display font-bold text-lg text-pink-400">{lives}</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="rounded-2xl border border-slate-700/50 touch-none"
          style={{ maxWidth: '100%', maxHeight: '420px' }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 flex flex-col items-center justify-center">
            <Rocket className="w-12 h-12 text-cyan-400 mb-3" />
            <div className="font-display font-bold text-xl text-white mb-2">Space Invaders</div>
            <div className="text-sm text-gray-400 mb-4 text-center max-w-xs px-4">
              Defend Earth from waves of alien invaders! Arrow keys to move, space to shoot. On mobile, drag to move and tap to fire.
            </div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold">
              Launch Mission
            </button>
          </div>
        )}

        {(gameState === 'over' || gameState === 'won') && (
          <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center animate-fade-in">
            <Trophy className={`w-10 h-10 mb-2 ${gameState === 'won' ? 'text-green-400' : 'text-pink-400'}`} />
            <div className="font-display font-bold text-xl text-white mb-1">
              {gameState === 'won' ? 'Victory!' : 'Game Over'}
            </div>
            <div className="font-display font-bold text-3xl text-cyan-400 mb-1">{score}</div>
            <div className="text-sm text-gray-400 mb-4">Best: {bestScore}</div>
            <button onClick={startGame} className="btn-primary px-8 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
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
        Arrow keys to move, space to shoot. Destroy all invaders before they reach the bottom!
      </p>
    </div>
  );
}
